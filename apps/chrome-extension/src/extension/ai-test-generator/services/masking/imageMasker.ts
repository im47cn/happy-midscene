/**
 * Image Masker
 * Masks sensitive regions in screenshots
 */

import type {
  IImageMasker,
  ImageMaskingResult,
  MaskRegion,
  ScreenshotMaskingLevel,
} from '../../types/masking';

/**
 * OCR detection options for strict mode
 */
export interface OCRDetectionOptions {
  enabled: boolean;
  minConfidence: number;
}

/**
 * Default OCR options
 */
const DEFAULT_OCR_OPTIONS: OCRDetectionOptions = {
  enabled: false,
  minConfidence: 60,
};

/**
 * ImageMasker implementation
 * Uses Canvas API to blur/fill sensitive regions in images
 */
export class ImageMasker implements IImageMasker {
  private ocrOptions: OCRDetectionOptions = { ...DEFAULT_OCR_OPTIONS };
  /**
   * Mask sensitive regions in a screenshot
   * @param imageData - ImageData or base64 string
   * @param level - Masking level: 'off', 'standard', or 'strict'
   * @param sensitiveRegions - Pre-detected sensitive regions
   * @returns Masked image and result details
   */
  async maskScreenshot(
    imageData: ImageData | string,
    level: ScreenshotMaskingLevel,
    sensitiveRegions?: MaskRegion[],
  ): Promise<{ imageData: ImageData; result: ImageMaskingResult }> {
    const startTime = Date.now();

    // Convert base64 to ImageData if needed
    let imgData: ImageData;
    if (typeof imageData === 'string') {
      imgData = await this.base64ToImageData(imageData);
    } else {
      imgData = imageData;
    }

    // Return original if masking is off
    if (level === 'off') {
      return {
        imageData: imgData,
        result: {
          originalSize: { width: imgData.width, height: imgData.height },
          regions: [],
          processingTime: Date.now() - startTime,
        },
      };
    }

    // Get regions to mask
    let regions = sensitiveRegions || [];

    // In strict mode with OCR enabled, detect sensitive text in the image
    if (level === 'strict' && this.ocrOptions.enabled && regions.length === 0) {
      const ocrRegions = await this.detectWithOCR(imgData);
      regions = ocrRegions;
    }

    // If no regions to mask, return original
    if (regions.length === 0) {
      return {
        imageData: imgData,
        result: {
          originalSize: { width: imgData.width, height: imgData.height },
          regions: [],
          processingTime: Date.now() - startTime,
        },
      };
    }

    // Apply masking to regions
    const maskedData = await this.applyMasks(imgData, regions);

    return {
      imageData: maskedData,
      result: {
        originalSize: { width: imgData.width, height: imgData.height },
        regions,
        processingTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Apply blur masking to specified region
   */
  async blurRegion(
    imageData: ImageData,
    region: MaskRegion,
    radius = 10,
  ): Promise<ImageData> {
    const canvas = this.createCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw original image
    ctx.putImageData(imageData, 0, 0);

    // Extract region
    const regionData = ctx.getImageData(
      region.x,
      region.y,
      region.width,
      region.height,
    );

    // Apply blur using box blur algorithm
    const blurredData = this.boxBlur(regionData, radius);

    // Put blurred region back
    ctx.putImageData(blurredData, region.x, region.y);

    return ctx.getImageData(0, 0, imageData.width, imageData.height);
  }

  /**
   * Apply solid fill masking to specified region
   */
  async fillRegion(
    imageData: ImageData,
    region: MaskRegion,
    color = '#000000',
  ): Promise<ImageData> {
    const canvas = this.createCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw original image
    ctx.putImageData(imageData, 0, 0);

    // Fill region with solid color
    ctx.fillStyle = color;
    ctx.fillRect(region.x, region.y, region.width, region.height);

    return ctx.getImageData(0, 0, imageData.width, imageData.height);
  }

  /**
   * Convert base64 image to ImageData
   */
  async base64ToImageData(base64: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const canvas = this.createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      // Handle both with and without data URL prefix
      if (base64.startsWith('data:')) {
        img.src = base64;
      } else {
        img.src = `data:image/png;base64,${base64}`;
      }
    });
  }

  /**
   * Convert ImageData to base64
   */
  imageDataToBase64(imageData: ImageData, format = 'image/png'): string {
    const canvas = this.createCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL(format);
  }

  /**
   * Apply masks to all regions
   */
  private async applyMasks(
    imageData: ImageData,
    regions: MaskRegion[],
  ): Promise<ImageData> {
    let result = imageData;

    for (const region of regions) {
      // Ensure region is within bounds
      const safeRegion = this.clampRegion(
        region,
        imageData.width,
        imageData.height,
      );

      if (safeRegion.width <= 0 || safeRegion.height <= 0) {
        continue;
      }

      if (region.type === 'blur') {
        result = await this.blurRegion(result, safeRegion);
      } else {
        result = await this.fillRegion(result, safeRegion);
      }
    }

    return result;
  }

  /**
   * Ensure region is within image bounds
   */
  private clampRegion(
    region: MaskRegion,
    imageWidth: number,
    imageHeight: number,
  ): MaskRegion {
    const x = Math.max(0, Math.min(region.x, imageWidth - 1));
    const y = Math.max(0, Math.min(region.y, imageHeight - 1));
    const width = Math.min(region.width, imageWidth - x);
    const height = Math.min(region.height, imageHeight - y);

    return { ...region, x, y, width, height };
  }

  /**
   * Box blur algorithm for image data
   */
  private boxBlur(imageData: ImageData, radius: number): ImageData {
    const { data, width, height } = imageData;
    const output = new Uint8ClampedArray(data);

    // Horizontal blur
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          count = 0;

        for (let dx = -radius; dx <= radius; dx++) {
          const px = Math.min(width - 1, Math.max(0, x + dx));
          const idx = (y * width + px) * 4;

          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          a += data[idx + 3];
          count++;
        }

        const outIdx = (y * width + x) * 4;
        output[outIdx] = r / count;
        output[outIdx + 1] = g / count;
        output[outIdx + 2] = b / count;
        output[outIdx + 3] = a / count;
      }
    }

