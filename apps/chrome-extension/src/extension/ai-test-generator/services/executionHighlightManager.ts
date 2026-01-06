/**
 * Execution Highlight Manager
 * Manages element highlighting during test execution by injecting scripts into the target page
 */

import type { HighlightRect, HighlightType } from './executionHighlighter';

interface HighlightMessage {
  type:
    | 'highlight'
    | 'highlightCurrent'
    | 'markAsSuccess'
    | 'markAsFailed'
    | 'clear'
    | 'clearAll'
    | 'cleanup';
  rect?: HighlightRect;
  highlightType?: HighlightType;
}

interface HighlightManagerConfig {
  enabled: boolean;
  autoRemoveDuration: number; // ms
  showSuccessHighlights: boolean;
  showFailedHighlights: boolean;
}

const DEFAULT_CONFIG: HighlightManagerConfig = {
  enabled: true,
  autoRemoveDuration: 2000,
  showSuccessHighlights: true,
  showFailedHighlights: true,
};

/**
 * Initialize highlighter in page context
 * This function is serialized and injected into the page
 */
function initHighlighterInPage(): void {
  if (window.__midsceneHighlighterInitialized) {
    return;
  }
  window.__midsceneHighlighterInitialized = true;

  // Create highlighter styles
  const styleId = 'midscene-execution-highlighter-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent =
      '@keyframes midscene-pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.7;transform:scale(1.02);}}@keyframes midshake{0%,100%{transform:translateX(0);}25%{transform:translateX(-4px);}75%{transform:translateX(4px);}}';
    document.head.appendChild(style);
  }

  // Create overlay container
  const overlayId = 'midscene-execution-highlighter';
  let overlay = document.getElementById(overlayId);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483645;margin:0;padding:0;';
    document.body.appendChild(overlay);
  }

  const highlights = new Map<string, HTMLElement>();
  let currentHighlight: HTMLElement | null = null;
  let highlightCounter = 0;

  const colors = {
    success: '#52c41a',
    failed: '#ff4d4f',
    pending: '#faad14',
    current: '#1890ff',
  };

  window.__midsceneHighlighterAPI = {
    createHighlight: (
      rect: HighlightRect,
      type: HighlightType,
      duration?: number,
    ) => {
      const color = colors[type] || colors.current;
      const id = 'highlight-' + ++highlightCounter;

      const highlight = document.createElement('div');
      highlight.id = id;
      highlight.style.cssText = `position:absolute;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;border:3px solid ${color};border-radius:4px;background-color:${color}20;box-sizing:border-box;transition:all 0.3s ease;animation:midscene-pulse 1s ease-in-out infinite;`;

      overlay.appendChild(highlight);
      highlights.set(id, highlight);

      if (duration) {
        setTimeout(
          () => window.__midsceneHighlighterAPI.removeHighlight(id),
          duration,
        );
      }

      if (currentHighlight && currentHighlight.parentNode) {
        currentHighlight.style.animation = 'none';
        currentHighlight.style.opacity = '0.5';
      }
      currentHighlight = highlight;

      return id;
    },
    removeHighlight: (id: string) => {
      const highlight = highlights.get(id);
      if (highlight) {
        highlight.style.opacity = '0';
        setTimeout(() => {
          if (highlight.parentNode) {
            highlight.parentNode.removeChild(highlight);
          }
          highlights.delete(id);
        }, 300);
      }
    },
    clearAll: () => {
      highlights.forEach((highlight) => {
        if (highlight.parentNode) {
          highlight.parentNode.removeChild(highlight);
        }
      });
      highlights.clear();
      currentHighlight = null;
    },
    markCurrent: (color: string, animate: boolean) => {
      if (currentHighlight) {
        currentHighlight.style.borderColor = color;
        currentHighlight.style.backgroundColor = color + '20';
        currentHighlight.style.animation = animate
          ? 'midshake 0.5s ease-in-out'
          : 'none';
      }
    },
    markSuccess: () => {
      if (currentHighlight) {
        currentHighlight.style.borderColor = colors.success;
        currentHighlight.style.backgroundColor = colors.success + '20';
        currentHighlight.style.animation = 'none';
        setTimeout(() => {
          if (currentHighlight) {
            currentHighlight.style.opacity = '0';
            setTimeout(() => {
              if (currentHighlight && currentHighlight.parentNode) {
                currentHighlight.parentNode.removeChild(currentHighlight);
              }
              currentHighlight = null;
            }, 300);
          }
        }, 1000);
      }
    },
    markFailed: () => {
      if (currentHighlight) {
        currentHighlight.style.borderColor = colors.failed;
        currentHighlight.style.backgroundColor = colors.failed + '20';
        currentHighlight.style.animation = 'midshake 0.5s ease-in-out';
      }
    },
    cleanup: () => {
      window.__midsceneHighlighterAPI.clearAll();
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      const styleEl = document.getElementById(styleId);
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      window.__midsceneHighlighterInitialized = false;
      // @ts-expect-error - cleanup
      delete window.__midsceneHighlighterAPI;
    },
  };

  // Listen for messages from extension
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const { type, rect, highlightType } = event.data;
    switch (type) {
      case 'highlight':
        window.__midsceneHighlighterAPI.createHighlight(
          rect,
          (highlightType || 'current') as HighlightType,
          rect?.duration,
        );
        break;
      case 'highlightCurrent':
        if (currentHighlight && currentHighlight.parentNode) {
          currentHighlight.parentNode.removeChild(currentHighlight);
        }
        window.__midsceneHighlighterAPI.createHighlight(
          rect,
          'current',
          rect?.duration,
        );
        break;
      case 'markAsSuccess':
        window.__midsceneHighlighterAPI.markSuccess();
        break;
      case 'markAsFailed':
        window.__midsceneHighlighterAPI.markFailed();
        break;
      case 'clearAll':
        window.__midsceneHighlighterAPI.clearAll();
        break;
      case 'cleanup':
        window.__midsceneHighlighterAPI.cleanup();
        break;
    }
  });
}

