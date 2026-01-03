/**
 * Execution Engine for AI Test Generator
 * Orchestrates Midscene.js to execute test steps on the host page
 */

import type { ExecutionRecord, StepRecord } from '../types/analytics';
import type { HealingResult, SelfHealingConfig } from '../types/healing';
import { DEFAULT_SELF_HEALING_CONFIG } from '../types/healing';
import type { MaskingConfig } from '../types/masking';
import { DEFAULT_MASKING_CONFIG } from '../types/masking';
import { alertManager, dataCollector } from './analytics';
import { healingEngine } from './healing';
import type { TaskStep, TestCase } from './markdownParser';
import {
  detectScreenshotMaskRegions,
  imageMasker,
  logMasker,
  maskerEngine,
} from './masking';

export interface DeviceEmulationConfig {
  deviceId: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  userAgent: string;
  isMobile: boolean;
  hasTouch: boolean;
}

export interface ExecutionContext {
  url: string;
  viewportWidth?: number;
  viewportHeight?: number;
  deviceEmulation?: DeviceEmulationConfig;
}

export interface ExecutionError {
  message: string;
  type:
    | 'element_not_found'
    | 'timeout'
    | 'action_failed'
    | 'navigation_failed'
    | 'assertion_failed'
    | 'unknown';
  details?: string;
  suggestion?: string;
  elementInfo?: {
    selector?: string;
    description?: string;
    candidates?: string[];
  };
}

export interface ExecutionResult {
  stepId: string;
  success: boolean;
  generatedAction?: string;
  screenshot?: string;
  error?: string;
  errorDetails?: ExecutionError;
  duration: number;
  // Self-healing info
  healingResult?: HealingResult;
  healedByAI?: boolean;
}

