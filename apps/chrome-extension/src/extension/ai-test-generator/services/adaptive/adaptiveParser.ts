/**
 * Adaptive Parser
 * 解析自适应测试用例 Markdown 为结构化数据
 */

import type {
  AdaptiveTestCase,
  AdaptiveStep,
  LoopConfig,
  Action,
  VariableOperation,
  ValidationResult,
  ParseOptions,
  SyntaxNode,
} from '../../types/adaptive';
import { DEFAULT_ADAPTIVE_CONFIG } from '../../types/adaptive';
import { parseConditionExpression, parseNaturalLanguageCondition } from './expressionParser';

/**
 * 解析上下文
 */
interface ParseContext {
  indentLevel: number;
  stepIdCounter: number;
  errors: string[];
  warnings: string[];
}

/**
 * 缩进步骤类型
 */
type IndentStep = {
  type: 'action' | 'condition' | 'loop' | 'variable' | 'then' | 'else' | 'end';
  indent: number;
  content: string;
  lineNumber: number;
};

/**
 * 创建唯一 ID
 */
function generateId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 解析 YAML frontmatter
 */
function parseFrontmatter(lines: string[]): { variables: Record<string, any>; config: any; endIndex: number } {
  const variables: Record<string, any> = {};
  let config: any = {};
  let endIndex = 0;

  // Check for YAML frontmatter
  if (lines[0]?.trim() === '---') {
    let yamlLine = 1;
    let yamlContent = '';

    while (yamlLine < lines.length && lines[yamlLine]?.trim() !== '---') {
      yamlContent += lines[yamlLine] + '\n';
      yamlLine++;
    }

    if (yamlLine < lines.length) {
      endIndex = yamlLine + 1;

      // Simple YAML parsing
      const varMatch = yamlContent.match(/variables:\s*\n((?:  .+\n*)+)/);
      if (varMatch) {
        const varLines = varMatch[1].trim().split('\n');
        for (const line of varLines) {
          const match = line.match(/^\s*(\w+):\s*(.+)$/);
          if (match) {
            const value = match[2].trim();
            variables[match[1]] = isNaN(Number(value)) ? value.replace(/"/g, '') : Number(value);
          }
        }
      }

      const configMatch = yamlContent.match(/config:\s*\n((?:  .+\n*)+)/);
      if (configMatch) {
        const configLines = configMatch[1].trim().split('\n');
        for (const line of configLines) {
          const match = line.match(/^\s*(\w+):\s*(.+)$/);
          if (match) {
            const value = match[2].trim();
            config[match[1]] = isNaN(Number(value)) ? value === 'true' : Number(value);
          }
        }
      }
    }
  }

  return { variables, config, endIndex };
}

/**
 * 解析行类型
 */
function parseLineType(line: string): { type: IndentStep['type']; content: string } | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  // Condition keywords
  if (trimmed.match(/^when\s+:/i) || trimmed.match(/^when\s+/i)) {
    return { type: 'condition', content: trimmed };
  }
  if (trimmed.match(/^then\s*:/i)) {
    return { type: 'then', content: trimmed };
  }
  if (trimmed.match(/^else\s*:/i)) {
    return { type: 'else', content: trimmed };
  }

  // Loop keywords
  if (trimmed.match(/^repeat\s+\d+\s+times/i) || trimmed.match(/^while\s+/i) || trimmed.match(/^forEach\s+/i)) {
    return { type: 'loop', content: trimmed };
  }

  // Variable operations
  if (trimmed.match(/^set\s+\w+\s*=/) || trimmed.match(/^extract\s+\w+\s+from/) || trimmed.match(/^increment\s+\w+/)) {
    return { type: 'variable', content: trimmed };
  }

  // Default: action
  return { type: 'action', content: trimmed };
}

/**
 * 解析缩进级别
 */
function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * 解析动作
 */
