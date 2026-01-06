/**
 * Action Executor for Debug Assistant
 * Executes debug actions on the page using Midscene agent
 */

import type {
  ActionResult,
  DebugAction,
  DebugActionType,
} from '../../types/debugAssistant';

export interface ActionExecutorCallbacks {
  onBeforeExecute?: (action: DebugAction) => void;
  onAfterExecute?: (action: DebugAction, result: ActionResult) => void;
  onExecutionError?: (action: DebugAction, error: Error) => void;
}

export interface ActionExecutorOptions {
  getAgent: () => any;
  defaultTimeout?: number;
  defaultWaitTime?: number;
}

/**
 * Action Executor - executes debug actions on the page
 */
export class ActionExecutor {
  private getAgent: () => any;
  private defaultTimeout: number;
  private defaultWaitTime: number;
  private callbacks: ActionExecutorCallbacks = {};

  // Service references
  private pageActions: any;
  private highlightAction: any;
  private compareAction: any;

  constructor(options: ActionExecutorOptions) {
    this.getAgent = options.getAgent;
    this.defaultTimeout = options.defaultTimeout ?? 10000;
    this.defaultWaitTime = options.defaultWaitTime ?? 1000;
  }

  /**
   * Execute a single debug action
   */
  async execute(action: DebugAction): Promise<ActionResult> {
    const startTime = Date.now();
    this.notifyBeforeExecute(action);

    try {
      let result: ActionResult;

      switch (action.type) {
        case 'click':
          result = await this.executeClick(action);
          break;

        case 'input':
          result = await this.executeInput(action);
          break;

        case 'scroll':
          result = await this.executeScroll(action);
          break;

        case 'refresh':
          result = await this.executeRefresh(action);
          break;

        case 'highlight':
          result = await this.executeHighlight(action);
          break;

        case 'screenshot':
          result = await this.executeScreenshot(action);
          break;

        case 'wait':
          result = await this.executeWait(action);
          break;

        case 'compare':
          result = await this.executeCompare(action);
          break;

        case 'describe':
          result = await this.executeDescribe(action);
          break;

        case 'locate':
          result = await this.executeLocate(action);
          break;

        default:
          result = {
            success: false,
            message: `不支持的操作类型: ${(action as { type: string }).type}`,
          };
      }

      result.duration = Date.now() - startTime;
      this.notifyAfterExecute(action, result);
      return result;
    } catch (error) {
      const errorResult: ActionResult = {
        success: false,
        message: '操作执行失败',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };

      this.notifyExecutionError(action, error as Error);
      return errorResult;
    }
  }

