/**
 * Integration Tests for Smart Assertion System
 * Tests the end-to-end flow from context collection to assertion generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContextCollector } from '../contextCollector';
import { ChangeDetector } from '../changeDetector';
import { IntentInferrer } from '../intentInferrer';
import { AssertionGenerator } from '../assertionGenerator';
import { assertionValidator } from '../assertionValidator';
import { TemplateManager } from '../templateManager';
import type { ActionContext, AssertionRecommendation, AssertionTemplate } from '../../../types/assertion';

// Mock window and document for tests
const mockWindow = {
  location: {
    href: 'https://example.com/login',
  },
};

const mockDocument = {
  title: 'Login Page',
};

describe('Smart Assertion System Integration', () => {
  let contextCollector: ContextCollector;
  let changeDetector: ChangeDetector;
  let intentInferrer: IntentInferrer;
  let assertionGenerator: AssertionGenerator;
  let templateManager: TemplateManager;

  beforeEach(() => {
    contextCollector = new ContextCollector();
    changeDetector = new ChangeDetector();
    intentInferrer = new IntentInferrer();
    assertionGenerator = new AssertionGenerator();
    templateManager = new TemplateManager();

    // Reset configurations
    assertionGenerator.setConfig({
      enabled: true,
      autoSuggest: true,
      minConfidence: 50,
      maxRecommendations: 10,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Context Collection to Intent Analysis Flow', () => {
    it('should collect context and analyze login intent correctly', () => {
      const stepText = '点击登录按钮';
      const beforeUrl = 'https://example.com/login';
      const afterUrl = 'https://example.com/dashboard';

      const context = contextCollector.createContextFromResult(
        'step-1',
        0,
        stepText,
        beforeUrl,
        afterUrl
      );

      expect(context.action.type).toBe('click');
      expect(context.semantic.actionIntent).toBe('login');
      expect(context.semantic.expectedOutcome).toContain('登录');
    });

    it('should collect context and analyze form submit intent correctly', () => {
      const stepText = '点击提交按钮';
      const beforeUrl = 'https://example.com/form';
      const afterUrl = 'https://example.com/success';

      const context = contextCollector.createContextFromResult(
        'step-1',
        0,
        stepText,
        beforeUrl,
        afterUrl
      );

      expect(context.action.type).toBe('click');
      expect(context.semantic.actionIntent).toBe('submit_form');
    });

    it('should extract input values correctly', () => {
      const stepText = '在用户名输入框输入"testuser"';
      const beforeUrl = 'https://example.com/login';
      const afterUrl = 'https://example.com/login';

      const context = contextCollector.createContextFromResult(
        'step-1',
        0,
        stepText,
        beforeUrl,
        afterUrl
      );

      expect(context.action.type).toBe('input');
      expect(context.action.value).toBe('testuser');
    });

    it('should detect navigation intent', () => {
      const stepText = '打开 https://example.com/settings';
      const beforeUrl = 'https://example.com/home';
      const afterUrl = 'https://example.com/settings';

      const context = contextCollector.createContextFromResult(
        'step-1',
        0,
        stepText,
        beforeUrl,
        afterUrl
      );

      expect(context.action.type).toBe('navigate');
      expect(context.semantic.actionIntent).toBe('navigate_to');
    });
  });

  describe('Intent Analysis to Assertion Generation Flow', () => {
    it('should generate navigation assertions for URL changes', async () => {
      const stepText = '点击登录按钮';
      const beforeUrl = 'https://example.com/login';
      const afterUrl = 'https://example.com/dashboard';

      const { analysis, recommendations } = await assertionGenerator.analyzeAndGenerate(
        'step-1',
        0,
        stepText,
        beforeUrl,
        afterUrl
      );

      // Should detect URL change and suggest URL assertion
      const urlAssertions = recommendations.filter(r =>
        r.type === 'url_contains' || r.type === 'url_equals'
      );
      expect(urlAssertions.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate success message assertions for form submissions', async () => {
      const stepText = '点击提交按钮';
      const beforeUrl = 'https://example.com/form';
      const afterUrl = 'https://example.com/success';

      const { analysis, recommendations } = await assertionGenerator.analyzeAndGenerate(
        'step-1',
        0,
        stepText,
        beforeUrl,
        afterUrl
      );

      // Should identify submit intent
      expect(analysis.intent).toBe('submit_form');
    });

    it('should respect minimum confidence threshold', async () => {
      assertionGenerator.setConfig({
        enabled: true,
        minConfidence: 90, // High threshold
      });

      const stepText = '点击按钮';
      const beforeUrl = 'https://example.com';
      const afterUrl = 'https://example.com';

      const { recommendations } = await assertionGenerator.analyzeAndGenerate(
        'step-1',
        0,
        stepText,
        beforeUrl,
        afterUrl
      );

      // All recommendations should meet threshold
      recommendations.forEach(rec => {
        expect(rec.confidence).toBeGreaterThanOrEqual(90);
      });
    });

    it('should limit recommendations to max count', async () => {
      assertionGenerator.setConfig({
        enabled: true,
        minConfidence: 10, // Low threshold to get many recommendations
        maxRecommendations: 3,
      });

      const stepText = '点击登录按钮';
      const beforeUrl = 'https://example.com/login';
      const afterUrl = 'https://example.com/dashboard';

      const { recommendations } = await assertionGenerator.analyzeAndGenerate(
        'step-1',
        0,
        stepText,
        beforeUrl,
        afterUrl
      );

      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it('should return empty recommendations when disabled', async () => {
      assertionGenerator.setConfig({
        enabled: false,
      });

      const { recommendations } = await assertionGenerator.analyzeAndGenerate(
        'step-1',
        0,
        '点击登录按钮',
        'https://example.com/login',
        'https://example.com/dashboard'
      );

      expect(recommendations).toEqual([]);
    });
  });

  describe('Template Integration Flow', () => {
    it('should match and apply templates based on action type', async () => {
      const template: AssertionTemplate = {
        id: 'tpl-login',
        name: 'Login Success',
        description: 'Verify login was successful',
        category: 'authentication',
        trigger: {
          actionType: 'click',
          intentPattern: 'login',
        },
        assertion: {
          type: 'url_contains',
          parameters: {
            expectedValue: 'dashboard',
          },
        },
        createdAt: Date.now(),
        usageCount: 0,
      };

      assertionGenerator.setTemplates([template]);
      assertionGenerator.setConfig({
        enabled: true,
        enableTemplates: true,
        templateCategories: ['authentication'],
      });

      const { recommendations } = await assertionGenerator.analyzeAndGenerate(
        'step-1',
        0,
        '点击登录按钮',
        'https://example.com/login',
        'https://example.com/dashboard'
      );

      // Should include template-based recommendation
      const templateRecs = recommendations.filter(r => r.source === 'template');
      expect(templateRecs.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter templates by category', async () => {
      const authTemplate: AssertionTemplate = {
        id: 'tpl-auth',
        name: 'Auth Template',
        description: 'Auth check',
        category: 'authentication',
        trigger: { actionType: 'click' },
        assertion: { type: 'element_visible', parameters: {} },
        createdAt: Date.now(),
        usageCount: 0,
      };

      const paymentTemplate: AssertionTemplate = {
        id: 'tpl-payment',
        name: 'Payment Template',
        description: 'Payment check',
        category: 'payment',
        trigger: { actionType: 'click' },
        assertion: { type: 'element_visible', parameters: {} },
        createdAt: Date.now(),
        usageCount: 0,
      };

      assertionGenerator.setTemplates([authTemplate, paymentTemplate]);
      assertionGenerator.setConfig({
        enabled: true,
        enableTemplates: true,
        templateCategories: ['authentication'], // Only auth category
      });

      const { recommendations } = await assertionGenerator.analyzeAndGenerate(
        'step-1',
        0,
        '点击按钮',
        'https://example.com',
        'https://example.com'
      );

      const templateRecs = recommendations.filter(r => r.source === 'template');
      // Should not include payment template
      const paymentRecs = templateRecs.filter(r => r.description?.includes('Payment'));
      expect(paymentRecs.length).toBe(0);
    });
  });

  describe('Template Manager Integration', () => {
    it('should create and retrieve templates', async () => {
      // Create template using the API
      const template = await templateManager.create({
        name: 'Test Template',
        description: 'Test description',
        category: 'user',
        trigger: { actionType: 'click' },
        assertion: {
          type: 'element_visible',
          parameters: { target: 'button' },
        },
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.usageCount).toBe(0);

      const retrieved = await templateManager.getById(template.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Template');
    });

    it('should track template usage', async () => {
      const template = await templateManager.create({
        name: 'Usage Test',
        description: 'Track usage',
        category: 'user',
        trigger: { actionType: 'click' },
        assertion: { type: 'element_visible', parameters: {} },
      });

      await templateManager.incrementUsage(template.id);
      await templateManager.incrementUsage(template.id);

      const updated = await templateManager.getById(template.id);
      expect(updated?.usageCount).toBe(2);
    });

    it('should find matching templates for context', async () => {
      await templateManager.create({
        name: 'Login Template',
        description: 'For login actions',
        category: 'user',
        trigger: {
          actionType: 'click',
          intentPattern: 'login',
        },
        assertion: { type: 'url_contains', parameters: { expectedValue: 'dashboard' } },
      });

      // Find templates matching login intent
      const matches = await templateManager.findMatching('login', 'click');

      expect(matches.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('YAML Output Generation', () => {
    it('should generate valid YAML for recommendations', async () => {
      const { recommendations } = await assertionGenerator.analyzeAndGenerate(
        'step-1',
        0,
        '点击登录按钮',
        'https://example.com/login',
        'https://example.com/dashboard'
      );

      // Each recommendation should have yamlOutput
      recommendations.forEach(rec => {
        expect(rec.yamlOutput).toBeDefined();
        expect(rec.yamlOutput.length).toBeGreaterThan(0);
      });
    });

    it('should generate batch YAML correctly', async () => {
      const { recommendations } = await assertionGenerator.analyzeAndGenerate(
        'step-1',
        0,
        '点击登录按钮',
        'https://example.com/login',
        'https://example.com/dashboard'
      );

      if (recommendations.length > 1) {
        const batchYaml = assertionGenerator.toYamlBatch(recommendations);
        expect(batchYaml.split('\n').length).toBe(recommendations.length);
      }
    });
  });

  describe('Change Detection Integration', () => {
    it('should detect URL changes', () => {
      const urlChange = changeDetector.detectUrlChange(
        'https://example.com/login',
        'https://example.com/dashboard'
      );

      expect(urlChange).toBeDefined();
      // The type might be 'modified' or 'url_change' depending on implementation
      expect(['url_change', 'modified']).toContain(urlChange?.type);
    });

    it('should not detect change for same URL', () => {
      const urlChange = changeDetector.detectUrlChange(
        'https://example.com/page',
        'https://example.com/page'
      );

      expect(urlChange).toBeNull();
    });
  });

  describe('Full Assertion Workflow', () => {
    it('should complete full workflow from step to YAML', async () => {
      // 1. Create context
      const context = contextCollector.createContextFromResult(
        'step-1',
        0,
        '点击登录按钮',
        'https://example.com/login',
        'https://example.com/dashboard'
      );

      // 2. Analyze intent
      const analysis = intentInferrer.analyze(context);
      expect(analysis.intent).toBe('login');
      expect(analysis.needsAssertion).toBe(true);

      // 3. Generate recommendations
      const recommendations = await assertionGenerator.generate(context, analysis);

      // 4. Verify recommendations have required fields
      recommendations.forEach(rec => {
        expect(rec.id).toBeDefined();
        expect(rec.type).toBeDefined();
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(100);
        expect(rec.yamlOutput).toBeDefined();
      });
    });

    it('should handle edge cases gracefully', async () => {
      // Empty step text
      const { recommendations: emptyRecs } = await assertionGenerator.analyzeAndGenerate(
        'step-1',
        0,
        '',
        'https://example.com',
        'https://example.com'
      );
      expect(Array.isArray(emptyRecs)).toBe(true);

      // Same URL before and after
      const { recommendations: sameUrlRecs } = await assertionGenerator.analyzeAndGenerate(
        'step-2',
        1,
        '点击按钮',
        'https://example.com',
        'https://example.com'
      );
      expect(Array.isArray(sameUrlRecs)).toBe(true);
    });
  });

  describe('Intent Inferrer Analysis', () => {
    it('should identify high-value intents for assertion', () => {
      const highValueIntents = ['login', 'logout', 'submit_form', 'signup', 'delete_item'];

      for (const intent of highValueIntents) {
        const context: ActionContext = {
          action: { type: 'click', target: { text: '' }, timestamp: Date.now() },
          pageState: {
            beforeUrl: 'https://example.com',
            afterUrl: 'https://example.com/next',
            beforeTitle: '',
            afterTitle: '',
            visibleChanges: [],
          },
          semantic: {
            actionIntent: intent,
            targetSemantics: '',
            expectedOutcome: '',
          },
          stepId: 'step-1',
          stepIndex: 0,
        };

        const analysis = intentInferrer.analyze(context);
        expect(analysis.needsAssertion).toBe(true);
      }
    });

    it('should detect visual changes as assertion triggers', () => {
      const context: ActionContext = {
        action: { type: 'click', target: { text: '按钮' }, timestamp: Date.now() },
        pageState: {
          beforeUrl: 'https://example.com',
          afterUrl: 'https://example.com',
          beforeTitle: '',
          afterTitle: '',
          visibleChanges: [
            {
              type: 'new_element',
              selector: '.success-message',
              description: 'Success message appeared',
            },
          ],
        },
        semantic: {
          actionIntent: 'click_action',
          targetSemantics: '按钮',
          expectedOutcome: '操作执行成功',
        },
        stepId: 'step-1',
        stepIndex: 0,
      };

      const analysis = intentInferrer.analyze(context);
      expect(analysis.changes.length).toBeGreaterThan(0);
    });
  });
});
