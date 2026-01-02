/**
 * Smart Input Executor
 * Integrates data generation with test execution
 */

import type { FieldDefinition, SemanticType, GenerateOptions } from '../../types/dataGen';
import { dataGenerator } from './dataGenerator';
import { dataMasker } from './dataMasker';
import { fieldRecognizer } from './fieldRecognizer';
import { parseSemanticType } from './semanticParser';

/**
 * Execution record for a smart input
 */
export interface SmartInputRecord {
  fieldId: string;
  semanticType: SemanticType;
  generatedValue: unknown;
  maskedValue: string;
  timestamp: number;
  stepId?: string;
}

/**
 * Data generation syntax patterns
 * Note: Use Unicode property escapes for CJK character support
 */
const DATA_GEN_PATTERNS = {
  // [自动生成:类型] or [auto:type] - supports Chinese and English type names
  autoGenerate: /\[(?:自动生成|auto):([^\]]+)\]/i,
  // [模板:名称.字段] or [template:name.field]
  template: /\[(?:模板|template):([^\].]+)\.([^\]]+)\]/i,
  // [数据池:名称] or [pool:name]
  pool: /\[(?:数据池|pool):([^\]]+)\]/i,
  // [随机] or [random] - auto detect type
  random: /\[(?:随机|random)\]/i,
};

/**
 * Smart Input Executor class
 */
export class SmartInputExecutor {
  private records: SmartInputRecord[] = [];
  private options: GenerateOptions;

  constructor(options: GenerateOptions = {}) {
    this.options = {
      locale: 'zh-CN',
      applyMasking: true,
      ...options,
    };
  }

  /**
   * Parse step text for data generation syntax
   */
  parseStepText(stepText: string): {
    hasDataGenSyntax: boolean;
    type: 'autoGenerate' | 'template' | 'pool' | 'random' | null;
    semanticType?: SemanticType;
    templateName?: string;
    templateField?: string;
    poolName?: string;
  } {
    // Check auto generate
    const autoMatch = stepText.match(DATA_GEN_PATTERNS.autoGenerate);
    if (autoMatch) {
      return {
        hasDataGenSyntax: true,
        type: 'autoGenerate',
        semanticType: this.mapToSemanticType(autoMatch[1]),
      };
    }

    // Check template
    const templateMatch = stepText.match(DATA_GEN_PATTERNS.template);
    if (templateMatch) {
      return {
        hasDataGenSyntax: true,
        type: 'template',
        templateName: templateMatch[1],
        templateField: templateMatch[2],
      };
    }

    // Check pool
    const poolMatch = stepText.match(DATA_GEN_PATTERNS.pool);
    if (poolMatch) {
      return {
        hasDataGenSyntax: true,
        type: 'pool',
        poolName: poolMatch[1],
      };
    }

    // Check random
    if (DATA_GEN_PATTERNS.random.test(stepText)) {
      return {
        hasDataGenSyntax: true,
        type: 'random',
      };
    }

    return { hasDataGenSyntax: false, type: null };
  }

  /**
   * Map type string to SemanticType
   */
  private mapToSemanticType(typeStr: string): SemanticType {
    const typeMap: Record<string, SemanticType> = {
      // Chinese
      '手机号': 'mobile_phone',
      '手机': 'mobile_phone',
      '邮箱': 'email',
      '密码': 'password',
      '用户名': 'username',
      '姓名': 'realname',
      '身份证': 'id_card',
      '银行卡': 'bank_card',
      '地址': 'address',
      '邮编': 'postal_code',
      '城市': 'city',
      '公司': 'company',
      '职位': 'job_title',
      '金额': 'amount',
      '数量': 'quantity',
      '描述': 'description',
      '验证码': 'captcha',
      // English
      'mobile': 'mobile_phone',
      'phone': 'mobile_phone',
      'email': 'email',
      'password': 'password',
      'username': 'username',
      'name': 'realname',
      'realname': 'realname',
      'idcard': 'id_card',
      'id_card': 'id_card',
      'bankcard': 'bank_card',
      'bank_card': 'bank_card',
      'address': 'address',
      'postal': 'postal_code',
      'city': 'city',
      'company': 'company',
      'job': 'job_title',
      'amount': 'amount',
      'quantity': 'quantity',
      'description': 'description',
      'captcha': 'captcha',
      'url': 'url',
    };

    const normalized = typeStr.toLowerCase().replace(/[_\-\s]/g, '');
    return typeMap[normalized] || typeMap[typeStr] || 'custom';
  }

