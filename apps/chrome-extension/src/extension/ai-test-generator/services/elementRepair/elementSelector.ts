/**
 * Element Selector Service
 * Handles interactive element selection from the page
 */

import type { Rect } from '@midscene/core';
import type { ChromeExtensionProxyPageAgent } from '@midscene/web/chrome-extension';
import type {
  ElementPickerConfig,
  ElementSelector,
  IElementSelector,
  SelectedElement,
  SelectionMode,
  SelectionState,
} from '../../types/elementRepair';
import { DEFAULT_ELEMENT_PICKER_CONFIG } from '../../types/elementRepair';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate center point of a rect
 */
function getCenter(rect: Rect): [number, number] {
  return [
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  ];
}

/**
 * Check if element is visible
 */
function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Get element path for CSS selector
 */
function getElementPath(el: HTMLElement): string {
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }

  const path: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }

    if (current.className) {
      const classes = current.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        selector += '.' + classes.map(c => CSS.escape(c)).join('.');
      }
    }

    // Add nth-child if needed
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const index = siblings.indexOf(current) + 1;
      selector += `:nth-child(${index})`;
    }

    path.unshift(selector);
    current = current.parentElement;

    if (path.length > 5) break; // Limit depth
  }

  return path.join(' > ');
}

/**
 * Generate XPath for element
 */
function getXPath(el: HTMLElement): string {
  if (el.id) {
    return `//*[@id="${CSS.escape(el.id)}"]`;
  }

  const parts: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current !== document.body) {
    let index = 0;
    let sibling: HTMLElement | null = current;

    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling as HTMLElement | null;
    }

    const tagName = current.tagName.toLowerCase();
    const pathIndex = index > 0 ? `[${index}]` : '';
    parts.unshift(`${tagName}${pathIndex}`);

    current = current.parentElement;

    if (parts.length > 5) break; // Limit depth
  }

  return '/' + parts.join('/');
}

/**
 * Get text content for selector
 */
function getTextSelector(el: HTMLElement): string | null {
  const text = el.textContent?.trim();
  if (text && text.length > 0 && text.length < 100) {
    return `text="${text}"`;
  }
  return null;
}

/**
 * Check for data-testid
 */
function getDataTestIdSelector(el: HTMLElement): string | null {
  const testId = el.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }
  return null;
}

/**
 * Element Selector Service Implementation
 */
export class ElementSelectorService implements IElementSelector {
  private state: SelectionState = 'idle';
  private config: ElementPickerConfig;
  private selectedElement: SelectedElement | null = null;
  private overlayElement: HTMLDivElement | null = null;
  private tooltipElement: HTMLDivElement | null = null;
  private agent: ChromeExtensionProxyPageAgent | null = null;
  private eventListeners: Array<{
    target: EventTarget;
    type: string;
    handler: EventListenerOrEventListenerObject;
    options?: AddEventListenerOptions;
  }> = [];

  constructor() {
    this.config = { ...DEFAULT_ELEMENT_PICKER_CONFIG };
  }

