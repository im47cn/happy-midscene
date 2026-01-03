/**
 * Assertion Generator Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { ActionContext, AnalysisResult } from '../../../types/assertion';
import { AssertionGenerator } from '../assertionGenerator';

describe('AssertionGenerator', () => {
  let generator: AssertionGenerator;

  beforeEach(() => {
    generator = new AssertionGenerator();
  });

  const createContext = (
    overrides: Partial<ActionContext> = {},
  ): ActionContext => ({
    action: {
      type: 'click',
      target: { text: '登录' },
      timestamp: Date.now(),
    },
    pageState: {
      beforeUrl: 'https://example.com/login',
      afterUrl: 'https://example.com/dashboard',
      visibleChanges: [
        {
          type: 'appeared',
          region: { x: 100, y: 100, width: 200, height: 50 },
          description: '欢迎回来，admin',
          confidence: 0.9,
        },
      ],
    },
    semantic: {
      actionIntent: 'login',
      targetSemantics: '登录按钮',
      expectedOutcome: '登录成功',
    },
    stepId: 'step-1',
    stepIndex: 0,
    ...overrides,
  });

  const createAnalysis = (
    overrides: Partial<AnalysisResult> = {},
  ): AnalysisResult => ({
    needsAssertion: true,
    assertionTypes: ['text_contains', 'url_contains'],
    changes: [
      {
        type: 'appeared',
        region: { x: 100, y: 100, width: 200, height: 50 },
        description: '欢迎回来，admin',
        confidence: 0.9,
      },
    ],
    intent: 'login',
    confidence: 85,
    ...overrides,
  });

  describe('setConfig and getConfig', () => {
    it('should update configuration', () => {
      generator.setConfig({ enabled: false, maxRecommendations: 3 });
      const config = generator.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.maxRecommendations).toBe(3);
    });
  });

  describe('generate', () => {
    it('should generate recommendations for login action', async () => {
      const context = createContext();
      const analysis = createAnalysis();

      const recommendations = await generator.generate(context, analysis);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toHaveProperty('id');
      expect(recommendations[0]).toHaveProperty('type');
      expect(recommendations[0]).toHaveProperty('description');
      expect(recommendations[0]).toHaveProperty('confidence');
      expect(recommendations[0]).toHaveProperty('yamlOutput');
    });

    it('should include navigation assertion when URL changes', async () => {
      const context = createContext();
      const analysis = createAnalysis();

      const recommendations = await generator.generate(context, analysis);

      const navAssertion = recommendations.find(
        (r) => r.type === 'url_contains',
      );
      expect(navAssertion).toBeDefined();
    });

    it('should include success message assertion for login', async () => {
      // Create context with a success message in changes
      const context = createContext({
        pageState: {
          beforeUrl: 'https://example.com/login',
          afterUrl: 'https://example.com/dashboard',
          visibleChanges: [
            {
              type: 'appeared',
              region: { x: 100, y: 100, width: 200, height: 50 },
              description: '登录成功',
              confidence: 0.9,
            },
          ],
        },
      });
      const analysis = createAnalysis({
        changes: [
          {
            type: 'appeared',
            region: { x: 100, y: 100, width: 200, height: 50 },
            description: '登录成功',
            confidence: 0.9,
          },
        ],
      });

      const recommendations = await generator.generate(context, analysis);

      // Should have text_contains assertion for success message
      const textAssertion = recommendations.find(
        (r) => r.type === 'text_contains',
      );
      expect(textAssertion).toBeDefined();
    });

    it('should respect maxRecommendations config', async () => {
      generator.setConfig({ maxRecommendations: 2 });

      const context = createContext();
      const analysis = createAnalysis();

      const recommendations = await generator.generate(context, analysis);

      expect(recommendations.length).toBeLessThanOrEqual(2);
    });

    it('should sort by confidence', async () => {
      const context = createContext();
      const analysis = createAnalysis();

      const recommendations = await generator.generate(context, analysis);

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].confidence).toBeGreaterThanOrEqual(
          recommendations[i].confidence,
        );
      }
    });

    it('should filter by minConfidence', async () => {
      generator.setConfig({ minConfidence: 80 });

      const context = createContext();
      const analysis = createAnalysis();

      const recommendations = await generator.generate(context, analysis);

      for (const rec of recommendations) {
        expect(rec.confidence).toBeGreaterThanOrEqual(80);
      }
    });
  });

  describe('toYaml', () => {
    it('should convert recommendation to YAML', async () => {
      const context = createContext();
      const analysis = createAnalysis();

      const recommendations = await generator.generate(context, analysis);

      if (recommendations.length > 0) {
        const yaml = generator.toYaml(recommendations[0]);
        expect(yaml).toContain('- ai');
      }
    });
  });

  describe('toYamlBatch', () => {
    it('should convert multiple recommendations to YAML', async () => {
      const context = createContext();
      const analysis = createAnalysis();

      const recommendations = await generator.generate(context, analysis);
      const yaml = generator.toYamlBatch(recommendations);

      expect(yaml).toContain('- ai');
      const lines = yaml.split('\n').filter((l) => l.trim());
      expect(lines.length).toBe(recommendations.length);
    });
  });

  describe('analyzeAndGenerate', () => {
    it('should return empty when disabled', async () => {
      generator.setConfig({ enabled: false });

      const result = await generator.analyzeAndGenerate(
        'step-1',
        0,
        '点击登录',
        'https://example.com/login',
        'https://example.com/dashboard',
      );

      expect(result.recommendations).toHaveLength(0);
      expect(result.analysis.needsAssertion).toBe(false);
    });
  });
});
