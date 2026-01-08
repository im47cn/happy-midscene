/**
 * PropertyPanel Component
 * 属性面板 - 编辑选中节点的配置
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DesignerNode, NodeConfig } from '../../types/designer';
import { nodeRegistry, validateNodeConfig } from '../services/nodeRegistry';
import { useDesignerStore } from '../store';
import { ElementPickerButton } from './ElementPicker';
import type { SelectedElement } from '../../types/elementRepair';

export interface PropertyPanelProps {
  /** 自定义样式类名 */
  className?: string;
  /** 配置变更回调 */
  onConfigChange?: (nodeId: string, newConfig: NodeConfig) => void;
}

/**
 * StringField 组件 - 文本输入字段
 */
interface StringFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  error?: string;
}

const StringField: React.FC<StringFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  required = false,
  error,
}) => {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`
            w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
          `}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
          `}
        />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

/**
 * TargetField 组件 - 目标元素选择字段（带元素选择器）
 */
interface TargetFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  nodeId?: string;
  targetField?: string;
}

const TargetField: React.FC<TargetFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  nodeId,
  targetField = 'target',
}) => {
  const [pickerVisible, setPickerVisible] = useState(false);

  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
          `}
        />
        <ElementPickerButton
          onElementSelected={(_element: SelectedElement, selector: string) => {
            onChange(selector);
          }}
          nodeId={nodeId}
          targetField={targetField}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

/**
 * NumberField 组件 - 数字输入字段
 */
interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  required?: boolean;
}

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  required = false,
}) => {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
    </div>
  );
};

/**
 * SelectField 组件 - 选择字段
 */
interface SelectFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string | number) => void;
  options: Array<{ value: string | number; label: string }>;
}

