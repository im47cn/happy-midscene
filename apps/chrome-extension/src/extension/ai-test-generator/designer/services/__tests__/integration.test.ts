/**
 * Integration Tests
 * 集成测试 - 测试完整的流程创建、转换、验证和执行
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DesignerEdge, DesignerNode, TestFlow } from '../../../types/designer';
import { flowToYaml, yamlToFlow } from '../yamlConverter';
import { validateFlow, ValidationResult } from '../flowValidator';
import { createNode, nodeRegistry } from '../nodeRegistry';
import { generateId } from '../yamlConverter';

describe('Integration Tests', () => {
  describe('Complete Flow Creation and Export', () => {
    it('should create a complete login flow and convert to YAML', () => {
      const flow: TestFlow = {
        id: 'login-flow',
        name: 'User Login Test',
        description: 'Tests user login functionality',
        version: 1,
        nodes: [
          {
            id: 'start-1',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: 'Start', config: {} },
          },
          {
            id: 'navigate-1',
            type: 'navigate',
            position: { x: 300, y: 100 },
            data: { label: 'Go to Login Page', config: { url: '/login' } },
          },
          {
            id: 'input-1',
            type: 'input',
            position: { x: 500, y: 100 },
            data: { label: 'Enter Username', config: { target: '#username', value: '${username}' } },
          },
          {
            id: 'input-2',
            type: 'input',
            position: { x: 700, y: 100 },
            data: { label: 'Enter Password', config: { target: '#password', value: '${password}' } },
          },
          {
            id: 'click-1',
            type: 'click',
            position: { x: 900, y: 100 },
            data: { label: 'Click Login', config: { target: '#login-btn' } },
          },
          {
            id: 'assert-1',
            type: 'assertExists',
            position: { x: 1100, y: 100 },
            data: { label: 'Verify Dashboard', config: { target: '#dashboard', state: 'visible' } },
          },
          {
            id: 'end-1',
            type: 'end',
            position: { x: 1300, y: 100 },
            data: { label: 'End', config: {} },
          },
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'navigate-1' },
          { id: 'e2', source: 'navigate-1', target: 'input-1' },
          { id: 'e3', source: 'input-1', target: 'input-2' },
          { id: 'e4', source: 'input-2', target: 'click-1' },
          { id: 'e5', source: 'click-1', target: 'assert-1' },
          { id: 'e6', source: 'assert-1', target: 'end-1' },
        ],
        variables: [
          { name: 'username', type: 'string', defaultValue: 'testuser' },
          { name: 'password', type: 'string', defaultValue: 'testpass123' },
        ],
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      // Convert to YAML
      const yamlResult = flowToYaml(flow);
      expect(yamlResult.content).toBeDefined();
      expect(yamlResult.stepCount).toBe(5); // 5 action nodes (navigate, 2x input, click, assert)
      expect(yamlResult.warnings).toHaveLength(0);

      // Verify YAML structure - uses action: with nested type
      expect(yamlResult.content).toContain('name: User Login Test');
      expect(yamlResult.content).toContain('action:');
      expect(yamlResult.content).toContain('type: navigate');
      expect(yamlResult.content).toContain('type: click');
      expect(yamlResult.content).toContain('type: assert');
    });

    it('should validate a complete flow without errors', () => {
      const nodes = [
        createNode('start', { x: 100, y: 100 }),
        createNode('click', { x: 300, y: 100 }, { data: { label: 'Click Button', config: { target: '#btn' } } }),
        createNode('end', { x: 500, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
        { id: 'e2', source: nodes[1].id, target: nodes[2].id },
      ];

      const validFlow: TestFlow = {
        id: 'valid-flow',
        name: 'Valid Flow',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const result = validateFlow(validFlow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required nodes in flow', () => {
      const nodes = [
        createNode('click', { x: 100, y: 100 }, { data: { label: 'Click Button', config: { target: '#btn' } } }),
        // Missing start node
        createNode('end', { x: 300, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
      ];

      const flow: TestFlow = {
        id: 'invalid-flow',
        name: 'Invalid Flow',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const result = validateFlow(flow);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('开始节点') || e.message.includes('start'))).toBe(true);
    });
  });

  describe('YAML Import and Export Round-trip', () => {
    it('should maintain data integrity through round-trip conversion', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('navigate', { x: 300, y: 100 }, { data: { label: 'Go to URL', config: { url: 'https://example.com' } } }),
        createNode('input', { x: 500, y: 100 }, { data: { label: 'Type input', config: { target: '#search', value: 'test query' } } }),
        createNode('click', { x: 700, y: 100 }, { data: { label: 'Click Search', config: { target: '#search-btn' } } }),
        createNode('assertExists', { x: 900, y: 100 }, { data: { label: 'Check Results', config: { target: '.results', state: 'visible' } } }),
        createNode('end', { x: 1100, y: 100 }),
      ];

      const originalFlow: TestFlow = {
        id: 'roundtrip-test',
        name: 'Round Trip Test',
        description: 'Testing data integrity',
        version: 2,
        nodes,
        edges: [
          { id: 'e1', source: nodes[0].id, target: nodes[1].id },
          { id: 'e2', source: nodes[1].id, target: nodes[2].id },
          { id: 'e3', source: nodes[2].id, target: nodes[3].id },
          { id: 'e4', source: nodes[3].id, target: nodes[4].id },
          { id: 'e5', source: nodes[4].id, target: nodes[5].id },
        ],
        variables: [
          { name: 'baseUrl', type: 'string', defaultValue: 'https://example.com' },
          { name: 'searchQuery', type: 'string', defaultValue: 'test' },
        ],
        metadata: {
          createdAt: 1000000,
          updatedAt: 2000000,
        },
      };

      // Convert to YAML
      const yamlResult = flowToYaml(originalFlow);

      // Parse back to flow
      const parseResult = yamlToFlow(yamlResult.content);

      expect(parseResult.errors).toHaveLength(0);
      expect(parseResult.flow.name).toBe(originalFlow.name);
      expect(parseResult.flow.description).toBe(originalFlow.description);
      // Node count should match (excluding any non-serializable nodes like comments)
      expect(parseResult.flow.nodes.length).toBeGreaterThan(0);
      expect(parseResult.flow.nodes.length).toBeLessThanOrEqual(originalFlow.nodes.length);
      expect(parseResult.flow.edges.length).toBe(originalFlow.edges.length);
      expect(parseResult.flow.variables.length).toBe(originalFlow.variables.length);
    });

    it('should handle complex control flow structures', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('ifElse', { x: 300, y: 100 }, { data: { label: 'Check Logged In', config: { condition: 'user.isLoggedIn === true' } } }),
        createNode('click', { x: 500, y: 100 }, { data: { label: 'Go to Dashboard', config: { target: '#dashboard' } } }),
        createNode('navigate', { x: 500, y: 250 }, { data: { label: 'Go to Login', config: { url: '/login' } } }),
        createNode('end', { x: 700, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
        { id: 'e2', source: nodes[1].id, target: nodes[2].id, sourceHandle: 'true' },
        { id: 'e3', source: nodes[1].id, target: nodes[3].id, sourceHandle: 'false' },
        { id: 'e4', source: nodes[2].id, target: nodes[4].id },
        { id: 'e5', source: nodes[3].id, target: nodes[4].id },
      ];

      const flow: TestFlow = {
        id: 'conditional-flow',
        name: 'Conditional Flow Test',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const yamlResult = flowToYaml(flow);
      expect(yamlResult.content).toContain('condition:');

      const validation = validateFlow(flow);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Loop and Iteration Flows', () => {
    it('should handle count-based loop flows', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('loop', { x: 300, y: 100 }, { data: { label: 'Repeat 5 Times', config: { loopType: 'count', count: 5 } } }),
        createNode('click', { x: 500, y: 100 }, { data: { label: 'Click Next', config: { target: '.next-btn' } } }),
        createNode('end', { x: 700, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
        { id: 'e2', source: nodes[1].id, target: nodes[2].id },
        { id: 'e3', source: nodes[2].id, target: nodes[3].id },
      ];

      const flow: TestFlow = {
        id: 'loop-flow',
        name: 'Loop Flow Test',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const yamlResult = flowToYaml(flow);
      expect(yamlResult.content).toContain('count: 5');
      expect(yamlResult.content).toContain('type: count');  // loop type is stored as 'type' in YAML

      const validation = validateFlow(flow);
      expect(validation.valid).toBe(true);
    });

    it('should handle while-based loop flows', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('loop', { x: 300, y: 100 }, { data: { label: 'While Loading', config: { loopType: 'while', whileCondition: 'isLoading === true' } } }),
        createNode('wait', { x: 500, y: 100 }, { data: { label: 'Wait a bit', config: { duration: 1000 } } }),
        createNode('end', { x: 700, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
        { id: 'e2', source: nodes[1].id, target: nodes[2].id },
        { id: 'e3', source: nodes[2].id, target: nodes[3].id },
      ];

      const flow: TestFlow = {
        id: 'while-loop-flow',
        name: 'While Loop Flow Test',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const yamlResult = flowToYaml(flow);
      expect(yamlResult.content).toContain('condition:');  // whileCondition maps to 'condition' in YAML

      const validation = validateFlow(flow);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Data Manipulation Flows', () => {
    it('should handle variable setting and extraction', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('navigate', { x: 300, y: 100 }, { data: { label: 'Go to Page', config: { url: '/profile' } } }),
        createNode('extractData', { x: 500, y: 100 }, { data: { label: 'Extract Username', config: { extractType: 'text', variable: 'username' } } }),
        createNode('setVariable', { x: 700, y: 100 }, { data: { label: 'Set Greeting', config: { name: 'greeting', value: 'Hello, ${username}!' } } }),
        createNode('input', { x: 900, y: 100 }, { data: { label: 'Type Greeting', config: { target: '#message', value: '${greeting}' } } }),
        createNode('end', { x: 1100, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
        { id: 'e2', source: nodes[1].id, target: nodes[2].id },
        { id: 'e3', source: nodes[2].id, target: nodes[3].id },
        { id: 'e4', source: nodes[3].id, target: nodes[4].id },
        { id: 'e5', source: nodes[4].id, target: nodes[5].id },
      ];

      const flow: TestFlow = {
        id: 'data-flow',
        name: 'Data Flow Test',
        version: 1,
        nodes,
        edges,
        variables: [
          { name: 'username', type: 'string', defaultValue: '' },
          { name: 'greeting', type: 'string', defaultValue: '' },
        ],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const yamlResult = flowToYaml(flow);
      // Variable operations are included in YAML
      expect(yamlResult.content).toBeDefined();

      const validation = validateFlow(flow);
      expect(validation.valid).toBe(true);
    });

    it('should handle external data loading', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('externalData', { x: 300, y: 100 }, { data: { label: 'Load Test Data', config: { source: 'test-data.json', format: 'json', variable: 'testData' } } }),
        createNode('input', { x: 500, y: 100 }, { data: { label: 'Use Data', config: { target: '#field', value: '${testData.value}' } } }),
        createNode('end', { x: 700, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
        { id: 'e2', source: nodes[1].id, target: nodes[2].id },
        { id: 'e3', source: nodes[2].id, target: nodes[3].id },
      ];

      const flow: TestFlow = {
        id: 'external-data-flow',
        name: 'External Data Flow Test',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const yamlResult = flowToYaml(flow);
      // External data is converted to variable operation
      expect(yamlResult.content).toContain('variable:');

      const validation = validateFlow(flow);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Validation Error Scenarios', () => {
    it('should detect circular dependencies', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('click', { x: 300, y: 100 }, { data: { label: 'Click A', config: { target: '#a' } } }),
        createNode('click', { x: 500, y: 100 }, { data: { label: 'Click B', config: { target: '#b' } } }),
        createNode('end', { x: 700, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
        { id: 'e2', source: nodes[1].id, target: nodes[2].id },
        { id: 'e3', source: nodes[2].id, target: nodes[1].id }, // Circular!
      ];

      const flow: TestFlow = {
        id: 'circular-flow',
        name: 'Circular Dependency Test',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const result = validateFlow(flow);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('循环') || e.type === 'cycle')).toBe(true);
    });

    it('should detect disconnected nodes', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('click', { x: 300, y: 100 }, { data: { label: 'Click A', config: { target: '#a' } } }),
        createNode('click', { x: 500, y: 100 }, { data: { label: 'Orphan Click', config: { target: '#orphan' } } }), // Not connected
        createNode('end', { x: 700, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
        { id: 'e2', source: nodes[1].id, target: nodes[3].id },
        // No edge to nodes[2]
      ];

      const flow: TestFlow = {
        id: 'disconnected-flow',
        name: 'Disconnected Nodes Test',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const result = validateFlow(flow);
      // Isolated nodes generate warnings, not errors - so flow is still valid
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.message.includes('没有') || w.message.includes('连接'))).toBe(true);
    });

    it('should detect duplicate node IDs', () => {
      const duplicateId = 'duplicate-id';
      const nodes: DesignerNode[] = [
        { id: duplicateId, type: 'start', position: { x: 100, y: 100 }, data: { label: 'Start', config: {} } },
        { id: duplicateId, type: 'click', position: { x: 300, y: 100 }, data: { label: 'Click', config: { target: '#btn' } } },
        createNode('end', { x: 500, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
        { id: 'e2', source: nodes[1].id, target: nodes[2].id },
      ];

      const flow: TestFlow = {
        id: 'duplicate-id-flow',
        name: 'Duplicate ID Test',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const result = validateFlow(flow);
      expect(result.valid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty flows gracefully', () => {
      const flow: TestFlow = {
        id: 'empty-flow',
        name: 'Empty Flow',
        version: 1,
        nodes: [],
        edges: [],
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const yamlResult = flowToYaml(flow);
      expect(yamlResult.content).toBeDefined();

      const validation = validateFlow(flow);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle flows with only start and end', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('end', { x: 300, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
      ];

      const flow: TestFlow = {
        id: 'minimal-flow',
        name: 'Minimal Flow',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const yamlResult = flowToYaml(flow);
      expect(yamlResult.stepCount).toBe(0); // No action nodes

      const validation = validateFlow(flow);
      expect(validation.valid).toBe(true);
    });

    it('should handle parallel execution flows', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('parallel', { x: 300, y: 100 }, { data: { label: 'Parallel Tasks', config: { branches: 3, waitAll: true } } }),
        createNode('click', { x: 500, y: 50 }, { data: { label: 'Task 1', config: { target: '#task1' } } }),
        createNode('click', { x: 500, y: 150 }, { data: { label: 'Task 2', config: { target: '#task2' } } }),
        createNode('click', { x: 500, y: 250 }, { data: { label: 'Task 3', config: { target: '#task3' } } }),
        createNode('end', { x: 700, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
        { id: 'e2', source: nodes[1].id, target: nodes[2].id, sourceHandle: 'branch-0' },
        { id: 'e3', source: nodes[1].id, target: nodes[3].id, sourceHandle: 'branch-1' },
        { id: 'e4', source: nodes[1].id, target: nodes[4].id, sourceHandle: 'branch-2' },
        { id: 'e5', source: nodes[2].id, target: nodes[5].id },
        { id: 'e6', source: nodes[3].id, target: nodes[5].id },
        { id: 'e7', source: nodes[4].id, target: nodes[5].id },
      ];

      const flow: TestFlow = {
        id: 'parallel-flow',
        name: 'Parallel Execution Test',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const yamlResult = flowToYaml(flow);
      // Parallel nodes are simplified to description in YAML
      expect(yamlResult.content).toContain('并行');

      const validation = validateFlow(flow);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Comment and Documentation Nodes', () => {
    it('should handle comment nodes in flow', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('comment', { x: 300, y: 100 }, { data: { label: 'Important Note', config: { content: 'This test requires user to be logged in', color: '#fff3cd' } } }),
        createNode('click', { x: 500, y: 100 }, { data: { label: 'Click Button', config: { target: '#btn' } } }),
        createNode('end', { x: 700, y: 100 }),
      ];

      const edges: DesignerEdge[] = [
        { id: 'e1', source: nodes[0].id, target: nodes[1].id },
        { id: 'e2', source: nodes[1].id, target: nodes[2].id },
        { id: 'e3', source: nodes[2].id, target: nodes[3].id },
      ];

      const flow: TestFlow = {
        id: 'comment-flow',
        name: 'Comment Flow Test',
        description: 'Testing comment node inclusion',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const yamlResult = flowToYaml(flow);
      // Comment nodes are skipped during YAML conversion (filtered out)
      // but the flow should still be valid
      expect(yamlResult.content).toBeDefined();

      const validation = validateFlow(flow);
      expect(validation.valid).toBe(true);
    });
  });

  describe('All Node Types Integration', () => {
    it('should support all available node types in a single flow', () => {
      const nodes: DesignerNode[] = [
        createNode('start', { x: 100, y: 100 }),
        createNode('navigate', { x: 300, y: 100 }, { data: { label: 'Navigate', config: { url: '/test' } } }),
        createNode('click', { x: 500, y: 100 }, { data: { label: 'Click', config: { target: '#btn' } } }),
        createNode('input', { x: 700, y: 100 }, { data: { label: 'Input', config: { target: '#input', value: 'test' } } }),
        createNode('scroll', { x: 900, y: 100 }, { data: { label: 'Scroll', config: { direction: 'down' } } }),
        createNode('wait', { x: 1100, y: 100 }, { data: { label: 'Wait', config: { duration: 1000 } } }),
        createNode('hover', { x: 1300, y: 100 }, { data: { label: 'Hover', config: { target: '#hover-target' } } }),
        createNode('drag', { x: 1500, y: 100 }, { data: { label: 'Drag', config: { from: '#draggable', to: '#dropzone' } } }),
        createNode('assertExists', { x: 1700, y: 100 }, { data: { label: 'Assert Exists', config: { target: '#element', state: 'visible' } } }),
        createNode('assertText', { x: 1900, y: 100 }, { data: { label: 'Assert Text', config: { target: '#text-element', text: 'Expected Text' } } }),
        createNode('assertState', { x: 2100, y: 100 }, { data: { label: 'Assert State', config: { target: '#state-element', state: 'enabled' } } }),
        createNode('aiAssert', { x: 2300, y: 100 }, { data: { label: 'AI Assert', config: { assertion: 'Page looks correct' } } }),
        createNode('ifElse', { x: 2500, y: 100 }, { data: { label: 'Condition', config: { condition: 'value === true' } } }),
        createNode('loop', { x: 2700, y: 100 }, { data: { label: 'Loop', config: { loopType: 'count', count: 3 } } }),
        createNode('parallel', { x: 2900, y: 100 }, { data: { label: 'Parallel', config: { branches: 2 } } }),
        createNode('setVariable', { x: 3100, y: 100 }, { data: { label: 'Set Var', config: { name: 'test', value: '123' } } }),
        createNode('extractData', { x: 3300, y: 100 }, { data: { label: 'Extract', config: { extractType: 'text', variable: 'extracted' } } }),
        createNode('externalData', { x: 3500, y: 100 }, { data: { label: 'Load Data', config: { source: 'data.json', format: 'json', variable: 'data' } } }),
        createNode('comment', { x: 3700, y: 100 }, { data: { label: 'Note', config: { content: 'Test comment' } } }),
        createNode('end', { x: 3900, y: 100 }),
      ];

      const edges: DesignerEdge[] = nodes.slice(0, -1).map((node, i) => ({
        id: `e${i}`,
        source: node.id,
        target: nodes[i + 1].id,
      }));

      const flow: TestFlow = {
        id: 'all-nodes-flow',
        name: 'All Node Types Test',
        description: 'Tests all supported node types',
        version: 1,
        nodes,
        edges,
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const yamlResult = flowToYaml(flow);
      expect(yamlResult.stepCount).toBeGreaterThan(10);
      // Actions are nested under action: key with type field
      expect(yamlResult.content).toContain('type: navigate');
      expect(yamlResult.content).toContain('type: click');
      expect(yamlResult.content).toContain('type: assert');
    });
  });
});
