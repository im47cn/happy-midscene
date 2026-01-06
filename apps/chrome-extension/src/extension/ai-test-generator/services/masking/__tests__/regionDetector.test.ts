/**
 * Region Detector Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('RegionDetector', () => {
  let RegionDetector: typeof import('../regionDetector').RegionDetector;
  let regionDetector: import('../regionDetector').RegionDetector;

  beforeEach(async () => {
    vi.resetModules();

    // Mock window
    vi.stubGlobal('window', {
      scrollX: 0,
      scrollY: 0,
      getComputedStyle: vi.fn(() => ({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
      })),
    });

    // Mock empty document
    vi.stubGlobal('document', {
      querySelectorAll: vi.fn(() => []),
      querySelector: vi.fn(() => null),
    });

    const module = await import('../regionDetector');
    RegionDetector = module.RegionDetector;
    regionDetector = new RegionDetector();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initialization', () => {
    it('should create instance with default config', () => {
      expect(regionDetector).toBeDefined();

      const config = regionDetector.getConfig();
      expect(config.includeHidden).toBe(false);
      expect(config.padding).toBe(4);
      expect(config.customSelectors).toHaveLength(0);
    });

    it('should create instance with custom config', () => {
      const customDetector = new RegionDetector({
        padding: 8,
        includeHidden: true,
      });

      const config = customDetector.getConfig();
      expect(config.padding).toBe(8);
      expect(config.includeHidden).toBe(true);
    });
  });

  describe('getSelectors', () => {
    it('should include built-in selectors', () => {
      const selectors = regionDetector.getSelectors();

      // Check for some expected built-in selectors
      expect(
        selectors.some((s) => s.selector === 'input[type="password"]'),
      ).toBe(true);
      expect(selectors.some((s) => s.selector === 'input[type="email"]')).toBe(
        true,
      );
      expect(selectors.some((s) => s.selector === 'input[type="tel"]')).toBe(
        true,
      );
      expect(
        selectors.some((s) => s.selector === 'input[autocomplete="cc-number"]'),
      ).toBe(true);
    });

    it('should have correct category mapping', () => {
      const selectors = regionDetector.getSelectors();

      const passwordSelector = selectors.find(
        (s) => s.selector === 'input[type="password"]',
      );
      expect(passwordSelector?.category).toBe('credential');
      expect(passwordSelector?.type).toBe('password');

      const emailSelector = selectors.find(
        (s) => s.selector === 'input[type="email"]',
      );
      expect(emailSelector?.category).toBe('pii');
      expect(emailSelector?.type).toBe('email');

      const ccSelector = selectors.find(
        (s) => s.selector === 'input[autocomplete="cc-number"]',
      );
      expect(ccSelector?.category).toBe('financial');
      expect(ccSelector?.type).toBe('credit-card');
    });
  });

  describe('detectSensitiveElements', () => {
    it('should return empty array when no elements found', () => {
      const mockDoc = {
        querySelectorAll: vi.fn(() => []),
      } as unknown as Document;

      const elements = regionDetector.detectSensitiveElements(mockDoc);

      expect(elements).toHaveLength(0);
    });

    it('should detect password input when present', () => {
      const mockElement = {
        tagName: 'INPUT',
        getAttribute: vi.fn((name: string) =>
          name === 'type' ? 'password' : null,
        ),
        closest: vi.fn(() => null),
        getBoundingClientRect: vi.fn(() => ({
          x: 10,
          y: 20,
          width: 200,
          height: 30,
          top: 20,
          left: 10,
          right: 210,
          bottom: 50,
          toJSON: () => ({}),
        })),
        offsetParent: {},
      };

      const mockDoc = {
        querySelectorAll: vi.fn((selector: string) => {
          if (selector === 'input[type="password"]') {
            return [mockElement];
          }
          return [];
        }),
        querySelector: vi.fn(() => null),
      } as unknown as Document;

      const elements = regionDetector.detectSensitiveElements(mockDoc);

      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0].type).toBe('password');
      expect(elements[0].category).toBe('credential');
    });

    it('should skip zero-size elements', () => {
      const mockElement = {
        tagName: 'INPUT',
        getAttribute: vi.fn((name: string) =>
          name === 'type' ? 'password' : null,
        ),
        closest: vi.fn(() => null),
        getBoundingClientRect: vi.fn(() => ({
          x: 10,
          y: 20,
          width: 0,
          height: 0, // Zero size
          top: 20,
          left: 10,
          right: 10,
          bottom: 20,
          toJSON: () => ({}),
        })),
        offsetParent: {},
      };

      const mockDoc = {
        querySelectorAll: vi.fn((selector: string) => {
          if (selector === 'input[type="password"]') {
            return [mockElement];
          }
          return [];
        }),
        querySelector: vi.fn(() => null),
      } as unknown as Document;

      const elements = regionDetector.detectSensitiveElements(mockDoc);

      expect(elements).toHaveLength(0);
    });

    it('should skip hidden elements when includeHidden is false', () => {
      vi.stubGlobal('window', {
        scrollX: 0,
        scrollY: 0,
        getComputedStyle: vi.fn(() => ({
          display: 'none', // Hidden
          visibility: 'visible',
          opacity: '1',
        })),
      });

      const mockElement = {
        tagName: 'INPUT',
        getAttribute: vi.fn((name: string) =>
          name === 'type' ? 'password' : null,
        ),
        closest: vi.fn(() => null),
        getBoundingClientRect: vi.fn(() => ({
          x: 10,
          y: 20,
          width: 200,
          height: 30,
          top: 20,
          left: 10,
          right: 210,
          bottom: 50,
          toJSON: () => ({}),
        })),
        offsetParent: null, // Hidden elements have null offsetParent
      };

      const mockDoc = {
        querySelectorAll: vi.fn((selector: string) => {
          if (selector === 'input[type="password"]') {
            return [mockElement];
          }
          return [];
        }),
        querySelector: vi.fn(() => null),
      } as unknown as Document;

      const elements = regionDetector.detectSensitiveElements(mockDoc);

      expect(elements).toHaveLength(0);
    });
  });

  describe('elementsToMaskRegions', () => {
    it('should convert elements to mask regions with padding', () => {
      const elementInfo = {
        element: {} as Element,
        rect: {
          x: 10,
          y: 20,
          width: 200,
          height: 30,
          top: 20,
          left: 10,
          right: 210,
          bottom: 50,
        } as DOMRect,
        type: 'password' as const,
        category: 'credential' as const,
      };

      const regions = regionDetector.elementsToMaskRegions([elementInfo]);

      expect(regions).toHaveLength(1);
      expect(regions[0].x).toBe(6); // 10 - 4 (padding)
      expect(regions[0].y).toBe(16); // 20 - 4 (padding)
      expect(regions[0].width).toBe(208); // 200 + 8 (padding * 2)
      expect(regions[0].height).toBe(38); // 30 + 8 (padding * 2)
      expect(regions[0].type).toBe('blur');
      expect(regions[0].category).toBe('credential');
    });

    it('should apply scroll offset', () => {
      const elementInfo = {
        element: {} as Element,
        rect: {
          x: 10,
          y: 20,
          width: 200,
          height: 30,
          top: 20,
          left: 10,
          right: 210,
          bottom: 50,
        } as DOMRect,
        type: 'password' as const,
        category: 'credential' as const,
      };

      const regions = regionDetector.elementsToMaskRegions([elementInfo], {
        x: 100,
        y: 50,
      });

      expect(regions[0].x).toBe(106); // 10 + 100 - 4
      expect(regions[0].y).toBe(66); // 20 + 50 - 4
    });

    it('should clamp negative coordinates to zero', () => {
      const elementInfo = {
        element: {} as Element,
        rect: {
          x: 2,
          y: 2,
          width: 200,
          height: 30,
          top: 2,
          left: 2,
          right: 202,
          bottom: 32,
        } as DOMRect,
        type: 'password' as const,
        category: 'credential' as const,
      };

      const regions = regionDetector.elementsToMaskRegions([elementInfo]);

      // 2 - 4 = -2, but should be clamped to 0
      expect(regions[0].x).toBe(0);
      expect(regions[0].y).toBe(0);
    });
  });

  describe('custom selectors', () => {
    it('should add custom selector', () => {
      const initialCount = regionDetector.getSelectors().length;

      regionDetector.addSelector({
        selector: 'input[data-sensitive="true"]',
        type: 'custom',
        category: 'custom',
      });

      expect(regionDetector.getSelectors().length).toBe(initialCount + 1);
    });

    it('should remove custom selector', () => {
      regionDetector.addSelector({
        selector: 'input[data-sensitive="true"]',
        type: 'custom',
        category: 'custom',
      });

      const beforeCount = regionDetector.getSelectors().length;
      const result = regionDetector.removeSelector(
        'input[data-sensitive="true"]',
      );

      expect(result).toBe(true);
      expect(regionDetector.getSelectors().length).toBe(beforeCount - 1);
    });

    it('should return false when removing non-existent selector', () => {
      const result = regionDetector.removeSelector('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should update config', () => {
      regionDetector.setConfig({ padding: 10 });

      const config = regionDetector.getConfig();
      expect(config.padding).toBe(10);
    });

    it('should update custom selectors via config', () => {
      regionDetector.setConfig({
        customSelectors: [
          { selector: 'custom-1', type: 'custom', category: 'custom' },
        ],
      });

      const config = regionDetector.getConfig();
      expect(config.customSelectors).toHaveLength(1);
    });
  });
});

describe('detectScreenshotMaskRegions utility', () => {
  let detectScreenshotMaskRegions: (
    screenshot: string,
    selectors?: string[],
  ) => Promise<
    Array<{ x: number; y: number; width: number; height: number; type: string }>
  >;

  beforeEach(async () => {
    vi.resetModules();

    vi.stubGlobal('window', {
      scrollX: 50,
      scrollY: 100,
      getComputedStyle: vi.fn(() => ({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
      })),
    });

    // Mock document with a password input
    const mockElement = {
      tagName: 'INPUT',
      getAttribute: vi.fn((name: string) =>
        name === 'type' ? 'password' : null,
      ),
      closest: vi.fn(() => null),
      getBoundingClientRect: vi.fn(() => ({
        x: 10,
        y: 20,
        width: 200,
        height: 30,
        top: 20,
        left: 10,
        right: 210,
        bottom: 50,
        toJSON: () => ({}),
      })),
      offsetParent: {},
    };

    vi.stubGlobal('document', {
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === 'input[type="password"]') {
          return [mockElement];
        }
        return [];
      }),
      querySelector: vi.fn(() => null),
    });

    const module = await import('../regionDetector');
    detectScreenshotMaskRegions = module.detectScreenshotMaskRegions;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should detect and convert to mask regions with scroll offset', () => {
    const regions = detectScreenshotMaskRegions();

    expect(regions.length).toBeGreaterThan(0);
    // Should include scroll offset: left (10) + scrollX (50) - padding (4) = 56
    expect(regions[0].x).toBe(56);
    // top (20) + scrollY (100) - padding (4) = 116
    expect(regions[0].y).toBe(116);
  });
});
