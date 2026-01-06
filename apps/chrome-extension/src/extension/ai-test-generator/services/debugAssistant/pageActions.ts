/**
 * Page Actions Service
 * Provides reusable page interaction methods that wrap Midscene agent operations
 */

export interface PageActionsOptions {
  getAgent: () => any;
  defaultTimeout?: number;
}

export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  position?: { x: number; y: number };
}

export interface InputOptions {
  clearFirst?: boolean;
  delay?: number;
  submit?: boolean;
}

export interface ScrollOptions {
  behavior?: 'smooth' | 'auto';
  block?: 'start' | 'center' | 'end' | 'nearest';
  inline?: 'start' | 'center' | 'end' | 'nearest';
}

export interface ElementInfo {
  element: any;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
  };
  center: [number, number];
  text?: string;
  visible: boolean;
}

/**
 * Page Actions - reusable page interaction methods
 */
export class PageActions {
  private getAgent: () => any;
  private defaultTimeout: number;

  constructor(options: PageActionsOptions) {
    this.getAgent = options.getAgent;
    this.defaultTimeout = options.defaultTimeout ?? 10000;
  }

  /**
   * Check if agent is available
   */
  private ensureAgent(): any {
    const agent = this.getAgent();
    if (!agent) {
      throw new Error('无法获取 agent 实例');
    }
    return agent;
  }

  /**
   * Get the current page
   */
  private getPage(): any {
    const agent = this.ensureAgent();
    if (!agent.page) {
      throw new Error('无法获取页面实例');
    }
    return agent.page;
  }

  /**
   * Click on an element using AI-powered targeting
   */
  async click(
    target: string,
    options: ClickOptions = {},
  ): Promise<ElementInfo> {
    const agent = this.ensureAgent();

    // Try using aiAct first (most reliable)
    if (typeof agent.aiAct === 'function') {
      await agent.aiAct(`点击${target}`);
      const elements = await this.locate(target);
      if (elements && elements.length > 0) {
        return elements[0];
      }
    }

    // Fallback to manual click using coordinates
    const elements = await this.locate(target);
    if (elements && elements.length > 0) {
      const el = elements[0];
      const page = this.getPage();

      if (options.position) {
        await page.mouse.click(options.position.x, options.position.y, {
          clickCount: options.clickCount || 1,
          button: options.button || 'left',
        });
      } else if (el.center) {
        await page.mouse.click(el.center[0], el.center[1], {
          clickCount: options.clickCount || 1,
          button: options.button || 'left',
        });
      }

      return el;
    }

    throw new Error(`无法找到元素: ${target}`);
  }

  /**
   * Input text into a field
   */
  async input(
    target: string,
    text: string,
    options: InputOptions = {},
  ): Promise<ElementInfo> {
    const agent = this.ensureAgent();

    // Try using aiAct first
    if (typeof agent.aiAct === 'function') {
      const action = options.clearFirst ? '清空并输入' : '输入';
      await agent.aiAct(`在${target}${action}${text}`);

      const elements = await this.locate(target);
      if (elements && elements.length > 0) {
        return elements[0];
      }
    }

    // Fallback to click + type
    const elements = await this.locate(target);
    if (elements && elements.length > 0) {
      const el = elements[0];
      const page = this.getPage();

      // Click to focus
      if (el.center) {
        await page.mouse.click(el.center[0], el.center[1]);

        // Clear if requested
        if (options.clearFirst) {
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await page.keyboard.press('Backspace');
        }

        // Type the text
        const delay = options.delay ?? 10;
        await page.keyboard.type(text, { delay });

        // Submit if requested
        if (options.submit) {
          await page.keyboard.press('Enter');
        }
      }

      return el;
    }

    throw new Error(`无法找到输入框: ${target}`);
  }

