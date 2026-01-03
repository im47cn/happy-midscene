/**
 * Field Recognizer
 * Recognizes form fields and their semantic types from labels, placeholders, and attributes
 */

import type {
  FieldConstraints,
  FieldDefinition,
  FieldType,
  SemanticType,
} from '../../types/dataGen';
import {
  extractConstraints,
  parseFieldType,
  parseSemanticType,
  parseSemanticTypeWithConfidence,
} from './semanticParser';

/**
 * Generate unique field ID
 */
function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Field recognition options
 */
export interface RecognizeOptions {
  locale?: string;
  includeHidden?: boolean;
  minConfidence?: number;
}

/**
 * Raw field info from DOM or screenshot
 */
export interface RawFieldInfo {
  label?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  options?: string[];
  ariaLabel?: string;
}

/**
 * Recognized field with confidence
 */
export interface RecognizedField {
  field: FieldDefinition;
  confidence: number;
  rawInfo: RawFieldInfo;
}

/**
 * Field Recognizer class
 */
export class FieldRecognizer {
  private options: RecognizeOptions;

  constructor(options: RecognizeOptions = {}) {
    this.options = {
      locale: 'zh-CN',
      includeHidden: false,
      minConfidence: 30,
      ...options,
    };
  }

  /**
   * Recognize a single field from raw info
   */
  recognizeField(rawInfo: RawFieldInfo): RecognizedField {
    // Extract label from various sources
    const label = this.extractLabel(rawInfo);

    // Parse semantic type
    const { type: semanticType, confidence } = parseSemanticTypeWithConfidence(
      label,
      rawInfo.placeholder,
    );

    // Parse field type
    const fieldType = parseFieldType(rawInfo.type, label, rawInfo.placeholder);

    // Extract constraints
    const constraints = extractConstraints(label, {
      required: rawInfo.required,
      minLength: rawInfo.minLength,
      maxLength: rawInfo.maxLength,
      min: rawInfo.min,
      max: rawInfo.max,
      pattern: rawInfo.pattern,
    });

    // Add options if present
    if (rawInfo.options && rawInfo.options.length > 0) {
      constraints.options = rawInfo.options;
    }

    const field: FieldDefinition = {
      id: rawInfo.id || rawInfo.name || generateFieldId(),
      name: rawInfo.name || rawInfo.id || label,
      label,
      fieldType,
      semanticType,
      constraints,
      metadata: {
        rawInfo,
        recognizedAt: Date.now(),
      },
    };

    return {
      field,
      confidence,
      rawInfo,
    };
  }

  /**
   * Recognize multiple fields
   */
  recognizeFields(rawInfoList: RawFieldInfo[]): RecognizedField[] {
    const results: RecognizedField[] = [];

    for (const rawInfo of rawInfoList) {
      const recognized = this.recognizeField(rawInfo);

      // Filter by confidence
      if (recognized.confidence >= (this.options.minConfidence || 0)) {
        results.push(recognized);
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  /**
   * Extract label from various sources
   */
  private extractLabel(rawInfo: RawFieldInfo): string {
    // Priority: label > ariaLabel > placeholder > name > id
    return (
      rawInfo.label ||
      rawInfo.ariaLabel ||
      rawInfo.placeholder ||
      rawInfo.name ||
      rawInfo.id ||
      ''
    );
  }

  /**
   * Quick recognize semantic type from text
   */
  recognizeSemanticType(text: string): SemanticType {
    return parseSemanticType(text);
  }

  /**
   * Quick recognize field type from HTML type and text
   */
  recognizeFieldType(htmlType?: string, text?: string): FieldType {
    return parseFieldType(htmlType, text);
  }

  /**
   * Set recognition options
   */
  setOptions(options: Partial<RecognizeOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): RecognizeOptions {
    return { ...this.options };
  }
}

/**
 * Create a field definition from simple parameters
 */
export function createFieldDefinition(
  name: string,
  semanticType: SemanticType,
  options: {
    label?: string;
    fieldType?: FieldType;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    options?: string[];
  } = {},
): FieldDefinition {
  return {
    id: generateFieldId(),
    name,
    label: options.label || name,
    fieldType: options.fieldType || 'text',
    semanticType,
    constraints: {
      required: options.required ?? false,
      minLength: options.minLength,
      maxLength: options.maxLength,
      minValue: options.minValue,
      maxValue: options.maxValue,
      options: options.options,
    },
    metadata: {},
  };
}

/**
 * Batch create field definitions for common form types
 */
export function createFormFields(
  formType: 'login' | 'register' | 'profile' | 'payment',
): FieldDefinition[] {
  switch (formType) {
    case 'login':
      return [
        createFieldDefinition('username', 'username', {
          label: '用户名',
          required: true,
        }),
        createFieldDefinition('password', 'password', {
          label: '密码',
          fieldType: 'password',
          required: true,
        }),
      ];

    case 'register':
      return [
        createFieldDefinition('username', 'username', {
          label: '用户名',
          required: true,
          minLength: 4,
          maxLength: 20,
        }),
        createFieldDefinition('email', 'email', {
          label: '邮箱',
          fieldType: 'email',
          required: true,
        }),
        createFieldDefinition('mobile', 'mobile_phone', {
          label: '手机号',
          fieldType: 'phone',
          required: true,
        }),
        createFieldDefinition('password', 'password', {
          label: '密码',
          fieldType: 'password',
          required: true,
          minLength: 8,
        }),
        createFieldDefinition('confirmPassword', 'password', {
          label: '确认密码',
          fieldType: 'password',
          required: true,
        }),
      ];

    case 'profile':
      return [
        createFieldDefinition('realname', 'realname', {
          label: '真实姓名',
          required: true,
        }),
        createFieldDefinition('idCard', 'id_card', {
          label: '身份证号',
          required: true,
        }),
        createFieldDefinition('mobile', 'mobile_phone', {
          label: '手机号',
          fieldType: 'phone',
        }),
        createFieldDefinition('email', 'email', {
          label: '邮箱',
          fieldType: 'email',
        }),
        createFieldDefinition('address', 'address', {
          label: '地址',
          fieldType: 'textarea',
        }),
      ];

    case 'payment':
      return [
        createFieldDefinition('cardHolder', 'realname', {
          label: '持卡人姓名',
          required: true,
        }),
        createFieldDefinition('bankCard', 'bank_card', {
          label: '银行卡号',
          required: true,
        }),
        createFieldDefinition('mobile', 'mobile_phone', {
          label: '预留手机号',
          fieldType: 'phone',
          required: true,
        }),
        createFieldDefinition('amount', 'amount', {
          label: '金额',
          fieldType: 'number',
          required: true,
          minValue: 0.01,
        }),
      ];

    default:
      return [];
  }
}

/**
 * Default field recognizer instance
 */
export const fieldRecognizer = new FieldRecognizer();
