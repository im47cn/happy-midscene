/**
 * Visual Designer Types
 * 可视化测试设计器类型定义 - 支持 React Flow 节点编辑器
 */

import type { Connection, Edge, Node } from '@xyflow/react';

/**
 * 节点类型枚举
 */
export type NodeType =
  // 特殊节点
  | 'start'
  | 'end'
  | 'comment'
  | 'subflow'
  // 动作节点
  | 'click'
  | 'input'
  | 'scroll'
  | 'wait'
  | 'navigate'
  | 'hover'
  | 'drag'
  // 验证节点
  | 'assertExists'
  | 'assertText'
  | 'assertState'
  | 'aiAssert'
  // 控制节点
  | 'ifElse'
  | 'loop'
  | 'parallel'
  | 'group'
  // 数据节点
  | 'setVariable'
  | 'extractData'
  | 'externalData';

/**
 * 节点分类
 */
export type NodeCategory =
  | 'special'
  | 'action'
  | 'validation'
  | 'control'
  | 'data';

/**
 * 失败处理策略
 */
export type OnFailure = 'stop' | 'skip' | 'retry';

/**
 * 循环类型
 */
export type LoopType = 'count' | 'while' | 'forEach';

/**
 * 条件操作符
 */
export type ComparisonOperator =
  | '=='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'contains'
  | 'matches';

/**
 * 变量类型
 */
export type VariableType = 'string' | 'number' | 'boolean' | 'array' | 'object';

/**
 * 基础节点配置
 */
export interface BaseNodeConfig {
  /** 超时时间 (ms) */
  timeout?: number;
  /** 失败处理策略 */
  onFailure?: OnFailure;
  /** 自定义描述 */
  description?: string;
}

/**
 * 点击节点配置
 */
