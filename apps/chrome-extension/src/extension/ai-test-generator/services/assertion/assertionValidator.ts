/**
 * Assertion Validator for Smart Assertion System
 * Validates assertions against the current page state
 */

import type {
  AssertionRecommendation,
  ValidationResult,
  AssertionType,
  AssertionParams,
} from '../../types/assertion';

/**
 * Validation timeout in milliseconds
 */
const VALIDATION_TIMEOUT = 2000;

/**
 * Check if text exists on the page
 */
function checkTextExists(text: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const bodyText = document.body?.innerText || '';
  return bodyText.toLowerCase().includes(text.toLowerCase());
}

/**
 * Check if element with text exists
 */
function findElementByText(text: string): Element | null {
  if (typeof document === 'undefined') {
    return null;
  }

  // Try exact match first
  const xpath = `//*[contains(text(), '${text.replace(/'/g, "\\'")}')]`;
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element | null;
  } catch {
    return null;
  }
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
 * Check current URL
 */
function checkUrl(expected: string, operator: 'contains' | 'equals' = 'contains'): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const currentUrl = window.location.href;

  if (operator === 'equals') {
    return currentUrl === expected;
  }

  return currentUrl.includes(expected);
}

/**
 * Get element value (for input elements)
 */
function getElementValue(element: Element): string {
  if (element instanceof HTMLInputElement) {
    return element.value;
  }
  if (element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  if (element instanceof HTMLSelectElement) {
    return element.value;
  }
  return element.textContent || '';
}

/**
 * Check element state (enabled/disabled/checked)
 */
function checkElementState(
  element: Element,
  state: 'enabled' | 'disabled' | 'checked' | 'unchecked'
): boolean {
  if (element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement) {

    switch (state) {
      case 'enabled':
        return !element.disabled;
      case 'disabled':
        return element.disabled;
      case 'checked':
        return element instanceof HTMLInputElement && element.checked;
      case 'unchecked':
        return element instanceof HTMLInputElement && !element.checked;
    }
  }

  return false;
}

/**
 * Count elements matching a selector or text
 */
function countElements(target: string): number {
  if (typeof document === 'undefined') {
    return 0;
  }

  // Try as selector first
  try {
    const elements = document.querySelectorAll(target);
    return elements.length;
  } catch {
    // Fall back to text search
    const xpath = `//*[contains(text(), '${target.replace(/'/g, "\\'")}')]`;
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      return result.snapshotLength;
    } catch {
      return 0;
    }
  }
}

/**
 * Assertion Validator class
 */
class AssertionValidator {
  /**
   * Validate an assertion recommendation
   */
  async validate(assertion: AssertionRecommendation): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(
        () => this.executeAssertion(assertion),
        VALIDATION_TIMEOUT
      );

