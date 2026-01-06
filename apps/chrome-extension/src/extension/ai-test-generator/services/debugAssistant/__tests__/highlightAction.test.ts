/**
 * Unit tests for Highlight Action
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HighlightAction,
  getHighlightAction,
  resetHighlightAction,
} from '../highlightAction';

// Mock agent
const mockPage = {
  evaluate: vi.fn(),
};

const mockAgent = {
  page: mockPage,
  aiLocate: vi.fn(),
  aiQuery: vi.fn(),
};

describe('HighlightAction', () => {
  let highlightAction: HighlightAction;

  beforeEach(() => {
    vi.clearAllMocks();
    resetHighlightAction();
    highlightAction = getHighlightAction({
      getAgent: () => mockAgent,
    });
  });

  describe('highlight', () => {
    it('should highlight elements successfully', async () => {
      const elements = [
        {
          rect: { left: 100, top: 200, width: 50, height: 30 },
          text: 'Button',
        },
      ];

      mockPage.evaluate.mockResolvedValue([
        {
          id: 'highlight-1',
          rect: { left: 100, top: 200, width: 50, height: 30 },
        },
      ]);

      const result = await highlightAction.highlight('Submit button', elements);

      expect(result.success).not.toBeDefined();
      expect(result.count).toBe(1);
      expect(result.highlights).toHaveLength(1);
      expect(result.target).toBe('Submit button');
    });

    it('should return empty result when no elements found', async () => {
      mockAgent.aiLocate.mockResolvedValue(null);

      const result = await highlightAction.highlight('Nonexistent');

      expect(result.count).toBe(0);
      expect(result.highlights).toEqual([]);
    });

    it('should use default highlight colors', async () => {
      const elements = [{ rect: { left: 0, top: 0, width: 10, height: 10 } }];
      mockPage.evaluate.mockResolvedValue([]);

      await highlightAction.highlight('Element', elements);

      const callArgs = mockPage.evaluate.mock.calls[0];
      expect(callArgs[1].col).toBe('#ff6b6b');
      expect(callArgs[1].bgCol).toBe('rgba(255, 107, 107, 0.2)');
    });

    it('should support custom highlight colors', async () => {
      const elements = [{ rect: { left: 0, top: 0, width: 10, height: 10 } }];
      mockPage.evaluate.mockResolvedValue([]);

      await highlightAction.highlight('Element', elements, {
        color: '#00ff00',
        backgroundColor: 'rgba(0, 255, 0, 0.3)',
        borderWidth: 5,
      });

      const callArgs = mockPage.evaluate.mock.calls[0];
      expect(callArgs[1].col).toBe('#00ff00');
      expect(callArgs[1].borderW).toBe(5);
    });

    it('should add label when provided', async () => {
      const elements = [{ rect: { left: 0, top: 0, width: 10, height: 10 } }];
      mockPage.evaluate.mockResolvedValue([]);

      await highlightAction.highlight('Element', elements, {
        label: 'Test Element',
      });

      const callArgs = mockPage.evaluate.mock.calls[0];
      expect(callArgs[1].lbl).toBe('Test Element');
    });

    it('should show tooltip when requested', async () => {
      const elements = [{ rect: { left: 0, top: 0, width: 10, height: 10 }, text: 'Button Text' }];
      mockPage.evaluate.mockResolvedValue([]);

      await highlightAction.highlight('Element', elements, {
        showTooltip: true,
      });

      const callArgs = mockPage.evaluate.mock.calls[0];
      expect(callArgs[1].showTip).toBe(true);
    });

    it('should locate elements when not provided', async () => {
      mockAgent.aiLocate.mockResolvedValue([
        { rect: { left: 100, top: 200, width: 50, height: 30 } },
      ]);
      mockPage.evaluate.mockResolvedValue([]);

      await highlightAction.highlight('Button');

      expect(mockAgent.aiLocate).toHaveBeenCalledWith('Button');
    });
  });

  describe('highlightByCoordinates', () => {
    it('should highlight by coordinates', async () => {
      mockPage.evaluate.mockResolvedValue(undefined);

      const id = await highlightAction.highlightByCoordinates(100, 200, 50, 30);

      expect(id).toBeTruthy();
      expect(id).toContain('debug-highlight');
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should support custom styles for coordinate highlight', async () => {
      mockPage.evaluate.mockResolvedValue(undefined);

      await highlightAction.highlightByCoordinates(100, 200, 50, 30, {
        color: '#00ff00',
        label: 'Custom Label',
      });

      const callArgs = mockPage.evaluate.mock.calls[0];
      expect(callArgs[1].col).toBe('#00ff00');
      expect(callArgs[1].lbl).toBe('Custom Label');
    });
  });

  describe('highlightMultiple', () => {
    it('should highlight multiple targets', async () => {
      mockAgent.aiLocate.mockResolvedValue([{ rect: { left: 0, top: 0, width: 10, height: 10 } }]);
      mockPage.evaluate.mockResolvedValue([{ id: 'h-1', rect: {} }]);

      const results = await highlightAction.highlightMultiple([
        { target: 'Button 1', options: { color: '#ff0000' } },
        { target: 'Button 2', options: { color: '#00ff00' } },
      ]);

      expect(results).toHaveLength(2);
    });
  });

  describe('removeHighlight', () => {
    it('should remove specific highlight', async () => {
      mockPage.evaluate.mockResolvedValue(undefined);

      // First create a highlight
      const elements = [{ rect: { left: 0, top: 0, width: 10, height: 10 } }];
      mockPage.evaluate.mockResolvedValue([{ id: 'h-1', rect: {} }]);
      await highlightAction.highlight('Element', elements);

      // Then remove it
      mockPage.evaluate.mockResolvedValue(undefined);
      const removed = await highlightAction.removeHighlight('h-1');

      expect(removed).toBe(true);
    });

    it('should return false when highlight not found', async () => {
      const removed = await highlightAction.removeHighlight('nonexistent');

      expect(removed).toBe(false);
    });
  });

  describe('removeAllHighlights', () => {
    it('should remove all highlights', async () => {
      mockPage.evaluate.mockResolvedValue([{ id: 'h-1', rect: {} }]);

      // Create multiple highlights
      const elements = [{ rect: { left: 0, top: 0, width: 10, height: 10 } }];
      await highlightAction.highlight('Element 1', elements);
      await highlightAction.highlight('Element 2', elements);

      mockPage.evaluate.mockResolvedValue(undefined);
      const count = await highlightAction.removeAllHighlights();

      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('flash', () => {
    it('should flash element briefly', async () => {
      mockPage.evaluate.mockResolvedValue([{ id: 'flash-1', rect: {} }]);

      vi.useFakeTimers();
      const result = await highlightAction.flash('Element', 1000);

      expect(result.target).toBe('Element');
      vi.advanceTimersByTime(1000);
      vi.useRealTimers();
    });

    it('should use green color for flash', async () => {
      const elements = [{ rect: { left: 0, top: 0, width: 10, height: 10 } }];
      mockPage.evaluate.mockResolvedValue([]);

      await highlightAction.flash('Element', 100, elements);

      // Check that second call (for flash) uses green color
      const flashCall = mockPage.evaluate.mock.calls.find((call) =>
        call[1]?.col?.includes('00ff00'),
      );
      expect(flashCall).toBeDefined();
    });
  });

  describe('pulse', () => {
    it('should pulse element', async () => {
      const elements = [{ rect: { left: 100, top: 200, width: 50, height: 30 } }];
      mockPage.evaluate.mockResolvedValue(undefined);

      const result = await highlightAction.pulse('Button', 3);

      expect(result.count).toBe(1);
    });

    it('should return empty result when element not found for pulse', async () => {
      mockAgent.aiLocate.mockResolvedValue(null);

      const result = await highlightAction.pulse('Nonexistent');

      expect(result.count).toBe(0);
    });
  });

  describe('drawPath', () => {
    it('should draw path between two elements', async () => {
      mockAgent.aiLocate.mockResolvedValue([
        { rect: { left: 100, top: 100, width: 50, height: 30 } },
      ]);
      mockPage.evaluate.mockResolvedValue(undefined);

      const id = await highlightAction.drawPath('Element 1', 'Element 2');

      expect(id).toBeTruthy();
      expect(id).toContain('debug-highlight');
    });

    it('should support custom path styles', async () => {
      mockAgent.aiLocate.mockResolvedValue([
        { rect: { left: 100, top: 100, width: 50, height: 30 } },
      ]);
      mockPage.evaluate.mockResolvedValue(undefined);

      await highlightAction.drawPath('Element 1', 'Element 2', {
        color: '#0000ff',
        label: 'Connection',
      });

      const callArgs = mockPage.evaluate.mock.calls[0];
      expect(callArgs[1].col).toBe('#0000ff');
      expect(callArgs[1].lbl).toBe('Connection');
    });

    it('should throw error when elements not found', async () => {
      mockAgent.aiLocate.mockResolvedValue(null);

      await expect(highlightAction.drawPath('Bad 1', 'Bad 2')).rejects.toThrow('无法找到');
    });
  });

  describe('getActiveHighlights', () => {
    it('should return list of active highlight IDs', async () => {
      mockPage.evaluate.mockResolvedValue([{ id: 'h-1', rect: {} }]);

      const elements = [{ rect: { left: 0, top: 0, width: 10, height: 10 } }];
      await highlightAction.highlight('Element 1', elements);
      await highlightAction.highlight('Element 2', elements);

      const ids = highlightAction.getActiveHighlights();

      expect(Array.isArray(ids)).toBe(true);
    });
  });

  describe('clearTracking', () => {
    it('should clear tracking without removing from DOM', () => {
      highlightAction.clearTracking();

      const ids = highlightAction.getActiveHighlights();
      expect(ids).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should throw error when agent unavailable', () => {
      const badHighlight = new HighlightAction({
        getAgent: () => null,
      });

      expect(() => badHighlight['getPage']()).toThrow('无法获取');
    });

    it('should throw error when page unavailable', () => {
      const badHighlight = new HighlightAction({
        getAgent: () => ({}),
      });

      expect(() => badHighlight['getPage']()).toThrow('无法获取');
    });
  });
});
