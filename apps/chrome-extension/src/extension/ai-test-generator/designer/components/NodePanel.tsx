/**
 * NodePanel Component
 * 节点面板 - 显示可用的节点类型，支持拖拽到画布
 */

import React, { useCallback, useMemo } from 'react';
import { nodeRegistry } from '../services/nodeRegistry';
import type { NodeCategory, NodeType } from '../../types/designer';

export interface NodePanelProps {
  /** 筛选条件 */
  filterCategories?: NodeCategory[];
  /** 搜索关键词 */
  searchQuery?: string;
  /** 节点点击回调 */
  onNodeClick?: (nodeType: NodeType) => void;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 节点分类标签
 */
const CATEGORY_LABELS: Record<NodeCategory, { label: string; color: string }> = {
  special: { label: '特殊', color: 'bg-amber-100 text-amber-800' },
  action: { label: '动作', color: 'bg-blue-100 text-blue-800' },
  validation: { label: '验证', color: 'bg-green-100 text-green-800' },
  control: { label: '控制', color: 'bg-indigo-100 text-indigo-800' },
  data: { label: '数据', color: 'bg-pink-100 text-pink-800' },
} as const;

/**
 * DraggableNode 组件 - 可拖拽的节点
 */
interface DraggableNodeProps {
  type: NodeType;
  label: string;
  icon: string;
  category: NodeCategory;
  onClick?: (type: NodeType) => void;
}

const DraggableNode: React.FC<DraggableNodeProps> = ({ type, label, icon, category, onClick }) => {
  const categoryStyle = CATEGORY_LABELS[category];

  const onDragStart = useCallback(
    (event: React.DragEvent) => {
      event.dataTransfer.setData('application/reactflow', type);
      event.dataTransfer.effectAllowed = 'move';
    },
    [type]
  );

  const handleClick = useCallback(() => {
    onClick?.(type);
  }, [type, onClick]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={handleClick}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border cursor-move
        hover:shadow-md hover:border-gray-400 transition-all
        select-none
      `}
      style={{
        backgroundColor: categoryStyle.color,
      }}
      title={`拖拽 "${label}" 到画布上添加节点`}
    >
      <span className="text-lg" aria-label="node-icon">
        {icon}
      </span>
      <span className="text-sm font-medium truncate">{label}</span>
    </div>
  );
};

/**
 * NodeCategorySection 组件 - 节点分类区域
 */
interface NodeCategorySectionProps {
  category: NodeCategory;
  nodes: Array<{ type: NodeType; label: string; icon: string }>;
  onNodeClick?: (type: NodeType) => void;
  searchQuery?: string;
}

const NodeCategorySection: React.FC<NodeCategorySectionProps> = ({
  category,
  nodes,
  onNodeClick,
  searchQuery,
}) => {
  const categoryStyle = CATEGORY_LABELS[category];
  const [collapsed, setCollapsed] = React.useState(false);

  // 根据搜索关键词过滤节点
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter((node) => node.label.toLowerCase().includes(query));
  }, [nodes, searchQuery]);

  if (filteredNodes.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`
          flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium
          hover:bg-opacity-80 transition-colors
        `}
        style={{
          backgroundColor: categoryStyle.color,
        }}
      >
        <span className={`transition-transform ${collapsed ? 'rotate-[-90deg]' : ''}`}>▼</span>
        <span>{categoryStyle.label}</span>
        <span className="ml-auto text-xs opacity-70">{filteredNodes.length}</span>
      </button>

      {!collapsed && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {filteredNodes.map((node) => (
            <DraggableNode
              key={node.type}
              type={node.type}
              label={node.label}
              icon={node.icon}
              category={category}
              onClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * NodePanel 主组件
 */
export const NodePanel: React.FC<NodePanelProps> = ({
  filterCategories,
  searchQuery = '',
  onNodeClick,
  className = '',
}) => {
  const categories = useMemo(() => {
    const allCategories = nodeRegistry.getCategories();
    return filterCategories
      ? allCategories.filter((cat) => filterCategories.includes(cat))
      : allCategories;
  }, [filterCategories]);

  const categorizedNodes = useMemo(() => {
    const result = new Map<NodeCategory, Array<{ type: NodeType; label: string; icon: string }>>();

    categories.forEach((category) => {
      const nodes = nodeRegistry.getByCategory(category);
      result.set(
        category,
        nodes.map((def) => ({
          type: def.type,
          label: def.label,
          icon: def.icon,
        }))
      );
    });

    return result;
  }, [categories]);

  return (
    <div className={`node-panel bg-white border-r border-gray-200 overflow-y-auto ${className}`}>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">节点面板</h3>

        {/* 搜索框 (可选) */}
        {searchQuery === undefined && (
          <input
            type="text"
            placeholder="搜索节点..."
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            readOnly
          />
        )}

        {/* 节点分类列表 */}
        <div className="mt-4">
          {categories.map((category) => (
            <NodeCategorySection
              key={category}
              category={category}
              nodes={categorizedNodes.get(category) || []}
              onNodeClick={onNodeClick}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      </div>

      {/* 提示信息 */}
      <div className="px-3 py-2 border-t border-gray-200 text-xs text-gray-500">
        💡 拖拽节点到画布上添加
      </div>
    </div>
  );
};

export default NodePanel;