      return {
        success: result.success,
        duration: Date.now() - startTime,
        error: result.error,
        actualValue: result.actualValue,
        expectedValue: assertion.parameters.expectedValue,
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute assertion with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Validation timeout'));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Execute assertion based on type
   */
  private async executeAssertion(
    assertion: AssertionRecommendation
  ): Promise<{ success: boolean; error: string | null; actualValue?: string }> {
    const { type, parameters } = assertion;

    switch (type) {
      case 'text_contains':
        return this.validateTextContains(parameters);

      case 'text_equals':
        return this.validateTextEquals(parameters);

      case 'element_exists':
        return this.validateElementExists(parameters);

      case 'element_visible':
        return this.validateElementVisible(parameters);

      case 'url_contains':
        return this.validateUrlContains(parameters);

      case 'url_equals':
        return this.validateUrlEquals(parameters);

      case 'value_equals':
        return this.validateValueEquals(parameters);

      case 'count_equals':
        return this.validateCountEquals(parameters);

      case 'enabled':
      case 'disabled':
      case 'checked':
      case 'unchecked':
        return this.validateState(parameters, type);

      case 'state_check':
        return this.validateStateCheck(parameters);

      case 'attribute_equals':
        return this.validateAttributeEquals(parameters);

      default:
        return {
          success: false,
          error: `Unknown assertion type: ${type}`,
        };
    }
  }

  /**
   * Validate text_contains assertion
   */
  private async validateTextContains(
    params: AssertionParams
  ): Promise<{ success: boolean; error: string | null; actualValue?: string }> {
    const target = params.target || params.expectedValue || '';
    const exists = checkTextExists(target);

    return {
      success: exists,
      error: exists ? null : `Text "${target}" not found on page`,
    };
  }

  /**
   * Validate text_equals assertion
   */
  private async validateTextEquals(
    params: AssertionParams
  ): Promise<{ success: boolean; error: string | null; actualValue?: string }> {
    const target = params.target || '';
    const expected = params.expectedValue || '';
    const element = findElementByText(target);

    if (!element) {
      return {
        success: false,
        error: `Element with text "${target}" not found`,
      };
    }

    const actualText = element.textContent?.trim() || '';
    const matches = actualText === expected;

    return {
      success: matches,
      error: matches ? null : `Expected "${expected}", got "${actualText}"`,
      actualValue: actualText,
    };
  }

  /**
   * Validate element_exists assertion
   */
  private async validateElementExists(
    params: AssertionParams
  ): Promise<{ success: boolean; error: string | null }> {
    const target = params.target || '';
    const element = findElementByText(target);

    return {
      success: element !== null,
      error: element ? null : `Element "${target}" not found`,
    };
  }

  /**
   * Validate element_visible assertion
   */
  private async validateElementVisible(
    params: AssertionParams
  ): Promise<{ success: boolean; error: string | null }> {
    const target = params.target || '';
    const element = findElementByText(target);

    if (!element) {
      return {
        success: false,
        error: `Element "${target}" not found`,
      };
    }

    const visible = isElementVisible(element);

    return {
      success: visible,
      error: visible ? null : `Element "${target}" exists but is not visible`,
    };
  }

  /**
   * Validate url_contains assertion
   */
  private async validateUrlContains(
    params: AssertionParams
  ): Promise<{ success: boolean; error: string | null; actualValue?: string }> {
    const expected = params.expectedValue || '';
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const matches = checkUrl(expected, 'contains');

    return {
      success: matches,
      error: matches ? null : `URL does not contain "${expected}"`,
      actualValue: currentUrl,
    };
  }

  /**
   * Validate url_equals assertion
   */
  private async validateUrlEquals(
    params: AssertionParams
  ): Promise<{ success: boolean; error: string | null; actualValue?: string }> {
    const expected = params.expectedValue || '';
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const matches = checkUrl(expected, 'equals');

    return {
      success: matches,
      error: matches ? null : `Expected URL "${expected}", got "${currentUrl}"`,
      actualValue: currentUrl,
    };
  }

  /**
   * Validate value_equals assertion
   */
  private async validateValueEquals(
    params: AssertionParams
  ): Promise<{ success: boolean; error: string | null; actualValue?: string }> {
    const target = params.target || '';
    const expected = params.expectedValue || '';
    const element = findElementByText(target);

    if (!element) {
      return {
        success: false,
        error: `Element "${target}" not found`,
      };
    }

    const actualValue = getElementValue(element);
    const matches = actualValue === expected;

    return {
      success: matches,
      error: matches ? null : `Expected value "${expected}", got "${actualValue}"`,
      actualValue,
    };
  }

  /**
   * Validate count_equals assertion
   */
  private async validateCountEquals(
    params: AssertionParams
  ): Promise<{ success: boolean; error: string | null; actualValue?: string }> {
    const target = params.target || '';
    const expectedCount = Number.parseInt(params.expectedValue || '0', 10);
    const actualCount = countElements(target);

    const matches = actualCount === expectedCount;

    return {
      success: matches,
      error: matches ? null : `Expected ${expectedCount} elements, found ${actualCount}`,
      actualValue: String(actualCount),
    };
  }

  /**
   * Validate state assertions (enabled/disabled/checked/unchecked)
   */
  private async validateState(
    params: AssertionParams,
    expectedState: 'enabled' | 'disabled' | 'checked' | 'unchecked'
  ): Promise<{ success: boolean; error: string | null }> {
    const target = params.target || '';
    const element = findElementByText(target);

    if (!element) {
      return {
        success: false,
        error: `Element "${target}" not found`,
      };
    }

    const matches = checkElementState(element, expectedState);

    return {
      success: matches,
      error: matches ? null : `Element "${target}" is not ${expectedState}`,
    };
  }

  /**
   * Validate generic state check
   */
  private async validateStateCheck(
    params: AssertionParams
  ): Promise<{ success: boolean; error: string | null }> {
    const target = params.target || '';
    const element = findElementByText(target);

    if (!element) {
      return {
        success: false,
        error: `Element "${target}" not found for state check`,
      };
    }

    // For generic state check, just verify element exists and is visible
    const visible = isElementVisible(element);

    return {
      success: visible,
      error: visible ? null : `Element "${target}" is not in expected state`,
    };
  }

  /**
   * Validate attribute_equals assertion
   */
  private async validateAttributeEquals(
    params: AssertionParams
  ): Promise<{ success: boolean; error: string | null; actualValue?: string }> {
    const target = params.target || '';
    const attribute = params.attribute || '';
    const expected = params.expectedValue || '';
    const element = findElementByText(target);

    if (!element) {
      return {
        success: false,
        error: `Element "${target}" not found`,
      };
    }

    const actualValue = element.getAttribute(attribute) || '';
    const matches = actualValue === expected;

    return {
      success: matches,
      error: matches
        ? null
        : `Attribute "${attribute}" expected "${expected}", got "${actualValue}"`,
      actualValue,
    };
  }

  /**
   * Validate multiple assertions
   */
  async validateBatch(
    assertions: AssertionRecommendation[]
  ): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();

    for (const assertion of assertions) {
      const result = await this.validate(assertion);
      results.set(assertion.id, result);
    }

    return results;
  }

  /**
   * Preview assertion (validate without modifying state)
   */
  async preview(
    assertion: AssertionRecommendation
  ): Promise<{ valid: boolean; message: string }> {
    const result = await this.validate(assertion);

    if (result.success) {
      return {
        valid: true,
        message: '✓ 验证通过',
      };
    }

    return {
      valid: false,
      message: `✗ 验证失败: ${result.error}`,
    };
  }
}

// Export singleton instance
export const assertionValidator = new AssertionValidator();

// Export class for testing
export { AssertionValidator };