function parseAction(content: string): Action {
  // Click action
  if (content.match(/^点击\s+/) || content.match(/^click\s+/i)) {
    const targetMatch = content.match(/(?:点击|click)\s+"([^"]+)"/) || content.match(/(?:点击|click)\s+(.+)$/);
    return {
      type: 'click',
      target: targetMatch ? targetMatch[1].trim() : content,
    };
  }

  // Input action
  if (content.match(/^输入\s+/) || content.match(/^input\s+/i)) {
    const valueMatch = content.match(/"(?:[^"]+)"/);
    const targetMatch = content.match(/into\s+"([^"]+)"/) || content.match(/into\s+(.+)$/);
    return {
      type: 'input',
      target: targetMatch ? targetMatch[1].trim() : '',
      value: valueMatch ? valueMatch[0] : '',
    };
  }

  // Assert action
  if (content.match(/^断言\s+/) || content.match(/^assert\s+/i)) {
    const targetMatch = content.match(/(?:断言|assert)\s+"([^"]+)"/) || content.match(/(?:断言|assert)\s+(.+)$/);
    return {
      type: 'assert',
      target: targetMatch ? targetMatch[1].trim() : content,
    };
  }

  // Wait action
  if (content.match(/^等待\s+/) || content.match(/^wait\s+/i)) {
    const targetMatch = content.match(/(?:等待|wait)\s+(\d+)\s*(s|sec|second|秒)/i);
    return {
      type: 'wait',
      target: targetMatch ? `${targetMatch[1]}s` : '1s',
      value: targetMatch ? targetMatch[1] : '1',
    };
  }

  // Navigate action
  if (content.match(/^导航\s+/) || content.match(/^navigate\s+/i)) {
    const targetMatch = content.match(/(?:导航|navigate)\s+(?:to\s+)?["']?([^"'\s]+)["']?/);
    return {
      type: 'navigate',
      target: targetMatch ? targetMatch[1] : content,
    };
  }

  // Scroll action
  if (content.match(/^滚动\s+/) || content.match(/^scroll\s+/i)) {
    const targetMatch = content.match(/(?:滚动|scroll)\s+(?:to\s+)?(.+)/);
    return {
      type: 'scroll',
      target: targetMatch ? targetMatch[1].trim() : 'down',
    };
  }

  // Hover action
  if (content.match(/^悬停\s+/) || content.match(/^hover\s+/i)) {
    const targetMatch = content.match(/(?:悬停|hover)\s+"([^"]+)"/) || content.match(/(?:悬停|hover)\s+(.+)$/);
    return {
      type: 'hover',
      target: targetMatch ? targetMatch[1].trim() : content,
    };
  }

  // Default: treat as action with original text
  return {
    type: 'click',
    target: content,
  };
}

/**
 * 解析条件表达式
 */
function parseConditionFromLine(line: string): string {
  // Extract condition after "when"
  const match = line.match(/^when\s+(.+)/i) || line.match(/^when:\s*(.+)/i);
  if (match) {
    return match[1].trim();
  }
  return line;
}

/**
 * 解析循环配置
 */
function parseLoopConfig(content: string): LoopConfig {
  // Count loop: repeat N times
  const countMatch = content.match(/repeat\s+(\d+)\s+times/i);
  if (countMatch) {
    return {
      type: 'count',
      count: parseInt(countMatch[1], 10),
      body: [],
      maxIterations: parseInt(countMatch[1], 10) + 10,
    };
  }

  // While loop: while CONDITION
  const whileMatch = content.match(/while\s+(.+)/i);
  if (whileMatch) {
    return {
      type: 'while',
      condition: whileMatch[1].trim(),
      body: [],
      maxIterations: 50,
      timeout: 30000,
    };
  }

  // ForEach loop: forEach TARGET as VAR
  const forEachMatch = content.match(/forEach\s+"([^"]+)"\s+as\s+(\w+)/i) ||
                      content.match(/forEach\s+(\S+)\s+as\s+(\w+)/i);
  if (forEachMatch) {
    return {
      type: 'forEach',
      collection: forEachMatch[1],
      itemVar: forEachMatch[2],
      body: [],
      maxIterations: 50,
      timeout: 30000,
    };
  }

  // Default: count loop
  return {
    type: 'count',
    count: 1,
    body: [],
    maxIterations: 10,
  };
}

/**
 * 解析变量操作
 */
