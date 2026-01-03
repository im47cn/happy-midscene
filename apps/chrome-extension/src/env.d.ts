/// <reference types="@rsbuild/core/types" />

declare module '*.svg' {
  const content: string;
  export default content;
}
declare module '*.svg?react' {
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}

// Optional dependency - tesseract.js for OCR
declare module 'tesseract.js' {
  export interface Worker {
    recognize(
      image: string | HTMLImageElement | HTMLCanvasElement | ImageData,
    ): Promise<{
      data: {
        words: Array<{
          text: string;
          confidence: number;
          bbox: { x0: number; y0: number; x1: number; y1: number };
        }>;
      };
    }>;
    terminate(): Promise<void>;
  }
  export function createWorker(lang: string): Promise<Worker>;
}
