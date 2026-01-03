/**
 * Image Masker Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ImageMasker,
  createMaskRegionsFromElements,
} from '../imageMasker';
import type { MaskRegion } from '../../../types/masking';

// Mock canvas and image APIs for Node.js environment
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray | number, width: number, height?: number) {
    if (typeof data === 'number') {
      // Constructor: new ImageData(width, height)
      this.width = data;
      this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      // Constructor: new ImageData(data, width, height)
      this.data = data;
      this.width = width;
      this.height = height || data.length / (width * 4);
    }
  }
}

// Replace global ImageData
vi.stubGlobal('ImageData', MockImageData);

// Mock OffscreenCanvas
class MockOffscreenCanvas {
  width: number;
  height: number;
  private imageData: MockImageData;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.imageData = new MockImageData(width, height);
  }

  getContext(_type: string) {
    const self = this;
    return {
      putImageData: (data: MockImageData, _x: number, _y: number) => {
        self.imageData = data;
      },
      getImageData: (x: number, y: number, width: number, height: number) => {
        // Return a subset of image data
        const data = new Uint8ClampedArray(width * height * 4);
        for (let row = 0; row < height; row++) {
          for (let col = 0; col < width; col++) {
            const srcIdx = ((y + row) * self.width + (x + col)) * 4;
            const dstIdx = (row * width + col) * 4;
            data[dstIdx] = self.imageData.data[srcIdx] || 0;
            data[dstIdx + 1] = self.imageData.data[srcIdx + 1] || 0;
            data[dstIdx + 2] = self.imageData.data[srcIdx + 2] || 0;
            data[dstIdx + 3] = self.imageData.data[srcIdx + 3] || 255;
          }
        }
        return new MockImageData(data, width, height);
      },
      fillRect: vi.fn(),
      fillStyle: '',
      drawImage: vi.fn(),
    };
  }

  toDataURL(_format?: string) {
    return 'data:image/png;base64,mockBase64Data';
  }
}

vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas);

describe('ImageMasker', () => {
  let masker: ImageMasker;

  beforeEach(() => {
    masker = new ImageMasker();
  });

  describe('maskScreenshot', () => {
    it('should return original image when level is off', async () => {
      const imageData = new MockImageData(100, 100) as unknown as ImageData;

      const result = await masker.maskScreenshot(imageData, 'off');

      expect(result.imageData).toBe(imageData);
      expect(result.result.regions).toHaveLength(0);
      expect(result.result.originalSize).toEqual({ width: 100, height: 100 });
    });

    it('should return original image when no regions provided', async () => {
      const imageData = new MockImageData(100, 100) as unknown as ImageData;

      const result = await masker.maskScreenshot(imageData, 'standard');

      expect(result.result.regions).toHaveLength(0);
    });

    it('should apply blur masking to specified regions', async () => {
      const imageData = new MockImageData(100, 100) as unknown as ImageData;
      const regions: MaskRegion[] = [
        { x: 10, y: 10, width: 20, height: 20, type: 'blur' },
      ];

      const result = await masker.maskScreenshot(imageData, 'standard', regions);

      expect(result.result.regions).toHaveLength(1);
      expect(result.result.regions[0].type).toBe('blur');
    });

    it('should apply fill masking to specified regions', async () => {
      const imageData = new MockImageData(100, 100) as unknown as ImageData;
      const regions: MaskRegion[] = [
        { x: 10, y: 10, width: 20, height: 20, type: 'fill' },
      ];

      const result = await masker.maskScreenshot(imageData, 'standard', regions);

      expect(result.result.regions).toHaveLength(1);
      expect(result.result.regions[0].type).toBe('fill');
    });

    it('should handle multiple regions', async () => {
      const imageData = new MockImageData(200, 200) as unknown as ImageData;
      const regions: MaskRegion[] = [
        { x: 10, y: 10, width: 30, height: 30, type: 'blur', category: 'credential' },
        { x: 50, y: 50, width: 40, height: 20, type: 'fill', category: 'pii' },
        { x: 100, y: 100, width: 50, height: 50, type: 'blur', category: 'financial' },
      ];

      const result = await masker.maskScreenshot(imageData, 'strict', regions);

      expect(result.result.regions).toHaveLength(3);
    });

    it('should track processing time', async () => {
      const imageData = new MockImageData(100, 100) as unknown as ImageData;

      const result = await masker.maskScreenshot(imageData, 'standard');

      expect(result.result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should clamp regions to image bounds', async () => {
      const imageData = new MockImageData(100, 100) as unknown as ImageData;
      // Region extends beyond image bounds
      const regions: MaskRegion[] = [
        { x: 80, y: 80, width: 50, height: 50, type: 'blur' },
      ];

      // Should not throw
      const result = await masker.maskScreenshot(imageData, 'standard', regions);

      expect(result.result.regions).toHaveLength(1);
    });

    it('should skip zero-size regions after clamping', async () => {
      const imageData = new MockImageData(100, 100) as unknown as ImageData;
      // Region completely outside image
      const regions: MaskRegion[] = [
        { x: 200, y: 200, width: 50, height: 50, type: 'blur' },
      ];

      const result = await masker.maskScreenshot(imageData, 'standard', regions);

      // Region should be processed but effectively skipped due to clamping
      expect(result.result.regions).toHaveLength(1);
    });
  });

  describe('blurRegion', () => {
    it('should blur a region with default radius', async () => {
      const imageData = new MockImageData(50, 50) as unknown as ImageData;
      const region: MaskRegion = { x: 10, y: 10, width: 20, height: 20, type: 'blur' };

      const result = await masker.blurRegion(imageData, region);

      expect(result).toBeDefined();
      expect(result.width).toBe(50);
      expect(result.height).toBe(50);
    });

    it('should blur a region with custom radius', async () => {
      const imageData = new MockImageData(50, 50) as unknown as ImageData;
      const region: MaskRegion = { x: 5, y: 5, width: 15, height: 15, type: 'blur' };

      const result = await masker.blurRegion(imageData, region, 5);

      expect(result).toBeDefined();
    });
  });

  describe('fillRegion', () => {
    it('should fill a region with default color', async () => {
      const imageData = new MockImageData(50, 50) as unknown as ImageData;
      const region: MaskRegion = { x: 10, y: 10, width: 20, height: 20, type: 'fill' };

      const result = await masker.fillRegion(imageData, region);

      expect(result).toBeDefined();
      expect(result.width).toBe(50);
      expect(result.height).toBe(50);
    });

    it('should fill a region with custom color', async () => {
      const imageData = new MockImageData(50, 50) as unknown as ImageData;
      const region: MaskRegion = { x: 5, y: 5, width: 10, height: 10, type: 'fill' };

      const result = await masker.fillRegion(imageData, region, '#FF0000');

      expect(result).toBeDefined();
    });
  });

  describe('base64ToImageData', () => {
    it('should convert base64 with data URL prefix', async () => {
      // Mock Image for base64 conversion
      const mockImage = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        src: '',
        width: 10,
        height: 10,
      };

      vi.stubGlobal('Image', class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        _src = '';

        get src() {
          return this._src;
        }
        set src(value: string) {
          this._src = value;
          // Simulate async load
          setTimeout(() => {
            if (this.onload) {
              // Mock successful load
              Object.defineProperty(this, 'width', { value: 10 });
              Object.defineProperty(this, 'height', { value: 10 });
              this.onload();
            }
          }, 0);
        }
        width = 10;
        height = 10;
      });

      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await masker.base64ToImageData(base64);

      expect(result).toBeDefined();
      expect(result.width).toBe(10);
      expect(result.height).toBe(10);
    });

    it('should handle base64 without data URL prefix', async () => {
      vi.stubGlobal('Image', class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        _src = '';

        get src() {
          return this._src;
        }
        set src(value: string) {
          this._src = value;
          setTimeout(() => {
            if (this.onload) {
              Object.defineProperty(this, 'width', { value: 5 });
              Object.defineProperty(this, 'height', { value: 5 });
              this.onload();
            }
          }, 0);
        }
        width = 5;
        height = 5;
      });

      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await masker.base64ToImageData(base64);

      expect(result).toBeDefined();
    });

    it('should reject on image load error', async () => {
      vi.stubGlobal('Image', class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        _src = '';

        set src(value: string) {
          this._src = value;
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 0);
        }
      });

      await expect(masker.base64ToImageData('invalid')).rejects.toThrow('Failed to load image');
    });
  });

  describe('imageDataToBase64', () => {
    it('should convert ImageData to base64 string', () => {
      const imageData = new MockImageData(10, 10) as unknown as ImageData;

      const result = masker.imageDataToBase64(imageData);

      expect(result).toContain('data:image/png');
    });

    it('should support custom format', () => {
      const imageData = new MockImageData(10, 10) as unknown as ImageData;

      const result = masker.imageDataToBase64(imageData, 'image/jpeg');

      expect(result).toBeDefined();
    });
  });
});

describe('createMaskRegionsFromElements', () => {
  it('should create mask regions from element array', () => {
    const elements = [
      { rect: { x: 10, y: 20, width: 100, height: 30 }, type: 'password' as const },
      { rect: { x: 50, y: 100, width: 200, height: 40 }, type: 'sensitive' as const },
    ];

    const regions = createMaskRegionsFromElements(elements);

    expect(regions).toHaveLength(2);
    expect(regions[0]).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 30,
      type: 'blur',
      category: 'credential',
    });
    expect(regions[1]).toEqual({
      x: 50,
      y: 100,
      width: 200,
      height: 40,
      type: 'blur',
      category: 'pii',
    });
  });

  it('should default to pii category for unknown types', () => {
    const elements = [
      { rect: { x: 0, y: 0, width: 50, height: 50 } },
    ];

    const regions = createMaskRegionsFromElements(elements);

    expect(regions[0].category).toBe('pii');
  });

  it('should handle empty array', () => {
    const regions = createMaskRegionsFromElements([]);

    expect(regions).toHaveLength(0);
  });

  it('should map password type to credential category', () => {
    const elements = [
      { rect: { x: 0, y: 0, width: 100, height: 20 }, type: 'password' as const },
    ];

    const regions = createMaskRegionsFromElements(elements);

    expect(regions[0].category).toBe('credential');
  });

  it('should use blur type for all regions', () => {
    const elements = [
      { rect: { x: 0, y: 0, width: 50, height: 50 }, type: 'pii' as const },
      { rect: { x: 100, y: 100, width: 50, height: 50 }, type: 'password' as const },
    ];

    const regions = createMaskRegionsFromElements(elements);

    expect(regions.every(r => r.type === 'blur')).toBe(true);
  });
});
