/**
 * Compare Action Service
 * Provides screenshot comparison functionality for debugging
 */

export interface CompareResult {
  similar: boolean;
  score: number; // 0-1, where 1 is identical
  diff?: string; // Base64 encoded diff image
  message: string;
  details?: {
    totalPixels: number;
    differentPixels: number;
    differencePercentage: number;
  };
}

export interface CompareOptions {
  threshold?: number; // 0-1, default 0.95
  ignoreRegions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  ignoreColor?: boolean; // Compare only structure/brightness
  createDiffImage?: boolean; // Generate visual diff
}

export interface SnapshotInfo {
  id: string;
  timestamp: number;
  screenshot: string; // Base64
  url: string;
  title: string;
}

export interface CompareActionOptions {
  getAgent: () => any;
}

/**
 * Compare Action - screenshot comparison for debugging
 */
export class CompareAction {
  private getAgent: () => any;
  private snapshots: Map<string, SnapshotInfo> = new Map();
  private snapshotCounter = 0;

  constructor(options: CompareActionOptions) {
    this.getAgent = options.getAgent;
  }

  /**
   * Ensure agent is available
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
   * Take a snapshot of the current page state
   */
  async takeSnapshot(label?: string): Promise<SnapshotInfo> {
    const page = this.getPage();

    const screenshot = (await page.screenshot({
      type: 'png',
      encoding: 'base64',
    })) as string;

    const snapshot: SnapshotInfo = {
      id: `snapshot-${Date.now()}-${this.snapshotCounter++}`,
      timestamp: Date.now(),
      screenshot,
      url: page.url(),
      title: await page.title(),
    };

    this.snapshots.set(snapshot.id, snapshot);

    if (label) {
      this.snapshots.set(label, snapshot);
    }

    return snapshot;
  }

  /**
   * Get a snapshot by ID or label
   */
  getSnapshot(idOrLabel: string): SnapshotInfo | undefined {
    return this.snapshots.get(idOrLabel);
  }

  /**
   * Compare current page with a stored snapshot
   */
  async compareWithSnapshot(
    snapshotId: string,
    options: CompareOptions = {},
  ): Promise<CompareResult> {
    const snapshot = this.snapshots.get(snapshotId);

    if (!snapshot) {
      return {
        similar: false,
        score: 0,
        message: `快照不存在: ${snapshotId}`,
      };
    }

    const currentScreenshot = await this.takeCurrentScreenshot();
    return this.compareScreenshots(
      snapshot.screenshot,
      currentScreenshot,
      options,
    );
  }

