/**
 * Expression Parser
 * 解析条件表达式为 AST 结构
 */

import type {
  ConditionExpression,
  ConditionType,
  ComparisonOperator,
  ElementCheck,
  LogicalOperator,
  PageState,
  TextOperator,
} from '../../types/adaptive';

/**
 * 解析结果接口
 */
export interface ParseResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  position?: number;
}

/**
 * Token 类型
 */
type Token =
  | { type: 'ELEMENT' | 'TEXT' | 'STATE' | 'VARIABLE'; value: string }
  | { type: 'OPERATOR'; value: ComparisonOperator | TextOperator | LogicalOperator }
  | { type: 'CHECK'; value: ElementCheck }
  | { type: 'PAGE_STATE'; value: PageState }
  | { type: 'NUMBER'; value: number }
  | { type: 'STRING'; value: string }
  | { type: 'LPAREN'; value: string }
  | { type: 'RPAREN'; value: string }
  | { type: 'COMMA'; value: string }
  | { type: 'KEYWORD'; value: 'is' | 'not' | 'and' | 'or' | 'contains' | 'matches' | 'equals' }
  | { type: 'EOF'; value: string };

/**
 * 词法分析器
 */
class Lexer {
  private pos = 0;
  private input: string;

  constructor(input: string) {
    this.input = input.trim();
  }

  private peek(offset = 0): string {
    return this.input[this.pos + offset] || '';
  }

  private advance(): string {
    return this.input[this.pos++] || '';
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek())) {
      this.advance();
    }
  }

  private readString(): string {
    let result = '';
    this.advance(); // skip opening quote
    while (this.peek() && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.advance();
        result += this.advance();
      } else {
        result += this.advance();
      }
    }
    this.advance(); // skip closing quote
    return result;
  }

  private readWord(): string {
    let result = '';
    while (this.peek() && /[\w\u4e00-\u9fa5-]/.test(this.peek())) {
      result += this.advance();
    }
    return result;
  }

  private readNumber(): string {
    let result = '';
    while (this.peek() && /\d/.test(this.peek())) {
      result += this.advance();
    }
    return result;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      this.skipWhitespace();

      if (this.pos >= this.input.length) break;

      const char = this.peek();

      // String literal
      if (char === '"') {
        tokens.push({ type: 'STRING', value: this.readString() });
        continue;
      }

      // Parentheses
      if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(' });
        this.advance();
        continue;
      }
      if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        this.advance();
        continue;
      }
      if (char === ',') {
        tokens.push({ type: 'COMMA', value: ',' });
        this.advance();
        continue;
      }

      // Numbers
      if (/\d/.test(char)) {
        const num = this.readNumber();
        tokens.push({ type: 'NUMBER', value: parseInt(num, 10) });
        continue;
      }

      // Words/Keywords
      if (/[\w\u4e00-\u9fa5]/.test(char)) {
        const word = this.readWord();

        // Check for keywords
        const lowerWord = word.toLowerCase();

        if (lowerWord === 'element' || lowerWord === '元素') {
          tokens.push({ type: 'ELEMENT', value: word });
          continue;
        }
        if (lowerWord === 'text' || lowerWord === '文本') {
          tokens.push({ type: 'TEXT', value: word });
          continue;
        }
        if (lowerWord === 'state' || lowerWord === '状态') {
          tokens.push({ type: 'STATE', value: word });
          continue;
        }
        if (lowerWord === 'and' || lowerWord === '&&') {
          tokens.push({ type: 'KEYWORD', value: 'and' });
          continue;
        }
        if (lowerWord === 'or' || lowerWord === '||') {
          tokens.push({ type: 'KEYWORD', value: 'or' });
          continue;
        }
        if (lowerWord === 'not' || lowerWord === '!') {
          tokens.push({ type: 'KEYWORD', value: 'not' });
          continue;
        }
        if (lowerWord === 'is' || lowerWord === 'is not' || lowerWord === '是' || lowerWord === '不是') {
          tokens.push({ type: 'KEYWORD', value: 'is' });
          continue;
        }
        if (lowerWord === 'contains') {
          tokens.push({ type: 'OPERATOR', value: 'contains' as TextOperator });
          continue;
        }
        if (lowerWord === 'matches') {
          tokens.push({ type: 'OPERATOR', value: 'matches' as TextOperator });
          continue;
        }
        if (lowerWord === 'equals') {
          tokens.push({ type: 'OPERATOR', value: 'equals' as TextOperator });
          continue;
        }

        // Element checks
        if (['exists', 'visible', 'enabled', 'selected'].includes(lowerWord)) {
          tokens.push({ type: 'CHECK', value: lowerWord as ElementCheck });
          continue;
        }
        if (['存在', '可见', '可用', '选中'].includes(lowerWord)) {
          const checkMap: Record<string, ElementCheck> = {
            存在: 'exists',
            可见: 'visible',
            可用: 'enabled',
            选中: 'selected',
          };
          tokens.push({ type: 'CHECK', value: checkMap[lowerWord] });
          continue;
        }

        // Page states
        if (['logged_in', 'loading', 'error', 'empty', 'custom'].includes(lowerWord)) {
          tokens.push({ type: 'PAGE_STATE', value: lowerWord as PageState });
          continue;
        }
        if (['已登录', '加载中', '错误', '空', '自定义'].includes(lowerWord)) {
          const stateMap: Record<string, PageState> = {
            已登录: 'logged_in',
            加载中: 'loading',
            错误: 'error',
            空: 'empty',
            自定义: 'custom',
          };
          tokens.push({ type: 'PAGE_STATE', value: stateMap[lowerWord] });
          continue;
        }

        // Comparison operators
        if (['==', '!=', '>', '<', '>=', '<='].includes(lowerWord)) {
          tokens.push({ type: 'OPERATOR', value: lowerWord as ComparisonOperator });
          continue;
        }

        // Variable or text target
        tokens.push({ type: 'VARIABLE', value: word });
        continue;
      }

      // Unknown token - skip
      this.advance();
    }

    tokens.push({ type: 'EOF', value: '' });
    return tokens;
  }
}

