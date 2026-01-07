/**
 * Element Picker Component
 * 元素选择器 - 从页面中选择元素并生成选择器
 */

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Image,
  Input,
  List,
  Modal,
  Radio,
  Space,
  Tag,
  Tooltip,
  message,
  Spin,
} from 'antd';
import {
  AimOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  ReloadOutlined,
  CameraOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { ElementSelector as Selector, SelectedElement } from '../../types/elementRepair';
import { useDesignerStore } from '../store/designerStore';

const SELECTOR_TYPE_COLORS: Record<string, string> = {
  'data-testid': 'gold',
  css: 'blue',
  xpath: 'purple',
  text: 'green',
  semantic: 'orange',
};

interface ElementPickerProps {
  visible?: boolean;
  onClose?: () => void;
  onElementSelected?: (element: SelectedElement, selector: string) => void;
  nodeId?: string; // 节点 ID，用于更新节点配置
  targetField?: string; // 目标字段名，例如 'target'
}

interface SelectorValidation {
  isValid: boolean;
  elementCount: number;
  error?: string;
}

/**
 * Element Picker Component
 */
export function ElementPicker({
  visible = false,
  onClose,
  onElementSelected,
  nodeId,
  targetField = 'target',
}: ElementPickerProps) {
  const flow = useDesignerStore((state) => state.flow);
  const updateNode = useDesignerStore((state) => state.updateNode);

  const [selectionState, setSelectionState] = useState<'idle' | 'selecting' | 'selected'>('idle');
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [selectedSelector, setSelectedSelector] = useState<string>('');
  const [selectorValidation, setSelectorValidation] = useState<SelectorValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [customSelector, setCustomSelector] = useState('');

  const currentFrameRef = useRef<HTMLIFrameElement | null>(null);

  /**
   * 获取当前活动标签页的内容脚本
   */
  const getCurrentTab = async () => {
    return new Promise<chrome.tabs.Tab>((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]);
      });
    });
  };

  /**
   * 向内容脚本发送消息
   */
  const sendMessage = async (message: any): Promise<any> => {
    const tab = await getCurrentTab();
    if (!tab.id) throw new Error('No active tab');

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id!, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  };

  /**
   * 开始选择模式
   */
  const handleStartSelection = async () => {
    try {
      setSelectionState('selecting');

      // 发送消息到内容脚本启动选择模式
      await sendMessage({
        type: 'MIDSCENE_START_ELEMENT_SELECTION',
        config: {
          highlightElements: true,
          showTooltip: true,
          filterInvisible: true,
        },
      });

      message.info('点击页面上的元素进行选择，按 ESC 取消');
    } catch (error) {
      console.error('Failed to start element selection:', error);
      message.error('无法启动元素选择模式');
      setSelectionState('idle');
    }
  };

  /**
   * 停止选择模式
   */
  const handleStopSelection = async () => {
    try {
      await sendMessage({
        type: 'MIDSCENE_STOP_ELEMENT_SELECTION',
      });
      setSelectionState('idle');
    } catch (error) {
      console.error('Failed to stop element selection:', error);
    }
  };

  /**
   * 监听来自内容脚本的消息
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'MIDSCENE_ELEMENT_SELECTED') {
        const element = event.data.element as SelectedElement;
        handleElementSelected(element);
      }
    };

    window.addEventListener('message', handleMessage);

    // 清理函数
    return () => {
      window.removeEventListener('message', handleMessage);
      if (selectionState === 'selecting') {
        handleStopSelection();
      }
    };
  }, [selectionState]);

  /**
   * 处理元素被选中
   */
  const handleElementSelected = (element: SelectedElement) => {
    setSelectedElement(element);
    setSelectionState('selected');

    // 默认选择优先级最高的选择器
    if (element.suggestedSelectors.length > 0) {
      const bestSelector = element.suggestedSelectors[0];
      setSelectedSelector(bestSelector.value);
    }
  };

  /**
   * 验证选择器
   */
  const handleValidateSelector = async (selector: string) => {
    if (!selector) return;

    setValidating(true);
    try {
      const result = await sendMessage({
        type: 'MIDSCENE_VALIDATE_SELECTOR',
        selector,
      });

      setSelectorValidation({
        isValid: result.valid,
        elementCount: result.count || 0,
        error: result.error,
      });
    } catch (error) {
      setSelectorValidation({
        isValid: false,
        elementCount: 0,
        error: '验证失败',
      });
    } finally {
      setValidating(false);
    }
  };

  /**
   * 选择器变更时验证
   */
  useEffect(() => {
    if (selectedSelector && selectionState === 'selected') {
      handleValidateSelector(selectedSelector);
    }
  }, [selectedSelector, selectionState]);

  /**
   * 确认选择
   */
  const handleConfirm = () => {
    if (!selectedElement) {
      message.error('请先选择元素');
      return;
    }

    const finalSelector = customSelector || selectedSelector;

    // 更新节点配置
    if (nodeId && flow) {
      const node = flow.nodes.find((n) => n.id === nodeId);
      if (node && node.data.config) {
        updateNode(nodeId, {
          data: {
            ...node.data,
            config: {
              ...node.data.config,
              [targetField]: finalSelector,
            },
          },
        });
      }
    }

    // 回调
    if (onElementSelected) {
      onElementSelected(selectedElement, finalSelector);
    }

    message.success('元素已选择');
    handleClose();
  };

  /**
   * 取消选择
   */
  const handleClose = () => {
    setSelectionState('idle');
    setSelectedElement(null);
    setSelectedSelector('');
    setSelectorValidation(null);
    setCustomSelector('');
    onClose?.();
  };

  /**
   * 复制选择器到剪贴板
   */
  const handleCopySelector = (selector: string) => {
    navigator.clipboard.writeText(selector);
    message.success('已复制到剪贴板');
  };

  /**
   * 重新选择
   */
  const handleReselect = () => {
    setSelectedElement(null);
    setSelectedSelector('');
    setSelectorValidation(null);
    setCustomSelector('');
    handleStartSelection();
  };

  /**
   * 渲染选择器列表
   */
  const renderSelectors = () => {
    if (!selectedElement) return null;

    return (
      <div>
        <h4 style={{ marginBottom: 12 }}>建议的选择器</h4>
        <List
          size="small"
          dataSource={selectedElement.suggestedSelectors}
          renderItem={(item: Selector) => (
            <List.Item
              style={{
                cursor: 'pointer',
                background: selectedSelector === item.value ? '#e6f7ff' : undefined,
                padding: '8px 12px',
                borderRadius: 4,
              }}
              onClick={() => {
                setSelectedSelector(item.value);
                setCustomSelector('');
              }}
            >
              <List.Item.Meta
                avatar={
                  <Radio
                    checked={selectedSelector === item.value && !customSelector}
                    onChange={() => {
                      setSelectedSelector(item.value);
                      setCustomSelector('');
                    }}
                  />
                }
                title={
                  <Space>
                    <Tag color={SELECTOR_TYPE_COLORS[item.type] || 'default'}>
                      {item.type}
                    </Tag>
                    <code style={{ fontSize: 12 }}>{item.value}</code>
                  </Space>
                }
                description={
                  <Space size="small">
                    <span style={{ color: '#999' }}>
                      优先级: {item.priority}
                    </span>
                    <span>·</span>
                    <span style={{ color: '#666' }}>{item.reason}</span>
                  </Space>
                }
              />
              <Tooltip title="复制">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopySelector(item.value);
                  }}
                />
              </Tooltip>
            </List.Item>
          )}
        />
      </div>
    );
  };

  /**
   * 渲染自定义选择器输入
   */
  const renderCustomSelector = () => {
    return (
      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 8 }}>自定义选择器</h4>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="输入自定义选择器 (CSS, XPath, 或 text=...)"
            value={customSelector}
            onChange={(e) => {
              setCustomSelector(e.target.value);
              if (e.target.value) {
                setSelectedSelector('');
                handleValidateSelector(e.target.value);
              }
            }}
            onPressEnter={() => customSelector && setSelectedSelector(customSelector)}
          />
          <Button
            type={customSelector ? 'primary' : 'default'}
            onClick={() => {
              if (customSelector) {
                setSelectedSelector(customSelector);
              }
            }}
          >
            使用
          </Button>
        </Space.Compact>
      </div>
    );
  };

  /**
   * 渲染验证状态
   */
  const renderValidationStatus = () => {
    if (!selectorValidation) return null;

    const { isValid, elementCount, error } = selectorValidation;

    return (
      <div style={{ marginTop: 16 }}>
        <Space>
          {isValid ? (
            <Tag color="success" icon={<CheckOutlined />}>
              找到 {elementCount} 个元素
            </Tag>
          ) : (
            <Tag color="error" icon={<CloseOutlined />}>
              {error || '未找到元素'}
            </Tag>
          )}
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleValidateSelector(customSelector || selectedSelector)}
          >
            重新验证
          </Button>
        </Space>
      </div>
    );
  };

  /**
   * 渲染元素信息
   */
  const renderElementInfo = () => {
    if (!selectedElement) return null;

    const { attributes, semanticDescription, rect } = selectedElement;

    return (
      <Card size="small" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {/* 语义描述 */}
          {semanticDescription && (
            <div>
              <span style={{ color: '#666', fontSize: 12 }}>AI 描述: </span>
              <span style={{ fontStyle: 'italic' }}>{semanticDescription}</span>
            </div>
          )}

          {/* 元素属性 */}
          <div>
            <span style={{ color: '#666', fontSize: 12 }}>元素属性: </span>
            <Space wrap size="small">
              {attributes.id && (
                <Tag>id: <code>{attributes.id}</code></Tag>
              )}
              {attributes.class && (
                <Tag>class: <code>{attributes.class}</code></Tag>
              )}
              <Tag>
                {rect.width}×{rect.height}
              </Tag>
            </Space>
          </div>
        </Space>
      </Card>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <AimOutlined />
          <span>选择页面元素</span>
          {nodeId && <Tag>节点: {nodeId.slice(0, 8)}...</Tag>}
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={600}
      footer={
        <Space>
          <Button onClick={handleClose}>取消</Button>
          {selectionState === 'selecting' && (
            <Button danger onClick={handleStopSelection}>
              停止选择
            </Button>
          )}
          {selectionState === 'selected' && (
            <>
              <Button onClick={handleReselect} icon={<AimOutlined />}>
                重新选择
              </Button>
              <Button
                type="primary"
                onClick={handleConfirm}
                disabled={!selectedSelector || selectorValidation?.isValid === false}
              >
                确认
              </Button>
            </>
          )}
          {selectionState === 'idle' && (
            <Button type="primary" onClick={handleStartSelection} icon={<AimOutlined />}>
              开始选择
            </Button>
          )}
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 选择状态提示 */}
        <div
          style={{
            padding: 12,
            background: selectionState === 'selecting' ? '#e6f7ff' : '#f5f5f5',
            borderRadius: 4,
            textAlign: 'center',
          }}
        >
          {selectionState === 'idle' && (
            <Space>
              <AimOutlined />
              <span>点击"开始选择"按钮，然后在页面上点击要选择的元素</span>
            </Space>
          )}
          {selectionState === 'selecting' && (
            <Space>
              <Spin size="small" />
              <span style={{ color: '#1890ff' }}>
                正在选择中... 请在页面上点击元素
              </span>
            </Space>
          )}
          {selectionState === 'selected' && (
            <Space>
              <CheckOutlined style={{ color: '#52c41a' }} />
              <span>已选择元素</span>
            </Space>
          )}
        </div>

        {/* 元素信息 */}
        {renderElementInfo()}

        {/* 选择器列表 */}
        {renderSelectors()}

        {/* 自定义选择器 */}
        {renderCustomSelector()}

        {/* 验证状态 */}
        {renderValidationStatus()}
      </Space>
    </Modal>
  );
}

/**
 * 内联选择器按钮 (触发选择模式的快捷按钮)
 */
export function ElementPickerButton({
  onElementSelected,
  nodeId,
  targetField,
  disabled,
}: {
  onElementSelected?: (element: SelectedElement, selector: string) => void;
  nodeId?: string;
  targetField?: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Tooltip title="选择页面元素">
        <Button
          icon={<AimOutlined />}
          onClick={() => setVisible(true)}
          disabled={disabled}
        >
          选择元素
        </Button>
      </Tooltip>
      <ElementPicker
        visible={visible}
        onClose={() => setVisible(false)}
        onElementSelected={onElementSelected}
        nodeId={nodeId}
        targetField={targetField}
      />
    </>
  );
}

export default ElementPicker;
