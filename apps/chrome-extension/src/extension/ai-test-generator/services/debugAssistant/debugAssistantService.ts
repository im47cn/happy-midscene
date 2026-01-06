/**
 * Debug Assistant Service
 * Main service that orchestrates all debug assistant functionality
 * Integrates with ExecutionEngine to provide conversational debugging
 */

import type {
  DebugAction,
  DebugContext,
  FixSuggestion,
  Message,
} from '../../types/debugAssistant';
import { getConversationManager } from '../conversationManager';
import type { ExecutionError, ExecutionResult } from '../executionEngine';
import type { TaskStep, TestCase } from '../markdownParser';
import { getResponseParser } from '../responseParser';
import { getActionExecutor } from './actionExecutor';
import { getCompareAction } from './compareAction';
import { getContextBuilder } from './contextBuilder';
import { getFixApplier } from './fixApplier';
import { getFixSuggestionGenerator } from './fixSuggestionGenerator';
import { getKnowledgeBase } from './knowledgeBase';
import { getLLMEngine } from './llmEngine';
import { getPageActions } from './pageActions';
import { DEFAULT_QUICK_QUESTIONS } from './prompts';
import { getReferenceResolver } from './referenceResolver';

export interface DebugAssistantConfig {
  enabled?: boolean;
  autoOpenOnError?: boolean;
  maxMessageHistory?: number;
  llmModel?: string;
  llmTemperature?: number;
  maxTokens?: number;
  timeout?: number;
  streamingEnabled?: boolean;
  knowledgeBaseEnabled?: boolean;
  autoLearnFromFixes?: boolean;
}

export interface DebugAssistantOptions {
  getAgent: () => any;
  executionEngine?: any; // ExecutionEngine instance
  config?: DebugAssistantConfig;
}

export interface DebugSession {
  id: string;
  startTime: number;
  testCaseId?: string;
  testCaseName?: string;
  stepId?: string;
  stepIndex?: number;
  error?: ExecutionError;
  screenshot?: string;
  status: 'active' | 'resolved' | 'abandoned';
}

export interface ExecuteActionOptions {
  sessionId?: string;
  recordInHistory?: boolean;
}

/**
 * Default configuration for debug assistant
 */
const DEFAULT_CONFIG: Required<DebugAssistantConfig> = {
  enabled: true,
  autoOpenOnError: false,
  maxMessageHistory: 50,
  llmModel: 'claude-3-5-sonnet-20241022',
  llmTemperature: 0.7,
  maxTokens: 8000,
  timeout: 30000,
  streamingEnabled: true,
  knowledgeBaseEnabled: true,
  autoLearnFromFixes: true,
};

/**
 * Main Debug Assistant Service
 * Orchestrates all debug assistant components and integrates with ExecutionEngine
 */
export class DebugAssistantService {
  private config: Required<DebugAssistantConfig>;
  private getAgent: () => any;
  private executionEngine?: any;
  private currentSession: DebugSession | null = null;
  private conversationHistory: Message[] = [];
  private executionHistory: string[] = [];

  // Service references
  private actionExecutor = getActionExecutor();
  private contextBuilder = getContextBuilder();
  private conversationManager = getConversationManager();
  private responseParser = getResponseParser();
  private llmEngine = getLLMEngine();
  private fixSuggestionGenerator = getFixSuggestionGenerator();
  private fixApplier = getFixApplier();
  private knowledgeBase = getKnowledgeBase();
  private compareAction = getCompareAction({ getAgent: () => this.getAgent() });
  private pageActions = getPageActions(() => this.getAgent());

  // Event callbacks
  private onMessageCallbacks: Array<(message: Message) => void> = [];
  private onSessionStartCallbacks: Array<(session: DebugSession) => void> = [];
  private onSessionEndCallbacks: Array<(session: DebugSession) => void> = [];
  private onActionExecutedCallbacks: Array<
    (action: DebugAction, result: any) => void
  > = [];
  private onFixAppliedCallbacks: Array<
    (fix: FixSuggestion, success: boolean) => void
  > = [];

  constructor(options: DebugAssistantOptions) {
    this.getAgent = options.getAgent;
    this.executionEngine = options.executionEngine;
    this.config = { ...DEFAULT_CONFIG, ...options.config };

    // Initialize services with agent getter
    this.initializeServices();
  }

