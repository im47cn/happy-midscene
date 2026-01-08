/**
 * File Manager Service Tests
 * 文件管理服务测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  DesignerEdge,
  DesignerNode,
  TestFlow,
} from '../../types/designer';
import {
  saveToStorage,
  loadFromStorage,
  deleteFromStorage,
  listStoredFlows,
  exportFlow,
  importFlow,
  importFromUrl,
  cloneFlow,
  mergeFlows,
  getRecentFiles,
  clearRecentFiles,
  clearAllStorage,
  getStorageUsage,
  type FileMetadata,
  type FileFormat,
  type SaveOptions,
  type LoadOptions,
} from '../fileManager';

// Mock localStorage
const createLocalStorageMock = () => {
  const store: Record<string, string> = {};
  const localStorageMock = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    // Make hasOwnProperty work correctly
    hasOwnProperty: (key: string) => Object.prototype.hasOwnProperty.call(store, key),
  };

  // Make keys enumerable for for..in loops (getStorageUsage depends on this)
  Object.keys(store).forEach((key) => {
    Object.defineProperty(localStorageMock, key, {
      get: () => store[key],
      enumerable: true,
      configurable: true,
    });
  });

  // Intercept setItem to add new enumerable properties
  const originalSetItem = localStorageMock.setItem;
  localStorageMock.setItem = (key: string, value: string) => {
    originalSetItem(key, value);
    Object.defineProperty(localStorageMock, key, {
      get: () => store[key],
      enumerable: true,
      configurable: true,
    });
  };

  return localStorageMock;
};

const localStorageMock = createLocalStorageMock();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('FileManager', () => {
  let mockFlow: TestFlow;
  let mockNodes: DesignerNode[];
  let mockEdges: DesignerEdge[];

  beforeEach(() => {
    // Add createObjectURL and revokeObjectURL to URL (they don't exist in jsdom)
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn(() => 'blob:mock-url'),
        writable: true,
        configurable: true,
      });
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    }

    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }

    // Clear localStorage before each test
    localStorage.clear();

    // Create mock nodes
    mockNodes = [
      {
        id: 'start-1',
        type: 'start',
        position: { x: 0, y: 0 },
        data: {
          label: '开始',
          description: '',
          config: { variables: {} },
          errors: [],
          warnings: [],
          editable: false,
          deletable: false,
        },
      },
      {
        id: 'click-1',
        type: 'click',
        position: { x: 200, y: 0 },
        data: {
          label: '点击按钮',
          description: '',
          config: { target: 'button.submit', timeout: 30000, onFailure: 'stop' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      },
    ];

    // Create mock edges
    mockEdges = [
      { id: 'e1', source: 'start-1', target: 'click-1' },
    ];

    // Create mock flow
    mockFlow = {
      id: 'flow-1',
      name: '测试流程',
      description: '测试描述',
      version: 1,
      nodes: mockNodes,
      edges: mockEdges,
      variables: [],
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('saveToStorage', () => {
    it('should save flow to localStorage', () => {
      const result = saveToStorage(mockFlow);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.flowId).toBe('flow-1');
      expect(result.metadata?.flowName).toBe('测试流程');

      // Verify stored in localStorage
      const stored = localStorage.getItem('designer_flow_flow-1');
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored!);
      expect(parsed.id).toBe('flow-1');
      expect(parsed.format).toBe('midscene-flow');
    });

    it('should save metadata separately', () => {
      saveToStorage(mockFlow);

      const metadata = localStorage.getItem('designer_metadata_flow-1');
      expect(metadata).toBeDefined();

      const parsed = JSON.parse(metadata!);
      expect(parsed.flowId).toBe('flow-1');
      expect(parsed.nodeCount).toBe(2);
      expect(parsed.edgeCount).toBe(1);
    });

    it('should return error for invalid flow', () => {
      const result = saveToStorage({} as TestFlow);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid flow data');
    });

    it('should handle save options', () => {
      const options: SaveOptions = {
        includeMetadata: true,
        format: true,
        filename: 'custom-name.json',
      };

      const result = saveToStorage(mockFlow, options);

      expect(result.success).toBe(true);
      expect(result.metadata?.name).toBe('custom-name.json');
    });

    it('should add to recent files', () => {
      saveToStorage(mockFlow);

      const recent = getRecentFiles();
      expect(recent.length).toBeGreaterThan(0);
      expect(recent[0].flowId).toBe('flow-1');
    });
  });

  describe('loadFromStorage', () => {
    it('should load flow from localStorage', () => {
      // First save
      saveToStorage(mockFlow);

      // Then load
      const loaded = loadFromStorage('flow-1');

      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe('flow-1');
      expect(loaded?.name).toBe('测试流程');
      expect(loaded?.nodes).toHaveLength(2);
      expect(loaded?.edges).toHaveLength(1);
    });

    it('should return null for non-existent flow', () => {
      const loaded = loadFromStorage('non-existent');

      expect(loaded).toBeNull();
    });

    it('should handle corrupted data', () => {
      localStorage.setItem('designer_flow_flow-1', 'invalid json');

      const loaded = loadFromStorage('flow-1');

      expect(loaded).toBeNull();
    });

    it('should handle flow without format field', () => {
      localStorage.setItem('designer_flow_flow-2', JSON.stringify({
        id: 'flow-2',
        name: 'Test',
        nodes: [],
        edges: [],
      }));

      const loaded = loadFromStorage('flow-2');

      expect(loaded).toBeNull();
    });
  });

  describe('deleteFromStorage', () => {
    it('should delete flow from storage', () => {
      saveToStorage(mockFlow);

      const result = deleteFromStorage('flow-1');

      expect(result).toBe(true);
      expect(localStorage.getItem('designer_flow_flow-1')).toBeNull();
      expect(localStorage.getItem('designer_metadata_flow-1')).toBeNull();
    });

    it('should remove from recent files', () => {
      saveToStorage(mockFlow);
      expect(getRecentFiles().length).toBeGreaterThan(0);

      deleteFromStorage('flow-1');

      const recent = getRecentFiles();
      expect(recent.some((f) => f.flowId === 'flow-1')).toBe(false);
    });

    it('should handle deleting non-existent flow', () => {
      const result = deleteFromStorage('non-existent');

      expect(result).toBe(true); // Should not throw
    });
  });

  describe('listStoredFlows', () => {
    it('should return empty list when no flows', () => {
      const result = listStoredFlows();

      expect(result.files).toHaveLength(0);
      expect(result.error).toBeUndefined();
    });

    it('should list all stored flows', () => {
      saveToStorage(mockFlow);

      const flow2: TestFlow = { ...mockFlow, id: 'flow-2', name: 'Flow 2' };
      saveToStorage(flow2);

      const result = listStoredFlows();

      expect(result.files.length).toBeGreaterThanOrEqual(2);
    });

    it('should return sorted by last modified', () => {
      saveToStorage(mockFlow);

      // Wait a bit to ensure different timestamps
      const later = Date.now() + 1000;
      vi.spyOn(Date, 'now').mockReturnValue(later);

      const flow2: TestFlow = { ...mockFlow, id: 'flow-2', name: 'Flow 2' };
      saveToStorage(flow2);

      const result = listStoredFlows();

      expect(result.files[0].flowId).toBe('flow-2'); // Most recent first
    });

    it('should handle storage errors gracefully', () => {
      // Add some corrupted metadata
      localStorage.setItem('designer_metadata_corrupted', 'invalid json');

      const result = listStoredFlows();

      expect(result.files).toBeDefined();
    });
  });

  describe('exportFlow', () => {
    it('should export flow as JSON', () => {
      const result = exportFlow(mockFlow, 'json');

      expect(result.success).toBe(true);
      expect(result.metadata?.format).toBe('json');
    });

    it('should export flow as YAML', () => {
      const result = exportFlow(mockFlow, 'yaml');

      expect(result.success).toBe(true);
      expect(result.metadata?.format).toBe('yaml');
    });

    it('should export flow as midscene format', () => {
      const result = exportFlow(mockFlow, 'midscene');

      expect(result.success).toBe(true);
      expect(result.metadata?.format).toBe('midscene');
    });

    it('should use custom filename', () => {
      const options: SaveOptions = { filename: 'custom-test.json' };
      const result = exportFlow(mockFlow, 'json', options);

      expect(result.success).toBe(true);
      expect(result.metadata?.name).toBe('custom-test.json');
    });

    it('should handle invalid flow', () => {
      const result = exportFlow({} as TestFlow, 'json');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid flow data');
    });

    it('should add to recent files', () => {
      exportFlow(mockFlow, 'json');

      const recent = getRecentFiles();
      expect(recent.length).toBeGreaterThan(0);
    });
  });

  describe('importFlow', () => {
    it('should import JSON flow file', async () => {
      const jsonContent = JSON.stringify({
        format: 'midscene-flow',
        id: 'import-flow-1',
        name: 'Imported Flow',
        nodes: mockNodes,
        edges: mockEdges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      });

      const file = new File([jsonContent], 'test-flow.json', { type: 'application/json' });

      const imported = await importFlow(file);

      expect(imported).toBeDefined();
      expect(imported?.id).toBe('import-flow-1');
      expect(imported?.name).toBe('Imported Flow');
    });

    it('should import YAML flow file', async () => {
      const yamlContent = `
name: Test Flow
steps:
  - ai: button.submit
`;

      const file = new File([yamlContent], 'test-flow.yaml', { type: 'text/yaml' });

      const imported = await importFlow(file);

      expect(imported).toBeDefined();
      expect(imported?.name).toBe('Test Flow');
    });

    it('should handle empty file', async () => {
      const file = new File([''], 'empty.json', { type: 'application/json' });

      await expect(importFlow(file)).rejects.toThrow('File content is empty');
    });

    it('should save imported flow to storage', async () => {
      const jsonContent = JSON.stringify({
        format: 'midscene-flow',
        id: 'import-flow-2',
        name: 'Imported Flow 2',
        nodes: mockNodes,
        edges: mockEdges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      });

      const file = new File([jsonContent], 'test-flow.json', { type: 'application/json' });

      await importFlow(file);

      const loaded = loadFromStorage('import-flow-2');
      expect(loaded).toBeDefined();
    });

    it('should update metadata on import', async () => {
      const jsonContent = JSON.stringify({
        format: 'midscene-flow',
        id: 'import-flow-3',
        name: 'Imported Flow 3',
        nodes: mockNodes,
        edges: mockEdges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      });

      const file = new File([jsonContent], 'test-flow.json', { type: 'application/json' });

      const imported = await importFlow(file);

      expect(imported?.metadata.importedAt).toBeDefined();
      expect(imported?.metadata.importedFrom).toBe('test-flow.json');
    });
  });

  describe('importFromUrl', () => {
    it('should import flow from URL', async () => {
      const jsonContent = JSON.stringify({
        format: 'midscene-flow',
        id: 'url-flow-1',
        name: 'URL Imported Flow',
        nodes: mockNodes,
        edges: mockEdges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      });

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(jsonContent),
        } as Response)
      );

      const imported = await importFromUrl('https://example.com/flow.json');

      expect(imported).toBeDefined();
      expect(imported?.id).toBe('url-flow-1');
      expect(imported?.metadata.importedFrom).toBe('https://example.com/flow.json');
    });

    it('should handle HTTP errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        } as Response)
      );

      const imported = await importFromUrl('https://example.com/not-found.json');

      expect(imported).toBeNull();
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      const imported = await importFromUrl('https://example.com/flow.json');

      expect(imported).toBeNull();
    });
  });

  describe('cloneFlow', () => {
    it('should clone flow with new ID', () => {
      const cloned = cloneFlow(mockFlow);

      expect(cloned.id).not.toBe(mockFlow.id);
      expect(cloned.name).toBe(`${mockFlow.name} (副本)`);
      expect(cloned.nodes).toHaveLength(mockFlow.nodes?.length);
      expect(cloned.edges).toHaveLength(mockFlow.edges?.length);
    });

    it('should clone with custom name', () => {
      const cloned = cloneFlow(mockFlow, 'Custom Clone Name');

      expect(cloned.name).toBe('Custom Clone Name');
    });

    it('should generate new IDs for cloned nodes', () => {
      const cloned = cloneFlow(mockFlow);

      const originalIds = mockFlow.nodes?.map((n) => n.id) || [];
      const clonedIds = cloned.nodes?.map((n) => n.id) || [];

      // Original and cloned IDs should not overlap
      const intersection = originalIds.filter((id) => clonedIds.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('should generate new IDs for cloned edges', () => {
      const cloned = cloneFlow(mockFlow);

      const originalIds = mockFlow.edges?.map((e) => e.id) || [];
      const clonedIds = cloned.edges?.map((e) => e.id) || [];

      const intersection = originalIds.filter((id) => clonedIds.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('should update cloned from reference', () => {
      const cloned = cloneFlow(mockFlow);

      expect(cloned.metadata.clonedFrom).toBe(mockFlow.id);
    });

    it('should update timestamps', () => {
      const cloned = cloneFlow(mockFlow);

      expect(cloned.metadata.createdAt).toBeDefined();
      expect(cloned.metadata.updatedAt).toBeDefined();
    });
  });

  describe('mergeFlows', () => {
    let sourceFlow: TestFlow;
    let targetFlow: TestFlow;

    beforeEach(() => {
      targetFlow = {
        id: 'target-flow',
        name: 'Target Flow',
        nodes: [mockNodes[0]],
        edges: [],
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      sourceFlow = {
        id: 'source-flow',
        name: 'Source Flow',
        nodes: [mockNodes[1]],
        edges: mockEdges,
        variables: [{ name: 'var1', value: 'val1' }],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };
    });

    it('should merge two flows', () => {
      const merged = mergeFlows(targetFlow, sourceFlow);

      expect(merged.nodes?.length).toBe(2);
      expect(merged.edges?.length).toBe(1);
      expect(merged.variables?.length).toBe(1);
    });

    it('should generate new IDs for merged nodes', () => {
      const sourceNodeId = sourceFlow.nodes![0].id;
      const merged = mergeFlows(targetFlow, sourceFlow);

      const mergedNode = merged.nodes?.find((n) =>
        sourceFlow.nodes?.some((sn) => sn.data.label === n.data.label && sn.id !== n.id)
      );

      expect(mergedNode?.id).not.toBe(sourceNodeId);
    });

    it('should update edge references in merged flow', () => {
      const merged = mergeFlows(targetFlow, sourceFlow);

      // All edges should reference existing nodes
      const nodeIds = new Set(merged.nodes?.map((n) => n.id) || []);

      merged.edges?.forEach((edge) => {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      });
    });

    it('should update metadata', () => {
      const merged = mergeFlows(targetFlow, sourceFlow);

      expect(merged.metadata.mergedWith).toBe(sourceFlow.id);
      expect(merged.metadata.updatedAt).toBeDefined();
    });
  });

  describe('getRecentFiles', () => {
    it('should return empty list initially', () => {
      const recent = getRecentFiles();

      expect(recent).toEqual([]);
    });

    it('should return recent files', () => {
      saveToStorage(mockFlow);

      const recent = getRecentFiles();

      expect(recent.length).toBeGreaterThan(0);
      expect(recent[0].flowId).toBe('flow-1');
    });

    it('should maintain max 20 recent files', () => {
      // Save more than 20 flows
      for (let i = 0; i < 25; i++) {
        const flow: TestFlow = {
          ...mockFlow,
          id: `flow-${i}`,
          name: `Flow ${i}`,
        };
        saveToStorage(flow);
      }

      const recent = getRecentFiles();

      expect(recent.length).toBeLessThanOrEqual(20);
    });
  });

  describe('clearRecentFiles', () => {
    it('should clear recent files', () => {
      saveToStorage(mockFlow);
      expect(getRecentFiles().length).toBeGreaterThan(0);

      clearRecentFiles();

      expect(getRecentFiles()).toEqual([]);
    });
  });

  describe('clearAllStorage', () => {
    it('should clear all designer storage', () => {
      saveToStorage(mockFlow);

      // Add some non-designer data
      localStorage.setItem('other-key', 'other-value');

      clearAllStorage();

      expect(localStorage.getItem('designer_flow_flow-1')).toBeNull();
      expect(localStorage.getItem('other-key')).toBe('other-value'); // Should be preserved
    });

    it('should clear recent files', () => {
      saveToStorage(mockFlow);
      expect(getRecentFiles().length).toBeGreaterThan(0);

      clearAllStorage();

      expect(getRecentFiles()).toEqual([]);
    });
  });

  describe('getStorageUsage', () => {
    it('should return storage usage', () => {
      saveToStorage(mockFlow);

      const usage = getStorageUsage();

      expect(usage.used).toBeGreaterThan(0);
      expect(usage.total).toBe(5 * 1024 * 1024); // 5MB
      expect(usage.percentage).toBeGreaterThan(0);
      expect(usage.percentage).toBeLessThanOrEqual(100);
    });

    it('should return zero usage when empty', () => {
      const usage = getStorageUsage();

      expect(usage.used).toBe(0);
      expect(usage.percentage).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle flow with no nodes', () => {
      const emptyFlow: TestFlow = {
        ...mockFlow,
        nodes: [],
        edges: [],
      };

      const result = saveToStorage(emptyFlow);

      expect(result.success).toBe(true);
      expect(result.metadata?.nodeCount).toBe(0);
    });

    it('should handle flow with no edges', () => {
      const noEdgesFlow: TestFlow = {
        ...mockFlow,
        edges: [],
      };

      const result = saveToStorage(noEdgesFlow);

      expect(result.success).toBe(true);
      expect(result.metadata?.edgeCount).toBe(0);
    });

    it('should handle flow with empty name', () => {
      const noNameFlow: TestFlow = {
        ...mockFlow,
        name: '',
      };

      const result = saveToStorage(noNameFlow);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in flow name', () => {
      const specialNameFlow: TestFlow = {
        ...mockFlow,
        name: '测试 <>&"\' 流程',
      };

      const result = saveToStorage(specialNameFlow);

      expect(result.success).toBe(true);
    });

    it('should handle very large flow', () => {
      const largeNodes: DesignerNode[] = Array.from({ length: 100 }, (_, i) => ({
        id: `node-${i}`,
        type: 'click',
        position: { x: i * 100, y: 0 },
        data: {
          label: `Node ${i}`,
          description: '',
          config: { target: `button-${i}`, timeout: 30000, onFailure: 'stop' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      }));

      const largeFlow: TestFlow = {
        ...mockFlow,
        nodes: largeNodes,
        edges: [],
      };

      const result = saveToStorage(largeFlow);

      expect(result.success).toBe(true);
      expect(result.metadata?.nodeCount).toBe(100);
    });
  });

  describe('File format detection', () => {
    it('should detect .yaml extension', async () => {
      const yamlContent = 'name: Test\nsteps: []';
      const file = new File([yamlContent], 'test.yaml', { type: 'text/yaml' });

      const imported = await importFlow(file);

      expect(imported).toBeDefined();
    });

    it('should detect .yml extension', async () => {
      const yamlContent = 'name: Test\nsteps: []';
      const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

      const imported = await importFlow(file);

      expect(imported).toBeDefined();
    });

    it('should detect .json extension', async () => {
      const jsonContent = JSON.stringify({
        format: 'midscene-flow',
        id: 'test',
        name: 'Test',
        nodes: [],
        edges: [],
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      });

      const file = new File([jsonContent], 'test.json', { type: 'application/json' });

      const imported = await importFlow(file);

      expect(imported).toBeDefined();
    });

    it('should default to JSON for unknown extension', async () => {
      const jsonContent = JSON.stringify({
        format: 'midscene-flow',
        id: 'test',
        name: 'Test',
        nodes: [],
        edges: [],
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      });

      const file = new File([jsonContent], 'test.unknown', { type: 'text/plain' });

      const imported = await importFlow(file);

      expect(imported).toBeDefined();
    });
  });
});
