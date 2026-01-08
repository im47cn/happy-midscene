/**
 * YAML Converter Service Tests
 * YAML 转换服务测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { DesignerEdge, DesignerNode, TestFlow } from '../../../types/designer';
import {
  flowToYaml,
  yamlToFlow,
  exportYaml,
  importYaml,
  getYamlPreview,
  type ConversionResult,
  type ParseResult,
} from '../yamlConverter';

describe('YAML Converter', () => {
  let mockFlow: TestFlow;

  beforeEach(() => {
    mockFlow = {
      id: 'test-flow-1',
      name: 'Test Login Flow',
      description: 'A simple login test',
      version: 1,
      nodes: [
        {
          id: 'start-1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start', config: {} },
        },
        {
          id: 'click-1',
          type: 'click',
          position: { x: 300, y: 100 },
          data: { label: 'Click Login Button', config: { target: '#login-btn' } },
        },
        {
          id: 'input-1',
          type: 'input',
          position: { x: 500, y: 100 },
          data: { label: 'Input Username', config: { target: '#username', value: 'testuser' } },
        },
        {
          id: 'end-1',
          type: 'end',
          position: { x: 700, y: 100 },
          data: { label: 'End', config: {} },
        },
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'click-1' },
        { id: 'e2', source: 'click-1', target: 'input-1' },
        { id: 'e3', source: 'input-1', target: 'end-1' },
      ],
      variables: [
        { name: 'username', type: 'string', defaultValue: 'testuser' },
        { name: 'password', type: 'string', defaultValue: 'testpass' },
      ],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  });

  describe('flowToYaml', () => {
    it('should convert flow to YAML', () => {
      const result = flowToYaml(mockFlow);

      expect(result.content).toBeDefined();
      expect(result.content).toContain('name: Test Login Flow');
      expect(result.stepCount).toBeGreaterThan(0);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should handle empty flow', () => {
      const result = flowToYaml({} as TestFlow);

      expect(result.content).toBe('');
      expect(result.stepCount).toBe(0);
      expect(result.warnings).toContain('流程为空');
    });

    it('should handle flow with no nodes', () => {
      const result = flowToYaml({
        id: 'test',
        name: 'Test',
        nodes: [],
        edges: [],
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      } as TestFlow);

      expect(result.content).toBe('');
      expect(result.warnings).toContain('流程为空');
    });

    it('should include metadata when enabled', () => {
      const result = flowToYaml(mockFlow, { includeMetadata: true });

      expect(result.content).toContain('createdAt:');
      expect(result.content).toContain('updatedAt:');
    });

    it('should exclude metadata when disabled', () => {
      const result = flowToYaml(mockFlow, { includeMetadata: false });

      expect(result.content).not.toContain('createdAt:');
      expect(result.content).not.toContain('updatedAt:');
    });

    it('should respect custom indent', () => {
      const result2 = flowToYaml(mockFlow, { indent: 4 });
      const result4 = flowToYaml(mockFlow, { indent: 4 });

      expect(result4.content).toBeDefined();
      expect(result2.content).toBeDefined();
    });

    it('should sort nodes when enabled', () => {
      const result = flowToYaml(mockFlow, { sortNodes: true });

      expect(result.content).toBeDefined();
      expect(result.stepCount).toBeGreaterThan(0);
    });

    it('should convert click node correctly', () => {
      const result = flowToYaml(mockFlow);

      expect(result.content).toContain('click');
      expect(result.content).toContain('#login-btn');
    });

    it('should convert input node correctly', () => {
      const result = flowToYaml(mockFlow);

      expect(result.content).toContain('input');
      expect(result.content).toContain('#username');
      expect(result.content).toContain('testuser');
    });

    it('should include variables in YAML', () => {
      const result = flowToYaml(mockFlow);

      expect(result.content).toContain('variables:');
      expect(result.content).toContain('username:');
      expect(result.content).toContain('password:');
    });

    it('should warn when no start node found', () => {
      const flowWithoutStart: TestFlow = {
        ...mockFlow,
        nodes: mockFlow.nodes.filter((n) => n.type !== 'start'),
      };

      const result = flowToYaml(flowWithoutStart);

      expect(result.warnings).toContain('未找到开始节点');
    });

    it('should handle complex node types', () => {
      const complexFlow: TestFlow = {
        ...mockFlow,
        nodes: [
          mockFlow.nodes[0],
          {
            id: 'wait-1',
            type: 'wait',
            position: { x: 300, y: 100 },
            data: { label: 'Wait', config: { duration: 1000 } },
          },
          mockFlow.nodes[3],
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'wait-1' },
          { id: 'e2', source: 'wait-1', target: 'end-1' },
        ],
      };

      const result = flowToYaml(complexFlow);

      expect(result.content).toContain('wait');
    });

    it('should handle assert nodes', () => {
      const assertFlow: TestFlow = {
        ...mockFlow,
        nodes: [
          mockFlow.nodes[0],
          {
            id: 'assert-1',
            type: 'assertExists',
            position: { x: 300, y: 100 },
            data: { label: 'Assert Exists', config: { target: '#header', shouldExist: true } },
          },
          mockFlow.nodes[3],
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'assert-1' },
          { id: 'e2', source: 'assert-1', target: 'end-1' },
        ],
      };

      const result = flowToYaml(assertFlow);

      expect(result.content).toContain('assert');
    });

    it('should handle navigate nodes', () => {
      const navigateFlow: TestFlow = {
        ...mockFlow,
        nodes: [
          mockFlow.nodes[0],
          {
            id: 'navigate-1',
            type: 'navigate',
            position: { x: 300, y: 100 },
            data: { label: 'Navigate', config: { url: 'https://example.com' } },
          },
          mockFlow.nodes[3],
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'navigate-1' },
          { id: 'e2', source: 'navigate-1', target: 'end-1' },
        ],
      };

      const result = flowToYaml(navigateFlow);

      expect(result.content).toContain('navigate');
      expect(result.content).toContain('https://example.com');
    });
  });

  describe('yamlToFlow', () => {
    const validYaml = `
name: Test Flow
description: A test flow
steps:
  - id: step1
    type: action
    description: Click button
    action:
      type: click
      target: "#submit"
  - id: step2
    type: action
    description: Input text
    action:
      type: input
      target: "#input"
      value: "test value"
variables:
  username: testuser
  count: 42
`;

    it('should parse valid YAML to flow', () => {
      const result = yamlToFlow(validYaml);

      expect(result.errors).toEqual([]);
      expect(result.flow).toBeDefined();
      expect(result.flow.name).toBe('Test Flow');
      expect(result.flow.nodes.length).toBeGreaterThan(0);
    });

    it('should handle empty YAML', () => {
      const result = yamlToFlow('');

      expect(result.flow).toBeDefined();
      expect(result.errors).toContain('YAML 内容为空');
    });

    it('should handle invalid YAML', () => {
      const result = yamlToFlow('invalid: yaml: content: [');

      expect(result.flow).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('YAML 解析错误');
    });

    it('should create start and end nodes', () => {
      const result = yamlToFlow(validYaml);

      const startNodes = result.flow.nodes.filter((n) => n.type === 'start');
      const endNodes = result.flow.nodes.filter((n) => n.type === 'end');

      expect(startNodes.length).toBe(1);
      expect(endNodes.length).toBe(1);
    });

    it('should create edges between nodes', () => {
      const result = yamlToFlow(validYaml);

      expect(result.flow.edges.length).toBeGreaterThan(0);
    });

    it('should parse variables correctly', () => {
      const result = yamlToFlow(validYaml);

      expect(result.flow.variables.length).toBe(2);
      expect(result.flow.variables[0].name).toBe('username');
      expect(result.flow.variables[1].name).toBe('count');
      expect(result.flow.variables[1].type).toBe('number');
    });

    it('should detect variable types correctly', () => {
      const yamlWithTypes = `
name: Test
variables:
  stringVar: text
  numberVar: 42
  boolVar: true
  arrayVar:
    - a
    - b
  objectVar:
    key: value
steps: []
`;

      const result = yamlToFlow(yamlWithTypes);

      expect(result.flow.variables[0].type).toBe('string');
      expect(result.flow.variables[1].type).toBe('number');
      expect(result.flow.variables[2].type).toBe('boolean');
      expect(result.flow.variables[3].type).toBe('array');
      expect(result.flow.variables[4].type).toBe('object');
    });

    it('should handle click action steps', () => {
      const yaml = `
name: Test
steps:
  - type: action
    action:
      type: click
      target: "#button"
`;

      const result = yamlToFlow(yaml);

      const clickNode = result.flow.nodes.find((n) => n.type === 'click');
      expect(clickNode).toBeDefined();
      expect(clickNode?.data.config?.target).toBe('#button');
    });

    it('should handle input action steps', () => {
      const yaml = `
name: Test
steps:
  - type: action
    action:
      type: input
      target: "#input"
      value: "test"
`;

      const result = yamlToFlow(yaml);

      const inputNode = result.flow.nodes.find((n) => n.type === 'input');
      expect(inputNode).toBeDefined();
      expect(inputNode?.data.config?.target).toBe('#input');
      expect(inputNode?.data.config?.value).toBe('test');
    });

    it('should handle wait action steps', () => {
      const yaml = `
name: Test
steps:
  - type: action
    action:
      type: wait
      value: "5000"
`;

      const result = yamlToFlow(yaml);

      const waitNode = result.flow.nodes.find((n) => n.type === 'wait');
      expect(waitNode).toBeDefined();
      expect(waitNode?.data.config?.duration).toBe(5000);
    });

    it('should handle assert action steps', () => {
      const yaml = `
name: Test
steps:
  - type: action
    action:
      type: assert
      target: "#element"
      value: exists
`;

      const result = yamlToFlow(yaml);

      const assertNode = result.flow.nodes.find((n) => n.type === 'assertExists');
      expect(assertNode).toBeDefined();
      expect(assertNode?.data.config?.target).toBe('#element');
    });

    it('should handle AI assert steps', () => {
      const yaml = `
name: Test
steps:
  - type: action
    action:
      type: assert
      target: "Header should be visible"
      value: ai
`;

      const result = yamlToFlow(yaml);

      const aiAssertNode = result.flow.nodes.find((n) => n.type === 'aiAssert');
      expect(aiAssertNode).toBeDefined();
      expect(aiAssertNode?.data.config?.assertion).toBe('Header should be visible');
    });

    it('should use provided flow name', () => {
      const result = yamlToFlow(validYaml, 'Custom Flow Name');

      expect(result.flow.name).toBe('Custom Flow Name');
    });

    it('should handle nested condition steps', () => {
      const yamlWithCondition = `
name: Test
steps:
  - type: condition
    condition:
      expression: "true"
      thenSteps:
        - type: action
          action:
            type: click
            target: "#button"
      elseSteps:
        - type: action
          action:
            type: click
            target: "#other"
`;

      const result = yamlToFlow(yamlWithCondition);

      const ifNode = result.flow.nodes.find((n) => n.type === 'ifElse');
      expect(ifNode).toBeDefined();
      expect(ifNode?.data.config?.condition).toBe('true');
    });

    it('should handle nested loop steps', () => {
      const yamlWithLoop = `
name: Test
steps:
  - type: loop
    loop:
      type: count
      count: 5
      body:
        - type: action
          action:
            type: click
            target: "#button"
`;

      const result = yamlToFlow(yamlWithLoop);

      const loopNode = result.flow.nodes.find((n) => n.type === 'loop');
      expect(loopNode).toBeDefined();
      expect(loopNode?.data.config?.loopType).toBe('count');
      expect(loopNode?.data.config?.count).toBe(5);
    });

    it('should handle variable operation steps', () => {
      const yamlWithVariable = `
name: Test
steps:
  - type: variable
    variable:
      operation: set
      name: myVar
      value: "value"
`;

      const result = yamlToFlow(yamlWithVariable);

      const varNode = result.flow.nodes.find((n) => n.type === 'setVariable');
      expect(varNode).toBeDefined();
      expect(varNode?.data.config?.name).toBe('myVar');
      expect(varNode?.data.config?.value).toBe('value');
    });

    it('should preserve metadata from YAML', () => {
      const yamlWithMetadata = `
name: Test
createdAt: 1234567890
updatedAt: 1234567890
steps: []
`;

      const result = yamlToFlow(yamlWithMetadata);

      expect(result.flow.metadata.createdAt).toBe(1234567890);
      expect(result.flow.metadata.updatedAt).toBe(1234567890);
    });

    it('should create metadata when not present in YAML', () => {
      const result = yamlToFlow(validYaml);

      expect(result.flow.metadata.createdAt).toBeDefined();
      expect(result.flow.metadata.updatedAt).toBeDefined();
    });
  });

  describe('exportYaml', () => {
    it('should add header comments to exported YAML', () => {
      const result = exportYaml(mockFlow);

      expect(result).toContain('# Test Login Flow');
      expect(result).toContain('# Generated at:');
      expect(result).toContain('name: Test Login Flow');
    });

    it('should include description in header', () => {
      const result = exportYaml(mockFlow);

      expect(result).toContain('# A simple login test');
    });

    it('should handle flow without description', () => {
      const flowWithoutDesc = { ...mockFlow, description: undefined };
      const result = exportYaml(flowWithoutDesc);

      expect(result).toContain('# Auto-generated by Visual Designer');
    });

    it('should use custom indent options', () => {
      const result = exportYaml(mockFlow, { indent: 4 });

      expect(result).toContain('# Test Login Flow');
      expect(result).toBeDefined();
    });
  });

  describe('importYaml', () => {
    it('should import valid YAML and return flow', () => {
      const validYaml = `
name: Test Flow
steps:
  - type: action
    action:
      type: click
      target: "#button"
`;

      const flow = importYaml(validYaml);

      expect(flow).toBeDefined();
      expect(flow?.name).toBe('Test Flow');
    });

    it('should return null for invalid YAML', () => {
      const flow = importYaml('invalid: yaml: content: [');

      expect(flow).toBeNull();
    });

    it('should use provided flow name', () => {
      const validYaml = `
name: Original Name
steps: []
`;

      const flow = importYaml(validYaml, 'New Name');

      expect(flow?.name).toBe('New Name');
    });
  });

  describe('getYamlPreview', () => {
    it('should return preview with default line count', () => {
      const preview = getYamlPreview(mockFlow);

      const lines = preview.split('\n');
      expect(lines.length).toBeLessThanOrEqual(21); // 20 + '...'
    });

    it('should return preview with custom line count', () => {
      const preview = getYamlPreview(mockFlow, 5);

      const lines = preview.split('\n');
      expect(lines.length).toBeLessThanOrEqual(6); // 5 + '...'
    });

    it('should add ellipsis for long content', () => {
      const preview = getYamlPreview(mockFlow, 2);

      expect(preview).toContain('\n...');
    });

    it('should not add ellipsis for short content', () => {
      const shortFlow: TestFlow = {
        id: 'short',
        name: 'Short',
        nodes: [mockFlow.nodes[0], mockFlow.nodes[3]],
        edges: [{ id: 'e1', source: 'start-1', target: 'end-1' }],
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const preview = getYamlPreview(shortFlow, 50);

      expect(preview).not.toContain('\n...');
    });

    it('should include flow name in preview', () => {
      const preview = getYamlPreview(mockFlow);

      expect(preview).toContain('Test Login Flow');
    });
  });

  describe('Round-trip conversion', () => {
    it('should maintain flow integrity through conversion cycle', () => {
      // Convert flow to YAML
      const yamlResult = flowToYaml(mockFlow);

      // Convert back to flow
      const parseResult = yamlToFlow(yamlResult.content);

      // Check basic properties are preserved
      expect(parseResult.flow.name).toBe(mockFlow.name);
      expect(parseResult.flow.description).toBe(mockFlow.description);
      expect(parseResult.errors).toEqual([]);
    });

    it('should handle all action types in round-trip', () => {
      const allActionsFlow: TestFlow = {
        id: 'all-actions',
        name: 'All Actions Test',
        description: 'Test all action types',
        version: 1,
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: 'Start', config: {} },
          },
          {
            id: 'click',
            type: 'click',
            position: { x: 200, y: 100 },
            data: { label: 'Click', config: { target: '#btn' } },
          },
          {
            id: 'input',
            type: 'input',
            position: { x: 300, y: 100 },
            data: { label: 'Input', config: { target: '#inp', value: 'val' } },
          },
          {
            id: 'scroll',
            type: 'scroll',
            position: { x: 400, y: 100 },
            data: { label: 'Scroll', config: { direction: 'down' } },
          },
          {
            id: 'wait',
            type: 'wait',
            position: { x: 500, y: 100 },
            data: { label: 'Wait', config: { duration: 1000 } },
          },
          {
            id: 'navigate',
            type: 'navigate',
            position: { x: 600, y: 100 },
            data: { label: 'Navigate', config: { url: 'https://test.com' } },
          },
          {
            id: 'hover',
            type: 'hover',
            position: { x: 700, y: 100 },
            data: { label: 'Hover', config: { target: '#hover' } },
          },
          {
            id: 'end',
            type: 'end',
            position: { x: 800, y: 100 },
            data: { label: 'End', config: {} },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'click' },
          { id: 'e2', source: 'click', target: 'input' },
          { id: 'e3', source: 'input', target: 'scroll' },
          { id: 'e4', source: 'scroll', target: 'wait' },
          { id: 'e5', source: 'wait', target: 'navigate' },
          { id: 'e6', source: 'navigate', target: 'hover' },
          { id: 'e7', source: 'hover', target: 'end' },
        ],
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const yamlResult = flowToYaml(allActionsFlow);
      expect(yamlResult.stepCount).toBeGreaterThan(0);

      const parseResult = yamlToFlow(yamlResult.content);
      expect(parseResult.errors).toEqual([]);
      expect(parseResult.flow.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle flow with disconnected nodes', () => {
      const disconnectedFlow: TestFlow = {
        ...mockFlow,
        nodes: [
          ...mockFlow.nodes,
          {
            id: 'isolated',
            type: 'click',
            position: { x: 900, y: 900 },
            data: { label: 'Isolated', config: { target: '#isolated' } },
          },
        ],
      };

      const result = flowToYaml(disconnectedFlow);
      expect(result.content).toBeDefined();
    });

    it('should handle flow with circular dependencies', () => {
      const circularFlow: TestFlow = {
        ...mockFlow,
        edges: [
          ...mockFlow.edges,
          { id: 'e-back', source: 'input-1', target: 'start-1' }, // Back edge
        ],
      };

      const result = flowToYaml(circularFlow);
      expect(result.content).toBeDefined();
      // Should handle cycles by depth limiting
      expect(result.warnings).toBeDefined();
    });

    it('should handle flow with complex branching', () => {
      const branchingFlow: TestFlow = {
        id: 'branching',
        name: 'Branching Flow',
        description: 'Test branching logic',
        version: 1,
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: 'Start', config: {} },
          },
          {
            id: 'ifelse',
            type: 'ifElse',
            position: { x: 300, y: 100 },
            data: { label: 'Check Condition', config: { condition: 'true' } },
          },
          {
            id: 'then',
            type: 'click',
            position: { x: 500, y: 50 },
            data: { label: 'Then Action', config: { target: '#then' } },
          },
          {
            id: 'else',
            type: 'click',
            position: { x: 500, y: 150 },
            data: { label: 'Else Action', config: { target: '#else' } },
          },
          {
            id: 'end',
            type: 'end',
            position: { x: 700, y: 100 },
            data: { label: 'End', config: {} },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'ifelse' },
          { id: 'e2', source: 'ifelse', target: 'then', sourceHandle: 'true' },
          { id: 'e3', source: 'ifelse', target: 'else', sourceHandle: 'false' },
          { id: 'e4', source: 'then', target: 'end' },
          { id: 'e5', source: 'else', target: 'end' },
        ],
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const result = flowToYaml(branchingFlow);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('condition');
    });

    it('should handle flow with loop', () => {
      const loopFlow: TestFlow = {
        id: 'loop',
        name: 'Loop Flow',
        description: 'Test loop',
        version: 1,
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: 'Start', config: {} },
          },
          {
            id: 'loop',
            type: 'loop',
            position: { x: 300, y: 100 },
            data: { label: 'Loop', config: { loopType: 'count', count: 3 } },
          },
          {
            id: 'action',
            type: 'click',
            position: { x: 500, y: 100 },
            data: { label: 'Loop Action', config: { target: '#btn' } },
          },
          {
            id: 'end',
            type: 'end',
            position: { x: 700, y: 100 },
            data: { label: 'End', config: {} },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'loop' },
          { id: 'e2', source: 'loop', target: 'action', sourceHandle: 'body' },
          { id: 'e3', source: 'action', target: 'end' },
        ],
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const result = flowToYaml(loopFlow);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('loop');
    });

    it('should handle YAML with unicode content', () => {
      const unicodeYaml = `
name: 测试流程
description: 这是一个测试
steps:
  - type: action
    description: 点击按钮 🖱️
    action:
      type: click
      target: "#按钮"
`;

      const result = yamlToFlow(unicodeYaml);
      expect(result.errors).toEqual([]);
      expect(result.flow.name).toBe('测试流程');
    });

    it('should handle very long descriptions', () => {
      const longDesc = 'A'.repeat(1000);
      const longFlow: TestFlow = {
        ...mockFlow,
        description: longDesc,
      };

      const result = flowToYaml(longFlow);
      expect(result.content).toContain(longDesc);
    });
  });
});
