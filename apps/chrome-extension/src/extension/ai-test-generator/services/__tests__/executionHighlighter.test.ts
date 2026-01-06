/**
 * Unit tests for ExecutionHighlighter
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ExecutionHighlighter,
  cleanupExecutionHighlighter,
  getExecutionHighlighter,
} from '../executionHighlighter';

// Store original global document
const originalDocument = globalThis.document;

describe('ExecutionHighlighter', () => {
  let highlighter: ExecutionHighlighter;
  let mockOverlay: any;
  let mockHighlight: any;

  // Mock DOM for testing
  const mockDocument = {
    createElement: vi.fn(),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
    head: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
    getElementById: vi.fn(),
  };

  // Helper to create a fresh mock element with style
  const createMockElement = () => ({
    id: '',
    style: {},
    appendChild: vi.fn(),
    remove: vi.fn(),
  });

  beforeEach(() => {
    // Reset the singleton
    cleanupExecutionHighlighter();

    // Stub document globally
    globalThis.document = mockDocument as any;
    (mockDocument.getElementById as any).mockReturnValue(null);

    // Setup mock elements with fresh objects
    mockOverlay = createMockElement();
    mockHighlight = createMockElement();

    highlighter = getExecutionHighlighter();
  });

  afterEach(() => {
    cleanupExecutionHighlighter();
    // Restore original document
    globalThis.document = originalDocument;
  });

  describe('initialization', () => {
    it('should create overlay on init', () => {
      (document.createElement as any).mockReturnValue(mockOverlay);

      highlighter.init();

      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(mockOverlay.id).toBe('midscene-execution-highlighter');
      expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockOverlay);
    });

    it('should remove existing overlay on re-init', () => {
      const existingOverlay = { remove: vi.fn() };
      (document.getElementById as any).mockReturnValue(existingOverlay);
      (document.createElement as any).mockReturnValue(mockOverlay);

      highlighter.init();

      expect(existingOverlay.remove).toHaveBeenCalled();
    });
  });

  describe('highlighting', () => {
    beforeEach(() => {
      // Make mockOverlay have appendChild method
      mockOverlay.appendChild = vi.fn();

      // Setup createElement to return appropriate mocks
      (document.createElement as any).mockImplementation((tagName: string) => {
        if (tagName === 'div') {
          // Return mockOverlay for the overlay container
          return mockOverlay;
        }
        // Return a fresh mock for highlight elements
        return createMockElement();
      });
      (document.getElementById as any).mockImplementation((id: string) => {
        if (id === 'midscene-highlighter-styles') return null;
        return mockOverlay;
      });
      highlighter.init();
    });

    it('should create highlight with current type by default', () => {
      const rect = { x: 100, y: 200, width: 150, height: 50 };

      highlighter.highlight(rect);

      expect(mockOverlay.appendChild).toHaveBeenCalled();
      const createdHighlight = (mockOverlay.appendChild as any).mock
        .calls[0][0];
      expect(createdHighlight.style.border).toBe('3px solid #1890ff'); // blue for current
    });

    it('should create highlight with custom color', () => {
      const rect = { x: 100, y: 200, width: 150, height: 50, color: '#ff00ff' };

      highlighter.highlight(rect);

      const createdHighlight = (mockOverlay.appendChild as any).mock
        .calls[0][0];
      expect(createdHighlight.style.border).toBe('3px solid #ff00ff');
    });

    it('should create success highlight with green color', () => {
      const rect = { x: 100, y: 200, width: 150, height: 50 };

      highlighter.highlight(rect, 'success');

      const createdHighlight = (mockOverlay.appendChild as any).mock
        .calls[0][0];
      expect(createdHighlight.style.border).toBe('3px solid #52c41a'); // green
    });

    it('should create failed highlight with red color', () => {
      const rect = { x: 100, y: 200, width: 150, height: 50 };

      highlighter.highlight(rect, 'failed');

      const createdHighlight = (mockOverlay.appendChild as any).mock
        .calls[0][0];
      expect(createdHighlight.style.border).toBe('3px solid #ff4d4f'); // red
    });

    it('should create pending highlight with yellow color', () => {
      const rect = { x: 100, y: 200, width: 150, height: 50 };

      highlighter.highlight(rect, 'pending');

      const createdHighlight = (mockOverlay.appendChild as any).mock
        .calls[0][0];
      expect(createdHighlight.style.border).toBe('3px solid #faad14'); // yellow
    });

    it('should set correct position for highlight', () => {
      const rect = { x: 100, y: 200, width: 150, height: 50 };

      highlighter.highlight(rect);

      const createdHighlight = (mockOverlay.appendChild as any).mock
        .calls[0][0];
      expect(createdHighlight.style.left).toBe('100px');
      expect(createdHighlight.style.top).toBe('200px');
      expect(createdHighlight.style.width).toBe('150px');
      expect(createdHighlight.style.height).toBe('50px');
    });
  });

  describe('highlightCurrent', () => {
    beforeEach(() => {
      // Make mockOverlay have appendChild method
      mockOverlay.appendChild = vi.fn();

      // Setup createElement to return appropriate mocks
      (document.createElement as any).mockImplementation((tagName: string) => {
        if (tagName === 'div') {
          return mockOverlay;
        }
        return createMockElement();
      });
      (document.getElementById as any).mockImplementation((id: string) => {
        if (id === 'midscene-highlighter-styles') return null;
        return mockOverlay;
      });
      highlighter.init();
    });

    it('should remove previous current highlight', () => {
      const prevHighlight = {
        remove: vi.fn(),
        id: 'prev-highlight',
        style: { animation: '' },
      };
      highlighter['currentHighlight'] = prevHighlight as any;
      highlighter['highlights'].set('prev-highlight', prevHighlight as any);

      const rect = { x: 100, y: 200, width: 150, height: 50 };
      highlighter.highlightCurrent(rect);

      expect(prevHighlight.remove).toHaveBeenCalled();
      expect(highlighter['highlights'].has('prev-highlight')).toBe(false);
    });

    it('should create new current highlight', () => {
      const rect = { x: 100, y: 200, width: 150, height: 50 };
      highlighter.highlightCurrent(rect);

      const createdHighlight = (mockOverlay.appendChild as any).mock
        .calls[0][0];
      expect(createdHighlight.style.border).toBe('3px solid #1890ff');
    });
  });

  describe('markAsSuccess', () => {
    beforeEach(() => {
      (document.createElement as any).mockReturnValue(mockOverlay);
      (document.getElementById as any).mockReturnValue(null);
      highlighter.init();
      highlighter['currentHighlight'] = {
        ...mockHighlight,
        style: { animation: '', borderColor: '' },
      };
    });

    it('should change color to green', () => {
      highlighter.markAsSuccess();

      expect(highlighter['currentHighlight'].style.borderColor).toBe('#52c41a');
    });

    it('should remove animation', () => {
      highlighter.markAsSuccess();

      expect(highlighter['currentHighlight'].style.animation).toBe('none');
    });
  });

  describe('markAsFailed', () => {
    beforeEach(() => {
      // Make mockOverlay have appendChild method
      mockOverlay.appendChild = vi.fn();

      // Setup createElement to return appropriate mocks
      (document.createElement as any).mockImplementation((tagName: string) => {
        if (tagName === 'div') {
          return mockOverlay;
        }
        return createMockElement();
      });
      (document.getElementById as any).mockImplementation((id: string) => {
        if (id === 'midscene-highlighter-styles') return null;
        return mockOverlay;
      });
      highlighter.init();
      highlighter['currentHighlight'] = {
        ...mockHighlight,
        style: { animation: '', borderColor: '' },
      };
    });

    it('should change color to red', () => {
      highlighter.markAsFailed();

      expect(highlighter['currentHighlight'].style.borderColor).toBe('#ff4d4f');
    });

    it('should add shake animation', () => {
      highlighter.markAsFailed();

      expect(highlighter['currentHighlight'].style.animation).toBe(
        'midshake 0.5s ease-in-out',
      );
    });
  });

  describe('clearAll', () => {
    beforeEach(() => {
      (document.createElement as any).mockReturnValue(mockOverlay);
      (document.getElementById as any).mockReturnValue(null);
      highlighter.init();

      // Add some highlights
      const h1 = { remove: vi.fn() };
      const h2 = { remove: vi.fn() };
      highlighter['highlights'].set('h1', h1 as any);
      highlighter['highlights'].set('h2', h2 as any);
    });

    it('should remove all highlights', () => {
      highlighter.clearAll();

      const highlights = Array.from(highlighter['highlights'].values());
      highlights.forEach((h: any) => expect(h.remove).toHaveBeenCalled());
    });

    it('should clear highlights map', () => {
      highlighter.clearAll();

      expect(highlighter['highlights'].size).toBe(0);
    });

    it('should clear current highlight', () => {
      highlighter['currentHighlight'] = mockHighlight;
      highlighter.clearAll();

      expect(highlighter['currentHighlight']).toBeNull();
    });
  });

  describe('cleanup', () => {
    let styleEl: any;

    beforeEach(() => {
      (document.createElement as any).mockReturnValue(mockOverlay);
      styleEl = { remove: vi.fn() };
      highlighter.init();
      (document.getElementById as any).mockImplementation((id) => {
        if (id === 'midscene-highlighter-styles') return styleEl;
        return mockOverlay;
      });
    });

    it('should clear all highlights', () => {
      const clearAllSpy = vi.spyOn(highlighter, 'clearAll');
      highlighter.cleanup();

      expect(clearAllSpy).toHaveBeenCalled();
    });

    it('should remove overlay', () => {
      highlighter.cleanup();

      expect(mockOverlay.remove).toHaveBeenCalled();
    });

    it('should remove animation styles', () => {
      highlighter.cleanup();

      expect(styleEl.remove).toHaveBeenCalled();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getExecutionHighlighter();
      const instance2 = getExecutionHighlighter();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton on cleanup', () => {
      const instance1 = getExecutionHighlighter();
      cleanupExecutionHighlighter();
      const instance2 = getExecutionHighlighter();

      expect(instance1).not.toBe(instance2);
    });
  });
});
