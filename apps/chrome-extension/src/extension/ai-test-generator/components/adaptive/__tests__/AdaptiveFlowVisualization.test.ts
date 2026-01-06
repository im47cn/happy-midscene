/**
 * Adaptive Flow Visualization Component Tests
 * Tests for flow node conversion and core functions
 */

import { describe, expect, it } from 'vitest';
import {
  type FlowNode,
  type FlowNodeStatus,
  testCaseToFlowNodes,
} from '../AdaptiveFlowVisualization';

describe('testCaseToFlowNodes', () => {
  it('should convert simple test case to flow nodes', () => {
    const testCase = {
      id: 'test-1',
      name: 'Simple Test',
      steps: [
        { id: 'step-1', description: 'Click button' },
        { id: 'step-2', description: 'Input text' },
      ],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].id).toBe('step-1');
    expect(nodes[0].label).toBe('Click button');
    expect(nodes[0].type).toBe('action');
  });

  it('should handle conditional steps', () => {
    const testCase = {
      id: 'test-1',
      name: 'Conditional Test',
      steps: [
        {
          id: 'step-1',
          description: 'Check if logged in',
          condition: { expression: '${loggedIn} === true' },
          thenSteps: [{ id: 'step-2', description: 'Then action' }],
          elseSteps: [{ id: 'step-3', description: 'Else action' }],
        },
      ],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase);
    expect(nodes.length).toBeGreaterThan(0);

    const conditionNode = nodes.find((n) => n.id === 'step-1');
    expect(conditionNode?.type).toBe('condition');

    // Branch children are inside the condition node's children array
    const children = conditionNode?.children || [];
    expect(children).toHaveLength(2);

    const hasThenBranch = children.some((n) => n.branch === 'then');
    const hasElseBranch = children.some((n) => n.branch === 'else');
    expect(hasThenBranch).toBe(true);
    expect(hasElseBranch).toBe(true);
  });

  it('should handle loop steps with body', () => {
    const testCase = {
      id: 'test-1',
      name: 'Loop Test',
      steps: [
        {
          id: 'step-1',
          description: 'Repeat action',
          loop: {
            type: 'count',
            count: 3,
            maxIterations: 3,
            body: [{ id: 'step-2', description: 'Loop body action' }],
          },
        },
      ],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase);
    const loopNode = nodes.find((n) => n.id === 'step-1');
    // Loop is only detected if there's a body
    expect(loopNode?.type).toBe('loop');
  });

  it('should handle steps without loop body as action type', () => {
    const testCase = {
      id: 'test-1',
      name: 'Loop Test',
      steps: [
        {
          id: 'step-1',
          description: 'Repeat action',
          loop: {
            type: 'count',
            count: 3,
            maxIterations: 3,
          },
        },
      ],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase);
    const loopNode = nodes.find((n) => n.id === 'step-1');
    // Without a body, it's treated as an action
    expect(loopNode?.type).toBe('action');
  });

  it('should calculate depth for nested structures', () => {
    const testCase = {
      id: 'test-1',
      name: 'Nested Test',
      steps: [
        {
          id: 'step-1',
          description: 'Outer condition',
          condition: { expression: '${x} === true' },
          thenSteps: [
            {
              id: 'step-2',
              description: 'Inner action',
            },
          ],
        },
      ],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase);
    const conditionNode = nodes.find((n) => n.id === 'step-1');
    // Children have depth set to 1 in the implementation
    const thenChild = conditionNode?.children?.find((n) => n.branch === 'then');
    expect(thenChild?.depth).toBe(1);
  });

  it('should handle empty test case', () => {
    const testCase = {
      id: 'test-1',
      name: 'Empty Test',
      steps: [],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase);
    expect(nodes).toHaveLength(0);
  });

  it('should attach status information from executionResults', () => {
    const testCase = {
      id: 'test-1',
      name: 'Status Test',
      steps: [{ id: 'step-1', description: 'Click button' }],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase, [
      { stepId: 'step-1', success: true },
    ]);

    const stepNode = nodes.find((n) => n.id === 'step-1');
    expect(stepNode?.status).toBe('success');
  });

  it('should handle explicit type in step', () => {
    const testCase = {
      id: 'test-1',
      name: 'Type Test',
      steps: [{ id: 'step-1', description: 'Loop', type: 'loop' }],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase);
    const loopNode = nodes.find((n) => n.id === 'step-1');
    expect(loopNode?.type).toBe('loop');
  });

  it('should create condition node with both then and else children', () => {
    const testCase = {
      id: 'test-1',
      name: 'Condition Test',
      steps: [
        {
          id: 'step-1',
          description: 'Condition',
          condition: { expression: '${x}' },
          thenSteps: [
            { id: 'step-2', description: 'Then action 1' },
            { id: 'step-3', description: 'Then action 2' },
          ],
          elseSteps: [{ id: 'step-4', description: 'Else action' }],
        },
      ],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase);
    const conditionNode = nodes.find((n) => n.id === 'step-1');
    expect(conditionNode?.type).toBe('condition');
    expect(conditionNode?.children).toHaveLength(3); // 2 then + 1 else
  });

  it('should handle only thenSteps without elseSteps', () => {
    const testCase = {
      id: 'test-1',
      name: 'Then Only Test',
      steps: [
        {
          id: 'step-1',
          description: 'Condition',
          condition: { expression: '${x}' },
          thenSteps: [{ id: 'step-2', description: 'Then action' }],
        },
      ],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase);
    const conditionNode = nodes.find((n) => n.id === 'step-1');
    expect(conditionNode?.type).toBe('condition');
    expect(conditionNode?.children).toHaveLength(1);
  });

  it('should use step description as label', () => {
    const testCase = {
      id: 'test-1',
      name: 'Label Test',
      steps: [{ id: 'step-1', description: 'My custom label' }],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase);
    expect(nodes[0].label).toBe('My custom label');
  });

  it('should use step id as fallback label when description is missing', () => {
    const testCase = {
      id: 'test-1',
      name: 'Label Fallback Test',
      steps: [{ id: 'step-1' } as any],
      variables: {},
    };

    const nodes = testCaseToFlowNodes(testCase);
    expect(nodes[0].label).toBe('step-1');
  });
});

