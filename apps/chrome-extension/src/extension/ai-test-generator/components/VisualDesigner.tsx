/**
 * VisualDesigner Component
 * 可视化测试设计器组件 - 集成 Flow 设计器界面
 */

import { ApartmentOutlined } from '@ant-design/icons';
import { Button, message, Modal, Space } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ElementPicker,
  ExecutionPanel,
  ExecutionPanelButton,
  NodePanel,
  PropertyPanel,
  TemplateBrowser,
  TemplateBrowserButton,
  Toolbar,
  VariableManager,
} from '../designer';
import { FlowCanvas } from '../designer/components/FlowCanvas';
import { Minimap } from '../designer/components/Minimap';
import { useDesignerStore } from '../designer/store';
import type { DesignerFlow } from '../designer/types/designer';
import { exportYaml, importYaml } from '../designer/services/yamlConverter';
import { useI18n } from '../../../i18n';

export interface VisualDesignerProps {
  /** 返回回调 */
  onBack?: () => void;
  /** 导出到 YAML 的回调 */
  onExportYaml?: (yaml: string) => void;
  /** 当前编辑的流程 (可选) */
  initialFlow?: DesignerFlow;
}

/**
 * VisualDesigner 组件
 */
export const VisualDesigner: React.FC<VisualDesignerProps> = ({
  onBack,
  onExportYaml,
  initialFlow,
}) => {
  const { t } = useI18n();
  const {
    flow,
    setFlow,
    createNewFlow,
    saveFlow,
    loadFlow,
    validateFlow,
    exportToYaml,
    importFromYaml,
  } = useDesignerStore();

  const [showVariableManager, setShowVariableManager] = useState(false);
  const [showElementPicker, setShowElementPicker] = useState(false);
  const [elementPickerTarget, setElementPickerTarget] = useState<{
    nodeId: string;
    handleType: string;
  } | null>(null);

  /**
   * 初始化流程
   */
  useEffect(() => {
    if (initialFlow && !flow) {
      setFlow(initialFlow);
    } else if (!flow) {
      createNewFlow();
    }
  }, [initialFlow, flow, createNewFlow, setFlow]);

  /**
   * 处理保存
   */
  const handleSave = useCallback(() => {
    saveFlow();
    message.success(t('save') + ' ' + t('success'));
  }, [saveFlow, t]);

  /**
   * 处理导出 YAML
   */
  const handleExportYaml = useCallback(() => {
    if (!flow) {
      message.warning('No flow to export');
      return;
    }
    const yaml = exportToYaml();
    if (onExportYaml) {
      onExportYaml(yaml);
    } else {
      // 默认复制到剪贴板
      navigator.clipboard.writeText(yaml);
      message.success(t('copy') + ' ' + t('success'));
    }
  }, [flow, exportToYaml, onExportYaml, t]);

  /**
   * 处理导入 YAML
   */
  const handleImportYaml = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        importFromYaml(text);
        message.success(t('upload') + ' ' + t('success'));
      } catch (err) {
        message.error('Failed to import YAML: ' + (err as Error).message);
      }
    };
    input.click();
  }, [importFromYaml, t]);

  /**
   * 处理从模板加载
   */
  const handleLoadTemplate = useCallback((templateFlow: DesignerFlow) => {
    setFlow(templateFlow);
  }, [setFlow]);

  /**
   * 处理执行完成
   */
  const handleExecutionComplete = useCallback((result: any) => {
    if (result.success) {
      message.success(`Test completed: ${result.completed}/${result.total} steps`);
    } else {
      message.warning(`Test completed with errors: ${result.errors?.length || 0} failures`);
    }
  }, []);

  /**
   * 处理元素选择
   */
  const handleElementSelect = useCallback((element: any) => {
    if (!elementPickerTarget || !flow) return;

    const { nodeId, handleType } = elementPickerTarget;
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // 更新节点的配置，添加选择器
    const updatedNode = {
      ...node,
      data: {
        ...node.data,
        config: {
          ...node.data.config,
          selector: element.selector,
          element: element,
        },
      },
    };

    useDesignerStore.getState().updateNode(nodeId, updatedNode);
    setShowElementPicker(false);
    setElementPickerTarget(null);
    message.success('Element selected: ' + element.selector);
  }, [elementPickerTarget, flow]);

  /**
   * 打开元素选择器
   */
  const openElementPicker = useCallback((nodeId: string, handleType: string) => {
    setElementPickerTarget({ nodeId, handleType });
    setShowElementPicker(true);
  }, []);

  return (
    <div className="visual-designer-container flex flex-col h-full bg-gray-50">
      {/* 工具栏 */}
      <Toolbar
        onExport={(format) => {
          if (format === 'yaml') {
            handleExportYaml();
          } else {
            // JSON export
            const json = JSON.stringify(flow, null, 2);
            navigator.clipboard.writeText(json);
            message.success('JSON copied to clipboard');
          }
        }}
        onImport={handleImportYaml}
        onHelp={() => {
          Modal.info({
            title: 'Visual Designer Help',
            content: (
              <div>
                <p>Drag nodes from the left panel to create your test flow.</p>
                <p>Connect nodes by dragging from output handles to input handles.</p>
                <p>Double-click a node to edit its properties.</p>
                <p>Press Delete to remove selected nodes.</p>
                <p>Ctrl+S to save, Ctrl+Z to undo, Ctrl+Y to redo.</p>
              </div>
            ),
          });
        }}
      />

      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧节点面板 */}
        <div className="w-56 border-r border-gray-200 bg-white overflow-y-auto">
          <NodePanel onElementSelect={openElementPicker} />
        </div>

        {/* 中间画布 */}
        <div className="flex-1 relative">
          <ReactFlowProvider>
            <FlowCanvas />
          </ReactFlowProvider>
        </div>

        {/* 右侧属性面板 */}
        <div className="w-72 border-l border-gray-200 bg-white overflow-y-auto">
          <PropertyPanel onElementSelect={openElementPicker} />
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-t border-gray-200">
        <Space>
          <Button
            type="text"
            icon={<ApartmentOutlined />}
            onClick={() => setShowVariableManager(true)}
          >
            Variables
          </Button>
          <TemplateBrowserButton onSelectTemplate={handleLoadTemplate} />
          <ExecutionPanelButton
            flowId={flow?.id}
            onExecutionComplete={handleExecutionComplete}
          />
        </Space>

        <Space>
          <Button onClick={onBack}>{t('back')}</Button>
          <Button type="primary" onClick={handleSave}>
            {t('save')}
          </Button>
          <Button type="primary" onClick={handleExportYaml}>
            Export YAML
          </Button>
        </Space>
      </div>

      {/* 变量管理器对话框 */}
      <VariableManager
        visible={showVariableManager}
        onClose={() => setShowVariableManager(false)}
      />

      {/* 元素选择器对话框 */}
      <ElementPicker
        visible={showElementPicker}
        onClose={() => {
          setShowElementPicker(false);
          setElementPickerTarget(null);
        }}
        onElementSelected={handleElementSelect}
      />
    </div>
  );
};

export default VisualDesigner;
