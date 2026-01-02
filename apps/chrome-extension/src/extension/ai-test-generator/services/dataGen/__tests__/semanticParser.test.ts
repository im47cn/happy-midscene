/**
 * Semantic Parser Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseSemanticType,
  parseSemanticTypeWithConfidence,
  parseFieldType,
  extractConstraints,
  getSemanticKeywords,
  addSemanticKeywords,
} from '../semanticParser';

describe('SemanticParser', () => {
  describe('parseSemanticType', () => {
    it('should recognize Chinese keywords', () => {
      expect(parseSemanticType('用户名')).toBe('username');
      expect(parseSemanticType('手机号')).toBe('mobile_phone');
      expect(parseSemanticType('邮箱')).toBe('email');
      expect(parseSemanticType('密码')).toBe('password');
      expect(parseSemanticType('姓名')).toBe('realname');
      expect(parseSemanticType('身份证')).toBe('id_card');
      expect(parseSemanticType('银行卡')).toBe('bank_card');
      expect(parseSemanticType('地址')).toBe('address');
      expect(parseSemanticType('邮编')).toBe('postal_code');
      expect(parseSemanticType('城市')).toBe('city');
      expect(parseSemanticType('公司')).toBe('company');
      expect(parseSemanticType('职位')).toBe('job_title');
    });

    it('should recognize English keywords', () => {
      expect(parseSemanticType('username')).toBe('username');
      expect(parseSemanticType('mobile')).toBe('mobile_phone');
      expect(parseSemanticType('email')).toBe('email');
      expect(parseSemanticType('password')).toBe('password');
      expect(parseSemanticType('name')).toBe('realname');
      expect(parseSemanticType('id card')).toBe('id_card');
      expect(parseSemanticType('bank card')).toBe('bank_card');
      expect(parseSemanticType('address')).toBe('address');
    });

    it('should handle mixed case', () => {
      expect(parseSemanticType('UserName')).toBe('username');
      expect(parseSemanticType('EMAIL')).toBe('email');
      expect(parseSemanticType('PhoneNumber')).toBe('mobile_phone');
    });

    it('should handle labels with extra text', () => {
      expect(parseSemanticType('请输入用户名')).toBe('username');
      expect(parseSemanticType('Enter your email')).toBe('email');
      expect(parseSemanticType('联系电话号码')).toBe('mobile_phone');
    });

    it('should return custom for unknown types', () => {
      expect(parseSemanticType('unknown field')).toBe('custom');
      expect(parseSemanticType('xyz123')).toBe('custom');
    });

    it('should handle empty/null input', () => {
      expect(parseSemanticType('')).toBe('custom');
      expect(parseSemanticType(undefined as unknown as string)).toBe('custom');
    });
  });

  describe('parseSemanticTypeWithConfidence', () => {
    it('should return high confidence for exact matches', () => {
      const result = parseSemanticTypeWithConfidence('用户名');
      expect(result.type).toBe('username');
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it('should return lower confidence for partial matches', () => {
      const result = parseSemanticTypeWithConfidence('请输入您的用户名称');
      expect(result.type).toBe('username');
      expect(result.confidence).toBeLessThan(100);
    });

    it('should use placeholder as fallback', () => {
      const result = parseSemanticTypeWithConfidence('输入框', '请输入手机号');
      expect(result.type).toBe('mobile_phone');
    });

    it('should prioritize label over placeholder', () => {
      const result = parseSemanticTypeWithConfidence('用户名', '请输入邮箱');
      expect(result.type).toBe('username');
    });

    it('should return low confidence for unknown types', () => {
      const result = parseSemanticTypeWithConfidence('unknown');
      expect(result.type).toBe('custom');
      expect(result.confidence).toBeLessThan(50);
    });
  });

  describe('parseFieldType', () => {
    it('should recognize HTML input types', () => {
      expect(parseFieldType('email')).toBe('email');
      expect(parseFieldType('password')).toBe('password');
      expect(parseFieldType('number')).toBe('number');
      expect(parseFieldType('tel')).toBe('phone');
      expect(parseFieldType('date')).toBe('date');
      expect(parseFieldType('checkbox')).toBe('checkbox');
      expect(parseFieldType('radio')).toBe('radio');
      expect(parseFieldType('file')).toBe('file');
    });

    it('should infer from label text', () => {
      expect(parseFieldType(undefined, '描述信息')).toBe('textarea');
      expect(parseFieldType(undefined, '密码')).toBe('password');
      expect(parseFieldType(undefined, '选择日期')).toBe('date');
    });

    it('should infer from placeholder', () => {
      expect(parseFieldType(undefined, undefined, '请输入邮箱')).toBe('email');
      expect(parseFieldType(undefined, undefined, 'Enter password')).toBe('password');
    });

    it('should default to text for unknown types', () => {
      expect(parseFieldType('unknown')).toBe('text');
      expect(parseFieldType(undefined, 'something')).toBe('text');
    });
  });

  describe('extractConstraints', () => {
    it('should extract required from asterisk', () => {
      const constraints = extractConstraints('*用户名');
      expect(constraints.required).toBe(true);
    });

    it('should extract required from text', () => {
      const constraints = extractConstraints('姓名（必填）');
      expect(constraints.required).toBe(true);
    });

    it('should extract required from English keyword', () => {
      const constraints = extractConstraints('Username (required)');
      expect(constraints.required).toBe(true);
    });

    it('should merge with existing attributes', () => {
      const constraints = extractConstraints('用户名', {
        required: true,
        minLength: 6,
        maxLength: 20,
        min: 0,
        max: 100,
      });
      expect(constraints.required).toBe(true);
      expect(constraints.minLength).toBe(6);
      expect(constraints.maxLength).toBe(20);
      expect(constraints.minValue).toBe(0);
      expect(constraints.maxValue).toBe(100);
    });

    it('should handle empty text', () => {
      const constraints = extractConstraints('');
      expect(constraints).toEqual({ required: false });
    });

    it('should preserve pattern from attributes', () => {
      const constraints = extractConstraints('邮箱', {
        pattern: '^[a-z]+@[a-z]+\\.[a-z]+$',
      });
      expect(constraints.pattern).toBe('^[a-z]+@[a-z]+\\.[a-z]+$');
    });
  });

  describe('getSemanticKeywords', () => {
    it('should return keywords for a type', () => {
      const keywords = getSemanticKeywords('username');
      expect(keywords).toContain('用户名');
      expect(keywords).toContain('username');
    });

    it('should return empty array for unknown type', () => {
      const keywords = getSemanticKeywords('nonexistent' as any);
      expect(keywords).toEqual([]);
    });
  });

  describe('addSemanticKeywords', () => {
    it('should add new keywords', () => {
      addSemanticKeywords('username', ['test_keyword_unique']);
      const keywords = getSemanticKeywords('username');
      expect(keywords).toContain('test_keyword_unique');
    });

    it('should recognize newly added keywords', () => {
      addSemanticKeywords('email', ['custom_email_field']);
      expect(parseSemanticType('custom_email_field')).toBe('email');
    });
  });
});
