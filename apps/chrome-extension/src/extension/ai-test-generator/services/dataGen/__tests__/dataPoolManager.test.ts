/**
 * Data Pool Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataPoolManager } from '../dataPoolManager';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

describe('DataPoolManager', () => {
  let manager: DataPoolManager;

  beforeEach(() => {
    localStorageMock.clear();
    manager = new DataPoolManager();
  });

  describe('init', () => {
    it('should initialize with built-in pools', async () => {
      await manager.init();
      const pools = await manager.listPools();

      expect(pools.length).toBeGreaterThan(0);
      expect(pools.some(p => p.id === 'cn_provinces')).toBe(true);
      expect(pools.some(p => p.id === 'cn_cities')).toBe(true);
      expect(pools.some(p => p.id === 'cn_surnames')).toBe(true);
    });
  });

  describe('getPool', () => {
    it('should get pool by id', async () => {
      await manager.init();

      const pool = await manager.getPool('cn_provinces');
      expect(pool).not.toBeNull();
      expect(pool?.name).toBe('中国省份');
      expect(pool?.values.length).toBe(31);
    });

    it('should return null for non-existent pool', async () => {
      await manager.init();

      const pool = await manager.getPool('non_existent');
      expect(pool).toBeNull();
    });
  });

  describe('pick', () => {
    it('should pick a value from pool', async () => {
      await manager.init();

      const value = await manager.pick('cn_provinces');
      expect(value).toBeDefined();
    });

    it('should return null for non-existent pool', async () => {
      await manager.init();

      const value = await manager.pick('non_existent');
      expect(value).toBeNull();
    });

    it('should pick sequentially when strategy is sequential', async () => {
      await manager.init();

      await manager.addPool({
        name: 'Sequential Pool',
        description: 'Test sequential picking',
        category: 'user',
        pickStrategy: 'sequential',
        values: ['A', 'B', 'C'],
      });

      const pools = await manager.listByCategory('user');
      const pool = pools.find(p => p.name === 'Sequential Pool');

      if (pool) {
        const v1 = await manager.pick(pool.id);
        const v2 = await manager.pick(pool.id);
        const v3 = await manager.pick(pool.id);
        const v4 = await manager.pick(pool.id); // Should wrap to A

        expect(v1).toBe('A');
        expect(v2).toBe('B');
        expect(v3).toBe('C');
        expect(v4).toBe('A');
      }
    });
  });

  describe('pickMultiple', () => {
    it('should pick multiple unique values', async () => {
      await manager.init();

      const values = await manager.pickMultiple('cn_cities', 5);
      expect(values.length).toBe(5);

      // Should be unique
      const unique = new Set(values);
      expect(unique.size).toBe(5);
    });

    it('should not exceed pool size', async () => {
      await manager.init();

      await manager.addPool({
        name: 'Small Pool',
        description: 'Only 3 values',
        category: 'user',
        pickStrategy: 'random',
        values: ['A', 'B', 'C'],
      });

      const pools = await manager.listByCategory('user');
      const pool = pools.find(p => p.name === 'Small Pool');

      if (pool) {
        const values = await manager.pickMultiple(pool.id, 10);
        expect(values.length).toBe(3);
      }
    });
  });

  describe('addPool', () => {
    it('should add a new pool', async () => {
      await manager.init();

      const pool = await manager.addPool({
        name: 'Custom Pool',
        description: 'Custom description',
        category: 'user',
        pickStrategy: 'random',
        values: ['X', 'Y', 'Z'],
      });

      expect(pool.id).toBeDefined();
      expect(pool.name).toBe('Custom Pool');

      const retrieved = await manager.getPool(pool.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.values).toEqual(['X', 'Y', 'Z']);
    });
  });

  describe('updatePool', () => {
    it('should update a user pool', async () => {
      await manager.init();

      const pool = await manager.addPool({
        name: 'Original',
        description: 'Original description',
        category: 'user',
        pickStrategy: 'random',
        values: ['A'],
      });

      const updated = await manager.updatePool(pool.id, {
        name: 'Updated',
        values: ['A', 'B', 'C'],
      });

      expect(updated?.name).toBe('Updated');
      expect(updated?.values).toEqual(['A', 'B', 'C']);
    });

    it('should not update system pools', async () => {
      await manager.init();

      await expect(
        manager.updatePool('cn_provinces', { name: 'Modified' })
      ).rejects.toThrow('Cannot modify system pools');
    });
  });

  describe('deletePool', () => {
    it('should delete a user pool', async () => {
      await manager.init();

      const pool = await manager.addPool({
        name: 'To Delete',
        description: 'Will be deleted',
        category: 'user',
        pickStrategy: 'random',
        values: [],
      });

      const deleted = await manager.deletePool(pool.id);
      expect(deleted).toBe(true);

      const retrieved = await manager.getPool(pool.id);
      expect(retrieved).toBeNull();
    });

    it('should not delete system pools', async () => {
      await manager.init();

      await expect(manager.deletePool('cn_provinces')).rejects.toThrow(
        'Cannot delete system pools'
      );
    });
  });

  describe('listByCategory', () => {
    it('should filter pools by category', async () => {
      await manager.init();

      await manager.addPool({
        name: 'User Pool',
        description: 'User category',
        category: 'user',
        pickStrategy: 'random',
        values: [],
      });

      const userPools = await manager.listByCategory('user');
      const systemPools = await manager.listByCategory('system');

      expect(userPools.every(p => p.category === 'user')).toBe(true);
      expect(systemPools.every(p => p.category === 'system')).toBe(true);
    });
  });

  describe('searchPools', () => {
    it('should search pools by name or description', async () => {
      await manager.init();

      const results = await manager.searchPools('省份');
      expect(results.some(p => p.id === 'cn_provinces')).toBe(true);

      const cityResults = await manager.searchPools('城市');
      expect(cityResults.some(p => p.id === 'cn_cities')).toBe(true);
    });
  });

  describe('addValues and removeValue', () => {
    it('should add values to a pool', async () => {
      await manager.init();

      const pool = await manager.addPool({
        name: 'Extendable',
        description: 'Can add values',
        category: 'user',
        pickStrategy: 'random',
        values: ['A'],
      });

      await manager.addValues(pool.id, ['B', 'C']);

      const updated = await manager.getPool(pool.id);
      expect(updated?.values).toEqual(['A', 'B', 'C']);
    });

    it('should remove value from a pool', async () => {
      await manager.init();

      const pool = await manager.addPool({
        name: 'Shrinkable',
        description: 'Can remove values',
        category: 'user',
        pickStrategy: 'random',
        values: ['A', 'B', 'C'],
      });

      await manager.removeValue(pool.id, 'B');

      const updated = await manager.getPool(pool.id);
      expect(updated?.values).toEqual(['A', 'C']);
    });
  });

  describe('resetPoolIndex', () => {
    it('should reset sequential index', async () => {
      await manager.init();

      const pool = await manager.addPool({
        name: 'Reset Test',
        description: 'Test reset',
        category: 'user',
        pickStrategy: 'sequential',
        values: ['A', 'B', 'C'],
      });

      await manager.pick(pool.id); // A
      await manager.pick(pool.id); // B

      manager.resetPoolIndex(pool.id);

      const value = await manager.pick(pool.id);
      expect(value).toBe('A'); // Reset to start
    });
  });

  describe('exportPools and importPools', () => {
    it('should export and import pools', async () => {
      await manager.init();

      await manager.addPool({
        name: 'Export Test',
        description: 'For export',
        category: 'user',
        pickStrategy: 'random',
        values: ['X', 'Y'],
      });

      const exported = await manager.exportPools('user');

      // Create new manager and import
      localStorageMock.clear();
      const newManager = new DataPoolManager();
      await newManager.init();

      const imported = await newManager.importPools(exported);
      expect(imported).toBe(1);

      const pools = await newManager.listByCategory('user');
      expect(pools.some(p => p.name === 'Export Test')).toBe(true);
    });

    it('should reject invalid JSON', async () => {
      await manager.init();

      await expect(manager.importPools('invalid json')).rejects.toThrow(
        'Invalid pool JSON format'
      );
    });
  });

  describe('clearUserPools', () => {
    it('should clear all user pools', async () => {
      await manager.init();

      await manager.addPool({
        name: 'User Pool 1',
        description: 'Will be cleared',
        category: 'user',
        pickStrategy: 'random',
        values: [],
      });

      await manager.clearUserPools();

      const userPools = await manager.listByCategory('user');
      expect(userPools.length).toBe(0);

      // System pools should remain
      const systemPools = await manager.listByCategory('system');
      expect(systemPools.length).toBeGreaterThan(0);
    });
  });
});
