/**
 * Boundary Engine Tests
 */

import { describe, it, expect } from 'vitest';
import { generateBoundaryTestCases, analyzeBoundaryCoverage } from '../boundaryEngine';
import type { FieldDefinition } from '../../../types/dataGen';

describe('BoundaryEngine', () => {
  const createField = (overrides: Partial<FieldDefinition> = {}): FieldDefinition => ({
    id: 'test-field',
    name: 'testField',
    label: 'Test Field',
    fieldType: 'text',
    semanticType: 'username',
    constraints: {
      required: true,
    },
    metadata: {},
    ...overrides,
  });

  describe('generateBoundaryTestCases', () => {
    it('should generate empty value test case for required field', () => {
      const field = createField({ constraints: { required: true } });
      const cases = generateBoundaryTestCases(field);

      const emptyCase = cases.find(c => c.category === 'empty');
      expect(emptyCase).toBeDefined();
      expect(emptyCase?.expectedResult).toBe('invalid');
    });

    it('should generate valid empty case for optional field', () => {
      const field = createField({ constraints: { required: false } });
      const cases = generateBoundaryTestCases(field);

      const emptyCase = cases.find(c => c.category === 'empty');
      expect(emptyCase).toBeDefined();
      expect(emptyCase?.expectedResult).toBe('valid');
    });

    it('should generate length boundary cases', () => {
      const field = createField({
        constraints: { required: true, minLength: 3, maxLength: 10 },
      });
      const cases = generateBoundaryTestCases(field);

      // Should have min, max, boundary-1, boundary+1 cases
      expect(cases.some(c => c.category === 'min')).toBe(true);
      expect(cases.some(c => c.category === 'max')).toBe(true);
      expect(cases.some(c => c.category === 'boundary-1')).toBe(true);
      expect(cases.some(c => c.category === 'boundary+1')).toBe(true);
    });

    it('should generate value boundary cases for numeric fields', () => {
      const field = createField({
        fieldType: 'number',
        semanticType: 'quantity',
        constraints: { required: true, minValue: 1, maxValue: 100 },
      });
      const cases = generateBoundaryTestCases(field);

      const minCase = cases.find(c => c.name.includes('最小值'));
      expect(minCase).toBeDefined();
      expect(minCase?.value).toBe(1);
      expect(minCase?.expectedResult).toBe('valid');

      const maxCase = cases.find(c => c.name.includes('最大值'));
      expect(maxCase).toBeDefined();
      expect(maxCase?.value).toBe(100);
      expect(maxCase?.expectedResult).toBe('valid');

      const belowMinCase = cases.find(c => c.name.includes('低于最小值'));
      expect(belowMinCase).toBeDefined();
      expect(belowMinCase?.value).toBe(0);
      expect(belowMinCase?.expectedResult).toBe('invalid');
    });

    it('should generate special cases for email field', () => {
      const field = createField({
        fieldType: 'email',
        semanticType: 'email',
        constraints: { required: true },
      });
      const cases = generateBoundaryTestCases(field);

      expect(cases.some(c => c.name.includes('无效邮箱格式'))).toBe(true);
      expect(cases.some(c => c.name.includes('邮箱缺少域名'))).toBe(true);
    });

    it('should generate special cases for mobile phone field', () => {
      const field = createField({
        fieldType: 'phone',
        semanticType: 'mobile_phone',
        constraints: { required: true },
      });
      const cases = generateBoundaryTestCases(field);

      expect(cases.some(c => c.name.includes('无效手机号前缀'))).toBe(true);
      expect(cases.some(c => c.name.includes('手机号位数不足'))).toBe(true);
    });

    it('should generate special cases for ID card field', () => {
      const field = createField({
        semanticType: 'id_card',
        constraints: { required: true },
      });
      const cases = generateBoundaryTestCases(field);

      expect(cases.some(c => c.name.includes('身份证位数不足'))).toBe(true);
      expect(cases.some(c => c.name.includes('身份证校验位错误'))).toBe(true);
    });

    it('should generate special cases for password field', () => {
      const field = createField({
        fieldType: 'password',
        semanticType: 'password',
        constraints: { required: true },
      });
      const cases = generateBoundaryTestCases(field);

      expect(cases.some(c => c.name.includes('纯数字密码'))).toBe(true);
      expect(cases.some(c => c.name.includes('弱密码'))).toBe(true);
    });

    it('should generate SQL injection test case', () => {
      const field = createField();
      const cases = generateBoundaryTestCases(field);

      const sqlCase = cases.find(c => c.name.includes('SQL注入'));
      expect(sqlCase).toBeDefined();
      expect(sqlCase?.expectedResult).toBe('invalid');
    });

    it('should generate XSS test case', () => {
      const field = createField();
      const cases = generateBoundaryTestCases(field);

      const xssCase = cases.find(c => c.name.includes('XSS'));
      expect(xssCase).toBeDefined();
      expect(xssCase?.expectedResult).toBe('invalid');
    });

    it('should generate whitespace test case', () => {
      const field = createField();
      const cases = generateBoundaryTestCases(field);

      const spaceCase = cases.find(c => c.name.includes('仅空格'));
      expect(spaceCase).toBeDefined();
    });

    it('should generate Unicode test case', () => {
      const field = createField();
      const cases = generateBoundaryTestCases(field);

      const unicodeCase = cases.find(c => c.name.includes('Unicode'));
      expect(unicodeCase).toBeDefined();
      expect(unicodeCase?.expectedResult).toBe('valid');
    });
  });

  describe('analyzeBoundaryCoverage', () => {
    it('should analyze boundary coverage correctly', () => {
      const field = createField({
        constraints: { required: true, minLength: 3, maxLength: 10 },
      });
      const cases = generateBoundaryTestCases(field);
      const coverage = analyzeBoundaryCoverage(field, cases);

      expect(coverage.totalCases).toBe(cases.length);
      expect(coverage.validCases + coverage.invalidCases).toBe(coverage.totalCases);
      expect(Object.keys(coverage.categories).length).toBeGreaterThan(0);
    });

    it('should count categories correctly', () => {
      const field = createField({
        constraints: { required: true, minLength: 5, maxLength: 20 },
      });
      const cases = generateBoundaryTestCases(field);
      const coverage = analyzeBoundaryCoverage(field, cases);

      expect(coverage.categories['min']).toBeDefined();
      expect(coverage.categories['max']).toBeDefined();
      expect(coverage.categories['special']).toBeDefined();
    });
  });
});