  /**
   * Initialize services with dependencies
   */
  private initializeServices(): void {
    // Set agent getter for services that need it
    this.actionExecutor.setGetAgent(() => this.getAgent());
    this.fixSuggestionGenerator.setGetAgent(() => this.getAgent());
    this.fixApplier.setGetAgent(() => this.getAgent());
    this.pageActions.setGetAgent(() => this.getAgent());

    // Set service dependencies
    this.conversationManager.setResponseParser(this.responseParser);
    this.actionExecutor.setContextBuilder(this.contextBuilder);
    this.actionExecutor.setPageActions(this.pageActions);

    // Configure LLM engine
    this.llmEngine.configure({
      model: this.config.llmModel,
      temperature: this.config.llmTemperature,
      maxTokens: this.config.maxTokens,
      timeout: this.config.timeout,
      streaming: this.config.streamingEnabled,
    });
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<DebugAssistantConfig>): void {
    this.config = { ...this.config, ...config };

    // Update LLM engine config if relevant settings changed
    if (
      config.llmModel ||
      config.llmTemperature ||
      config.maxTokens ||
      config.timeout ||
      config.streamingEnabled !== undefined
    ) {
      this.llmEngine.configure({
        model: this.config.llmModel,
        temperature: this.config.llmTemperature,
        maxTokens: this.config.maxTokens,
        timeout: this.config.timeout,
        streaming: this.config.streamingEnabled,
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<DebugAssistantConfig> {
    return { ...this.config };
  }

  /**
   * Check if debug assistant is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable debug assistant
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Start a debug session when a step fails
   */
  async startDebugSession(
    testCase: TestCase,
    step: TaskStep,
    result: ExecutionResult,
    stepIndex: number,
  ): Promise<DebugSession> {
    // End any existing session
    if (this.currentSession) {
      await this.endDebugSession('abandoned');
    }

    // Create new session
    const session: DebugSession = {
      id: `session-${Date.now()}`,
      startTime: Date.now(),
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      stepId: step.id,
      stepIndex,
      error: result.errorDetails,
      screenshot: result.screenshot,
      status: 'active',
    };

    this.currentSession = session;

    // Build debug context
    const debugContext = await this.buildDebugContext(
      testCase,
      step,
      result,
      stepIndex,
    );

    // Add to execution history
    this.executionHistory.push(
      `步骤 ${stepIndex + 1}: ${step.originalText} - ${result.success ? '成功' : '失败'}`,
    );

    // Notify listeners
    this.onSessionStartCallbacks.forEach((cb) => cb(session));

    // If auto-open is enabled, send initial analysis
    if (this.config.autoOpenOnError && result.errorDetails) {
      await this.analyzeFailure(debugContext);
    }

    return session;
  }

  /**
   * End current debug session
   */
  async endDebugSession(
    status: 'resolved' | 'abandoned' = 'resolved',
  ): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const session = { ...this.currentSession, status };
    this.currentSession = null;

    // Notify listeners
    this.onSessionEndCallbacks.forEach((cb) => cb(session));

    // Clear conversation history if resolved
    if (status === 'resolved') {
      this.conversationHistory = [];
    }
  }

  /**
   * Get current debug session
   */
  getCurrentSession(): DebugSession | null {
    return this.currentSession;
  }

  /**
   * Build debug context from execution state
   */
  async buildDebugContext(
    testCase: TestCase,
    step: TaskStep,
    result: ExecutionResult,
    stepIndex: number,
  ): Promise<DebugContext> {
    const agent = this.getAgent();
    const page = agent?.page;

    // Get current page info
    let url = '';
    let pageTitle = '';
    let visibleElements: any[] = [];
    let consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    if (page) {
      try {
        url = page.url();
        pageTitle = await page.title();

        // Get page diagnostics
        const diagnostics = await page.evaluate(() => {
          // Get visible elements
          const elements = Array.from(document.querySelectorAll('*'))
            .filter((el) => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            })
            .slice(0, 50)
            .map((el) => ({
              tag: el.tagName,
              text: el.textContent?.slice(0, 50) || '',
              id: el.id,
              className: el.className,
              visible: true,
            }));

          // Get console errors (from window.console errors collection if available)
          const errors: string[] = [];

          return { elements, errors };
        });

        visibleElements = diagnostics.elements;
        consoleErrors = diagnostics.errors;
      } catch (e) {
        console.debug('Failed to get page diagnostics:', e);
      }
    }

    // Build execution history from previous results
    const executionHistory = this.executionHistory.slice(-20);

    // Build previous step history
    const previousSteps = testCase.steps.slice(0, stepIndex).map((s, i) => ({
      index: i,
      description: s.originalText,
      status: i < stepIndex ? 'success' : 'pending',
    }));

    return {
      currentUrl: url,
      pageTitle,
      currentStep: {
        id: step.id,
        description: step.originalText,
        index: stepIndex,
        status: result.success ? 'success' : 'failed',
      },
      lastError: result.errorDetails
        ? {
            type: result.errorDetails.type,
            message: result.errorDetails.message,
            stack: result.errorDetails.details,
            timestamp: Date.now(),
          }
        : undefined,
      screenshot: result.screenshot,
      executionHistory,
      previousSteps,
      pageDiagnostics: {
        visibleElements,
        consoleErrors,
        networkErrors,
      },
      testCase: {
        id: testCase.id,
        name: testCase.name,
        description: testCase.description,
        totalSteps: testCase.steps.length,
      },
    };
  }

  /**
   * Send a message to the debug assistant
   */
  async sendMessage(userMessage: string): Promise<Message> {
    // Build context from current session
    const debugContext = await this.getCurrentContext();

    if (!debugContext) {
      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: '请先执行测试用例以开始调试会话',
        timestamp: Date.now(),
      };
    }

    // Add user message to history
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    this.conversationHistory.push(userMsg);

    // Build LLM context
    const llmContext = this.contextBuilder.build({
      debugContext,
      userQuery: userMessage,
      conversationHistory: this.conversationHistory.slice(
        -this.config.maxMessageHistory,
      ),
    });

    // Call LLM
    const llmResponse = await this.llmEngine.chat(llmContext);

    // Parse response
    const parsedResponse = this.responseParser.parse(llmResponse.text);

    // Build assistant message
    const assistantMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: parsedResponse.text,
      timestamp: Date.now(),
      actions: parsedResponse.actions,
      suggestions: parsedResponse.suggestions,
      contextRequest: parsedResponse.contextRequest,
      metadata: {
        thinkingTime: llmResponse.metadata?.thinkingTime,
        tokensUsed: llmResponse.metadata?.tokensUsed,
      },
    };

    this.conversationHistory.push(assistantMsg);

    // Notify listeners
    this.onMessageCallbacks.forEach((cb) => cb(assistantMsg));

    // Handle context requests
    if (parsedResponse.contextRequest) {
      await this.handleContextRequest(
        parsedResponse.contextRequest,
        debugContext,
      );
    }

    // Add to knowledge base if fixes were suggested
    if (
      this.config.knowledgeBaseEnabled &&
      parsedResponse.suggestions.length > 0
    ) {
      const errorPattern = debugContext.lastError?.message || 'unknown_error';
      this.knowledgeBase.addEntry({
        pattern: errorPattern,
        fixes: parsedResponse.suggestions,
        frequency: 1,
        successRate: 0.5,
        tags: [debugContext.lastError?.type || 'general', 'auto-generated'],
      });
    }

    return assistantMsg;
  }

