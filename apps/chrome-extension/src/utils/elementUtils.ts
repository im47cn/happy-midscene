/**
 * Element Utilities
 * Unified element detection, selection, and highlighting utilities
 */

import type { Rect } from '@midscene/core';

/**
 * Element bounding box information
 */
export interface ElementBox {
  x: number;
  y: number;
  width: number;
  height: number;
  center: [number, number];
}

/**
 * Element information for selection
 */
export interface ElementSelection {
  box: ElementBox;
  selector?: string;
  description?: string;
  isVisible: boolean;
  isInteractable: boolean;
}

/**
 * Element highlight options
 */
export interface HighlightOptions {
  color?: string;
  borderWidth?: number;
  duration?: number;
  fadeIn?: boolean;
}

/**
 * Extract element box from various rect formats
 */
export function extractElementBox(
  rect: Partial<Rect> & { x?: number; y?: number } | null,
): ElementBox | null {
  if (!rect) {
    return null;
  }

  // Priority 1: Full rect with width/height
  if (rect.width && rect.height) {
    const left = rect.left ?? 0;
    const top = rect.top ?? 0;
    return {
      x: left,
      y: top,
      width: rect.width,
      height: rect.height,
      center: [left + rect.width / 2, top + rect.height / 2],
    };
  }

  // Priority 2: x/y coordinates (create a small default box)
  if (rect.x !== undefined && rect.y !== undefined) {
    const defaultSize = 4;
    return {
      x: rect.x,
      y: rect.y,
      width: defaultSize,
      height: defaultSize,
      center: [rect.x, rect.y],
    };
  }

  return null;
}

/**
 * Check if element box is valid
 */
export function isValidElementBox(box: ElementBox | null): boolean {
  if (!box) {
    return false;
  }
  return box.width > 0 && box.height > 0;
}

/**
 * Get element from selector with fallback strategies
 */
export function getElementBySelector(
  selector: string,
  root: Document | Element = document,
): Element | null {
  // Try as CSS selector first
  try {
    const element = root.querySelector(selector);
    if (element) {
      return element;
    }
  } catch {
    // Invalid CSS selector, try XPath
  }

  // Try as XPath
  try {
    const result = document.evaluate(
      selector,
      root,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    );
    if (result.singleNodeValue) {
      return result.singleNodeValue as Element;
    }
  } catch {
    // Invalid XPath
  }

  // Try as ID
  const byId = document.getElementById(selector);
  if (byId) {
    return byId;
  }

  // Try as name attribute
  const byName = root.querySelector(`[name="${selector}"]`);
  if (byName) {
    return byName;
  }

  return null;
}

/**
 * Get element bounding box with scroll offset
 */
export function getElementBox(
  element: Element,
  includeScroll = true,
): ElementBox | null {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  const x = includeScroll ? rect.left + window.scrollX : rect.left;
  const y = includeScroll ? rect.top + window.scrollY : rect.top;

  return {
    x,
    y,
    width: rect.width,
    height: rect.height,
    center: [x + rect.width / 2, y + rect.height / 2],
  };
}

/**
 * Check if element is visible
 */
export function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    (element as HTMLElement).offsetParent !== null
  );
}

/**
 * Check if element is interactable (clickable, typeable, etc.)
 */
export function isElementInteractable(element: Element): boolean {
  if (!isElementVisible(element)) {
    return false;
  }

  const htmlElement = element as HTMLElement;
  const style = window.getComputedStyle(element);

  // Check if pointer events are disabled
  if (style.pointerEvents === 'none') {
    return false;
  }

  // Check if element is disabled
  if (
    htmlElement.getAttribute('disabled') !== null ||
    htmlElement.getAttribute('aria-disabled') === 'true'
  ) {
    return false;
  }

  return true;
}

/**
 * Get element selection info
 */
export function getElementSelection(element: Element): ElementSelection {
  const box = getElementBox(element);
  const isVisible = isElementVisible(element);
  const isInteractable = isElementInteractable(element);

  // Generate selector
  let selector: string | undefined;
  if (element.id) {
    selector = `#${element.id}`;
  } else if (element.getAttribute('name')) {
    selector = `[name="${element.getAttribute('name')}"]`;
  } else if (element.className) {
    const classes = element.className.split(' ').filter(Boolean).join('.');
    if (classes) {
      selector = `.${classes}`;
    }
  }

  return {
    box: box || { x: 0, y: 0, width: 0, height: 0, center: [0, 0] },
    selector,
    isVisible,
    isInteractable,
  };
}

/**
 * Create highlight element
 */
