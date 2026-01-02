/**
 * Smart Input Executor Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SmartInputExecutor, smartInputExecutor } from '../smartInputExecutor';

describe('SmartInputExecutor', () => {
  let executor: SmartInputExecutor;

  beforeEach(() => {
    executor = new SmartInputExecutor();
  });

  describe('parseStepText', () => {
    it('should parse auto-generate syntax (Chinese)', () => {
      const result = executor.parseStepText('在用户名输入框中填写[自动生成:手机]');
      expect(result.hasDataGenSyntax).toBe(true);
      expect(result.type).toBe('autoGenerate');
      expect(result.semanticType).toBe('mobile_phone');
    });

    it('should parse auto-generate syntax (English)', () => {
      const result = executor.parseStepText('Fill [auto:email] in the input');
      expect(result.hasDataGenSyntax).toBe(true);
      expect(result.type).toBe('autoGenerate');
      expect(result.semanticType).toBe('email');
    });

    it('should parse template syntax (Chinese)', () => {
      const result = executor.parseStepText('填写[模板:用户.姓名]');
      expect(result.hasDataGenSyntax).toBe(true);
      expect(result.type).toBe('template');
      expect(result.templateName).toBe('用户');
      expect(result.templateField).toBe('姓名');
    });

    it('should parse template syntax (English)', () => {
      const result = executor.parseStepText('Enter [template:user.email]');
      expect(result.hasDataGenSyntax).toBe(true);
      expect(result.type).toBe('template');
      expect(result.templateName).toBe('user');
      expect(result.templateField).toBe('email');
    });

    it('should parse pool syntax (Chinese)', () => {
      const result = executor.parseStepText('选择[数据池:城市]');
      expect(result.hasDataGenSyntax).toBe(true);
      expect(result.type).toBe('pool');
      expect(result.poolName).toBe('城市');
    });

    it('should parse pool syntax (English)', () => {
      const result = executor.parseStepText('Select [pool:cities]');
      expect(result.hasDataGenSyntax).toBe(true);
      expect(result.type).toBe('pool');
      expect(result.poolName).toBe('cities');
    });

    it('should parse random syntax (Chinese)', () => {
      const result = executor.parseStepText('填写[随机]内容');
      expect(result.hasDataGenSyntax).toBe(true);
      expect(result.type).toBe('random');
    });

    it('should parse random syntax (English)', () => {
      const result = executor.parseStepText('Enter [random] value');
      expect(result.hasDataGenSyntax).toBe(true);
      expect(result.type).toBe('random');
    });

    it('should return no syntax for plain text', () => {
      const result = executor.parseStepText('点击登录按钮');
      expect(result.hasDataGenSyntax).toBe(false);
      expect(result.type).toBeNull();
    });
  });

  describe('generateForStep', () => {
    it('should generate value for auto-generate syntax', async () => {
      const result = await executor.generateForStep(
        '输入[自动生成:手机]',
        '手机号',
        'step_1'
      );

      expect(result).not.toBeNull();
      expect(result?.semanticType).toBe('mobile_phone');
      expect(String(result?.value)).toMatch(/^1\d{10}$/);
    });

    it('should generate value for email', async () => {
      const result = await executor.generateForStep(
        'Enter [auto:email]',
        'Email',
        'step_2'
      );

      expect(result).not.toBeNull();
      expect(result?.semanticType).toBe('email');
      expect(String(result?.value)).toContain('@');
    });

    it('should generate value for random with label inference', async () => {
      const result = await executor.generateForStep(
        '填写[随机]',
        '用户名',
        'step_3'
      );

      expect(result).not.toBeNull();
      expect(result?.semanticType).toBe('username');
    });

    it('should return null for non-syntax text', async () => {
      const result = await executor.generateForStep(
        '点击提交按钮',
        '提交',
        'step_4'
      );

      expect(result).toBeNull();
    });

    it('should record generated values', async () => {
      await executor.generateForStep('[自动生成:email]', '邮箱', 'step_5');
      await executor.generateForStep('[自动生成:password]', '密码', 'step_6');

      const records = executor.getRecords();
      expect(records).toHaveLength(2);
      expect(records[0].semanticType).toBe('email');
      expect(records[1].semanticType).toBe('password');
    });
  });

  describe('processStepText', () => {
    it('should replace single syntax with generated value', async () => {
      const result = await executor.processStepText('输入[自动生成:mobile]作为联系方式');

      expect(result.processedText).not.toContain('[自动生成:mobile]');
      expect(result.processedText).toMatch(/输入1\d{10}作为联系方式/);
      expect(result.generatedValues).toHaveLength(1);
      expect(result.generatedValues[0].semanticType).toBe('mobile_phone');
    });

    it('should replace multiple syntaxes', async () => {
      const result = await executor.processStepText(
        '用户名[自动生成:username]和邮箱[自动生成:email]'
      );

      expect(result.processedText).not.toContain('[自动生成:');
      expect(result.generatedValues).toHaveLength(2);
    });

    it('should handle text without syntax', async () => {
      const result = await executor.processStepText('点击确认按钮');

      expect(result.processedText).toBe('点击确认按钮');
      expect(result.generatedValues).toHaveLength(0);
    });

    it('should process random syntax', async () => {
      const result = await executor.processStepText('输入[随机]内容');

      expect(result.processedText).not.toContain('[随机]');
      expect(result.generatedValues).toHaveLength(1);
    });
  });

  describe('records management', () => {
    it('should get records for specific step', async () => {
      await executor.generateForStep('[自动生成:mobile]', '手机', 'step_a');
      await executor.generateForStep('[自动生成:email]', '邮箱', 'step_b');
      await executor.generateForStep('[自动生成:username]', '用户名', 'step_a');

      const stepARecords = executor.getRecordsForStep('step_a');
      expect(stepARecords).toHaveLength(2);
    });

    it('should clear records', async () => {
      await executor.generateForStep('[自动生成:mobile]', '手机', 'step_1');
      expect(executor.getRecords()).toHaveLength(1);

      executor.clearRecords();
      expect(executor.getRecords()).toHaveLength(0);
    });

    it('should get masked records for reporting', async () => {
      await executor.generateForStep('[自动生成:mobile]', '手机', 'step_1');

      const maskedRecords = executor.getMaskedRecords();
      expect(maskedRecords).toHaveLength(1);
      expect(maskedRecords[0].displayValue).toMatch(/\d{3}\*{4}\d{4}/);
      expect(maskedRecords[0]).not.toHaveProperty('generatedValue');
    });
  });

  describe('options', () => {
    it('should apply locale option', async () => {
      const cnExecutor = new SmartInputExecutor({ locale: 'zh-CN' });
      const result = await cnExecutor.generateForStep('[auto:realname]', '姓名', 'step_1');

      expect(result).not.toBeNull();
      // Chinese names are typically 2-4 characters
      expect(String(result?.value).length).toBeLessThanOrEqual(4);
    });

    it('should apply masking option', async () => {
      const noMaskExecutor = new SmartInputExecutor({ applyMasking: false });
      await noMaskExecutor.generateForStep('[自动生成:mobile]', '手机', 'step_1');

      // Even with applyMasking: false, maskedValue should still be generated
      // (the option controls whether masking is applied in the result)
      const records = noMaskExecutor.getRecords();
      expect(records[0].maskedValue).toBeDefined();
    });
  });
});

describe('default smartInputExecutor instance', () => {
  it('should be exported and usable', () => {
    expect(smartInputExecutor).toBeInstanceOf(SmartInputExecutor);

    const result = smartInputExecutor.parseStepText('[自动生成:email]');
    expect(result.hasDataGenSyntax).toBe(true);
    expect(result.semanticType).toBe('email');
  });
});
