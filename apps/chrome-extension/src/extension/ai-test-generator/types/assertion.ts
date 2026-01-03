/**
 * Types for Smart Assertion System
 * Data models for intelligent assertion generation
 */

/**
 * Action types for context analysis
 */
export type ActionType =
  | 'click'
  | 'input'
  | 'select'
  | 'scroll'
  | 'navigate'
  | 'wait'
  | 'assert'
  | 'ai';

/**
 * Assertion types supported by the system
 */
export type AssertionType =
  | 'element_exists'
  | 'element_visible'
  | 'text_contains'
  | 'text_equals'
  | 'attribute_equals'
  | 'state_check'
  | 'url_contains'
  | 'url_equals'
  | 'count_equals'
  | 'value_equals'
  | 'enabled'
  | 'disabled'
  | 'checked'
  | 'unchecked';

/**
 * Assertion parameter operators
 */
export type AssertionOperator =
  | 'equals'
  | 'contains'
  | 'matches'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte';

/**
 * Bounding box for element location
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Element information
 */
export interface ElementInfo {
  text: string;
  tagName: string;
  attributes: Record<string, string>;
  boundingBox: BoundingBox;
  isVisible?: boolean;
  isEnabled?: boolean;
  isChecked?: boolean;
}

/**
 * Visual change detected between screenshots
 */
export interface VisualChange {
  type: 'appeared' | 'disappeared' | 'modified';
  region: BoundingBox;
  description: string;
  confidence: number;
  elementInfo?: Partial<ElementInfo>;
}

/**
 * Page state snapshot
 */
export interface PageState {
  beforeScreenshot?: Uint8Array;
  afterScreenshot?: Uint8Array;
  beforeUrl: string;
  afterUrl: string;
  beforeTitle?: string;
  afterTitle?: string;
  visibleChanges: VisualChange[];
}

/**
 * Action context for assertion analysis
 */
export interface ActionContext {
  action: {
    type: ActionType;
    target: Partial<ElementInfo>;
    value?: string;
    timestamp: number;
  };
  pageState: PageState;
  semantic: {
    actionIntent: string;
    targetSemantics: string;
    expectedOutcome: string;
  };
  stepId: string;
  stepIndex: number;
}

/**
 * Analysis result from context analyzer
 */
export interface AnalysisResult {
  needsAssertion: boolean;
  assertionTypes: AssertionType[];
  changes: VisualChange[];
  intent: string;
  confidence: number;
  suggestedTarget?: string;
}

/**
 * Assertion parameters
 */
export interface AssertionParams {
  target?: string;
  expectedValue?: string;
  attribute?: string;
  operator?: AssertionOperator;
  timeout?: number;
}

/**
 * Assertion recommendation from generator
 */
export interface AssertionRecommendation {
  id: string;
  type: AssertionType;
  description: string;
  confidence: number;
  reason: string;
  parameters: AssertionParams;
  yamlOutput: string;
  previewResult?: boolean;
  previewError?: string;
  source: 'ai' | 'rule' | 'template';
}

/**
 * Validation result from assertion validator
 */
export interface ValidationResult {
  success: boolean;
  duration: number;
  error: string | null;
  actualValue?: string;
  expectedValue?: string;
}

/**
 * Assertion template trigger conditions
 */
export interface TemplateTrigger {
  actionType?: ActionType;
  elementPattern?: string;
  urlPattern?: string;
  intentPattern?: string;
}

/**
 * Assertion template category
 */
export type TemplateCategory = 'system' | 'user' | 'team';

/**
 * Assertion template for reuse
 */
export interface AssertionTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  trigger: TemplateTrigger;
  assertion: {
    type: AssertionType;
    parameters: Partial<AssertionParams>;
  };
  usageCount: number;
  createdAt: number;
  updatedAt?: number;
}

/**
 * Assertion strategy interface
 */
export interface AssertionStrategy {
  name: string;
  priority: number;
  applies(context: ActionContext, analysis: AnalysisResult): boolean;
  generate(
    context: ActionContext,
    analysis: AnalysisResult,
  ): Promise<AssertionRecommendation[]>;
}

/**
 * Smart assertion configuration
 */
export interface SmartAssertionConfig {
  enabled: boolean;
  autoSuggest: boolean;
  maxRecommendations: number;
  minConfidence: number;
  showPreview: boolean;
  enableTemplates: boolean;
  templateCategories: TemplateCategory[];
}

/**
 * Default smart assertion configuration
 */
export const DEFAULT_SMART_ASSERTION_CONFIG: SmartAssertionConfig = {
  enabled: true,
  autoSuggest: true,
  maxRecommendations: 5,
  minConfidence: 50,
  showPreview: true,
  enableTemplates: true,
  templateCategories: ['system', 'user'],
};

/**
 * High-value action intents that should trigger assertions
 */
export const HIGH_VALUE_INTENTS = [
  'submit_form',
  'login',
  'logout',
  'signup',
  'add_to_cart',
  'checkout',
  'delete_item',
  'save_data',
  'update_data',
  'navigate_to',
  'search',
  'filter',
  'sort',
  'upload',
  'download',
  'confirm',
  'cancel',
] as const;

/**
 * Assertion type display labels (Chinese)
 */
export const ASSERTION_TYPE_LABELS: Record<AssertionType, string> = {
  element_exists: '元素存在',
  element_visible: '元素可见',
  text_contains: '文本包含',
  text_equals: '文本等于',
  attribute_equals: '属性等于',
  state_check: '状态检查',
  url_contains: 'URL 包含',
  url_equals: 'URL 等于',
  count_equals: '数量等于',
  value_equals: '值等于',
  enabled: '已启用',
  disabled: '已禁用',
  checked: '已选中',
  unchecked: '未选中',
};

/**
 * Success keywords for detecting success messages
 */
export const SUCCESS_KEYWORDS = [
  '成功',
  '完成',
  '已保存',
  '已提交',
  '已添加',
  '已删除',
  '已更新',
  'success',
  'successful',
  'completed',
  'saved',
  'submitted',
  'added',
  'deleted',
  'updated',
  'done',
] as const;

/**
 * Error keywords for detecting error messages
 */
export const ERROR_KEYWORDS = [
  '失败',
  '错误',
  '无效',
  '不能',
  '不正确',
  '请输入',
  '必填',
  'error',
  'failed',
  'invalid',
  'cannot',
  'incorrect',
  'required',
  'please enter',
] as const;