const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  onChange,
  options,
}) => {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

/**
 * BooleanField 组件 - 布尔字段
 */
interface BooleanFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const BooleanField: React.FC<BooleanFieldProps> = ({
  label,
  value,
  onChange,
}) => {
  return (
    <div className="mb-3 flex items-center gap-2">
      <input
        type="checkbox"
        id={`boolean-${label}`}
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      <label htmlFor={`boolean-${label}`} className="text-sm text-gray-700">
        {label}
      </label>
    </div>
  );
};

/**
 * PropertyPanel 主组件
 */
export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  className = '',
  onConfigChange,
}) => {
  const { flow, selectedNodes, updateNode, validateFlow } = useDesignerStore();

  // 获取当前选中的节点
  const selectedNode = useMemo(() => {
    if (!flow || selectedNodes.length !== 1) return null;
    return flow.nodes.find((n) => n.id === selectedNodes[0]) || null;
  }, [flow, selectedNodes]);

  // 获取节点定义
  const nodeDefinition = useMemo(() => {
    if (!selectedNode) return null;
    return nodeRegistry.get(selectedNode.type as any);
  }, [selectedNode]);

  /**
   * 处理配置更新
   */
  const handleConfigChange = useCallback(
    (key: string, value: any) => {
      if (!selectedNode) return;

      const currentConfig = selectedNode.data.config || {};
      const newConfig = {
        ...currentConfig,
        [key]: value,
      };

      updateNode(selectedNode.id, {
        data: {
          ...selectedNode.data,
          config: newConfig,
        },
      });

      // 验证节点配置
      const validation = validateNodeConfig(
        selectedNode.type as any,
        newConfig as NodeConfig,
      );
      updateNode(selectedNode.id, {
        data: {
          ...selectedNode.data,
          errors: validation.valid
            ? []
            : validation.errors.map((e) => e.message),
        },
      });

      // 验证整个流程
      setTimeout(() => validateFlow(), 100);

      // 外部回调
      if (onConfigChange) {
        onConfigChange(selectedNode.id, newConfig as NodeConfig);
      }
    },
    [selectedNode, updateNode, validateFlow, onConfigChange],
  );

  // 当节点类型变化时，验证配置
  useEffect(() => {
    if (selectedNode && nodeDefinition) {
      const config = selectedNode.data.config || {};
      const validation = nodeDefinition.validate
        ? nodeDefinition.validate(config as NodeConfig)
        : validateNodeConfig(selectedNode.type as any, config as NodeConfig);

      updateNode(selectedNode.id, {
        data: {
          ...selectedNode.data,
          errors: validation.valid
            ? []
            : validation.errors.map((e) => e.message),
        },
      });
    }
  }, [selectedNode?.type]); // 仅在类型变化时重新验证

  // 渲染配置表单
  const renderConfigForm = () => {
    if (!selectedNode) return null;

    const config = selectedNode.data.config;
    const type = selectedNode.type;

    // 根据节点类型渲染不同的配置项
    switch (type) {
      case 'click':
        return (
          <>
            <TargetField
              label="目标元素"
              value={(config as any).target || ''}
              onChange={(v) => handleConfigChange('target', v)}
              placeholder="例如: 登录按钮"
              required
              nodeId={selectedNode?.id}
              targetField="target"
            />
            <NumberField
              label="点击次数"
              value={(config as any).count || 1}
              onChange={(v) => handleConfigChange('count', v)}
              min={1}
              max={10}
            />
            <BooleanField
              label="双击"
              value={(config as any).doubleClick || false}
              onChange={(v) => handleConfigChange('doubleClick', v)}
            />
            <BooleanField
              label="右键"
              value={(config as any).rightClick || false}
              onChange={(v) => handleConfigChange('rightClick', v)}
            />
            <NumberField
              label="超时时间"
              value={(config as any).timeout || 30000}
              onChange={(v) => handleConfigChange('timeout', v)}
              min={1000}
              max={300000}
              unit="ms"
            />
            <SelectField
              label="失败处理"
              value={(config as any).onFailure || 'stop'}
              onChange={(v) => handleConfigChange('onFailure', v)}
              options={[
                { value: 'stop', label: '停止' },
                { value: 'skip', label: '跳过' },
                { value: 'retry', label: '重试' },
              ]}
            />
          </>
        );

      case 'input':
        return (
          <>
            <TargetField
              label="目标元素"
              value={(config as any).target || ''}
              onChange={(v) => handleConfigChange('target', v)}
              placeholder="例如: 用户名输入框"
              required
              nodeId={selectedNode?.id}
              targetField="target"
            />
            <StringField
              label="输入值"
              value={(config as any).value || ''}
              onChange={(v) => handleConfigChange('value', v)}
              placeholder="支持变量: ${username}"
              required
            />
            <BooleanField
              label="输入前清空"
              value={(config as any).clearBefore !== false}
              onChange={(v) => handleConfigChange('clearBefore', v)}
            />
            <SelectField
              label="提交按键"
              value={(config as any).submitKey || 'none'}
              onChange={(v) => handleConfigChange('submitKey', v)}
              options={[
                { value: 'none', label: '无' },
                { value: 'enter', label: 'Enter' },
                { value: 'tab', label: 'Tab' },
              ]}
            />
            <NumberField
              label="超时时间"
              value={(config as any).timeout || 30000}
              onChange={(v) => handleConfigChange('timeout', v)}
              min={1000}
              max={300000}
              unit="ms"
            />
          </>
        );

      case 'wait':
        return (
          <>
            <NumberField
              label="等待时间"
              value={(config as any).duration || 1000}
              onChange={(v) => handleConfigChange('duration', v)}
              min={100}
              max={60000}
              unit="ms"
              required
            />
            <TargetField
              label="等待元素 (可选)"
              value={(config as any).waitForElement || ''}
              onChange={(v) => handleConfigChange('waitForElement', v)}
              placeholder="留空则等待固定时间"
              nodeId={selectedNode?.id}
              targetField="waitForElement"
            />
          </>
        );

      case 'navigate':
        return (
          <>
            <StringField
              label="URL 地址"
              value={(config as any).url || ''}
              onChange={(v) => handleConfigChange('url', v)}
              placeholder="https://example.com"
              required
            />
            <BooleanField
              label="等待加载完成"
              value={(config as any).waitForLoad !== false}
              onChange={(v) => handleConfigChange('waitForLoad', v)}
            />
          </>
        );

      case 'ifElse':
        return (
          <>
            <StringField
              label="条件描述"
              value={(config as any).condition || ''}
              onChange={(v) => handleConfigChange('condition', v)}
              placeholder="例如: 登录成功"
              multiline
              required
            />
            <StringField
              label="True 分支标签"
              value={(config as any).trueLabel || 'True'}
              onChange={(v) => handleConfigChange('trueLabel', v)}
            />
            <StringField
              label="False 分支标签"
              value={(config as any).falseLabel || 'False'}
              onChange={(v) => handleConfigChange('falseLabel', v)}
            />
          </>
        );

      case 'loop':
        return (
          <>
            <SelectField
              label="循环类型"
              value={(config as any).type || 'count'}
              onChange={(v) => handleConfigChange('type', v)}
              options={[
                { value: 'count', label: '计数循环' },
                { value: 'while', label: '条件循环' },
                { value: 'forEach', label: '遍历循环' },
              ]}
            />
            {(config as any).type === 'count' && (
              <NumberField
                label="循环次数"
                value={(config as any).count || 3}
                onChange={(v) => handleConfigChange('count', v)}
                min={1}
                max={1000}
              />
            )}
            {(config as any).type === 'while' && (
              <StringField
                label="循环条件"
                value={(config as any).whileCondition || ''}
                onChange={(v) => handleConfigChange('whileCondition', v)}
                placeholder="例如: 还有更多数据"
                multiline
              />
            )}
            {(config as any).type === 'forEach' && (
              <>
                <StringField
                  label="数据源"
                  value={(config as any).forEachCollection || ''}
                  onChange={(v) => handleConfigChange('forEachCollection', v)}
                  placeholder="例如: ${dataList}"
                />
                <StringField
                  label="元素变量名"
                  value={(config as any).itemVariable || 'item'}
                  onChange={(v) => handleConfigChange('itemVariable', v)}
                />
              </>
            )}
            <NumberField
              label="最大迭代次数"
              value={(config as any).maxIterations || 50}
              onChange={(v) => handleConfigChange('maxIterations', v)}
              min={1}
              max={1000}
            />
          </>
        );

      case 'setVariable':
        return (
          <>
            <StringField
              label="变量名"
              value={(config as any).name || ''}
              onChange={(v) => handleConfigChange('name', v)}
              placeholder="myVariable"
              required
            />
            <StringField
              label="变量值"
              value={(config as any).value || ''}
              onChange={(v) => handleConfigChange('value', v)}
              placeholder="支持表达式: ${otherVar} + 1"
              required
            />
            <SelectField
              label="变量类型"
              value={(config as any).valueType || 'string'}
              onChange={(v) => handleConfigChange('valueType', v)}
              options={[
                { value: 'string', label: '字符串' },
                { value: 'number', label: '数字' },
                { value: 'boolean', label: '布尔值' },
                { value: 'array', label: '数组' },
                { value: 'object', label: '对象' },
              ]}
            />
          </>
        );

      case 'extractData':
        return (
          <>
            <TargetField
              label="目标元素"
              value={(config as any).target || ''}
              onChange={(v) => handleConfigChange('target', v)}
              placeholder="例如: 数据列表"
              required
              nodeId={selectedNode?.id}
              targetField="target"
            />
            <SelectField
              label="提取类型"
              value={(config as any).extractType || 'text'}
              onChange={(v) => handleConfigChange('extractType', v)}
              options={[
                { value: 'text', label: '文本内容' },
                { value: 'attribute', label: '属性值' },
                { value: 'count', label: '元素数量' },
                { value: 'boundingRect', label: '位置尺寸' },
              ]}
            />
            {(config as any).extractType === 'attribute' && (
              <StringField
                label="属性名"
                value={(config as any).attribute || ''}
                onChange={(v) => handleConfigChange('attribute', v)}
                placeholder="例如: href"
              />
            )}
            <StringField
              label="保存到变量"
              value={(config as any).variable || ''}
              onChange={(v) => handleConfigChange('variable', v)}
              placeholder="extractedData"
              required
            />
          </>
        );

      case 'assertExists':
        return (
          <>
            <TargetField
              label="目标元素"
              value={(config as any).target || ''}
              onChange={(v) => handleConfigChange('target', v)}
              placeholder="例如: 成功提示"
              required
              nodeId={selectedNode?.id}
              targetField="target"
            />
            <SelectField
              label="期望状态"
              value={(config as any).state || 'visible'}
              onChange={(v) => handleConfigChange('state', v)}
              options={[
                { value: 'visible', label: '可见' },
                { value: 'hidden', label: '隐藏' },
                { value: 'enabled', label: '可用' },
                { value: 'disabled', label: '禁用' },
              ]}
            />
            <BooleanField
              label="否定断言"
              value={(config as any).negate || false}
              onChange={(v) => handleConfigChange('negate', v)}
            />
          </>
        );

      case 'assertText':
        return (
          <>
            <TargetField
              label="目标元素 (可选)"
              value={(config as any).target || ''}
              onChange={(v) => handleConfigChange('target', v)}
              placeholder="留空则检查整个页面"
              nodeId={selectedNode?.id}
              targetField="target"
            />
            <StringField
              label="期望文本"
              value={(config as any).text || ''}
              onChange={(v) => handleConfigChange('text', v)}
              placeholder="要验证的文本"
              required
            />
            <SelectField
              label="匹配方式"
              value={(config as any).operator || 'contains'}
              onChange={(v) => handleConfigChange('operator', v)}
              options={[
                { value: 'equals', label: '完全匹配' },
                { value: 'contains', label: '包含' },
                { value: 'matches', label: '正则匹配' },
                { value: 'startsWith', label: '开头是' },
                { value: 'endsWith', label: '结尾是' },
              ]}
            />
          </>
        );

      case 'aiAssert':
        return (
          <StringField
            label="断言描述"
            value={(config as any).assertion || ''}
            onChange={(v) => handleConfigChange('assertion', v)}
            placeholder="例如: 页面显示登录成功提示"
            multiline
            required
          />
        );

      case 'comment':
        return (
          <StringField
            label="注释内容"
            value={(config as any).content || ''}
            onChange={(v) => handleConfigChange('content', v)}
            placeholder="输入注释内容..."
            multiline
            required
          />
        );

      case 'scroll':
        return (
          <>
            <TargetField
              label="目标元素 (可选)"
              value={(config as any).target || ''}
              onChange={(v) => handleConfigChange('target', v)}
              placeholder="留空则滚动页面"
              nodeId={selectedNode?.id}
              targetField="target"
            />
            <SelectField
              label="滚动方向"
              value={(config as any).direction || 'down'}
              onChange={(v) => handleConfigChange('direction', v)}
              options={[
                { value: 'up', label: '向上' },
                { value: 'down', label: '向下' },
                { value: 'left', label: '向左' },
                { value: 'right', label: '向右' },
                { value: 'intoView', label: '滚动到元素' },
              ]}
            />
            <NumberField
              label="滚动距离"
              value={(config as any).distance || 300}
              onChange={(v) => handleConfigChange('distance', v)}
              min={10}
              max={10000}
              unit="px"
            />
          </>
        );

      case 'hover':
        return (
          <>
            <TargetField
              label="目标元素"
              value={(config as any).target || ''}
              onChange={(v) => handleConfigChange('target', v)}
              placeholder="例如: 菜单项"
              required
              nodeId={selectedNode?.id}
              targetField="target"
            />
            <NumberField
              label="持续时间"
              value={(config as any).duration || 500}
              onChange={(v) => handleConfigChange('duration', v)}
              min={100}
              max={10000}
              unit="ms"
            />
          </>
        );

      case 'drag':
        return (
          <>
            <TargetField
              label="源元素"
              value={(config as any).from || ''}
              onChange={(v) => handleConfigChange('from', v)}
              placeholder="被拖拽的元素"
              required
              nodeId={selectedNode?.id}
              targetField="from"
            />
            <TargetField
              label="目标元素"
              value={(config as any).to || ''}
              onChange={(v) => handleConfigChange('to', v)}
              placeholder="放置目标"
              required
              nodeId={selectedNode?.id}
              targetField="to"
            />
          </>
        );

      case 'parallel':
        return (
          <NumberField
            label="分支数"
            value={(config as any).branches || 2}
            onChange={(v) => handleConfigChange('branches', v)}
            min={2}
            max={10}
          />
        );

      case 'group':
        return (
          <>
            <StringField
              label="分组标签"
              value={(config as any).label || ''}
              onChange={(v) => handleConfigChange('label', v)}
              placeholder="例如: 登录流程"
            />
            <BooleanField
              label="折叠状态"
              value={(config as any).collapsed || false}
              onChange={(v) => handleConfigChange('collapsed', v)}
            />
            <StringField
              label="背景颜色"
              value={(config as any).color || '#f3f4f6'}
              onChange={(v) => handleConfigChange('color', v)}
              placeholder="#f3f4f6"
            />
          </>
        );

      case 'externalData':
        return (
          <>
            <StringField
              label="数据源 URL"
              value={(config as any).source || ''}
              onChange={(v) => handleConfigChange('source', v)}
              placeholder="https://example.com/data.json"
              required
            />
            <SelectField
              label="数据格式"
              value={(config as any).format || 'json'}
              onChange={(v) => handleConfigChange('format', v)}
              options={[
                { value: 'json', label: 'JSON' },
                { value: 'csv', label: 'CSV' },
                { value: 'yaml', label: 'YAML' },
              ]}
            />
            <StringField
              label="保存到变量"
              value={(config as any).variable || ''}
              onChange={(v) => handleConfigChange('variable', v)}
              placeholder="externalData"
              required
            />
          </>
        );

      default:
        return <p className="text-sm text-gray-500">此节点类型无可配置项</p>;
    }
  };

  // 没有选中节点
  if (!selectedNode) {
    return (
      <div
        className={`property-panel bg-white border-l border-gray-200 p-4 ${className}`}
      >
        <h3 className="text-sm font-semibold text-gray-700 mb-3">属性面板</h3>
        <p className="text-sm text-gray-500 text-center py-8">
          点击节点查看和编辑属性
        </p>
      </div>
    );
  }

  return (
    <div
      className={`property-panel bg-white border-l border-gray-200 overflow-y-auto ${className}`}
    >
      <div className="p-4">
        {/* 节点标题 */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b">
          <span className="text-lg" aria-label="node-icon">
            {nodeDefinition?.icon || '•'}
          </span>
          <h3 className="text-sm font-semibold text-gray-700 flex-1">
            {String(selectedNode.data.label || '')}
          </h3>
          <span className="text-xs text-gray-500">{selectedNode.type}</span>
        </div>

        {/* 节点描述 */}
        <StringField
          label="节点描述"
          value={String(selectedNode.data.description || '')}
          onChange={(v) =>
            updateNode(selectedNode.id, {
              data: { ...selectedNode.data, description: v },
            })
          }
          placeholder="可选的节点描述"
          multiline
        />

        {/* 配置表单 */}
        <div className="mt-4">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            配置
          </h4>
          {renderConfigForm()}
        </div>

        {/* 节点错误 */}
        {(selectedNode.data.errors as string[] | undefined)?.length &&
          (selectedNode.data.errors as string[]).length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <h4 className="text-xs font-medium text-red-700 mb-2">
                ❌ 配置错误
              </h4>
              {(selectedNode.data.errors as string[]).map(
                (error: string, i: number) => (
                  <p key={i} className="text-xs text-red-600">
                    • {error}
                  </p>
                ),
              )}
            </div>
          )}

        {/* 节点警告 */}
        {(selectedNode.data.warnings as string[] | undefined)?.length &&
          (selectedNode.data.warnings as string[]).length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <h4 className="text-xs font-medium text-yellow-700 mb-2">
                ⚠️ 警告
              </h4>
              {(selectedNode.data.warnings as string[]).map(
                (warning: string, i: number) => (
                  <p key={i} className="text-xs text-yellow-600">
                    • {warning}
                  </p>
                ),
              )}
            </div>
          )}

        {/* 节点 ID */}
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-gray-400">ID: {selectedNode.id}</p>
        </div>
      </div>
    </div>
  );
};

export default PropertyPanel;
