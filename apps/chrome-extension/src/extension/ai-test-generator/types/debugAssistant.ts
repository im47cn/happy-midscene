/**
 * Types for Natural Language Debug Assistant
 * Provides conversational debugging experience with AI-powered analysis and fix suggestions
 */

/**
 * Message roles in conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Debug action types that can be executed through conversation
 */
export type DebugActionType =
  | 'click'
  | 'input'
  | 'scroll'
  | 'refresh'
  | 'highlight'
  | 'screenshot'
  | 'wait'
  | 'compare'
  | 'describe'
  | 'locate';

/**
 * Fix suggestion types
 */
export type FixSuggestionType =
  | 'code_change'
  | 'wait_time'
  | 'wait'
  | 'locator_change'
  | 'retry'
  | 'pre_action'
  | 'timeout'
  | 'assertion'
  | 'debug'
  | 'action'
  | 'navigation'
  | 'auth'
  | 'locator';

/**
 * Message in conversation
 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  screenshots?: string[];
  actions?: DebugAction[];
  suggestions?: FixSuggestion[];
  thinkingTime?: number;
  confidence?: number;
}

/**
 * Debug action that can be executed
 */
export interface DebugAction {
  id: string;
  type: DebugActionType;
  target?: string;
  value?: any;
  options?: {
    timeout?: number;
    index?: number;
    scrollDirection?: 'up' | 'down' | 'left' | 'right';
    scrollAmount?: number;
  };
}

/**
 * Result of executing a debug action
 */
export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  screenshot?: string;
  duration?: number;
}

/**
 * Fix suggestion for test failures
 */
export interface FixSuggestion {
  id?: string;
  type: FixSuggestionType;
  description: string;
  confidence: number; // 0-1
  code?: string;
  beforeAfter?: {
    before: string;
    after: string;
  };
  estimatedImpact?: string;
}

/**
 * Result of applying a fix suggestion
 */
export interface ApplyResult {
  success: boolean;
  message: string;
  modifiedStep?: string;
  retryResult?: any;
}

/**
 * Debug context - current state information
 */
export interface DebugContext {
  // Current state
  screenshot?: string;
  pageState?: {
    url: string;
    title?: string;
  };
  currentStep?: TestStepInfo;

  // Failure information
  lastError?: DebugError;
  error?: DebugError; // Alias for lastError

  // History
  executionHistory?: StepResult[];
  previousScreenshots?: ScreenshotInfo[];

  // Page information
  visibleElements?: ElementInfo[];
  consoleErrors?: string[];
  networkErrors?: NetworkError[];

  // Failed step info
  failedStep?: string;

  // Test case info
  testCaseId?: string;
  testCaseName?: string;
}

export interface TestStepInfo {
  id: string;
  description: string;
  index: number;
  generatedAction?: string;
}

export interface DebugError {
  type: 'element_not_found' | 'timeout' | 'action_failed' | 'assertion_failed' | 'unknown';
  message: string;
  stack?: string;
  details?: string;
}

export interface StepResult {
  stepId: string;
  description: string;
  success: boolean;
  error?: string;
  duration: number;
  screenshot?: string;
}

export interface ScreenshotInfo {
  timestamp: number;
  stepIndex: number;
  dataUrl: string;
  status: 'success' | 'failed';
}

export interface ElementInfo {
  tag: string;
  text?: string;
  selector?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible?: boolean;
  attributes?: Record<string, string>;
}

export interface ConsoleError {
  message: string;
  source?: string;
  timestamp: number;
  level: 'error' | 'warning' | 'info';
}

export interface NetworkError {
  url: string;
  status?: number;
  error: string;
  timestamp: number;
}

/**
 * Conversation state
 */
export interface ConversationState {
  sessionId: string;
  messages: Message[];
  debugContext: DebugContext;
  pendingAction?: DebugAction;
  status: 'idle' | 'thinking' | 'executing' | 'waiting_for_input';
  startTime: number;
  lastActivity: number;
}

/**
 * Parsed LLM response
 */
export interface ParsedResponse {
  text: string;
  actions: DebugAction[];
  suggestions: FixSuggestion[];
  needsContext?: boolean;
  contextType?: 'screenshot' | 'console' | 'network' | 'dom';
  contextRequest?: { type: string; details: string };
}

/**
 * LLM context for chat requests
 */
export interface LLMContext {
  systemPrompt: string;
  conversationHistory: ConversationMessage[];
  images?: string[];
  additionalContext?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Knowledge base entry for successful debugging patterns
 */
export interface DebugKnowledge {
  id: string;
  pattern: ErrorPattern;
  solution: FixSuggestion;
  successCount: number;
  failureCount: number;
  lastUsed: number;
  createdAt: number;
}

export interface ErrorPattern {
  errorType: string;
  errorMessagePattern?: string;
  elementType?: string;
  pagePattern?: string;
  stepDescriptionPattern?: string;
}

/**
 * Quick question suggestions
 */
export interface QuickQuestion {
  id: string;
  text: string;
  category: 'reason' | 'fix' | 'status' | 'element' | 'action';
  icon?: string;
}

/**
 * Config options for debug assistant
 */
export interface DebugAssistantConfig {
  enabled: boolean;
  maxConversationHistory: number;
  maxContextTokens: number;
  autoActivateOnFailure: boolean;
  showQuickQuestions: boolean;
  enableKnowledgeBase: boolean;
  streamingResponse: boolean;
  responseTimeout: number; // milliseconds
}

/**
 * Default configuration
 */
export const DEFAULT_DEBUG_ASSISTANT_CONFIG: DebugAssistantConfig = {
  enabled: true,
  maxConversationHistory: 50,
  maxContextTokens: 8000,
  autoActivateOnFailure: true,
  showQuickQuestions: true,
  enableKnowledgeBase: true,
  streamingResponse: true,
  responseTimeout: 30000, // 30 seconds
};

/**
 * Quick questions presets
 */
export const DEFAULT_QUICK_QUESTIONS: QuickQuestion[] = [
  { id: 'reason', text: '为什么失败了？', category: 'reason', icon: '❓' },
  { id: 'fix', text: '怎么修复这个问题？', category: 'fix', icon: '🔧' },
  { id: 'status', text: '当前页面是什么状态？', category: 'status', icon: '🔍' },
  { id: 'element', text: '帮我找一下目标元素', category: 'element', icon: '🎯' },
  { id: 'retry', text: '重试这个步骤', category: 'action', icon: '🔄' },
];
