/**
 * FlowCanvas Component
 * 流程画布组件 - React Flow 集成
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  type Connection,
  type Edge,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  addEdge,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDesignerStore } from '../store';
import { createNode, nodeRegistry } from '../services/nodeRegistry';
import type { DesignerEdge, DesignerNode, NodeType } from '../../types/designer';

// Import node types
import {
  StartNode,
  EndNode,
  CommentNode,
  SubflowNode,
  ClickNode,
  InputNode,
  ScrollNode,
  WaitNode,
  NavigateNode,
  HoverNode,
  DragNode,
  AssertExistsNode,
  AssertTextNode,
  AssertStateNode,
  AiAssertNode,
  IfElseNode,
  LoopNode,
  ParallelNode,
  GroupNode,
  SetVariableNode,
  ExtractDataNode,
  ExternalDataNode,
} from '../nodes';

/**
 * Node 类型映射
 */
const nodeTypes: NodeTypes = {
  // Special nodes
  start: StartNode,
  end: EndNode,
  comment: CommentNode,
  subflow: SubflowNode,
  // Action nodes
  click: ClickNode,
  input: InputNode,
  scroll: ScrollNode,
  wait: WaitNode,
  navigate: NavigateNode,
  hover: HoverNode,
  drag: DragNode,
  // Validation nodes
  assertExists: AssertExistsNode,
  assertText: AssertTextNode,
  assertState: AssertStateNode,
  aiAssert: AiAssertNode,
  // Control nodes
  ifElse: IfElseNode,
  loop: LoopNode,
  parallel: ParallelNode,
  group: GroupNode,
  // Data nodes
  setVariable: SetVariableNode,
  extractData: ExtractDataNode,
  externalData: ExternalDataNode,
};

export interface FlowCanvasProps {
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 是否显示控制面板 */
  showControls?: boolean;
  /** 是否显示网格背景 */
  showBackground?: boolean;
  /** 节点放置时的回调 */
  onNodeDrop?: (nodeType: NodeType, position: { x: number; y: number }) => void;
  /** 连接创建时的回调 */
  onConnect?: (connection: Connection) => void;
  /** 节点选中时的回调 */
  onNodeSelect?: (nodeId: string) => void;
  /** 背景点击时的回调 */
  onBackgroundClick?: () => void;
}

/**
 * FlowCanvas 组件
 */