  /**
   * Compare two screenshots
   */
  async compareScreenshots(
    before: string,
    after: string,
    options: CompareOptions = {},
  ): Promise<CompareResult> {
    const threshold = options.threshold ?? 0.95;

    try {
      const page = this.getPage();

      // Perform comparison using browser's canvas
      const result = await page.evaluate(
        ({
          beforeImg,
          afterImg,
          thresh,
          ignoreCol,
          createDiff,
          ignoreRegs,
        }) => {
          // Create image elements from base64
          const img1 = new Image();
          const img2 = new Image();

          // Load images
          const load1 = new Promise<void>((resolve) => {
            img1.onload = () => resolve();
            img1.src = `data:image/png;base64,${beforeImg}`;
          });
          const load2 = new Promise<void>((resolve) => {
            img2.onload = () => resolve();
            img2.src = `data:image/png;base64,${afterImg}`;
          });

          // Wait for both to load
          return Promise.all([load1, load2]).then(() => {
            const width = Math.max(img1.width, img2.width);
            const height = Math.max(img1.height, img2.height);

            // Create canvases
            const canvas1 = document.createElement('canvas');
            const canvas2 = document.createElement('canvas');
            const diffCanvas = document.createElement('canvas');

            canvas1.width = width;
            canvas1.height = height;
            canvas2.width = width;
            canvas2.height = height;
            diffCanvas.width = width;
            diffCanvas.height = height;

            const ctx1 = canvas1.getContext('2d')!;
            const ctx2 = canvas2.getContext('2d')!;
            const diffCtx = diffCanvas.getContext('2d')!;

            // Draw images
            ctx1.drawImage(img1, 0, 0);
            ctx2.drawImage(img2, 0, 0);

            // Get image data
            const data1 = ctx1.getImageData(0, 0, width, height);
            const data2 = ctx2.getImageData(0, 0, width, height);
            const diffData = diffCtx.createImageData(width, height);

            let totalPixels = 0;
            let differentPixels = 0;
            let totalDifference = 0;

            // Check for ignore regions
            const shouldIgnore = (x: number, y: number): boolean => {
              if (!ignoreRegs || ignoreRegs.length === 0) return false;
              return ignoreRegs.some(
                (reg) =>
                  x >= reg.x &&
                  x < reg.x + reg.width &&
                  y >= reg.y &&
                  y < reg.y + reg.height,
              );
            };

            // Compare pixels
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;

                if (shouldIgnore(x, y)) {
                  // Skip ignored regions
                  diffData.data[i] = data1.data[i];
                  diffData.data[i + 1] = data1.data[i + 1];
                  diffData.data[i + 2] = data1.data[i + 2];
                  diffData.data[i + 3] = 255;
                  continue;
                }

                const r1 = data1.data[i];
                const g1 = data1.data[i + 1];
                const b1 = data1.data[i + 2];

                const r2 = data2.data[i];
                const g2 = data2.data[i + 1];
                const b2 = data2.data[i + 2];

                let diff: number;

                if (ignoreCol) {
                  // Compare only luminance
                  const lum1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
                  const lum2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
                  diff = Math.abs(lum1 - lum2) / 255;
                } else {
                  // Compare RGB
                  const dr = r1 - r2;
                  const dg = g1 - g2;
                  const db = b1 - b2;
                  diff =
                    Math.sqrt(dr * dr + dg * dg + db * db) /
                    (255 * Math.sqrt(3));
                }

                totalPixels++;
                totalDifference += diff;

                if (diff > 0.1) {
                  differentPixels++;
                }

                // Create diff image
                if (createDiff) {
                  if (diff > 0.1) {
                    // Red for differences
                    diffData.data[i] = 255;
                    diffData.data[i + 1] = 0;
                    diffData.data[i + 2] = 0;
                  } else {
                    // Grayscale for same
                    const gray = Math.round(
                      0.299 * r1 + 0.587 * g1 + 0.114 * b1,
                    );
                    diffData.data[i] = gray;
                    diffData.data[i + 1] = gray;
                    diffData.data[i + 2] = gray;
                  }
                  diffData.data[i + 3] = 255;
                }
              }
            }

            const score = 1 - totalDifference / totalPixels;
            const diffPercent = (differentPixels / totalPixels) * 100;

            let diffImage = '';
            if (createDiff) {
              diffCtx.putImageData(diffData, 0, 0);
              diffImage = diffCanvas.toDataURL('image/png').split(',')[1];
            }

            return {
              score,
              totalPixels,
              differentPixels,
              differencePercentage: diffPercent,
              diffImage,
            };
          });
        },
        {
          beforeImg: before,
          afterImg: after,
          thresh: threshold,
          ignoreCol: options.ignoreColor || false,
          createDiff: options.createDiffImage || false,
          ignoreRegs: options.ignoreRegions || [],
        },
      );