function parseVariableOperation(content: string): VariableOperation {
  // Set variable
  const setMatch = content.match(/^set\s+(\w+)\s*=\s*(.+)$/);
  if (setMatch) {
    let value: any = setMatch[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (!isNaN(Number(value))) {
      value = Number(value);
    }
    return {
      operation: 'set',
      name: setMatch[1],
      value,
    };
  }

  // Extract from page
  const extractMatch = content.match(/^extract\s+(\w+)\s+from\s+"(.+)"$/) ||
                        content.match(/^extract\s+(\w+)\s+from\s+(\S+)$/);
  if (extractMatch) {
    return {
      operation: 'extract',
      name: extractMatch[1],
      source: extractMatch[2],
    };
  }

  // Increment
  const incMatch = content.match(/^increment\s+(\w+)$/);
  if (incMatch) {
    return {
      operation: 'increment',
      name: incMatch[1],
    };
  }

  // Default
  return {
    operation: 'set',
    name: 'unknown',
    value: content,
  };
}

/**
 * 构建语法树
 */
function buildSyntaxTree(steps: IndentStep[]): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  const stack: { node: SyntaxNode; indent: number }[] = [];

  for (const step of steps) {
    const node: SyntaxNode = {
      type: step.type === 'action' ? 'action' :
            step.type === 'condition' ? 'condition' :
            step.type === 'loop' ? 'loop' :
            step.type === 'variable' ? 'variable' :
            step.type === 'then' ? 'condition' :
            step.type === 'else' ? 'else' : 'end',
      content: step.content,
      indent: step.indent,
      lineNumber: step.lineNumber,
    };

    // Pop stack until we find parent with lower indent
    while (stack.length > 0 && stack[stack.length - 1].indent >= step.indent) {
      stack.pop();
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1].node;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(node);
    } else {
      nodes.push(node);
    }

    // Conditions, loops, and variables can have children
    if (['condition', 'loop', 'variable'].includes(node.type)) {
      stack.push({ node, indent: step.indent });
    }
  }

  return nodes;
}

/**
 * 解析步骤为 AdaptiveStep
 */
function parseStep(step: IndentStep, context: ParseContext): AdaptiveStep | null {
  const id = generateId();

  switch (step.type) {
    case 'action':
      return {
        id,
        type: 'action',
        description: step.content,
        action: parseAction(step.content),
        lineNumber: step.lineNumber,
        indent: step.indent,
      };

    case 'condition': {
      const expression = parseConditionFromLine(step.content);
      return {
        id,
        type: 'condition',
        description: expression,
        condition: {
          expression,
          thenSteps: [],
          elseSteps: [],
        },
        lineNumber: step.lineNumber,
        indent: step.indent,
      };
    }

    case 'loop': {
      const loopConfig = parseLoopConfig(step.content);
      return {
        id,
        type: 'loop',
        description: step.content,
        loop: loopConfig,
        lineNumber: step.lineNumber,
        indent: step.indent,
      };
    }

    case 'variable': {
      const varOp = parseVariableOperation(step.content);
      return {
        id,
        type: 'variable',
        description: step.content,
        variable: varOp,
        lineNumber: step.lineNumber,
        indent: step.indent,
      };
    }

    default:
      return null;
  }
}

/**
 * 组织嵌套步骤结构
 */
function organizeSteps(
  flatSteps: IndentStep[],
  context: ParseContext
): AdaptiveStep[] {
  const result: AdaptiveStep[] = [];
  const stack: { step: AdaptiveStep; indent: number }[] = [];

  for (const indentStep of flatSteps) {
    // Skip then/else markers (they're structural)
    if (indentStep.type === 'then' || indentStep.type === 'else') {
      continue;
    }

    const step = parseStep(indentStep, context);
    if (!step) continue;

    // Pop stack until we find parent
    while (stack.length > 0 && stack[stack.length - 1].indent >= indentStep.indent) {
      stack.pop();
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1].step;

      // Add to appropriate branch
      if (parent.type === 'condition' && parent.condition) {
        // Check if this is after an 'else' marker
        const elseIndex = flatSteps.findIndex(
          s => s.lineNumber > indentStep.lineNumber && s.type === 'else'
        );
        const beforeElse = elseIndex === -1 || flatSteps[elseIndex].lineNumber > indentStep.lineNumber;

        if (beforeElse) {
          parent.condition.thenSteps.push(step);
        } else {
          parent.condition.elseSteps = parent.condition.elseSteps || [];
          parent.condition.elseSteps!.push(step);
        }
      } else if (parent.type === 'loop' && parent.loop) {
        parent.loop.body.push(step);
      }
    } else {
      result.push(step);
    }

    // Push to stack if it can have children
    if (['condition', 'loop'].includes(step.type)) {
      stack.push({ step, indent: indentStep.indent });
    }
  }

  return result;
}

