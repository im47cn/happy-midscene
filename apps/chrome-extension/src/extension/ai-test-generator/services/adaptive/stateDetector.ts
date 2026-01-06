/**
 * State Detector
 * 状态检测器 - 检测页面状态 (logged_in, loading, error, empty, custom)
 */

import type { EvaluateOptions, PageState } from '../../types/adaptive';

/**
 * AI Agent 接口 (Midscene)
 */
interface AIAgent {
  aiLocate?(prompt: string, options?: { deepThink?: boolean }): Promise<any>;
  describeElementAtPoint?(
    center: { x: number; y: number },
    options?: any,
  ): Promise<any>;
  dump?: { executions?: any[] };
}

/**
 * 状态检测器选项
 */
export interface StateDetectorOptions {
  agent?: AIAgent;
  timeout?: number;
  debug?: boolean;
}

/**
 * 状态检测结果
 */
export interface StateDetectionResult {
  detected: boolean;
  confidence: number;
  description: string;
  details?: Record<string, any>;
}

/**
 * 页面状态检测器
 */
export class StateDetector {
  private agent: AIAgent | null = null;
  private timeout: number;
  private debug: boolean;

  constructor(options: StateDetectorOptions = {}) {
    this.agent = options.agent || null;
    this.timeout = options.timeout || 5000;
    this.debug = options.debug || false;
  }

  /**
   * 设置 AI Agent
   */
  setAgent(agent: AIAgent): void {
    this.agent = agent;
  }

  /**
   * 检测页面状态
   */
  async detect(
    state: PageState,
    options: EvaluateOptions = {},
  ): Promise<boolean> {
    const result = await detectWithDetails(state, this.agent, {
      timeout: options.timeout ?? this.timeout,
      debug: this.debug,
    });
    return result.detected;
  }

  /**
   * 检测状态并返回详细信息
   */
  async detectWithDetails(
    state: PageState,
    options: EvaluateOptions = {},
  ): Promise<StateDetectionResult> {
    return detectWithDetails(state, this.agent, {
      timeout: options.timeout ?? this.timeout,
      debug: this.debug,
    });
  }

  /**
   * 检测所有状态
   */
  async detectAll(
    states: PageState[],
    options: EvaluateOptions = {},
  ): Promise<Map<PageState, StateDetectionResult>> {
    const results = new Map<PageState, StateDetectionResult>();

    await Promise.all(
      states.map(async (state) => {
        const result = await this.detectWithDetails(state, options);
        results.set(state, result);
      }),
    );

    return results;
  }

  /**
   * 获取当前页面状态
   */
  async getCurrentPageState(options: EvaluateOptions = {}): Promise<{
    state: PageState;
    confidence: number;
    description: string;
  } | null> {
    const states: PageState[] = ['logged_in', 'loading', 'error', 'empty'];

    for (const state of states) {
      const result = await this.detectWithDetails(state, options);
      if (result.detected && result.confidence > 0.7) {
        return {
          state,
          confidence: result.confidence,
          description: result.description,
        };
      }
    }

    return null;
  }
}

/**
 * 状态检测规则
 */
const STATE_DETECTION_RULES: Record<
  PageState,
  {
    selectors: string[];
    textPatterns: RegExp[];
    aiPrompts: string[];
    fallbackCheck?: () => boolean;
  }
> = {
  logged_in: {
    selectors: [
      '[data-testid="user-menu"]',
      '.user-avatar',
      '.user-profile',
      '.logout-button',
      '.user-info',
    ],
    textPatterns: [
      /logout|sign out|登出|退出/i,
      /my account|我的账户|个人中心/i,
      /welcome,?|欢迎,?/i,
    ],
    aiPrompts: [
      'Is there a user menu, avatar, or profile indicator visible?',
      'Is the user logged in (look for logout button, user menu, or profile)?',
    ],
  },

  loading: {
    selectors: [
      '[data-testid="loading"]',
      '.loading',
      '.spinner',
      '.loader',
      '.skeleton',
      '[role="progressbar"]',
    ],
    textPatterns: [/loading|加载中|请稍候|wait/i],
    aiPrompts: [
      'Is there a loading spinner, progress bar, or skeleton loader visible?',
      'Is the page currently loading content?',
    ],
  },

  error: {
    selectors: [
      '[data-testid="error"]',
      '.error',
      '.error-message',
      '.alert-error',
      '[role="alert"]',
    ],
    textPatterns: [
      /error|错误|失败|failed|unable/i,
      /something went wrong|出错了/i,
      /not found|未找到|404|500/i,
    ],
    aiPrompts: [
      'Is there an error message or error indicator visible?',
      'Did the last operation fail (look for error messages, alerts, red indicators)?',
    ],
  },

  empty: {
    selectors: [
      '[data-testid="empty"]',
      '.empty-state',
      '.no-results',
      '.no-data',
      '.placeholder',
    ],
    textPatterns: [
      /no results|没有结果|暂无数据/i,
      /empty|空白|nothing to show/i,
      /no items found|未找到项目/i,
    ],
    aiPrompts: [
      'Is there an empty state or "no results" message visible?',
      'Is the content area empty (look for empty state illustrations, no results messages)?',
    ],
  },

  custom: {
    selectors: [],
    textPatterns: [],
    aiPrompts: ['Describe the current state of the page'],
  },
};

