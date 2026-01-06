/**
 * Adaptive Syntax Highlight Component
 * 自适应语法高亮组件 - 高亮显示自适应测试语法
 */

import { Tag, Typography } from 'antd';
import React, { useMemo } from 'react';

const { Text } = Typography;

/**
 * Token types for adaptive test syntax
 */
export type TokenType =
  | 'keyword'
  | 'condition'
  | 'loop'
  | 'variable'
  | 'operator'
  | 'string'
  | 'number'
  | 'comment'
  | 'action'
  | 'text';

/**
 * Syntax token interface
 */
export interface SyntaxToken {
  type: TokenType;
  value: string;
  position?: { start: number; end: number };
}

/**
 * Color scheme for token types
 */
const tokenColors: Record<TokenType, string> = {
  keyword: '#d73a49', // Red - if, then, else, while, repeat
  condition: '#6f42c1', // Purple - conditional expressions
  loop: '#032f62', // Dark blue - loop keywords
  variable: '#e36209', // Orange - variable references
  operator: '#005cc5', // Blue - operators
  string: '#032f62', // Dark blue - string literals
  number: '#005cc5', // Blue - numbers
  comment: '#6a737d', // Gray - comments
  action: '#22863a', // Green - action descriptions
  text: '#24292e', // Black - normal text
};

/**
 * Background color for token types (optional)
 */
const tokenBgColors: Partial<Record<TokenType, string>> = {
  keyword: '#fff5f5',
  condition: '#f3f0ff',
  loop: '#f0f6ff',
  variable: '#fff8f0',
};

/**
 * Token patterns for syntax highlighting
 */
const tokenPatterns: Array<{ regex: RegExp; type: TokenType }> = [
  // Comments (must be first to avoid matching other patterns)
  { regex: /^(#.*$)/gm, type: 'comment' },

  // Keywords
  {
    regex:
      /\b(if|then|else|endif|while|endwhile|repeat|until|foreach|endfor|in)\b/gi,
    type: 'keyword',
  },

  // Variable references
  { regex: /\$\{([a-zA-Z_]\w*)\}/g, type: 'variable' },
  { regex: /\$([a-zA-Z_]\w*)\b/g, type: 'variable' },

  // Strings
  { regex: /"([^"\\]|\\.)*"/g, type: 'string' },
  { regex: /'([^'\\]|\\.)*'/g, type: 'string' },

  // Numbers
  { regex: /\b\d+(\.\d+)?\b/g, type: 'number' },

  // Operators
  { regex: /(===|!==|==|!=|>=|<=|&&|\|\||[+\-*/%<>!&|])/g, type: 'operator' },

  // Condition expressions
  {
    regex: /\b(condition|when|where|exists|contains|matches)\b/gi,
    type: 'condition',
  },
];

/**
 * Tokenize input text
 */
export function tokenizeAdaptiveSyntax(text: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const remainingText = text;
  const position = 0;

  // Sort patterns by position
  const matches: Array<{
    regex: RegExp;
    type: TokenType;
    match: RegExpExecArray;
    index: number;
  }> = [];

  for (const pattern of tokenPatterns) {
    let match: RegExpExecArray | null;
    // Reset regex state
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(text)) !== null) {
      matches.push({
        regex: pattern.regex,
        type: pattern.type,
        match,
        index: match.index,
      });
    }
  }

  // Sort matches by position
  matches.sort((a, b) => a.index - b.index);

  // Build tokens
  let lastEnd = 0;
  const usedIndices = new Set<string>();

  for (const { type, match, index } of matches) {
    // Skip overlapping matches
    const key = `${index}-${match.index}`;
    if (usedIndices.has(key)) continue;
    usedIndices.add(key);

    // Add text before this match
    if (index > lastEnd) {
      tokens.push({
        type: 'text',
        value: text.slice(lastEnd, index),
      });
    }

    // Add this token
    tokens.push({
      type,
      value: match[0],
    });

    lastEnd = index + match[0].length;
  }

  // Add remaining text
  if (lastEnd < text.length) {
    tokens.push({
      type: 'text',
      value: text.slice(lastEnd),
    });
  }

  return tokens;
}

/**
 * Render a single token
 */
