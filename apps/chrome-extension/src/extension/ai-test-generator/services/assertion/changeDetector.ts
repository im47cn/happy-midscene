/**
 * Change Detector for Smart Assertion System
 * Detects visual and DOM changes between page states
 */

import type {
  VisualChange,
  BoundingBox,
  ElementInfo,
} from '../../types/assertion';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `chg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * DOM snapshot for comparison
 */
interface DOMSnapshot {
  url: string;
  title: string;
  elements: SnapshotElement[];
  timestamp: number;
}

/**
 * Element snapshot data
 */
interface SnapshotElement {
  id: string;
  tagName: string;
  text: string;
  attributes: Record<string, string>;
  boundingBox: BoundingBox;
  isVisible: boolean;
  hash: string;
}

/**
 * Calculate element hash for comparison
 */
function calculateElementHash(el: SnapshotElement): string {
  const data = `${el.tagName}|${el.text}|${JSON.stringify(el.attributes)}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Get bounding box of an element
 */
function getBoundingBox(element: Element): BoundingBox {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Check if element is visible
 */
function isElementVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    style.opacity !== '0'
  );
}

/**
 * Get element attributes as object
 */
function getElementAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of element.attributes) {
    if (['class', 'id', 'role', 'type', 'name', 'aria-label', 'placeholder', 'value', 'href', 'src'].includes(attr.name)) {
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}

/**
 * Get text content of element
 */
function getElementText(element: Element): string {
  // Get direct text content, not from children
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent?.trim() || '';
    }
  }
  return text || element.textContent?.trim().substring(0, 100) || '';
}

/**
 * Check if elements are similar by position
 */
function isSimilarPosition(box1: BoundingBox, box2: BoundingBox, threshold = 50): boolean {
  return (
    Math.abs(box1.x - box2.x) < threshold &&
    Math.abs(box1.y - box2.y) < threshold &&
    Math.abs(box1.width - box2.width) < threshold &&
    Math.abs(box1.height - box2.height) < threshold
  );
}

/**
 * Classify the type of visual change
 */
function classifyChange(
  description: string,
  tagName: string,
  attributes: Record<string, string>
): { confidence: number; isImportant: boolean } {
  const lowerDesc = description.toLowerCase();
  const lowerTag = tagName.toLowerCase();

  // High confidence: Modal, dialog, toast, alert
  if (/modal|dialog|toast|alert|popup|notification/i.test(lowerDesc) ||
      attributes.role === 'dialog' ||
      attributes.role === 'alertdialog') {
    return { confidence: 95, isImportant: true };
  }

  // High confidence: Success/error messages
  if (/成功|success|完成|done|错误|error|失败|failed/i.test(lowerDesc)) {
    return { confidence: 90, isImportant: true };
  }

  // Medium confidence: Form elements
  if (['input', 'select', 'textarea', 'button'].includes(lowerTag)) {
    return { confidence: 75, isImportant: true };
  }

  // Medium confidence: Links and navigational elements
  if (['a', 'nav'].includes(lowerTag)) {
    return { confidence: 70, isImportant: false };
  }

  // Lower confidence: Generic divs and spans
  if (['div', 'span', 'p'].includes(lowerTag)) {
    return { confidence: 50, isImportant: false };
  }

  return { confidence: 60, isImportant: false };
}

/**
 * Change Detector class
 */
class ChangeDetector {
  private beforeSnapshot: DOMSnapshot | null = null;

  /**
   * Capture DOM snapshot
   */
  captureSnapshot(): DOMSnapshot | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const elements: SnapshotElement[] = [];

    // Select important elements for monitoring
    const selectors = [
      // Interactive elements
      'button',
      'a',
      'input',
      'select',
      'textarea',
      // Content elements
      '[role="alert"]',
      '[role="dialog"]',
      '[role="status"]',
      '[role="button"]',
      '.message',
      '.alert',
      '.toast',
      '.notification',
      '.modal',
      '.dialog',
      '.error',
      '.success',
      '.warning',
      // Tables and lists
      'table',
      'ul',
      'ol',
      // Headers
      'h1',
      'h2',
      'h3',
    ];

    const selectedElements = document.querySelectorAll(selectors.join(','));

    for (const element of selectedElements) {
      const boundingBox = getBoundingBox(element);
      const isVisible = isElementVisible(element);

      // Skip tiny or invisible elements
      if (boundingBox.width < 5 || boundingBox.height < 5 || !isVisible) {
        continue;
      }

      const snapshotEl: SnapshotElement = {
        id: generateId(),
        tagName: element.tagName.toLowerCase(),
        text: getElementText(element),
        attributes: getElementAttributes(element),
        boundingBox,
        isVisible,
        hash: '',
      };
      snapshotEl.hash = calculateElementHash(snapshotEl);
      elements.push(snapshotEl);
    }