/**
 * Check if highlighter is initialized
 */
function isHighlighterInitialized(): boolean {
  return window.__midsceneHighlighterInitialized || false;
}

/**
 * Send message to highlighter
 */
function sendHighlightMessage(message: HighlightMessage): void {
  window.postMessage(message, '*');
}

/**
 * Execution Highlight Manager
 * Manages communication with the content script highlighter
 */
export class ExecutionHighlightManager {
  private config: HighlightManagerConfig;
  private initialized = false;

  constructor(config?: Partial<HighlightManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<HighlightManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): HighlightManagerConfig {
    return { ...this.config };
  }

  /**
   * Initialize the highlighter in the active tab
   */
  async initialize(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id) {
        return false;
      }

      // Check if already initialized
      const [{ result: isInitialized }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: isHighlighterInitialized,
      });

      if (isInitialized) {
        this.initialized = true;
        return true;
      }

      // Inject the highlighter initialization function
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: initHighlighterInPage,
      });

      this.initialized = true;
      return true;
    } catch (error) {
      console.debug('Failed to initialize highlighter:', error);
      return false;
    }
  }

  /**
   * Send a message to the highlighter
   */
  private async sendMessage(message: HighlightMessage): Promise<void> {
    if (!this.config.enabled || !this.initialized) {
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id) {
        return;
      }

      // Send message via window.postMessage
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [message],
        func: sendHighlightMessage,
      });
    } catch (error) {
      console.debug('Failed to send highlight message:', error);
    }
  }

  /**
   * Highlight an element
   */
  async highlight(
    rect: HighlightRect,
    type: HighlightType = 'current',
  ): Promise<void> {
    await this.sendMessage({
      type: 'highlight',
      rect: {
        ...rect,
        duration: rect.duration || this.config.autoRemoveDuration,
      },
      highlightType: type,
    });
  }

  /**
   * Highlight the current active element (replaces previous)
   */
  async highlightCurrent(rect: HighlightRect): Promise<void> {
    await this.sendMessage({
      type: 'highlightCurrent',
      rect: {
        ...rect,
        duration: rect.duration || this.config.autoRemoveDuration,
      },
      highlightType: 'current',
    });
  }

  /**
   * Mark current highlight as successful
   */
  async markAsSuccess(): Promise<void> {
    if (this.config.showSuccessHighlights) {
      await this.sendMessage({ type: 'markAsSuccess' });
    }
  }

  /**
   * Mark current highlight as failed
   */
  async markAsFailed(): Promise<void> {
    if (this.config.showFailedHighlights) {
      await this.sendMessage({ type: 'markAsFailed' });
    }
  }

  /**
   * Clear all highlights
   */
  async clearAll(): Promise<void> {
    await this.sendMessage({ type: 'clearAll' });
  }

  /**
   * Cleanup the highlighter
   */
  async cleanup(): Promise<void> {
    await this.sendMessage({ type: 'cleanup' });
    this.initialized = false;
  }
}

// Singleton instance
let highlightManagerInstance: ExecutionHighlightManager | null = null;

/**
 * Get the singleton highlight manager instance
 */
export function getHighlightManager(
  config?: Partial<HighlightManagerConfig>,
): ExecutionHighlightManager {
  if (!highlightManagerInstance) {
    highlightManagerInstance = new ExecutionHighlightManager(config);
  } else if (config) {
    highlightManagerInstance.setConfig(config);
  }
  return highlightManagerInstance;
}

/**
 * Reset the highlight manager instance
 */
export function resetHighlightManager(): void {
  highlightManagerInstance = null;
}