export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  readOnly = false,
  showControls = true,
  showBackground = true,
  onNodeDrop,
  onConnect: onConnectCallback,
  onNodeSelect,
  onBackgroundClick,
}) => {
  const {
    flow,
    addNode,
    addEdge,
    deleteNode,
    updateNode,
    selectNode,
    selectNodes,
    clearSelection,
    validateFlow,
  } = useDesignerStore();

  const flowInstance = useReactFlow();

  // 转换 nodes 和 edges 为 React Flow 格式
  const nodes = useMemo(() => {
    return flow?.nodes.map((node) => ({
      ...node,
      deletable: node.data.deletable !== false,
    })) || [];
  }, [flow?.nodes]);

  const edges = useMemo(() => {
    return flow?.edges.map((edge) => ({
      ...edge,
      animated: edge.type === 'conditional' || edge.type === 'loop',
      style: edge.type === 'conditional' ? { stroke: '#6366f1' } : undefined,
    })) || [];
  }, [flow?.edges]);

  /**
   * 处理节点变化
   */
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (readOnly) return;

      for (const change of changes) {
        if (change.type === 'position' && change.position && change.id) {
          updateNode(change.id as string, {
            position: change.position,
          });
        } else if (change.type === 'remove' && change.id) {
          deleteNode(change.id as string);
        }
      }
    },
    [readOnly, updateNode, deleteNode]
  );

  /**
   * 处理连线变化
   */
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      // Handle edge removal
      if (readOnly) return;

      for (const change of changes) {
        if (change.type === 'remove' && change.id) {
          useDesignerStore.getState().deleteEdge(change.id);
        }
      }
    },
    [readOnly]
  );

  /**
   * 处理新连接创建
   */
  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;

      const newEdge: DesignerEdge = {
        id: `edge-${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'default',
      };

      // 判断是否是条件连线 (基于 sourceHandle)
      if (connection.sourceHandle === 'true' || connection.sourceHandle === 'false') {
        newEdge.type = 'conditional';
        newEdge.data = {
          condition: connection.sourceHandle === 'true' ? 'true' : 'false',
          label: connection.sourceHandle === 'true' ? 'True' : 'False',
        };
      }

      if (onConnectCallback) {
        onConnectCallback(connection);
      } else {
        addEdge(newEdge);
      }

      // 验证流程
      setTimeout(() => validateFlow(), 100);
    },
    [readOnly, addEdge, onConnectCallback, validateFlow]
  );

  /**
   * 处理节点拖放
   */
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (readOnly) return;

      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (!nodeType) return;

      // 获取画布边界和位置
      const reactFlowBounds = (event.target as Element)
        .closest('.react-flow')
        ?.getBoundingClientRect();

      if (!reactFlowBounds) return;

      // 计算节点位置
      const position = flowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode = createNode(nodeType as NodeType, position);

      if (onNodeDrop) {
        onNodeDrop(nodeType as NodeType, position);
      } else {
        addNode(newNode);
      }

      // 验证流程
      setTimeout(() => validateFlow(), 100);
    },
    [readOnly, flowInstance, addNode, onNodeDrop, validateFlow]
  );

  /**
   * 处理节点选中
   */
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: DesignerNode[]; edges: Edge[] }) => {
      if (selectedNodes.length === 1) {
        const nodeId = selectedNodes[0].id;
        selectNode(nodeId);
        if (onNodeSelect) {
          onNodeSelect(nodeId);
        }
      } else if (selectedNodes.length > 1) {
        const nodeIds = selectedNodes.map((n) => n.id);
        selectNodes(nodeIds);
      } else {
        clearSelection();
      }
    },
    [selectNode, selectNodes, clearSelection, onNodeSelect]
  );

  /**
   * 处理键盘事件
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (readOnly) return;

      // Delete 键删除选中节点
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // 只在不是输入框时删除
        if (
          event.target instanceof HTMLElement &&
          (event.target.tagName === 'INPUT' ||
            event.target.tagName === 'TEXTAREA' ||
            event.target.contentEditable === 'true')
        ) {
          return;
        }

        const { selectedNodes } = useDesignerStore.getState();
        selectedNodes.forEach((nodeId) => {
          deleteNode(nodeId);
        });
      }

      // Ctrl/Cmd + C 复制
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        const { flow, selectedNodes } = useDesignerStore.getState();
        if (flow && selectedNodes.length > 0) {
          const nodesToCopy = flow.nodes.filter((n) => selectedNodes.includes(n.id));
          const edgesToCopy = flow.edges.filter((e) =>
            selectedNodes.includes(e.source) && selectedNodes.includes(e.target)
          );
          useDesignerStore.setState({ clipboard: { nodes: nodesToCopy, edges: edgesToCopy } });
        }
      }

      // Ctrl/Cmd + V 粘贴
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        const { clipboard, flow } = useDesignerStore.getState();
        if (clipboard && flow) {
          const offset = { x: 50, y: 50 };
          const newNodes = clipboard.nodes.map((node) => {
            const newNode = createNode(node.type as NodeType, {
              x: node.position.x + offset.x,
              y: node.position.y + offset.y,
            });
            newNode.data = { ...node.data, label: `${node.data.label} (副本)` };
            addNode(newNode);
            return newNode;
          });
        }
      }

      // Ctrl/Cmd + Z 撤销
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        useDesignerStore.getState().undo();
      }

      // Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y 重做
      if (
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'y')
      ) {
        event.preventDefault();
        useDesignerStore.getState().redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, deleteNode, addNode]);

  /**
   * 获取所有节点类型的图标
   */
  const getAllNodeTypes = useCallback(() => {
    return nodeRegistry.getAll().map((def) => ({
      type: def.type,
      label: def.label,
      category: def.category,
      icon: def.icon,
    }));
  }, []);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={onSelectionChange}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPaneClick={onBackgroundClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        deleteKeyCode={null} // 手动处理删除
        panOnScroll
        selectionOnDrag
        multiSelectionKeyCode="Shift"
        zoomOnDoubleClick
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={true}
        selectNodesOnDrag={false}
      >
        {showBackground && (
          <Background
            gap={16}
            size={1}
            color="#e5e7eb"
            style={{ opacity: useDesignerStore.getState().showGrid ? 1 : 0 }}
          />
        )}

        {showControls && (
          <Controls
            className="!bg-white !border !border-gray-200 !shadow-lg"
            showZoom={true}
            showFitView={true}
            showInteractive={true}
          />
        )}

        {/* 可以在这里添加更多组件，如 Minimap */}
      </ReactFlow>
    </div>
  );
};

/**
 * FlowCanvasWrapper - 包装组件提供 ReactFlowProvider
 */
export const FlowCanvasWrapper: React.FC<Omit<FlowCanvasProps, 'onConnect'>> = (props) => {
  return (
    // ReactFlowProvider 应该在组件树的上层提供
    // 这里我们假设使用者已经在外层提供了 Provider
    <FlowCanvas {...props} />
  );
};

export default FlowCanvas;