export interface ClickNodeConfig extends BaseNodeConfig {
  /** 目标元素描述 (自然语言) */
  target: string;
  /** 点击次数 */
  count?: number;
  /** 双击 */
  doubleClick?: boolean;
  /** 右键 */
  rightClick?: boolean;
  /** 按键组合 */
  modifiers?: {
    alt?: boolean;
    ctrl?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
}

/**
 * 输入节点配置
 */
export interface InputNodeConfig extends BaseNodeConfig {
  /** 目标元素描述 */
  target: string;
  /** 输入值 (支持变量 ${var}) */
  value: string;
  /** 输入前清空 */
  clearBefore?: boolean;
  /** 触发按键 */
  submitKey?: 'enter' | 'tab' | 'none';
}

/**
 * 滚动节点配置
 */
export interface ScrollNodeConfig extends BaseNodeConfig {
  /** 目标元素描述 (可选，不填则滚动页面) */
  target?: string;
  /** 滚动方向 */
  direction?: 'up' | 'down' | 'left' | 'right' | 'intoView';
  /** 滚动距离 (px) */
  distance?: number;
  /** 滚动到元素 */
  intoView?: boolean;
}

/**
 * 等待节点配置
 */
export interface WaitNodeConfig extends BaseNodeConfig {
  /** 等待时间 (ms) */
  duration: number;
  /** 或等待元素出现 */
  waitForElement?: string;
}

/**
 * 导航节点配置
 */
export interface NavigateNodeConfig extends BaseNodeConfig {
  /** URL 地址 */
  url: string;
  /** 等待页面加载完成 */
  waitForLoad?: boolean;
}

/**
 * 悬停节点配置
 */
export interface HoverNodeConfig extends BaseNodeConfig {
  /** 目标元素描述 */
  target: string;
  /** 悬停持续时间 (ms) */
  duration?: number;
}

/**
 * 拖拽节点配置
 */
export interface DragNodeConfig extends BaseNodeConfig {
  /** 源元素描述 */
  from: string;
  /** 目标元素描述 */
  to: string;
  /** 拖拽持续时间 (ms) */
  duration?: number;
}

/**
 * 断言存在节点配置
 */
export interface AssertExistsNodeConfig extends BaseNodeConfig {
  /** 目标元素描述 */
  target: string;
  /** 期望状态 */
  state?: 'visible' | 'hidden' | 'enabled' | 'disabled';
  /** 否定断言 */
  negate?: boolean;
}

/**
 * 断言文本节点配置
 */
export interface AssertTextNodeConfig extends BaseNodeConfig {
  /** 目标元素描述 */
  target: string;
  /** 期望文本 */
  text: string;
  /** 匹配方式 */
  operator?: 'equals' | 'contains' | 'matches' | 'startsWith' | 'endsWith';
}

/**
 * 断言状态节点配置
 */
export interface AssertStateNodeConfig extends BaseNodeConfig {
  /** 目标元素描述 */
  target: string;
  /** 期望状态 */
  state: 'checked' | 'unchecked' | 'selected' | 'focused' | 'readonly';
  /** 否定断言 */
  negate?: boolean;
}

/**
 * AI 断言节点配置
 */
export interface AiAssertNodeConfig extends BaseNodeConfig {
  /** 自然语言断言描述 */
  assertion: string;
}

/**
 * 条件分支节点配置
 */
export interface IfElseNodeConfig extends BaseNodeConfig {
  /** 条件描述 (自然语言) */
  condition: string;
  /** True 分支标签 */
  trueLabel?: string;
  /** False 分支标签 */
  falseLabel?: string;
}

/**
 * 循环节点配置
 */
export interface LoopNodeConfig extends BaseNodeConfig {
  /** 循环类型 */
  type: LoopType;
  /** 计数循环: 次数 */
  count?: number;
  /** 条件循环: 条件描述 */
  whileCondition?: string;
  /** 遍历循环: 数据源 */
  forEachCollection?: string;
  /** 遍历循环: 元素变量名 */
  itemVariable?: string;
  /** 最大迭代次数 */
  maxIterations?: number;
}

/**
 * 并行节点配置
 */
export interface ParallelNodeConfig extends BaseNodeConfig {
  /** 并行分支数 */
  branches: number;
  /** 是否等待所有分支完成 */
  waitAll?: boolean;
}

/**
 * 分组节点配置
 */
export interface GroupNodeConfig extends BaseNodeConfig {
  /** 分组标签 */
  label?: string;
  /** 折叠状态 */
  collapsed?: boolean;
  /** 背景颜色 */
  color?: string;
}

/**
 * 设置变量节点配置
 */
export interface SetVariableNodeConfig extends BaseNodeConfig {
  /** 变量名 */
  name: string;
  /** 变量值 (支持表达式) */
  value: string;
  /** 变量类型 */
  valueType?: VariableType;
}

/**
 * 提取数据节点配置
 */
export interface ExtractDataNodeConfig extends BaseNodeConfig {
  /** 目标元素描述 */
  target: string;
  /** 提取类型 */
  extractType: 'text' | 'attribute' | 'count' | 'boundingRect';
  /** 属性名 (当 extractType 为 attribute 时) */
  attribute?: string;
  /** 保存到变量名 */
  variable: string;
}

/**
 * 外部数据节点配置
 */
export interface ExternalDataNodeConfig extends BaseNodeConfig {
  /** 数据源 URL 或文件路径 */
  source: string;
  /** 数据格式 */
  format: 'json' | 'csv' | 'yaml';
  /** 保存到变量名 */
  variable: string;
}

/**
 * 注释节点配置
 */
export interface CommentNodeConfig {
  /** 注释内容 */
  content: string;
  /** 背景颜色 */
  color?: string;
}

/**
 * 子流程节点配置
 */
export interface SubflowNodeConfig extends BaseNodeConfig {
  /** 子流程 ID 或路径 */
  subflowId: string;
  /** 参数映射 */
  parameters?: Record<string, string>;
}

/**
 * 开始节点配置
 */
export interface StartNodeConfig {
  /** 初始变量 */
  variables?: Record<string, any>;
}

/**
 * 结束节点配置
 */
export interface EndNodeConfig {
  /** 返回值 */
  returnValue?: string;
}

/**
 * 节点配置联合类型
 */
export type NodeConfig =
  | ClickNodeConfig
  | InputNodeConfig
  | ScrollNodeConfig
  | WaitNodeConfig
  | NavigateNodeConfig
  | HoverNodeConfig
  | DragNodeConfig
  | AssertExistsNodeConfig
  | AssertTextNodeConfig
  | AssertStateNodeConfig
  | AiAssertNodeConfig
  | IfElseNodeConfig
  | LoopNodeConfig
  | ParallelNodeConfig
  | GroupNodeConfig
  | SetVariableNodeConfig
  | ExtractDataNodeConfig
  | ExternalDataNodeConfig
  | CommentNodeConfig
  | SubflowNodeConfig
  | StartNodeConfig
  | EndNodeConfig;

/**
 * 节点数据接口
 * Extends Record<string, unknown> for React Flow compatibility
 */
export interface DesignerNodeData extends Record<string, unknown> {
  /** 节点标签 */
  label: string;
  /** 节点描述 */
  description?: string;
  /** 节点配置 */
  config?: NodeConfig;
  /** 验证错误列表 */
  errors?: string[];
  /** 验证警告列表 */
  warnings?: string[];
  /** 是否可编辑 */
  editable?: boolean;
  /** 是否可删除 */
  deletable?: boolean;
}

/**
 * 设计器节点类型 (扩展 React Flow Node)
 */
export type DesignerNode = Node;

/**
 * 设计器连线类型 (扩展 React Flow Edge)
 */
export interface DesignerEdge extends Edge {
  /** 连线类型 */
  type?: 'default' | 'conditional' | 'loop';
  /** 连线数据 */
  data?: {
    /** 条件表达式 (用于条件连线) */
    condition?: string;
    /** 连线标签 */
    label?: string;
  };
}

/**
 * 变量定义
 */
export interface VariableDefinition {
  /** 变量名 */
  name: string;
  /** 变量类型 */
  type: VariableType;
  /** 默认值 */
  defaultValue?: any;
  /** 变量描述 */
  description?: string;
}

/**
 * 测试流程定义
 */
export interface TestFlow {
  /** 流程 ID */
  id: string;
  /** 流程名称 */
  name: string;
  /** 流程描述 */
  description?: string;
  /** 流程版本 */
  version: number;
  /** 节点列表 */
  nodes: DesignerNode[];
  /** 连线列表 */
  edges: DesignerEdge[];
  /** 变量定义 */
  variables: VariableDefinition[];
  /** 元数据 */
  metadata: {
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
    /** 作者 */
    author?: string;
    /** 标签 */
    tags?: string[];
    /** 其他扩展属性 */
    [key: string]: any;
  };
}

/**
 * YAML 步骤格式
 */
export interface YamlStep {
  /** 动作类型 */
  [key: string]: any;
}

/**
 * YAML 文档格式
 */
export interface YamlDocument {
  /** 流程名称 */
  name: string;
  /** 流程描述 */
  description?: string;
  /** 变量定义 */
  variables?: Record<string, any>;
  /** 流程步骤 */
  flow?: YamlStep[];
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: ValidationError[];
  /** 警告列表 */
  warnings: ValidationWarning[];
}

/**
 * 验证错误
 */
export interface ValidationError {
  /** 错误类型 */
  type: 'structure' | 'connection' | 'configuration' | 'cycle';
  /** 错误消息 */
  message: string;
  /** 关联节点 ID */
  nodeId?: string;
  /** 关联连线 ID */
  edgeId?: string;
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  /** 警告类型 */
  type: 'performance' | 'usability' | 'optimization';
  /** 警告消息 */
  message: string;
  /** 关联节点 ID */
  nodeId?: string;
  /** 建议 */
  suggestion?: string;
}

/**
 * 节点定义 (用于节点注册表)
 */
export interface NodeDefinition {
  /** 节点类型 */
  type: NodeType;
  /** 节点标签 */
  label: string;
  /** 节点分类 */
  category: NodeCategory;
  /** 节点图标 (React 组件名或字符串) */
  icon: string;
  /** 默认配置 */
  defaultConfig: Partial<NodeConfig>;
  /** 输入端口定义 */
  inputs: PortDefinition[];
  /** 输出端口定义 */
  outputs: PortDefinition[];
  /** 配置 Schema (JSON Schema 格式) */
  configSchema?: ConfigSchema;
  /** 配置验证函数 */
  validate?: (config: NodeConfig) => ValidationResult;
  /** 转换为 YAML 步骤 */
  toYaml: (node: DesignerNode) => YamlStep[];
  /** 从 YAML 步骤创建节点配置 */
  fromYaml?: (step: YamlStep) => NodeConfig;
}

/**
 * 端口定义
 */
export interface PortDefinition {
  /** 端口 ID */
  id: string;
  /** 端口标签 */
  label: string;
  /** 端口类型 */
  type: 'default' | 'conditional' | 'loop';
  /** 最大连接数 */
  maxConnections?: number;
  /** 样式类名 */
  className?: string;
}

/**
 * 配置 Schema
 */
export interface ConfigSchema {
  /** Schema 类型 */
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  /** 属性定义 */
  properties?: Record<string, ConfigSchema>;
  /** 必填字段 */
  required?: string[];
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
  /** 默认值 */
  default?: any;
  /** 枚举值 */
  enum?: any[];
  /** 最小值 */
  minimum?: number;
  /** 最大值 */
  maximum?: number;
}

/**
 * 设计器状态
 */
export interface DesignerState {
  /** 当前流程 */
  flow: TestFlow | null;
  /** 选中节点 */
  selectedNodes: string[];
  /** 选中连线 */
  selectedEdges: string[];
  /** 剪贴板 (用于复制粘贴) */
  clipboard: {
    nodes: DesignerNode[];
    edges: DesignerEdge[];
  } | null;
  /** 历史记录 (用于撤销重做) */
  history: {
    past: TestFlow[];
    present: TestFlow | null;
    future: TestFlow[];
  };
  /** 验证结果 */
  validationResult: ValidationResult | null;
  /** 加载状态 */
  isLoading: boolean;
  /** 错误消息 */
  error: string | null;
  /** 缩放级别 */
  zoom: number;
  /** 视口位置 */
  viewport: { x: number; y: number };
  /** 是否显示小地图 */
  showMinimap: boolean;
  /** 是否显示网格 */
  showGrid: boolean;
}

/**
 * 设计器存储操作
 */
export interface DesignerActions {
  // 流程操作
  setFlow: (flow: TestFlow) => void;
  createFlow: (name: string) => void;
  loadFlow: (flowData: TestFlow) => void;
  saveFlow: () => void;

