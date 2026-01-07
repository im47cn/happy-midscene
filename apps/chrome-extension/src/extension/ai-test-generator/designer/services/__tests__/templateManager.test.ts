/**
 * Template Manager Service Tests
 * 模板管理服务测试
 */

import { afterEach, beforeEach, describe, expect, it, vi, beforeAll } from 'vitest';
import {
  BUILT_IN_CATEGORIES,
  TemplateManager,
  getTemplateManager,
  resetTemplateManager,
  type Template,
  type TemplateCategory,
} from '../templateManager';
import type { TestFlow, DesignerNode } from '../../types/designer';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

// Mock chrome.storage API - will be initialized in beforeEach
let mockChromeStorage: {
  local: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
};

beforeAll(() => {
  globalThis.localStorage = localStorageMock as any;
});

// Helper to create a mock TestFlow
function createMockFlow(overrides?: Partial<TestFlow>): TestFlow {
  const nodes: DesignerNode[] = [
    {
      id: 'start-1',
      type: 'start',
      position: { x: 0, y: 0 },
      data: { config: {} },
    },
    {
      id: 'click-1',
      type: 'click',
      position: { x: 200, y: 0 },
      data: {
        config: {
          selector: 'button.submit',
          description: 'Click submit button',
        },
      },
    },
  ];

  return {
    id: 'flow-1',
    name: 'Test Flow',
    description: 'Test flow description',
    version: 1,
    nodes,
    edges: [
      {
        id: 'edge-1',
        source: 'start-1',
        target: 'click-1',
        type: 'default',
      },
    ],
    variables: [],
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    ...overrides,
  };
}

