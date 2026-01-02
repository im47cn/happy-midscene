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
      const templates = await manager.list();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.category === 'system')).toBe(true);
    });

    it('should only initialize once', async () => {
      await manager.init();
      const count1 = (await manager.list()).length;

      await manager.init();
      const count2 = (await manager.list()).length;

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
        fields: [
          { fieldId: 'email', fieldName: '邮箱', generationType: 'random', generatorId: 'email' },
        ],
        variables: {},
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.category).toBe('user');
      expect(template.usageCount).toBe(0);
      expect(template.createdAt).toBeDefined();
    });
  });

  describe('getByCategory', () => {
    it('should filter templates by category', async () => {
      await manager.init();

      await manager.create({
        name: 'User Template',
        description: 'User description',
        category: 'user',
        fields: [],
        variables: {},
      });

      const userTemplates = await manager.getByCategory('user');
      const systemTemplates = await manager.getByCategory('system');

      expect(userTemplates.every(t => t.category === 'user')).toBe(true);
      expect(systemTemplates.every(t => t.category === 'system')).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a user template', async () => {
      await manager.init();

      const template = await manager.create({
        name: 'Original Name',
        description: 'Description',
        category: 'user',
        fields: [],
        variables: {},
      });

      const updated = await manager.update(template.id, {
        name: 'Updated Name',
      });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(template.createdAt);
    });

    it('should not update system templates', async () => {
      await manager.init();

      const systemTemplates = await manager.getByCategory('system');
      if (systemTemplates.length > 0) {
        await expect(
          manager.update(systemTemplates[0].id, { name: 'Modified' })
        ).rejects.toThrow('Cannot modify system templates');
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
        fields: [],
        variables: {},
      });

      const deleted = await manager.delete(template.id);
      expect(deleted).toBe(true);

      const found = await manager.get(template.id);
      expect(found).toBeNull();
    });

    it('should not delete system templates', async () => {
      await manager.init();

      const systemTemplates = await manager.getByCategory('system');
      if (systemTemplates.length > 0) {
        await expect(manager.delete(systemTemplates[0].id)).rejects.toThrow(
          'Cannot delete system templates'
        );
      }
    });
  });

  describe('applyTemplate', () => {
    it('should generate data from template', async () => {
      await manager.init();

      const template = await manager.create({
        name: 'Test Template',
        description: 'Description',
        category: 'user',
        fields: [
          { fieldId: 'phone', fieldName: '手机号', generationType: 'random', generatorId: 'mobile_phone' },
          { fieldId: 'password', fieldName: '密码', generationType: 'fixed', fixedValue: 'Test@123' },
          { fieldId: 'username', fieldName: '用户名', generationType: 'variable', variableName: 'testUser' },
        ],
        variables: { testUser: 'defaultUser' },
      });

      const data = await manager.applyTemplate(template.id);

      expect(data.phone).toMatch(/^1[3-9]\d{9}$/);
      expect(data.password).toBe('Test@123');
      expect(data.username).toBe('defaultUser');
    });

    it('should override variables', async () => {
      await manager.init();

      const template = await manager.create({
        name: 'Variable Template',
        description: 'Description',
        category: 'user',
        fields: [
          { fieldId: 'name', fieldName: '名称', generationType: 'variable', variableName: 'userName' },
        ],
        variables: { userName: 'default' },
      });

      const data = await manager.applyTemplate(template.id, { userName: 'override' });

      expect(data.name).toBe('override');
    });

    it('should increment usage count', async () => {
      await manager.init();

      const template = await manager.create({
        name: 'Usage Template',
        description: 'Description',
        category: 'user',
        fields: [],
        variables: {},
      });

      await manager.applyTemplate(template.id);
      await manager.applyTemplate(template.id);

      const updated = await manager.get(template.id);
      expect(updated?.usageCount).toBe(2);
    });
  });

  describe('getPopular', () => {
    it('should return templates sorted by usage', async () => {
      await manager.init();

      const t1 = await manager.create({
        name: 'Popular',
        description: 'Most used',
        category: 'user',
        fields: [],
        variables: {},
      });

      const t2 = await manager.create({
        name: 'Less Popular',
        description: 'Less used',
        category: 'user',
        fields: [],
        variables: {},
      });

      // Use t1 more times
      await manager.applyTemplate(t1.id);
      await manager.applyTemplate(t1.id);
      await manager.applyTemplate(t1.id);
      await manager.applyTemplate(t2.id);

      const popular = await manager.getPopular(10);
      const t1Index = popular.findIndex(t => t.id === t1.id);
      const t2Index = popular.findIndex(t => t.id === t2.id);

      expect(t1Index).toBeLessThan(t2Index);
    });
  });

  describe('exportTemplates and importTemplates', () => {
    it('should export and import templates', async () => {
      await manager.init();

      await manager.create({
        name: 'Export Test',
        description: 'For export',
        category: 'user',
        fields: [],
        variables: {},
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

      await expect(manager.importTemplates('invalid json')).rejects.toThrow(
        'Invalid template JSON format'
      );
    });
  });

  describe('clearUserTemplates', () => {
    it('should clear all user templates', async () => {
      await manager.init();

      await manager.create({
        name: 'User 1',
        description: 'User template',
        category: 'user',
        fields: [],
        variables: {},
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
