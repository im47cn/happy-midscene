/**
 * Execution Highlighter Service
 * Provides visual feedback during test execution by highlighting elements on the page
 */

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  duration?: number; // Auto-remove after duration (ms)
}

export type HighlightType = 'success' | 'failed' | 'pending' | 'current';

const HIGHLIGHT_COLORS: Record<HighlightType, string> = {
  success: '#52c41a',
  failed: '#ff4d4f',
  pending: '#faad14',
  current: '#1890ff',
};

/**
 * Execution Highlighter Service
 * Manages element highlighting overlays during test execution
 */
export class ExecutionHighlighter {
  private overlay: HTMLElement | null = null;
  private highlights: Map<string, HTMLElement> = new Map();
  private currentHighlight: HTMLElement | null = null;

  /**
   * Initialize the highlighter overlay
   */
  init(): void {
    if (typeof document === 'undefined') {
      return;
    }

    // Remove existing overlay if any
    this.cleanup();

    // Create main overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'midscene-execution-highlighter';
    Object.assign(this.overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '2147483645', // Below element selector but above most content
      margin: '0',
      padding: '0',
    });

    document.body.appendChild(this.overlay);
  }

  /**
   * Highlight an element at the specified position
   */
  highlight(rect: HighlightRect, type: HighlightType = 'current'): void {
    if (!this.overlay) {
      this.init();
    }

    const color = rect.color || HIGHLIGHT_COLORS[type];
    const duration = rect.duration;

    // Create highlight element
    const highlight = document.createElement('div');
    const id = `highlight-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    Object.assign(highlight.style, {
      position: 'absolute',
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      border: `3px solid ${color}`,
      borderRadius: '4px',
      backgroundColor: `${color}20`, // 20 = low opacity hex
      boxSizing: 'border-box',
      transition: 'all 0.3s ease',
      animation: 'midscene-pulse 1s ease-in-out infinite',
    });

    // Add animation keyframes if not already present
    this.ensureAnimationStyles();

    this.overlay?.appendChild(highlight);
    this.highlights.set(id, highlight);

    // Auto-remove after duration if specified
    if (duration) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    // Track as current highlight
    if (this.currentHighlight) {
      this.currentHighlight.style.animation = 'none';
      this.currentHighlight.style.opacity = '0.5';
    }
    this.currentHighlight = highlight;

    return id;
  }

  /**
   * Highlight the current active element (replaces previous highlight)
   */
  highlightCurrent(rect: HighlightRect): void {
    // Remove previous current highlight
    if (this.currentHighlight) {
      this.currentHighlight.remove();
      // Find and remove from map
      for (const [id, el] of this.highlights) {
        if (el === this.currentHighlight) {
          this.highlights.delete(id);
          break;
        }
      }
    }

    return this.highlight(rect, 'current');
  }

  /**
   * Mark current highlight as successful
   */
  markAsSuccess(): void {
    if (this.currentHighlight) {
      this.currentHighlight.style.borderColor = HIGHLIGHT_COLORS.success;
      this.currentHighlight.style.backgroundColor = `${HIGHLIGHT_COLORS.success}20`;
      this.currentHighlight.style.animation = 'none';

      // Auto-remove after 1 second
      setTimeout(() => {
        if (this.currentHighlight) {
          this.currentHighlight.style.opacity = '0';
          setTimeout(() => {
            this.currentHighlight?.remove();
            this.currentHighlight = null;
          }, 300);
        }
      }, 1000);
    }
  }

  /**
   * Mark current highlight as failed
   */
  markAsFailed(): void {
    if (this.currentHighlight) {
      this.currentHighlight.style.borderColor = HIGHLIGHT_COLORS.failed;
      this.currentHighlight.style.backgroundColor = `${HIGHLIGHT_COLORS.failed}20`;
      this.currentHighlight.style.animation = 'midshake 0.5s ease-in-out';

      // Add shake animation
      this.ensureShakeAnimation();
    }
  }

  /**
   * Add a persistent highlight (e.g., for failed steps)
   */
  addPersistentHighlight(rect: HighlightRect, type: HighlightType): string {
    const highlight = document.createElement('div');
    const id = `persistent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    Object.assign(highlight.style, {
      position: 'absolute',
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      border: `2px dashed ${HIGHLIGHT_COLORS[type]}`,
      borderRadius: '4px',
      backgroundColor: 'transparent',
      boxSizing: 'border-box',
    });

    // Add label
    const label = document.createElement('div');
    label.textContent = type.toUpperCase();
    Object.assign(label.style, {
      position: 'absolute',
      top: '-20px',
      left: '0',
      fontSize: '10px',
      fontWeight: 'bold',
      color: HIGHLIGHT_COLORS[type],
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    });
    highlight.appendChild(label);

    this.overlay?.appendChild(highlight);
    this.highlights.set(id, highlight);

    return id;
  }

  /**
   * Remove a specific highlight
   */
  remove(id: string): void {
    const highlight = this.highlights.get(id);
    if (highlight) {
      highlight.style.opacity = '0';
      setTimeout(() => {
        highlight.remove();
        this.highlights.delete(id);
      }, 300);
    }
  }

  /**
   * Clear all highlights
   */
  clearAll(): void {
    this.highlights.forEach((highlight) => {
      highlight.remove();
    });
    this.highlights.clear();
    this.currentHighlight = null;
  }

  /**
   * Clear all highlights except persistent ones
   */
  clearTemporary(): void {
    for (const [id, highlight] of this.highlights) {
      if (!id.startsWith('persistent-')) {
        highlight.remove();
        this.highlights.delete(id);
      }
    }
    if (
      this.currentHighlight &&
      !this.highlights.has(String(this.currentHighlight.id))
    ) {
      this.currentHighlight = null;
    }
  }

  /**
   * Clean up the highlighter
   */
  cleanup(): void {
    this.clearAll();
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.removeAnimationStyles();
  }

  /**
   * Ensure pulse animation styles are present
   */
  private ensureAnimationStyles(): void {
    if (document.getElementById('midscene-highlighter-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'midscene-highlighter-styles';
    style.textContent = `
      @keyframes midscene-pulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.7;
          transform: scale(1.02);
        }
      }
      @keyframes midshake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-4px); }
        75% { transform: translateX(4px); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Ensure shake animation is present
   */
  private ensureShakeAnimation(): void {
    this.ensureAnimationStyles();
  }

  /**
   * Remove animation styles
   */
  private removeAnimationStyles(): void {
    const style = document.getElementById('midscene-highlighter-styles');
    if (style) {
      style.remove();
    }
  }
}

// Singleton instance
let executionHighlighterInstance: ExecutionHighlighter | null = null;

/**
 * Get the singleton execution highlighter instance
 */
export function getExecutionHighlighter(): ExecutionHighlighter {
  if (!executionHighlighterInstance) {
    executionHighlighterInstance = new ExecutionHighlighter();
  }
  return executionHighlighterInstance;
}

/**
 * Cleanup the execution highlighter
 */
export function cleanupExecutionHighlighter(): void {
  if (executionHighlighterInstance) {
    executionHighlighterInstance.cleanup();
    executionHighlighterInstance = null;
  }
}
