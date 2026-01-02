/**
 * Data Generators Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateMobilePhone,
  generateEmail,
  generateRealName,
  generateUsername,
  generateNickname,
  generatePassword,
  generateIdCard,
  generateBankCard,
  generatePostalCode,
  generateAddress,
  generateCity,
  generateProvince,
  generateDateOfBirth,
  generateAmount,
  generateQuantity,
  generateDescription,
  generateUrl,
  generateCompany,
  generateJobTitle,
  generateCaptcha,
  generateLandline,
  generateForSemanticType,
} from '../generators';

describe('Data Generators', () => {
  describe('generateMobilePhone', () => {
    it('should generate valid 11-digit phone number', () => {
      const phone = generateMobilePhone();
      expect(phone).toMatch(/^1[3-9]\d{9}$/);
    });

    it('should generate unique phone numbers', () => {
      const phones = new Set(Array.from({ length: 10 }, () => generateMobilePhone()));
      expect(phones.size).toBeGreaterThan(1);
    });
  });

  describe('generateEmail', () => {
    it('should generate valid email format', () => {
      const email = generateEmail();
      expect(email).toMatch(/^[a-z0-9]+@[a-z0-9.]+$/);
    });

    it('should respect custom domain constraint', () => {
      const email = generateEmail({ required: false, options: ['test.com'] });
      expect(email).toContain('@test.com');
    });
  });

  describe('generateRealName', () => {
    it('should generate Chinese name', () => {
      const name = generateRealName();
      expect(name.length).toBeGreaterThanOrEqual(2);
      expect(name.length).toBeLessThanOrEqual(4);
    });
  });

  describe('generateUsername', () => {
    it('should generate valid username', () => {
      const username = generateUsername();
      expect(username).toMatch(/^[a-z0-9_]+$/);
      expect(username.length).toBeGreaterThanOrEqual(6);
    });

    it('should respect length constraints', () => {
      const username = generateUsername({ required: false, minLength: 8, maxLength: 10 });
      expect(username.length).toBeGreaterThanOrEqual(8);
      expect(username.length).toBeLessThanOrEqual(10);
    });
  });

  describe('generateNickname', () => {
    it('should generate Chinese nickname', () => {
      const nickname = generateNickname();
      expect(nickname.length).toBeGreaterThan(0);
    });
  });

  describe('generatePassword', () => {
    it('should generate password with required complexity', () => {
      const password = generatePassword();
      expect(password.length).toBeGreaterThanOrEqual(8);
      expect(password).toMatch(/[A-Z]/); // Has uppercase
      expect(password).toMatch(/[a-z]/); // Has lowercase
      expect(password).toMatch(/[0-9]/); // Has digit
      expect(password).toMatch(/[@#$%&*!]/); // Has special char
    });

    it('should respect length constraints', () => {
      const password = generatePassword({ required: false, minLength: 12, maxLength: 16 });
      expect(password.length).toBeGreaterThanOrEqual(12);
      expect(password.length).toBeLessThanOrEqual(16);
    });
  });

  describe('generateIdCard', () => {
    it('should generate 18-digit ID card', () => {
      const idCard = generateIdCard();
      expect(idCard).toMatch(/^\d{17}[\dX]$/);
    });

    it('should have valid province code', () => {
      const idCard = generateIdCard();
      const provinceCode = idCard.substring(0, 2);
      const validPrefixes = ['11', '12', '13', '14', '15', '21', '22', '23', '31', '32', '33', '34', '35', '36', '37', '41', '42', '43', '44', '45', '46', '50', '51', '52', '53', '54', '61', '62', '63', '64', '65'];
      expect(validPrefixes).toContain(provinceCode);
    });
  });

  describe('generateBankCard', () => {
    it('should generate valid bank card with Luhn checksum', () => {
      const card = generateBankCard();
      expect(card.length).toBeGreaterThanOrEqual(16);
      expect(card.length).toBeLessThanOrEqual(19);
      expect(card).toMatch(/^\d+$/);
    });
  });

  describe('generatePostalCode', () => {
    it('should generate 6-digit postal code', () => {
      const code = generatePostalCode();
      expect(code).toMatch(/^[1-8]\d{5}$/);
    });
  });

  describe('generateAddress', () => {
    it('should generate complete Chinese address', () => {
      const address = generateAddress();
      expect(address).toContain('市');
      expect(address).toContain('区');
      expect(address).toContain('号');
    });
  });

  describe('generateCity', () => {
    it('should generate Chinese city name', () => {
      const city = generateCity();
      expect(city).toContain('市');
    });
  });

  describe('generateProvince', () => {
    it('should generate Chinese province name', () => {
      const province = generateProvince();
      expect(province.length).toBeGreaterThan(0);
    });
  });

  describe('generateDateOfBirth', () => {
    it('should generate valid date format', () => {
      const date = generateDateOfBirth();
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should generate reasonable age', () => {
      const date = generateDateOfBirth();
      const year = parseInt(date.split('-')[0], 10);
      expect(year).toBeGreaterThanOrEqual(1960);
      expect(year).toBeLessThanOrEqual(2005);
    });
  });

  describe('generateAmount', () => {
    it('should generate positive number with 2 decimals', () => {
      const amount = generateAmount();
      expect(amount).toBeGreaterThan(0);
      const decimalPlaces = (amount.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should respect value constraints', () => {
      const amount = generateAmount({ required: false, minValue: 100, maxValue: 200 });
      expect(amount).toBeGreaterThanOrEqual(100);
      expect(amount).toBeLessThanOrEqual(200);
    });
  });

  describe('generateQuantity', () => {
    it('should generate positive integer', () => {
      const qty = generateQuantity();
      expect(Number.isInteger(qty)).toBe(true);
      expect(qty).toBeGreaterThanOrEqual(1);
    });

    it('should respect value constraints', () => {
      const qty = generateQuantity({ required: false, minValue: 5, maxValue: 10 });
      expect(qty).toBeGreaterThanOrEqual(5);
      expect(qty).toBeLessThanOrEqual(10);
    });
  });

  describe('generateDescription', () => {
    it('should generate Chinese description', () => {
      const desc = generateDescription();
      expect(desc.length).toBeGreaterThan(0);
    });

    it('should respect maxLength constraint', () => {
      const desc = generateDescription({ required: false, maxLength: 10 });
      expect(desc.length).toBeLessThanOrEqual(10);
    });
  });

  describe('generateUrl', () => {
    it('should generate valid URL format', () => {
      const url = generateUrl();
      expect(url).toMatch(/^https?:\/\//);
    });
  });

  describe('generateCompany', () => {
    it('should generate company name with suffix', () => {
      const company = generateCompany();
      expect(company).toMatch(/公司$/);
    });
  });

  describe('generateJobTitle', () => {
    it('should generate job title', () => {
      const title = generateJobTitle();
      expect(title.length).toBeGreaterThan(0);
    });
  });

  describe('generateCaptcha', () => {
    it('should generate alphanumeric captcha', () => {
      const captcha = generateCaptcha();
      expect(captcha).toMatch(/^[A-Z0-9]+$/);
      expect(captcha.length).toBe(6);
    });

    it('should respect maxLength constraint', () => {
      const captcha = generateCaptcha({ required: false, maxLength: 4 });
      expect(captcha.length).toBe(4);
    });
  });

  describe('generateLandline', () => {
    it('should generate landline with area code', () => {
      const landline = generateLandline();
      expect(landline).toMatch(/^\d{3,4}-\d{7,8}$/);
    });
  });

  describe('generateForSemanticType', () => {
    it('should generate data for all semantic types', () => {
      const types = [
        'username', 'realname', 'nickname', 'email', 'mobile_phone',
        'landline', 'password', 'captcha', 'id_card', 'bank_card',
        'address', 'postal_code', 'city', 'province', 'country',
        'date_of_birth', 'amount', 'quantity', 'description', 'url',
        'company', 'job_title',
      ] as const;

      for (const type of types) {
        const value = generateForSemanticType(type);
        expect(value).toBeDefined();
      }
    });

    it('should throw for unknown semantic type', () => {
      expect(() => generateForSemanticType('unknown' as any)).toThrow();
    });
  });
});
