/**
 * Audit Logger Service
 *
 * Logs and queries audit entries for security and compliance.
 */

import type { AuditEntry, Resource } from '../../types/collaboration';
import type { AuditQuery, AuditQueryOptions, IAuditLogger } from './interfaces';

/**
 * In-memory storage for audit entries
 * In production, this would be replaced with a database or log service
 */
interface AuditStorage {
  entries: Map<string, AuditEntry>;
  byWorkspace: Map<string, Set<string>>;
  byUser: Map<string, Set<string>>;
  byResource: Map<string, Set<string>>;
}

/**
 * Audit Logger Implementation
 */
export class AuditLogger implements IAuditLogger {
  private storage: AuditStorage;
  private maxEntries = 10000; // Prevent unbounded growth

  constructor() {
    this.storage = {
      entries: new Map(),
      byWorkspace: new Map(),
      byUser: new Map(),
      byResource: new Map(),
    };
  }

  /**
   * Log an action
   */
  async log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    const id = this.generateId();
    const timestamp = Date.now();

    const auditEntry: AuditEntry = {
      id,
      ...entry,
      timestamp,
    };

    // Store entry
    this.storage.entries.set(id, auditEntry);

    // Index by workspace
    this.addToIndex(this.storage.byWorkspace, entry.workspaceId, id);

    // Index by user
    this.addToIndex(this.storage.byUser, entry.userId, id);

    // Index by resource
    const resourceKey = `${entry.resourceType}:${entry.resourceId}`;
    this.addToIndex(this.storage.byResource, resourceKey, id);

    // Prevent unbounded growth
    if (this.storage.entries.size > this.maxEntries) {
      this.pruneOldEntries();
    }
  }

  /**
   * Query audit logs
   */
  async query(query: AuditQuery): Promise<AuditEntry[]> {
    let results: AuditEntry[] = [];

    // Start with workspace entries if specified
    if (query.workspaceId) {
      const workspaceIds = this.storage.byWorkspace.get(query.workspaceId);
      if (workspaceIds) {
        for (const id of workspaceIds) {
          const entry = this.storage.entries.get(id);
          if (entry) results.push(entry);
        }
      }
    } else {
      // Otherwise, get all entries
      results = Array.from(this.storage.entries.values());
    }

    // Filter by user
    if (query.userId) {
      results = results.filter((e) => e.userId === query.userId);
    }

    // Filter by resource type
    if (query.resourceType) {
      results = results.filter((e) => e.resourceType === query.resourceType);
    }

    // Filter by resource ID
    if (query.resourceId) {
      results = results.filter((e) => e.resourceId === query.resourceId);
    }

    // Filter by action
    if (query.action) {
      results = results.filter((e) => e.action === query.action);
    }

    // Filter by time range
    if (query.startTime) {
      results = results.filter((e) => e.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      results = results.filter((e) => e.timestamp <= query.endTime!);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results.map((e) => ({ ...e }));
  }

  /**
   * Get audit entries for a resource
   */
  async getByResource(
    resourceType: Resource['type'],
    resourceId: string,
  ): Promise<AuditEntry[]> {
    const resourceKey = `${resourceType}:${resourceId}`;
    const entryIds = this.storage.byResource.get(resourceKey);

    if (!entryIds) {
      return [];
    }

    const entries: AuditEntry[] = [];
    for (const id of entryIds) {
      const entry = this.storage.entries.get(id);
      if (entry) {
        entries.push({ ...entry });
      }
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get audit entries for a user
   */
  async getByUser(
    userId: string,
    options?: AuditQueryOptions,
  ): Promise<AuditEntry[]> {
    const entryIds = this.storage.byUser.get(userId);

    if (!entryIds) {
      return [];
    }

    let entries: AuditEntry[] = [];
    for (const id of entryIds) {
      const entry = this.storage.entries.get(id);
      if (entry) {
        entries.push({ ...entry });
      }
    }

    // Apply time filters
    if (options?.startTime) {
      entries = entries.filter((e) => e.timestamp >= options.startTime!);
    }
    if (options?.endTime) {
      entries = entries.filter((e) => e.timestamp <= options.endTime!);
    }

    // Apply limit
    if (options?.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Export audit logs
   */
  async export(query: AuditQuery, format: 'json' | 'csv'): Promise<string> {
    const entries = await this.query(query);

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    // CSV format
    const headers = [
      'timestamp',
      'userId',
      'action',
      'resourceType',
      'resourceId',
      'workspaceId',
      'success',
      'error',
    ];

    const rows = entries.map((e) => [
      e.timestamp.toString(),
      e.userId,
      e.action,
      e.resourceType,
      e.resourceId,
      e.workspaceId,
      e.success.toString(),
      e.error || '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Get audit statistics
   */
  async getStats(workspaceId: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    byAction: Record<string, number>;
    byUser: Record<string, number>;
  }> {
    const entries = await this.query({ workspaceId });

    const byAction: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    let successful = 0;
    let failed = 0;

    for (const entry of entries) {
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
      byUser[entry.userId] = (byUser[entry.userId] || 0) + 1;

      if (entry.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      total: entries.length,
      successful,
      failed,
      byAction,
      byUser,
    };
  }

  /**
   * Get recent activity for a workspace
   */
  async getRecentActivity(
    workspaceId: string,
    limit = 50,
  ): Promise<AuditEntry[]> {
    return this.query({ workspaceId, limit });
  }

  /**
   * Search audit entries by content
   */
  async search(query: string, workspaceId?: string): Promise<AuditEntry[]> {
    const allEntries = workspaceId
      ? await this.query({ workspaceId })
      : Array.from(this.storage.entries.values());

    const lowerQuery = query.toLowerCase();

    return allEntries.filter(
      (e) =>
        e.action.toLowerCase().includes(lowerQuery) ||
        e.resourceId.toLowerCase().includes(lowerQuery) ||
        (e.error && e.error.toLowerCase().includes(lowerQuery)) ||
        (e.metadata &&
          JSON.stringify(e.metadata).toLowerCase().includes(lowerQuery)),
    );
  }

  /**
   * Delete old audit entries
   */
  async deleteBefore(timestamp: number): Promise<number> {
    let deleted = 0;

    for (const [id, entry] of this.storage.entries.entries()) {
      if (entry.timestamp < timestamp) {
        this.deleteEntry(id);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Delete an entry
   */
  private deleteEntry(id: string): void {
    const entry = this.storage.entries.get(id);
    if (!entry) return;

    this.storage.entries.delete(id);
    this.removeFromIndex(this.storage.byWorkspace, entry.workspaceId, id);
    this.removeFromIndex(this.storage.byUser, entry.userId, id);
    this.removeFromIndex(
      this.storage.byResource,
      `${entry.resourceType}:${entry.resourceId}`,
      id,
    );
  }

  /**
   * Prune old entries to prevent memory issues
   */
  private pruneOldEntries(): void {
    const entries = Array.from(this.storage.entries.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 10% of entries
    const toRemove = Math.floor(this.maxEntries * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.deleteEntry(entries[i][0]);
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add to index
   */
  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string,
  ): void {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(value);
  }

  /**
   * Remove from index
   */
  private removeFromIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string,
  ): void {
    const set = index.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.storage.entries.clear();
    this.storage.byWorkspace.clear();
    this.storage.byUser.clear();
    this.storage.byResource.clear();
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.entries.size;
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();