  /**
   * Execute multiple actions in sequence
   */
  async executeMultiple(actions: DebugAction[]): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of actions) {
      const result = await this.execute(action);
      results.push(result);

      // Stop if a critical action fails
      if (!result.success && this.isCriticalAction(action)) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute click action
   */
  private async executeClick(action: DebugAction): Promise<ActionResult> {
    const agent = this.getAgent();

    if (!agent) {
      return { success: false, message: '无法获取 agent 实例' };
    }

    const target = action.target || '指定位置';

    if (typeof agent.aiAct === 'function') {
      await agent.aiAct(`点击${target}`);
      return {
        success: true,
        message: `已点击: ${target}`,
      };
    }

    if (agent.page) {
      // Try to locate using Midscene's locate function
      const elements = await this.locateElement(target);
      if (elements && elements.length > 0) {
        const el = elements[action.options?.index || 0];
        if (el?.center) {
          await agent.page.mouse.click(el.center[0], el.center[1]);
          return {
            success: true,
            message: `已点击: ${target}`,
            data: { element: el },
          };
        }
      }
    }

    return {
      success: false,
      message: `无法找到元素: ${target}`,
    };
  }

  /**
   * Execute input action
   */
  private async executeInput(action: DebugAction): Promise<ActionResult> {
    const agent = this.getAgent();

    if (!agent) {
      return { success: false, message: '无法获取 agent 实例' };
    }

    const target = action.target || '输入框';
    const value = action.value?.toString() || '';

    if (typeof agent.aiAct === 'function') {
      await agent.aiAct(`在${target}输入${value}`);
      return {
        success: true,
        message: `已输入: ${value}`,
      };
    }

    // Fallback: click then type
    if (agent.page) {
      const elements = await this.locateElement(target);
      if (elements && elements.length > 0) {
        const el = elements[action.options?.index || 0];
        if (el?.center) {
          // Click input field first
          await agent.page.mouse.click(el.center[0], el.center[1]);
          // Then type the value
          await agent.page.keyboard.type(value);
          return {
            success: true,
            message: `已在${target}输入: ${value}`,
            data: { element: el, value },
          };
        }
      }
    }

    return {
      success: false,
      message: `无法找到输入框: ${target}`,
    };
  }

  /**
   * Execute scroll action
   */
  private async executeScroll(action: DebugAction): Promise<ActionResult> {
    const agent = this.getAgent();

    if (!agent?.page) {
      return { success: false, message: '无法获取页面实例' };
    }

    const direction = action.options?.scrollDirection || 'down';
    const amount = action.options?.scrollAmount || 500;

    switch (direction) {
      case 'up':
        await agent.page.evaluate(() => window.scrollBy(0, -500));
        break;
      case 'down':
        await agent.page.evaluate(() => window.scrollBy(0, 500));
        break;
      case 'left':
        await agent.page.evaluate(() => window.scrollBy(-500, 0));
        break;
      case 'right':
        await agent.page.evaluate(() => window.scrollBy(500, 0));
        break;
    }

    return {
      success: true,
      message: `已向${direction === 'up' ? '上' : direction === 'down' ? '下' : direction === 'left' ? '左' : '右'}滚动`,
    };
  }

  /**
   * Execute refresh action
   */
  private async executeRefresh(_action: DebugAction): Promise<ActionResult> {
    const agent = this.getAgent();

    if (!agent?.page) {
      return { success: false, message: '无法获取页面实例' };
    }

    await agent.page.reload({ waitUntil: 'networkidle' });
    return {
      success: true,
      message: '页面已刷新',
    };
  }

  /**
   * Execute highlight action
   */
  private async executeHighlight(action: DebugAction): Promise<ActionResult> {
    if (this.highlightAction) {
      return this.highlightAction.highlight(action.target || '');
    }

    // Fallback implementation
    const agent = this.getAgent();
    if (!agent?.page) {
      return { success: false, message: '无法获取页面实例' };
    }

    const target = action.target || '元素';
    const elements = await this.locateElement(target);

    if (!elements || elements.length === 0) {
      return { success: false, message: `无法找到元素: ${target}` };
    }

    // Add highlight overlays to page
    const highlights = await agent.page.evaluate((elementsToHighlight) => {
      const results: Array<{ id: string; rect: any }> = [];

      for (const el of elementsToHighlight) {
        const div = document.createElement('div');
        div.style.cssText = `
          position: fixed;
          left: ${el.rect.left}px;
          top: ${el.rect.top}px;
          width: ${el.rect.width}px;
          height: ${el.rect.height}px;
          border: 3px solid #ff6b6b;
          background: rgba(255, 107, 107, 0.2);
          pointer-events: none;
          z-index: 999999;
        `;
        div.id = `debug-highlight-${Date.now()}-${Math.random()}`;
        document.body.appendChild(div);

        results.push({ id: div.id, rect: el.rect });
      }

      return results;
    }, elements);

    return {
      success: true,
      message: `已高亮 ${highlights.length} 个元素`,
      data: { highlights },
    };
  }

  /**
   * Execute screenshot action
   */
  private async executeScreenshot(_action: DebugAction): Promise<ActionResult> {
    const agent = this.getAgent();

    if (!agent?.page) {
      return { success: false, message: '无法获取页面实例' };
    }

    const screenshot = await agent.page.screenshot({
      type: 'png',
      encoding: 'base64',
    });

    return {
      success: true,
      message: '已截取当前页面',
      data: { screenshot },
      screenshot,
    };
  }

  /**
   * Execute wait action
   */
  private async executeWait(action: DebugAction): Promise<ActionResult> {
    const duration =
      action.options?.timeout ||
      action.value?.toString() ||
      this.defaultWaitTime;

    // Parse duration
    let ms = this.defaultWaitTime;
    if (typeof duration === 'number') {
      ms = duration;
    } else if (typeof duration === 'string') {
      const match = duration.match(/(\d+)\s*(ms|s)?/i);
      if (match) {
        const amount = Number.parseInt(match[1], 10);
        const unit = match[2]?.toLowerCase();
        ms = unit === 's' ? amount * 1000 : amount;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, ms));

    return {
      success: true,
      message: `已等待 ${ms}ms`,
    };
  }

  /**
   * Execute compare action (screenshot comparison)
   */
  private async executeCompare(action: DebugAction): Promise<ActionResult> {
    if (this.compareAction) {
      return this.compareAction.compare(action.value);
    }

    // Basic comparison
    const agent = this.getAgent();
    if (!agent?.page) {
      return { success: false, message: '无法获取页面实例' };
    }

    const previousScreenshot = action.value?.previousScreenshot;
    if (!previousScreenshot) {
      return {
        success: false,
        message: '缺少之前的截图用于对比',
      };
    }

    const currentScreenshot = await agent.page.screenshot({
      type: 'png',
      encoding: 'base64',
    });

    // Simple comparison: just return both
    return {
      success: true,
      message: '已获取当前截图（可进行视觉对比）',
      data: {
        previous: previousScreenshot,
        current: currentScreenshot,
      },
      screenshot: currentScreenshot,
    };
  }

  /**
   * Execute describe action
   */
  private async executeDescribe(action: DebugAction): Promise<ActionResult> {
    const agent = this.getAgent();
    const target = action.target || '页面';

    if (!agent?.page) {
      return { success: false, message: '无法获取页面实例' };
    }

    if (typeof agent.aiQuery === 'function') {
      const result = await agent.aiQuery(`请描述${target}的特征`);
      return {
        success: true,
        message: result?.text || result?.content || '描述完成',
        data: { description: result },
      };
    }

    // Fallback: use element info
    if (target !== '页面') {
      const elements = await this.locateElement(target);
      if (elements && elements.length > 0) {
        const el = elements[0];
        return {
          success: true,
          message: `找到 ${elements.length} 个${target}`,
          data: { elements },
        };
      }
    }

    return {
      success: true,
      message: `当前页面: ${agent.page.url()}`,
      data: { url: agent.page.url() },
    };
  }

  /**
   * Execute locate action
   */
  private async executeLocate(action: DebugAction): Promise<ActionResult> {
    const target = action.target || '元素';
    const agent = this.getAgent();

    if (!agent?.page) {
      return { success: false, message: '无法获取页面实例' };
    }

    const elements = await this.locateElement(target);

    if (!elements || elements.length === 0) {
      return {
        success: false,
        message: `无法找到: ${target}`,
        data: { count: 0 },
      };
    }

    return {
      success: true,
      message: `找到 ${elements.length} 个匹配的${target}`,
      data: { elements, count: elements.length },
    };
  }

  /**
   * Locate elements on the page using Midscene
   */
  private async locateElement(description: string): Promise<any[] | null> {
    const agent = this.getAgent();

    if (!agent) return null;

    try {
      if (typeof agent.aiLocate === 'function') {
        return await agent.aiLocate(description);
      }

      if (typeof agent.aiQuery === 'function') {
        const result = await agent.aiQuery(`请找到${description}元素的位置`);
        return result?.elements || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if an action is critical (should stop execution on failure)
   */
  private isCriticalAction(action: DebugAction): boolean {
    const criticalTypes: DebugActionType[] = ['click', 'input'];
    return criticalTypes.includes(action.type);
  }

  /**
   * Set page actions service
   */
  setPageActions(pageActions: any): void {
    this.pageActions = pageActions;
  }

  /**
   * Set highlight action service
   */
  setHighlightAction(highlightAction: any): void {
    this.highlightAction = highlightAction;
  }

  /**
   * Set compare action service
   */
  setCompareAction(compareAction: any): void {
    this.compareAction = compareAction;
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: ActionExecutorCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Notification methods

  private notifyBeforeExecute(action: DebugAction): void {
    this.callbacks.onBeforeExecute?.(action);
  }

  private notifyAfterExecute(action: DebugAction, result: ActionResult): void {
    this.callbacks.onAfterExecute?.(action, result);
  }

  private notifyExecutionError(action: DebugAction, error: Error): void {
    this.callbacks.onExecutionError?.(action, error);
  }
}

// Export singleton getter
let executorInstance: ActionExecutor | null = null;

export function getActionExecutor(
  options: ActionExecutorOptions,
): ActionExecutor {
  if (!executorInstance) {
    executorInstance = new ActionExecutor(options);
  }
  return executorInstance;
}

export function resetActionExecutor(): void {
  executorInstance = null;
}
