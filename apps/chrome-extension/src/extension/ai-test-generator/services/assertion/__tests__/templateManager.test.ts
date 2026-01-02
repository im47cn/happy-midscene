/**
 * Template Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateManager } from '../templateManager';

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

describe('TemplateManager', () => {
  let manager: TemplateManager;

  beforeEach(() => {
    localStorageMock.clear();
    manager = new TemplateManager();
  });

  describe('init', () => {
    it('should initialize with system templates', async () => {
      await manager.init();
      const templates = await manager.getAll();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.category === 'system')).toBe(true);
    });

    it('should only initialize once', async () => {
      await manager.init();
      const count1 = (await manager.getAll()).length;

      await manager.init();
      const count2 = (await manager.getAll()).length;

      expect(count1).toBe(count2);
    });
  });

  describe('create', () => {
    it('should create a new template', async () => {
      await manager.init();

      const template = await manager.create({
        name: 'Test Template',
        description: 'Test description',
        category: 'user',
        trigger: { intentPattern: 'test' },
        assertion: {
          type: 'text_contains',
          parameters: { target: 'test' },
        },
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.category).toBe('user');
      expect(template.usageCount).toBe(0);
    });
  });

  describe('getByCategory', () => {
    it('should filter by category', async () => {
      await manager.init();

      await manager.create({
        name: 'User Template',
        description: 'User description',
        category: 'user',
        trigger: {},
        assertion: { type: 'text_contains', parameters: {} },
      });

      const userTemplates = await manager.getByCategory('user');
      const systemTemplates = await manager.getByCategory('system');

      expect(userTemplates.every(t => t.category === 'user')).toBe(true);
      expect(systemTemplates.every(t => t.category === 'system')).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a template', async () => {
      await manager.init();

      const template = await manager.create({
        name: 'Original Name',
        description: 'Description',
        category: 'user',
        trigger: {},
        assertion: { type: 'text_contains', parameters: {} },
      });

      const updated = await manager.update(template.id, {
        name: 'Updated Name',
      });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.updatedAt).toBeDefined();
    });

    it('should not update system templates', async () => {
      await manager.init();

      const systemTemplates = await manager.getByCategory('system');
      if (systemTemplates.length > 0) {
        await expect(
          manager.update(systemTemplates[0].id, { name: 'Modified' })
        ).rejects.toThrow();
      }
    });
  });

  describe('delete', () => {
    it('should delete a user template', async () => {
      await manager.init();

      const template = await manager.create({
        name: 'To Delete',
        description: 'Description',
        category: 'user',
        trigger: {},
        assertion: { type: 'text_contains', parameters: {} },
      });

      const deleted = await manager.delete(template.id);
      expect(deleted).toBe(true);

      const found = await manager.getById(template.id);
      expect(found).toBeNull();
    });

    it('should not delete system templates', async () => {
      await manager.init();

      const systemTemplates = await manager.getByCategory('system');
      if (systemTemplates.length > 0) {
        await expect(manager.delete(systemTemplates[0].id)).rejects.toThrow();
      }
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count', async () => {
      await manager.init();

      const template = await manager.create({
        name: 'Template',
        description: 'Description',
        category: 'user',
        trigger: {},
        assertion: { type: 'text_contains', parameters: {} },
      });

      await manager.incrementUsage(template.id);
      await manager.incrementUsage(template.id);

      const updated = await manager.getById(template.id);
      expect(updated?.usageCount).toBe(2);
    });
  });

  describe('findMatching', () => {
    it('should find templates by intent', async () => {
      await manager.init();

      await manager.create({
        name: 'Login Template',
        description: 'Login check',
        category: 'user',
        trigger: { intentPattern: 'login' },
        assertion: { type: 'text_contains', parameters: {} },
      });

      const matches = await manager.findMatching('login');
      expect(matches.some(t => t.name === 'Login Template')).toBe(true);
    });

    it('should find templates by action type', async () => {
      await manager.init();

      await manager.create({
        name: 'Click Template',
        description: 'Click check',
        category: 'user',
        trigger: { actionType: 'click' },
        assertion: { type: 'element_visible', parameters: {} },
      });

      const matches = await manager.findMatching('generic', 'click');
      expect(matches.some(t => t.name === 'Click Template')).toBe(true);
    });
  });

  describe('exportTemplates and importTemplates', () => {
    it('should export and import templates', async () => {
      await manager.init();

      await manager.create({
        name: 'Export Test',
        description: 'For export',
        category: 'user',
        trigger: {},
        assertion: { type: 'text_contains', parameters: {} },
      });

      const exported = await manager.exportTemplates('user');

      // Create new manager and import
      localStorageMock.clear();
      const newManager = new TemplateManager();
      await newManager.init();

      const imported = await newManager.importTemplates(exported);
      expect(imported).toBeGreaterThan(0);

      const templates = await newManager.getByCategory('user');
      expect(templates.some(t => t.name === 'Export Test')).toBe(true);
    });

    it('should reject invalid JSON', async () => {
      await manager.init();

      await expect(manager.importTemplates('invalid json')).rejects.toThrow();
    });
  });

  describe('getPopular', () => {
    it('should return templates sorted by usage', async () => {
      await manager.init();

      const t1 = await manager.create({
        name: 'Popular',
        description: 'Most used',
        category: 'user',
        trigger: {},
        assertion: { type: 'text_contains', parameters: {} },
      });

      const t2 = await manager.create({
        name: 'Less Popular',
        description: 'Less used',
        category: 'user',
        trigger: {},
        assertion: { type: 'text_contains', parameters: {} },
      });

      await manager.incrementUsage(t1.id);
      await manager.incrementUsage(t1.id);
      await manager.incrementUsage(t1.id);
      await manager.incrementUsage(t2.id);

      const popular = await manager.getPopular(10);

      expect(popular[0].id).toBe(t1.id);
    });
  });

  describe('clearUserTemplates', () => {
    it('should clear all user templates', async () => {
      await manager.init();

      await manager.create({
        name: 'User 1',
        description: 'User template',
        category: 'user',
        trigger: {},
        assertion: { type: 'text_contains', parameters: {} },
      });

      await manager.clearUserTemplates();

      const userTemplates = await manager.getByCategory('user');
      expect(userTemplates.length).toBe(0);

      // System templates should remain
      const systemTemplates = await manager.getByCategory('system');
      expect(systemTemplates.length).toBeGreaterThan(0);
    });
  });
});
