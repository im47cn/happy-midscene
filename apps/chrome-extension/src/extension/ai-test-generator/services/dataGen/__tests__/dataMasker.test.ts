/**
 * Data Masker Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DataMasker, maskValue, isSensitiveType } from '../dataMasker';

describe('DataMasker', () => {
  let masker: DataMasker;

  beforeEach(() => {
    masker = new DataMasker();
  });

  describe('isSensitiveType', () => {
    it('should identify sensitive types', () => {
      expect(isSensitiveType('id_card')).toBe(true);
      expect(isSensitiveType('bank_card')).toBe(true);
      expect(isSensitiveType('mobile_phone')).toBe(true);
      expect(isSensitiveType('password')).toBe(true);
      expect(isSensitiveType('email')).toBe(true);
      expect(isSensitiveType('realname')).toBe(true);
      expect(isSensitiveType('address')).toBe(true);
    });

    it('should identify non-sensitive types', () => {
      expect(isSensitiveType('username')).toBe(false);
      expect(isSensitiveType('nickname')).toBe(false);
      expect(isSensitiveType('city')).toBe(false);
      expect(isSensitiveType('amount')).toBe(false);
    });
  });

  describe('maskValue', () => {
    it('should mask mobile phone number', () => {
      const masked = maskValue('13812345678', 'mobile_phone');
      expect(masked).toBe('138****5678');
    });

    it('should mask ID card number', () => {
      const masked = maskValue('110101199001011234', 'id_card');
      expect(masked).toBe('110101********1234');
    });

    it('should mask bank card number', () => {
      const masked = maskValue('6222021234567890123', 'bank_card');
      expect(masked).toBe('6222****0123');
    });

    it('should mask email address', () => {
      const masked = maskValue('testuser@example.com', 'email');
      expect(masked).toBe('t***@example.com');
    });

    it('should mask real name', () => {
      const masked = maskValue('张三', 'realname');
      expect(masked).toBe('张**');
    });

    it('should fully mask password', () => {
      const masked = maskValue('secret123', 'password');
      expect(masked).toBe('********');
    });

    it('should mask address', () => {
      const masked = maskValue('北京市朝阳区建国路100号', 'address');
      expect(masked).toBe('北京市朝阳区******');
    });

    it('should return as-is for non-sensitive types', () => {
      const masked = maskValue('testuser', 'username');
      expect(masked).toBe('testuser');
    });

    it('should handle null/undefined values', () => {
      expect(maskValue(null, 'mobile_phone')).toBe('');
      expect(maskValue(undefined, 'mobile_phone')).toBe('');
    });

    it('should handle numeric values', () => {
      const masked = maskValue(13812345678, 'mobile_phone');
      expect(masked).toBe('138****5678');
    });
  });

  describe('DataMasker class', () => {
    it('should mask single value', () => {
      const masked = masker.mask('13812345678', 'mobile_phone');
      expect(masked).toBe('138****5678');
    });

    it('should mask record with multiple fields', () => {
      const record = {
        name: '张三',
        phone: '13812345678',
        email: 'test@example.com',
        username: 'testuser',
      };

      const fieldTypes = {
        name: 'realname' as const,
        phone: 'mobile_phone' as const,
        email: 'email' as const,
        username: 'username' as const,
      };

      const masked = masker.maskRecord(record, fieldTypes);

      expect(masked.name).toBe('张**');
      expect(masked.phone).toBe('138****5678');
      expect(masked.email).toBe('t***@example.com');
      expect(masked.username).toBe('testuser'); // Not masked
    });

    it('should support custom masking rules', () => {
      masker.addRule({
        id: 'custom_phone',
        semanticType: 'mobile_phone',
        strategy: 'partial',
        pattern: '^(\\d{3})\\d{4}(\\d{4})$',
        replacement: '$1-****-$2',
      });

      const masked = masker.mask('13812345678', 'mobile_phone');
      expect(masked).toBe('138-****-5678');
    });

    it('should remove custom rules', () => {
      masker.addRule({
        id: 'custom_phone',
        semanticType: 'mobile_phone',
        strategy: 'full',
        pattern: '.*',
        replacement: '[HIDDEN]',
      });

      // Custom rule applied
      expect(masker.mask('13812345678', 'mobile_phone')).toBe('[HIDDEN]');

      // Remove custom rule
      masker.removeRule('mobile_phone');

      // Back to default
      expect(masker.mask('13812345678', 'mobile_phone')).toBe('138****5678');
    });

    it('should check if type is sensitive', () => {
      expect(masker.isSensitive('id_card')).toBe(true);
      expect(masker.isSensitive('username')).toBe(false);
    });

    it('should get all sensitive types', () => {
      const sensitiveTypes = masker.getSensitiveTypes();
      expect(sensitiveTypes).toContain('id_card');
      expect(sensitiveTypes).toContain('bank_card');
      expect(sensitiveTypes).toContain('mobile_phone');
    });
  });
});
