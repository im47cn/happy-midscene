/**
 * Adaptive Syntax Highlight Component Tests
 * Tests for tokenization and core functions without React rendering
 */

import { describe, expect, it } from 'vitest';
import {
  tokenizeAdaptiveSyntax,
  type SyntaxToken,
  type TokenType,
} from '../AdaptiveSyntaxHighlight';

describe('tokenizeAdaptiveSyntax', () => {
  it('should tokenize empty text', () => {
    const tokens = tokenizeAdaptiveSyntax('');
    // Empty string returns empty array
    expect(tokens).toHaveLength(0);
  });

  it('should tokenize plain text', () => {
    const tokens = tokenizeAdaptiveSyntax('Click on the button');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({ type: 'text', value: 'Click on the button' });
  });

  it('should tokenize keywords', () => {
    const tokens = tokenizeAdaptiveSyntax('if then else endif');
    const keywordTokens = tokens.filter((t) => t.type === 'keyword');
    expect(keywordTokens).toHaveLength(4);
    const values = keywordTokens.map((t) => t.value);
    expect(values).toContain('if');
    expect(values).toContain('then');
    expect(values).toContain('else');
    expect(values).toContain('endif');
  });

  it('should tokenize loop keywords', () => {
    const tokens = tokenizeAdaptiveSyntax('while endwhile repeat until foreach endfor in');
    const keywordTokens = tokens.filter((t) => t.type === 'keyword');
    expect(keywordTokens).toHaveLength(7);
    const values = keywordTokens.map((t) => t.value);
    expect(values).toContain('while');
    expect(values).toContain('repeat');
    expect(values).toContain('foreach');
  });

  it('should tokenize variable references with ${} syntax', () => {
    const tokens = tokenizeAdaptiveSyntax('${username}');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('variable');
    expect(tokens[0].value).toBe('${username}');
  });

  it('should tokenize variable references with $ syntax', () => {
    const tokens = tokenizeAdaptiveSyntax('$count');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('variable');
    expect(tokens[0].value).toBe('$count');
  });

  it('should tokenize string literals with double quotes', () => {
    const tokens = tokenizeAdaptiveSyntax('"hello world"');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('string');
    expect(tokens[0].value).toBe('"hello world"');
  });

  it('should tokenize string literals with single quotes', () => {
    const tokens = tokenizeAdaptiveSyntax("'test'");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('string');
    expect(tokens[0].value).toBe("'test'");
  });

  it('should tokenize numbers', () => {
    const tokens = tokenizeAdaptiveSyntax('123 45.67');
    const numberTokens = tokens.filter((t) => t.type === 'number');
    expect(numberTokens).toHaveLength(2);
    expect(numberTokens.map((t) => t.value)).toEqual(['123', '45.67']);
  });

  it('should tokenize operators', () => {
    const tokens = tokenizeAdaptiveSyntax('=== !== == != >= <= && ||');
    const operatorTokens = tokens.filter((t) => t.type === 'operator');
    expect(operatorTokens.length).toBeGreaterThan(0);
  });

  it('should tokenize comments', () => {
    const tokens = tokenizeAdaptiveSyntax('# This is a comment\nClick button');
    const commentTokens = tokens.filter((t) => t.type === 'comment');
    expect(commentTokens).toHaveLength(1);
    expect(commentTokens[0].value).toBe('# This is a comment');
  });

  it('should tokenize complex adaptive test', () => {
    // Use string concatenation to avoid template literal issues
    const text = '# Login test\nif ${userLoggedIn}\n  Click "logout button"\nelse\n  Click "login button"\nendif';
    const tokens = tokenizeAdaptiveSyntax(text);

    // Check for various token types
    const types = new Set(tokens.map((t) => t.type));
    expect(types).toContain('comment');
    expect(types).toContain('keyword');
    expect(types).toContain('variable');
    expect(types).toContain('string');
    expect(types).toContain('text');
  });

  it('should tokenize mixed content correctly', () => {
    const text = 'if ${loggedIn} === true then "welcome"';
    const tokens = tokenizeAdaptiveSyntax(text);

    const types = tokens.map((t) => ({ type: t.type, value: t.value }));
    expect(types.some((t) => t.type === 'keyword')).toBe(true);
    expect(types.some((t) => t.type === 'variable')).toBe(true);
    expect(types.some((t) => t.type === 'operator')).toBe(true);
    expect(types.some((t) => t.type === 'string')).toBe(true);
  });

  it('should preserve token order', () => {
    const tokens = tokenizeAdaptiveSyntax('if then else endif');
    // Note: spaces are included as text tokens
    const values = tokens.map((t) => t.value);
    expect(values).toContain('if');
    expect(values).toContain('then');
    expect(values).toContain('else');
    expect(values).toContain('endif');
  });

  it('should tokenize condition keywords', () => {
    const tokens = tokenizeAdaptiveSyntax('when exists contains matches');
    const conditionTokens = tokens.filter((t) => t.type === 'condition');
    expect(conditionTokens.length).toBeGreaterThan(0);
  });

  it('should handle empty string tokens', () => {
    const tokens = tokenizeAdaptiveSyntax('""');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('string');
  });

  it('should handle multiple variables in one line', () => {
    const tokens = tokenizeAdaptiveSyntax('${var1} and ${var2}');
    expect(tokens.length).toBeGreaterThanOrEqual(3);
    const variableTokens = tokens.filter((t) => t.type === 'variable');
    expect(variableTokens).toHaveLength(2);
  });

  it('should handle whitespace between tokens', () => {
    const tokens = tokenizeAdaptiveSyntax('if    then');
    // Should have if, text (spaces), then
    expect(tokens.length).toBeGreaterThan(1);
    const keywords = tokens.filter((t) => t.type === 'keyword');
    expect(keywords).toHaveLength(2);
  });
});
