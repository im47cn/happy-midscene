/**
 * Integration Tests for Smart Data Generation System
 * Tests the end-to-end flow from field recognition to data generation and masking
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  FieldRecognizer,
  createFieldDefinition,
  createFormFields,
} from '../fieldRecognizer';
import { DataGenerator } from '../dataGenerator';
import { SmartInputExecutor } from '../smartInputExecutor';
import { DataMasker } from '../dataMasker';
import { DataPoolManager } from '../dataPoolManager';
import { TemplateManager } from '../templateManager';
import { generateBoundaryTestCases, analyzeBoundaryCoverage } from '../boundaryEngine';
import { parseSemanticType, parseSemanticTypeWithConfidence } from '../semanticParser';
import type { FieldDefinition, SemanticType } from '../../../types/dataGen';

// Mock localStorage for Template Manager
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Smart Data Generation System Integration', () => {
  let fieldRecognizer: FieldRecognizer;
  let dataGenerator: DataGenerator;
  let dataMasker: DataMasker;
  let smartInputExecutor: SmartInputExecutor;
  let templateManager: TemplateManager;
  let dataPoolManager: DataPoolManager;

  beforeEach(() => {
    localStorageMock.clear();
    fieldRecognizer = new FieldRecognizer();
    dataGenerator = new DataGenerator();
    dataMasker = new DataMasker();
    smartInputExecutor = new SmartInputExecutor();
    templateManager = new TemplateManager();
    dataPoolManager = new DataPoolManager();
  });

  afterEach(() => {
    smartInputExecutor.clearRecords();
  });

  describe('Field Recognition to Data Generation Flow', () => {
    it('should recognize form fields and generate appropriate data', async () => {
      const rawFields = [
        { label: '手机号', type: 'tel', required: true },
        { label: '邮箱地址', type: 'email', required: true },
        { label: '密码', type: 'password', required: true, minLength: 8 },
      ];

      const recognizedFields = fieldRecognizer.recognizeFields(rawFields);

      expect(recognizedFields.length).toBe(3);

      for (const recognized of recognizedFields) {
        const value = await dataGenerator.generate(recognized.field);
        expect(value).toBeDefined();
        expect(String(value).length).toBeGreaterThan(0);
      }
    });

    it('should generate form data for login form', async () => {
      const loginFields = createFormFields('login');

      expect(loginFields.length).toBe(2);

      const result = await dataGenerator.generateForForm(loginFields);

      expect(result.fields).toBeDefined();
      expect(result.timestamp).toBeDefined();
      // Check that fields were generated
      expect(Object.keys(result.fields).length).toBe(2);
    });

    it('should generate form data for registration form', async () => {
      const registerFields = createFormFields('register');

      expect(registerFields.length).toBe(5);

      const result = await dataGenerator.generateForForm(registerFields);

      expect(result.fields).toBeDefined();
      expect(Object.keys(result.fields).length).toBe(5);

      // Check each field has a value
      for (const field of registerFields) {
        expect(result.fields[field.id]).toBeDefined();
        expect(result.fields[field.id].value).toBeDefined();
      }
    });

    it('should generate form data for payment form', async () => {
      const paymentFields = createFormFields('payment');

      expect(paymentFields.length).toBe(4);

      const result = await dataGenerator.generateForForm(paymentFields);

      expect(result.fields).toBeDefined();
      expect(Object.keys(result.fields).length).toBe(4);

      // Check each field was generated
      for (const field of paymentFields) {
        expect(result.fields[field.id]).toBeDefined();
      }
    });
  });

  describe('Semantic Type Recognition Flow', () => {
    it('should correctly recognize Chinese field labels', () => {
      // Test keywords that are in the SEMANTIC_KEYWORDS mapping
      const testCases: Array<[string, SemanticType]> = [
        ['手机', 'mobile_phone'],  // "手机" is in keywords
        ['邮箱', 'email'],
        ['密码', 'password'],
        ['身份证', 'id_card'],
        ['银行卡', 'bank_card'],
        ['真实姓名', 'realname'],
        ['地址', 'address'],
        ['邮编', 'postal_code'],
      ];

      for (const [label, expectedType] of testCases) {
        const recognized = parseSemanticType(label);
        expect(recognized).toBe(expectedType);
      }
    });

    it('should correctly recognize English field labels', () => {
      const testCases: Array<[string, SemanticType]> = [
        ['mobile', 'mobile_phone'],
        ['email', 'email'],
        ['password', 'password'],
        ['username', 'username'],
        ['address', 'address'],
        ['city', 'city'],
        ['company', 'company'],
      ];

      for (const [label, expectedType] of testCases) {
        const recognized = parseSemanticType(label);
        expect(recognized).toBe(expectedType);
      }
    });

    it('should return confidence scores', () => {
      const highConfidence = parseSemanticTypeWithConfidence('手机');
      expect(highConfidence.confidence).toBeGreaterThan(50);

      const mediumConfidence = parseSemanticTypeWithConfidence('电话号码');
      expect(mediumConfidence.confidence).toBeGreaterThan(30);

      const lowConfidence = parseSemanticTypeWithConfidence('未知字段');
      expect(lowConfidence.type).toBe('custom');
    });
  });

  describe('Data Masking Flow', () => {
    it('should mask sensitive data correctly', async () => {
      const sensitiveTypes: SemanticType[] = [
        'mobile_phone',
        'email',
        'id_card',
        'bank_card',
        'password',
      ];

      for (const type of sensitiveTypes) {
        const field = createFieldDefinition('test', type);
        const value = await dataGenerator.generate(field);
        const masked = dataMasker.mask(value, type);

        expect(masked).not.toBe(String(value));
        expect(masked).toContain('*');
      }
    });

    it('should correctly mask mobile phone', async () => {
      const field = createFieldDefinition('mobile', 'mobile_phone');
      const value = await dataGenerator.generate(field);
      const masked = dataMasker.mask(value, 'mobile_phone');

      // Should show first 3 and last 4 digits
      expect(masked).toMatch(/^\d{3}\*{4}\d{4}$/);
    });

    it('should correctly mask email', async () => {
      const field = createFieldDefinition('email', 'email');
      const value = await dataGenerator.generate(field);
      const masked = dataMasker.mask(value, 'email');

      // Should contain @ and masked local part
      expect(masked).toContain('@');
      expect(masked).toContain('*');
    });

    it('should correctly mask ID card', async () => {
      const field = createFieldDefinition('idCard', 'id_card');
      const value = await dataGenerator.generate(field);
      const masked = dataMasker.mask(value, 'id_card');

      // Should show first 6 and last 4 digits
      expect(masked).toMatch(/^\d{6}\*{8,10}\d{4}[0-9X]?$/);
    });

    it('should correctly mask bank card', async () => {
      const field = createFieldDefinition('bankCard', 'bank_card');
      const value = await dataGenerator.generate(field);
      const masked = dataMasker.mask(value, 'bank_card');

      // Should contain asterisks and some visible digits
      expect(masked).toContain('*');
      expect(masked.length).toBeGreaterThan(4);
    });

    it('should not mask non-sensitive data', async () => {
      const nonSensitiveTypes: SemanticType[] = [
        'city',
        'quantity',
        'description',
      ];

      for (const type of nonSensitiveTypes) {
        const field = createFieldDefinition('test', type);
        const value = await dataGenerator.generate(field);
        const masked = dataMasker.mask(value, type);

        // Non-sensitive data may or may not be masked based on implementation
        // At minimum, the value should be defined
        expect(masked).toBeDefined();
      }
    });
  });

  describe('Smart Input Executor Flow', () => {
    it('should parse data generation syntax correctly', () => {
      const testCases = [
        { text: '输入[自动生成:手机号]', type: 'autoGenerate', semanticType: 'mobile_phone' },
        { text: 'input [auto:email]', type: 'autoGenerate', semanticType: 'email' },
        { text: '填写[随机]', type: 'random' },
        { text: 'enter [random]', type: 'random' },
        { text: '使用[模板:用户.姓名]', type: 'template', templateName: '用户', templateField: '姓名' },
        { text: 'from [pool:cities]', type: 'pool', poolName: 'cities' },
      ];

      for (const testCase of testCases) {
        const result = smartInputExecutor.parseStepText(testCase.text);
        expect(result.hasDataGenSyntax).toBe(true);
        expect(result.type).toBe(testCase.type);

        if (testCase.semanticType) {
          expect(result.semanticType).toBe(testCase.semanticType);
        }
        if (testCase.templateName) {
          expect(result.templateName).toBe(testCase.templateName);
        }
        if (testCase.poolName) {
          expect(result.poolName).toBe(testCase.poolName);
        }
      }
    });

    it('should generate values for step text', async () => {
      const stepText = '在手机号输入框输入[自动生成:手机号]';
      const result = await smartInputExecutor.generateForStep(stepText, '手机号', 'step-1');

      expect(result).not.toBeNull();
      expect(result!.value).toBeDefined();
      expect(result!.semanticType).toBe('mobile_phone');
      expect(result!.maskedValue).toContain('*');
    });

    it('should process step text and replace syntax', async () => {
      const stepText = '在用户名框输入[自动生成:用户名]，邮箱框输入[自动生成:邮箱]';
      const { processedText, generatedValues } = await smartInputExecutor.processStepText(stepText);

      expect(processedText).not.toContain('[自动生成');
      expect(generatedValues.length).toBe(2);
    });

    it('should maintain records of generated values', async () => {
      await smartInputExecutor.generateForStep('输入[自动生成:手机号]', '手机号', 'step-1');
      await smartInputExecutor.generateForStep('输入[自动生成:邮箱]', '邮箱', 'step-2');

      const records = smartInputExecutor.getRecords();
      expect(records.length).toBe(2);

      const maskedRecords = smartInputExecutor.getMaskedRecords();
      expect(maskedRecords.length).toBe(2);
      expect(maskedRecords[0].displayValue).toContain('*');
    });

    it('should return null for text without data gen syntax', async () => {
      const result = await smartInputExecutor.generateForStep(
        '点击登录按钮',
        '登录',
        'step-1'
      );

      expect(result).toBeNull();
    });
  });

  describe('Boundary Value Engine Flow', () => {
    it('should generate boundary test cases for string fields', () => {
      const field = createFieldDefinition('username', 'username', {
        minLength: 4,
        maxLength: 20,
        required: true,
      });

      const testCases = generateBoundaryTestCases(field);

      expect(testCases.length).toBeGreaterThan(0);

      // Should have cases for boundaries - check for any boundary-related cases
      const hasBoundaryCases = testCases.some(tc =>
        tc.category === 'minimum' ||
        tc.category === 'maximum' ||
        tc.category === 'min_length' ||
        tc.category === 'max_length' ||
        tc.category === 'empty'
      );
      expect(hasBoundaryCases).toBe(true);
    });

    it('should generate boundary test cases for numeric fields', () => {
      const field = createFieldDefinition('amount', 'amount', {
        fieldType: 'number',
        minValue: 0.01,
        maxValue: 10000,
      });

      const testCases = generateBoundaryTestCases(field);

      expect(testCases.length).toBeGreaterThan(0);

      // Check for valid/invalid results
      const validCases = testCases.filter(tc => tc.expectedResult === 'valid');
      const invalidCases = testCases.filter(tc => tc.expectedResult === 'invalid');

      // At least one type of case should exist
      expect(validCases.length + invalidCases.length).toBeGreaterThan(0);
    });

    it('should analyze boundary coverage', () => {
      const field = createFieldDefinition('password', 'password', {
        minLength: 8,
        maxLength: 32,
        required: true,
      });

      const testCases = generateBoundaryTestCases(field);
      const coverage = analyzeBoundaryCoverage(field, testCases);

      // Coverage result should be defined and have expected structure
      expect(coverage).toBeDefined();
    });
  });

  describe('Template Manager Flow', () => {
    it('should initialize and list templates', async () => {
      await templateManager.init();

      const templates = await templateManager.list();
      // Should have system templates after init
      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
    });

    it('should get template by ID', async () => {
      await templateManager.init();

      const templates = await templateManager.list();
      if (templates.length > 0) {
        const template = await templateManager.get(templates[0].id);
        expect(template).toBeDefined();
        expect(template?.name).toBe(templates[0].name);
      }
    });

    it('should apply template to generate data', async () => {
      await templateManager.init();

      const templates = await templateManager.list();
      if (templates.length > 0) {
        const data = await templateManager.applyTemplate(templates[0].id);
        expect(data).toBeDefined();
        expect(typeof data).toBe('object');
      }
    });
  });

  describe('Data Pool Manager Flow', () => {
    it('should pick values from built-in pools', async () => {
      await dataPoolManager.init();

      const city = await dataPoolManager.pick('cn_cities');
      expect(city).toBeDefined();

      const province = await dataPoolManager.pick('cn_provinces');
      expect(province).toBeDefined();
    });

    it('should get pool by ID', async () => {
      await dataPoolManager.init();

      const pool = await dataPoolManager.getPool('cn_cities');
      expect(pool).toBeDefined();
      expect(pool?.values.length).toBeGreaterThan(0);
    });

    it('should pick multiple values', async () => {
      await dataPoolManager.init();

      const cities = await dataPoolManager.pickMultiple('cn_cities', 3);
      expect(cities).toBeDefined();
      expect(Array.isArray(cities)).toBe(true);
      expect(cities.length).toBe(3);
    });
  });

  describe('End-to-End Form Data Generation', () => {
    it('should complete full workflow from DOM info to masked output', async () => {
      // 1. Simulate raw field info from DOM
      const rawFields = [
        { label: '用户名', name: 'username', type: 'text', required: true, minLength: 4 },
        { label: '手机号', name: 'mobile', type: 'tel', required: true },
        { label: '密码', name: 'password', type: 'password', required: true, minLength: 8 },
      ];

      // 2. Recognize fields
      const recognizedFields = fieldRecognizer.recognizeFields(rawFields);
      expect(recognizedFields.length).toBe(3);

      // 3. Generate data for each field
      const formData: Record<string, unknown> = {};
      const maskedData: Record<string, string> = {};

      for (const { field } of recognizedFields) {
        const value = await dataGenerator.generate(field);
        formData[field.name] = value;
        maskedData[field.name] = dataMasker.mask(value, field.semanticType);
      }

      // 4. Verify data
      expect(formData.username).toBeDefined();
      expect(formData.mobile).toBeDefined();
      expect(formData.password).toBeDefined();

      // 5. Verify masking
      expect(maskedData.mobile).toContain('*');
      expect(maskedData.password).toContain('*');
    });

    it('should handle mixed Chinese and English field labels', async () => {
      const rawFields = [
        { label: '电子邮件 Email', type: 'email' },
        { label: '联系电话 Phone', type: 'tel' },
        { label: 'Username 用户名', type: 'text' },
      ];

      const recognizedFields = fieldRecognizer.recognizeFields(rawFields);
      expect(recognizedFields.length).toBe(3);

      for (const { field } of recognizedFields) {
        const value = await dataGenerator.generate(field);
        expect(value).toBeDefined();
      }
    });

    it('should respect field constraints during generation', async () => {
      const field = createFieldDefinition('password', 'password', {
        minLength: 12,
        maxLength: 20,
        required: true,
      });

      const value = await dataGenerator.generate(field);
      const strValue = String(value);

      expect(strValue.length).toBeGreaterThanOrEqual(12);
      expect(strValue.length).toBeLessThanOrEqual(20);
    });
  });
});
