/**
 * Node Registry Service Tests
 * 节点注册表服务测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  ConfigSchema,
  DesignerNode,
  NodeCategory,
  NodeDefinition,
  NodeType,
  PortDefinition,
} from '../../types/designer';
import {
  nodeRegistry,
  generateId,
  createNode,
  validateNodeConfig as registryValidateNodeConfig,
  nodeToYaml,
  type YamlStep,
} from '../nodeRegistry';

describe('NodeRegistry', () => {
  describe('Singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(nodeRegistry).toBeDefined();
      expect(typeof nodeRegistry.get).toBe('function');
      expect(typeof nodeRegistry.register).toBe('function');
      expect(typeof nodeRegistry.getAll).toBe('function');
    });
  });

  describe('get', () => {
    it('should return node definition for known type', () => {
      const definition = nodeRegistry.get('click');

      expect(definition).toBeDefined();
      expect(definition?.type).toBe('click');
      expect(definition?.label).toBe('点击');
      expect(definition?.category).toBe('action');
    });

    it('should return undefined for unknown type', () => {
      const definition = nodeRegistry.get('unknown-type' as NodeType);

      expect(definition).toBeUndefined();
    });

    it('should get all node types', () => {
      const nodeTypes: NodeType[] = [
        'start',
        'end',
        'comment',
        'subflow',
        'click',
        'input',
        'scroll',
        'wait',
        'navigate',
        'hover',
        'drag',
        'assertExists',
        'assertText',
        'assertState',
        'aiAssert',
        'ifElse',
        'loop',
        'parallel',
        'group',
        'setVariable',
        'extractData',
        'externalData',
      ];

      for (const type of nodeTypes) {
        expect(nodeRegistry.get(type)).toBeDefined();
      }
    });
  });

  describe('has', () => {
    it('should return true for known type', () => {
      expect(nodeRegistry.has('click')).toBe(true);
      expect(nodeRegistry.has('start')).toBe(true);
    });

    it('should return false for unknown type', () => {
      expect(nodeRegistry.has('unknown-type' as NodeType)).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all registered nodes', () => {
      const allNodes = nodeRegistry.getAll();

      expect(allNodes.length).toBeGreaterThan(0);
      expect(allNodes.every((n) => n.type && n.label && n.category)).toBe(true);
    });

    it('should include all node categories', () => {
      const allNodes = nodeRegistry.getAll();
      const categories = new Set(allNodes.map((n) => n.category));

      expect(categories.has('special')).toBe(true);
      expect(categories.has('action')).toBe(true);
      expect(categories.has('validation')).toBe(true);
      expect(categories.has('control')).toBe(true);
      expect(categories.has('data')).toBe(true);
    });
  });

  describe('getByCategory', () => {
    it('should return action nodes', () => {
      const actionNodes = nodeRegistry.getByCategory('action');

      expect(actionNodes.length).toBeGreaterThan(0);
      expect(actionNodes.every((n) => n.category === 'action')).toBe(true);
      expect(actionNodes.some((n) => n.type === 'click')).toBe(true);
      expect(actionNodes.some((n) => n.type === 'input')).toBe(true);
    });

    it('should return validation nodes', () => {
      const validationNodes = nodeRegistry.getByCategory('validation');

      expect(validationNodes.length).toBeGreaterThan(0);
      expect(validationNodes.every((n) => n.category === 'validation')).toBe(true);
    });

    it('should return control nodes', () => {
      const controlNodes = nodeRegistry.getByCategory('control');

      expect(controlNodes.length).toBeGreaterThan(0);
      expect(controlNodes.every((n) => n.category === 'control')).toBe(true);
    });

    it('should return data nodes', () => {
      const dataNodes = nodeRegistry.getByCategory('data');

      expect(dataNodes.length).toBeGreaterThan(0);
      expect(dataNodes.every((n) => n.category === 'data')).toBe(true);
    });

    it('should return special nodes', () => {
      const specialNodes = nodeRegistry.getByCategory('special');

      expect(specialNodes.length).toBeGreaterThan(0);
      expect(specialNodes.every((n) => n.category === 'special')).toBe(true);
    });
  });

  describe('getCategories', () => {
    it('should return all categories', () => {
      const categories = nodeRegistry.getCategories();

      expect(categories).toContain('special');
      expect(categories).toContain('action');
      expect(categories).toContain('validation');
      expect(categories).toContain('control');
      expect(categories).toContain('data');
    });
  });

  describe('createNode', () => {
    it('should create a basic node', () => {
      const node = nodeRegistry.createNode('click', { x: 100, y: 200 });

      expect(node).toBeDefined();
      expect(node.id).toMatch(/^click-/);
      expect(node.type).toBe('click');
      expect(node.position).toEqual({ x: 100, y: 200 });
      expect(node.data.label).toBe('点击');
      expect(node.data.config).toBeDefined();
    });

    it('should create node with overrides', () => {
      const node = nodeRegistry.createNode(
        'click',
        { x: 100, y: 200 },
        { id: 'custom-id', data: { label: 'Custom Label' } },
      );

      expect(node.id).toBe('custom-id');
      expect(node.data.label).toBe('Custom Label');
    });

    it('should throw error for unknown node type', () => {
      expect(() => {
        nodeRegistry.createNode('unknown-type' as NodeType, { x: 0, y: 0 });
      }).toThrow('Unknown node type');
    });

    it('should create start node', () => {
      const node = nodeRegistry.createNode('start', { x: 0, y: 0 });

      expect(node.type).toBe('start');
      expect(node.data.editable).toBe(false);
      expect(node.data.deletable).toBe(false);
    });

    it('should create end node', () => {
      const node = nodeRegistry.createNode('end', { x: 0, y: 0 });

      expect(node.type).toBe('end');
      expect(node.data.editable).toBe(false);
      expect(node.data.deletable).toBe(false);
    });

    it('should create editable node by default', () => {
      const node = nodeRegistry.createNode('click', { x: 0, y: 0 });

      expect(node.data.editable).toBe(true);
      expect(node.data.deletable).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should validate comment node with valid content', () => {
      const result = nodeRegistry.validateConfig('comment', {
        content: 'Test comment',
        color: '#fff9c4',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail comment node validation with empty content', () => {
      const result = nodeRegistry.validateConfig('comment', {
        content: '',
        color: '#fff9c4',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('注释内容不能为空');
    });

    it('should fail comment node validation with whitespace content', () => {
      const result = nodeRegistry.validateConfig('comment', {
        content: '   ',
        color: '#fff9c4',
      });

      expect(result.valid).toBe(false);
    });

    it('should return error for unknown node type', () => {
      const result = nodeRegistry.validateConfig('unknown-type' as NodeType, {});

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('未知节点类型');
    });

    it('should validate click node with schema', () => {
      const result = nodeRegistry.validateConfig('click', {
        target: 'button',
        timeout: 30000,
        onFailure: 'stop',
      });

      expect(result.valid).toBe(true);
    });

    it('should fail click node validation without target', () => {
      const result = nodeRegistry.validateConfig('click', {
        timeout: 30000,
        onFailure: 'stop',
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('必填');
    });

    it('should validate numeric constraints', () => {
      const result = nodeRegistry.validateConfig('wait', {
        duration: 50, // Below minimum of 100
        timeout: 30000,
        onFailure: 'stop',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('不能小于'))).toBe(true);
    });

    it('should validate parallel node branches constraint', () => {
      const result = nodeRegistry.validateConfig('parallel', {
        branches: 1, // Below minimum of 2
        waitAll: true,
        timeout: 30000,
        onFailure: 'stop',
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('nodeToYaml', () => {
    it('should convert click node to YAML', () => {
      const node: DesignerNode = {
        id: 'click-1',
        type: 'click',
        position: { x: 0, y: 0 },
        data: {
          label: '点击按钮',
          description: '',
          config: { target: 'button.submit', timeout: 30000, onFailure: 'stop' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(1);
      expect(yaml[0].ai).toBe('button.submit');
    });

    it('should convert input node to YAML', () => {
      const node: DesignerNode = {
        id: 'input-1',
        type: 'input',
        position: { x: 0, y: 0 },
        data: {
          label: '输入文本',
          description: '',
          config: {
            target: 'input.text',
            value: 'test value',
            timeout: 30000,
            onFailure: 'stop',
          },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(1);
      expect(yaml[0].ai).toBe('input.text');
      expect(yaml[0].value).toBe('test value');
    });

    it('should convert wait node to YAML', () => {
      const node: DesignerNode = {
        id: 'wait-1',
        type: 'wait',
        position: { x: 0, y: 0 },
        data: {
          label: '等待',
          description: '',
          config: { duration: 5000, timeout: 30000, onFailure: 'stop' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(1);
      expect(yaml[0].wait).toBe(5000);
    });

    it('should convert navigate node to YAML', () => {
      const node: DesignerNode = {
        id: 'navigate-1',
        type: 'navigate',
        position: { x: 0, y: 0 },
        data: {
          label: '导航',
          description: '',
          config: { url: 'https://example.com', waitForLoad: true, timeout: 30000, onFailure: 'stop' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(1);
      expect(yaml[0].url).toBe('https://example.com');
    });

    it('should convert start node to YAML', () => {
      const node: DesignerNode = {
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
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(1);
      expect(yaml[0].meta).toEqual({ start: true });
    });

    it('should convert end node to YAML', () => {
      const node: DesignerNode = {
        id: 'end-1',
        type: 'end',
        position: { x: 0, y: 0 },
        data: {
          label: '结束',
          description: '',
          config: { returnValue: '' },
          errors: [],
          warnings: [],
          editable: false,
          deletable: false,
        },
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(1);
      expect(yaml[0].meta).toEqual({ end: true });
    });

    it('should convert comment node to empty YAML', () => {
      const node: DesignerNode = {
        id: 'comment-1',
        type: 'comment',
        position: { x: 0, y: 0 },
        data: {
          label: '注释',
          description: '',
          config: { content: 'A comment', color: '#fff9c4' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(0);
    });

    it('should convert assertExists node to YAML', () => {
      const node: DesignerNode = {
        id: 'assert-1',
        type: 'assertExists',
        position: { x: 0, y: 0 },
        data: {
          label: '断言存在',
          description: '',
          config: { target: '.element', state: 'visible', negate: false, timeout: 30000, onFailure: 'stop' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(1);
      expect(yaml[0].assert).toEqual({ exists: '.element' });
    });

    it('should convert ifElse node to YAML', () => {
      const node: DesignerNode = {
        id: 'if-1',
        type: 'ifElse',
        position: { x: 0, y: 0 },
        data: {
          label: '条件分支',
          description: '',
          config: { condition: 'element exists', trueLabel: 'True', falseLabel: 'False', timeout: 30000, onFailure: 'stop' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(1);
      expect(yaml[0].if).toBe('element exists');
    });

    it('should convert loop node to YAML', () => {
      const node: DesignerNode = {
        id: 'loop-1',
        type: 'loop',
        position: { x: 0, y: 0 },
        data: {
          label: '循环',
          description: '',
          config: { type: 'count', count: 5, maxIterations: 50, timeout: 30000, onFailure: 'stop' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(1);
      expect(yaml[0].loop).toEqual({ count: 5 });
    });

    it('should convert setVariable node to YAML', () => {
      const node: DesignerNode = {
        id: 'setvar-1',
        type: 'setVariable',
        position: { x: 0, y: 0 },
        data: {
          label: '设置变量',
          description: '',
          config: { name: 'myVar', value: 'myValue', valueType: 'string' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(1);
      expect(yaml[0].set).toEqual({ myVar: 'myValue' });
    });

    it('should return empty array for unknown node type', () => {
      const node: DesignerNode = {
        id: 'unknown-1',
        type: 'unknown-type' as any,
        position: { x: 0, y: 0 },
        data: {
          label: 'Unknown',
          description: '',
          config: {},
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const yaml = nodeToYaml(node);

      expect(yaml).toHaveLength(0);
    });
  });

  describe('Node definitions', () => {
    const getNodeDefinition = (type: NodeType): NodeDefinition | undefined => {
      return nodeRegistry.get(type);
    };

    it('should have correct properties for click node', () => {
      const def = getNodeDefinition('click');

      expect(def?.type).toBe('click');
      expect(def?.label).toBe('点击');
      expect(def?.category).toBe('action');
      expect(def?.defaultConfig).toBeDefined();
      expect(def?.configSchema).toBeDefined();
    });

    it('should have input and output ports for action nodes', () => {
      const clickDef = getNodeDefinition('click');
      const inputDef = getNodeDefinition('input');

      expect(clickDef?.inputs).toBeDefined();
      expect(clickDef?.outputs).toBeDefined();
      expect(inputDef?.inputs).toBeDefined();
      expect(inputDef?.outputs).toBeDefined();
    });

    it('should have no input ports for start node', () => {
      const def = getNodeDefinition('start');

      expect(def?.inputs).toHaveLength(0);
      expect(def?.outputs?.length).toBeGreaterThan(0);
    });

    it('should have no output ports for end node', () => {
      const def = getNodeDefinition('end');

      expect(def?.outputs).toHaveLength(0);
      expect(def?.inputs?.length).toBeGreaterThan(0);
    });

    it('should have conditional ports for ifElse node', () => {
      const def = getNodeDefinition('ifElse');

      expect(def?.inputs?.length).toBeGreaterThan(0);
      expect(def?.outputs).toBeDefined();
    });

    it('should have loop ports for loop node', () => {
      const def = getNodeDefinition('loop');

      expect(def?.inputs).toBeDefined();
      expect(def?.outputs).toBeDefined();
    });

    it('should have required fields in schema for click', () => {
      const def = getNodeDefinition('click');
      const schema = def?.configSchema as ConfigSchema;

      expect(schema?.required).toContain('target');
    });

    it('should have required fields in schema for input', () => {
      const def = getNodeDefinition('input');
      const schema = def?.configSchema as ConfigSchema;

      expect(schema?.required).toContain('target');
      expect(schema?.required).toContain('value');
    });

    it('should have numeric constraints in schema for wait', () => {
      const def = getNodeDefinition('wait');
      const schema = def?.configSchema as ConfigSchema;

      expect(schema?.properties?.duration?.minimum).toBe(100);
      expect(schema?.properties?.duration?.maximum).toBe(60000);
    });
  });

  describe('Utility functions', () => {
    describe('generateId', () => {
      it('should generate unique IDs', () => {
        const id1 = generateId();
        const id2 = generateId();

        expect(id1).not.toBe(id2);
      });

      it('should use prefix in generated ID', () => {
        const id = generateId('test');

        expect(id).toMatch(/^test-/);
      });

      it('should use default prefix', () => {
        const id = generateId();

        expect(id).toMatch(/^node-/);
      });
    });

    describe('createNode', () => {
      it('should create node using nodeRegistry', () => {
        const node = createNode('click', { x: 100, y: 200 });

        expect(node).toBeDefined();
        expect(node.type).toBe('click');
        expect(node.position).toEqual({ x: 100, y: 200 });
      });
    });

    describe('validateNodeConfig', () => {
      it('should validate config using nodeRegistry', () => {
        const result = registryValidateNodeConfig('comment', {
          content: 'Test',
          color: '#fff9c4',
        });

        expect(result.valid).toBe(true);
      });

      it('should fail validation for invalid config', () => {
        const result = registryValidateNodeConfig('comment', {
          content: '',
          color: '#fff9c4',
        });

        expect(result.valid).toBe(false);
      });
    });

    describe('nodeToYaml', () => {
      it('should convert node to YAML steps', () => {
        const node: DesignerNode = {
          id: 'test-1',
          type: 'wait',
          position: { x: 0, y: 0 },
          data: {
            label: '等待',
            description: '',
            config: { duration: 1000, timeout: 30000, onFailure: 'stop' },
            errors: [],
            warnings: [],
            editable: true,
            deletable: true,
          },
        };

        const yaml = nodeToYaml(node);

        expect(yaml).toHaveLength(1);
        expect(yaml[0].wait).toBe(1000);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle register with custom definition', () => {
      const customDef: NodeDefinition = {
        type: 'custom-node' as NodeType,
        label: 'Custom Node',
        category: 'action',
        icon: '⚡',
        defaultConfig: { timeout: 5000 },
        inputs: [],
        outputs: [],
        configSchema: {
          type: 'object',
          properties: {
            timeout: { type: 'number', title: 'Timeout' },
          },
        },
        toYaml: () => [{ custom: 'step' }],
      };

      nodeRegistry.register(customDef);

      const retrieved = nodeRegistry.get('custom-node' as NodeType);
      expect(retrieved).toEqual(customDef);
    });

    it('should handle double registration', () => {
      const def: NodeDefinition = {
        type: 'double-test' as NodeType,
        label: 'Double Test',
        category: 'action',
        icon: '🧪',
        defaultConfig: {},
        inputs: [],
        outputs: [],
        configSchema: { type: 'object', properties: {} },
        toYaml: () => [],
      };

      nodeRegistry.register(def);
      nodeRegistry.register(def); // Should not throw

      const retrieved = nodeRegistry.get('double-test' as NodeType);
      expect(retrieved?.label).toBe('Double Test');
    });
  });
});
