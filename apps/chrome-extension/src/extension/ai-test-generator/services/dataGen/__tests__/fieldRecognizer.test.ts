/**
 * Field Recognizer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FieldRecognizer,
  fieldRecognizer,
  createFieldDefinition,
  createFormFields,
  type RawFieldInfo,
} from '../fieldRecognizer';

describe('FieldRecognizer', () => {
  let recognizer: FieldRecognizer;

  beforeEach(() => {
    recognizer = new FieldRecognizer();
  });

  describe('recognizeField', () => {
    it('should recognize username field', () => {
      const rawInfo: RawFieldInfo = {
        label: '用户名',
        name: 'username',
        type: 'text',
      };

      const result = recognizer.recognizeField(rawInfo);
      expect(result.field.semanticType).toBe('username');
      expect(result.confidence).toBeGreaterThan(50);
    });

    it('should recognize email field from type', () => {
      const rawInfo: RawFieldInfo = {
        type: 'email',
        placeholder: 'Enter your email',
      };

      const result = recognizer.recognizeField(rawInfo);
      expect(result.field.fieldType).toBe('email');
      expect(result.field.semanticType).toBe('email');
    });

    it('should recognize phone field from placeholder', () => {
      const rawInfo: RawFieldInfo = {
        placeholder: '请输入手机号',
      };

      const result = recognizer.recognizeField(rawInfo);
      expect(result.field.semanticType).toBe('mobile_phone');
    });

    it('should use aria-label as fallback', () => {
      const rawInfo: RawFieldInfo = {
        ariaLabel: '密码输入框',
      };

      const result = recognizer.recognizeField(rawInfo);
      expect(result.field.semanticType).toBe('password');
    });

    it('should extract constraints from raw info', () => {
      const rawInfo: RawFieldInfo = {
        label: '用户名',
        required: true,
        minLength: 4,
        maxLength: 20,
      };

      const result = recognizer.recognizeField(rawInfo);
      expect(result.field.constraints.required).toBe(true);
      expect(result.field.constraints.minLength).toBe(4);
      expect(result.field.constraints.maxLength).toBe(20);
    });

    it('should include options for select fields', () => {
      const rawInfo: RawFieldInfo = {
        label: '城市',
        type: 'select',
        options: ['北京', '上海', '广州'],
      };

      const result = recognizer.recognizeField(rawInfo);
      expect(result.field.constraints.options).toEqual(['北京', '上海', '广州']);
    });

    it('should generate ID if not provided', () => {
      const rawInfo: RawFieldInfo = {
        label: '测试字段',
      };

      const result = recognizer.recognizeField(rawInfo);
      expect(result.field.id).toMatch(/^field_\d+_[a-z0-9]+$/);
    });
  });

  describe('recognizeFields', () => {
    it('should recognize multiple fields', () => {
      const rawInfoList: RawFieldInfo[] = [
        { label: '用户名', name: 'username' },
        { label: '密码', name: 'password', type: 'password' },
        { label: '邮箱', name: 'email', type: 'email' },
      ];

      const results = recognizer.recognizeFields(rawInfoList);
      expect(results).toHaveLength(3);
      expect(results[0].field.semanticType).toBe('username');
      expect(results[1].field.semanticType).toBe('password');
      expect(results[2].field.semanticType).toBe('email');
    });

    it('should filter by confidence threshold', () => {
      recognizer.setOptions({ minConfidence: 80 });

      const rawInfoList: RawFieldInfo[] = [
        { label: '用户名' }, // High confidence
        { label: 'xyz123' }, // Low confidence
      ];

      const results = recognizer.recognizeFields(rawInfoList);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should sort by confidence descending', () => {
      const rawInfoList: RawFieldInfo[] = [
        { label: 'random' },
        { label: '用户名' },
        { label: 'unknown field' },
      ];

      const results = recognizer.recognizeFields(rawInfoList);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
      }
    });
  });

  describe('recognizeSemanticType', () => {
    it('should quickly recognize type from text', () => {
      expect(recognizer.recognizeSemanticType('手机号')).toBe('mobile_phone');
      expect(recognizer.recognizeSemanticType('email')).toBe('email');
      expect(recognizer.recognizeSemanticType('身份证号码')).toBe('id_card');
    });
  });

  describe('recognizeFieldType', () => {
    it('should recognize field type from HTML type', () => {
      expect(recognizer.recognizeFieldType('email')).toBe('email');
      expect(recognizer.recognizeFieldType('password')).toBe('password');
      expect(recognizer.recognizeFieldType('number')).toBe('number');
    });

    it('should infer from text when HTML type not provided', () => {
      expect(recognizer.recognizeFieldType(undefined, '详细描述')).toBe('textarea');
    });
  });

  describe('options', () => {
    it('should get and set options', () => {
      recognizer.setOptions({ locale: 'en-US', minConfidence: 50 });
      const options = recognizer.getOptions();
      expect(options.locale).toBe('en-US');
      expect(options.minConfidence).toBe(50);
    });
  });
});

describe('createFieldDefinition', () => {
  it('should create a basic field definition', () => {
    const field = createFieldDefinition('username', 'username');
    expect(field.name).toBe('username');
    expect(field.semanticType).toBe('username');
    expect(field.fieldType).toBe('text');
  });

  it('should accept options', () => {
    const field = createFieldDefinition('password', 'password', {
      label: '密码',
      fieldType: 'password',
      required: true,
      minLength: 8,
    });

    expect(field.label).toBe('密码');
    expect(field.fieldType).toBe('password');
    expect(field.constraints.required).toBe(true);
    expect(field.constraints.minLength).toBe(8);
  });
});

describe('createFormFields', () => {
  it('should create login form fields', () => {
    const fields = createFormFields('login');
    expect(fields).toHaveLength(2);
    expect(fields[0].semanticType).toBe('username');
    expect(fields[1].semanticType).toBe('password');
  });

  it('should create register form fields', () => {
    const fields = createFormFields('register');
    expect(fields).toHaveLength(5);
    expect(fields.map((f) => f.semanticType)).toContain('username');
    expect(fields.map((f) => f.semanticType)).toContain('email');
    expect(fields.map((f) => f.semanticType)).toContain('mobile_phone');
    expect(fields.map((f) => f.semanticType)).toContain('password');
  });

  it('should create profile form fields', () => {
    const fields = createFormFields('profile');
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.map((f) => f.semanticType)).toContain('realname');
    expect(fields.map((f) => f.semanticType)).toContain('id_card');
  });

  it('should create payment form fields', () => {
    const fields = createFormFields('payment');
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.map((f) => f.semanticType)).toContain('bank_card');
    expect(fields.map((f) => f.semanticType)).toContain('amount');
  });
});

describe('default fieldRecognizer instance', () => {
  it('should be exported and usable', () => {
    expect(fieldRecognizer).toBeInstanceOf(FieldRecognizer);
    const result = fieldRecognizer.recognizeField({ label: '邮箱' });
    expect(result.field.semanticType).toBe('email');
  });
});
