/**
 * Whitelist Manager Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create fresh localStorage mock for each test
function createLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
  };
}

describe('WhitelistManager', () => {
  let WhitelistManager: typeof import('../whitelistManager').WhitelistManager;
  let manager: import('../whitelistManager').WhitelistManager;
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(async () => {
    // Reset modules to get fresh instances
    vi.resetModules();

    // Create fresh localStorage for each test
    localStorageMock = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);

    // Import fresh module
    const module = await import('../whitelistManager');
    WhitelistManager = module.WhitelistManager;
    manager = new WhitelistManager();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('addEntry', () => {
    it('should add an exact match entry', () => {
      const entry = manager.addEntry({
        type: 'exact',
        value: 'test-value',
        description: 'Test entry',
        enabled: true,
      });

      expect(entry.id).toMatch(/^wl_/);
      expect(entry.type).toBe('exact');
      expect(entry.value).toBe('test-value');
      expect(entry.enabled).toBe(true);
    });

    it('should add a pattern entry', () => {
      const entry = manager.addEntry({
        type: 'pattern',
        value: 'test-.*-pattern',
        enabled: true,
      });

      expect(entry.type).toBe('pattern');
      expect(entry.value).toBe('test-.*-pattern');
    });

    it('should add a domain entry', () => {
      const entry = manager.addEntry({
        type: 'domain',
        value: 'example.com',
        enabled: true,
      });

      expect(entry.type).toBe('domain');
      expect(entry.value).toBe('example.com');
    });

    it('should add a path entry', () => {
      const entry = manager.addEntry({
        type: 'path',
        value: '/api/v1',
        enabled: true,
      });

      expect(entry.type).toBe('path');
      expect(entry.value).toBe('/api/v1');
    });

    it('should set timestamps correctly', () => {
      const before = Date.now();
      const entry = manager.addEntry({
        type: 'exact',
        value: 'test',
        enabled: true,
      });
      const after = Date.now();

      expect(entry.createdAt).toBeGreaterThanOrEqual(before);
      expect(entry.createdAt).toBeLessThanOrEqual(after);
      expect(entry.updatedAt).toBe(entry.createdAt);
    });
  });

  describe('getEntries', () => {
    it('should return all entries', () => {
      manager.addEntry({ type: 'exact', value: 'value1', enabled: true });
      manager.addEntry({ type: 'pattern', value: 'pattern1', enabled: true });

      const entries = manager.getEntries();
      expect(entries).toHaveLength(2);
    });

    it('should return empty array when no entries', () => {
      const entries = manager.getEntries();
      expect(entries).toHaveLength(0);
    });
  });

  describe('getEntry', () => {
    it('should return entry by ID', () => {
      const added = manager.addEntry({ type: 'exact', value: 'test', enabled: true });

      const found = manager.getEntry(added.id);
      expect(found).toBeDefined();
      expect(found?.value).toBe('test');
    });

    it('should return undefined for non-existent ID', () => {
      const found = manager.getEntry('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('updateEntry', () => {
    it('should update entry value', () => {
      const entry = manager.addEntry({ type: 'exact', value: 'old', enabled: true });

      const result = manager.updateEntry(entry.id, { value: 'new' });
      expect(result).toBe(true);

      const updated = manager.getEntry(entry.id);
      expect(updated?.value).toBe('new');
    });

    it('should update enabled state', () => {
      const entry = manager.addEntry({ type: 'exact', value: 'test', enabled: true });

      manager.updateEntry(entry.id, { enabled: false });

      const updated = manager.getEntry(entry.id);
      expect(updated?.enabled).toBe(false);
    });

    it('should update timestamp on update', async () => {
      const entry = manager.addEntry({ type: 'exact', value: 'test', enabled: true });
      const originalUpdatedAt = entry.updatedAt;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      manager.updateEntry(entry.id, { value: 'updated' });

      const updated = manager.getEntry(entry.id);
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it('should return false for non-existent ID', () => {
      const result = manager.updateEntry('non-existent', { value: 'test' });
      expect(result).toBe(false);
    });
  });

  describe('removeEntry', () => {
    it('should remove entry by ID', () => {
      const entry = manager.addEntry({ type: 'exact', value: 'test', enabled: true });

      const result = manager.removeEntry(entry.id);
      expect(result).toBe(true);
      expect(manager.getEntries()).toHaveLength(0);
    });

    it('should return false for non-existent ID', () => {
      const result = manager.removeEntry('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('isWhitelisted', () => {
    it('should match exact values', () => {
      manager.addEntry({ type: 'exact', value: 'secret123', enabled: true });

      expect(manager.isWhitelisted('secret123')).toBe(true);
      expect(manager.isWhitelisted('secret124')).toBe(false);
    });

    it('should match pattern values', () => {
      manager.addEntry({ type: 'pattern', value: 'test-\\d+-pattern', enabled: true });

      expect(manager.isWhitelisted('test-123-pattern')).toBe(true);
      expect(manager.isWhitelisted('test-abc-pattern')).toBe(false);
    });

    it('should match domain values', () => {
      manager.addEntry({ type: 'domain', value: 'example.com', enabled: true });

      expect(manager.isWhitelisted('anything', { url: 'https://example.com/path' })).toBe(true);
      expect(manager.isWhitelisted('anything', { url: 'https://sub.example.com/path' })).toBe(true);
      expect(manager.isWhitelisted('anything', { url: 'https://other.com/path' })).toBe(false);
    });

    it('should match path prefix values', () => {
      manager.addEntry({ type: 'path', value: '/api/v1', enabled: true });

      expect(manager.isWhitelisted('anything', { path: '/api/v1/users' })).toBe(true);
      expect(manager.isWhitelisted('anything', { path: '/api/v2/users' })).toBe(false);
    });

    it('should not match disabled entries', () => {
      manager.addEntry({ type: 'exact', value: 'secret', enabled: false });

      expect(manager.isWhitelisted('secret')).toBe(false);
    });

    it('should not match when whitelist is disabled', () => {
      manager.addEntry({ type: 'exact', value: 'secret', enabled: true });
      manager.disable();

      expect(manager.isWhitelisted('secret')).toBe(false);
    });
  });

  describe('enable/disable', () => {
    it('should enable whitelist', () => {
      manager.disable();
      expect(manager.isEnabled()).toBe(false);

      manager.enable();
      expect(manager.isEnabled()).toBe(true);
    });

    it('should disable whitelist', () => {
      manager.disable();
      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe('enableEntry/disableEntry', () => {
    it('should enable specific entry', () => {
      const entry = manager.addEntry({ type: 'exact', value: 'test', enabled: false });

      manager.enableEntry(entry.id);

      const updated = manager.getEntry(entry.id);
      expect(updated?.enabled).toBe(true);
    });

    it('should disable specific entry', () => {
      const entry = manager.addEntry({ type: 'exact', value: 'test', enabled: true });

      manager.disableEntry(entry.id);

      const updated = manager.getEntry(entry.id);
      expect(updated?.enabled).toBe(false);
    });
  });

  describe('exportToJSON/importFromJSON', () => {
    it('should export entries to JSON', () => {
      manager.addEntry({ type: 'exact', value: 'test1', enabled: true });
      manager.addEntry({ type: 'pattern', value: 'test2', enabled: false });

      const json = manager.exportToJSON();
      const parsed = JSON.parse(json);

      expect(parsed.entries).toHaveLength(2);
      expect(parsed.enabled).toBe(true);
    });

    it('should import entries from JSON', () => {
      const json = JSON.stringify({
        entries: [
          { type: 'exact', value: 'imported1', enabled: true },
          { type: 'pattern', value: 'imported2', enabled: true },
        ],
        enabled: true,
      });

      const result = manager.importFromJSON(json);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(manager.getEntries()).toHaveLength(2);
    });

    it('should skip duplicate entries on import', () => {
      manager.addEntry({ type: 'exact', value: 'existing', enabled: true });

      const json = JSON.stringify({
        entries: [
          { type: 'exact', value: 'existing', enabled: true },
          { type: 'exact', value: 'new', enabled: true },
        ],
      });

      const result = manager.importFromJSON(json);

      expect(result.count).toBe(1); // Only new entry
      expect(manager.getEntries()).toHaveLength(2);
    });

    it('should handle invalid JSON on import', () => {
      const result = manager.importFromJSON('invalid json');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing entries array on import', () => {
      const result = manager.importFromJSON('{}');

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing entries');
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      manager.addEntry({ type: 'exact', value: 'test1', enabled: true });
      manager.addEntry({ type: 'exact', value: 'test2', enabled: true });

      manager.clear();

      expect(manager.getEntries()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      manager.addEntry({ type: 'exact', value: 'test1', enabled: true });
      manager.addEntry({ type: 'exact', value: 'test2', enabled: false });
      manager.addEntry({ type: 'pattern', value: 'test3', enabled: true });
      manager.addEntry({ type: 'domain', value: 'test4', enabled: true });

      const stats = manager.getStats();

      expect(stats.total).toBe(4);
      expect(stats.enabled).toBe(3);
      expect(stats.byType.exact).toBe(2);
      expect(stats.byType.pattern).toBe(1);
      expect(stats.byType.domain).toBe(1);
      expect(stats.byType.path).toBe(0);
    });
  });
});