export interface ExecutionCallbacks {
  onStepStart?: (step: TaskStep, index: number) => void;
  onStepComplete?: (step: TaskStep, result: ExecutionResult) => void;
  onStepFailed?: (
    step: TaskStep,
    error: string,
    errorDetails?: ExecutionError,
  ) => void;
  onHighlight?: (element: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  onProgress?: (current: number, total: number) => void;
  // Self-healing callbacks
  onHealingAttempt?: (step: TaskStep, healingResult: HealingResult) => void;
  onHealingConfirmRequest?: (
    step: TaskStep,
    healingResult: HealingResult,
  ) => Promise<boolean>;
}

export type ExecutionStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

/**
 * Convert natural language step to Midscene action
 * Maps common Chinese/English phrases to action types
 */
function inferActionType(
  text: string,
): 'click' | 'type' | 'scroll' | 'wait' | 'assert' | 'navigate' | 'ai' {
  const lowerText = text.toLowerCase();

  // Navigation
  if (/^(打开|访问|跳转|go to|navigate|open|visit)\s/i.test(text)) {
    return 'navigate';
  }

  // Click actions
  if (/点击|单击|按下|click|tap|press|选择|select/i.test(text)) {
    return 'click';
  }

  // Type/Input actions
  if (/输入|填写|键入|type|input|enter|fill/i.test(text)) {
    return 'type';
  }

  // Scroll actions
  if (/滚动|滑动|scroll|swipe/i.test(text)) {
    return 'scroll';
  }

  // Wait actions
  if (/等待|wait|sleep|delay/i.test(text)) {
    return 'wait';
  }

  // Assert/Verify actions
  if (/验证|确认|检查|断言|verify|assert|check|should|expect/i.test(text)) {
    return 'assert';
  }

  // Default to AI action for complex descriptions
  return 'ai';
}

/**
 * Generate YAML action from step
 */
function generateYamlAction(step: TaskStep): string {
  const actionType = inferActionType(step.originalText);

  switch (actionType) {
    case 'navigate':
      // Extract URL if present
      const urlMatch = step.originalText.match(/https?:\/\/[^\s"']+/);
      if (urlMatch) {
        return `- goto: "${urlMatch[0]}"`;
      }
      return `- ai: "${step.originalText}"`;

    case 'wait':
      // Extract duration if present
      const durationMatch = step.originalText.match(
        /(\d+)\s*(秒|毫秒|ms|s|second)/i,
      );
      if (durationMatch) {
        const value = Number.parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        const ms =
          unit === '秒' || unit === 's' || unit === 'second'
            ? value * 1000
            : value;
        return `- sleep: ${ms}`;
      }
      return `- aiWaitFor: "${step.originalText}"`;

    case 'assert':
      return `- aiAssert: "${step.originalText}"`;

    default:
      // Use ai action for most cases - let Midscene handle the complexity
      return `- ai: "${step.originalText}"`;
  }
}

/**
 * Parse error to extract detailed information
 */
function parseErrorDetails(error: unknown, stepText: string): ExecutionError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Element not found
  if (
    lowerMessage.includes('element not found') ||
    lowerMessage.includes('cannot find') ||
    lowerMessage.includes('no element') ||
    lowerMessage.includes('unable to locate') ||
    lowerMessage.includes('找不到') ||
    lowerMessage.includes('未找到')
  ) {
    return {
      message,
      type: 'element_not_found',
      details: '无法在页面上找到匹配的元素',
      suggestion:
        '请尝试：1. 使用更具体的描述 2. 检查元素是否可见 3. 等待页面完全加载',
      elementInfo: {
        description: stepText,
      },
    };
  }

  // Timeout
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('超时')
  ) {
    return {
      message,
      type: 'timeout',
      details: '操作执行超时',
      suggestion:
        '请检查：1. 网络连接是否正常 2. 页面是否正在加载 3. 目标元素是否需要更长时间才能出现',
    };
  }

  // Navigation failed
  if (
    lowerMessage.includes('navigation') ||
    lowerMessage.includes('navigate') ||
    lowerMessage.includes('goto') ||
    lowerMessage.includes('跳转')
  ) {
    return {
      message,
      type: 'navigation_failed',
      details: '页面导航失败',
      suggestion:
        '请检查：1. URL 是否正确 2. 网络连接是否正常 3. 页面是否需要身份验证',
    };
  }

  // Assertion failed
  if (
    lowerMessage.includes('assert') ||
    lowerMessage.includes('expect') ||
    lowerMessage.includes('verify') ||
    lowerMessage.includes('验证失败') ||
    lowerMessage.includes('断言')
  ) {
    return {
      message,
      type: 'assertion_failed',
      details: '页面状态验证失败',
      suggestion:
        '请检查：1. 验证条件是否正确 2. 页面内容是否符合预期 3. 是否需要等待某些元素加载',
    };
  }

  // Action failed
  if (
    lowerMessage.includes('click') ||
    lowerMessage.includes('type') ||
    lowerMessage.includes('input') ||
    lowerMessage.includes('scroll') ||
    lowerMessage.includes('点击') ||
    lowerMessage.includes('输入')
  ) {
    return {
      message,
      type: 'action_failed',
      details: '操作执行失败',
      suggestion:
        '请检查：1. 元素是否可点击/可交互 2. 是否被其他元素遮挡 3. 页面是否完全加载',
    };
  }

  // Unknown error
  return {
    message,
    type: 'unknown',
    details: '发生未知错误',
    suggestion:
      '请尝试：1. 刷新页面 2. 修改操作描述 3. 检查控制台日志获取更多信息',
  };
}

export class ExecutionEngine {
  private status: ExecutionStatus = 'idle';
  private currentStepIndex = 0;
  private executionResults: ExecutionResult[] = [];
  private agent: any = null;
  private callbacks: ExecutionCallbacks = {};
  private isPaused = false;
  private resumeResolve: (() => void) | null = null;
  private selfHealingConfig: SelfHealingConfig;
  private maskingConfig: MaskingConfig;
  private isLogMaskingActive = false;