  // 节点操作
  addNode: (node: DesignerNode) => void;
  updateNode: (nodeId: string, updates: Partial<DesignerNode>) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;

  // 连线操作
  addEdge: (edge: DesignerEdge) => void;
  deleteEdge: (edgeId: string) => void;

  // 选择操作
  selectNode: (nodeId: string) => void;
  selectNodes: (nodeIds: string[]) => void;
  clearSelection: () => void;

  // 历史操作
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // 视图操作
  setZoom: (zoom: number) => void;
  setViewport: (viewport: { x: number; y: number }) => void;
  fitView: () => void;
  toggleMinimap: () => void;
  toggleGrid: () => void;

  // 验证
  validateFlow: () => ValidationResult;

  // UI 状态
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * 模板定义
 */
export interface FlowTemplate {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description?: string;
  /** 模板分类 */
  category: string;
  /** 预览图 URL */
  preview?: string;
  /** 标签 */
  tags?: string[];
  /** 模板流程 */
  flow: Omit<TestFlow, 'id' | 'metadata'>;
  /** 模板参数 */
  parameters?: TemplateParameter[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 模板参数
 */
export interface TemplateParameter {
  /** 参数名 */
  name: string;
  /** 参数标签 */
  label: string;
  /** 参数描述 */
  description?: string;
  /** 参数类型 */
  type: 'string' | 'number' | 'boolean' | 'select';
  /** 默认值 */
  defaultValue?: any;
  /** 选项 (当 type 为 select 时) */
  options?: { label: string; value: any }[];
  /** 是否必填 */
  required?: boolean;
}

/**
 * 执行状态
 */
export type ExecutionStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

/**
 * 执行结果
 */
export interface ExecutionResult {
  /** 执行状态 */
  status: ExecutionStatus;
  /** 当前步骤索引 */
  currentStepIndex: number;
  /** 当前节点 ID */
  currentNodeId?: string;
  /** 已完成步骤 */
  completedSteps: string[];
  /** 失败步骤 */
  failedSteps: Array<{
    nodeId: string;
    error: string;
  }>;
  /** 执行开始时间 */
  startTime: number;
  /** 执行结束时间 */
  endTime?: number;
  /** 执行输出 */
  output?: Record<string, any>;
}