/**
 * 语法分析器
 */
class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: '' };
  }

  private advance(): Token {
    return this.tokens[this.pos++] || { type: 'EOF', value: '' };
  }

  private expect(type: Token['type'], value?: string): Token | null {
    const token = this.peek();
    if (token.type !== type) {
      return null;
    }
    if (value !== undefined && token.value !== value) {
      return null;
    }
    return this.advance();
  }

  private parseElementCondition(): ParseResult<ConditionExpression> {
    // element "target" is/is not CHECK
    const token = this.advance();
    if (token?.type !== 'ELEMENT') {
      return { success: false, error: 'Expected element keyword' };
    }

    const targetToken = this.expect('STRING');
    if (!targetToken) {
      return { success: false, error: 'Expected element target (string)' };
    }

    const isKeyword = this.expect('KEYWORD', 'is');
    if (!isKeyword) {
      return { success: false, error: 'Expected "is" keyword' };
    }

    const checkToken = this.expect('CHECK');
    if (!checkToken) {
      return { success: false, error: 'Expected element check (exists/visible/enabled/selected)' };
    }

    return {
      success: true,
      result: {
        type: 'element',
        element: {
          target: targetToken.value as string,
          check: checkToken.value as ElementCheck,
        },
      },
    };
  }

  private parseTextCondition(): ParseResult<ConditionExpression> {
    // text "target" OPERATOR "value"
    const token = this.advance();
    if (token?.type !== 'TEXT') {
      return { success: false, error: 'Expected text keyword' };
    }

    const targetToken = this.expect('STRING');
    if (!targetToken) {
      return { success: false, error: 'Expected text target (string)' };
    }

    const operatorToken = this.expect('OPERATOR');
    if (!operatorToken || !['equals', 'contains', 'matches'].includes(operatorToken.value as TextOperator)) {
      return { success: false, error: 'Expected text operator (equals/contains/matches)' };
    }

    const valueToken = this.expect('STRING');
    if (!valueToken) {
      return { success: false, error: 'Expected text value (string)' };
    }

    return {
      success: true,
      result: {
        type: 'text',
        text: {
          target: targetToken.value as string,
          operator: operatorToken.value as TextOperator,
          value: valueToken.value as string,
        },
      },
    };
  }

  private parseStateCondition(): ParseResult<ConditionExpression> {
    // state is PAGE_STATE
    const token = this.advance();
    if (token?.type !== 'STATE') {
      return { success: false, error: 'Expected state keyword' };
    }

    const isKeyword = this.expect('KEYWORD', 'is');
    if (!isKeyword) {
      return { success: false, error: 'Expected "is" keyword' };
    }

    const stateToken = this.expect('PAGE_STATE');
    if (!stateToken) {
      return { success: false, error: 'Expected page state (logged_in/loading/error/empty/custom)' };
    }

    return {
      success: true,
      result: {
        type: 'state',
        state: {
          type: stateToken.value as PageState,
        },
      },
    };
  }

  private parseVariableCondition(): ParseResult<ConditionExpression> {
    // variable OPERATOR value
    const nameToken = this.expect('VARIABLE');
    if (!nameToken) {
      return { success: false, error: 'Expected variable name' };
    }

    const operatorToken = this.expect('OPERATOR');
    if (!operatorToken) {
      return { success: false, error: 'Expected comparison operator' };
    }

    // Value can be number or string
    const valueToken = this.peek();
    if (valueToken.type === 'NUMBER') {
      this.advance();
      return {
        success: true,
        result: {
          type: 'variable',
          variable: {
            name: nameToken.value as string,
            operator: operatorToken.value as ComparisonOperator,
            value: valueToken.value as number,
          },
        },
      };
    }

    if (valueToken.type === 'STRING') {
      this.advance();
      return {
        success: true,
        result: {
          type: 'variable',
          variable: {
            name: nameToken.value as string,
            operator: operatorToken.value as ComparisonOperator,
            value: valueToken.value as string,
          },
        },
      };
    }

    return { success: false, error: 'Expected variable value (number or string)' };
  }

  private parseCompound(): ParseResult<ConditionExpression> {
    // (condition OPERATOR condition)
    const left = this.parseExpression();
    if (!left.success || !left.result) {
      return left;
    }

    const operatorToken = this.expect('KEYWORD');
    if (!operatorToken || !['and', 'or'].includes(operatorToken.value as LogicalOperator)) {
      return left; // Just return the left side
    }

    const right = this.parseExpression();
    if (!right.success || !right.result) {
      return { success: false, error: 'Expected right side of compound condition' };
    }

    return {
      success: true,
      result: {
        type: 'compound',
        compound: {
          operator: operatorToken.value as LogicalOperator,
          operands: [left.result, right.result],
        },
      },
    };
  }

  private parseExpression(): ParseResult<ConditionExpression> {
    const token = this.peek();

    // Handle NOT
    if (token.type === 'KEYWORD' && token.value === 'not') {
      this.advance();
      const inner = this.parseExpression();
      if (!inner.success || !inner.result) {
        return inner;
      }
      return {
        success: true,
        result: {
          type: 'compound',
          compound: {
            operator: 'not',
            operands: [inner.result],
          },
        },
      };
    }

    // Handle parentheses
    if (token.type === 'LPAREN') {
      this.advance();
      const result = this.parseCompound();
      this.expect('RPAREN');
      return result;
    }

    // Element condition
    if (token.type === 'ELEMENT') {
      return this.parseElementCondition();
    }

    // Text condition
    if (token.type === 'TEXT') {
      return this.parseTextCondition();
    }

    // State condition
    if (token.type === 'STATE') {
      return this.parseStateCondition();
    }

    // Variable condition (starts with variable name)
    if (token.type === 'VARIABLE') {
      return this.parseVariableCondition();
    }

    return { success: false, error: `Unexpected token: ${token.type}` };
  }

  public parse(): ParseResult<ConditionExpression> {
    const result = this.parseExpression();

    if (this.expect('EOF')) {
      return result;
    }

    return { success: false, error: 'Unexpected tokens at end of expression' };
  }
}

