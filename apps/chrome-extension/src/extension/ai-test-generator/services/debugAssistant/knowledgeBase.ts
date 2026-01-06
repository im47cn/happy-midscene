/**
 * Knowledge Base Service
 * Stores and retrieves debug patterns and fix suggestions
 */

import type { DebugKnowledge, FixSuggestion } from '../../types/debugAssistant';

export interface KnowledgeEntry {
  id: string;
  pattern: string; // Error pattern or symptom
  fixes: FixSuggestion[];
  frequency: number; // How often this pattern occurs
  successRate: number; // 0-1, how often fixes work
  createdAt: number;
  lastUsedAt: number;
  tags: string[];
}

export interface KnowledgeStats {
  totalEntries: number;
  totalFixes: number;
  averageSuccessRate: number;
  mostCommonPatterns: Array<{ pattern: string; frequency: number }>;
}

export interface KnowledgeBaseOptions {
  storageKey?: string;
  maxEntries?: number;
  persistenceEnabled?: boolean;
}

/**
 * Knowledge Base - stores debug patterns and successful fixes
 */
export class KnowledgeBase {
  private storageKey: string;
  private maxEntries: number;
  private persistenceEnabled: boolean;
  private entries: Map<string, KnowledgeEntry> = new Map();

  constructor(options: KnowledgeBaseOptions = {}) {
    this.storageKey = options.storageKey || 'debug-assistant-knowledge';
    this.maxEntries = options.maxEntries ?? 1000;
    this.persistenceEnabled = options.persistenceEnabled ?? true;

    // Load from storage if enabled
    if (this.persistenceEnabled) {
      this.loadFromStorage();
    }
  }

