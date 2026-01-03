/**
 * Region Detector
 * Detects sensitive regions in the DOM for screenshot masking
 */

import type { MaskRegion, SensitiveCategory } from '../../types/masking';

/**
 * Element info with bounding rectangle
 */
export interface ElementInfo {
  element: Element;
  rect: DOMRect;
  type: SensitiveElementType;
  category: SensitiveCategory;
  selector?: string;
}

/**
 * Sensitive element types
 */
export type SensitiveElementType =
  | 'password'
  | 'credit-card'
  | 'email'
  | 'phone'
  | 'ssn'
  | 'api-key'
  | 'token'
  | 'secret'
  | 'custom';

/**
 * Detection selector configuration
 */
export interface DetectionSelector {
  selector: string;
  type: SensitiveElementType;
  category: SensitiveCategory;
  labelPatterns?: RegExp[];
}

/**
 * Built-in selectors for sensitive elements
 */
const BUILT_IN_SELECTORS: DetectionSelector[] = [
  // Password fields
  {
    selector: 'input[type="password"]',
    type: 'password',
    category: 'credential',
  },
  {
    selector: 'input[autocomplete="current-password"]',
    type: 'password',
    category: 'credential',
  },
  {
    selector: 'input[autocomplete="new-password"]',
    type: 'password',
    category: 'credential',
  },

  // Credit card fields
  {
    selector: 'input[autocomplete="cc-number"]',
    type: 'credit-card',
    category: 'financial',
  },
  {
    selector: 'input[autocomplete="cc-csc"]',
    type: 'credit-card',
    category: 'financial',
  },
  {
    selector: 'input[autocomplete="cc-exp"]',
    type: 'credit-card',
    category: 'financial',
  },
  {
    selector: 'input[name*="card"][name*="number"]',
    type: 'credit-card',
    category: 'financial',
  },
  {
    selector: 'input[name*="cvv"]',
    type: 'credit-card',
    category: 'financial',
  },
  {
    selector: 'input[name*="cvc"]',
    type: 'credit-card',
    category: 'financial',
  },

  // Email fields
  {
    selector: 'input[type="email"]',
    type: 'email',
    category: 'pii',
  },
  {
    selector: 'input[autocomplete="email"]',
    type: 'email',
    category: 'pii',
  },

  // Phone fields
  {
    selector: 'input[type="tel"]',
    type: 'phone',
    category: 'pii',
  },
  {
    selector: 'input[autocomplete="tel"]',
    type: 'phone',
    category: 'pii',
  },

  // Social security / ID numbers
  {
    selector: 'input[name*="ssn"]',
    type: 'ssn',
    category: 'pii',
  },
  {
    selector: 'input[name*="social"][name*="security"]',
    type: 'ssn',
    category: 'pii',
  },
  {
    selector: 'input[name*="id"][name*="number"]',
    type: 'ssn',
    category: 'pii',
  },

  // API keys and tokens (common patterns in developer tools)
  {
    selector: 'input[name*="api"][name*="key"]',
    type: 'api-key',
    category: 'credential',
  },
  {
    selector: 'input[name*="token"]',
    type: 'token',
    category: 'credential',
  },
  {
    selector: 'input[name*="secret"]',
    type: 'secret',
    category: 'credential',
  },
  {
    selector: 'textarea[name*="key"]',
    type: 'api-key',
    category: 'credential',
  },
  {
    selector: 'textarea[name*="secret"]',
    type: 'secret',
    category: 'credential',
  },
];

/**
 * Label patterns for detecting sensitive fields by their labels
 */
const LABEL_PATTERNS: { patterns: RegExp[]; type: SensitiveElementType; category: SensitiveCategory }[] = [
  {
    patterns: [/password/i, /密码/i, /口令/i],
    type: 'password',
    category: 'credential',
  },
  {
    patterns: [/card\s*number/i, /卡号/i, /信用卡/i],
    type: 'credit-card',
    category: 'financial',
  },
  {
    patterns: [/cvv/i, /cvc/i, /安全码/i],
    type: 'credit-card',
    category: 'financial',
  },
  {
    patterns: [/email/i, /邮箱/i, /电子邮件/i],
    type: 'email',
    category: 'pii',
  },
  {
    patterns: [/phone/i, /手机/i, /电话/i, /mobile/i],
    type: 'phone',
    category: 'pii',
  },
  {
    patterns: [/ssn/i, /social\s*security/i, /身份证/i],
    type: 'ssn',
    category: 'pii',
  },
  {
    patterns: [/api\s*key/i, /access\s*key/i],
    type: 'api-key',
    category: 'credential',
  },
  {
    patterns: [/token/i, /令牌/i],
    type: 'token',
    category: 'credential',
  },
  {
    patterns: [/secret/i, /私钥/i],
    type: 'secret',
    category: 'credential',
  },
];

/**
 * RegionDetector configuration
 */
