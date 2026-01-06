/**
 * Unit tests for Repair Engine Service
 * Run with: npx vitest run apps/chrome-extension/src/extension/ai-test-generator/services/elementRepair/__tests__/
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rect } from '@midscene/core';
import type {
  RepairOptions,
  RepairResult,
  RepairSuggestion,
  SelectedElement,
} from '../../types/elementRepair';
import { RepairEngine } from '../repairEngine';
import { elementSelector } from '../elementSelector';

// Mock elementSelector.validateSelector to return true in tests
vi.spyOn(elementSelector, 'validateSelector').mockResolvedValue(true);

// Helper to create a mock selected element
function createMockSelectedElement(
  overrides: Partial<SelectedElement> = {},
): SelectedElement {
  return {
    elementId: 'test-element-1',
    rect: { left: 100, top: 100, width: 200, height: 50 } as Rect,
    center: [200, 125],
    attributes: {
      id: 'submit-button',
      class: 'btn btn-primary',
      type: 'button',
    },
    suggestedSelectors: [
      {
        type: 'css',
        value: '#submit-button',
        priority: 95,
        reason: 'ID selector is stable',
      },
      {
        type: 'css',
        value: '.btn-primary',
        priority: 70,
        reason: 'Class selector may have multiple matches',
      },
    ],
    semanticDescription: 'Submit form button',
    ...overrides,
  };
}

// Helper to create mock repair options
function createMockRepairOptions(
  overrides: Partial<RepairOptions> = {},
): RepairOptions {
  return {
    stepId: 'step-1',
    originalDescription: 'Click the submit button',
    failureReason: 'Element not found: #old-submit-button',
    ...overrides,
  };
}

describe('RepairEngine', () => {
  let engine: RepairEngine;

  beforeEach(() => {
    engine = new RepairEngine();
  });

  describe('generateSuggestions', () => {
    it('should generate update_selector suggestion', async () => {
      const selectedElement = createMockSelectedElement();
      const options = createMockRepairOptions({
        originalSelector: '#old-submit-button',
      });

      const suggestions = await engine.generateSuggestions(selectedElement, options);

      expect(suggestions.length).toBeGreaterThan(0);

      const updateSuggestion = suggestions.find(
        (s) => s.actionType === 'update_selector',
      );
      expect(updateSuggestion).toBeDefined();
      expect(updateSuggestion?.currentValue).toBe('#old-submit-button');
      expect(updateSuggestion?.suggestedValue).toContain('#submit-button');
    });

    it('should generate add_fallback suggestion when multiple selectors available', async () => {
      const selectedElement = createMockSelectedElement({
        suggestedSelectors: [
          {
            type: 'css',
            value: '#submit-button',
            priority: 95,
            reason: 'ID selector',
          },
          {
            type: 'css',
            value: '.btn-primary',
            priority: 70,
            reason: 'Class selector',
          },
          {
            type: 'text',
            value: 'text="Submit"',
            priority: 60,
            reason: 'Text selector',
          },
        ],
      });
      const options = createMockRepairOptions({
        originalSelector: '#submit-button',
      });

      const suggestions = await engine.generateSuggestions(selectedElement, options);

      const fallbackSuggestion = suggestions.find(
        (s) => s.actionType === 'add_fallback',
      );
      expect(fallbackSuggestion).toBeDefined();
    });

    it('should generate update_description suggestion', async () => {
      const selectedElement = createMockSelectedElement({
        semanticDescription: 'Blue submit button in the form footer',
      });
      const options = createMockRepairOptions({
        originalDescription: 'Click submit',
      });

      const suggestions = await engine.generateSuggestions(selectedElement, options);

      const descSuggestion = suggestions.find(
        (s) => s.actionType === 'update_description',
      );
      expect(descSuggestion).toBeDefined();
      expect(descSuggestion?.suggestedValue).toContain('Blue');
    });

    it('should calculate confidence scores correctly', async () => {
      const selectedElement = createMockSelectedElement();
      const options = createMockRepairOptions();

      const suggestions = await engine.generateSuggestions(selectedElement, options);

      suggestions.forEach((s) => {
        expect(s.confidence).toBeGreaterThanOrEqual(0);
        expect(s.confidence).toBeLessThanOrEqual(100);
      });
    });

    it('should assign impact levels based on failure reason and action type', async () => {
      const selectedElement = createMockSelectedElement();
      const options = createMockRepairOptions({
        failureReason: 'Element not found: #old-submit-button',
      });

      const suggestions = await engine.generateSuggestions(selectedElement, options);

      // update_selector should have high impact for 'not found' failure
      const updateSuggestion = suggestions.find((s) => s.actionType === 'update_selector');
      expect(updateSuggestion?.impact).toBe('high');

      // add_fallback should have medium impact
      const fallbackSuggestion = suggestions.find((s) => s.actionType === 'add_fallback');
      expect(fallbackSuggestion?.impact).toBe('medium');
    });

    it('should generate unique suggestion IDs', async () => {
      const selectedElement = createMockSelectedElement();
      const options = createMockRepairOptions();

      const suggestions = await engine.generateSuggestions(selectedElement, options);

      const ids = suggestions.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('applyRepair', () => {
    it('should apply update_selector repair', async () => {
      const selectedElement = createMockSelectedElement();
      const options = createMockRepairOptions();

      const suggestions = await engine.generateSuggestions(selectedElement, options);
      const updateSuggestion = suggestions.find((s) => s.actionType === 'update_selector');

      if (!updateSuggestion) {
        throw new Error('No update_selector suggestion found');
      }

      const result = await engine.applyRepair(updateSuggestion, selectedElement, options);

      expect(result.success).toBe(true);
      expect(result.appliedRepair.actionType).toBe('update_selector');
      expect(result.appliedRepair.newValue).toContain('#submit-button');
    });

    it('should return repair result with proper structure', async () => {
      const selectedElement = createMockSelectedElement();
      const options = createMockRepairOptions();

      const suggestions = await engine.generateSuggestions(selectedElement, options);
      const suggestion = suggestions[0];

      const result = await engine.applyRepair(suggestion, selectedElement, options);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('repairId');
      expect(result).toHaveProperty('appliedRepair');
      expect(result).toHaveProperty('timestamp');
      expect(result.repairId).toBeTruthy();
      expect(typeof result.timestamp).toBe('number');
    });
  });

  describe('validateRepair', () => {
    it('should validate successful repair', async () => {
      const selectedElement = createMockSelectedElement();
      const options = createMockRepairOptions();

      const suggestions = await engine.generateSuggestions(selectedElement, options);
      const suggestion = suggestions[0];

      const result = await engine.applyRepair(suggestion, selectedElement, options);
      const isValid = await engine.validateRepair(result);

      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('getRepairHistory', () => {
    it('should return empty history initially', async () => {
      const history = await engine.getRepairHistory();
      expect(history).toEqual([]);
    });

    it('should store repairs in history', async () => {
      const selectedElement = createMockSelectedElement();
      const options = createMockRepairOptions();

      const suggestions = await engine.generateSuggestions(selectedElement, options);
      const suggestion = suggestions[0];

      await engine.applyRepair(suggestion, selectedElement, options);

      const history = await engine.getRepairHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should filter history by stepId', async () => {
      const selectedElement = createMockSelectedElement();
      const options1 = createMockRepairOptions({ stepId: 'step-1' });
      const options2 = createMockRepairOptions({ stepId: 'step-2' });

      const suggestions1 = await engine.generateSuggestions(selectedElement, options1);
      const suggestions2 = await engine.generateSuggestions(selectedElement, options2);

      await engine.applyRepair(suggestions1[0], selectedElement, options1);
      await engine.applyRepair(suggestions2[0], selectedElement, options2);

      const step1History = await engine.getRepairHistory('step-1');
      const step2History = await engine.getRepairHistory('step-2');

      expect(step1History.length).toBe(1);
      expect(step2History.length).toBe(1);
      expect(step1History[0].appliedRepair).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle element without semantic description', async () => {
      const selectedElement = createMockSelectedElement({
        semanticDescription: undefined,
      });
      const options = createMockRepairOptions();

      const suggestions = await engine.generateSuggestions(selectedElement, options);

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should handle empty suggested selectors', async () => {
      const selectedElement = createMockSelectedElement({
        suggestedSelectors: [],
      });
      const options = createMockRepairOptions();

      const suggestions = await engine.generateSuggestions(selectedElement, options);

      // Should still generate some suggestions based on other data
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should handle missing original selector', async () => {
      const selectedElement = createMockSelectedElement();
      const options = createMockRepairOptions({
        originalSelector: undefined,
      });

      const suggestions = await engine.generateSuggestions(selectedElement, options);

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});
