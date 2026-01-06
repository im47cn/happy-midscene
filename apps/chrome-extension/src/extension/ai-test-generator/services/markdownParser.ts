/**
 * Markdown Parser for Test Requirements
 * Converts Markdown documents into structured test task queues
 */

export interface TaskStep {
  id: string;
  originalText: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  generatedAction?: string;
  error?: string;
  selector?: string; // Optional element selector for repair functionality
}

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  steps: TaskStep[];
  potentialParams: PotentialParam[];
}

export interface PotentialParam {
  name: string;
  value: string;
  source: string; // The original text where it was found
}

export interface ParseResult {
  cases: TestCase[];
  rawMarkdown: string;
  parseErrors: string[];
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract potential parameters from text
 * - Numbers (amounts, quantities)
 * - Quoted strings
 * - Email addresses
 * - URLs
 */
function extractParams(text: string): PotentialParam[] {
  const params: PotentialParam[] = [];

  // Quoted strings (single or double quotes)
  const quotedPattern = /["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = quotedPattern.exec(text)) !== null) {
    params.push({
      name: `param_${params.length + 1}`,
      value: match[1],
      source: match[0],
    });
  }

  // Numbers with optional decimal and units
  const numberPattern =
    /\b(\d+(?:\.\d+)?)\s*(元|￥|\$|%|个|次|秒|分钟|小时)?\b/g;
  while ((match = numberPattern.exec(text)) !== null) {
    // Skip if already captured in quotes
    if (!params.some((p) => p.source.includes(match![0]))) {
      params.push({
        name: `amount_${params.length + 1}`,
        value: match[1] + (match[2] || ''),
        source: match[0],
      });
    }
  }

  // Email addresses
  const emailPattern = /\b[\w.-]+@[\w.-]+\.\w+\b/g;
  while ((match = emailPattern.exec(text)) !== null) {
    params.push({
      name: `email_${params.length + 1}`,
      value: match[0],
      source: match[0],
    });
  }

  return params;
}

/**
 * Parse a single test case from markdown lines
 */
function parseTestCase(
  name: string,
  lines: string[],
  startIndex: number,
): TestCase {
  const steps: TaskStep[] = [];
  const allParams: PotentialParam[] = [];
  let description = '';

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();

    // Stop at next heading
    if (line.startsWith('#')) {
      break;
    }

    // Skip empty lines
    if (!line) {
      continue;
    }

    // Ordered list item (test step)
    const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const stepText = orderedMatch[2];
      steps.push({
        id: generateId(),
        originalText: stepText,
        status: 'pending',
      });
      allParams.push(...extractParams(stepText));
      continue;
    }

    // Unordered list item (also treat as step)
    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      const stepText = unorderedMatch[1];
      steps.push({
        id: generateId(),
        originalText: stepText,
        status: 'pending',
      });
      allParams.push(...extractParams(stepText));
      continue;
    }

    // Regular text before steps = description
    if (steps.length === 0 && line) {
      description += (description ? ' ' : '') + line;
    }
  }

  // Extract params from name and description too
  allParams.push(...extractParams(name));
  if (description) {
    allParams.push(...extractParams(description));
  }

  return {
    id: generateId(),
    name,
    description: description || undefined,
    steps,
    potentialParams: allParams,
  };
}

/**
 * Main parser function
 */
export function parseMarkdown(markdown: string): ParseResult {
  const lines = markdown.split('\n');
  const cases: TestCase[] = [];
  const parseErrors: string[] = [];

  let currentCaseName: string | null = null;
  let currentCaseStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match headings (# or ##)
    const headingMatch = line.match(/^#{1,2}\s+(.+)$/);
    if (headingMatch) {
      // Save previous case if exists
      if (currentCaseName !== null) {
        const testCase = parseTestCase(
          currentCaseName,
          lines,
          currentCaseStartLine,
        );
        if (testCase.steps.length > 0) {
          cases.push(testCase);
        } else {
          parseErrors.push(`Warning: Case "${currentCaseName}" has no steps`);
        }
      }

      currentCaseName = headingMatch[1];
      currentCaseStartLine = i + 1;
    }
  }

  // Don't forget the last case
  if (currentCaseName !== null) {
    const testCase = parseTestCase(
      currentCaseName,
      lines,
      currentCaseStartLine,
    );
    if (testCase.steps.length > 0) {
      cases.push(testCase);
    } else {
      parseErrors.push(`Warning: Case "${currentCaseName}" has no steps`);
    }
  }

  // If no headings found, treat entire content as single case
  if (cases.length === 0 && lines.some((l) => l.trim())) {
    const steps: TaskStep[] = [];
    const allParams: PotentialParam[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);

      if (orderedMatch) {
        steps.push({
          id: generateId(),
          originalText: orderedMatch[2],
          status: 'pending',
        });
        allParams.push(...extractParams(orderedMatch[2]));
      } else if (unorderedMatch) {
        steps.push({
          id: generateId(),
          originalText: unorderedMatch[1],
          status: 'pending',
        });
        allParams.push(...extractParams(unorderedMatch[1]));
      }
    }

    if (steps.length > 0) {
      cases.push({
        id: generateId(),
        name: 'Untitled Test Case',
        steps,
        potentialParams: allParams,
      });
    }
  }

  if (cases.length === 0) {
    parseErrors.push(
      'No test cases found. Please use headings (#) for case names and numbered lists for steps.',
    );
  }

  return {
    cases,
    rawMarkdown: markdown,
    parseErrors,
  };
}

/**
 * Validate markdown format
 */
export function validateMarkdown(markdown: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!markdown.trim()) {
    errors.push('Markdown content is empty');
    return { valid: false, errors };
  }

  const result = parseMarkdown(markdown);

  if (result.cases.length === 0) {
    errors.push('No valid test cases found');
  }

  for (const testCase of result.cases) {
    if (testCase.steps.length === 0) {
      errors.push(`Test case "${testCase.name}" has no steps`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: [...errors, ...result.parseErrors],
  };
}

/**
 * Format test case back to markdown
 */
export function formatTestCaseToMarkdown(testCase: TestCase): string {
  let md = `## ${testCase.name}\n\n`;

  if (testCase.description) {
    md += `${testCase.description}\n\n`;
  }

  testCase.steps.forEach((step, index) => {
    md += `${index + 1}. ${step.originalText}\n`;
  });

  return md;
}
