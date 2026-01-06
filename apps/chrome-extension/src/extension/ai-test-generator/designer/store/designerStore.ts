/**
 * Designer Store
 * 可视化测试设计器状态管理 - Zustand Store
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  DesignerActions,
  DesignerEdge,
  DesignerNode,
  DesignerState,
  TestFlow,
  ValidationResult,
} from '../../types/designer';
import { generateId } from '../services/nodeRegistry';

/**
 * 创建空流程
 */
function createEmptyFlow(name: string): TestFlow {
  return {
    id: generateId('flow'),
    name,
    description: '',
    version: 1,
    nodes: [],
    edges: [],
    variables: [],
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}

/**
 * 创建初始状态
 */
function createInitialState(): DesignerState {
  return {
    flow: null,
    selectedNodes: [],
    selectedEdges: [],
    clipboard: null,
    history: {
      past: [],
      present: null,
      future: [],
    },
    validationResult: null,
    isLoading: false,
    error: null,
    zoom: 1,
    viewport: { x: 0, y: 0 },
    showMinimap: true,
    showGrid: true,
  };
}

/**
 * Designer Store
 */
export interface DesignerStore extends DesignerState, DesignerActions {}

export const useDesignerStore = create<DesignerStore>()(
  devtools(
    (set, get) => ({
      // 初始状态
      ...createInitialState(),

      // 流程操作
      setFlow: (flow) => {
        set((state) => ({
          flow,
          history: {
            past: [],
            present: flow,
            future: [],
          },
          validationResult: null,
        }));
      },

      createFlow: (name) => {
        const newFlow = createEmptyFlow(name);
        get().setFlow(newFlow);
      },

      loadFlow: (flowData) => {
        get().setFlow(flowData);
      },

      saveFlow: () => {
        const { flow } = get();
        if (!flow) return;

        // 触发保存事件（可由外部监听器处理）
        const event = new CustomEvent('designer-flow-save', { detail: flow });
        window.dispatchEvent(event);
      },

      // 节点操作
      addNode: (node) => {
        set((state) => {
          if (!state.flow) return state;

          const newFlow = {
            ...state.flow,
            nodes: [...state.flow.nodes, node],
            metadata: {
              ...state.flow.metadata,
              updatedAt: Date.now(),
            },
          };

          return {
            flow: newFlow,
            history: {
              past: [
                ...state.history.past,
                state.history.present || state.flow,
              ],
              present: newFlow,
              future: [],
            },
          };
        });
      },

      updateNode: (nodeId, updates) => {
        set((state) => {
          if (!state.flow) return state;

          const newNodes = state.flow.nodes.map((node) =>
            node.id === nodeId ? { ...node, ...updates } : node,
          );

          const newFlow = {
            ...state.flow,
            nodes: newNodes,
            metadata: {
              ...state.flow.metadata,
              updatedAt: Date.now(),
            },
          };

          return {
            flow: newFlow,
            history: {
              past: [
                ...state.history.past,
                state.history.present || state.flow,
              ],
              present: newFlow,
              future: [],
            },
          };
        });
      },

      deleteNode: (nodeId) => {
        set((state) => {
          if (!state.flow) return state;

          const newNodes = state.flow.nodes.filter(
            (node) => node.id !== nodeId,
          );
          const newEdges = state.flow.edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId,
          );

          const newFlow = {
            ...state.flow,
            nodes: newNodes,
            edges: newEdges,
            metadata: {
              ...state.flow.metadata,
              updatedAt: Date.now(),
            },
          };

          return {
            flow: newFlow,
            selectedNodes: state.selectedNodes.filter((id) => id !== nodeId),
            history: {
              past: [
                ...state.history.past,
                state.history.present || state.flow,
              ],
              present: newFlow,
              future: [],
            },
          };
        });
      },

      duplicateNode: (nodeId) => {
        set((state) => {
          if (!state.flow) return state;

          const nodeToDuplicate = state.flow.nodes.find((n) => n.id === nodeId);
          if (!nodeToDuplicate) return state;

          const newNode: DesignerNode = {
            ...nodeToDuplicate,
            id: generateId(nodeToDuplicate.type),
            position: {
              x: nodeToDuplicate.position.x + 50,
              y: nodeToDuplicate.position.y + 50,
            },
            data: {
              ...nodeToDuplicate.data,
              label: `${nodeToDuplicate.data.label} (副本)`,
            },
          };

          const newFlow = {
            ...state.flow,
            nodes: [...state.flow.nodes, newNode],
            metadata: {
              ...state.flow.metadata,
              updatedAt: Date.now(),
            },
          };

          return {
            flow: newFlow,
            selectedNodes: [newNode.id],
            history: {
              past: [
                ...state.history.past,
                state.history.present || state.flow,
              ],
              present: newFlow,
              future: [],
            },
          };
        });
      },

      // 连线操作
      addEdge: (edge) => {
        set((state) => {
          if (!state.flow) return state;

          const newFlow = {
            ...state.flow,
            edges: [...state.flow.edges, edge],
            metadata: {
              ...state.flow.metadata,
              updatedAt: Date.now(),
            },
          };

          return {
            flow: newFlow,
            history: {
              past: [
                ...state.history.past,
                state.history.present || state.flow,
              ],
              present: newFlow,
              future: [],
            },
          };
        });
      },

      deleteEdge: (edgeId) => {
        set((state) => {
          if (!state.flow) return state;

          const newEdges = state.flow.edges.filter(
            (edge) => edge.id !== edgeId,
          );

          const newFlow = {
            ...state.flow,
            edges: newEdges,
            metadata: {
              ...state.flow.metadata,
              updatedAt: Date.now(),
            },
          };

          return {
            flow: newFlow,
            selectedEdges: state.selectedEdges.filter((id) => id !== edgeId),
            history: {
              past: [
                ...state.history.past,
                state.history.present || state.flow,
              ],
              present: newFlow,
              future: [],
            },
          };
        });
      },

      // 选择操作
      selectNode: (nodeId) => {
        set({ selectedNodes: [nodeId], selectedEdges: [] });
      },

      selectNodes: (nodeIds) => {
        set({ selectedNodes: nodeIds, selectedEdges: [] });
      },

      clearSelection: () => {
        set({ selectedNodes: [], selectedEdges: [] });
      },

      // 历史操作
      undo: () => {
        set((state) => {
          if (state.history.past.length === 0) return state;

          const previous = state.history.past[state.history.past.length - 1];
          const newPast = state.history.past.slice(0, -1);

          return {
            flow: previous,
            history: {
              past: newPast,
              present: previous,
              future: state.history.present
                ? ([
                    state.history.present,
                    ...state.history.future,
                  ] as TestFlow[])
                : state.history.future,
            },
          };
        });
      },

      redo: () => {
        set((state) => {
          if (state.history.future.length === 0) return state;

          const next = state.history.future[0];
          const newFuture = state.history.future.slice(1);

          return {
            flow: next,
            history: {
              past: state.history.present
                ? ([...state.history.past, state.history.present] as TestFlow[])
                : state.history.past,
              present: next,
              future: newFuture,
            },
          };
        });
      },

      canUndo: () => {
        return get().history.past.length > 0;
      },

      canRedo: () => {
        return get().history.future.length > 0;
      },

      // 视图操作
      setZoom: (zoom) => {
        set({ zoom: Math.max(0.1, Math.min(2, zoom)) });
      },

      setViewport: (viewport) => {
        set({ viewport });
      },

      fitView: () => {
        // 由 React Flow 组件处理
        set({ zoom: 1, viewport: { x: 0, y: 0 } });
      },

      toggleMinimap: () => {
        set((state) => ({ showMinimap: !state.showMinimap }));
      },

      toggleGrid: () => {
        set((state) => ({ showGrid: !state.showGrid }));
      },

      // 验证
      validateFlow: (): ValidationResult => {
        const { flow } = get();
        if (!flow) {
          return {
            valid: false,
            errors: [{ type: 'structure', message: '没有活动流程' }],
            warnings: [],
          };
        }

        const errors: any[] = [];
        const warnings: any[] = [];

        // 检查开始节点
        const hasStart = flow.nodes.some((n) => n.type === 'start');
        if (!hasStart) {
          errors.push({ type: 'structure', message: '流程缺少开始节点' });
        }

        // 检查结束节点
        const hasEnd = flow.nodes.some((n) => n.type === 'end');
        if (!hasEnd) {
          errors.push({ type: 'structure', message: '流程缺少结束节点' });
        }

        // 检查孤立节点
        const connectedNodeIds = new Set<string>();
        flow.edges.forEach((edge) => {
          connectedNodeIds.add(edge.source);
          connectedNodeIds.add(edge.target);
        });

        flow.nodes.forEach((node) => {
          if (
            node.type !== 'start' &&
            node.type !== 'end' &&
            node.type !== 'comment'
          ) {
            if (!connectedNodeIds.has(node.id)) {
              warnings.push({
                type: 'usability',
                message: `节点 "${node.data.label}" 未连接到流程`,
                nodeId: node.id,
                suggestion: '连接此节点到其他节点或删除它',
              });
            }
          }
        });

        // 检查节点配置
        flow.nodes.forEach((node) => {
          const nodeErrors = node.data.errors as string[] | undefined;
          if (nodeErrors && nodeErrors.length > 0) {
            errors.push({
              type: 'configuration',
              message: nodeErrors.join(', '),
              nodeId: node.id,
            });
          }
        });

        // 检查循环依赖
        const hasCycle = detectCycle(
          flow.nodes.map((n) => n.id),
          flow.edges,
        );
        if (hasCycle) {
          errors.push({ type: 'cycle', message: '流程中存在循环依赖' });
        }

        const result: ValidationResult = {
          valid: errors.length === 0,
          errors,
          warnings,
        };

        set({ validationResult: result });

        return result;
      },

      // UI 状态
      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error });
      },

      reset: () => {
        set(createInitialState());
      },
    }),
    { name: 'DesignerStore' },
  ),
);

/**
 * 检测循环依赖 (使用 DFS)
 */
function detectCycle(nodeIds: string[], edges: DesignerEdge[]): boolean {
  const graph = new Map<string, string[]>();

  // 构建邻接表
  nodeIds.forEach((id) => graph.set(id, []));
  edges.forEach((edge) => {
    const neighbors = graph.get(edge.source) || [];
    neighbors.push(edge.target);
    graph.set(edge.source, neighbors);
  });

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) return true;
    }
  }

  return false;
}

/**
 * 选择器 hooks
 */
export const useFlow = () => useDesignerStore((state) => state.flow);
export const useSelectedNodes = () =>
  useDesignerStore((state) => state.selectedNodes);
export const useValidationResult = () =>
  useDesignerStore((state) => state.validationResult);
export const useViewportSettings = () =>
  useDesignerStore((state) => ({
    zoom: state.zoom,
    viewport: state.viewport,
    showMinimap: state.showMinimap,
    showGrid: state.showGrid,
  }));