/**
 * 主解析函数
 */
export function parseAdaptiveTest(
  markdown: string,
  options: ParseOptions = {}
): AdaptiveTestCase {
  const lines = markdown.split('\n');

  // Parse frontmatter
  const { variables, config, endIndex } = parseFrontmatter(lines);

  // Find test case name (first heading)
  let name = 'Untitled Test Case';
  let description = '';

  for (let i = endIndex; i < lines.length; i++) {
    const headingMatch = lines[i]?.match(/^#{1,2}\s+(.+)$/);
    if (headingMatch) {
      name = headingMatch[1].trim();
      // Get description from following lines
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j]?.trim().startsWith('#') || lines[j]?.trim().startsWith('-')) break;
        if (lines[j]?.trim()) {
          description += (description ? ' ' : '') + lines[j]!.trim();
        }
      }
      break;
    }
  }

  // Parse steps
  const indentSteps: IndentStep[] = [];
  let inStepsSection = false;

  for (let i = endIndex; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }

    // Check for steps section
    if (trimmed.match(/^steps?:/i)) {
      inStepsSection = true;
      continue;
    }

    // Start parsing after we see list items
    if (trimmed.match(/^[-\d.]/)) {
      inStepsSection = true;
    }

    if (!inStepsSection) {
      continue;
    }

    // Parse line type
    const parsed = parseLineType(line);
    if (parsed) {
      indentSteps.push({
        type: parsed.type,
        content: parsed.content,
        indent: getIndentLevel(line),
        lineNumber: i + 1,
      });
    }
  }

  // Build context
  const context: ParseContext = {
    indentLevel: 0,
    stepIdCounter: 0,
    errors: [],
    warnings: [],
  };

  // Organize steps into hierarchy
  const steps = organizeSteps(indentSteps, context);

  // Create test case
  return {
    id: generateId(),
    name,
    description: description || undefined,
    steps,
    variables,
    config: { ...DEFAULT_ADAPTIVE_CONFIG, ...config },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 验证测试用例
 */
export function validateAdaptiveTest(
  testCase: AdaptiveTestCase,
  options: ParseOptions = {}
): ValidationResult {
  const errors: any[] = [];
  const warnings: any[] = [];

  // Check basic structure
  if (!testCase.name) {
    errors.push({
      type: 'structure',
      message: 'Test case name is required',
    });
  }

  if (testCase.steps.length === 0) {
    errors.push({
      type: 'structure',
      message: 'Test case must have at least one step',
    });
  }

  // Validate each step
  for (const step of testCase.steps) {
    validateStep(step, errors, warnings, 0, options.maxDepth || 3);
  }

  // Check config limits
  if (testCase.config.maxLoopIterations > 100) {
    warnings.push({
      type: 'performance',
      message: 'maxLoopIterations is very high (100+), consider reducing',
      suggestion: 'Set maxLoopIterations to 50 or less',
    });
  }

  if (testCase.config.maxNestedDepth > 5) {
    warnings.push({
      type: 'complexity',
      message: 'maxNestedDepth is very high (5+), may cause performance issues',
      suggestion: 'Set maxNestedDepth to 3 or less',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证单个步骤
 */
function validateStep(
  step: AdaptiveStep,
  errors: any[],
  warnings: any[],
  depth: number,
  maxDepth: number
): void {
  // Check nesting depth
  if (depth > maxDepth) {
    errors.push({
      type: 'limit',
      message: `Step "${step.description}" exceeds maximum nesting depth`,
      line: step.lineNumber,
    });
    return;
  }

  // Validate condition
  if (step.type === 'condition' && step.condition) {
    const parseResult = parseNaturalLanguageCondition(step.condition.expression);
    if (!parseResult.success) {
      errors.push({
        type: 'syntax',
        message: `Invalid condition expression: ${parseResult.error}`,
        line: step.lineNumber,
      });
    }

    // Validate then steps
    for (const thenStep of step.condition.thenSteps) {
      validateStep(thenStep, errors, warnings, depth + 1, maxDepth);
    }

    // Validate else steps
    if (step.condition.elseSteps) {
      for (const elseStep of step.condition.elseSteps) {
        validateStep(elseStep, errors, warnings, depth + 1, maxDepth);
      }
    }
  }

  // Validate loop
  if (step.type === 'loop' && step.loop) {
    if (step.loop.type === 'while' && !step.loop.condition) {
      errors.push({
        type: 'syntax',
        message: 'While loop must have a condition',
        line: step.lineNumber,
      });
    }

    if (step.loop.type === 'forEach' && !step.loop.collection) {
      errors.push({
        type: 'syntax',
        message: 'ForEach loop must have a collection',
        line: step.lineNumber,
      });
    }

    // Validate loop body
    for (const bodyStep of step.loop.body) {
      validateStep(bodyStep, errors, warnings, depth + 1, maxDepth);
    }
  }

  // Validate variable operation
  if (step.type === 'variable' && step.variable) {
    if (!step.variable.name) {
      errors.push({
        type: 'syntax',
        message: 'Variable operation must have a name',
        line: step.lineNumber,
      });
    }

    if (step.variable.operation === 'set' && step.variable.value === undefined) {
      warnings.push({
        type: 'maintainability',
        message: 'Variable set without a value',
        line: step.lineNumber,
        suggestion: 'Provide a value or use extract operation',
      });
    }
  }
}

/**
 * 构建语法树
 */
export function buildParseTree(testCase: AdaptiveTestCase): SyntaxNode[] {
  const steps: IndentStep[] = [];

  function flattenSteps(inputSteps: AdaptiveStep[], indent = 0): void {
    for (const step of inputSteps) {
      steps.push({
        type: step.type === 'action' ? 'action' :
              step.type === 'condition' ? 'condition' :
              step.type === 'loop' ? 'loop' : 'variable',
        content: step.description,
        indent: step.indent || indent,
        lineNumber: step.lineNumber || 0,
      });

      if (step.type === 'condition') {
        flattenSteps(step.condition?.thenSteps || [], indent + 2);
        flattenSteps(step.condition?.elseSteps || [], indent + 2);
      }
      if (step.type === 'loop') {
        flattenSteps(step.loop?.body || [], indent + 2);
      }
    }
  }

  flattenSteps(testCase.steps);
  return buildSyntaxTree(steps);
}

/**
 * 格式化测试用例为 Markdown
 */
export function formatAdaptiveTestToMarkdown(testCase: AdaptiveTestCase): string {
  let md = `---\n`;
  md += `name: ${testCase.name}\n`;
  if (testCase.description) {
    md += `description: ${testCase.description}\n`;
  }
  if (Object.keys(testCase.variables).length > 0) {
    md += `variables:\n`;
    for (const [key, value] of Object.entries(testCase.variables)) {
      md += `  ${key}: ${typeof value === 'string' ? `"${value}"` : value}\n`;
    }
  }
  md += `---\n\n`;

  md += `## ${testCase.name}\n\n`;
  if (testCase.description) {
    md += `${testCase.description}\n\n`;
  }

  md += `steps:\n`;

  function formatStep(step: AdaptiveStep, indent = 0): void {
    const prefix = '  '.repeat(indent);
    const dash = indent === 0 ? '-' : '  ';

    switch (step.type) {
      case 'action':
        md += `${prefix}${dash} ${step.description}\n`;
        break;

      case 'condition':
        md += `${prefix}- when: ${step.condition?.expression}\n`;
        md += `${prefix}  then:\n`;
        for (const thenStep of step.condition?.thenSteps || []) {
          formatStep(thenStep, indent + 2);
        }
        if (step.condition?.elseSteps && step.condition.elseSteps.length > 0) {
          md += `${prefix}  else:\n`;
          for (const elseStep of step.condition.elseSteps) {
            formatStep(elseStep, indent + 2);
          }
        }
        break;

      case 'loop':
        if (step.loop?.type === 'count') {
          md += `${prefix}- repeat ${step.loop.count} times:\n`;
        } else if (step.loop?.type === 'while') {
          md += `${prefix}- while: ${step.loop.condition}\n`;
        } else if (step.loop?.type === 'forEach') {
          md += `${prefix}- forEach "${step.loop.collection}" as ${step.loop.itemVar}:\n`;
        }
        for (const bodyStep of step.loop?.body || []) {
          formatStep(bodyStep, indent + 1);
        }
        break;

      case 'variable':
        md += `${prefix}- ${step.description}\n`;
        break;
    }
  }

  for (const step of testCase.steps) {
    formatStep(step);
  }

  return md;
}