  /**
   * Set the agent for AI operations
   */
  setAgent(agent: ChromeExtensionProxyPageAgent): void {
    this.agent = agent;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ElementPickerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ElementPickerConfig {
    return { ...this.config };
  }

  /**
   * Start selection mode
   */
  async startSelection(config?: Partial<ElementPickerConfig>): Promise<void> {
    if (this.state === 'selecting') {
      return;
    }

    if (config) {
      this.updateConfig(config);
    }

    this.state = 'selecting';
    this.createOverlay();
    this.attachEventListeners();
  }

  /**
   * Stop selection mode
   */
  stopSelection(): void {
    if (this.state !== 'selecting') {
      return;
    }

    this.state = 'idle';
    this.removeOverlay();
    this.detachEventListeners();
  }

  /**
   * Get current selection state
   */
  getSelectionState(): SelectionState {
    return this.state;
  }

  /**
   * Get selected element
   */
  getSelectedElement(): SelectedElement | null {
    return this.selectedElement;
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedElement = null;
    this.removeHighlight();
  }

  /**
   * Highlight element at position
   */
  async highlightElement(x: number, y: number): Promise<SelectedElement | null> {
    const element = document.elementFromPoint(x, y) as HTMLElement;
    if (!element) {
      return null;
    }

    // Filter out blocked tags
    const tagName = element.tagName.toLowerCase();
    if (this.config.blockedTags.includes(tagName)) {
      return null;
    }

    // Check visibility
    if (this.config.filterInvisible && !isElementVisible(element)) {
      return null;
    }

    // Get element rect
    const rect = element.getBoundingClientRect();
    if (rect.width < this.config.minElementSize || rect.height < this.config.minElementSize) {
      return null;
    }

    // Highlight the element
    this.highlightRect(rect);

    // Show tooltip
    if (this.config.showTooltip) {
      this.showTooltip(element, rect);
    }

    // Create selected element info
    const selectedElement = await this.createSelectedElement(element, rect);
    this.selectedElement = selectedElement;

    return selectedElement;
  }

  /**
   * Generate selectors for element
   */
  generateSelectors(element: HTMLElement): ElementSelector[] {
    const selectors: ElementSelector[] = [];

    // Data-testid (highest priority)
    const dataTestId = getDataTestIdSelector(element);
    if (dataTestId) {
      selectors.push({
        type: 'data-testid',
        value: dataTestId,
        priority: 100,
        reason: 'Most stable selector for testing',
      });
    }

    // ID selector
    if (element.id) {
      selectors.push({
        type: 'css',
        value: `#${CSS.escape(element.id)}`,
        priority: 90,
        reason: 'Unique ID attribute',
      });
    }

    // Class selector (if meaningful)
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0 && classes.length < 5) {
        selectors.push({
          type: 'css',
          value: element.tagName.toLowerCase() + '.' + classes.map(c => CSS.escape(c)).join('.'),
          priority: 70,
          reason: 'CSS class selector',
        });
      }
    }

    // Path selector
    const path = getElementPath(element);
    selectors.push({
      type: 'css',
      value: path,
      priority: 60,
      reason: 'DOM path selector',
    });

    // XPath
    const xpath = getXPath(element);
    selectors.push({
      type: 'xpath',
      value: xpath,
      priority: 50,
      reason: 'XPath selector',
    });

    // Text selector
    const text = getTextSelector(element);
    if (text) {
      selectors.push({
        type: 'text',
        value: text,
        priority: 80,
        reason: 'Text content selector',
      });
    }

    // Sort by priority
    return selectors.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Validate selector
   */
  async validateSelector(selector: string): Promise<boolean> {
    try {
      if (selector.startsWith('text=')) {
        const text = selector.slice(6, -1);
        const elements = Array.from(document.querySelectorAll('*'));
        return elements.some(el => el.textContent?.trim() === text);
      }

      if (selector.startsWith('/')) {
        // XPath
        const result = document.evaluate(
          selector,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        );
        return result.singleNodeValue !== null;
      }

      // CSS selector
      const element = document.querySelector(selector);
      return element !== null;
    } catch {
      return false;
    }
  }

  // ==================== Private Methods ====================

  /**
   * Create overlay for selection
   */
  private createOverlay(): void {
    if (this.overlayElement) {
      return;
    }

    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'midscene-element-selector-overlay';
    Object.assign(this.overlayElement.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483646',
      pointerEvents: 'none',
      border: '2px dashed #1890ff',
      boxSizing: 'border-box',
      display: 'none',
      backgroundColor: 'rgba(24, 144, 255, 0.1)',
    });