/**
 * 解析条件表达式
 */
export function parseConditionExpression(input: string): ParseResult<ConditionExpression> {
  try {
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    if (tokens.length === 0) {
      return { success: false, error: 'Empty expression' };
    }

    const parser = new Parser(tokens);
    return parser.parse();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 简化解析 - 从自然语言描述推断条件类型
 */
export function parseNaturalLanguageCondition(text: string): ParseResult<ConditionExpression> {
  const lowerText = text.toLowerCase().trim();

  // Element conditions
  if (lowerText.includes('element') || lowerText.includes('元素')) {
    const match = text.match(/element\s+"([^"]+)"/) || text.match(/元素\s+"([^"]+)"/);
    if (match) {
      let check: ElementCheck = 'visible';
      if (lowerText.includes('exists') || lowerText.includes('存在')) check = 'exists';
      if (lowerText.includes('visible') || lowerText.includes('可见')) check = 'visible';
      if (lowerText.includes('enabled') || lowerText.includes('可用')) check = 'enabled';
      if (lowerText.includes('selected') || lowerText.includes('选中')) check = 'selected';

      return {
        success: true,
        result: {
          type: 'element',
          element: { target: match[1], check },
        },
      };
    }
  }

  // Text conditions
  if (lowerText.includes('text') || lowerText.includes('文本')) {
    const match = text.match(/text\s+"([^"]+)"/) || text.match(/文本\s+"([^"]+)"/);
    if (match) {
      let operator: TextOperator = 'contains';
      if (lowerText.includes('equals') || lowerText.includes('等于')) operator = 'equals';
      if (lowerText.includes('contains') || lowerText.includes('包含')) operator = 'contains';
      if (lowerText.includes('matches') || lowerText.includes('匹配')) operator = 'matches';

      const valueMatch = text.match(/"(?:[^"]+)"\s+(?:contains|equals|matches)\s+"([^"]+)"/);
      const value = valueMatch ? valueMatch[1] : '';

      return {
        success: true,
        result: {
          type: 'text',
          text: { target: match[1], operator, value },
        },
      };
    }
  }

  // State conditions
  if (lowerText.includes('state') || lowerText.includes('状态')) {
    const stateMap: Record<string, PageState> = {
      logged_in: 'logged_in',
      已登录: 'logged_in',
      loading: 'loading',
      加载中: 'loading',
      error: 'error',
      错误: 'error',
      empty: 'empty',
      空: 'empty',
    };

    for (const [key, state] of Object.entries(stateMap)) {
      if (lowerText.includes(key)) {
        return {
          success: true,
          result: {
            type: 'state',
            state: { type: state },
          },
        };
      }
    }
  }

  // Variable conditions
  const varMatch = text.match(/^(\w+)\s*(==|!=|>=?|<=?)\s*(.+)$/);
  if (varMatch) {
    const value = isNaN(Number(varMatch[3])) ? varMatch[3] : Number(varMatch[3]);
    return {
      success: true,
      result: {
        type: 'variable',
        variable: {
          name: varMatch[1],
          operator: varMatch[2] as ComparisonOperator,
          value,
        },
      },
    };
  }

  // Default: treat as element existence check
  return {
    success: true,
    result: {
      type: 'element',
      element: { target: text, check: 'exists' },
    },
  };
}

/**
 * 格式化条件表达式为字符串
 */
export function formatConditionExpression(expr: ConditionExpression): string {
  switch (expr.type) {
    case 'element':
      return `element "${expr.element!.target}" is ${expr.element!.check}`;

    case 'text':
      return `text "${expr.text!.target}" ${expr.text!.operator} "${expr.text!.value}"`;

    case 'state':
      return `state is ${expr.state!.type}`;

    case 'variable':
      return `${expr.variable!.name} ${expr.variable!.operator} ${JSON.stringify(expr.variable!.value)}`;

    case 'compound':
      if (expr.compound!.operator === 'not') {
        return `NOT ${formatConditionExpression(expr.compound!.operands[0])}`;
      }
      const parts = expr.compound!.operands.map(formatConditionExpression);
      return `(${parts.join(` ${expr.compound!.operator.toUpperCase()} `)})`;

    default:
      return '';
  }
}