describe('FlowNode structure', () => {
  it('should create correct node structure for action', () => {
    const node: FlowNode = {
      id: 'node-1',
      type: 'action',
      status: 'pending',
      label: 'Test action',
    };

    expect(node.id).toBe('node-1');
    expect(node.type).toBe('action');
    expect(node.status).toBe('pending');
    expect(node.label).toBe('Test action');
    expect(node.depth).toBeUndefined(); // depth is optional
  });

  it('should create correct node structure for condition', () => {
    const node: FlowNode = {
      id: 'node-1',
      type: 'condition',
      status: 'pending',
      label: 'Is logged in?',
      children: [
        {
          id: 'node-2',
          type: 'action',
          status: 'pending',
          label: 'Then',
          branch: 'then',
          depth: 1,
        },
        {
          id: 'node-3',
          type: 'action',
          status: 'skipped',
          label: 'Else',
          branch: 'else',
          depth: 1,
        },
      ],
    };

    expect(node.type).toBe('condition');
    expect(node.children).toHaveLength(2);
    expect(node.children?.[0].branch).toBe('then');
    expect(node.children?.[1].branch).toBe('else');
  });

  it('should handle all possible status types', () => {
    const statuses: FlowNodeStatus[] = [
      'pending',
      'running',
      'success',
      'failed',
      'skipped',
    ];

    statuses.forEach((status) => {
      const node: FlowNode = {
        id: `node-${status}`,
        type: 'action',
        status,
        label: `${status} action`,
      };
      expect(node.status).toBe(status);
    });
  });

  it('should handle node with branch property', () => {
    const thenNode: FlowNode = {
      id: 'node-then',
      type: 'action',
      status: 'pending',
      label: 'Then branch',
      branch: 'then',
    };

    const elseNode: FlowNode = {
      id: 'node-else',
      type: 'action',
      status: 'skipped',
      label: 'Else branch',
      branch: 'else',
    };

    expect(thenNode.branch).toBe('then');
    expect(elseNode.branch).toBe('else');
  });

  it('should handle node with iteration count', () => {
    const node: FlowNode = {
      id: 'node-1',
      type: 'action',
      status: 'pending',
      label: 'Loop iteration',
      iteration: 3,
    };

    expect(node.iteration).toBe(3);
  });
});