  constructor(
    private getAgent: (forceSameTabNavigation?: boolean) => any,
    selfHealingConfig?: Partial<SelfHealingConfig>,
    maskingConfig?: Partial<MaskingConfig>,
  ) {
    this.selfHealingConfig = {
      ...DEFAULT_SELF_HEALING_CONFIG,
      ...selfHealingConfig,
    };
    this.maskingConfig = { ...DEFAULT_MASKING_CONFIG, ...maskingConfig };

    // Apply masking config to masker engine
    if (maskingConfig) {
      maskerEngine.setConfig(maskingConfig);
    }
  }

  /**
   * Update self-healing configuration
   */
  setSelfHealingConfig(config: Partial<SelfHealingConfig>): void {
    this.selfHealingConfig = { ...this.selfHealingConfig, ...config };
    healingEngine.updateConfig(config);
  }

  /**
   * Get self-healing configuration
   */
  getSelfHealingConfig(): SelfHealingConfig {
    return { ...this.selfHealingConfig };
  }

  /**
   * Update masking configuration
   */
  setMaskingConfig(config: Partial<MaskingConfig>): void {
    this.maskingConfig = { ...this.maskingConfig, ...config };
    maskerEngine.setConfig(config);
  }

  /**
   * Get masking configuration
   */
  getMaskingConfig(): MaskingConfig {
    return { ...this.maskingConfig };
  }

  /**
   * Mask sensitive data in text (for YAML generation)
   */
  private async maskSensitiveData(text: string): Promise<string> {
    if (!this.maskingConfig.enabled || !this.maskingConfig.yamlMasking) {
      return text;
    }

    try {
      const result = await maskerEngine.maskText(text, 'yaml');
      return result.masked;
    } catch (error) {
      console.warn('Failed to mask sensitive data:', error);
      return text;
    }
  }

  /**
   * Check if YAML contains sensitive data and warn
   */
  async checkYamlForSensitiveData(yaml: string): Promise<{
    hasSensitiveData: boolean;
    warnings: string[];
    maskedYaml: string;
  }> {
    if (!this.maskingConfig.enabled) {
      return { hasSensitiveData: false, warnings: [], maskedYaml: yaml };
    }

    const result = await maskerEngine.maskText(yaml, 'yaml');

    if (result.matches.length === 0) {
      return { hasSensitiveData: false, warnings: [], maskedYaml: yaml };
    }

    const warnings = result.matches.map(
      (match) =>
        `发现敏感数据 [${match.ruleName}]: "${match.originalValue.substring(0, 10)}..." 建议使用环境变量替代`,
    );

    return {
      hasSensitiveData: true,
      warnings,
      maskedYaml: result.masked,
    };
  }

  /**
   * Take a screenshot with optional masking of sensitive regions
   * @param maskSensitive - Whether to mask sensitive regions
   * @returns Base64 encoded screenshot string
   */
  async takeScreenshot(maskSensitive = true): Promise<string | undefined> {
    if (!this.agent?.page) {
      return undefined;
    }

    try {
      // Take screenshot as base64
      const screenshot = await this.agent.page.screenshot({
        type: 'png',
        encoding: 'base64',
      });

      if (!screenshot) {
        return undefined;
      }

      // If masking is disabled or screenshot masking is off, return original
      if (
        !maskSensitive ||
        !this.maskingConfig.enabled ||
        this.maskingConfig.screenshotMasking === 'off'
      ) {
        return screenshot;
      }

      // Detect and mask sensitive regions
      const maskedResult = await this.maskScreenshotData(
        screenshot,
        this.maskingConfig.screenshotMasking,
      );

      return maskedResult;
    } catch (error) {
      console.warn('Failed to take screenshot:', error);
      return undefined;
    }
  }