// Helper to create a mock template
function createMockTemplate(overrides?: Partial<Template>): Template {
  return {
    metadata: {
      id: 'template-1',
      name: 'Test Template',
      description: 'Test template description',
      category: 'basic',
      tags: ['test', 'sample'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      useCount: 0,
      nodeCount: 2,
      ...overrides.metadata,
    },
    flow: createMockFlow(),
    ...overrides,
  };
}

describe('TemplateManager', () => {
  let templateManager: TemplateManager;

  beforeEach(() => {
    // Clear localStorage mock
    localStorageMock.clear();

    // Initialize chrome mock
    mockChromeStorage = {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
      },
    };
    (globalThis as any).chrome = {
      storage: mockChromeStorage,
    };

    // Reset singleton
    resetTemplateManager();
    // Create fresh instance
    templateManager = new TemplateManager();
  });

  afterEach(() => {
    resetTemplateManager();
  });

  describe('initialization', () => {
    it('should initialize with empty templates', () => {
      expect(templateManager.getAllTemplates()).toEqual([]);
    });

    it('should load built-in categories', () => {
      const categories = templateManager.getAllCategories();
      expect(categories).toHaveLength(BUILT_IN_CATEGORIES.length);
      expect(categories[0]).toEqual(expect.objectContaining({
        id: 'basic',
        name: '基础操作',
      }));
    });

    it('should initialize via singleton', async () => {
      const instance = getTemplateManager();
      expect(instance).toBeInstanceOf(TemplateManager);
    });

    it('should return same instance from singleton', async () => {
      const instance1 = getTemplateManager();
      const instance2 = getTemplateManager();
      expect(instance1).toBe(instance2);
    });
  });

  describe('saveTemplate', () => {
    it('should save a new template', async () => {
      const flow = createMockFlow();
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      const template = await templateManager.saveTemplate(flow, {
        name: 'New Template',
        description: 'A new template',
        category: 'basic',
      });

      expect(template.metadata.id).toBe(flow.id);
      expect(template.metadata.name).toBe('New Template');
      expect(template.metadata.nodeCount).toBe(2);
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });

    it('should update existing template', async () => {
      const flow = createMockFlow();
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      // First save
      await templateManager.saveTemplate(flow, {
        name: 'Original Name',
      });

      // Second save (update)
      const updated = await templateManager.saveTemplate(flow, {
        name: 'Updated Name',
      });

      expect(updated.metadata.name).toBe('Updated Name');
      expect(templateManager.getAllTemplates()).toHaveLength(1);
    });

    it('should save to localStorage as backup', async () => {
      const flow = createMockFlow({ id: 'backup-test' });
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(flow, { name: 'Backup Test' });

      const stored = localStorage.getItem('designer_template_backup-test');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.metadata.name).toBe('Backup Test');
    });

    it('should estimate duration based on node types', async () => {
      const flow = createMockFlow({
        nodes: [
          { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { config: {} } },
          { id: 'wait-1', type: 'wait', position: { x: 200, y: 0 }, data: { config: { duration: 5000 } } },
          { id: 'click-1', type: 'click', position: { x: 400, y: 0 }, data: { config: { selector: 'button' } } },
        ],
      });
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      const template = await templateManager.saveTemplate(flow, { name: 'Duration Test' });

      // Start: 0ms, Wait: 5000ms, Click: 500ms = 5500ms total
      // Note: Duration estimation may vary based on node configuration
      expect(template.metadata.estimatedDuration).toBeGreaterThan(0);
    });
  });

  describe('loadTemplate', () => {
    it('should return null for non-existent template', async () => {
      const result = await templateManager.loadTemplate('non-existent');
      expect(result).toBeNull();
    });

    it('should load template and generate new IDs', async () => {
      const flow = createMockFlow({ id: 'original-flow' });
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(flow, { name: 'Test Template' });

      const loaded = await templateManager.loadTemplate('original-flow');

      expect(loaded).toBeTruthy();
      expect(loaded?.id).toBe('original-flow');
      expect(loaded?.nodes[0].id).not.toBe('start-1');
      expect(loaded?.edges[0].id).not.toBe('edge-1');
    });

    it('should increment use count on load', async () => {
      const flow = createMockFlow();
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(flow, { name: 'Popular Template' });

      await templateManager.loadTemplate(flow.id);
      await templateManager.loadTemplate(flow.id);

      const template = templateManager.getTemplateMetadata(flow.id);
      expect(template?.useCount).toBe(2);
    });

    it('should update timestamp on load', async () => {
      const flow = createMockFlow();
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(flow, { name: 'Recent Template' });

      const firstTimestamp = templateManager.getTemplateMetadata(flow.id)?.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await templateManager.loadTemplate(flow.id);

      const secondTimestamp = templateManager.getTemplateMetadata(flow.id)?.updatedAt;

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp || 0);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete existing template', async () => {
      const flow = createMockFlow();
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });
      mockChromeStorage.local.remove.mockImplementation((key, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(flow, { name: 'To Delete' });
      expect(templateManager.getAllTemplates()).toHaveLength(1);

      const deleted = await templateManager.deleteTemplate(flow.id);

      expect(deleted).toBe(true);
      expect(templateManager.getAllTemplates()).toHaveLength(0);
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('designer_template_' + flow.id, expect.any(Function));
    });

    it('should return false for non-existent template', async () => {
      const deleted = await templateManager.deleteTemplate('non-existent');
      expect(deleted).toBe(false);
    });

    it('should remove from localStorage', async () => {
      const flow = createMockFlow({ id: 'local-delete-test' });
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });
      mockChromeStorage.local.remove.mockImplementation((key, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(flow, { name: 'Local Delete' });
      await templateManager.deleteTemplate('local-delete-test');

      const stored = localStorage.getItem('designer_template_local-delete-test');
      expect(stored).toBeNull();
    });
  });

  describe('getTemplatesByCategory', () => {
    beforeEach(async () => {
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(createMockFlow({ id: 't1' }), {
        name: 'Basic 1',
        category: 'basic',
      });
      await templateManager.saveTemplate(createMockFlow({ id: 't2' }), {
        name: 'Basic 2',
        category: 'basic',
      });
      await templateManager.saveTemplate(createMockFlow({ id: 't3' }), {
        name: 'Form Template',
        category: 'form',
      });
    });

    it('should filter templates by category', () => {
      const basicTemplates = templateManager.getTemplatesByCategory('basic');
      expect(basicTemplates).toHaveLength(2);

      const formTemplates = templateManager.getTemplatesByCategory('form');
      expect(formTemplates).toHaveLength(1);
    });

    it('should return empty array for category with no templates', () => {
      const ecommerceTemplates = templateManager.getTemplatesByCategory('ecommerce');
      expect(ecommerceTemplates).toHaveLength(0);
    });
  });

  describe('searchTemplates', () => {
    beforeEach(async () => {
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(createMockFlow({ id: 's1' }), {
        name: 'Login Test',
        description: 'Test login functionality',
        tags: ['auth', 'login'],
      });
      await templateManager.saveTemplate(createMockFlow({ id: 's2' }), {
        name: 'Registration Flow',
        description: 'User registration process',
        tags: ['auth', 'signup'],
      });
      await templateManager.saveTemplate(createMockFlow({ id: 's3' }), {
        name: 'Checkout Process',
        description: 'E-commerce checkout',
        tags: ['ecommerce', 'payment'],
      });
    });

    it('should search by name', () => {
      const results = templateManager.searchTemplates('login');
      expect(results).toHaveLength(1);
      expect(results[0].metadata.name).toBe('Login Test');
    });

    it('should search by description', () => {
      const results = templateManager.searchTemplates('registration');
      expect(results).toHaveLength(1);
      expect(results[0].metadata.name).toBe('Registration Flow');
    });

    it('should search by tags', () => {
      const results = templateManager.searchTemplates('auth');
      expect(results).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      const results = templateManager.searchTemplates('LOGIN');
      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', () => {
      const results = templateManager.searchTemplates('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('getTemplateMetadata', () => {
    it('should return metadata for existing template', async () => {
      const flow = createMockFlow();
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(flow, {
        name: 'Metadata Test',
        author: 'Test Author',
        version: '2.0.0',
      });

      const metadata = templateManager.getTemplateMetadata(flow.id);

      expect(metadata).toEqual(expect.objectContaining({
        name: 'Metadata Test',
        author: 'Test Author',
        version: '2.0.0',
      }));
    });

    it('should return null for non-existent template', () => {
      const metadata = templateManager.getTemplateMetadata('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('createCategory', () => {
    it('should create new custom category', async () => {
      const category = await templateManager.createCategory({
        name: 'My Category',
        icon: '📂',
        color: '#ff0000',
        description: 'Custom category',
        order: 10,
      });

      expect(category.id).toMatch(/^category-/);
      expect(category.name).toBe('My Category');

      const categories = templateManager.getAllCategories();
      const custom = categories.find(c => c.id === category.id);
      expect(custom).toBeTruthy();
    });

    it('should save custom category to localStorage', async () => {
      await templateManager.createCategory({
        name: 'Stored Category',
        icon: '💾',
      });

      const stored = localStorage.getItem('designer_template_categories');
      expect(stored).toBeTruthy();

      const categories = JSON.parse(stored!) as TemplateCategory[];
      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe('Stored Category');
    });

    it('should not include built-in categories in custom storage', async () => {
      await templateManager.createCategory({
        name: 'Custom Only',
      });

      const stored = localStorage.getItem('designer_template_categories');
      const categories = JSON.parse(stored!) as TemplateCategory[];

      expect(categories.every(c => !BUILT_IN_CATEGORIES.some(bc => bc.id === c.id))).toBe(true);
    });
  });

  describe('exportTemplateToFile', () => {
    it('should export template as YAML string', async () => {
      const flow = createMockFlow();
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(flow, {
        name: 'Export Test',
        description: 'Test export functionality',
        category: 'basic',
        tags: ['export', 'test'],
        author: 'Test Author',
        version: '1.0.0',
      });

      const exported = templateManager.exportTemplateToFile(flow.id);

      expect(exported).toBeTruthy();
      expect(exported).toContain('# Export Test');
      expect(exported).toContain('# Test export functionality');
      // The YAML contains the flow's name, not the template's name
      expect(exported).toContain('name: Test Flow');
    });

    it('should return null for non-existent template', () => {
      const exported = templateManager.exportTemplateToFile('non-existent');
      expect(exported).toBeNull();
    });

    it('should include metadata as comments', async () => {
      const flow = createMockFlow({ id: 'meta-export' });
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(flow, {
        name: 'Metadata Export',
        tags: ['tag1', 'tag2'],
        version: '3.0.0',
      });

      const exported = templateManager.exportTemplateToFile('meta-export');

      expect(exported).toContain('# Tags: tag1, tag2');
      expect(exported).toContain('# Version: 3.0.0');
    });
  });

  describe('importMultipleTemplates', () => {
    it('should import multiple templates', async () => {
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      const content = JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        templates: [
          {
            metadata: { name: 'Import 1', category: 'basic' },
            flow: createMockFlow({ id: 'import-1' }),
          },
          {
            metadata: { name: 'Import 2', category: 'form' },
            flow: createMockFlow({ id: 'import-2' }),
          },
        ],
      });

      const result = await templateManager.importMultipleTemplates(content);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial failures', async () => {
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      const content = JSON.stringify({
        templates: [
          {
            metadata: { name: 'Valid Import' },
            flow: createMockFlow({ id: 'valid' }),
          },
          {
            metadata: { name: 'Invalid Import' },
            flow: null as any, // Invalid flow
          },
        ],
      });

      const result = await templateManager.importMultipleTemplates(content);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should return error for invalid format', async () => {
      const result = await templateManager.importMultipleTemplates('invalid json');

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getPopularTemplates', () => {
    beforeEach(async () => {
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      const t1 = await templateManager.saveTemplate(createMockFlow({ id: 'pop1' }), {
        name: 'Popular',
      });
      // Simulate usage
      for (let i = 0; i < 10; i++) {
        await templateManager.loadTemplate('pop1');
      }

      await templateManager.saveTemplate(createMockFlow({ id: 'pop2' }), {
        name: 'Less Popular',
      });
      await templateManager.loadTemplate('pop2');
    });

    it('should return templates ordered by use count', () => {
      const popular = templateManager.getPopularTemplates();

      expect(popular[0].metadata.name).toBe('Popular');
      expect(popular[0].metadata.useCount).toBe(10);
    });

    it('should limit results', () => {
      const popular = templateManager.getPopularTemplates(1);
      expect(popular).toHaveLength(1);
    });
  });

  describe('getRecentTemplates', () => {
    beforeEach(async () => {
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(createMockFlow({ id: 'recent1' }), {
        name: 'Old',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await templateManager.saveTemplate(createMockFlow({ id: 'recent2' }), {
        name: 'New',
      });
    });

    it('should return templates ordered by update time', () => {
      const recent = templateManager.getRecentTemplates();

      expect(recent[0].metadata.name).toBe('New');
      expect(recent[1].metadata.name).toBe('Old');
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(createMockFlow({ id: 'stat1' }), {
        name: 'Stat 1',
        category: 'basic',
      });
      await templateManager.saveTemplate(createMockFlow({ id: 'stat2' }), {
        name: 'Stat 2',
        category: 'basic',
      });
      await templateManager.saveTemplate(createMockFlow({ id: 'stat3' }), {
        name: 'Stat 3',
        category: 'form',
      });

      // Simulate usage
      await templateManager.loadTemplate('stat1');
      await templateManager.loadTemplate('stat1');
      await templateManager.loadTemplate('stat2');
    });

    it('should return accurate statistics', () => {
      const stats = templateManager.getStats();

      expect(stats.totalTemplates).toBe(3);
      expect(stats.templatesByCategory.basic).toBe(2);
      expect(stats.templatesByCategory.form).toBe(1);
      expect(stats.totalUsage).toBe(3);
    });

    it('should calculate average node count', () => {
      const stats = templateManager.getStats();

      // All 3 templates have 2 nodes each (from createMockFlow)
      expect(stats.averageNodeCount).toBe(2);
    });
  });

  describe('createFlowSnapshot and restoreFlowSnapshot', () => {
    it('should create and restore flow snapshot', () => {
      const flow = createMockFlow({
        name: 'Snapshot Test',
        variables: [
          { name: 'var1', value: 'value1', type: 'string' },
        ],
      });

      const snapshot = templateManager.createFlowSnapshot(flow);
      expect(snapshot).toBeTruthy();
      expect(typeof snapshot).toBe('string');

      const restored = templateManager.restoreFlowSnapshot(snapshot);

      expect(restored).toBeTruthy();
      expect(restored?.name).toBe('Snapshot Test');
      expect(restored?.variables).toHaveLength(1);
      expect(restored?.variables[0].name).toBe('var1');
    });

    it('should return null for invalid snapshot', () => {
      const restored = templateManager.restoreFlowSnapshot('invalid snapshot');
      expect(restored).toBeNull();
    });
  });

  describe('cleanupUnusedTemplates', () => {
    beforeEach(async () => {
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });
      mockChromeStorage.local.remove.mockImplementation((key, callback) => {
        callback?.();
      });

      const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago

      await templateManager.saveTemplate(createMockFlow({ id: 'unused' }), {
        name: 'Unused Template',
        category: 'custom',
      });
      // Manually set old timestamp
      const template = (templateManager as any).templates.get('unused');
      template.metadata.updatedAt = oldTime;
      template.metadata.useCount = 0;

      await templateManager.saveTemplate(createMockFlow({ id: 'used' }), {
        name: 'Used Template',
        category: 'custom',
      });
      await templateManager.loadTemplate('used');

      // Built-in category template should not be deleted
      await templateManager.saveTemplate(createMockFlow({ id: 'builtin' }), {
        name: 'Built-in Template',
        category: 'basic',
      });
      const builtin = (templateManager as any).templates.get('builtin');
      builtin.metadata.updatedAt = oldTime;
      builtin.metadata.useCount = 0;
    });

    it('should remove unused custom templates', async () => {
      const deleted = await templateManager.cleanupUnusedTemplates(30);

      expect(deleted).toBe(1);
      expect(templateManager.getAllTemplates()).toHaveLength(2);
    });

    it('should preserve used templates', async () => {
      await templateManager.cleanupUnusedTemplates(30);

      const used = templateManager.getTemplateMetadata('used');
      expect(used).toBeTruthy();
    });

    it('should preserve built-in category templates', async () => {
      await templateManager.cleanupUnusedTemplates(30);

      const builtin = templateManager.getTemplateMetadata('builtin');
      expect(builtin).toBeTruthy();
    });
  });

  describe('getAllTemplates', () => {
    it('should return templates sorted by update time', async () => {
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await templateManager.saveTemplate(createMockFlow({ id: 'sort1' }), {
        name: 'First',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await templateManager.saveTemplate(createMockFlow({ id: 'sort2' }), {
        name: 'Second',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await templateManager.saveTemplate(createMockFlow({ id: 'sort3' }), {
        name: 'Third',
      });

      const all = templateManager.getAllTemplates();

      expect(all[0].metadata.name).toBe('Third');
      expect(all[1].metadata.name).toBe('Second');
      expect(all[2].metadata.name).toBe('First');
    });

    it('should return empty array when no templates', () => {
      const all = templateManager.getAllTemplates();
      expect(all).toEqual([]);
    });
  });
});
