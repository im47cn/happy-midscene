/**
 * Debug Assistant Services Module
 * Exports all services for conversational debugging
 */

// Core services
export * from './conversationManager';
export * from './contextBuilder';
export * from './responseParser';

// Action services
export * from './actionExecutor';
export * from './pageActions';
export * from './highlightAction';
export * from './compareAction';

// Fix system
export * from './knowledgeBase';
export * from './fixSuggestionGenerator';
export * from './fixApplier';

// LLM integration
export * from './llmEngine';
export * from './prompts';
export * from './referenceResolver';

// Main service
export * from './debugAssistantService';

// Performance optimization
export * from './cacheManager';

// Re-export types for convenience
export type {
  Message,
  MessageRole,
  DebugActionType,
  FixSuggestionType,
  DebugAction,
  ActionResult,
  FixSuggestion,
  DebugContext,
  ConversationState,
  ParsedResponse,
  LLMContext,
  QuickQuestion,
  DebugAssistantConfig,
  DEFAULT_DEBUG_ASSISTANT_CONFIG,
  DEFAULT_QUICK_QUESTIONS,
} from '../../types/debugAssistant';
