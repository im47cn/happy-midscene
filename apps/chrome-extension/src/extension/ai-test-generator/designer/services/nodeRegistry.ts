/**
 * Node Registry Service
 * 节点注册表 - 管理所有节点类型的定义和配置
 */

import type {
  ConfigSchema,
  DesignerNode,
  NodeCategory,
  NodeDefinition,
  NodeType,
  PortDefinition,
  ValidationResult,
  YamlStep,
} from '../../types/designer';

/**
 * 生成唯一 ID
 */
export function generateId(prefix: string = 'node'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 节点图标映射
 */
const NODE_ICONS: Record<NodeCategory, string> = {
  special: '⭐',
  action: '▶️',
  validation: '✓',
  control: '⊞',
  data: '📊',
} as const;

/**
 * 节点标签映射
 */
const NODE_LABELS: Record<NodeType, string> = {
  // 特殊节点
  start: '开始',
  end: '结束',
  comment: '注释',
  subflow: '子流程',
  // 动作节点
  click: '点击',
  input: '输入',
  scroll: '滚动',
  wait: '等待',
  navigate: '导航',
  hover: '悬停',
  drag: '拖拽',
  // 验证节点
  assertExists: '断言存在',
  assertText: '断言文本',
  assertState: '断言状态',
  aiAssert: 'AI 断言',
  // 控制节点
  ifElse: '条件分支',
  loop: '循环',
  parallel: '并行',
  group: '分组',
  // 数据节点
  setVariable: '设置变量',
  extractData: '提取数据',
  externalData: '外部数据',
} as const;

/**
 * 默认端口定义
 */
const DEFAULT_PORTS = {
  singleInput: [{ id: 'in', label: '输入', type: 'default' as const, maxConnections: 1 }] as PortDefinition[],
  singleOutput: [{ id: 'out', label: '输出', type: 'default' as const }] as PortDefinition[],
  multiInput: [{ id: 'in', label: '输入', type: 'default' as const }] as PortDefinition[],
  multiOutput: [{ id: 'out', label: '输出', type: 'default' as const }] as PortDefinition[],
  noPorts: [] as PortDefinition[],
  conditional: [
    { id: 'in', label: '输入', type: 'default' as const, maxConnections: 1 },
    { id: 'true', label: 'True', type: 'conditional' as const },
    { id: 'false', label: 'False', type: 'conditional' as const },
  ] as PortDefinition[],
  loop: [
    { id: 'in', label: '输入', type: 'default' as const, maxConnections: 1 },
    { id: 'body', label: '循环体', type: 'loop' as const },
    { id: 'out', label: '输出', type: 'default' as const },
  ] as PortDefinition[],
} as const;

/**
 * 默认节点配置
 */
const DEFAULT_CONFIGS = {
  // 基础配置
  base: { timeout: 30000, onFailure: 'stop' as const },
  // 点击
  click: { target: '', timeout: 30000, onFailure: 'stop' as const },
  // 输入
  input: { target: '', value: '', clearBefore: true, timeout: 30000, onFailure: 'stop' as const },
  // 滚动
  scroll: { target: '', direction: 'down' as const, distance: 300, timeout: 30000, onFailure: 'stop' as const },
  // 等待
  wait: { duration: 1000, timeout: 30000, onFailure: 'stop' as const },
  // 导航
  navigate: { url: '', waitForLoad: true, timeout: 30000, onFailure: 'stop' as const },
  // 悬停
  hover: { target: '', duration: 500, timeout: 30000, onFailure: 'stop' as const },
  // 拖拽
  drag: { from: '', to: '', duration: 500, timeout: 30000, onFailure: 'stop' as const },
  // 断言存在
  assertExists: { target: '', state: 'visible' as const, negate: false, timeout: 30000, onFailure: 'stop' as const },
  // 断言文本
  assertText: { target: '', text: '', operator: 'contains' as const, timeout: 30000, onFailure: 'stop' as const },
  // 断言状态
  assertState: { target: '', state: 'checked' as const, negate: false, timeout: 30000, onFailure: 'stop' as const },
  // AI 断言
  aiAssert: { assertion: '', timeout: 30000, onFailure: 'stop' as const },
  // 条件分支
  ifElse: { condition: '', trueLabel: 'True', falseLabel: 'False', timeout: 30000, onFailure: 'stop' as const },
  // 循环
  loop: { type: 'count' as const, count: 3, maxIterations: 50, timeout: 30000, onFailure: 'stop' as const },
  // 并行
  parallel: { branches: 2, waitAll: true, timeout: 30000, onFailure: 'stop' as const },
  // 分组
  group: { label: '', collapsed: false, color: '#e3f2fd' },
  // 设置变量
  setVariable: { name: '', value: '', valueType: 'string' as const },
  // 提取数据
  extractData: { target: '', extractType: 'text' as const, variable: '', timeout: 30000, onFailure: 'stop' as const },
  // 外部数据
  externalData: { source: '', format: 'json' as const, variable: '', timeout: 30000, onFailure: 'stop' as const },
  // 注释
  comment: { content: '', color: '#fff9c4' },
  // 子流程
  subflow: { subflowId: '', parameters: {}, timeout: 30000, onFailure: 'stop' as const },
  // 开始
  start: { variables: {} },
  // 结束
  end: { returnValue: '' },
} as const;

/**
 * 配置 Schema 定义
 */
const CONFIG_SCHEMAS: Record<NodeType, ConfigSchema> = {
  // 开始节点
  start: {
    type: 'object',
    properties: {
      variables: { type: 'object', title: '初始变量' },
    },
  },
  // 结束节点
  end: {
    type: 'object',
    properties: {
      returnValue: { type: 'string', title: '返回值' },
    },
  },
  // 注释节点
  comment: {
    type: 'object',
    properties: {
      content: { type: 'string', title: '注释内容' },
      color: { type: 'string', title: '背景颜色' },
    },
    required: ['content'],
  },
  // 子流程
  subflow: {
    type: 'object',
    properties: {
      subflowId: { type: 'string', title: '子流程 ID' },
      parameters: { type: 'object', title: '参数映射' },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['subflowId'],
  },
  // 点击
  click: {
    type: 'object',
    properties: {
      target: { type: 'string', title: '目标元素' },
      count: { type: 'number', title: '点击次数', minimum: 1, maximum: 10 },
      doubleClick: { type: 'boolean', title: '双击' },
      rightClick: { type: 'boolean', title: '右键' },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['target'],
  },
  // 输入
  input: {
    type: 'object',
    properties: {
      target: { type: 'string', title: '目标元素' },
      value: { type: 'string', title: '输入值' },
      clearBefore: { type: 'boolean', title: '输入前清空' },
      submitKey: { type: 'string', title: '提交按键', enum: ['enter', 'tab', 'none'] },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['target', 'value'],
  },
  // 滚动
  scroll: {
    type: 'object',
    properties: {
      target: { type: 'string', title: '目标元素 (可选)' },
      direction: { type: 'string', title: '方向', enum: ['up', 'down', 'left', 'right', 'intoView'] },
      distance: { type: 'number', title: '距离 (px)', minimum: 10, maximum: 10000 },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
  },
  // 等待
  wait: {
    type: 'object',
    properties: {
      duration: { type: 'number', title: '等待时间 (ms)', minimum: 100, maximum: 60000 },
      waitForElement: { type: 'string', title: '等待元素' },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['duration'],
  },
  // 导航
  navigate: {
    type: 'object',
    properties: {
      url: { type: 'string', title: 'URL 地址' },
      waitForLoad: { type: 'boolean', title: '等待加载完成' },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['url'],
  },
  // 悬停
  hover: {
    type: 'object',
    properties: {
      target: { type: 'string', title: '目标元素' },
      duration: { type: 'number', title: '持续时间 (ms)', minimum: 100, maximum: 10000 },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['target'],
  },
  // 拖拽
  drag: {
    type: 'object',
    properties: {
      from: { type: 'string', title: '源元素' },
      to: { type: 'string', title: '目标元素' },
      duration: { type: 'number', title: '持续时间 (ms)', minimum: 100, maximum: 5000 },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['from', 'to'],
  },
  // 断言存在
  assertExists: {
    type: 'object',
    properties: {
      target: { type: 'string', title: '目标元素' },
      state: { type: 'string', title: '期望状态', enum: ['visible', 'hidden', 'enabled', 'disabled'] },
      negate: { type: 'boolean', title: '否定断言' },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['target'],
  },
  // 断言文本
  assertText: {
    type: 'object',
    properties: {
      target: { type: 'string', title: '目标元素' },
      text: { type: 'string', title: '期望文本' },
      operator: { type: 'string', title: '匹配方式', enum: ['equals', 'contains', 'matches', 'startsWith', 'endsWith'] },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['target', 'text'],
  },
  // 断言状态
  assertState: {
    type: 'object',
    properties: {
      target: { type: 'string', title: '目标元素' },
      state: { type: 'string', title: '期望状态', enum: ['checked', 'unchecked', 'selected', 'focused', 'readonly'] },
      negate: { type: 'boolean', title: '否定断言' },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['target', 'state'],
  },
  // AI 断言
  aiAssert: {
    type: 'object',
    properties: {
      assertion: { type: 'string', title: '断言描述' },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['assertion'],
  },
  // 条件分支
  ifElse: {
    type: 'object',
    properties: {
      condition: { type: 'string', title: '条件描述' },
      trueLabel: { type: 'string', title: 'True 分支标签' },
      falseLabel: { type: 'string', title: 'False 分支标签' },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['condition'],
  },
  // 循环
  loop: {
    type: 'object',
    properties: {
      type: { type: 'string', title: '循环类型', enum: ['count', 'while', 'forEach'] },
      count: { type: 'number', title: '循环次数', minimum: 1, maximum: 1000 },
      whileCondition: { type: 'string', title: '循环条件' },
      forEachCollection: { type: 'string', title: '数据源' },
      itemVariable: { type: 'string', title: '元素变量名' },
      maxIterations: { type: 'number', title: '最大迭代次数', minimum: 1, maximum: 1000 },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['type'],
  },
  // 并行
  parallel: {
    type: 'object',
    properties: {
      branches: { type: 'number', title: '分支数', minimum: 2, maximum: 10 },
      waitAll: { type: 'boolean', title: '等待所有分支' },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['branches'],
  },
  // 分组
  group: {
    type: 'object',
    properties: {
      label: { type: 'string', title: '分组标签' },
      collapsed: { type: 'boolean', title: '折叠状态' },
      color: { type: 'string', title: '背景颜色' },
    },
  },
  // 设置变量
  setVariable: {
    type: 'object',
    properties: {
      name: { type: 'string', title: '变量名' },
      value: { type: 'string', title: '变量值' },
      valueType: { type: 'string', title: '变量类型', enum: ['string', 'number', 'boolean', 'array', 'object'] },
    },
    required: ['name', 'value'],
  },
  // 提取数据
  extractData: {
    type: 'object',
    properties: {
      target: { type: 'string', title: '目标元素' },
      extractType: { type: 'string', title: '提取类型', enum: ['text', 'attribute', 'count', 'boundingRect'] },
      attribute: { type: 'string', title: '属性名' },
      variable: { type: 'string', title: '保存到变量' },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['target', 'variable'],
  },
  // 外部数据
  externalData: {
    type: 'object',
    properties: {
      source: { type: 'string', title: '数据源 URL' },
      format: { type: 'string', title: '数据格式', enum: ['json', 'csv', 'yaml'] },
      variable: { type: 'string', title: '保存到变量' },
      timeout: { type: 'number', title: '超时 (ms)', minimum: 1000, maximum: 300000 },
      onFailure: { type: 'string', title: '失败处理', enum: ['stop', 'skip', 'retry'] },
    },
    required: ['source', 'variable'],
  },
} as const;

/**
 * 节点注册表类
 */
class NodeRegistry {
  private registry = new Map<NodeType, NodeDefinition>();

  constructor() {
    this.registerDefaultNodes();
  }

  /**
   * 注册节点定义
   */
  register(definition: NodeDefinition): void {
    this.registry.set(definition.type, definition);
  }

  /**
   * 获取节点定义
   */
  get(type: NodeType): NodeDefinition | undefined {
    return this.registry.get(type);
  }

  /**
   * 检查节点类型是否已注册
   */
  has(type: NodeType): boolean {
    return this.registry.has(type);
  }

  /**
   * 获取所有节点定义
   */
  getAll(): NodeDefinition[] {
    return Array.from(this.registry.values());
  }

  /**
   * 按分类获取节点定义
   */
  getByCategory(category: NodeCategory): NodeDefinition[] {
    return Array.from(this.registry.values()).filter((def) => def.category === category);
  }

  /**
   * 获取所有分类
   */
  getCategories(): NodeCategory[] {
    return ['special', 'action', 'validation', 'control', 'data'];
  }

  /**
   * 创建新节点
   */
  createNode(
    type: NodeType,
    position: { x: number; y: number },
    overrides?: Partial<DesignerNode>
  ): DesignerNode {
    const definition = this.get(type);
    if (!definition) {
      throw new Error(`Unknown node type: ${type}`);
    }

    const id = generateId(type);

    return {
      id,
      type,
      position,
      data: {
        label: definition.label,
        description: '',
        config: { ...definition.defaultConfig } as any,
        errors: [],
        warnings: [],
        editable: type !== 'start' && type !== 'end',
        deletable: type !== 'start' && type !== 'end',
      },
      ...overrides,
    };
  }

  /**
   * 验证节点配置
   */
  validateConfig(type: NodeType, config: any): ValidationResult {
    const definition = this.get(type);
    if (!definition) {
      return {
        valid: false,
        errors: [{ type: 'configuration', message: `未知节点类型: ${type}` }],
        warnings: [],
      };
    }

    // 使用节点的验证函数
    if (definition.validate) {
      return definition.validate(config);
    }

    // 默认验证逻辑
    const schema = definition.configSchema;
    if (schema) {
      return this.validateAgainstSchema(config, schema, type);
    }

    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * 根据 Schema 验证配置
   */
  private validateAgainstSchema(
    config: any,
    schema: ConfigSchema,
    nodeType: NodeType
  ): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (schema.type === 'object' && schema.properties) {
      // 检查必填字段
      if (schema.required) {
        for (const field of schema.required) {
          if (!config[field] || (typeof config[field] === 'string' && !config[field].trim())) {
            errors.push({
              type: 'configuration',
              message: `${schema.properties[field]?.title || field} 是必填项`,
            });
          }
        }
      }

      // 检查数值范围
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (config[key] !== undefined) {
          if (propSchema.minimum !== undefined && config[key] < propSchema.minimum) {
            errors.push({
              type: 'configuration',
              message: `${propSchema.title || key} 不能小于 ${propSchema.minimum}`,
            });
          }
          if (propSchema.maximum !== undefined && config[key] > propSchema.maximum) {
            errors.push({
              type: 'configuration',
              message: `${propSchema.title || key} 不能大于 ${propSchema.maximum}`,
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 将节点转换为 YAML 步骤
   */
  nodeToYaml(node: DesignerNode): YamlStep[] {
    const definition = this.get(node.type as NodeType);
    if (!definition) {
      return [];
    }

    return definition.toYaml(node);
  }

  /**
   * 注册默认节点
   */
  private registerDefaultNodes(): void {
    // 特殊节点
    this.registerSpecialNodes();
    // 动作节点
    this.registerActionNodes();
    // 验证节点
    this.registerValidationNodes();
    // 控制节点
    this.registerControlNodes();
    // 数据节点
    this.registerDataNodes();
  }

  /**
   * 注册特殊节点
   */
  private registerSpecialNodes(): void {
    // 开始节点
    this.register({
      type: 'start',
      label: NODE_LABELS.start,
      category: 'special',
      icon: NODE_ICONS.special,
      defaultConfig: DEFAULT_CONFIGS.start,
      inputs: DEFAULT_PORTS.noPorts,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.start,
      toYaml: (node) => [{ meta: { start: true } }],
    });

    // 结束节点
    this.register({
      type: 'end',
      label: NODE_LABELS.end,
      category: 'special',
      icon: NODE_ICONS.special,
      defaultConfig: DEFAULT_CONFIGS.end,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.noPorts,
      configSchema: CONFIG_SCHEMAS.end,
      toYaml: (node) => [{ meta: { end: true } }],
    });

    // 注释节点
    this.register({
      type: 'comment',
      label: NODE_LABELS.comment,
      category: 'special',
      icon: NODE_ICONS.special,
      defaultConfig: DEFAULT_CONFIGS.comment,
      inputs: DEFAULT_PORTS.noPorts,
      outputs: DEFAULT_PORTS.noPorts,
      configSchema: CONFIG_SCHEMAS.comment,
      validate: (config) => {
        const errors: { type: 'configuration'; message: string }[] = [];
        if (!(config as any).content?.trim()) {
          errors.push({ type: 'configuration', message: '注释内容不能为空' });
        }
        return { valid: errors.length === 0, errors, warnings: [] };
      },
      toYaml: () => [],
    });

    // 子流程节点
    this.register({
      type: 'subflow',
      label: NODE_LABELS.subflow,
      category: 'special',
      icon: NODE_ICONS.special,
      defaultConfig: DEFAULT_CONFIGS.subflow,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.subflow,
      toYaml: (node) => {
        const config = node.data.config as any;
        return [{ subflow: config.subflowId, params: config.parameters }];
      },
    });
  }

  /**
   * 注册动作节点
   */
  private registerActionNodes(): void {
    // 点击节点
    this.register({
      type: 'click',
      label: NODE_LABELS.click,
      category: 'action',
      icon: NODE_ICONS.action,
      defaultConfig: DEFAULT_CONFIGS.click,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.click,
      toYaml: (node) => {
        const config = node.data.config as any;
        const step: YamlStep = { ai: config.target };
        if (config.timeout) step.timeout = config.timeout;
        if (config.count && config.count > 1) step.count = config.count;
        if (config.doubleClick) step.doubleClick = true;
        return [step];
      },
    });

    // 输入节点
    this.register({
      type: 'input',
      label: NODE_LABELS.input,
      category: 'action',
      icon: NODE_ICONS.action,
      defaultConfig: DEFAULT_CONFIGS.input,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.input,
      toYaml: (node) => {
        const config = node.data.config as any;
        const step: YamlStep = { ai: config.target, value: config.value };
        if (config.timeout) step.timeout = config.timeout;
        if (config.clearBefore) step.clear = true;
        return [step];
      },
    });

    // 滚动节点
    this.register({
      type: 'scroll',
      label: NODE_LABELS.scroll,
      category: 'action',
      icon: NODE_ICONS.action,
      defaultConfig: DEFAULT_CONFIGS.scroll,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.scroll,
      toYaml: (node) => {
        const config = node.data.config as any;
        const step: YamlStep = { scroll: config.direction || 'down' };
        if (config.target) step.target = config.target;
        if (config.distance) step.distance = config.distance;
        return [step];
      },
    });

    // 等待节点
    this.register({
      type: 'wait',
      label: NODE_LABELS.wait,
      category: 'action',
      icon: NODE_ICONS.action,
      defaultConfig: DEFAULT_CONFIGS.wait,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.wait,
      toYaml: (node) => {
        const config = node.data.config as any;
        return [{ wait: config.duration }];
      },
    });

    // 导航节点
    this.register({
      type: 'navigate',
      label: NODE_LABELS.navigate,
      category: 'action',
      icon: NODE_ICONS.action,
      defaultConfig: DEFAULT_CONFIGS.navigate,
      inputs: DEFAULT_PORTS.noPorts,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.navigate,
      toYaml: (node) => {
        const config = node.data.config as any;
        return [{ url: config.url }];
      },
    });

    // 悬停节点
    this.register({
      type: 'hover',
      label: NODE_LABELS.hover,
      category: 'action',
      icon: NODE_ICONS.action,
      defaultConfig: DEFAULT_CONFIGS.hover,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.hover,
      toYaml: (node) => {
        const config = node.data.config as any;
        return [{ hover: config.target }];
      },
    });

    // 拖拽节点
    this.register({
      type: 'drag',
      label: NODE_LABELS.drag,
      category: 'action',
      icon: NODE_ICONS.action,
      defaultConfig: DEFAULT_CONFIGS.drag,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.drag,
      toYaml: (node) => {
        const config = node.data.config as any;
        return [{ drag: { from: config.from, to: config.to } }];
      },
    });
  }

  /**
   * 注册验证节点
   */
  private registerValidationNodes(): void {
    // 断言存在节点
    this.register({
      type: 'assertExists',
      label: NODE_LABELS.assertExists,
      category: 'validation',
      icon: NODE_ICONS.validation,
      defaultConfig: DEFAULT_CONFIGS.assertExists,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.assertExists,
      toYaml: (node) => {
        const config = node.data.config as any;
        const step: YamlStep = { assert: { exists: config.target } };
        if (config.state && config.state !== 'visible') step.assert.state = config.state;
        if (config.negate) step.assert.not = true;
        return [step];
      },
    });

    // 断言文本节点
    this.register({
      type: 'assertText',
      label: NODE_LABELS.assertText,
      category: 'validation',
      icon: NODE_ICONS.validation,
      defaultConfig: DEFAULT_CONFIGS.assertText,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.assertText,
      toYaml: (node) => {
        const config = node.data.config as any;
        const step: YamlStep = { assert: { text: config.text } };
        if (config.target) step.assert.target = config.target;
        if (config.operator && config.operator !== 'contains') step.assert.operator = config.operator;
        return [step];
      },
    });

    // 断言状态节点
    this.register({
      type: 'assertState',
      label: NODE_LABELS.assertState,
      category: 'validation',
      icon: NODE_ICONS.validation,
      defaultConfig: DEFAULT_CONFIGS.assertState,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.assertState,
      toYaml: (node) => {
        const config = node.data.config as any;
        const step: YamlStep = { assert: { state: config.state } };
        if (config.target) step.assert.target = config.target;
        if (config.negate) step.assert.not = true;
        return [step];
      },
    });

    // AI 断言节点
    this.register({
      type: 'aiAssert',
      label: NODE_LABELS.aiAssert,
      category: 'validation',
      icon: NODE_ICONS.validation,
      defaultConfig: DEFAULT_CONFIGS.aiAssert,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.aiAssert,
      toYaml: (node) => {
        const config = node.data.config as any;
        return [{ assert: { ai: config.assertion } }];
      },
    });
  }

  /**
   * 注册控制节点
   */
  private registerControlNodes(): void {
    // 条件分支节点
    this.register({
      type: 'ifElse',
      label: NODE_LABELS.ifElse,
      category: 'control',
      icon: NODE_ICONS.control,
      defaultConfig: DEFAULT_CONFIGS.ifElse,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.conditional,
      configSchema: CONFIG_SCHEMAS.ifElse,
      toYaml: (node) => {
        const config = node.data.config as any;
        return [{ if: config.condition }];
      },
    });

    // 循环节点
    this.register({
      type: 'loop',
      label: NODE_LABELS.loop,
      category: 'control',
      icon: NODE_ICONS.control,
      defaultConfig: DEFAULT_CONFIGS.loop,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.loop,
      configSchema: CONFIG_SCHEMAS.loop,
      toYaml: (node) => {
        const config = node.data.config as any;
        if (config.type === 'count') {
          return [{ loop: { count: config.count || 3 } }];
        } else if (config.type === 'while') {
          return [{ loop: { while: config.whileCondition } }];
        } else {
          return [{ loop: { forEach: config.forEachCollection, as: config.itemVariable } }];
        }
      },
    });

    // 并行节点
    this.register({
      type: 'parallel',
      label: NODE_LABELS.parallel,
      category: 'control',
      icon: NODE_ICONS.control,
      defaultConfig: DEFAULT_CONFIGS.parallel,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.multiOutput,
      configSchema: CONFIG_SCHEMAS.parallel,
      toYaml: (node) => {
        const config = node.data.config as any;
        return [{ parallel: { branches: config.branches || 2 } }];
      },
    });

    // 分组节点
    this.register({
      type: 'group',
      label: NODE_LABELS.group,
      category: 'control',
      icon: NODE_ICONS.control,
      defaultConfig: DEFAULT_CONFIGS.group,
      inputs: DEFAULT_PORTS.multiInput,
      outputs: DEFAULT_PORTS.multiOutput,
      configSchema: CONFIG_SCHEMAS.group,
      toYaml: () => [],
    });
  }

  /**
   * 注册数据节点
   */
  private registerDataNodes(): void {
    // 设置变量节点
    this.register({
      type: 'setVariable',
      label: NODE_LABELS.setVariable,
      category: 'data',
      icon: NODE_ICONS.data,
      defaultConfig: DEFAULT_CONFIGS.setVariable,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.setVariable,
      toYaml: (node) => {
        const config = node.data.config as any;
        return [{ set: { [config.name]: config.value } }];
      },
    });

    // 提取数据节点
    this.register({
      type: 'extractData',
      label: NODE_LABELS.extractData,
      category: 'data',
      icon: NODE_ICONS.data,
      defaultConfig: DEFAULT_CONFIGS.extractData,
      inputs: DEFAULT_PORTS.singleInput,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.extractData,
      toYaml: (node) => {
        const config = node.data.config as any;
        const step: YamlStep = { extract: { to: config.variable } };
        if (config.extractType === 'text') {
          step.extract.text = config.target;
        } else if (config.extractType === 'attribute') {
          step.extract.attribute = { name: config.attribute, from: config.target };
        } else if (config.extractType === 'count') {
          step.extract.count = config.target;
        }
        return [step];
      },
    });

    // 外部数据节点
    this.register({
      type: 'externalData',
      label: NODE_LABELS.externalData,
      category: 'data',
      icon: NODE_ICONS.data,
      defaultConfig: DEFAULT_CONFIGS.externalData,
      inputs: DEFAULT_PORTS.noPorts,
      outputs: DEFAULT_PORTS.singleOutput,
      configSchema: CONFIG_SCHEMAS.externalData,
      toYaml: (node) => {
        const config = node.data.config as any;
        return [{ load: { from: config.source, as: config.variable, format: config.format } }];
      },
    });
  }
}

/**
 * 单例实例
 */
export const nodeRegistry = new NodeRegistry();

/**
 * 导出工具函数
 */
export function createNode(
  type: NodeType,
  position: { x: number; y: number },
  overrides?: Partial<DesignerNode>
): DesignerNode {
  return nodeRegistry.createNode(type, position, overrides);
}

export function validateNodeConfig(type: NodeType, config: any): ValidationResult {
  return nodeRegistry.validateConfig(type, config);
}

export function nodeToYaml(node: DesignerNode): YamlStep[] {
  return nodeRegistry.nodeToYaml(node);
}
