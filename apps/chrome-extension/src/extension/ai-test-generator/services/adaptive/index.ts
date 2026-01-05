/**
 * Adaptive Test Generation Module
 * 自适应测试生成模块 - 导出所有公共 API
 */

// Types
export * from '../../types/adaptive';

// Parser
export {
  parseAdaptiveTest,
  validateAdaptiveTest,
  buildParseTree,
  formatAdaptiveTestToMarkdown,
} from './adaptiveParser';

// Expression Parser
export {
  parseConditionExpression,
  parseNaturalLanguageCondition,
  formatConditionExpression,
  type ParseResult,
} from './expressionParser';

// Syntax Validator
export {
  SyntaxValidator,
  validateSyntax,
  validateConditionExpression as validateConditionSyntax,
  validateLoopExpression,
  validateVariableExpression,
  getSyntaxSuggestions,
  formatValidationResult,
} from './syntaxValidator';

// Condition Engine
export {
  ConditionEngine,
  getConditionEngine,
  evaluateCondition,
  type EvaluationResult,
  type ConditionEngineOptions,
} from './conditionEngine';

// State Detector
export {
  StateDetector,
  getStateDetector,
  detectPageState,
  getCurrentPageState,
  type StateDetectionResult,
  type StateDetectorOptions,
} from './stateDetector';

// Variable Store
export {
  VariableStore,
  getVariableStore,
  type VariableChangeEvent,
  type VariableSnapshot,
  type VariableStoreOptions,
} from './variableStore';

// Loop Manager
export {
  LoopManager,
  getLoopManager,
  executeLoop,
  type LoopExecutionResult,
  type LoopManagerOptions,
} from './loopManager';

// Control Flow Executor
export {
  ControlFlowExecutor,
  getControlFlowExecutor,
  executeStep,
  type ControlFlowOptions,
  type ExtendedStepResult,
} from './controlFlowExecutor';

// Adaptive Execution Engine
export {
  AdaptiveExecutionEngine,
  getAdaptiveExecutionEngine,
  executeAdaptiveTest,
  type AdaptiveExecutionCallbacks,
  type AdaptiveExecutionOptions,
  type AdaptiveExecutionResult,
} from './adaptiveExecutionEngine';