    return {
      url: window.location.href,
      title: document.title,
      elements,
      timestamp: Date.now(),
    };
  }

  /**
   * Start detection by capturing before state
   */
  startDetection(): void {
    this.beforeSnapshot = this.captureSnapshot();
  }

  /**
   * Detect changes between before and after states
   */
  detectChanges(): VisualChange[] {
    if (!this.beforeSnapshot) {
      return [];
    }

    const afterSnapshot = this.captureSnapshot();
    if (!afterSnapshot) {
      return [];
    }

    const changes: VisualChange[] = [];
    const beforeHashes = new Set(this.beforeSnapshot.elements.map(e => e.hash));
    const afterHashes = new Set(afterSnapshot.elements.map(e => e.hash));

    // Find new elements (appeared)
    for (const afterEl of afterSnapshot.elements) {
      if (!beforeHashes.has(afterEl.hash)) {
        const { confidence, isImportant } = classifyChange(
          afterEl.text,
          afterEl.tagName,
          afterEl.attributes
        );

        if (isImportant || confidence >= 60) {
          changes.push({
            type: 'appeared',
            region: afterEl.boundingBox,
            description: afterEl.text || `${afterEl.tagName} element`,
            confidence: confidence / 100,
            elementInfo: {
              text: afterEl.text,
              tagName: afterEl.tagName,
              attributes: afterEl.attributes,
              boundingBox: afterEl.boundingBox,
              isVisible: afterEl.isVisible,
            },
          });
        }
      }
    }

    // Find removed elements (disappeared)
    for (const beforeEl of this.beforeSnapshot.elements) {
      if (!afterHashes.has(beforeEl.hash)) {
        const { confidence, isImportant } = classifyChange(
          beforeEl.text,
          beforeEl.tagName,
          beforeEl.attributes
        );

        if (isImportant || confidence >= 60) {
          changes.push({
            type: 'disappeared',
            region: beforeEl.boundingBox,
            description: beforeEl.text || `${beforeEl.tagName} element`,
            confidence: confidence / 100,
            elementInfo: {
              text: beforeEl.text,
              tagName: beforeEl.tagName,
              attributes: beforeEl.attributes,
              boundingBox: beforeEl.boundingBox,
              isVisible: false,
            },
          });
        }
      }
    }

    // Find modified elements (position or content changed)
    for (const beforeEl of this.beforeSnapshot.elements) {
      for (const afterEl of afterSnapshot.elements) {
        // Same text content but different hash means modification
        if (
          beforeEl.text === afterEl.text &&
          beforeEl.tagName === afterEl.tagName &&
          beforeEl.hash !== afterEl.hash
        ) {
          if (isSimilarPosition(beforeEl.boundingBox, afterEl.boundingBox)) {
            const { confidence } = classifyChange(
              afterEl.text,
              afterEl.tagName,
              afterEl.attributes
            );

            changes.push({
              type: 'modified',
              region: afterEl.boundingBox,
              description: afterEl.text || `${afterEl.tagName} modified`,
              confidence: confidence / 100,
              elementInfo: {
                text: afterEl.text,
                tagName: afterEl.tagName,
                attributes: afterEl.attributes,
                boundingBox: afterEl.boundingBox,
                isVisible: afterEl.isVisible,
              },
            });
          }
        }
      }
    }

    // Reset before snapshot
    this.beforeSnapshot = null;

    // Sort by confidence and limit results
    return changes
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  /**
   * Detect URL change
   */
  detectUrlChange(beforeUrl: string, afterUrl: string): VisualChange | null {
    if (beforeUrl === afterUrl) {
      return null;
    }

    try {
      const beforePath = new URL(beforeUrl).pathname;
      const afterPath = new URL(afterUrl).pathname;

      return {
        type: 'modified',
        region: { x: 0, y: 0, width: 0, height: 0 },
        description: `页面从 ${beforePath} 跳转到 ${afterPath}`,
        confidence: 1.0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect title change
   */
  detectTitleChange(beforeTitle: string, afterTitle: string): VisualChange | null {
    if (beforeTitle === afterTitle || !afterTitle) {
      return null;
    }

    return {
      type: 'modified',
      region: { x: 0, y: 0, width: 0, height: 0 },
      description: `页面标题变为 "${afterTitle}"`,
      confidence: 0.9,
    };
  }

  /**
   * Quick check if any significant change occurred
   */
  hasSignificantChanges(): boolean {
    const changes = this.detectChanges();
    return changes.some(c => c.confidence >= 0.7);
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.beforeSnapshot = null;
  }
}

// Export singleton instance
export const changeDetector = new ChangeDetector();

// Export class for testing
export { ChangeDetector };