export function createHighlightElement(
  box: ElementBox,
  options: HighlightOptions = {},
): HTMLElement {
  const {
    color = '#ff0000',
    borderWidth = 3,
    duration = 2000,
    fadeIn = true,
  } = options;

  const highlight = document.createElement('div');
  highlight.style.cssText = `
    position: absolute;
    left: ${box.x}px;
    top: ${box.y}px;
    width: ${box.width}px;
    height: ${box.height}px;
    border: ${borderWidth}px solid ${color};
    border-radius: 4px;
    pointer-events: none;
    z-index: 2147483647;
    box-shadow: 0 0 10px ${color}40, 0 0 20px ${color}20;
    transition: opacity ${fadeIn ? '300ms' : '0ms'} ease-in-out;
    opacity: ${fadeIn ? '0' : '1'};
  `;

  // Add label with coordinates
  const label = document.createElement('div');
  label.style.cssText = `
    position: absolute;
    top: -24px;
    left: 0;
    background: ${color};
    color: white;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-family: monospace;
    white-space: nowrap;
  `;
  label.textContent = `(${Math.round(box.center[0])}, ${Math.round(box.center[1])})`;
  highlight.appendChild(label);

  // Store duration for auto-removal
  (highlight as any).__highlightDuration = duration;

  // Trigger fade in
  if (fadeIn) {
    requestAnimationFrame(() => {
      highlight.style.opacity = '1';
    });
  }

  return highlight;
}

/**
 * Highlight an element on the page
 */
export function highlightElement(
  box: ElementBox,
  options: HighlightOptions = {},
): () => void {
  const { duration = 2000 } = options;

  // Check if highlight container exists
  let container = document.getElementById('__midscene_highlights__');
  if (!container) {
    container = document.createElement('div');
    container.id = '__midscene_highlights__';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483647;
    `;
    document.body.appendChild(container);
  }

  const highlight = createHighlightElement(box, options);
  container.appendChild(highlight);

  // Auto-remove after duration
  const timeoutId = setTimeout(() => {
    highlight.style.opacity = '0';
    setTimeout(() => {
      highlight.remove();
      if (container?.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, duration);

  // Return cleanup function
  return () => {
    clearTimeout(timeoutId);
    highlight.style.opacity = '0';
    setTimeout(() => {
      highlight.remove();
      if (container?.children.length === 0) {
        container.remove();
      }
    }, 100);
  };
}

/**
 * Clear all highlights
 */
export function clearHighlights(): void {
  const container = document.getElementById('__midscene_highlights__');
  if (container) {
    container.remove();
  }
}

/**
 * Find elements at point (with fallback)
 */
export function findElementsAtPoint(
  x: number,
  y: number,
  root: Document | Element = document,
): Element[] {
  const elements: Element[] = [];

  // First try with elementFromPoint
  const topElement = document.elementFromPoint(x, y);
  if (topElement) {
    elements.push(topElement);

    // Get all elements in the hierarchy at this point
    let current: Element | null = topElement;
    while (current && current !== root) {
      // Also include siblings that might overlap
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children);
        for (const sibling of siblings) {
          if (sibling !== current) {
            const rect = sibling.getBoundingClientRect();
            if (
              x >= rect.left &&
              x <= rect.right &&
              y >= rect.top &&
              y <= rect.bottom
            ) {
              if (!elements.includes(sibling)) {
                elements.push(sibling);
              }
            }
          }
        }
      }
      current = current.parentElement;
    }
  }

  return elements;
}

/**
 * Find best interactable element near point
 */
export function findInteractableElementNear(
  x: number,
  y: number,
  radius = 50,
): Element | null {
  // Search in expanding radius
  for (const r of [radius, radius * 2, radius * 3]) {
    const elements = document.elementsFromPoint(x, y);
    for (const element of elements) {
      if (element instanceof Element) {
        const box = getElementBox(element, false);
        if (box) {
          const distance = Math.sqrt(
            Math.pow(box.center[0] - x, 2) + Math.pow(box.center[1] - y, 2),
          );
          if (distance <= r && isElementInteractable(element)) {
            return element;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Compare two element boxes for equality
 */
export function isSameBox(a: ElementBox, b: ElementBox, tolerance = 5): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance &&
    Math.abs(a.height - b.height) <= tolerance
  );
}

/**
 * Clamp box to viewport
 */
export function clampBoxToViewport(box: ElementBox): ElementBox {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return {
    x: Math.max(0, Math.min(box.x, viewportWidth - box.width)),
    y: Math.max(0, Math.min(box.y, viewportHeight - box.height)),
    width: Math.min(box.width, viewportWidth),
    height: Math.min(box.height, viewportHeight),
    center: box.center,
  };
}

/**
 * Get viewport-relative box from page-absolute box
 */
export function viewportToPageBox(box: ElementBox): ElementBox {
  return {
    x: box.x + window.scrollX,
    y: box.y + window.scrollY,
    width: box.width,
    height: box.height,
    center: [box.center[0] + window.scrollX, box.center[1] + window.scrollY],
  };
}

/**
 * Get page-absolute box from viewport-relative box
 */
export function pageToViewportBox(box: ElementBox): ElementBox {
  return {
    x: box.x - window.scrollX,
    y: box.y - window.scrollY,
    width: box.width,
    height: box.height,
    center: [box.center[0] - window.scrollX, box.center[1] - window.scrollY],
  };
}