  /**
   * Generate value for a step
   */
  async generateForStep(
    stepText: string,
    targetLabel?: string,
    stepId?: string
  ): Promise<{
    value: unknown;
    maskedValue: string;
    semanticType: SemanticType;
  } | null> {
    const parsed = this.parseStepText(stepText);

    if (!parsed.hasDataGenSyntax) {
      return null;
    }

    let semanticType: SemanticType = 'custom';
    let value: unknown;

    switch (parsed.type) {
      case 'autoGenerate':
        semanticType = parsed.semanticType || 'custom';
        break;

      case 'random':
        // Try to infer from target label
        if (targetLabel) {
          semanticType = parseSemanticType(targetLabel);
        }
        break;

      case 'template':
      case 'pool':
        // Template and pool would need additional managers
        // For now, fall back to auto-generate based on field name
        if (parsed.templateField) {
          semanticType = parseSemanticType(parsed.templateField);
        }
        break;
    }

    // Create field definition
    const field: FieldDefinition = {
      id: stepId || `step_${Date.now()}`,
      name: targetLabel || 'field',
      label: targetLabel || 'field',
      fieldType: 'text',
      semanticType,
      constraints: { required: false },
      metadata: {},
    };

    // Generate value
    value = await dataGenerator.generate(field, this.options);

    // Mask value
    const maskedValue = dataMasker.mask(value, semanticType);

    // Record
    this.records.push({
      fieldId: field.id,
      semanticType,
      generatedValue: value,
      maskedValue,
      timestamp: Date.now(),
      stepId,
    });

    return { value, maskedValue, semanticType };
  }

  /**
   * Replace data generation syntax in step text with actual values
   */
  async processStepText(stepText: string): Promise<{
    processedText: string;
    generatedValues: Array<{ original: string; value: unknown; semanticType: SemanticType }>;
  }> {
    let processedText = stepText;
    const generatedValues: Array<{ original: string; value: unknown; semanticType: SemanticType }> = [];

    // Process auto-generate - use match() instead of exec() to avoid infinite loop
    let match = processedText.match(DATA_GEN_PATTERNS.autoGenerate);
    while (match !== null) {
      const original = match[0];
      const semanticType = this.mapToSemanticType(match[1]);
      const field: FieldDefinition = {
        id: `auto_${Date.now()}`,
        name: match[1],
        label: match[1],
        fieldType: 'text',
        semanticType,
        constraints: { required: false },
        metadata: {},
      };

      const value = await dataGenerator.generate(field, this.options);
      processedText = processedText.replace(original, String(value));
      generatedValues.push({ original, value, semanticType });

      // Check for more matches
      match = processedText.match(DATA_GEN_PATTERNS.autoGenerate);
    }

    // Process random
    match = processedText.match(DATA_GEN_PATTERNS.random);
    while (match !== null) {
      const original = match[0];
      // Default to description for random without context
      const semanticType: SemanticType = 'description';
      const field: FieldDefinition = {
        id: `random_${Date.now()}`,
        name: 'random',
        label: 'random',
        fieldType: 'text',
        semanticType,
        constraints: { required: false },
        metadata: {},
      };

      const value = await dataGenerator.generate(field, this.options);
      processedText = processedText.replace(original, String(value));
      generatedValues.push({ original, value, semanticType });

      // Check for more matches
      match = processedText.match(DATA_GEN_PATTERNS.random);
    }

    return { processedText, generatedValues };
  }

  /**
   * Get all records
   */
  getRecords(): SmartInputRecord[] {
    return [...this.records];
  }

  /**
   * Get records for a specific step
   */
  getRecordsForStep(stepId: string): SmartInputRecord[] {
    return this.records.filter((r) => r.stepId === stepId);
  }

  /**
   * Clear records
   */
  clearRecords(): void {
    this.records = [];
  }

  /**
   * Get masked records for reporting
   */
  getMaskedRecords(): Array<{ fieldId: string; semanticType: SemanticType; displayValue: string; timestamp: number }> {
    return this.records.map((r) => ({
      fieldId: r.fieldId,
      semanticType: r.semanticType,
      displayValue: r.maskedValue,
      timestamp: r.timestamp,
    }));
  }
}

/**
 * Default smart input executor instance
 */
export const smartInputExecutor = new SmartInputExecutor();
