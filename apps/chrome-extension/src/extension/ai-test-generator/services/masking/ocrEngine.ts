/**
 * OCR Engine
 * Optical Character Recognition for detecting text in screenshots
 * Uses Tesseract.js when available, falls back to pattern-based detection
 */

import type {
  DetectionResult,
  MaskRegion,
  SensitiveCategory,
} from '../../types/masking';
import { detectorEngine } from './detectorEngine';

/**
 * OCR word result with bounding box
 */
export interface OCRWord {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

/**
 * OCR line result
 */
export interface OCRLine {
  text: string;
  confidence: number;
  words: OCRWord[];
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

/**
 * OCR result
 */
export interface OCRResult {
  text: string;
  lines: OCRLine[];
  confidence: number;
  processingTime: number;
}

/**
 * Sensitive text match with location
 */
export interface SensitiveTextMatch {
  text: string;
  category: SensitiveCategory;
  ruleId: string;
  ruleName: string;
  region: MaskRegion;
  confidence: number;
}

/**
 * OCR Engine configuration
 */
export interface OCRConfig {
  language: string;
  minConfidence: number;
  enableCache: boolean;
}

/**
 * Default OCR configuration
 */
const DEFAULT_OCR_CONFIG: OCRConfig = {
  language: 'eng+chi_sim', // English + Simplified Chinese
  minConfidence: 60,
  enableCache: true,
};

/**
 * OCREngine class
 * Detects text in images and identifies sensitive data
 */
export class OCREngine {
  private config: OCRConfig;
  private tesseractWorker: any = null;
  private tesseractLoading: Promise<void> | null = null;
  private isAvailable = false;

  constructor(config: Partial<OCRConfig> = {}) {
    this.config = { ...DEFAULT_OCR_CONFIG, ...config };
  }

  /**
   * Initialize Tesseract.js worker (lazy loading)
   */
  async initialize(): Promise<boolean> {
    if (this.tesseractWorker) {
      return true;
    }

    if (this.tesseractLoading) {
      await this.tesseractLoading;
      return this.isAvailable;
    }

    this.tesseractLoading = this.loadTesseract();
    await this.tesseractLoading;
    return this.isAvailable;
  }

  /**
   * Load Tesseract.js dynamically
   */
  private async loadTesseract(): Promise<void> {
    try {
      // Try to dynamically import tesseract.js
      const Tesseract = await import('tesseract.js').catch(() => null);

      if (!Tesseract) {
        console.warn(
          'Tesseract.js not available. OCR features will be limited.',
        );
        this.isAvailable = false;
        return;
      }

      // Create worker with specified language
      this.tesseractWorker = await Tesseract.createWorker(this.config.language);
      this.isAvailable = true;
      console.log('Tesseract.js initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize Tesseract.js:', error);
      this.isAvailable = false;
    }
  }

  /**
   * Check if OCR is available
   */
  isOCRAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Recognize text in image
   * @param imageData - ImageData or base64 string
   * @returns OCR result with text and bounding boxes
   */
  async recognizeText(imageData: ImageData | string): Promise<OCRResult> {
    const startTime = Date.now();

    // If Tesseract is not available, return empty result
    if (!this.isAvailable || !this.tesseractWorker) {
      return {
        text: '',
        lines: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
      };
    }

    try {
      // Convert ImageData to canvas if needed
      let imageSource: string | ImageData = imageData;
      if (imageData instanceof ImageData) {
        imageSource = this.imageDataToDataURL(imageData);
      }

      // Run OCR
      const result = await this.tesseractWorker.recognize(imageSource);

      // Parse result
      const lines: OCRLine[] = result.data.lines.map((line: any) => ({
        text: line.text,
        confidence: line.confidence,
        words: line.words.map((word: any) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox,
        })),
        bbox: line.bbox,
      }));

      return {
        text: result.data.text,
        lines,
        confidence: result.data.confidence,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('OCR recognition failed:', error);
      return {
        text: '',
        lines: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Detect sensitive text in image and return mask regions
   * @param imageData - ImageData or base64 string
   * @returns Array of sensitive text matches with regions
   */
  async detectSensitiveText(
    imageData: ImageData | string,
  ): Promise<SensitiveTextMatch[]> {
    const ocrResult = await this.recognizeText(imageData);

    if (!ocrResult.text || ocrResult.lines.length === 0) {
      return [];
    }

    const matches: SensitiveTextMatch[] = [];

    // Process each line
    for (const line of ocrResult.lines) {
      // Run detection on line text
      const detections = await detectorEngine.detect(line.text, 'screenshot');

      for (const detection of detections) {
        // Find which words contain the detected text
        const matchingWords = this.findMatchingWords(line, detection);

        if (matchingWords.length > 0) {
          // Calculate bounding box that covers all matching words
          const region = this.calculateBoundingRegion(matchingWords);

          matches.push({
            text: detection.value,
            category: detection.category,
            ruleId: detection.ruleId,
            ruleName: detection.ruleName,
            region: {
              ...region,
              type: 'blur',
              category: detection.category,
            },
            confidence: Math.min(...matchingWords.map((w) => w.confidence)),
          });
        }
      }
    }

    return matches;
  }

  /**
   * Find words in a line that contain the detected text
   */
  private findMatchingWords(
    line: OCRLine,
    detection: DetectionResult,
  ): OCRWord[] {
    const matchingWords: OCRWord[] = [];
    const searchText = detection.value.toLowerCase();

    // Build concatenated text with word positions
    let currentPos = 0;
    const wordPositions: { word: OCRWord; start: number; end: number }[] = [];

    for (const word of line.words) {
      const wordText = word.text.toLowerCase();
      const start = currentPos;
      const end = currentPos + wordText.length;
      wordPositions.push({ word, start, end });
      currentPos = end + 1; // +1 for space
    }

    // Find words that overlap with the detection
    const lineText = line.text.toLowerCase();
    const matchStart = lineText.indexOf(searchText);

    if (matchStart === -1) {
      return matchingWords;
    }

    const matchEnd = matchStart + searchText.length;

    // Find overlapping words
    for (const { word, start, end } of wordPositions) {
      if (start < matchEnd && end > matchStart) {
        matchingWords.push(word);
      }
    }

    return matchingWords;
  }

  /**
   * Calculate bounding region from multiple words
   */
  private calculateBoundingRegion(words: OCRWord[]): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (words.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const word of words) {
      minX = Math.min(minX, word.bbox.x0);
      minY = Math.min(minY, word.bbox.y0);
      maxX = Math.max(maxX, word.bbox.x1);
      maxY = Math.max(maxY, word.bbox.y1);
    }

    // Add padding
    const padding = 2;
    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }

  /**
   * Convert ImageData to data URL
   * Note: Always uses HTMLCanvasElement since toDataURL is not available on OffscreenCanvas
   */
  private imageDataToDataURL(imageData: ImageData): string {
    // Always use HTMLCanvasElement for toDataURL support
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  /**
   * Terminate the OCR worker
   */
  async terminate(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
      this.isAvailable = false;
    }
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<OCRConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): OCRConfig {
    return { ...this.config };
  }
}

/**
 * Default OCR engine instance
 */
export const ocrEngine = new OCREngine();
