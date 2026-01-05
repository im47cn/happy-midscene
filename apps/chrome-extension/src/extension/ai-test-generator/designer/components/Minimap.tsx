/**
 * Minimap Component
 * 小地图组件 - 显示流程的整体缩略图
 */

import React, { useMemo } from 'react';
import { MiniMap as ReactFlowMinimap } from '@xyflow/react';
import type { MiniMapProps as ReactFlowMiniMapProps } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import type { DesignerNode } from '../../types/designer';

/**
 * 节点颜色映射函数
 */
const getNodeColor = (node: Node): string => {
  const designerNode = node as DesignerNode;
  const category = designerNode.data.category;

  switch (category) {
    case 'special':
      return '#8b5cf6'; // purple
    case 'action':
      return '#3b82f6'; // blue
    case 'validation':
      return '#22c55e'; // green
    case 'control':
      return '#f59e0b'; // amber
    case 'data':
      return '#ec4899'; // pink
    default:
      return '#6b7280'; // gray
  }
};

/**
 * 节点边框颜色映射函数
 */
const getNodeStrokeColor = (node: Node): string => {
  const designerNode = node as DesignerNode;

  // 错误状态
  if (designerNode.data.errors && Array.isArray(designerNode.data.errors) && designerNode.data.errors.length > 0) {
    return '#ef4444'; // red
  }

  // 选中状态
  if (designerNode.selected) {
    return '#6366f1'; // indigo
  }

  return '#ffffff'; // white
};

export interface MinimapProps extends Omit<ReactFlowMiniMapProps, 'nodeColor' | 'nodeStrokeColor'> {
  /** 节点背景色是否透明 */
  maskColor?: string;
}

/**
 * Minimap 组件
 */
export const Minimap: React.FC<MinimapProps> = ({
  maskColor = 'rgba(0, 0, 0, 0.5)',
  ...restProps
}) => {
  // 使用 useMemo 缓存样式配置
  const style = useMemo(
    () => ({
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    }),
    []
  );

  return (
    <div className="minimap-wrapper">
      <ReactFlowMinimap
        nodeColor={getNodeColor}
        nodeStrokeColor={getNodeStrokeColor}
        maskColor={maskColor}
        pannable
        zoomable
        style={style}
        position="bottom-right"
        {...restProps}
      />
    </div>
  );
};

/**
 * MinimapButton - 切换小地图显示/隐藏的按钮
 */
export interface MinimapButtonProps {
  /** 是否显示小地图 */
  show: boolean;
  /** 切换回调 */
  onToggle: () => void;
  /** 按钮样式类名 */
  className?: string;
}

export const MinimapButton: React.FC<MinimapButtonProps> = ({ show, onToggle, className = '' }) => {
  return (
    <button
      className={`minimap-toggle ${className}`}
      onClick={onToggle}
      title={show ? '隐藏小地图' : '显示小地图'}
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f9fafb';
        e.currentTarget.style.borderColor = '#d1d5db';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#ffffff';
        e.currentTarget.style.borderColor = '#e5e7eb';
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {show ? (
          <>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </>
        ) : (
          <>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </>
        )}
      </svg>
    </button>
  );
};

export default Minimap;
