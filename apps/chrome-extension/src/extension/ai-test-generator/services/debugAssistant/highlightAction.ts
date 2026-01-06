/**
 * Highlight Action Service
 * Provides element highlighting functionality for debugging
 */

export interface HighlightOptions {
  color?: string;
  backgroundColor?: string;
  borderWidth?: number;
  duration?: number;
  label?: string;
  showTooltip?: boolean;
}

export interface HighlightResult {
  id: string;
  target: string;
  count: number;
  highlights: Array<{
    id: string;
    rect: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
  }>;
}

export interface HighlightActionOptions {
  getAgent: () => any;
}

/**
 * Highlight Action - element highlighting for debugging
 */
export class HighlightAction {
  private getAgent: () => any;
  private activeHighlights: Map<string, string[]> = new Map();
  private highlightIdCounter = 0;

  constructor(options: HighlightActionOptions) {
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
   * Generate unique highlight ID
   */
  private generateHighlightId(): string {
    return `debug-highlight-${Date.now()}-${this.highlightIdCounter++}`;
  }

  /**
   * Highlight elements matching the target description
   */
  async highlight(
    target: string,
    elements: any[] | null = null,
    options: HighlightOptions = {},
  ): Promise<HighlightResult> {
    const page = this.getPage();

    // Default highlight colors
    const color = options.color || '#ff6b6b';
    const backgroundColor =
      options.backgroundColor || 'rgba(255, 107, 107, 0.2)';
    const borderWidth = options.borderWidth || 3;

    // If elements not provided, try to locate them
    const targetElements = elements || (await this.locateElements(target));

    if (!targetElements || targetElements.length === 0) {
      return {
        id: this.generateHighlightId(),
        target,
        count: 0,
        highlights: [],
      };
    }

    // Add highlights to the page
    const highlights = await page.evaluate(
      ({ elementsToHighlight, col, bgCol, borderW, lbl, showTip }) => {
        const results: Array<{
          id: string;
          rect: { left: number; top: number; width: number; height: number };
        }> = [];

        for (const el of elementsToHighlight) {
          const highlightId = `debug-highlight-${Date.now()}-${Math.random()}`;

          // Create highlight overlay
          const div = document.createElement('div');
          div.id = highlightId;
          div.style.cssText = `
            position: fixed;
            left: ${el.rect.left}px;
            top: ${el.rect.top}px;
            width: ${el.rect.width}px;
            height: ${el.rect.height}px;
            border: ${borderW}px solid ${col};
            background: ${bgCol};
            pointer-events: none;
            z-index: 999999;
            border-radius: 4px;
            box-shadow: 0 0 10px ${col}40;
            transition: all 0.3s ease;
          `;

          // Add label if provided
          if (lbl) {
            const label = document.createElement('div');
            label.style.cssText = `
              position: absolute;
              top: -24px;
              left: 0;
              background: ${col};
              color: white;
              padding: 2px 6px;
              font-size: 12px;
              font-family: sans-serif;
              border-radius: 3px;
              white-space: nowrap;
            `;
            label.textContent = lbl;
            div.appendChild(label);
          }

          // Add tooltip if requested
          if (showTip) {
            const tooltip = document.createElement('div');
            tooltip.className = 'debug-highlight-tooltip';
            tooltip.style.cssText = `
              position: absolute;
              top: -60px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(0, 0, 0, 0.8);
              color: white;
              padding: 6px 10px;
              font-size: 12px;
              font-family: sans-serif;
              border-radius: 4px;
              white-space: nowrap;
              pointer-events: none;
            `;
            tooltip.textContent =
              el.text ||
              `Element at (${Math.round(el.rect.left)}, ${Math.round(el.rect.top)})`;
            div.appendChild(tooltip);
          }

          document.body.appendChild(div);

          results.push({
            id: highlightId,
            rect: el.rect,
          });
        }

        return results;
      },
      {
        elementsToHighlight: targetElements,
        col: color,
        bgCol: backgroundColor,
        borderW: borderWidth,
        lbl: options.label || '',
        showTip: options.showTooltip || false,
      },
    );

    // Track highlights for cleanup
    const highlightIds = highlights.map((h) => h.id);
    const resultId = highlightIds[0] || this.generateHighlightId();
    this.activeHighlights.set(resultId, highlightIds);

    return {
      id: resultId,
      target,
      count: highlights.length,
      highlights,
    };
  }

  /**
   * Highlight a specific element by coordinates
   */
  async highlightByCoordinates(
    x: number,
    y: number,
    width: number,
    height: number,
    options: HighlightOptions = {},
  ): Promise<string> {
    const page = this.getPage();
    const highlightId = this.generateHighlightId();

    const color = options.color || '#ff6b6b';
    const backgroundColor =
      options.backgroundColor || 'rgba(255, 107, 107, 0.2)';
    const borderWidth = options.borderWidth || 3;

    await page.evaluate(
      ({ id, xPos, yPos, w, h, col, bgCol, borderW, lbl }) => {
        const div = document.createElement('div');
        div.id = id;
        div.style.cssText = `
          position: fixed;
          left: ${xPos}px;
          top: ${yPos}px;
          width: ${w}px;
          height: ${h}px;
          border: ${borderW}px solid ${col};
          background: ${bgCol};
          pointer-events: none;
          z-index: 999999;
          border-radius: 4px;
          box-shadow: 0 0 10px ${col}40;
        `;

        if (lbl) {
          const label = document.createElement('div');
          label.style.cssText = `
            position: absolute;
            top: -24px;
            left: 0;
            background: ${col};
            color: white;
            padding: 2px 6px;
            font-size: 12px;
            font-family: sans-serif;
            border-radius: 3px;
          `;
          label.textContent = lbl;
          div.appendChild(label);
        }

        document.body.appendChild(div);
      },
      {
        id: highlightId,
        xPos: x,
        yPos: y,
        w: width,
        h: height,
        col: color,
        bgCol: backgroundColor,
        borderW: borderWidth,
        lbl: options.label || '',
      },
    );

    this.activeHighlights.set(highlightId, [highlightId]);
    return highlightId;
  }

  /**
   * Highlight multiple elements with different colors
   */
  async highlightMultiple(
    targets: Array<{ target: string; options?: HighlightOptions }>,
  ): Promise<HighlightResult[]> {
    const results: HighlightResult[] = [];

    for (const { target, options } of targets) {
      const elements = await this.locateElements(target);
      const result = await this.highlight(target, elements, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Remove a specific highlight
   */
  async removeHighlight(highlightId: string): Promise<boolean> {
    const page = this.getPage();
    const ids = this.activeHighlights.get(highlightId);

    if (!ids) {
      return false;
    }

    await page.evaluate((highlightIds) => {
      for (const id of highlightIds) {
        const el = document.getElementById(id);
        if (el) {
          el.remove();
        }
      }
    }, ids);

    this.activeHighlights.delete(highlightId);
    return true;
  }

  /**
   * Remove all highlights
   */
  async removeAllHighlights(): Promise<number> {
    const page = this.getPage();
    let count = 0;

    for (const [, ids] of this.activeHighlights) {
      await page.evaluate((highlightIds) => {
        for (const id of highlightIds) {
          const el = document.getElementById(id);
          if (el) {
            el.remove();
          }
        }
      }, ids);
      count += ids.length;
    }

    this.activeHighlights.clear();
    return count;
  }

  /**
   * Flash an element (highlight briefly then remove)
   */
  async flash(
    target: string,
    duration = 1000,
    elements: any[] | null = null,
  ): Promise<HighlightResult> {
    const result = await this.highlight(target, elements, {
      color: '#00ff00',
      backgroundColor: 'rgba(0, 255, 0, 0.3)',
    });

    // Auto-remove after duration
    setTimeout(() => {
      this.removeHighlight(result.id);
    }, duration);

    return result;
  }

  /**
   * Pulse animation on an element
   */
  async pulse(target: string, count = 3): Promise<HighlightResult> {
    const page = this.getPage();
    const elements = await this.locateElements(target);

    if (!elements || elements.length === 0) {
      return {
        id: this.generateHighlightId(),
        target,
        count: 0,
        highlights: [],
      };
    }

    const highlightId = this.generateHighlightId();
    const element = elements[0];

    await page.evaluate(
      async ({ id, el, cnt }) => {
        const div = document.createElement('div');
        div.id = id;
        div.style.cssText = `
          position: fixed;
          left: ${el.rect.left}px;
          top: ${el.rect.top}px;
          width: ${el.rect.width}px;
          height: ${el.rect.height}px;
          border: 3px solid #ff6b6b;
          background: rgba(255, 107, 107, 0.2);
          pointer-events: none;
          z-index: 999999;
          border-radius: 4px;
        `;

        document.body.appendChild(div);

        // Pulse animation
        for (let i = 0; i < cnt; i++) {
          div.style.transform = 'scale(1.1)';
          div.style.opacity = '0.8';
          await new Promise((resolve) => setTimeout(resolve, 200));
          div.style.transform = 'scale(1)';
          div.style.opacity = '1';
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        div.remove();
      },
      { id: highlightId, el: element, cnt: count },
    );

    return {
      id: highlightId,
      target,
      count: 1,
      highlights: [{ id: highlightId, rect: element.rect }],
    };
  }

  /**
   * Draw a path/arrow between two elements
   */
  async drawPath(
    fromTarget: string,
    toTarget: string,
    options: { color?: string; label?: string } = {},
  ): Promise<string> {
    const page = this.getPage();

    const fromElements = await this.locateElements(fromTarget);
    const toElements = await this.locateElements(toTarget);

    if (
      !fromElements ||
      fromElements.length === 0 ||
      !toElements ||
      toElements.length === 0
    ) {
      throw new Error('无法找到源或目标元素');
    }

    const fromEl = fromElements[0];
    const toEl = toElements[0];
    const pathId = this.generateHighlightId();

    await page.evaluate(
      ({ id, from, to, col, lbl }) => {
        const svg = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'svg',
        );
        svg.id = id;
        svg.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 999998;
        `;

        const fromX = from.rect.left + from.rect.width / 2;
        const fromY = from.rect.top + from.rect.height / 2;
        const toX = to.rect.left + to.rect.width / 2;
        const toY = to.rect.top + to.rect.height / 2;

        // Create path
        const path = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'path',
        );
        const midX = (fromX + toX) / 2;
        path.setAttribute(
          'd',
          `M ${fromX} ${fromY} Q ${midX} ${fromY} ${toX} ${toY}`,
        );
        path.setAttribute('stroke', col);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-dasharray', '5,5');
        svg.appendChild(path);

        // Add label if provided
        if (lbl) {
          const text = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'text',
          );
          text.setAttribute('x', midX);
          text.setAttribute('y', (fromY + toY) / 2 - 10);
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('fill', col);
          text.setAttribute('font-size', '12');
          text.setAttribute('font-family', 'sans-serif');
          text.textContent = lbl;
          svg.appendChild(text);
        }

        document.body.appendChild(svg);
      },
      {
        id: pathId,
        from: fromEl,
        to: toEl,
        col: options.color || '#ff6b6b',
        lbl: options.label || '',
      },
    );

    this.activeHighlights.set(pathId, [pathId]);
    return pathId;
  }

  /**
   * Locate elements using the agent
   */
  private async locateElements(description: string): Promise<any[] | null> {
    const agent = this.ensureAgent();

    try {
      if (typeof agent.aiLocate === 'function') {
        const result = await agent.aiLocate(description);
        if (result && Array.isArray(result) && result.length > 0) {
          return result;
        }
      }

      if (typeof agent.aiQuery === 'function') {
        const result = await agent.aiQuery(`找到${description}元素`);
        if (result?.elements) {
          return result.elements;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get all active highlight IDs
   */
  getActiveHighlights(): string[] {
    return Array.from(this.activeHighlights.keys());
  }

  /**
   * Clear all highlights without removing from DOM
   */
  clearTracking(): void {
    this.activeHighlights.clear();
  }
}

// Export singleton getter
let highlightActionInstance: HighlightAction | null = null;

export function getHighlightAction(
  options: HighlightActionOptions,
): HighlightAction {
  if (!highlightActionInstance) {
    highlightActionInstance = new HighlightAction(options);
  }
  return highlightActionInstance;
}

export function resetHighlightAction(): void {
  highlightActionInstance = null;
}