  /**
   * Add a new entry to the knowledge base
   */
  addEntry(
    entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'lastUsedAt'>,
  ): string {
    // Check for similar existing entries
    const existing = this.findSimilarEntry(entry.pattern);
    if (existing) {
      // Update existing entry
      existing.frequency += entry.frequency;
      existing.lastUsedAt = Date.now();
      // Merge fixes
      for (const fix of entry.fixes) {
        const existingFix = existing.fixes.find(
          (f) => f.description === fix.description,
        );
        if (existingFix) {
          existingFix.confidence = Math.max(
            existingFix.confidence,
            fix.confidence,
          );
        } else {
          existing.fixes.push(fix);
        }
      }
      this.saveToStorage();
      return existing.id;
    }

    // Create new entry
    const newEntry: KnowledgeEntry = {
      id: `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pattern: entry.pattern,
      fixes: entry.fixes,
      frequency: entry.frequency,
      successRate: entry.successRate,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      tags: entry.tags,
    };

    this.entries.set(newEntry.id, newEntry);

    // Check max entries limit
    if (this.entries.size > this.maxEntries) {
      this.pruneOldEntries();
    }

    this.saveToStorage();
    return newEntry.id;
  }

  /**
   * Find entries matching a pattern
   */
  findMatchingPatterns(query: string, limit = 5): KnowledgeEntry[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    const scored = Array.from(this.entries.values()).map((entry) => {
      let score = 0;
      let hasMatch = false;
      const patternLower = entry.pattern.toLowerCase();

      // Exact match gets highest score
      if (
        patternLower.includes(queryLower) ||
        queryLower.includes(patternLower)
      ) {
        score += 10;
        hasMatch = true;
      }

      // Word matches
      for (const word of queryWords) {
        if (patternLower.includes(word)) {
          score += 2;
          hasMatch = true;
        }
      }

      // Tag matches
      for (const tag of entry.tags) {
        if (
          tag.toLowerCase().includes(queryLower) ||
          queryLower.includes(tag.toLowerCase())
        ) {
          score += 3;
          hasMatch = true;
        }
      }

      // Only add frequency/success/recency boosts if there was at least some match
      if (hasMatch) {
        // Frequency and success rate boost
        score += Math.log10(entry.frequency + 1) * 2;
        score += entry.successRate * 5;

        // Recency boost
        const daysSinceUsed =
          (Date.now() - entry.lastUsedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceUsed < 7) {
          score += 2;
        } else if (daysSinceUsed < 30) {
          score += 1;
        }
      }

      return { entry, score };
    });

    // Sort by score and return top matches
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  /**
   * Find a similar existing entry
   */
  private findSimilarEntry(pattern: string): KnowledgeEntry | null {
    const patternLower = pattern.toLowerCase();
    const patternWords = new Set(
      patternLower.split(/\s+/).filter((w) => w.length > 3),
    );

    for (const entry of this.entries.values()) {
      const entryLower = entry.pattern.toLowerCase();
      const entryWords = new Set(
        entryLower.split(/\s+/).filter((w) => w.length > 3),
      );

      // Skip if both patterns are empty after filtering (only short words)
      if (patternWords.size === 0 && entryWords.size === 0) {
        // For short patterns, only merge if identical
        if (entryLower === patternLower) {
          return entry;
        }
        continue;
      }

      // For single-word patterns, only merge if the words are identical
      if (patternWords.size === 1 && entryWords.size === 1) {
        const patternWord = Array.from(patternWords)[0];
        const entryWord = Array.from(entryWords)[0];
        if (patternWord === entryWord) {
          return entry;
        }
        continue;
      }

      // Check word overlap (for multi-word patterns)
      if (patternWords.size > 0 && entryWords.size > 0) {
        let overlapCount = 0;
        for (const word of patternWords) {
          if (entryWords.has(word)) {
            overlapCount++;
          }
        }

        // If high overlap, consider it similar
        const overlapRatio =
          overlapCount / Math.min(patternWords.size, entryWords.size);
        if (overlapRatio >= 0.75) {
          return entry;
        }
      }

      // Check if one contains the other (only for multi-word patterns)
      if (patternWords.size > 1 || entryWords.size > 1) {
        const shorter =
          patternLower.length < entryLower.length ? patternLower : entryLower;
        const longer =
          patternLower.length < entryLower.length ? entryLower : patternLower;
        // Only consider a match if the shorter is at least 85% of the longer's length
        if (
          shorter.length / longer.length >= 0.85 &&
          longer.includes(shorter)
        ) {
          return entry;
        }
      }
    }

    return null;
  }

  /**
   * Get an entry by ID
   */
  getEntry(id: string): KnowledgeEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Update entry success rate
   */
  updateSuccessRate(entryId: string, success: boolean): void {
    const entry = this.entries.get(entryId);
    if (!entry) return;

    const newSuccess = success ? 1 : 0;
    // Weighted average - give more weight to recent data
    entry.successRate = entry.successRate * 0.8 + newSuccess * 0.2;
    entry.lastUsedAt = Date.now();

    this.saveToStorage();
  }

  /**
   * Record that a fix was used
   */
  recordFixUsed(entryId: string, fixIndex: number): void {
    const entry = this.entries.get(entryId);
    if (!entry) return;

    entry.frequency++;
    entry.lastUsedAt = Date.now();

    // Move the used fix to the front of the list
    if (fixIndex >= 0 && fixIndex < entry.fixes.length) {
      const fix = entry.fixes[fixIndex];
      entry.fixes.splice(fixIndex, 1);
      entry.fixes.unshift(fix);
    }

    this.saveToStorage();
  }

  /**
   * Get statistics about the knowledge base
   */
  getStats(): KnowledgeStats {
    const entries = Array.from(this.entries.values());
    const totalFixes = entries.reduce((sum, e) => sum + e.fixes.length, 0);
    const averageSuccessRate =
      entries.length > 0
        ? entries.reduce((sum, e) => sum + e.successRate, 0) / entries.length
        : 0;

    const mostCommonPatterns = entries
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map((e) => ({ pattern: e.pattern, frequency: e.frequency }));

    return {
      totalEntries: entries.length,
      totalFixes,
      averageSuccessRate,
      mostCommonPatterns,
    };
  }

  /**
   * Search by tags
   */
  findByTags(tags: string[]): KnowledgeEntry[] {
    const tagSet = new Set(tags.map((t) => t.toLowerCase()));
    return Array.from(this.entries.values()).filter((entry) =>
      entry.tags.some((t) => tagSet.has(t.toLowerCase())),
    );
  }

  /**
   * Get entries by success rate range
   */
  getBySuccessRate(min: number, max: number): KnowledgeEntry[] {
    return Array.from(this.entries.values()).filter(
      (entry) => entry.successRate >= min && entry.successRate <= max,
    );
  }

  /**
   * Get recently used entries
   */
  getRecentEntries(days = 7, limit = 10): KnowledgeEntry[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return Array.from(this.entries.values())
      .filter((entry) => entry.lastUsedAt >= cutoff)
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, limit);
  }

  /**
   * Prune old entries to maintain max entries limit
   */
  private pruneOldEntries(): void {
    const sorted = Array.from(this.entries.entries()).sort((a, b) => {
      // Keep entries with higher success rate and more recent use
      const scoreA =
        a[1].successRate * 100 +
        (10000 - (Date.now() - a[1].lastUsedAt) / 1000);
      const scoreB =
        b[1].successRate * 100 +
        (10000 - (Date.now() - b[1].lastUsedAt) / 1000);
      return scoreB - scoreA;
    });

    // Remove oldest/least useful entries
    const toRemove = sorted.slice(this.maxEntries);
    for (const [id] of toRemove) {
      this.entries.delete(id);
    }
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    if (!this.persistenceEnabled) return;

    try {
      const data = Array.from(this.entries.entries());
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // Storage might be full or unavailable
      console.warn('Failed to save knowledge base to storage');
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    if (!this.persistenceEnabled) return;

    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data) as Array<[string, KnowledgeEntry]>;
        this.entries = new Map(parsed);
      }
    } catch {
      // Storage might be unavailable
      console.warn('Failed to load knowledge base from storage');
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.saveToStorage();
  }

  /**
   * Export knowledge base as JSON
   */
  export(): string {
    const data = Array.from(this.entries.entries());
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import knowledge base from JSON
   */
  import(json: string): void {
    try {
      const parsed = JSON.parse(json) as Array<[string, KnowledgeEntry]>;
      for (const [id, entry] of parsed) {
        this.entries.set(id, entry);
      }
      this.saveToStorage();
    } catch (error) {
      throw new Error(`Failed to import knowledge base: ${error}`);
    }
  }

  /**
   * Convert DebugKnowledge to KnowledgeEntry
   */
  static fromDebugKnowledge(
    knowledge: DebugKnowledge,
  ): Omit<KnowledgeEntry, 'id' | 'createdAt' | 'lastUsedAt'> {
    return {
      pattern: knowledge.pattern,
      fixes: knowledge.fixes,
      frequency: knowledge.frequency || 1,
      successRate: knowledge.successRate || 0.5,
      tags: knowledge.tags || [],
    };
  }

  /**
   * Convert KnowledgeEntry to DebugKnowledge
   */
  static toDebugKnowledge(entry: KnowledgeEntry): DebugKnowledge {
    return {
      pattern: entry.pattern,
      fixes: entry.fixes,
      frequency: entry.frequency,
      successRate: entry.successRate,
      tags: entry.tags,
    };
  }
}

// Export singleton getter
let knowledgeBaseInstance: KnowledgeBase | null = null;

export function getKnowledgeBase(
  options?: KnowledgeBaseOptions,
): KnowledgeBase {
  if (!knowledgeBaseInstance) {
    knowledgeBaseInstance = new KnowledgeBase(options);
  }
  return knowledgeBaseInstance;
}

export function resetKnowledgeBase(): void {
  knowledgeBaseInstance = null;
}
