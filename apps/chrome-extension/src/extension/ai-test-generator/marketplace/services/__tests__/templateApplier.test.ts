/**
 * Template Applier Service Tests
 */

import { describe, expect, it } from 'vitest';
import type { ParameterDef, Template } from '../../types';
import { TemplateApplier } from '../templateApplier';

describe('TemplateApplier', () => {
  const applier = new TemplateApplier();

  describe('apply', () => {
    it('should replace single parameter', () => {
      const template = {
        content: {
          yaml: 'url: "${loginUrl}"',
          parameters: [],
        },
      } as Template;

      const result = applier.apply(template, {
        loginUrl: 'https://example.com',
      });
      expect(result).toBe('url: "https://example.com"');
    });

    it('should replace multiple parameters', () => {
      const template = {
        content: {
          yaml: 'username: "${user}"\npassword: "${pass}"',
          parameters: [],
        },
      } as Template;

      const result = applier.apply(template, { user: 'admin', pass: 'secret' });
      expect(result).toBe('username: "admin"\npassword: "secret"');
    });

    it('should replace same parameter multiple times', () => {
      const template = {
        content: {
          yaml: 'step1: "${action}"\nstep2: "${action}"',
          parameters: [],
        },
      } as Template;

      const result = applier.apply(template, { action: 'click' });
      expect(result).toBe('step1: "click"\nstep2: "click"');
    });

    it('should handle missing parameters by replacing with empty string', () => {
      const template = {
        content: {
          yaml: 'value: "${missing}"',
          parameters: [],
        },
      } as Template;

      const result = applier.apply(template, {});
      expect(result).toBe('value: ""');
    });
  });

  describe('validateParams', () => {
    it('should pass validation for valid required params', () => {
      const params: ParameterDef[] = [
        { name: 'url', label: 'URL', type: 'url', required: true },
      ];

      const result = applier.validateParams(params, {
        url: 'https://example.com',
      });
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should fail validation for missing required params', () => {
      const params: ParameterDef[] = [
        { name: 'url', label: 'URL', type: 'url', required: true },
      ];

      const result = applier.validateParams(params, {});
      expect(result.valid).toBe(false);
      expect(result.errors.url).toBeDefined();
    });

    it('should validate URL format', () => {
      const params: ParameterDef[] = [
        { name: 'url', label: 'URL', type: 'url', required: true },
      ];

      const result = applier.validateParams(params, { url: 'not-a-url' });
      expect(result.valid).toBe(false);
      expect(result.errors.url).toContain('valid URL');
    });

    it('should validate number min/max', () => {
      const params: ParameterDef[] = [
        {
          name: 'count',
          label: 'Count',
          type: 'number',
          required: true,
          validation: { min: 1, max: 10 },
        },
      ];

      const tooLow = applier.validateParams(params, { count: 0 });
      expect(tooLow.valid).toBe(false);

      const tooHigh = applier.validateParams(params, { count: 11 });
      expect(tooHigh.valid).toBe(false);

      const valid = applier.validateParams(params, { count: 5 });
      expect(valid.valid).toBe(true);
    });

    it('should validate string minLength/maxLength', () => {
      const params: ParameterDef[] = [
        {
          name: 'name',
          label: 'Name',
          type: 'string',
          required: true,
          validation: { minLength: 2, maxLength: 10 },
        },
      ];

      const tooShort = applier.validateParams(params, { name: 'a' });
      expect(tooShort.valid).toBe(false);

      const tooLong = applier.validateParams(params, {
        name: 'this is too long',
      });
      expect(tooLong.valid).toBe(false);

      const valid = applier.validateParams(params, { name: 'valid' });
      expect(valid.valid).toBe(true);
    });

    it('should skip validation for optional empty params', () => {
      const params: ParameterDef[] = [
        {
          name: 'optional',
          label: 'Optional',
          type: 'string',
          required: false,
        },
      ];

      const result = applier.validateParams(params, { optional: '' });
      expect(result.valid).toBe(true);
    });
  });

  describe('getDefaultParams', () => {
    it('should return specified defaults', () => {
      const params: ParameterDef[] = [
        {
          name: 'url',
          label: 'URL',
          type: 'string',
          required: true,
          default: 'https://default.com',
        },
        {
          name: 'count',
          label: 'Count',
          type: 'number',
          required: true,
          default: 5,
        },
      ];

      const result = applier.getDefaultParams(params);
      expect(result.url).toBe('https://default.com');
      expect(result.count).toBe(5);
    });

    it('should return type-appropriate empty defaults', () => {
      const params: ParameterDef[] = [
        { name: 'text', label: 'Text', type: 'string', required: false },
        { name: 'num', label: 'Num', type: 'number', required: false },
        { name: 'flag', label: 'Flag', type: 'boolean', required: false },
      ];

      const result = applier.getDefaultParams(params);
      expect(result.text).toBe('');
      expect(result.num).toBe(0);
      expect(result.flag).toBe(false);
    });
  });

  describe('extractParameters', () => {
    it('should extract parameter names from YAML', () => {
      const yaml =
        'url: "${loginUrl}"\nuser: "${username}"\npass: "${password}"';
      const params = applier.extractParameters(yaml);

      expect(params).toContain('loginUrl');
      expect(params).toContain('username');
      expect(params).toContain('password');
      expect(params).toHaveLength(3);
    });

    it('should not duplicate parameter names', () => {
      const yaml = 'first: "${param}"\nsecond: "${param}"';
      const params = applier.extractParameters(yaml);

      expect(params).toContain('param');
      expect(params).toHaveLength(1);
    });

    it('should return empty array for no parameters', () => {
      const yaml = 'url: "https://example.com"';
      const params = applier.extractParameters(yaml);

      expect(params).toHaveLength(0);
    });
  });

  describe('hasAllRequiredParams', () => {
    it('should return true when all required params are provided', () => {
      const params: ParameterDef[] = [
        { name: 'url', label: 'URL', type: 'string', required: true },
        {
          name: 'optional',
          label: 'Optional',
          type: 'string',
          required: false,
        },
      ];

      const result = applier.hasAllRequiredParams(params, {
        url: 'https://example.com',
      });
      expect(result).toBe(true);
    });

    it('should return false when required params are missing', () => {
      const params: ParameterDef[] = [
        { name: 'url', label: 'URL', type: 'string', required: true },
      ];

      const result = applier.hasAllRequiredParams(params, {});
      expect(result).toBe(false);
    });

    it('should return false for empty string values', () => {
      const params: ParameterDef[] = [
        { name: 'url', label: 'URL', type: 'string', required: true },
      ];

      const result = applier.hasAllRequiredParams(params, { url: '' });
      expect(result).toBe(false);
    });
  });
});
