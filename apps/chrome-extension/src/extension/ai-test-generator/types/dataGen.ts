/**
 * Smart Data Generation Types
 * Provides type definitions for intelligent test data generation
 */

/**
 * Field types for form inputs
 */
export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'datetime'
  | 'password'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'textarea'
  | 'file'
  | 'url';

/**
 * Semantic types for business meaning
 */
export type SemanticType =
  | 'username'
  | 'realname'
  | 'nickname'
  | 'email'
  | 'mobile_phone'
  | 'landline'
  | 'password'
  | 'captcha'
  | 'id_card'
  | 'bank_card'
  | 'address'
  | 'postal_code'
  | 'city'
  | 'province'
  | 'country'
  | 'date_of_birth'
  | 'amount'
  | 'quantity'
  | 'description'
  | 'url'
  | 'company'
  | 'job_title'
  | 'custom';

/**
 * Field constraints for validation
 */
export interface FieldConstraints {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  format?: string;
  options?: string[];
}

/**
 * Field definition for form fields
 */
export interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  fieldType: FieldType;
  semanticType: SemanticType;
  constraints: FieldConstraints;
  metadata: Record<string, unknown>;
}

/**
 * Generator configuration types
 */
export type GeneratorType = 'pattern' | 'faker' | 'pool' | 'custom' | 'function';

/**
 * Generator configuration
 */
export interface GeneratorConfig {
  type: GeneratorType;
  pattern?: string;
  fakerMethod?: string;
  poolId?: string;
  customFn?: string;
  params?: Record<string, unknown>;
}

/**
 * Variation configuration for data generation
 */
export interface VariationConfig {
  name: string;
  description: string;
  modifier: (value: unknown) => unknown;
}

/**
 * Generation rule for semantic types
 */
export interface GenerationRule {
  id: string;
  name: string;
  semanticType: SemanticType;
  generator: GeneratorConfig;
  variations: VariationConfig[];
  locale?: string;
}

/**
 * Template field definition
 */
export interface TemplateField {
  fieldId: string;
  fieldName: string;
  generationType: 'fixed' | 'random' | 'pool' | 'variable';
  fixedValue?: unknown;
  generatorId?: string;
  poolId?: string;
  variableName?: string;
}

/**
 * Data template for reusable data generation
 */
export interface DataTemplate {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  variables: Record<string, unknown>;
  category: 'system' | 'user';
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

/**
 * Boundary test case
 */
export interface BoundaryTestCase {
  name: string;
  value: unknown;
  expectedResult: 'valid' | 'invalid';
  description: string;
  category: 'min' | 'max' | 'boundary-1' | 'boundary+1' | 'empty' | 'special';
}

/**
 * Boundary configuration for a field
 */
export interface BoundaryConfig {
  fieldId: string;
  constraints: FieldConstraints;
  testCases: BoundaryTestCase[];
}

/**
 * Masking strategy types
 */
export type MaskingStrategy =
  | 'partial'
  | 'full'
  | 'hash'
  | 'substitute'
  | 'shuffle';

/**
 * Masking rule for sensitive data
 */
export interface MaskingRule {
  id: string;
  semanticType: SemanticType;
  strategy: MaskingStrategy;
  pattern: string;
  replacement: string;
}

/**
 * Data pool for predefined values
 */
export interface DataPool {
  id: string;
  name: string;
  description: string;
  values: unknown[];
  pickStrategy: 'random' | 'sequential' | 'shuffle';
  category: 'system' | 'user';
}

/**
 * Generation options
 */
export interface GenerateOptions {
  locale?: string;
  variation?: string;
  seed?: number;
  applyMasking?: boolean;
}

/**
 * Generated data result
 */
export interface GeneratedData {
  fieldId: string;
  value: unknown;
  maskedValue?: string;
  generator: string;
  timestamp: number;
}

/**
 * Form generation result
 */
export interface FormGenerationResult {
  fields: Record<string, GeneratedData>;
  template?: string;
  timestamp: number;
}

/**
 * Data generation configuration
 */
export interface DataGenConfig {
  enabled: boolean;
  defaultLocale: string;
  autoMask: boolean;
  generateBoundaryValues: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_DATA_GEN_CONFIG: DataGenConfig = {
  enabled: true,
  defaultLocale: 'zh-CN',
  autoMask: true,
  generateBoundaryValues: true,
};

/**
 * Sensitive semantic types that need masking
 */
export const SENSITIVE_TYPES: SemanticType[] = [
  'id_card',
  'bank_card',
  'mobile_phone',
  'password',
  'email',
  'realname',
  'address',
];

/**
 * Interface for data generator
 */
export interface IDataGenerator {
  generate(field: FieldDefinition, options?: GenerateOptions): Promise<unknown>;
  generateForForm(fields: FieldDefinition[]): Promise<FormGenerationResult>;
  generateBoundaryValues(field: FieldDefinition): Promise<BoundaryTestCase[]>;
}

/**
 * Interface for data masker
 */
export interface IDataMasker {
  mask(value: unknown, semanticType: SemanticType): string;
  maskRecord(
    record: Record<string, unknown>,
    fieldTypes: Record<string, SemanticType>
  ): Record<string, string>;
  isSensitive(semanticType: SemanticType): boolean;
}

/**
 * Interface for template manager
 */
export interface ITemplateManager {
  create(template: Omit<DataTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<DataTemplate>;
  update(id: string, updates: Partial<DataTemplate>): Promise<DataTemplate | null>;
  delete(id: string): Promise<boolean>;
  get(id: string): Promise<DataTemplate | null>;
  list(): Promise<DataTemplate[]>;
  applyTemplate(templateId: string, variables?: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/**
 * Interface for data pool manager
 */
export interface IDataPoolManager {
  getPool(id: string): Promise<DataPool | null>;
  pick(poolId: string): Promise<unknown>;
  addPool(pool: Omit<DataPool, 'id'>): Promise<DataPool>;
  listPools(): Promise<DataPool[]>;
}