export interface RegionDetectorConfig {
  includeHidden: boolean;
  padding: number;
  customSelectors: DetectionSelector[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RegionDetectorConfig = {
  includeHidden: false,
  padding: 4,
  customSelectors: [],
};

/**
 * RegionDetector class
 * Detects sensitive elements in the DOM and returns their regions
 */
export class RegionDetector {
  private config: RegionDetectorConfig;
  private selectors: DetectionSelector[];

  constructor(config: Partial<RegionDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.selectors = [...BUILT_IN_SELECTORS, ...this.config.customSelectors];
  }

  /**
   * Detect sensitive elements in the current document
   * @param root - Root element to search within (defaults to document)
   * @returns Array of element info with bounding rectangles
   */
  detectSensitiveElements(root: Document | Element = document): ElementInfo[] {
    const elements: ElementInfo[] = [];

    // Detect by selector
    for (const selector of this.selectors) {
      const matches = root.querySelectorAll(selector.selector);
      for (const element of matches) {
        if (!this.isElementVisible(element) && !this.config.includeHidden) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          continue;
        }

        elements.push({
          element,
          rect,
          type: selector.type,
          category: selector.category,
          selector: selector.selector,
        });
      }
    }

    // Detect by label patterns
    const labeledElements = this.detectByLabels(root);
    elements.push(...labeledElements);

    // Remove duplicates (same element detected by multiple selectors)
    return this.deduplicateElements(elements);
  }

  /**
   * Detect elements by their associated labels
   */
  private detectByLabels(root: Document | Element): ElementInfo[] {
    const elements: ElementInfo[] = [];
    const inputs = root.querySelectorAll('input, textarea');

    for (const input of inputs) {
      // Skip already detected types
      if (input.getAttribute('type') === 'password') {
        continue;
      }

      const labelText = this.getElementLabel(input);
      if (!labelText) {
        continue;
      }

      for (const { patterns, type, category } of LABEL_PATTERNS) {
        if (patterns.some((pattern) => pattern.test(labelText))) {
          const rect = input.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            continue;
          }

          elements.push({
            element: input,
            rect,
            type,
            category,
          });
          break;
        }
      }
    }

    return elements;
  }

  /**
   * Get the label text for an input element
   */
  private getElementLabel(element: Element): string {
    const labels: string[] = [];

    // Check for associated label element
    const id = element.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        labels.push(label.textContent || '');
      }
    }

    // Check for parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      labels.push(parentLabel.textContent || '');
    }

    // Check for aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      labels.push(ariaLabel);
    }

    // Check for placeholder
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      labels.push(placeholder);
    }

    // Check for name attribute
    const name = element.getAttribute('name');
    if (name) {
      labels.push(name);
    }

    return labels.join(' ');
  }

  /**
   * Check if an element is visible
   */
  private isElementVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      (element as HTMLElement).offsetParent !== null
    );
  }

  /**
   * Remove duplicate elements from the list
   */
  private deduplicateElements(elements: ElementInfo[]): ElementInfo[] {
    const seen = new Set<Element>();
    return elements.filter((info) => {
      if (seen.has(info.element)) {
        return false;
      }
      seen.add(info.element);
      return true;
    });
  }

  /**
   * Convert detected elements to mask regions
   * @param elements - Array of element info
   * @param scrollOffset - Current scroll position for coordinate adjustment
   * @returns Array of mask regions
   */
  elementsToMaskRegions(
    elements: ElementInfo[],
    scrollOffset: { x: number; y: number } = { x: 0, y: 0 },
  ): MaskRegion[] {
    return elements.map((info) => ({
      x: Math.max(0, info.rect.left + scrollOffset.x - this.config.padding),
      y: Math.max(0, info.rect.top + scrollOffset.y - this.config.padding),
      width: info.rect.width + this.config.padding * 2,
      height: info.rect.height + this.config.padding * 2,
      type: 'blur' as const,
      category: info.category,
    }));
  }

  /**
   * Detect and convert to mask regions in one step
   */
  detectMaskRegions(
    root: Document | Element = document,
    scrollOffset: { x: number; y: number } = { x: 0, y: 0 },
  ): MaskRegion[] {
    const elements = this.detectSensitiveElements(root);
    return this.elementsToMaskRegions(elements, scrollOffset);
  }

  /**
   * Add a custom selector
   */
  addSelector(selector: DetectionSelector): void {
    this.selectors.push(selector);
    this.config.customSelectors.push(selector);
  }

  /**
   * Remove a custom selector
   */
  removeSelector(selectorString: string): boolean {
    const index = this.config.customSelectors.findIndex((s) => s.selector === selectorString);
    if (index !== -1) {
      this.config.customSelectors.splice(index, 1);
      // Rebuild selectors
      this.selectors = [...BUILT_IN_SELECTORS, ...this.config.customSelectors];
      return true;
    }
    return false;
  }

  /**
   * Get all selectors
   */
  getSelectors(): DetectionSelector[] {
    return [...this.selectors];
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<RegionDetectorConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.customSelectors) {
      this.selectors = [...BUILT_IN_SELECTORS, ...config.customSelectors];
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RegionDetectorConfig {
    return { ...this.config };
  }
}

/**
 * Default region detector instance
 */
export const regionDetector = new RegionDetector();

/**
 * Utility function to detect and mask regions for a screenshot
 * @param root - Root element to search within
 * @returns Array of mask regions
 */
export function detectScreenshotMaskRegions(root: Document | Element = document): MaskRegion[] {
  const scrollOffset = {
    x: window.scrollX || 0,
    y: window.scrollY || 0,
  };
  return regionDetector.detectMaskRegions(root, scrollOffset);
}