    // Vertical blur
    const temp = new Uint8ClampedArray(output);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          const py = Math.min(height - 1, Math.max(0, y + dy));
          const idx = (py * width + x) * 4;

          r += temp[idx];
          g += temp[idx + 1];
          b += temp[idx + 2];
          a += temp[idx + 3];
          count++;
        }

        const outIdx = (y * width + x) * 4;
        output[outIdx] = r / count;
        output[outIdx + 1] = g / count;
        output[outIdx + 2] = b / count;
        output[outIdx + 3] = a / count;
      }
    }

    return new ImageData(output, width, height);
  }

  /**
   * Create a canvas element (works in both browser and worker contexts)
   * Returns HTMLCanvasElement for consistent typing - OffscreenCanvas is cast
   */
  private createCanvas(width: number, height: number): HTMLCanvasElement {
    // Try OffscreenCanvas first (works in workers)
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement;
    }

    // Fall back to regular canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Detect sensitive text in image using OCR
   */
  private async detectWithOCR(imageData: ImageData): Promise<MaskRegion[]> {
    try {
      // Lazy import to avoid circular dependencies
      const { ocrEngine } = await import('./ocrEngine');

      // Initialize OCR if needed
      const available = await ocrEngine.initialize();
      if (!available) {
        return [];
      }

      // Detect sensitive text
      const matches = await ocrEngine.detectSensitiveText(imageData);

      // Filter by confidence
      return matches
        .filter((m) => m.confidence >= this.ocrOptions.minConfidence)
        .map((m) => m.region);
    } catch (error) {
      console.warn('OCR detection failed:', error);
      return [];
    }
  }

  /**
   * Enable or disable OCR detection
   */
  setOCREnabled(enabled: boolean): void {
    this.ocrOptions.enabled = enabled;
  }

  /**
   * Check if OCR is enabled
   */
  isOCREnabled(): boolean {
    return this.ocrOptions.enabled;
  }

  /**
   * Set OCR options
   */
  setOCROptions(options: Partial<OCRDetectionOptions>): void {
    this.ocrOptions = { ...this.ocrOptions, ...options };
  }

  /**
   * Get OCR options
   */
  getOCROptions(): OCRDetectionOptions {
    return { ...this.ocrOptions };
  }
}

/**
 * Default image masker instance
 */
export const imageMasker = new ImageMasker();

/**
 * Helper function to create mask regions from element information
 */
export function createMaskRegionsFromElements(
  elements: Array<{
    rect: { x: number; y: number; width: number; height: number };
    type?: 'password' | 'sensitive' | 'pii';
  }>,
): MaskRegion[] {
  return elements.map((el) => ({
    x: el.rect.x,
    y: el.rect.y,
    width: el.rect.width,
    height: el.rect.height,
    type: 'blur' as const,
    category:
      el.type === 'password' ? ('credential' as const) : ('pii' as const),
  }));
}