function TokenRenderer({ token }: { token: SyntaxToken }): React.ReactNode {
  const color = tokenColors[token.type];
  const bgColor = tokenBgColors[token.type];

  if (token.type === 'text') {
    return <span>{token.value}</span>;
  }

  if (token.type === 'comment') {
    return (
      <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 11 }}>
        {token.value}
      </Text>
    );
  }

  return (
    <Tag
      style={{
        color,
        backgroundColor: bgColor,
        border: `1px solid ${color}33`,
        margin: 0,
        padding: '0 4px',
        fontSize: 12,
        fontFamily: 'monospace',
      }}
    >
      {token.value}
    </Tag>
  );
}

/**
 * Props for syntax highlight component
 */
export interface AdaptiveSyntaxHighlightProps {
  /** Text to highlight */
  children: string;
  /** CSS class name */
  className?: string;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Max lines to display (0 = unlimited) */
  maxLines?: number;
  /** Custom tokenizer */
  tokenizer?: (text: string) => SyntaxToken[];
}

/**
 * Adaptive Syntax Highlight Component
 * Highlights adaptive test syntax with color-coded tokens
 */
export function AdaptiveSyntaxHighlight({
  children,
  className = '',
  showLineNumbers = false,
  maxLines = 0,
  tokenizer = tokenizeAdaptiveSyntax,
}: AdaptiveSyntaxHighlightProps) {
  const tokens = useMemo(() => tokenizer(children), [children, tokenizer]);

  // Split into lines
  const lines: SyntaxToken[][] = [];
  let currentLine: SyntaxToken[] = [];
  let currentLineNum = 1;

  for (const token of tokens) {
    const tokenLines = token.value.split('\n');

    for (let i = 0; i < tokenLines.length; i++) {
      if (i > 0) {
        lines.push(currentLine);
        currentLine = [];
        currentLineNum++;
      }

      if (tokenLines[i]) {
        currentLine.push({
          ...token,
          value: tokenLines[i],
        });
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Apply max lines limit
  const displayLines = maxLines > 0 ? lines.slice(0, maxLines) : lines;
  const hasMore = lines.length > maxLines;

  return (
    <div className={`adaptive-syntax-highlight ${className}`}>
      <pre
        style={{
          margin: 0,
          padding: '12px 16px',
          backgroundColor: '#f6f8fa',
          borderRadius: 6,
          fontSize: 13,
          lineHeight: 1.6,
          overflowX: 'auto',
          fontFamily:
            "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
        }}
      >
        {displayLines.map((lineTokens, lineIndex) => (
          <div key={lineIndex} style={{ display: 'flex' }}>
            {showLineNumbers && (
              <span
                style={{
                  color: '#6a737d',
                  width: 32,
                  textAlign: 'right',
                  marginRight: 16,
                  userSelect: 'none',
                  flexShrink: 0,
                }}
              >
                {lineIndex + 1}
              </span>
            )}
            <span style={{ flex: 1 }}>
              {lineTokens.map((token, tokenIndex) => (
                <React.Fragment key={tokenIndex}>
                  <TokenRenderer token={token} />
                </React.Fragment>
              ))}
            </span>
          </div>
        ))}
        {hasMore && (
          <div style={{ color: '#6a737d', fontStyle: 'italic', marginTop: 4 }}>
            ... ({lines.length - maxLines} more lines)
          </div>
        )}
      </pre>
    </div>
  );
}

/**
 * Inline syntax highlight component
 * For highlighting inline code snippets
 */
export function InlineAdaptiveHighlight({
  children,
  className = '',
  tokenizer = tokenizeAdaptiveSyntax,
}: Omit<AdaptiveSyntaxHighlightProps, 'showLineNumbers' | 'maxLines'>) {
  const tokens = useMemo(() => tokenizer(children), [children, tokenizer]);

  return (
    <code
      className={`inline-adaptive-highlight ${className}`}
      style={{
        backgroundColor: '#f3f0ff',
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: 12,
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
      }}
    >
      {tokens.map((token, index) => (
        <span
          key={index}
          style={{
            color: tokenColors[token.type],
            fontWeight: token.type === 'keyword' ? 600 : 400,
          }}
        >
          {token.value}
        </span>
      ))}
    </code>
  );
}

export default AdaptiveSyntaxHighlight;