  /**
   * Execute a debug action
   */
  async executeAction(
    action: DebugAction,
    options: ExecuteActionOptions = {},
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const debugContext = await this.getCurrentContext();

      // Execute action through action executor
      const result = await this.actionExecutor.execute(action, debugContext);

      // Record in execution history
      if (options.recordInHistory !== false) {
        this.executionHistory.push(
          `执行操作: ${this.formatActionDescription(action)} - ${result.success ? '成功' : '失败'}`,
        );
      }

      // Notify listeners
      this.onActionExecutedCallbacks.forEach((cb) => cb(action, result));

      return {
        success: result.success,
        result: result.data,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Apply a fix suggestion
   */
  async applyFix(fix: FixSuggestion): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const debugContext = await this.getCurrentContext();

    if (!debugContext) {
      return {
        success: false,
        error: '没有活动的调试会话',
      };
    }

    try {
      // Apply fix through fix applier
      const result = await this.fixApplier.apply({
        context: debugContext,
        fix,
        getAgent: () => this.getAgent(),
      });

      // Record in knowledge base
      if (this.config.autoLearnFromFixes) {
        const errorPattern = debugContext.lastError?.message || 'unknown_error';
        const entryId = this.knowledgeBase.addEntry({
          pattern: errorPattern,
          fixes: [fix],
          frequency: 1,
          successRate: result.success ? 1.0 : 0.0,
          tags: [debugContext.lastError?.type || 'general', 'user-applied'],
        });

        if (result.success) {
          this.knowledgeBase.updateSuccessRate(entryId, true);
        }
      }

      // Record in execution history
      this.executionHistory.push(
        `应用修复: ${fix.description} - ${result.success ? '成功' : '失败'}`,
      );

      // Notify listeners
      this.onFixAppliedCallbacks.forEach((cb) => cb(fix, result.success));

      // If fix was successful, mark session as resolved
      if (result.success && this.currentSession) {
        await this.endDebugSession('resolved');
      }

      return {
        success: result.success,
        result: result.data,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Analyze failure and provide initial suggestions
   */
  async analyzeFailure(debugContext: DebugContext): Promise<Message> {
    // Generate fix suggestions
    const suggestions = await this.fixSuggestionGenerator.generate(
      debugContext,
      debugContext.lastError?.message,
    );

    // Query knowledge base for similar patterns
    let kbSuggestions: FixSuggestion[] = [];
    if (this.config.knowledgeBaseEnabled && debugContext.lastError?.message) {
      const matchingPatterns = this.knowledgeBase.findMatchingPatterns(
        debugContext.lastError.message,
        3,
      );
      kbSuggestions = matchingPatterns
        .flatMap((entry) => entry.fixes)
        .slice(0, 3);
    }

    // Combine suggestions
    const allSuggestions = [...suggestions, ...kbSuggestions];

    // Build analysis message
    const analysis = this.buildFailureAnalysis(debugContext, allSuggestions);

    const message: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: analysis.text,
      timestamp: Date.now(),
      suggestions: allSuggestions,
      actions: analysis.actions,
    };

    this.conversationHistory.push(message);

    // Notify listeners
    this.onMessageCallbacks.forEach((cb) => cb(message));

    return message;
  }

  /**
   * Get quick questions for current context
   */
  getQuickQuestions(): Array<{
    question: string;
    category: string;
    icon?: string;
  }> {
    if (!this.currentSession?.error) {
      return DEFAULT_QUICK_QUESTIONS;
    }

    const errorType = this.currentSession.error.type;
    const specificQuestions: Array<{
      question: string;
      category: string;
      icon?: string;
    }> = [];

    switch (errorType) {
      case 'element_not_found':
        specificQuestions.push(
          { question: '为什么找不到这个元素？', category: 'diagnosis' },
          { question: '如何定位这个元素？', category: 'action' },
          { question: '页面加载完成了吗？', category: 'diagnosis' },
        );
        break;
      case 'timeout':
        specificQuestions.push(
          { question: '为什么会超时？', category: 'diagnosis' },
          { question: '如何增加等待时间？', category: 'fix' },
          { question: '检查网络状态', category: 'action' },
        );
        break;
      case 'assertion_failed':
        specificQuestions.push(
          { question: '断言为什么失败？', category: 'diagnosis' },
          { question: '实际值是什么？', category: 'diagnosis' },
          { question: '如何修正断言？', category: 'fix' },
        );
        break;
      default:
        specificQuestions.push(
          { question: '这个错误是什么意思？', category: 'diagnosis' },
          { question: '如何修复？', category: 'fix' },
        );
    }

    return [...specificQuestions, ...DEFAULT_QUICK_QUESTIONS];
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearConversationHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get current debug context
   */
  private async getCurrentContext(): Promise<DebugContext | null> {
    if (!this.currentSession) {
      return null;
    }

    // If we have execution engine, build fresh context
    if (this.executionEngine) {
      const testCase = this.executionEngine.getCurrentTestCase?.();
      const currentStep = this.executionEngine.getCurrentStep?.();
      const lastResult = this.executionEngine.getLastResult?.();

      if (testCase && currentStep && lastResult) {
        return this.buildDebugContext(
          testCase,
          currentStep,
          lastResult,
          this.currentSession.stepIndex || 0,
        );
      }
    }

    // Return cached context from session
    return {
      currentUrl: '',
      currentStep: this.currentSession.stepId
        ? {
            id: this.currentSession.stepId,
            description: '',
            index: this.currentSession.stepIndex || 0,
            status: 'failed',
          }
        : undefined,
      lastError: this.currentSession.error
        ? {
            type: this.currentSession.error.type,
            message: this.currentSession.error.message,
            stack: this.currentSession.error.details,
            timestamp: Date.now(),
          }
        : undefined,
      screenshot: this.currentSession.screenshot,
      executionHistory: this.executionHistory,
    };
  }

  /**
   * Build failure analysis message
   */
  private buildFailureAnalysis(
    debugContext: DebugContext,
    suggestions: FixSuggestion[],
  ): { text: string; actions?: DebugAction[] } {
    const error = debugContext.lastError;
    if (!error) {
      return { text: '没有检测到错误' };
    }

    let text = `## 错误分析\n\n`;
    text += `**类型**: ${this.formatErrorType(error.type)}\n\n`;
    text += `**信息**: ${error.message}\n\n`;

    // Add suggestions
    if (suggestions.length > 0) {
      text += `## 修复建议\n\n`;
      suggestions.forEach((s, i) => {
        text += `${i + 1}. ${s.description}\n`;
      });
    }

    // Suggest actions
    const actions: DebugAction[] = [
      {
        id: 'action-screenshot',
        type: 'screenshot',
        target: '',
      },
    ];

    if (debugContext.currentUrl) {
      actions.push({
        id: 'action-compare',
        type: 'compare',
        target: '',
      });
    }

    return { text, actions };
  }

  /**
   * Handle context request from LLM
   */
  private async handleContextRequest(
    request: { type: string; details?: string },
    debugContext: DebugContext,
  ): Promise<void> {
    switch (request.type) {
      case 'console_errors':
        // Console errors already included in context
        break;
      case 'network_errors':
        // Network errors already included in context
        break;
      case 'visible_elements':
        // Visible elements already included in context
        break;
      case 'execution_history':
        // Execution history already included in context
        break;
    }
  }

  /**
   * Format action description for display
   */
  private formatActionDescription(action: DebugAction): string {
    const descriptions: Record<DebugAction['type'], string> = {
      click: '点击',
      input: '输入',
      scroll: '滚动',
      refresh: '刷新',
      highlight: '高亮',
      screenshot: '截图',
      wait: '等待',
      compare: '对比',
      describe: '描述',
      locate: '定位',
    };

    const base = descriptions[action.type] || action.type;
    if (action.target) {
      return `${base} "${action.target}"`;
    }
    return base;
  }

  /**
   * Format error type for display
   */
  private formatErrorType(type: string): string {
    const types: Record<string, string> = {
      element_not_found: '元素未找到',
      timeout: '超时',
      action_failed: '操作失败',
      navigation_failed: '导航失败',
      assertion_failed: '断言失败',
      unknown: '未知错误',
    };
    return types[type] || type;
  }

  // Event subscription methods

  onMessage(callback: (message: Message) => void): () => void {
    this.onMessageCallbacks.push(callback);
    return () => {
      this.onMessageCallbacks = this.onMessageCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  onSessionStart(callback: (session: DebugSession) => void): () => void {
    this.onSessionStartCallbacks.push(callback);
    return () => {
      this.onSessionStartCallbacks = this.onSessionStartCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  onSessionEnd(callback: (session: DebugSession) => void): () => void {
    this.onSessionEndCallbacks.push(callback);
    return () => {
      this.onSessionEndCallbacks = this.onSessionEndCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  onActionExecuted(
    callback: (action: DebugAction, result: any) => void,
  ): () => void {
    this.onActionExecutedCallbacks.push(callback);
    return () => {
      this.onActionExecutedCallbacks = this.onActionExecutedCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  onFixApplied(
    callback: (fix: FixSuggestion, success: boolean) => void,
  ): () => void {
    this.onFixAppliedCallbacks.push(callback);
    return () => {
      this.onFixAppliedCallbacks = this.onFixAppliedCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  /**
   * Get knowledge base statistics
   */
  getKnowledgeBaseStats() {
    return this.knowledgeBase.getStats();
  }

  /**
   * Export knowledge base
   */
  exportKnowledgeBase(): string {
    return this.knowledgeBase.export();
  }

  /**
   * Import knowledge base
   */
  importKnowledgeBase(json: string): void {
    this.knowledgeBase.import(json);
  }

  /**
   * Clear knowledge base
   */
  clearKnowledgeBase(): void {
    this.knowledgeBase.clear();
  }
}

// Singleton instance
let debugAssistantServiceInstance: DebugAssistantService | null = null;

/**
 * Get or create the debug assistant service instance
 */
export function getDebugAssistantService(
  options?: DebugAssistantOptions,
): DebugAssistantService {
  if (!debugAssistantServiceInstance && options) {
    debugAssistantServiceInstance = new DebugAssistantService(options);
  }
  if (!debugAssistantServiceInstance) {
    throw new Error(
      'DebugAssistantService not initialized. Call getDebugAssistantService with options first.',
    );
  }
  return debugAssistantServiceInstance;
}

/**
 * Reset the debug assistant service instance
 */
export function resetDebugAssistantService(): void {
  debugAssistantServiceInstance = null;
}