/**
 * 使用详细信息检测状态
 */
async function detectWithDetails(
  state: PageState,
  agent: AIAgent | null,
  options: { timeout: number; debug?: boolean },
): Promise<StateDetectionResult> {
  const startTime = performance.now();
  const rules = STATE_DETECTION_RULES[state];

  // Try DOM-based detection first
  const domResult = await detectViaDOM(state, agent, options);
  if (domResult.detected) {
    return domResult;
  }

  // Try text-based detection
  const textResult = await detectViaText(state, agent, options);
  if (textResult.detected) {
    return textResult;
  }

  // Try AI-based detection as fallback
  if (agent?.aiLocate && rules.aiPrompts.length > 0) {
    try {
      const aiResult = await detectViaAI(state, agent, options);
      if (aiResult.detected) {
        return aiResult;
      }
    } catch (error) {
      if (options.debug) {
        console.warn('[StateDetector] AI detection failed:', error);
      }
    }
  }

  // No state detected
  return {
    detected: false,
    confidence: 0,
    description: `State "${state}" not detected`,
  };
}

/**
 * 基于 DOM 检测状态
 */
async function detectViaDOM(
  state: PageState,
  agent: AIAgent | null,
  options: { timeout: number },
): Promise<StateDetectionResult> {
  const rules = STATE_DETECTION_RULES[state];

  // Try AI-based element detection
  if (agent?.aiLocate && rules.selectors.length > 0) {
    for (const selector of rules.selectors) {
      try {
        const result = await Promise.race([
          agent.aiLocate!(selector, { deepThink: false }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), options.timeout / 2),
          ),
        ]);

        if (result?.element) {
          return {
            detected: true,
            confidence: 0.9,
            description: `Found element matching selector: ${selector}`,
            details: { selector, element: result.element },
          };
        }
      } catch {
        // Continue to next selector
      }
    }
  }

  return {
    detected: false,
    confidence: 0,
    description: 'No matching DOM elements found',
  };
}

/**
 * 基于文本检测状态
 */
async function detectViaText(
  state: PageState,
  agent: AIAgent | null,
  options: { timeout: number },
): Promise<StateDetectionResult> {
  const rules = STATE_DETECTION_RULES[state];

  // Use AI to find text patterns
  if (agent?.aiLocate && rules.textPatterns.length > 0) {
    for (const pattern of rules.textPatterns) {
      try {
        // Use pattern as search prompt
        const prompt = pattern.source.replace(/\\/g, '');
        const result = await Promise.race([
          agent.aiLocate!(prompt, { deepThink: false }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), options.timeout / 2),
          ),
        ]);

        if (result?.element?.text && pattern.test(result.element.text)) {
          return {
            detected: true,
            confidence: 0.8,
            description: `Found text matching pattern: ${pattern.source}`,
            details: { pattern: pattern.source, text: result.element.text },
          };
        }
      } catch {
        // Continue to next pattern
      }
    }
  }

  return {
    detected: false,
    confidence: 0,
    description: 'No matching text patterns found',
  };
}

/**
 * 基于 AI 检测状态
 */
async function detectViaAI(
  state: PageState,
  agent: AIAgent,
  options: { timeout: number },
): Promise<StateDetectionResult> {
  const rules = STATE_DETECTION_RULES[state];

  for (const prompt of rules.aiPrompts) {
    try {
      const result = await Promise.race([
        agent.aiLocate!(prompt, { deepThink: true }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), options.timeout),
        ),
      ]);

      if (result?.element) {
        return {
          detected: true,
          confidence: 0.7,
          description: `AI detected state: ${state}`,
          details: { prompt, element: result.element },
        };
      }
    } catch {
      // Continue to next prompt
    }
  }

  return {
    detected: false,
    confidence: 0,
    description: 'AI detection did not find evidence of this state',
  };
}

/**
 * 默认状态检测器实例
 */
let defaultDetector: StateDetector | null = null;

/**
 * 获取默认状态检测器
 */
export function getStateDetector(agent?: AIAgent): StateDetector {
  if (!defaultDetector) {
    defaultDetector = new StateDetector();
  }
  if (agent) {
    defaultDetector.setAgent(agent);
  }
  return defaultDetector;
}

/**
 * 快捷检测函数
 */
export async function detectPageState(
  state: PageState,
  agent?: AIAgent,
): Promise<boolean> {
  const detector = getStateDetector(agent);
  return detector.detect(state);
}

/**
 * 获取当前页面状态快捷函数
 */
export async function getCurrentPageState(
  agent?: AIAgent,
): Promise<PageState | null> {
  const detector = getStateDetector(agent);
  const result = await detector.getCurrentPageState();
  return result?.state || null;
}