  /**
   * Select an option from a dropdown
   */
  async select(target: string, option: string): Promise<ElementInfo> {
    const agent = this.ensureAgent();

    if (typeof agent.aiAct === 'function') {
      await agent.aiAct(`在${target}中选择"${option}"`);
      const elements = await this.locate(target);
      if (elements && elements.length > 0) {
        return elements[0];
      }
    }

    // Fallback: click the dropdown, then click the option
    await this.click(target);
    await this.waitForTimeout(300);

    const page = this.getPage();
    const optionsElements = await page.evaluate(() => {
      const options = Array.from(
        document.querySelectorAll('[role="option"], option, li'),
      );
      return options
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({
          text: el.textContent?.trim() || '',
          rect: el.getBoundingClientRect(),
        }));
    });

    const matchingOption = optionsElements.find((opt: any) =>
      opt.text.includes(option),
    );

    if (matchingOption) {
      const center = this.getCenter(matchingOption.rect);
      await page.mouse.click(center[0], center[1]);
    }

    const elements = await this.locate(target);
    if (elements && elements.length > 0) {
      return elements[0];
    }

    throw new Error(`无法选择选项: ${option}`);
  }

  /**
   * Hover over an element
   */
  async hover(target: string): Promise<ElementInfo> {
    const elements = await this.locate(target);
    if (elements && elements.length > 0) {
      const el = elements[0];
      const page = this.getPage();

      if (el.center) {
        await page.mouse.move(el.center[0], el.center[1]);
      }

      return el;
    }

    throw new Error(`无法找到元素: ${target}`);
  }

  /**
   * Scroll the page
   */
  async scroll(
    options: {
      direction?: 'up' | 'down' | 'left' | 'right';
      amount?: number;
      target?: string;
    } = {},
  ): Promise<void> {
    const page = this.getPage();

    if (options.target) {
      // Scroll to element
      const elements = await this.locate(options.target);
      if (elements && elements.length > 0) {
        const el = elements[0];
        await page.evaluate(
          (rect) => {
            window.scrollTo({
              top: rect.top + window.scrollY - 100,
              left: rect.left + window.scrollX - 100,
              behavior: 'smooth',
            });
          },
          { rect: el.rect },
        );
        return;
      }
    }

    // Scroll by amount
    const direction = options.direction || 'down';
    const amount = options.amount || 500;

    await page.evaluate(
      ({ dir, amt }) => {
        switch (dir) {
          case 'up':
            window.scrollBy(0, -amt);
            break;
          case 'down':
            window.scrollBy(0, amt);
            break;
          case 'left':
            window.scrollBy(-amt, 0);
            break;
          case 'right':
            window.scrollBy(amt, 0);
            break;
        }
      },
      { dir: direction, amt: amount },
    );
  }

  /**
   * Scroll to top of page
   */
  async scrollToTop(): Promise<void> {
    const page = this.getPage();
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  /**
   * Scroll to bottom of page
   */
  async scrollToBottom(): Promise<void> {
    const page = this.getPage();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  /**
   * Refresh/reload the page
   */
  async refresh(
    options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' } = {},
  ): Promise<void> {
    const page = this.getPage();
    await page.reload({ waitUntil: options.waitUntil || 'networkidle' });
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<void> {
    const page = this.getPage();
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: this.defaultTimeout,
    });
  }

  /**
   * Go back in history
   */
  async back(): Promise<void> {
    const page = this.getPage();
    await page.goBack();
  }

  /**
   * Go forward in history
   */
  async forward(): Promise<void> {
    const page = this.getPage();
    await page.goForward();
  }

  /**
   * Wait for a timeout
   */
  async waitForTimeout(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wait for an element to appear
   */
  async waitForElement(
    target: string,
    options: {
      timeout?: number;
      state?: 'visible' | 'hidden' | 'attached' | 'detached';
    } = {},
  ): Promise<ElementInfo | null> {
    const timeout = options.timeout ?? this.defaultTimeout;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const elements = await this.locate(target);

      if (options.state === 'hidden' || options.state === 'detached') {
        if (!elements || elements.length === 0) {
          return null;
        }
      } else {
        if (elements && elements.length > 0) {
          return elements[0];
        }
      }

      await this.waitForTimeout(100);
    }

    throw new Error(`等待元素超时: ${target}`);
  }

  /**
   * Take a screenshot
   */
  async screenshot(
    options: {
      type?: 'png' | 'jpeg';
      quality?: number;
      fullPage?: boolean;
      clip?: { x: number; y: number; width: number; height: number };
    } = {},
  ): Promise<string> {
    const page = this.getPage();

    const screenshot = await page.screenshot({
      type: options.type || 'png',
      encoding: 'base64',
      quality: options.quality,
      fullPage: options.fullPage || false,
      clip: options.clip,
    });

    return screenshot as string;
  }

  /**
   * Get page URL
   */
  getURL(): string {
    const page = this.getPage();
    return page.url();
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    const page = this.getPage();
    return page.title();
  }

  /**
   * Get page content
   */
  async getContent(): Promise<string> {
    const page = this.getPage();
    return page.content();
  }

  /**
   * Execute JavaScript in the page
   */
  async evaluate<R>(fn: () => R): Promise<R>;
  async evaluate<R, A>(fn: (arg: A) => R, arg: A): Promise<R>;
  async evaluate<R, A extends any[]>(
    fn: (...args: A) => R,
    ...args: A
  ): Promise<R> {
    const page = this.getPage();
    return page.evaluate(fn, ...args);
  }

  /**
   * Get all visible text on the page
   */
  async getVisibleText(): Promise<string> {
    const page = this.getPage();
    return page.evaluate(() => document.body.innerText);
  }

  /**
   * Get all links on the page
   */
  async getLinks(): Promise<Array<{ text: string; href: string }>> {
    const page = this.getPage();
    return page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .filter((a) => a.offsetParent !== null)
        .map((a) => ({ text: a.textContent?.trim() || '', href: a.href })),
    );
  }

  /**
   * Get all images on the page
   */
  async getImages(): Promise<Array<{ src: string; alt: string }>> {
    const page = this.getPage();
    return page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter((img) => img.offsetParent !== null)
        .map((img) => ({ src: img.src, alt: img.alt || '' })),
    );
  }

  /**
   * Locate elements using Midscene's AI
   */
  async locate(description: string): Promise<ElementInfo[] | null> {
    const agent = this.ensureAgent();

    try {
      if (typeof agent.aiLocate === 'function') {
        const result = await agent.aiLocate(description);
        if (result && Array.isArray(result) && result.length > 0) {
          return result.map(this.toElementInfo);
        }
      }

      if (typeof agent.aiQuery === 'function') {
        const result = await agent.aiQuery(`找到${description}元素`);
        if (result?.elements) {
          return result.elements.map(this.toElementInfo);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Convert raw element result to ElementInfo
   */
  private toElementInfo(raw: any): ElementInfo {
    if (raw.center && raw.rect) {
      return {
        element: raw,
        rect: raw.rect,
        center: raw.center,
        text: raw.text,
        visible: true,
      };
    }

    // Handle different element formats
    const rect = raw.rect || {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      right: 0,
      bottom: 0,
    };

    return {
      element: raw,
      rect,
      center: [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2],
      text: raw.text || raw.content || '',
      visible: raw.visible !== false,
    };
  }

  /**
   * Get center point of a rect
   */
  private getCenter(rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  }): [number, number] {
    return [rect.left + rect.width / 2, rect.top + rect.height / 2];
  }
}

// Export singleton getter
let pageActionsInstance: PageActions | null = null;

export function getPageActions(options: PageActionsOptions): PageActions {
  if (!pageActionsInstance) {
    pageActionsInstance = new PageActions(options);
  }
  return pageActionsInstance;
}

export function resetPageActions(): void {
  pageActionsInstance = null;
}