  /**
   * Mask sensitive regions in a screenshot
   * @param base64Screenshot - Base64 encoded screenshot
   * @param level - Masking level
   * @returns Base64 encoded masked screenshot
   */
  private async maskScreenshotData(
    base64Screenshot: string,
    level: 'standard' | 'strict',
  ): Promise<string> {
    try {
      // Detect sensitive regions from DOM if possible
      let sensitiveRegions: import('../types/masking').MaskRegion[] = [];

      // Try to detect regions from the page DOM
      if (this.agent?.page) {
        try {
          // Execute detection in page context
          sensitiveRegions = await this.agent.page.evaluate(() => {
            // This function runs in page context
            // We need to detect sensitive elements and return their regions
            const regions: Array<{
              x: number;
              y: number;
              width: number;
              height: number;
              type: 'blur' | 'fill';
              category: string;
            }> = [];

            // Sensitive selectors
            const selectors = [
              'input[type="password"]',
              'input[type="email"]',
              'input[type="tel"]',
              'input[autocomplete="cc-number"]',
              'input[autocomplete="cc-csc"]',
              'input[name*="password"]',
              'input[name*="secret"]',
              'input[name*="token"]',
              'input[name*="api"][name*="key"]',
            ];

            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              elements.forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  const padding = 4;
                  regions.push({
                    x: Math.max(0, rect.left + window.scrollX - padding),
                    y: Math.max(0, rect.top + window.scrollY - padding),
                    width: rect.width + padding * 2,
                    height: rect.height + padding * 2,
                    type: 'blur',
                    category: 'credential',
                  });
                }
              });
            }

            return regions;
          });
        } catch (evalError) {
          console.debug('Failed to detect regions from page:', evalError);
        }
      }

      // Apply masking
      const result = await imageMasker.maskScreenshot(
        base64Screenshot,
        level,
        sensitiveRegions,
      );

      // Convert back to base64
      if (result.imageData) {
        return this.imageDataToBase64(result.imageData);
      }

      return base64Screenshot;
    } catch (error) {
      console.warn('Failed to mask screenshot:', error);
      return base64Screenshot;
    }
  }

  /**
   * Convert ImageData to base64 PNG string
   */
  private imageDataToBase64(imageData: ImageData): string {
    try {
      // Create canvas
      const canvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(imageData.width, imageData.height)
          : document.createElement('canvas');

      if ('width' in canvas) {
        canvas.width = imageData.width;
        canvas.height = imageData.height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.putImageData(imageData, 0, 0);

      // Convert to base64
      if ('toDataURL' in canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        return dataUrl.replace(/^data:image\/png;base64,/, '');
      }

      // For OffscreenCanvas, we need to use convertToBlob
      // But in sync context, return empty - caller should use async version
      return '';
    } catch (error) {
      console.warn('Failed to convert ImageData to base64:', error);
      return '';
    }
  }

  /**
   * Start log masking during execution
   */
  private startLogMasking(): void {
    if (
      this.maskingConfig.enabled &&
      this.maskingConfig.logMasking &&
      !this.isLogMaskingActive
    ) {
      logMasker.wrapConsole();
      this.isLogMaskingActive = true;
    }
  }

  /**
   * Stop log masking after execution
   */
  private stopLogMasking(): void {
    if (this.isLogMaskingActive) {
      logMasker.unwrapConsole();
      this.isLogMaskingActive = false;
    }
  }

  /**
   * Set execution callbacks
   */
  setCallbacks(callbacks: ExecutionCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Get current execution status
   */
  getStatus(): ExecutionStatus {
    return this.status;
  }

  /**
   * Get execution results
   */
  getResults(): ExecutionResult[] {
    return this.executionResults;
  }

  /**
   * Initialize agent for execution
   */
  private async initAgent(): Promise<void> {
    if (!this.agent) {
      this.agent = this.getAgent(true);
    }
  }

  /**
   * Apply device emulation settings via CDP
   */
  private async applyDeviceEmulation(
    config: DeviceEmulationConfig,
  ): Promise<void> {
    if (!this.agent?.page) return;

    try {
      // Use CDP to set device metrics override
      const page = this.agent.page;

      // Check if the page has sendCommandToDebugger method (ChromeExtensionProxyPage)
      if (typeof page.sendCommandToDebugger === 'function') {
        // Set device metrics override
        await page.sendCommandToDebugger('Emulation.setDeviceMetricsOverride', {
          width: config.width,
          height: config.height,
          deviceScaleFactor: config.deviceScaleFactor,
          mobile: config.isMobile,
        });

        // Set user agent if specified
        if (config.userAgent) {
          await page.sendCommandToDebugger('Emulation.setUserAgentOverride', {
            userAgent: config.userAgent,
          });
        }

        // Enable touch events if needed
        if (config.hasTouch) {
          await page.sendCommandToDebugger(
            'Emulation.setTouchEmulationEnabled',
            {
              enabled: true,
              maxTouchPoints: 5,
            },
          );
        }
      }
    } catch (error) {
      console.warn('Failed to apply device emulation:', error);
    }
  }

  /**
   * Clear device emulation settings
   */
  private async clearDeviceEmulation(): Promise<void> {
    if (!this.agent?.page) return;

    try {
      const page = this.agent.page;
      if (typeof page.sendCommandToDebugger === 'function') {
        await page.sendCommandToDebugger(
          'Emulation.clearDeviceMetricsOverride',
          {},
        );
        await page.sendCommandToDebugger('Emulation.setTouchEmulationEnabled', {
          enabled: false,
        });
      }
    } catch (error) {
      console.warn('Failed to clear device emulation:', error);
    }
  }

  /**
   * Destroy agent after execution
   */
  private async destroyAgent(): Promise<void> {
    // Clear device emulation before destroying
    await this.clearDeviceEmulation();

    if (this.agent?.page?.destroy) {
      await this.agent.page.destroy();
    }
    this.agent = null;
  }

  /**
   * Extract element info from agent dump after successful aiAct
   */
  private extractElementFromDump(): {
    center: [number, number];
    rect: any;
  } | null {
    try {
      const executions = this.agent?.dump?.executions;
      if (!executions || executions.length === 0) return null;

      const lastExecution = executions[executions.length - 1];
      const locateTasks = lastExecution.tasks?.filter(
        (t: any) => t.type === 'Planning' && t.subType === 'Locate',
      );

      if (!locateTasks || locateTasks.length === 0) return null;

      const lastLocate = locateTasks[locateTasks.length - 1];
      const element = lastLocate?.output?.element;

      if (element?.center && element?.rect) {
        return {
          center: element.center,
          rect: element.rect,
        };
      }
      return null;
    } catch (error) {
      console.debug('Failed to extract element from dump:', error);
      return null;
    }
  }

  /**
   * Execute a single step with self-healing support
   */
  private async executeStep(step: TaskStep): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Use Midscene's AI action
      await this.agent.aiAct(step.originalText);

      // Success: try to collect fingerprint for future healing
      if (this.selfHealingConfig.enabled) {
        const elementInfo = this.extractElementFromDump();
        if (elementInfo) {
          try {
            healingEngine.setAgent(this.agent);
            await healingEngine.collectFingerprint(
              step.id,
              elementInfo.center,
              elementInfo.rect,
            );
          } catch (fpError) {
            console.debug('Failed to collect fingerprint:', fpError);
          }
        }
      }

      // Take screenshot after successful step (with masking)
      const screenshot = await this.takeScreenshot(true);

      const result: ExecutionResult = {
        stepId: step.id,
        success: true,
        generatedAction: generateYamlAction(step),
        screenshot,
        duration: Date.now() - startTime,
      };

      return result;
    } catch (error) {
      const errorDetails = parseErrorDetails(error, step.originalText);

      // Try self-healing if enabled and error is element_not_found
      if (
        this.selfHealingConfig.enabled &&
        errorDetails.type === 'element_not_found'
      ) {
        const healingResult = await this.tryHealing(step, errorDetails);
        if (healingResult) {
          return healingResult;
        }
      }

      // Take screenshot even on failure (with masking)
      const screenshot = await this.takeScreenshot(true);

      return {
        stepId: step.id,
        success: false,
        error: errorDetails.message,
        errorDetails,
        screenshot,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Attempt self-healing for a failed step
   */
  private async tryHealing(
    step: TaskStep,
    originalError: ExecutionError,
  ): Promise<ExecutionResult | null> {
    try {
      healingEngine.setAgent(this.agent);
      const healResult = await healingEngine.heal(step.id, step.originalText);

      // Notify about healing attempt
      this.callbacks.onHealingAttempt?.(step, healResult);

      if (!healResult.success) {
        return null;
      }

      const action = healingEngine.determineAction(healResult);

      if (action === 'reject') {
        return null;
      }

      // For auto_accept or request_confirmation
      let accepted = action === 'auto_accept';

      if (
        action === 'request_confirmation' &&
        this.callbacks.onHealingConfirmRequest
      ) {
        // Ask user for confirmation
        accepted = await this.callbacks.onHealingConfirmRequest(
          step,
          healResult,
        );
      }

      if (accepted && healResult.element) {
        // Confirm healing and get healed element info
        const healedElement = await healingEngine.confirmHealing(
          healResult.healingId,
          true,
        );

        if (!healedElement) {
          console.debug('Failed to get healed element info');
          return null;
        }

        // Execute action using the healed element's coordinates
        try {
          const [x, y] = healedElement.center;
          const actionType = this.inferActionType(step.originalText);

          if (actionType === 'click') {
            // Use direct coordinate click for healed element
            await this.agent.page.mouse.click(x, y, { button: 'left' });
          } else if (actionType === 'input') {
            // Click the element first, then input text
            await this.agent.page.mouse.click(x, y, { button: 'left' });
            const inputValue = this.extractInputValue(step.originalText);
            if (inputValue) {
              await this.agent.page.keyboard.type(inputValue);
            }
          } else {
            // For other actions, fallback to aiAct but with a hint about the location
            await this.agent.aiAct(step.originalText);
          }

          return {
            stepId: step.id,
            success: true,
            generatedAction: generateYamlAction(step),
            duration: healResult.timeCost,
            healingResult: healResult,
            healedByAI: true,
          };
        } catch (retryError) {
          console.debug('Retry after healing failed:', retryError);
          return null;
        }
      }

      return null;
    } catch (healError) {
      console.debug('Self-healing failed:', healError);
      return null;
    }
  }

  /**
   * Infer action type from step text
   */
  private inferActionType(stepText: string): 'click' | 'input' | 'other' {
    const lowerText = stepText.toLowerCase();

    // Input action patterns
    const inputPatterns = [
      /输入|填写|填入|键入|录入/,
      /input|type|enter|fill/,
      /在.*(输入|填写)/,
    ];
    for (const pattern of inputPatterns) {
      if (pattern.test(lowerText)) {
        return 'input';
      }
    }

    // Click action patterns
    const clickPatterns = [
      /点击|点选|单击|按下|触击/,
      /click|tap|press|select/,
    ];
    for (const pattern of clickPatterns) {
      if (pattern.test(lowerText)) {
        return 'click';
      }
    }

    return 'other';
  }

  /**
   * Extract input value from step text
   */
  private extractInputValue(stepText: string): string | null {
    // Match quoted strings
    const quotePatterns = [
      /"([^"]+)"/, // Double quotes
      /'([^']+)'/, // Single quotes
      /「([^」]+)」/, // Chinese quotes
      /『([^』]+)』/, // Japanese quotes
      /"([^"]+)"/, // Smart quotes
    ];

    for (const pattern of quotePatterns) {
      const match = stepText.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Try to extract value after "输入" or "input"
    const inputValuePatterns = [
      /(?:输入|填写|填入|键入)\s*[:：]?\s*(.+?)(?:\s|$)/,
      /(?:input|type|enter|fill)\s*[:：]?\s*(.+?)(?:\s|$)/i,
    ];

    for (const pattern of inputValuePatterns) {
      const match = stepText.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Execute all steps in a test case
   */
  async executeTestCase(
    testCase: TestCase,
    context?: ExecutionContext,
  ): Promise<{
    success: boolean;
    results: ExecutionResult[];
    yamlContent: string;
  }> {
    this.status = 'running';
    this.currentStepIndex = 0;
    this.executionResults = [];
    this.isPaused = false;

    const executionStartTime = Date.now();

    // Start log masking if enabled
    this.startLogMasking();

    try {
      await this.initAgent();

      // Apply device emulation if configured
      if (context?.deviceEmulation) {
        await this.applyDeviceEmulation(context.deviceEmulation);
      }

      // Navigate to URL if provided
      if (context?.url) {
        await this.agent.page.goto(context.url);
      }

      const totalSteps = testCase.steps.length;

      for (let i = 0; i < testCase.steps.length; i++) {
        // Check if paused
        if (this.isPaused) {
          await new Promise<void>((resolve) => {
            this.resumeResolve = resolve;
          });
        }

        // Check if stopped (status may change during async wait)
        if ((this.status as ExecutionStatus) === 'idle') {
          break;
        }

        const step = testCase.steps[i];
        this.currentStepIndex = i;

        // Notify step start
        this.callbacks.onStepStart?.(step, i);
        this.callbacks.onProgress?.(i + 1, totalSteps);

        // Execute step
        const result = await this.executeStep(step);
        this.executionResults.push(result);

        // Update step status
        step.status = result.success ? 'success' : 'failed';
        step.generatedAction = result.generatedAction;

        if (result.success) {
          this.callbacks.onStepComplete?.(step, result);
        } else {
          step.error = result.error;
          this.callbacks.onStepFailed?.(
            step,
            result.error || 'Unknown error',
            result.errorDetails,
          );

          // Pause on failure for human intervention
          this.status = 'paused';
          this.isPaused = true;

          // Wait for resume or stop
          await new Promise<void>((resolve) => {
            this.resumeResolve = resolve;
          });

          // If stopped during pause, break (status may change during async wait)
          if ((this.status as ExecutionStatus) === 'idle') {
            break;
          }
        }
      }

      const allSuccess = this.executionResults.every((r) => r.success);
      this.status = allSuccess ? 'completed' : 'failed';

      // Generate YAML content
      const yamlContent = this.generateYaml(testCase, context);

      // Record execution for analytics
      await this.recordExecutionAnalytics(
        testCase,
        context,
        executionStartTime,
      );

      return {
        success: allSuccess,
        results: this.executionResults,
        yamlContent,
      };
    } catch (error) {
      this.status = 'failed';
      // Still try to record failed execution
      try {
        await this.recordExecutionAnalytics(
          testCase,
          context,
          executionStartTime,
        );
      } catch (analyticsError) {
        console.debug('Failed to record analytics:', analyticsError);
      }
      throw error;
    } finally {
      // Stop log masking
      this.stopLogMasking();
      await this.destroyAgent();
    }
  }

  /**
   * Record execution data for analytics
   */
  private async recordExecutionAnalytics(
    testCase: TestCase,
    context: ExecutionContext | undefined,
    startTime: number,
  ): Promise<void> {
    try {
      // Convert execution results to step records
      const stepRecords: StepRecord[] = this.executionResults.map(
        (result, index) => {
          const step = testCase.steps[index];
          return {
            index,
            description: step?.originalText || `Step ${index + 1}`,
            status: result.success ? 'passed' : 'failed',
            duration: result.duration,
            aiResponseTime: result.duration, // Approximate
            retryCount: result.healedByAI ? 1 : 0,
          };
        },
      );

      // Determine viewport from context
      const viewport = context?.deviceEmulation
        ? {
            width: context.deviceEmulation.width,
            height: context.deviceEmulation.height,
          }
        : {
            width: context?.viewportWidth || 1920,
            height: context?.viewportHeight || 1080,
          };

      // Create execution record
      const executionRecord = dataCollector.createExecutionRecord(
        testCase.id || `case-${Date.now()}`,
        testCase.name,
        stepRecords,
        {
          browser: 'chrome',
          viewport,
          url: context?.url || window.location.href,
        },
        // Include healing info if any step was healed
        this.executionResults.some((r) => r.healedByAI)
          ? {
              attempted: true,
              success: this.executionResults.some(
                (r) => r.healedByAI && r.success,
              ),
              strategy: 'ai_relocate',
            }
          : undefined,
      );

      // Record the execution
      await dataCollector.recordExecution(executionRecord);

      // Check alert rules
      await alertManager.checkAlerts(executionRecord);
    } catch (error) {
      console.debug('Failed to record execution analytics:', error);
    }
  }

  /**
   * Pause execution
   */
  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
      this.isPaused = true;
    }
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (this.status === 'paused' && this.resumeResolve) {
      this.status = 'running';
      this.isPaused = false;
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.status = 'idle';
    this.isPaused = false;
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  /**
   * Retry failed step with modified instruction
   */
  async retryStep(
    stepId: string,
    newInstruction?: string,
  ): Promise<ExecutionResult> {
    // This would be called from UI when user modifies the instruction
    // For now, just re-execute
    const step: TaskStep = {
      id: stepId,
      originalText: newInstruction || '',
      status: 'pending',
    };

    await this.initAgent();
    const result = await this.executeStep(step);
    return result;
  }

  /**
   * Generate YAML from test case and results
   */
  generateYaml(testCase: TestCase, context?: ExecutionContext): string {
    const lines: string[] = [
      '# Generated by AI Test Agent',
      `# ${new Date().toISOString()}`,
      '',
    ];

    // Target section
    if (context?.url) {
      lines.push('target:');
      lines.push(`  url: "${context.url}"`);
      if (context.viewportWidth && context.viewportHeight) {
        lines.push(`  viewportWidth: ${context.viewportWidth}`);
        lines.push(`  viewportHeight: ${context.viewportHeight}`);
      }
      lines.push('');
    }

    // Cases section
    lines.push('cases:');
    lines.push(`  - name: "${testCase.name}"`);

    if (testCase.description) {
      lines.push(`    description: "${testCase.description}"`);
    }

    lines.push('    flow:');

    for (const step of testCase.steps) {
      const action = step.generatedAction || generateYamlAction(step);
      // Indent properly under flow
      lines.push(`      ${action}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate YAML from multiple test cases
   */
  generateYamlFromCases(cases: TestCase[], context?: ExecutionContext): string {
    const lines: string[] = [
      '# Generated by AI Test Agent',
      `# ${new Date().toISOString()}`,
      '',
    ];

    // Target section
    if (context?.url) {
      lines.push('target:');
      lines.push(`  url: "${context.url}"`);
      if (context.viewportWidth && context.viewportHeight) {
        lines.push(`  viewportWidth: ${context.viewportWidth}`);
        lines.push(`  viewportHeight: ${context.viewportHeight}`);
      }
      lines.push('');
    }

    // Cases section
    lines.push('cases:');

    for (const testCase of cases) {
      lines.push(`  - name: "${testCase.name}"`);

      if (testCase.description) {
        lines.push(`    description: "${testCase.description}"`);
      }

      lines.push('    flow:');

      for (const step of testCase.steps) {
        const action = step.generatedAction || generateYamlAction(step);
        lines.push(`      ${action}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}
