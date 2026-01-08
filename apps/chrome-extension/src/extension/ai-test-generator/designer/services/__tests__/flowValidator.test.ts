/**
 * Flow Validator Service Tests
 * 流程验证服务测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  DesignerEdge,
  DesignerNode,
  TestFlow,
} from '../../types/designer';
import {
  validateFlow,
  validateNode,
  validateNodeConfig,
  type ValidationError,
  type ValidationResult,
  type ValidationErrorType,
} from '../flowValidator';

describe('FlowValidator', () => {
  let mockFlow: TestFlow;
  let mockNodes: DesignerNode[];
  let mockEdges: DesignerEdge[];

  beforeEach(() => {
    // 创建模拟节点
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
      {
        id: 'end-1',
        type: 'end',
        position: { x: 400, y: 0 },
        data: {
          label: '结束',
          description: '',
          config: { returnValue: '' },
          errors: [],
          warnings: [],
          editable: false,
          deletable: false,
        },
      },
    ];

    // 创建模拟边
    mockEdges = [
      { id: 'e1', source: 'start-1', target: 'click-1' },
      { id: 'e2', source: 'click-1', target: 'end-1' },
    ];

    // 创建模拟流程
    mockFlow = {
      id: 'flow-1',
      name: '测试流程',
      nodes: mockNodes,
      edges: mockEdges,
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  });

  describe('validateFlow', () => {
    describe('Basic validation', () => {
      it('should validate a valid flow', () => {
        const result = validateFlow(mockFlow);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should return error for missing flow ID', () => {
        const invalidFlow = { ...mockFlow, id: '' };
        const result = validateFlow(invalidFlow);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          type: 'structure',
          message: '流程缺少ID',
        });
      });

      it('should return error for empty flow name', () => {
        const invalidFlow = { ...mockFlow, name: '   ' };
        const result = validateFlow(invalidFlow);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          type: 'structure',
          message: '流程名称不能为空',
        });
      });

      it('should return error for missing nodes', () => {
        const invalidFlow = { ...mockFlow, nodes: [] };
        const result = validateFlow(invalidFlow);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          type: 'structure',
          message: '流程至少需要一个节点',
        });
      });

      it('should return error for undefined nodes', () => {
        const invalidFlow = { ...mockFlow, nodes: undefined as any };
        const result = validateFlow(invalidFlow);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          type: 'structure',
          message: '流程至少需要一个节点',
        });
      });
    });

    describe('Start/End node validation', () => {
      it('should return error for missing start node', () => {
        const flowWithoutStart = {
          ...mockFlow,
          nodes: mockNodes.filter((n) => n.type !== 'start'),
        };
        const result = validateFlow(flowWithoutStart);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          type: 'structure',
          message: '流程缺少开始节点',
        });
      });

      it('should warn for multiple start nodes', () => {
        const flowWithMultipleStarts = {
          ...mockFlow,
          nodes: [
            ...mockNodes,
            {
              id: 'start-2',
              type: 'start',
              position: { x: 0, y: 100 },
              data: {
                label: '开始2',
                description: '',
                config: { variables: {} },
                errors: [],
                warnings: [],
                editable: false,
                deletable: false,
              },
            },
          ],
        };
        const result = validateFlow(flowWithMultipleStarts);

        expect(result.warnings).toContainEqual({
          message: '流程有多个开始节点，可能不是预期行为',
        });
      });

      it('should warn for missing end node', () => {
        const flowWithoutEnd = {
          ...mockFlow,
          nodes: mockNodes.filter((n) => n.type !== 'end'),
        };
        const result = validateFlow(flowWithoutEnd);

        expect(result.warnings).toContainEqual({
          message: '流程没有结束节点',
        });
      });

      it('should be valid without end node (warning only)', () => {
        const flowWithoutEnd = {
          ...mockFlow,
          nodes: mockNodes.filter((n) => n.type !== 'end'),
          edges: mockEdges.filter((e) => e.target !== 'end-1' && e.source !== 'end-1'),
        };
        const result = validateFlow(flowWithoutEnd);

        // Missing end node generates a warning, not an error
        expect(result.errors.filter((e) => e.message.includes('结束节点'))).toHaveLength(0);
        expect(result.warnings.some((w) => w.message.includes('结束节点'))).toBe(true);
        // The flow should still be valid since no end node is just a warning
        expect(result.valid).toBe(true);
      });
    });

    describe('Node validation', () => {
      it('should validate all nodes in flow', () => {
        // Add an invalid node
        const flowWithInvalidNode = {
          ...mockFlow,
          nodes: [
            ...mockNodes,
            {
              id: '',
              type: 'click' as any,
              position: { x: 600, y: 0 },
              data: {
                label: 'Invalid Node',
                description: '',
                config: {},
                errors: [],
                warnings: [],
                editable: true,
                deletable: true,
              },
            },
          ],
        };
        const result = validateFlow(flowWithInvalidNode);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.nodeId === '')).toBe(true);
      });
    });

    describe('Edge validation', () => {
      it('should return error for edge with missing source', () => {
        const flowWithInvalidEdge = {
          ...mockFlow,
          edges: [...mockEdges, { id: 'e3', source: '', target: 'end-1' }],
        };
        const result = validateFlow(flowWithInvalidEdge);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          type: 'connection',
          message: '边缺少源节点',
          edgeId: 'e3',
        });
      });

      it('should return error for edge with non-existent source', () => {
        const flowWithInvalidEdge = {
          ...mockFlow,
          edges: [...mockEdges, { id: 'e3', source: 'nonexistent', target: 'end-1' }],
        };
        const result = validateFlow(flowWithInvalidEdge);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          type: 'connection',
          message: '边的源节点不存在: nonexistent',
          edgeId: 'e3',
        });
      });

      it('should return error for edge with missing target', () => {
        const flowWithInvalidEdge = {
          ...mockFlow,
          edges: [...mockEdges, { id: 'e3', source: 'start-1', target: '' }],
        };
        const result = validateFlow(flowWithInvalidEdge);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          type: 'connection',
          message: '边缺少目标节点',
          edgeId: 'e3',
        });
      });

      it('should return error for edge with non-existent target', () => {
        const flowWithInvalidEdge = {
          ...mockFlow,
          edges: [...mockEdges, { id: 'e3', source: 'start-1', target: 'nonexistent' }],
        };
        const result = validateFlow(flowWithInvalidEdge);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          type: 'connection',
          message: '边的目标节点不存在: nonexistent',
          edgeId: 'e3',
        });
      });

      it('should validate multiple edge errors', () => {
        const flowWithMultipleInvalidEdges = {
          ...mockFlow,
          edges: [
            { id: 'e3', source: 'nonexistent1', target: 'end-1' },
            { id: 'e4', source: 'start-1', target: 'nonexistent2' },
          ],
        };
        const result = validateFlow(flowWithMultipleInvalidEdges);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Cycle detection', () => {
      it('should detect simple cycle', () => {
        const cycleNodes: DesignerNode[] = [
          mockNodes[0],
          {
            id: 'node-a',
            type: 'click',
            position: { x: 200, y: 0 },
            data: {
              label: 'Node A',
              description: '',
              config: { target: 'a', timeout: 30000, onFailure: 'stop' },
              errors: [],
              warnings: [],
              editable: true,
              deletable: true,
            },
          },
          {
            id: 'node-b',
            type: 'click',
            position: { x: 400, y: 0 },
            data: {
              label: 'Node B',
              description: '',
              config: { target: 'b', timeout: 30000, onFailure: 'stop' },
              errors: [],
              warnings: [],
              editable: true,
              deletable: true,
            },
          },
        ];

        const cycleEdges: DesignerEdge[] = [
          { id: 'e1', source: 'start-1', target: 'node-a' },
          { id: 'e2', source: 'node-a', target: 'node-b' },
          { id: 'e3', source: 'node-b', target: 'node-a' }, // Cycle!
        ];

        const flowWithCycle: TestFlow = {
          ...mockFlow,
          nodes: cycleNodes,
          edges: cycleEdges,
        };

        const result = validateFlow(flowWithCycle);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.type === 'cycle')).toBe(true);
      });

      it('should detect self-loop', () => {
        const selfLoopNodes: DesignerNode[] = [
          mockNodes[0],
          {
            id: 'node-a',
            type: 'click',
            position: { x: 200, y: 0 },
            data: {
              label: 'Node A',
              description: '',
              config: { target: 'a', timeout: 30000, onFailure: 'stop' },
              errors: [],
              warnings: [],
              editable: true,
              deletable: true,
            },
          },
        ];

        const selfLoopEdges: DesignerEdge[] = [
          { id: 'e1', source: 'start-1', target: 'node-a' },
          { id: 'e2', source: 'node-a', target: 'node-a' }, // Self-loop
        ];

        const flowWithSelfLoop: TestFlow = {
          ...mockFlow,
          nodes: selfLoopNodes,
          edges: selfLoopEdges,
        };

        const result = validateFlow(flowWithSelfLoop);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.type === 'cycle')).toBe(true);
      });

      it('should not detect cycle in linear flow', () => {
        const result = validateFlow(mockFlow);

        expect(result.valid).toBe(true);
        expect(result.errors.some((e) => e.type === 'cycle')).toBe(false);
      });

      it('should detect complex cycle with multiple nodes', () => {
        const complexCycleNodes: DesignerNode[] = [
          mockNodes[0],
          {
            id: 'node-a',
            type: 'click',
            position: { x: 200, y: 0 },
            data: {
              label: 'Node A',
              description: '',
              config: { target: 'a', timeout: 30000, onFailure: 'stop' },
              errors: [],
              warnings: [],
              editable: true,
              deletable: true,
            },
          },
          {
            id: 'node-b',
            type: 'click',
            position: { x: 400, y: 0 },
            data: {
              label: 'Node B',
              description: '',
              config: { target: 'b', timeout: 30000, onFailure: 'stop' },
              errors: [],
              warnings: [],
              editable: true,
              deletable: true,
            },
          },
          {
            id: 'node-c',
            type: 'click',
            position: { x: 600, y: 0 },
            data: {
              label: 'Node C',
              description: '',
              config: { target: 'c', timeout: 30000, onFailure: 'stop' },
              errors: [],
              warnings: [],
              editable: true,
              deletable: true,
            },
          },
        ];

        const complexCycleEdges: DesignerEdge[] = [
          { id: 'e1', source: 'start-1', target: 'node-a' },
          { id: 'e2', source: 'node-a', target: 'node-b' },
          { id: 'e3', source: 'node-b', target: 'node-c' },
          { id: 'e4', source: 'node-c', target: 'node-a' }, // Complex cycle
        ];

        const flowWithComplexCycle: TestFlow = {
          ...mockFlow,
          nodes: complexCycleNodes,
          edges: complexCycleEdges,
        };

        const result = validateFlow(flowWithComplexCycle);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.type === 'cycle')).toBe(true);
      });
    });

    describe('Isolated node detection', () => {
      it('should warn for isolated node', () => {
        const isolatedNode: DesignerNode = {
          id: 'isolated-1',
          type: 'click',
          position: { x: 600, y: 0 },
          data: {
            label: 'Isolated Node',
            description: '',
            config: { target: 'isolated', timeout: 30000, onFailure: 'stop' },
            errors: [],
            warnings: [],
            editable: true,
            deletable: true,
          },
        };

        const flowWithIsolated: TestFlow = {
          ...mockFlow,
          nodes: [...mockNodes, isolatedNode],
        };

        const result = validateFlow(flowWithIsolated);

        expect(result.warnings).toContainEqual({
          message: '节点 Isolated Node 没有任何连接',
          nodeId: 'isolated-1',
        });
      });

      it('should not warn for start node without connections in single-node flow', () => {
        const singleNodeFlow: TestFlow = {
          id: 'flow-2',
          name: 'Single Node',
          nodes: [mockNodes[0]],
          edges: [],
          metadata: mockFlow.metadata,
        };

        const result = validateFlow(singleNodeFlow);

        expect(result.warnings.some((w) => w.message.includes('没有任何连接'))).toBe(false);
      });

      it('should not warn for isolated start node in multi-node flow', () => {
        const flowWithStartOnly: TestFlow = {
          ...mockFlow,
          nodes: [
            mockNodes[0],
            {
              id: 'some-other',
              type: 'click',
              position: { x: 200, y: 0 },
              data: {
                label: 'Other Node',
                description: '',
                config: { target: 'other', timeout: 30000, onFailure: 'stop' },
                errors: [],
                warnings: [],
                editable: true,
                deletable: true,
              },
            },
          ],
          edges: [{ id: 'e1', source: 'some-other', target: 'some-other' }],
        };

        const result = validateFlow(flowWithStartOnly);

        // Start node should not generate warning even if isolated
        expect(result.warnings.some((w) => w.nodeId === 'start-1')).toBe(false);
      });

      it('should detect multiple isolated nodes', () => {
        const isolatedNodes: DesignerNode[] = [
          {
            id: 'isolated-1',
            type: 'click',
            position: { x: 600, y: 0 },
            data: {
              label: 'Isolated 1',
              description: '',
              config: { target: 'iso1', timeout: 30000, onFailure: 'stop' },
              errors: [],
              warnings: [],
              editable: true,
              deletable: true,
            },
          },
          {
            id: 'isolated-2',
            type: 'input',
            position: { x: 800, y: 0 },
            data: {
              label: 'Isolated 2',
              description: '',
              config: { target: 'iso2', value: 'test', timeout: 30000, onFailure: 'stop' },
              errors: [],
              warnings: [],
              editable: true,
              deletable: true,
            },
          },
        ];

        const flowWithMultipleIsolated: TestFlow = {
          ...mockFlow,
          nodes: [...mockNodes, ...isolatedNodes],
        };

        const result = validateFlow(flowWithMultipleIsolated);

        expect(result.warnings.filter((w) => w.message.includes('没有任何连接'))).toHaveLength(2);
      });
    });

    describe('Combined validations', () => {
      it('should report multiple error types together', () => {
        const flowWithMultipleIssues: TestFlow = {
          id: '',
          name: '',
          nodes: [],
          edges: [],
          metadata: mockFlow.metadata,
        };

        const result = validateFlow(flowWithMultipleIssues);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.type === 'structure')).toBe(true);
      });
    });
  });

  describe('validateNode', () => {
    let validNode: DesignerNode;

    beforeEach(() => {
      validNode = {
        id: 'node-1',
        type: 'click',
        position: { x: 0, y: 0 },
        data: {
          label: 'Click',
          description: '',
          config: { target: 'button', timeout: 30000, onFailure: 'stop' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };
    });

    it('should validate a valid node', () => {
      const errors = validateNode(validNode);

      expect(errors).toHaveLength(0);
    });

    it('should return error for missing node ID', () => {
      const invalidNode = { ...validNode, id: '' };
      const errors = validateNode(invalidNode);

      expect(errors).toContainEqual({
        type: 'structure',
        message: '节点缺少ID',
        nodeId: '',
      });
    });

    it('should return error for missing node type', () => {
      const invalidNode = { ...validNode, type: '' as any };
      const errors = validateNode(invalidNode);

      expect(errors).toContainEqual({
        type: 'structure',
        message: '节点缺少类型',
        nodeId: 'node-1',
      });
    });

    it('should return error for unknown node type', () => {
      const invalidNode = { ...validNode, type: 'unknown-type' as any };
      const errors = validateNode(invalidNode);

      expect(errors).toContainEqual({
        type: 'structure',
        message: '未知的节点类型: unknown-type',
        nodeId: 'node-1',
      });
    });

    it('should validate node with config errors', () => {
      // Comment node with empty content should fail validation
      const commentNode: DesignerNode = {
        id: 'comment-1',
        type: 'comment',
        position: { x: 0, y: 0 },
        data: {
          label: 'Comment',
          description: '',
          config: { content: '', color: '#fff9c4' },
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const errors = validateNode(commentNode);

      expect(errors).toContainEqual({
        type: 'configuration',
        message: '注释内容不能为空',
        nodeId: 'comment-1',
      });
    });

    it('should validate start node', () => {
      const startNode: DesignerNode = {
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

      const errors = validateNode(startNode);

      expect(errors).toHaveLength(0);
    });

    it('should validate end node', () => {
      const endNode: DesignerNode = {
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

      const errors = validateNode(endNode);

      expect(errors).toHaveLength(0);
    });
  });

  describe('validateNodeConfig', () => {
    it('should return error for unknown node type', () => {
      const result = validateNodeConfig('unknown-type' as any, {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        type: 'structure',
        message: '未知的节点类型: unknown-type',
      });
    });

    it('should validate nodes without custom validate function', () => {
      // Most nodes (click, input, wait, etc.) don't have custom validate functions
      // They rely on schema validation which is handled by nodeRegistry.validateConfig
      // but flowValidator.validateNodeConfig only checks custom validate functions
      const result = validateNodeConfig('click', {
        target: 'button',
        timeout: 30000,
        onFailure: 'stop',
      });

      // No custom validate function means it passes validateNodeConfig
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate click node config (no custom validation)', () => {
      const result = validateNodeConfig('click', {
        target: 'button',
        timeout: 30000,
        onFailure: 'stop',
      });

      // flowValidator.validateNodeConfig only uses custom validate functions
      // click node doesn't have one, so it always passes
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input node config (no custom validation)', () => {
      const result = validateNodeConfig('input', {
        target: 'input',
        value: 'test value',
        timeout: 30000,
        onFailure: 'stop',
      });

      expect(result.valid).toBe(true);
    });

    it('should validate wait node config (no custom validation)', () => {
      const result = validateNodeConfig('wait', {
        duration: 5000,
        timeout: 30000,
        onFailure: 'stop',
      });

      expect(result.valid).toBe(true);
    });

    it('should validate navigate node config (no custom validation)', () => {
      const result = validateNodeConfig('navigate', {
        url: 'https://example.com',
        waitForLoad: true,
        timeout: 30000,
        onFailure: 'stop',
      });

      expect(result.valid).toBe(true);
    });

    it('should validate comment node config with custom validation', () => {
      const result = validateNodeConfig('comment', {
        content: 'This is a comment',
        color: '#fff9c4',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for comment node with empty content', () => {
      const result = validateNodeConfig('comment', {
        content: '',
        color: '#fff9c4',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('注释内容不能为空');
    });

    it('should fail validation for comment node with whitespace-only content', () => {
      const result = validateNodeConfig('comment', {
        content: '   ',
        color: '#fff9c4',
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('注释内容不能为空');
    });

    it('should validate assertExists node config (no custom validation)', () => {
      const result = validateNodeConfig('assertExists', {
        target: '.element',
        state: 'visible',
        negate: false,
        timeout: 30000,
        onFailure: 'stop',
      });

      expect(result.valid).toBe(true);
    });

    it('should validate setVariable node config (no custom validation)', () => {
      const result = validateNodeConfig('setVariable', {
        name: 'myVar',
        value: 'myValue',
        valueType: 'string',
      });

      expect(result.valid).toBe(true);
    });

    it('should validate loop node config (no custom validation)', () => {
      const result = validateNodeConfig('loop', {
        type: 'count',
        count: 5,
        maxIterations: 50,
        timeout: 30000,
        onFailure: 'stop',
      });

      expect(result.valid).toBe(true);
    });

    it('should validate parallel node config (no custom validation)', () => {
      const result = validateNodeConfig('parallel', {
        branches: 3,
        waitAll: true,
        timeout: 30000,
        onFailure: 'stop',
      });

      expect(result.valid).toBe(true);
    });

    it('should validate extractData node config (no custom validation)', () => {
      const result = validateNodeConfig('extractData', {
        target: '.element',
        extractType: 'text',
        variable: 'extracted',
        timeout: 30000,
        onFailure: 'stop',
      });

      expect(result.valid).toBe(true);
    });

    it('should handle empty config for nodes with custom validation', () => {
      const result = validateNodeConfig('comment', {});

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle flow with no edges', () => {
      const flowWithoutEdges: TestFlow = {
        ...mockFlow,
        edges: [],
      };

      const result = validateFlow(flowWithoutEdges);

      // Should be valid but with warnings about isolated nodes
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle flow with only start node', () => {
      const startOnlyFlow: TestFlow = {
        ...mockFlow,
        nodes: [mockNodes[0]],
        edges: [],
      };

      const result = validateFlow(startOnlyFlow);

      // Should be valid (start node without end is ok)
      expect(result.valid).toBe(true);
    });

    it('should handle flow with only special nodes (start, end, comment)', () => {
      const specialOnlyFlow: TestFlow = {
        ...mockFlow,
        nodes: [
          mockNodes[0],
          mockNodes[2],
          {
            id: 'comment-1',
            type: 'comment',
            position: { x: 100, y: 100 },
            data: {
              label: 'Comment',
              description: '',
              config: { content: 'A comment', color: '#fff9c4' },
              errors: [],
              warnings: [],
              editable: true,
              deletable: true,
            },
          },
        ],
        edges: [{ id: 'e1', source: 'start-1', target: 'end-1' }],
      };

      const result = validateFlow(specialOnlyFlow);

      expect(result.valid).toBe(true);
    });

    it('should handle undefined edges gracefully', () => {
      const flowWithUndefinedEdges: TestFlow = {
        ...mockFlow,
        edges: undefined as any,
      };

      const result = validateFlow(flowWithUndefinedEdges);

      // Should still validate nodes even if edges is undefined
      expect(result).toBeDefined();
    });

    it('should handle empty node config', () => {
      const nodeWithEmptyConfig: DesignerNode = {
        id: 'test-node',
        type: 'wait',
        position: { x: 0, y: 0 },
        data: {
          label: 'Wait',
          description: '',
          config: {} as any,
          errors: [],
          warnings: [],
          editable: true,
          deletable: true,
        },
      };

      const errors = validateNode(nodeWithEmptyConfig);

      // flowValidator.validateNode only checks if node has valid ID, type, and definition
      // It doesn't do schema-based validation (that's done by nodeRegistry.validateConfig)
      // Since wait node is a valid type with valid ID, it passes validateNode
      expect(errors).toHaveLength(0);
    });
  });
});
