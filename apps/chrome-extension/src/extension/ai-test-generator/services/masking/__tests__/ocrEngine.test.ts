/**
 * OCR Engine Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock ImageData for Node.js environment
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(widthOrData: number | Uint8ClampedArray, width: number, height?: number) {
    if (typeof widthOrData === 'number') {
      this.width = widthOrData;
      this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = widthOrData;
      this.width = width;
      this.height = height || widthOrData.length / (width * 4);
    }
  }
}

describe('OCREngine', () => {
  let OCREngine: typeof import('../ocrEngine').OCREngine;
  let ocrEngine: import('../ocrEngine').OCREngine;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('ImageData', MockImageData);

    // Import fresh module
    const module = await import('../ocrEngine');
    OCREngine = module.OCREngine;
    ocrEngine = new OCREngine();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initialization', () => {
    it('should create instance with default config', () => {
      expect(ocrEngine).toBeDefined();
      expect(ocrEngine.isOCRAvailable()).toBe(false); // Not initialized yet
    });

    it('should create instance with custom config', () => {
      const customEngine = new OCREngine({
        language: 'eng',
        minConfidence: 80,
      });

      const config = customEngine.getConfig();
      expect(config.language).toBe('eng');
      expect(config.minConfidence).toBe(80);
    });

    it('should return false when Tesseract is not available', async () => {
      const result = await ocrEngine.initialize();
      expect(result).toBe(false);
      expect(ocrEngine.isOCRAvailable()).toBe(false);
    });
  });

  describe('recognizeText', () => {
    it('should return empty result when OCR is not available', async () => {
      const mockImageData = new ImageData(10, 10);

      const result = await ocrEngine.recognizeText(mockImageData);

      expect(result.text).toBe('');
      expect(result.lines).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should return empty result for base64 string when OCR is not available', async () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await ocrEngine.recognizeText(base64);

      expect(result.text).toBe('');
      expect(result.lines).toHaveLength(0);
    });
  });

  describe('detectSensitiveText', () => {
    it('should return empty array when OCR is not available', async () => {
      const mockImageData = new ImageData(10, 10);

      const matches = await ocrEngine.detectSensitiveText(mockImageData);

      expect(matches).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('should update config', () => {
      ocrEngine.setConfig({ minConfidence: 90 });

      const config = ocrEngine.getConfig();
      expect(config.minConfidence).toBe(90);
    });

    it('should preserve other config when updating partial', () => {
      const originalConfig = ocrEngine.getConfig();
      ocrEngine.setConfig({ minConfidence: 70 });

      const config = ocrEngine.getConfig();
      expect(config.language).toBe(originalConfig.language);
      expect(config.enableCache).toBe(originalConfig.enableCache);
      expect(config.minConfidence).toBe(70);
    });
  });

  describe('terminate', () => {
    it('should handle terminate when not initialized', async () => {
      await expect(ocrEngine.terminate()).resolves.not.toThrow();
    });
  });
});

describe('OCREngine with mocked Tesseract', () => {
  let OCREngine: typeof import('../ocrEngine').OCREngine;

  // Mock ImageData for this test suite
  class MockImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;

    constructor(widthOrData: number | Uint8ClampedArray, width: number, height?: number) {
      if (typeof widthOrData === 'number') {
        this.width = widthOrData;
        this.height = width;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = widthOrData;
        this.width = width;
        this.height = height || widthOrData.length / (width * 4);
      }
    }
  }

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('ImageData', MockImageData);

    // Mock tesseract.js
    vi.doMock('tesseract.js', () => ({
      createWorker: vi.fn().mockResolvedValue({
        recognize: vi.fn().mockResolvedValue({
          data: {
            text: 'password=secret123\nphone: 13812345678',
            lines: [
              {
                text: 'password=secret123',
                confidence: 95,
                words: [
                  { text: 'password=secret123', confidence: 95, bbox: { x0: 10, y0: 10, x1: 100, y1: 30 } },
                ],
                bbox: { x0: 10, y0: 10, x1: 100, y1: 30 },
              },
              {
                text: 'phone: 13812345678',
                confidence: 92,
                words: [
                  { text: 'phone:', confidence: 90, bbox: { x0: 10, y0: 40, x1: 50, y1: 60 } },
                  { text: '13812345678', confidence: 94, bbox: { x0: 55, y0: 40, x1: 150, y1: 60 } },
                ],
                bbox: { x0: 10, y0: 40, x1: 150, y1: 60 },
              },
            ],
            confidence: 93.5,
          },
        }),
        terminate: vi.fn().mockResolvedValue(undefined),
      }),
    }));

    const module = await import('../ocrEngine');
    OCREngine = module.OCREngine;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('should initialize successfully with mocked Tesseract', async () => {
    const engine = new OCREngine();
    const result = await engine.initialize();

    expect(result).toBe(true);
    expect(engine.isOCRAvailable()).toBe(true);
  });

  it('should recognize text with mocked Tesseract', async () => {
    const engine = new OCREngine();
    await engine.initialize();

    // Mock canvas and image APIs
    vi.stubGlobal('OffscreenCanvas', class {
      width = 100;
      height = 100;
      getContext() {
        return {
          putImageData: vi.fn(),
          getImageData: vi.fn().mockReturnValue(new MockImageData(100, 100)),
        };
      }
      toDataURL() {
        return 'data:image/png;base64,mock';
      }
    });

    const mockImageData = new MockImageData(100, 100);
    const result = await engine.recognizeText(mockImageData as unknown as ImageData);

    expect(result.text).toContain('password');
    expect(result.lines).toHaveLength(2);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should terminate worker', async () => {
    const engine = new OCREngine();
    await engine.initialize();

    await engine.terminate();

    expect(engine.isOCRAvailable()).toBe(false);
  });
});