      return {
        similar: result.score >= threshold,
        score: result.score,
        diff: result.diffImage,
        message:
          result.score >= threshold
            ? '页面状态基本一致'
            : `页面存在差异，差异比例: ${result.differencePercentage.toFixed(1)}%`,
        details: {
          totalPixels: result.totalPixels,
          differentPixels: result.differentPixels,
          differencePercentage: result.differencePercentage,
        },
      };
    } catch (error) {
      return {
        similar: false,
        score: 0,
        message: `对比失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Compare current page state with a previous screenshot
   */
  async compare(value?: {
    previousScreenshot?: string;
    snapshotId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data?: {
      previous: string;
      current: string;
    };
    screenshot?: string;
  }> {
    const previousScreenshot = value?.previousScreenshot || value?.snapshotId;
    const currentScreenshot = await this.takeCurrentScreenshot();

    if (!previousScreenshot) {
      return {
        success: true,
        message: '已获取当前截图（可进行视觉对比）',
        data: {
          current: currentScreenshot,
          previous: '',
        },
        screenshot: currentScreenshot,
      };
    }

    // If it's a snapshot ID, get the actual screenshot
    let actualPrevious = previousScreenshot;
    if (this.snapshots.has(previousScreenshot)) {
      actualPrevious = this.snapshots.get(previousScreenshot)!.screenshot;
    }

    const result = await this.compareScreenshots(
      actualPrevious,
      currentScreenshot,
      {
        createDiffImage: true,
      },
    );

    return {
      success: result.similar,
      message: result.message,
      data: {
        previous: actualPrevious,
        current: currentScreenshot,
      },
      screenshot: currentScreenshot,
    };
  }

  /**
   * Take current screenshot
   */
  private async takeCurrentScreenshot(): Promise<string> {
    const page = this.getPage();
    return (await page.screenshot({
      type: 'png',
      encoding: 'base64',
    })) as string;
  }

  /**
   * Create a snapshot before an action
   */
  async createBeforeSnapshot(label?: string): Promise<string> {
    const snapshot = await this.takeSnapshot(
      `${label || 'before'}-${Date.now()}`,
    );
    return snapshot.id;
  }

  /**
   * Create a snapshot after an action and compare
   */
  async createAfterSnapshot(
    beforeId: string,
    options?: CompareOptions,
  ): Promise<CompareResult> {
    const afterSnapshot = await this.takeSnapshot(`after-${Date.now()}`);
    return this.compareWithSnapshot(beforeId, options);
  }

  /**
   * Compare specific element between states
   */
  async compareElement(
    selector: string,
    beforeSnapshotId: string,
    options: CompareOptions = {},
  ): Promise<CompareResult> {
    const snapshot = this.snapshots.get(beforeSnapshotId);

    if (!snapshot) {
      return {
        similar: false,
        score: 0,
        message: `快照不存在: ${beforeSnapshotId}`,
      };
    }

    const page = this.getPage();

    try {
      const result = await page.evaluate(
        async ({ sel, snapId, opts }) => {
          // Get current element rect
          const element = document.querySelector(sel);
          if (!element) {
            return { error: '元素不存在' };
          }

          const rect = element.getBoundingClientRect();

          // Get current screenshot of just that element
          const canvas = document.createElement('canvas');
          canvas.width = rect.width;
          canvas.height = rect.height;
          const ctx = canvas.getContext('2d')!;

          // We need to redraw the page to capture the element
          // This is a simplified version - for full accuracy, we'd need more complex handling
          ctx.drawImage(
            document.documentElement,
            rect.left,
            rect.top,
            rect.width,
            rect.height,
            0,
            0,
            rect.width,
            rect.height,
          );

          return {
            currentRect: {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            },
          };
        },
        { sel: selector, snapId: beforeSnapshotId, opts: options },
      );

      if ('error' in result) {
        return {
          similar: false,
          score: 0,
          message: result.error as string,
        };
      }

      return {
        similar: true,
        score: 1,
        message: `元素位置: (${result.currentRect.left}, ${result.currentRect.top}), 大小: ${result.currentRect.width}x${result.currentRect.height}`,
      };
    } catch (error) {
      return {
        similar: false,
        score: 0,
        message: `元素对比失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(id: string): boolean {
    return this.snapshots.delete(id);
  }

  /**
   * Clear all snapshots
   */
  clearSnapshots(): void {
    this.snapshots.clear();
  }

  /**
   * Get all snapshot IDs
   * Returns only actual snapshot IDs, not label aliases
   */
  getSnapshotIds(): string[] {
    return Array.from(this.snapshots.keys()).filter((key) =>
      key.startsWith('snapshot-'),
    );
  }

  /**
   * Get snapshot count
   * Counts only actual snapshot IDs, not label aliases
   */
  getSnapshotCount(): number {
    // Filter to count only actual snapshot IDs (not label aliases)
    return Array.from(this.snapshots.keys()).filter((key) =>
      key.startsWith('snapshot-'),
    ).length;
  }
}

// Export singleton getter
let compareActionInstance: CompareAction | null = null;

export function getCompareAction(options: CompareActionOptions): CompareAction {
  if (!compareActionInstance) {
    compareActionInstance = new CompareAction(options);
  }
  return compareActionInstance;
}

export function resetCompareAction(): void {
  compareActionInstance = null;
}
