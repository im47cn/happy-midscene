/**
 * Whitelist Manager
 * Manages whitelist entries for sensitive data detection exclusions
 */

/**
 * Whitelist entry types
 */
export type WhitelistType = 'exact' | 'pattern' | 'domain' | 'path';

/**
 * Whitelist entry
 */
export interface WhitelistEntry {
  id: string;
  type: WhitelistType;
  value: string;
  description?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Whitelist manager configuration
 */
export interface WhitelistConfig {
  entries: WhitelistEntry[];
  enabled: boolean;
}

/**
 * Default whitelist configuration
 */
const DEFAULT_WHITELIST_CONFIG: WhitelistConfig = {
  entries: [],
  enabled: true,
};

/**
 * Storage key for whitelist
 */
const STORAGE_KEY = 'masking_whitelist';

/**
 * WhitelistManager class
 * Manages whitelist entries for excluding values from detection
 */
export class WhitelistManager {
  private config: WhitelistConfig;
  private compiledPatterns: Map<string, RegExp> = new Map();

  constructor() {
    this.config = { ...DEFAULT_WHITELIST_CONFIG };
    this.loadFromStorage();
  }

  /**
   * Load whitelist from storage
   */
  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.config = {
            ...DEFAULT_WHITELIST_CONFIG,
            ...parsed,
          };
          this.compilePatterns();
        }
      }
    } catch (error) {
      console.error('Failed to load whitelist from storage:', error);
    }
  }

  /**
   * Save whitelist to storage
   */
  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      }
    } catch (error) {
      console.error('Failed to save whitelist to storage:', error);
    }
  }

  /**
   * Compile regex patterns for pattern-type entries
   */
  private compilePatterns(): void {
    this.compiledPatterns.clear();
    for (const entry of this.config.entries) {
      if (entry.type === 'pattern' && entry.enabled) {
        try {
          this.compiledPatterns.set(entry.id, new RegExp(entry.value, 'gi'));
        } catch (error) {
          console.warn(
            `Invalid pattern in whitelist entry ${entry.id}:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Check if a value is whitelisted
   */
  isWhitelisted(
    value: string,
    context?: { url?: string; path?: string },
  ): boolean {
    if (!this.config.enabled) {
      return false;
    }

    for (const entry of this.config.entries) {
      if (!entry.enabled) continue;

      switch (entry.type) {
        case 'exact':
          if (value === entry.value) {
            return true;
          }
          break;

        case 'pattern': {
          const pattern = this.compiledPatterns.get(entry.id);
          if (pattern && pattern.test(value)) {
            return true;
          }
          break;
        }

        case 'domain':
          if (context?.url) {
            try {
              const url = new URL(context.url);
              if (
                url.hostname === entry.value ||
                url.hostname.endsWith(`.${entry.value}`)
              ) {
                return true;
              }
            } catch {
              // Invalid URL, skip
            }
          }
          break;

        case 'path':
          if (context?.path) {
            if (context.path.startsWith(entry.value)) {
              return true;
            }
          }
          break;
      }
    }

    return false;
  }

  /**
   * Add a whitelist entry
   */
  addEntry(
    entry: Omit<WhitelistEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ): WhitelistEntry {
    const now = Date.now();
    const newEntry: WhitelistEntry = {
      ...entry,
      id: `wl_${now}_${Math.random().toString(36).substring(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.config.entries.push(newEntry);
    this.compilePatterns();
    this.saveToStorage();

    return newEntry;
  }

  /**
   * Update a whitelist entry
   */
  updateEntry(
    id: string,
    updates: Partial<Omit<WhitelistEntry, 'id' | 'createdAt'>>,
  ): boolean {
    const index = this.config.entries.findIndex((e) => e.id === id);
    if (index === -1) {
      return false;
    }

    this.config.entries[index] = {
      ...this.config.entries[index],
      ...updates,
      updatedAt: Date.now(),
    };

    this.compilePatterns();
    this.saveToStorage();

    return true;
  }

  /**
   * Remove a whitelist entry
   */
  removeEntry(id: string): boolean {
    const index = this.config.entries.findIndex((e) => e.id === id);
    if (index === -1) {
      return false;
    }

    this.config.entries.splice(index, 1);
    this.compiledPatterns.delete(id);
    this.saveToStorage();

    return true;
  }

  /**
   * Get all whitelist entries
   */
  getEntries(): WhitelistEntry[] {
    return [...this.config.entries];
  }

  /**
   * Get a whitelist entry by ID
   */
  getEntry(id: string): WhitelistEntry | undefined {
    return this.config.entries.find((e) => e.id === id);
  }

  /**
   * Enable whitelist
   */
  enable(): void {
    this.config.enabled = true;
    this.saveToStorage();
  }

  /**
   * Disable whitelist
   */
  disable(): void {
    this.config.enabled = false;
    this.saveToStorage();
  }

  /**
   * Check if whitelist is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable a specific entry
   */
  enableEntry(id: string): boolean {
    return this.updateEntry(id, { enabled: true });
  }

  /**
   * Disable a specific entry
   */
  disableEntry(id: string): boolean {
    return this.updateEntry(id, { enabled: false });
  }

  /**
   * Export whitelist as JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import whitelist from JSON
   */
  importFromJSON(json: string): {
    success: boolean;
    count: number;
    error?: string;
  } {
    try {
      const parsed = JSON.parse(json);

      if (!parsed.entries || !Array.isArray(parsed.entries)) {
        return {
          success: false,
          count: 0,
          error: 'Invalid format: missing entries array',
        };
      }

      // Validate entries
      const validEntries: WhitelistEntry[] = [];
      for (const entry of parsed.entries) {
        if (
          typeof entry.type === 'string' &&
          typeof entry.value === 'string' &&
          ['exact', 'pattern', 'domain', 'path'].includes(entry.type)
        ) {
          validEntries.push({
            id:
              entry.id ||
              `wl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            type: entry.type,
            value: entry.value,
            description: entry.description || '',
            enabled: entry.enabled !== false,
            createdAt: entry.createdAt || Date.now(),
            updatedAt: Date.now(),
          });
        }
      }

      // Merge with existing entries (avoid duplicates by value)
      const existingValues = new Set(
        this.config.entries.map((e) => `${e.type}:${e.value}`),
      );
      const newEntries = validEntries.filter(
        (e) => !existingValues.has(`${e.type}:${e.value}`),
      );

      this.config.entries.push(...newEntries);
      this.compilePatterns();
      this.saveToStorage();

      return { success: true, count: newEntries.length };
    } catch (error) {
      return { success: false, count: 0, error: (error as Error).message };
    }
  }

  /**
   * Clear all whitelist entries
   */
  clear(): void {
    this.config.entries = [];
    this.compiledPatterns.clear();
    this.saveToStorage();
  }

  /**
   * Get whitelist statistics
   */
  getStats(): {
    total: number;
    enabled: number;
    byType: Record<WhitelistType, number>;
  } {
    const byType: Record<WhitelistType, number> = {
      exact: 0,
      pattern: 0,
      domain: 0,
      path: 0,
    };

    let enabled = 0;
    for (const entry of this.config.entries) {
      byType[entry.type]++;
      if (entry.enabled) {
        enabled++;
      }
    }

    return {
      total: this.config.entries.length,
      enabled,
      byType,
    };
  }
}

// Export singleton instance
export const whitelistManager = new WhitelistManager();
