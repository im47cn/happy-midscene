/**
 * Toolbar Component
 * 工具栏组件 - 提供文件操作、编辑、视图控制等功能
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  SaveOutlined,
  ExportOutlined,
  ImportOutlined,
  UndoOutlined,
  RedoOutlined,
  DeleteOutlined,
  CopyOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  FullscreenOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  QuestionCircleOutlined,
  DownOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { Button, Divider, Dropdown, Space, Tooltip, message } from 'antd';
import type { MenuProps } from 'antd';
import { useDesignerStore } from '../store';
import { useReactFlow } from '@xyflow/react';

export interface ToolbarProps {
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 导出回调 */
  onExport?: (format: 'yaml' | 'json') => void;
  /** 导入回调 */
  onImport?: () => void;
  /** 帮助回调 */
  onHelp?: () => void;
}

/**
 * Toolbar 组件
 */
export const Toolbar: React.FC<ToolbarProps> = ({
  readOnly = false,
  className = '',
  onExport,
  onImport,
  onHelp,
}) => {
  const reactFlow = useReactFlow();
  const {
    flow,
    canUndo,
    canRedo,
    undo,
    redo,
    saveFlow,
    deleteNode,
    duplicateNode,
    selectedNodes,
    clearSelection,
    toggleMinimap,
    toggleGrid,
    showMinimap,
    showGrid,
    validateFlow,
    zoom,
    setZoom,
  } = useDesignerStore();

  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  /**
   * 处理保存
   */
  const handleSave = useCallback(() => {
    if (!flow) {
      message.warning('没有可保存的流程');
      return;
    }
    saveFlow();
    message.success('流程已保存');
  }, [flow, saveFlow]);

  /**
   * 处理导出菜单点击
   */
  const handleExportMenuClick: MenuProps['onClick'] = useCallback(
    ({ key }: { key: string }) => {
      if (onExport) {
        onExport(key as 'yaml' | 'json');
      }
    },
    [onExport]
  );

  /**
   * 处理导入
   */
  const handleImport = useCallback(() => {
    if (onImport) {
      onImport();
    }
  }, [onImport]);

  /**
   * 处理撤销
   */
  const handleUndo = useCallback(() => {
    undo();
    message.info('已撤销');
  }, [undo]);

  /**
   * 处理重做
   */
  const handleRedo = useCallback(() => {
    redo();
    message.info('已重做');
  }, [redo]);

  /**
   * 处理删除选中节点
   */
  const handleDelete = useCallback(() => {
    if (selectedNodes.length === 0) {
      message.warning('请先选择要删除的节点');
      return;
    }
    selectedNodes.forEach((nodeId) => {
      deleteNode(nodeId);
    });
    clearSelection();
    message.success(`已删除 ${selectedNodes.length} 个节点`);
  }, [selectedNodes, deleteNode, clearSelection]);

  /**
   * 处理复制选中节点
   */
  const handleDuplicate = useCallback(() => {
    if (selectedNodes.length === 0) {
      message.warning('请先选择要复制的节点');
      return;
    }
    if (selectedNodes.length > 1) {
      message.warning('只能复制单个节点');
      return;
    }
    duplicateNode(selectedNodes[0]);
    message.success('已复制节点');
  }, [selectedNodes, duplicateNode]);

  /**
   * 处理缩放
   */
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoom + 0.1, 2);
    setZoom(newZoom);
    reactFlow.zoomTo(newZoom);
  }, [zoom, setZoom, reactFlow]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoom - 0.1, 0.1);
    setZoom(newZoom);
    reactFlow.zoomTo(newZoom);
  }, [zoom, setZoom, reactFlow]);

  const handleFitView = useCallback(() => {
    reactFlow.fitView({ padding: 0.2 });
    setZoom(1);
  }, [reactFlow, setZoom]);

  /**
   * 处理切换小地图
   */
  const handleToggleMinimap = useCallback(() => {
    toggleMinimap();
    message.info(showMinimap ? '已隐藏小地图' : '已显示小地图');
  }, [toggleMinimap, showMinimap]);

  /**
   * 处理切换网格
   */
  const handleToggleGrid = useCallback(() => {
    toggleGrid();
    message.info(showGrid ? '已隐藏网格' : '已显示网格');
  }, [toggleGrid, showGrid]);

  /**
   * 处理验证
   */
  const handleValidate = useCallback(() => {
    const result = validateFlow();
    if (result.valid) {
      setValidationStatus('valid');
      message.success('流程验证通过');
      if (result.warnings.length > 0) {
        setTimeout(() => {
          message.warning(`存在 ${result.warnings.length} 个警告`);
        }, 500);
      }
    } else {
      setValidationStatus('invalid');
      message.error(`流程验证失败: ${result.errors.length} 个错误`);
    }
  }, [validateFlow]);

  /**
   * 处理帮助
   */
  const handleHelp = useCallback(() => {
    if (onHelp) {
      onHelp();
    } else {
      // 默认显示帮助信息
      message.info('快捷键: Delete=删除, Ctrl+C=复制, Ctrl+V=粘贴, Ctrl+Z=撤销, Ctrl+Y=重做');
    }
  }, [onHelp]);

  /**
   * 导出菜单项
   */
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'yaml',
      label: '导出为 YAML',
      icon: <ExportOutlined />,
    },
    {
      key: 'json',
      label: '导出为 JSON',
      icon: <ExportOutlined />,
    },
  ];

  /**
   * 视图菜单项
   */
  const viewMenuItems: MenuProps['items'] = [
    {
      key: 'toggle-grid',
      label: showGrid ? '隐藏网格' : '显示网格',
      icon: showGrid ? <EyeInvisibleOutlined /> : <EyeOutlined />,
      onClick: handleToggleGrid,
    },
    {
      key: 'toggle-minimap',
      label: showMinimap ? '隐藏小地图' : '显示小地图',
      icon: showMinimap ? <EyeInvisibleOutlined /> : <EyeOutlined />,
      onClick: handleToggleMinimap,
    },
    {
      type: 'divider',
    },
    {
      key: 'fit-view',
      label: '适应视图',
      icon: <FullscreenOutlined />,
      onClick: handleFitView,
    },
  ];

  /**
   * 快捷键监听
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + S 保存
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  /**
   * 监听选择变化更新状态
   */
  useEffect(() => {
    if (selectedNodes.length > 0) {
      setValidationStatus('idle');
    }
  }, [selectedNodes]);

  return (
    <div
      className={`toolbar flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 ${className}`}
    >
      {/* 文件操作组 */}
      <Space size="small">
        <Tooltip title="保存 (Ctrl+S)">
          <Button
            type="text"
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={!flow || readOnly}
          />
        </Tooltip>

        <Dropdown menu={{ onClick: handleExportMenuClick, items: exportMenuItems }} disabled={!flow || readOnly}>
          <Button type="text" icon={<ExportOutlined />} disabled={!flow || readOnly}>
            <DownOutlined />
          </Button>
        </Dropdown>

        <Tooltip title="导入">
          <Button type="text" icon={<ImportOutlined />} onClick={handleImport} disabled={readOnly} />
        </Tooltip>
      </Space>

      <Divider type="vertical" className="h-6 mx-2" />

      {/* 编辑操作组 */}
      <Space size="small">
        <Tooltip title="撤销 (Ctrl+Z)">
          <Button type="text" icon={<UndoOutlined />} onClick={handleUndo} disabled={!canUndo || readOnly} />
        </Tooltip>

        <Tooltip title="重做 (Ctrl+Y)">
          <Button type="text" icon={<RedoOutlined />} onClick={handleRedo} disabled={!canRedo || readOnly} />
        </Tooltip>

        <Tooltip title="复制选中节点 (Ctrl+C)">
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={handleDuplicate}
            disabled={selectedNodes.length !== 1 || readOnly}
          />
        </Tooltip>

        <Tooltip title="删除选中节点 (Delete)">
          <Button
            type="text"
            icon={<DeleteOutlined />}
            onClick={handleDelete}
            disabled={selectedNodes.length === 0 || readOnly}
            danger
          />
        </Tooltip>
      </Space>

      <Divider type="vertical" className="h-6 mx-2" />

      {/* 视图操作组 */}
      <Space size="small">
        <Tooltip title="放大">
          <Button type="text" icon={<ZoomInOutlined />} onClick={handleZoomIn} />
        </Tooltip>

        <Tooltip title="缩小">
          <Button type="text" icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
        </Tooltip>

        <Dropdown menu={{ items: viewMenuItems }}>
          <Button type="text" icon={<AppstoreOutlined />}>
            视图 <DownOutlined />
          </Button>
        </Dropdown>
      </Space>

      <Divider type="vertical" className="h-6 mx-2" />

      {/* 验证组 */}
      <Space size="small">
        <Tooltip title="验证流程">
          <Button
            type={validationStatus === 'invalid' ? 'primary' : 'default'}
            danger={validationStatus === 'invalid'}
            icon={
              validationStatus === 'valid' ? (
                <CheckOutlined />
              ) : validationStatus === 'invalid' ? (
                <CloseOutlined />
              ) : (
                <CheckOutlined />
              )
            }
            onClick={handleValidate}
            disabled={!flow}
          >
            验证
          </Button>
        </Tooltip>
      </Space>

      <div className="flex-1" />

      {/* 帮助按钮 */}
      <Tooltip title="帮助">
        <Button type="text" icon={<QuestionCircleOutlined />} onClick={handleHelp} />
      </Tooltip>
    </div>
  );
};

export default Toolbar;
