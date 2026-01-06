/**
 * Unit tests for Page Actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PageActions, getPageActions, resetPageActions } from '../pageActions';

// Mock agent
const mockPage = {
  mouse: {
    click: vi.fn(),
    move: vi.fn(),
  },
  keyboard: {
    type: vi.fn(),
    down: vi.fn(),
    up: vi.fn(),
    press: vi.fn(),
  },
  evaluate: vi.fn(),
  reload: vi.fn(),
  goto: vi.fn(),
  goBack: vi.fn(),
  goForward: vi.fn(),
  screenshot: vi.fn(),
  url: vi.fn(),
  title: vi.fn(),
  content: vi.fn(),
};

const mockAgent = {
  aiAct: vi.fn(),
  aiLocate: vi.fn(),
  aiQuery: vi.fn(),
  page: mockPage,
};

describe('PageActions', () => {
  let pageActions: PageActions;

  beforeEach(() => {
    vi.clearAllMocks();
    resetPageActions();
    // Restore aiAct mock in case previous tests set it to undefined
    mockAgent.aiAct = vi.fn();
    pageActions = getPageActions({
      getAgent: () => mockAgent,
      defaultTimeout: 10000,
    });
  });

  describe('click', () => {
    it('should click on element using aiAct', async () => {
      mockAgent.aiAct.mockResolvedValue(undefined);
      mockAgent.aiLocate.mockResolvedValue([
        {
          center: [100, 200],
          rect: { left: 50, top: 150, width: 100, height: 50, right: 150, bottom: 200 },
          text: 'Submit',
        },
      ]);

      const result = await pageActions.click('Submit button');

      expect(mockAgent.aiAct).toHaveBeenCalledWith('点击Submit button');
      expect(result.text).toBe('Submit');
    });

    it('should click using coordinates as fallback', async () => {
      // Don't mock aiAct so fallback path is used
      mockAgent.aiAct = undefined;
      mockAgent.aiLocate.mockResolvedValue([
        {
          center: [100, 200],
          rect: { left: 50, top: 150, width: 100, height: 50, right: 150, bottom: 200 },
        },
      ]);

      const result = await pageActions.click('Button');

      expect(mockPage.mouse.click).toHaveBeenCalledWith(100, 200, {
        clickCount: 1,
        button: 'left',
      });
      expect(result.center).toEqual([100, 200]);
    });

    it('should support custom click options', async () => {
      // Don't mock aiAct so fallback path is used
      mockAgent.aiAct = undefined;
      mockAgent.aiLocate.mockResolvedValue([
        {
          center: [100, 200],
          rect: { left: 50, top: 150, width: 100, height: 50 },
        },
      ]);

      await pageActions.click('Button', {
        button: 'right',
        clickCount: 2,
        position: { x: 150, y: 250 },
      });

      expect(mockPage.mouse.click).toHaveBeenCalledWith(150, 250, {
        clickCount: 2,
        button: 'right',
      });
    });

    it('should throw error when element not found', async () => {
      // Don't mock aiAct so fallback path is used
      mockAgent.aiAct = undefined;
      mockAgent.aiLocate.mockResolvedValue(null);

      await expect(pageActions.click('Nonexistent')).rejects.toThrow('无法找到');
    });
  });

  describe('input', () => {
    it('should input text using aiAct', async () => {
      mockAgent.aiAct.mockResolvedValue(undefined);
      mockAgent.aiLocate.mockResolvedValue([{ center: [100, 200] }]);

      const result = await pageActions.input('Username', 'testuser');

      expect(mockAgent.aiAct).toHaveBeenCalledWith('在Username输入testuser');
      expect(result).toBeDefined();
    });

    it('should clear field before input when requested', async () => {
      // Don't mock aiAct so fallback path is used
      mockAgent.aiAct = undefined;
      mockAgent.aiLocate.mockResolvedValue([{ center: [100, 200] }]);

      await pageActions.input('Field', 'newvalue', { clearFirst: true });

      expect(mockPage.keyboard.down).toHaveBeenCalledWith('Control');
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('a');
      expect(mockPage.keyboard.up).toHaveBeenCalledWith('Control');
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Backspace');
    });

    it('should submit with Enter when requested', async () => {
      // Don't mock aiAct so fallback path is used
      mockAgent.aiAct = undefined;
      mockAgent.aiLocate.mockResolvedValue([{ center: [100, 200] }]);

      await pageActions.input('Search', 'query', { submit: true });

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    });

    it('should support custom delay between keystrokes', async () => {
      // Don't mock aiAct so fallback path is used
      mockAgent.aiAct = undefined;
      mockAgent.aiLocate.mockResolvedValue([{ center: [100, 200] }]);

      await pageActions.input('Field', 'test', { delay: 50 });

      expect(mockPage.keyboard.type).toHaveBeenCalledWith('test', { delay: 50 });
    });
  });

  describe('select', () => {
    it('should select option from dropdown', async () => {
      mockAgent.aiAct.mockResolvedValue(undefined);
      mockAgent.aiLocate.mockResolvedValue([{ center: [100, 200] }]);
      mockPage.evaluate.mockResolvedValue([
        { text: 'Option 1', rect: {} },
        { text: 'Option 2', rect: { left: 100, top: 100, width: 50, height: 20, right: 150, bottom: 120 } },
      ]);

      const result = await pageActions.select('Dropdown', 'Option 2');

      expect(mockAgent.aiAct).toHaveBeenCalledWith('在Dropdown中选择"Option 2"');
      expect(result).toBeDefined();
    });
  });

  describe('hover', () => {
    it('should hover over element', async () => {
      mockAgent.aiLocate.mockResolvedValue([
        { center: [100, 200], rect: { left: 50, top: 150, width: 100, height: 50 } },
      ]);

      const result = await pageActions.hover('Element');

      expect(mockPage.mouse.move).toHaveBeenCalledWith(100, 200);
      expect(result.center).toEqual([100, 200]);
    });
  });

  describe('scroll', () => {
    it('should scroll by direction and amount', async () => {
      mockPage.evaluate.mockResolvedValue(undefined);

      await pageActions.scroll({ direction: 'down', amount: 300 });

      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should scroll to element', async () => {
      mockAgent.aiLocate.mockResolvedValue([
        { rect: { left: 100, top: 500, width: 100, height: 50 } },
      ]);
      mockPage.evaluate.mockResolvedValue(undefined);

      await pageActions.scroll({ target: 'Element' });

      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should scroll up', async () => {
      mockPage.evaluate.mockResolvedValue(undefined);

      await pageActions.scroll({ direction: 'up', amount: 200 });

      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('scrollToTop / scrollToBottom', () => {
    it('should scroll to top of page', async () => {
      mockPage.evaluate.mockResolvedValue(undefined);

      await pageActions.scrollToTop();

      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should scroll to bottom of page', async () => {
      mockPage.evaluate.mockResolvedValue(undefined);

      await pageActions.scrollToBottom();

      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('navigation', () => {
    it('should refresh page', async () => {
      mockPage.reload.mockResolvedValue(undefined);

      await pageActions.refresh({ waitUntil: 'networkidle' });

      expect(mockPage.reload).toHaveBeenCalledWith({ waitUntil: 'networkidle' });
    });

    it('should navigate to URL', async () => {
      mockPage.goto.mockResolvedValue(undefined);

      await pageActions.navigate('https://example.com');

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle',
        timeout: 10000,
      });
    });

    it('should go back in history', async () => {
      mockPage.goBack.mockResolvedValue(undefined);

      await pageActions.back();

      expect(mockPage.goBack).toHaveBeenCalled();
    });

    it('should go forward in history', async () => {
      mockPage.goForward.mockResolvedValue(undefined);

      await pageActions.forward();

      expect(mockPage.goForward).toHaveBeenCalled();
    });
  });

  describe('waitForElement', () => {
    it('should wait for element to appear', async () => {
      mockAgent.aiLocate.mockResolvedValueOnce(null)
        .mockResolvedValueOnce([{ text: 'Found' }]);

      const result = await pageActions.waitForElement('Element', {
        timeout: 5000,
        state: 'visible',
      });

      expect(result?.text).toBe('Found');
    });

    it('should wait for element to be hidden', async () => {
      mockAgent.aiLocate.mockResolvedValueOnce([{ text: 'Visible' }])
        .mockResolvedValueOnce(null);

      const result = await pageActions.waitForElement('Element', {
        timeout: 5000,
        state: 'hidden',
      });

      expect(result).toBeNull();
    });

    it('should timeout when element does not appear', async () => {
      mockAgent.aiLocate.mockResolvedValue(null);

      await expect(pageActions.waitForElement('Nonexistent', {
        timeout: 100,
        state: 'visible',
      })).rejects.toThrow('超时');
    });
  });

  describe('screenshot', () => {
    it('should take screenshot', async () => {
      mockPage.screenshot.mockResolvedValue('base64image');

      const result = await pageActions.screenshot({ type: 'png' });

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        type: 'png',
        encoding: 'base64',
        quality: undefined,
        fullPage: false,
        clip: undefined,
      });
      expect(result).toBe('base64image');
    });

    it('should support full page screenshot', async () => {
      mockPage.screenshot.mockResolvedValue('base64image');

      await pageActions.screenshot({ fullPage: true });

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({ fullPage: true }),
      );
    });

    it('should support clip region', async () => {
      mockPage.screenshot.mockResolvedValue('base64image');

      await pageActions.screenshot({
        clip: { x: 10, y: 20, width: 100, height: 200 },
      });

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          clip: { x: 10, y: 20, width: 100, height: 200 },
        }),
      );
    });
  });

  describe('page info', () => {
    it('should get page URL', () => {
      mockPage.url.mockReturnValue('https://example.com');

      const url = pageActions.getURL();

      expect(url).toBe('https://example.com');
    });

    it('should get page title', async () => {
      mockPage.title.mockResolvedValue('Example Page');

      const title = await pageActions.getTitle();

      expect(title).toBe('Example Page');
    });

    it('should get page content', async () => {
      mockPage.content.mockResolvedValue('<html>content</html>');

      const content = await pageActions.getContent();

      expect(content).toBe('<html>content</html>');
    });

    it('should get visible text', async () => {
      mockPage.evaluate.mockResolvedValue('Visible text on page');

      const text = await pageActions.getVisibleText();

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(text).toBe('Visible text on page');
    });

    it('should get links', async () => {
      mockPage.evaluate.mockResolvedValue([
        { text: 'Home', href: '/' },
        { text: 'About', href: '/about' },
      ]);

      const links = await pageActions.getLinks();

      expect(links).toHaveLength(2);
      expect(links[0]).toEqual({ text: 'Home', href: '/' });
    });

    it('should get images', async () => {
      mockPage.evaluate.mockResolvedValue([
        { src: 'image1.png', alt: 'Image 1' },
        { src: 'image2.png', alt: '' },
      ]);

      const images = await pageActions.getImages();

      expect(images).toHaveLength(2);
      expect(images[0]).toEqual({ src: 'image1.png', alt: 'Image 1' });
    });
  });

  describe('evaluate', () => {
    it('should execute JavaScript in page', async () => {
      mockPage.evaluate.mockResolvedValue(42);

      const result = await pageActions.evaluate(() => 21 * 2);

      expect(result).toBe(42);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should pass arguments to function', async () => {
      mockPage.evaluate.mockResolvedValue('hello world');

      await pageActions.evaluate((str: string) => str.toUpperCase(), 'hello world');

      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('waitForTimeout', () => {
    it('should wait for specified time', async () => {
      const startTime = Date.now();
      await pageActions.waitForTimeout(500);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(450);
    });
  });

  describe('locate', () => {
    it('should locate elements using aiLocate', async () => {
      mockAgent.aiLocate.mockResolvedValue([
        {
          text: 'Button',
          rect: { left: 100, top: 200, width: 50, height: 20, right: 150, bottom: 220 },
          center: [125, 210],
        },
      ]);

      const results = await pageActions.locate('Submit button');

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('Button');
      expect(results[0].visible).toBe(true);
    });

    it('should return null when no elements found', async () => {
      mockAgent.aiLocate.mockResolvedValue(null);

      const results = await pageActions.locate('Nonexistent');

      expect(results).toBeNull();
    });

    it('should handle elements without rect', async () => {
      mockAgent.aiLocate.mockResolvedValue([
        { text: 'Element', visible: true },
      ]);

      const results = await pageActions.locate('Element');

      expect(results).toHaveLength(1);
      expect(results[0].visible).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error when agent unavailable', () => {
      const badPageActions = new PageActions({
        getAgent: () => null,
      });

      expect(() => badPageActions.getURL()).toThrow('无法获取');
    });

    it('should throw error when page unavailable', () => {
      const badPageActions = new PageActions({
        getAgent: () => ({ aiLocate: vi.fn() }),
      });

      expect(() => badPageActions.getURL()).toThrow('无法获取');
    });
  });
});
