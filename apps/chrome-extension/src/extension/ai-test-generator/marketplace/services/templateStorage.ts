/**
 * Template Storage Service
 * Manages local storage for downloaded templates, favorites, and usage history
 */

import type {
  ITemplateStorage,
  LocalTemplate,
  Template,
  TemplateUsageHistory,
} from '../types';

const STORAGE_KEYS = {
  TEMPLATES: 'marketplace:templates',
  FAVORITES: 'marketplace:favorites',
  HISTORY: 'marketplace:history',
  CONFIG: 'marketplace:config',
} as const;

const MAX_HISTORY_ENTRIES = 100;

/**
 * Template storage implementation using localStorage
 */
export class TemplateStorage implements ITemplateStorage {
  /**
   * Get data from localStorage with type safety
   */
  private getStorageData<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    } catch (error) {
      console.error(`Failed to parse storage data for ${key}:`, error);
    }
    return defaultValue;
  }

  /**
   * Save data to localStorage
   */
  private setStorageData<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to save storage data for ${key}:`, error);
      // Handle quota exceeded error
      if (
        error instanceof DOMException &&
        error.name === 'QuotaExceededError'
      ) {
        this.handleQuotaExceeded();
      }
    }
  }

  /**
   * Handle storage quota exceeded
   */
  private handleQuotaExceeded(): void {
    // Remove oldest history entries
    const history = this.getStorageData<TemplateUsageHistory[]>(
      STORAGE_KEYS.HISTORY,
      [],
    );
    if (history.length > 10) {
      const trimmedHistory = history.slice(-10);
      this.setStorageData(STORAGE_KEYS.HISTORY, trimmedHistory);
    }
  }

  /**
   * Get all templates from storage
   */
  private getTemplatesMap(): Map<string, LocalTemplate> {
    const data = this.getStorageData<Record<string, LocalTemplate>>(
      STORAGE_KEYS.TEMPLATES,
      {},
    );
    return new Map(Object.entries(data));
  }

  /**
   * Save templates map to storage
   */
  private saveTemplatesMap(map: Map<string, LocalTemplate>): void {
    const data = Object.fromEntries(map);
    this.setStorageData(STORAGE_KEYS.TEMPLATES, data);
  }

  /**
   * Save a template to local storage
   */
  async saveTemplate(template: Template): Promise<void> {
    const map = this.getTemplatesMap();
    const existing = map.get(template.id);

    const localTemplate: LocalTemplate = {
      id: template.id,
      template,
      downloadedAt: Date.now(),
      lastUsedAt: existing?.lastUsedAt,
      usageCount: existing?.usageCount || 0,
      isFavorite: existing?.isFavorite || false,
      customParameters: existing?.customParameters,
    };

    map.set(template.id, localTemplate);
    this.saveTemplatesMap(map);
  }

  /**
   * Get a template from local storage
   */
  async getTemplate(id: string): Promise<LocalTemplate | null> {
    const map = this.getTemplatesMap();
    return map.get(id) || null;
  }

  /**
   * Get all downloaded templates
   */
  async getDownloadedTemplates(): Promise<LocalTemplate[]> {
    const map = this.getTemplatesMap();
    return Array.from(map.values()).sort(
      (a, b) => b.downloadedAt - a.downloadedAt,
    );
  }

  /**
   * Get favorite templates
   */
  async getFavoriteTemplates(): Promise<LocalTemplate[]> {
    const map = this.getTemplatesMap();
    return Array.from(map.values())
      .filter((t) => t.isFavorite)
      .sort((a, b) => b.downloadedAt - a.downloadedAt);
  }

  /**
   * Set favorite status for a template
   */
  async setFavorite(id: string, isFavorite: boolean): Promise<void> {
    const map = this.getTemplatesMap();
    const template = map.get(id);
    if (template) {
      template.isFavorite = isFavorite;
      map.set(id, template);
      this.saveTemplatesMap(map);
    }
  }

  /**
   * Record template usage
   */
  async recordUsage(
    id: string,
    parameters: Record<string, unknown>,
    generatedYaml: string,
  ): Promise<void> {
    // Update template usage stats
    const map = this.getTemplatesMap();
    const template = map.get(id);
    if (template) {
      template.lastUsedAt = Date.now();
      template.usageCount += 1;
      template.customParameters = parameters;
      map.set(id, template);
      this.saveTemplatesMap(map);
    }

    // Add to history
    const history = this.getStorageData<TemplateUsageHistory[]>(
      STORAGE_KEYS.HISTORY,
      [],
    );
    const historyEntry: TemplateUsageHistory = {
      id: `${id}-${Date.now()}`,
      templateId: id,
      templateName: template?.template.name || id,
      parameters,
      usedAt: Date.now(),
      generatedYaml,
    };

    // Keep only recent entries
    const updatedHistory = [historyEntry, ...history].slice(
      0,
      MAX_HISTORY_ENTRIES,
    );
    this.setStorageData(STORAGE_KEYS.HISTORY, updatedHistory);
  }

  /**
   * Get usage history
   */
  async getUsageHistory(limit = 20): Promise<TemplateUsageHistory[]> {
    const history = this.getStorageData<TemplateUsageHistory[]>(
      STORAGE_KEYS.HISTORY,
      [],
    );
    return history.slice(0, limit);
  }

  /**
   * Delete a template from local storage
   */
  async deleteTemplate(id: string): Promise<void> {
    const map = this.getTemplatesMap();
    map.delete(id);
    this.saveTemplatesMap(map);
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.TEMPLATES);
    localStorage.removeItem(STORAGE_KEYS.FAVORITES);
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    templateCount: number;
    favoriteCount: number;
    historyCount: number;
    estimatedSize: number;
  } {
    const templates = this.getTemplatesMap();
    const history = this.getStorageData<TemplateUsageHistory[]>(
      STORAGE_KEYS.HISTORY,
      [],
    );
    const favorites = Array.from(templates.values()).filter(
      (t) => t.isFavorite,
    );

    let estimatedSize = 0;
    for (const key of Object.values(STORAGE_KEYS)) {
      const item = localStorage.getItem(key);
      if (item) {
        estimatedSize += item.length * 2; // UTF-16 characters
      }
    }

    return {
      templateCount: templates.size,
      favoriteCount: favorites.length,
      historyCount: history.length,
      estimatedSize,
    };
  }

  /**
   * Export all data for backup
   */
  exportData(): {
    templates: LocalTemplate[];
    history: TemplateUsageHistory[];
    exportedAt: number;
  } {
    const templates = Array.from(this.getTemplatesMap().values());
    const history = this.getStorageData<TemplateUsageHistory[]>(
      STORAGE_KEYS.HISTORY,
      [],
    );

    return {
      templates,
      history,
      exportedAt: Date.now(),
    };
  }

  /**
   * Import data from backup
   */
  importData(data: {
    templates: LocalTemplate[];
    history: TemplateUsageHistory[];
  }): void {
    // Merge templates
    const map = this.getTemplatesMap();
    for (const template of data.templates) {
      const existing = map.get(template.id);
      if (!existing || template.downloadedAt > existing.downloadedAt) {
        map.set(template.id, template);
      }
    }
    this.saveTemplatesMap(map);

    // Merge history
    const existingHistory = this.getStorageData<TemplateUsageHistory[]>(
      STORAGE_KEYS.HISTORY,
      [],
    );
    const existingIds = new Set(existingHistory.map((h) => h.id));
    const newHistory = data.history.filter((h) => !existingIds.has(h.id));
    const mergedHistory = [...newHistory, ...existingHistory]
      .sort((a, b) => b.usedAt - a.usedAt)
      .slice(0, MAX_HISTORY_ENTRIES);
    this.setStorageData(STORAGE_KEYS.HISTORY, mergedHistory);
  }
}

// Export singleton instance
export const templateStorage = new TemplateStorage();
