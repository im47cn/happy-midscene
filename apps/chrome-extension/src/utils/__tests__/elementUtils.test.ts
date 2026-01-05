/**
 * Unit tests for element utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  extractElementBox,
  isValidElementBox,
  isElementVisible,
  isElementInteractable,
  isSameBox,
  clampBoxToViewport,
  viewportToPageBox,
  pageToViewportBox,
} from '../elementUtils';

// Mock DOM environment
describe('elementUtils', () => {
  let mockElement: HTMLElement;

  beforeEach(() => {
    // Create a mock element
    mockElement = document.createElement('div');
    mockElement.style.cssText = 'position: absolute; left: 100px; top: 200px; width: 300px; height: 150px;';
    document.body.appendChild(mockElement);
  });

  afterEach(() => {
    document.body.removeChild(mockElement);
  });

  describe('extractElementBox', () => {
    it('should extract box from full rect', () => {
      const rect = { left: 10, top: 20, width: 100, height: 50 };
      const box = extractElementBox(rect);

      expect(box).not.toBeNull();
      expect(box?.x).toBe(10);
      expect(box?.y).toBe(20);
      expect(box?.width).toBe(100);
      expect(box?.height).toBe(50);
      expect(box?.center).toEqual([60, 45]);
    });

    it('should extract box from x/y coordinates', () => {
      const rect = { x: 50, y: 100 };
      const box = extractElementBox(rect);

      expect(box).not.toBeNull();
      expect(box?.x).toBe(50);
      expect(box?.y).toBe(100);
      expect(box?.width).toBe(4); // default size
      expect(box?.height).toBe(4);
      expect(box?.center).toEqual([50, 100]);
    });

    it('should return null for invalid rect', () => {
      const box = extractElementBox(null);
      expect(box).toBeNull();
    });

    it('should handle zero width/height', () => {
      const rect = { left: 10, top: 20, width: 0, height: 50 };
      const box = extractElementBox(rect);

      // Should still return a box with the values
      expect(box).not.toBeNull();
      expect(box?.width).toBe(0);
    });
  });

  describe('isValidElementBox', () => {
    it('should return true for valid box', () => {
      const box = { x: 10, y: 20, width: 100, height: 50, center: [60, 45] };
      expect(isValidElementBox(box)).toBe(true);
    });

    it('should return false for null box', () => {
      expect(isValidElementBox(null)).toBe(false);
    });

    it('should return false for box with zero width', () => {
      const box = { x: 10, y: 20, width: 0, height: 50, center: [10, 45] };
      expect(isValidElementBox(box)).toBe(false);
    });

    it('should return false for box with zero height', () => {
      const box = { x: 10, y: 20, width: 100, height: 0, center: [60, 20] };
      expect(isValidElementBox(box)).toBe(false);
    });
  });

  describe('isElementVisible', () => {
    it('should return true for visible element', () => {
      expect(isElementVisible(mockElement)).toBe(true);
    });

    it('should return false for display: none', () => {
      mockElement.style.display = 'none';
      expect(isElementVisible(mockElement)).toBe(false);
    });

    it('should return false for visibility: hidden', () => {
      mockElement.style.visibility = 'hidden';
      expect(isElementVisible(mockElement)).toBe(false);
    });

    it('should return false for opacity: 0', () => {
      mockElement.style.opacity = '0';
      expect(isElementVisible(mockElement)).toBe(false);
    });
  });

  describe('isElementInteractable', () => {
    it('should return true for interactable element', () => {
      expect(isElementInteractable(mockElement)).toBe(true);
    });

    it('should return false for non-visible element', () => {
      mockElement.style.display = 'none';
      expect(isElementInteractable(mockElement)).toBe(false);
    });

    it('should return false for pointer-events: none', () => {
      mockElement.style.pointerEvents = 'none';
      expect(isElementInteractable(mockElement)).toBe(false);
    });

    it('should return false for disabled element', () => {
      const button = document.createElement('button');
      button.disabled = true;
      document.body.appendChild(button);

      try {
        expect(isElementInteractable(button)).toBe(false);
      } finally {
        document.body.removeChild(button);
      }
    });

    it('should return false for aria-disabled', () => {
      mockElement.setAttribute('aria-disabled', 'true');
      expect(isElementInteractable(mockElement)).toBe(false);
    });
  });

  describe('isSameBox', () => {
    it('should return true for identical boxes', () => {
      const box1 = { x: 10, y: 20, width: 100, height: 50, center: [60, 45] };
      const box2 = { x: 10, y: 20, width: 100, height: 50, center: [60, 45] };
      expect(isSameBox(box1, box2)).toBe(true);
    });

    it('should return true for boxes within tolerance', () => {
      const box1 = { x: 10, y: 20, width: 100, height: 50, center: [60, 45] };
      const box2 = { x: 12, y: 22, width: 102, height: 52, center: [62, 47] };
      expect(isSameBox(box1, box2, 5)).toBe(true);
    });

    it('should return false for boxes outside tolerance', () => {
      const box1 = { x: 10, y: 20, width: 100, height: 50, center: [60, 45] };
      const box2 = { x: 20, y: 30, width: 100, height: 50, center: [70, 55] };
      expect(isSameBox(box1, box2, 5)).toBe(false);
    });
  });

  describe('clampBoxToViewport', () => {
    it('should clamp box that exceeds viewport width', () => {
      const box = { x: 1800, y: 100, width: 200, height: 100, center: [1900, 150] };
      const clamped = clampBoxToViewport(box);

      expect(clamped.x).toBeLessThan(window.innerWidth);
      expect(clamped.width).toBeLessThanOrEqual(window.innerWidth);
    });

    it('should clamp box that exceeds viewport height', () => {
      const box = { x: 100, y: 2000, width: 200, height: 100, center: [200, 2050] };
      const clamped = clampBoxToViewport(box);

      expect(clamped.y).toBeLessThan(window.innerHeight);
      expect(clamped.height).toBeLessThanOrEqual(window.innerHeight);
    });

    it('should not modify box within viewport', () => {
      const box = { x: 100, y: 100, width: 200, height: 150, center: [200, 175] };
      const clamped = clampBoxToViewport(box);

      expect(clamped.x).toBe(box.x);
      expect(clamped.y).toBe(box.y);
    });
  });

  describe('viewportToPageBox', () => {
    it('should convert viewport coordinates to page coordinates with scroll', () => {
      // Set scroll position
      window.scrollTo(100, 200);

      const viewportBox = { x: 50, y: 100, width: 200, height: 150, center: [150, 175] };
      const pageBox = viewportToPageBox(viewportBox);

      expect(pageBox.x).toBe(150); // 50 + 100
      expect(pageBox.y).toBe(300); // 100 + 200
      expect(pageBox.center).toEqual([250, 375]);

      // Reset scroll
      window.scrollTo(0, 0);
    });
  });

  describe('pageToViewportBox', () => {
    it('should convert page coordinates to viewport coordinates with scroll', () => {
      // Set scroll position
      window.scrollTo(100, 200);

      const pageBox = { x: 150, y: 300, width: 200, height: 150, center: [250, 375] };
      const viewportBox = pageToViewportBox(pageBox);

      expect(viewportBox.x).toBe(50); // 150 - 100
      expect(viewportBox.y).toBe(100); // 300 - 200
      expect(viewportBox.center).toEqual([150, 175]);

      // Reset scroll
      window.scrollTo(0, 0);
    });
  });
});