    document.body.appendChild(this.overlayElement);
  }

  /**
   * Remove overlay
   */
  private removeOverlay(): void {
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
  }

  /**
   * Attach event listeners for selection
   */
  private attachEventListeners(): void {
    const mouseMoveHandler: EventListener = (e: Event) => {
      if (this.state !== 'selecting') return;
      this.handleMouseMove(e as MouseEvent);
    };

    const clickHandler: EventListener = (e: Event) => {
      if (this.state !== 'selecting') return;
      e.preventDefault();
      e.stopPropagation();
      this.handleElementClick(e as MouseEvent);
    };

    const keyDownHandler: EventListener = (e: Event) => {
      if ((e as KeyboardEvent).key === 'Escape') {
        this.stopSelection();
      }
    };

    document.addEventListener('mousemove', mouseMoveHandler, { capture: true });
    document.addEventListener('click', clickHandler, { capture: true });
    document.addEventListener('keydown', keyDownHandler);

    this.eventListeners.push(
      { target: document, type: 'mousemove', handler: mouseMoveHandler, options: { capture: true } },
      { target: document, type: 'click', handler: clickHandler, options: { capture: true } },
      { target: document, type: 'keydown', handler: keyDownHandler },
    );
  }

  /**
   * Detach event listeners
   */
  private detachEventListeners(): void {
    this.eventListeners.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });
    this.eventListeners = [];
  }

  /**
   * Handle mouse move during selection
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.config.highlightElements) return;

    const element = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    this.highlightRect(rect);
  }

  /**
   * Handle element click
   */
  private handleElementClick(e: MouseEvent): void {
    const element = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    this.state = 'selected';

    // Create selected element asynchronously
    this.createSelectedElement(element, rect).then((selectedElement) => {
      this.selectedElement = selectedElement;

      // Dispatch custom event with selected element
      const event = new CustomEvent('midscene-element-selected', {
        detail: { selectedElement },
      });
      document.dispatchEvent(event);
    });
  }

  /**
   * Highlight a rect
   */
  private highlightRect(rect: DOMRect): void {
    if (!this.overlayElement) return;

    Object.assign(this.overlayElement.style, {
      display: 'block',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  /**
   * Remove highlight
   */
  private removeHighlight(): void {
    if (!this.overlayElement) return;
    this.overlayElement.style.display = 'none';
  }

  /**
   * Show tooltip with element info
   */
  private showTooltip(element: HTMLElement, rect: DOMRect): void {
    if (!this.tooltipElement) {
      this.tooltipElement = document.createElement('div');
      this.tooltipElement.id = 'midscene-element-tooltip';
      Object.assign(this.tooltipElement.style, {
        position: 'fixed',
        zIndex: '2147483647',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace',
        maxWidth: '300px',
        wordBreak: 'break-all',
        pointerEvents: 'none',
      });
      document.body.appendChild(this.tooltipElement);
    }

    const tagName = element.tagName.toLowerCase();
    const idInfo = element.id ? `#${element.id}` : '';
    const classInfo = element.className ? `.${element.className.split(' ')[0]}` : '';

    this.tooltipElement.textContent = `<${tagName}${idInfo}${classInfo}>`;

    // Position tooltip above the element
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    let top = rect.top - tooltipRect.height - 8;
    let left = rect.left;

    if (top < 0) {
      top = rect.bottom + 8;
    }
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 8;
    }

    Object.assign(this.tooltipElement.style, {
      top: `${top}px`,
      left: `${left}px`,
    });
  }

  /**
   * Create selected element info
   */
  private async createSelectedElement(
    element: HTMLElement,
    rect: DOMRect,
  ): Promise<SelectedElement> {
    const elementRect: Rect = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };

    // Collect attributes
    const attributes: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }

    // Generate selectors
    const suggestedSelectors = this.generateSelectors(element);

    // Get semantic description from AI if available
    let semanticDescription: string | undefined;
    if (this.agent) {
      try {
        const center = getCenter(elementRect);
        const describeResult = await this.agent.describeElementAtPoint(center, {
          verifyPrompt: true,
          retryLimit: 2,
        });
        semanticDescription = describeResult.prompt;
      } catch {
        // Fallback to element tag and text
        const text = element.textContent?.trim().slice(0, 50);
        semanticDescription = text
          ? `${element.tagName.toLowerCase()} containing "${text}"`
          : element.tagName.toLowerCase();
      }
    }

    return {
      elementId: generateId(),
      rect: elementRect,
      center: getCenter(elementRect),
      attributes,
      suggestedSelectors,
      semanticDescription,
    };
  }
}

// Export singleton instance
export const elementSelector = new ElementSelectorService();
