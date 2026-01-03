# 可视化测试设计器 技术方案设计文档

## 1. 项目背景与目标

低代码/无代码是降低技术门槛的趋势。本模块通过可视化流程设计，让测试创建变得直观易懂。目标是让非技术人员也能在 10 分钟内创建一个完整的测试用例。

## 2. 系统架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                   Visual Test Designer                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    React Flow Canvas                  │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │   │
│  │  │  Start  │──│  Click  │──│  Input  │──...        │   │
│  │  └─────────┘  └─────────┘  └─────────┘             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────┐  ┌────────────────────┐  ┌────────────┐    │
│  │   Node     │  │   Property Panel   │  │  Toolbar   │    │
│  │   Panel    │  │                    │  │            │    │
│  └────────────┘  └────────────────────┘  └────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                State Manager (Zustand)                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
  ┌────────────┐   ┌────────────┐   ┌────────────┐
  │    YAML    │   │  Execution │   │   Storage  │
  │  Converter │   │   Engine   │   │   Manager  │
  └────────────┘   └────────────┘   └────────────┘
```

### 2.2 技术栈选型

* **流程图引擎**: React Flow (成熟、功能丰富)
* **状态管理**: Zustand
* **UI 组件**: TailwindCSS + Headless UI
* **拖拽**: react-dnd
* **YAML 处理**: yaml.js

---

## 3. 数据模型设计

### 3.1 节点定义

```typescript
interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  selected?: boolean;
  dragging?: boolean;
}

type NodeType =
  // 动作节点
  | 'start' | 'end' | 'click' | 'input' | 'scroll'
  | 'wait' | 'navigate' | 'hover' | 'drag'
  // 验证节点
  | 'assertExists' | 'assertText' | 'assertState' | 'aiAssert'
  // 控制节点
  | 'ifElse' | 'loop' | 'parallel' | 'group'
  // 数据节点
  | 'setVariable' | 'extractData' | 'externalData'
  // 特殊节点
  | 'comment' | 'subflow';

interface NodeData {
  label: string;
  description?: string;
  config: NodeConfig;
  errors?: string[];
}

// 各节点类型的配置
interface ClickNodeConfig {
  target: string;                // 目标元素描述
  timeout?: number;              // 超时 (ms)
  onFailure?: 'stop' | 'skip' | 'retry';
}

interface InputNodeConfig {
  target: string;
  value: string;                 // 支持变量 ${var}
  clearBefore?: boolean;
  timeout?: number;
}

interface IfElseNodeConfig {
  condition: string;             // AI 可判断的条件描述
  trueLabel?: string;
  falseLabel?: string;
}

interface LoopNodeConfig {
  type: 'count' | 'while' | 'forEach';
  count?: number;
  condition?: string;
  dataSource?: string;
  itemVariable?: string;
}
```

### 3.2 连线定义

```typescript
interface FlowEdge {
  id: string;
  source: string;                // 源节点 ID
  target: string;                // 目标节点 ID
  sourceHandle?: string;         // 源端口 (用于条件分支)
  targetHandle?: string;         // 目标端口
  type?: 'default' | 'conditional';
  data?: {
    condition?: string;          // 条件表达式
    label?: string;              // 连线标签
  };
}
```

### 3.3 流程定义

```typescript
interface TestFlow {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: VariableDefinition[];
  metadata: {
    createdAt: number;
    updatedAt: number;
    author?: string;
  };
}

interface VariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  defaultValue?: any;
  description?: string;
}
```

---

## 4. 核心模块设计

### 4.1 节点注册系统

```typescript
interface NodeDefinition {
  type: NodeType;
  label: string;
  icon: React.ComponentType;
  category: 'action' | 'validation' | 'control' | 'data' | 'special';
  configSchema: JSONSchema;      // 配置项 JSON Schema
  defaultConfig: Record<string, any>;
  inputs: PortDefinition[];      // 输入端口
  outputs: PortDefinition[];     // 输出端口
  component: React.ComponentType<NodeProps>;
  validate: (config: any) => ValidationResult;
  toYaml: (node: FlowNode) => YamlStep[];
}

interface PortDefinition {
  id: string;
  label: string;
  type: 'default' | 'conditional';
  maxConnections?: number;
}

// 节点注册表
const nodeRegistry = new Map<NodeType, NodeDefinition>();

// 注册示例
nodeRegistry.set('click', {
  type: 'click',
  label: '点击',
  icon: MousePointerClick,
  category: 'action',
  configSchema: {
    type: 'object',
    properties: {
      target: { type: 'string', title: '目标元素' },
      timeout: { type: 'number', title: '超时时间', default: 30000 },
    },
    required: ['target'],
  },
  defaultConfig: { timeout: 30000 },
  inputs: [{ id: 'in', label: '输入', type: 'default' }],
  outputs: [{ id: 'out', label: '输出', type: 'default' }],
  component: ClickNode,
  validate: (config) => {
    if (!config.target) return { valid: false, errors: ['请填写目标元素'] };
    return { valid: true, errors: [] };
  },
  toYaml: (node) => [{
    ai: node.data.config.target,
    timeout: node.data.config.timeout,
  }],
});
```

### 4.2 YAML 转换器

```typescript
class YamlConverter {
  // 流程 → YAML
  toYaml(flow: TestFlow): string {
    const yamlObj = {
      name: flow.name,
      description: flow.description,
      variables: this.convertVariables(flow.variables),
      flow: this.convertFlow(flow),
    };
    return yaml.dump(yamlObj);
  }

  private convertFlow(flow: TestFlow): YamlStep[] {
    // 拓扑排序获取执行顺序
    const sortedNodes = this.topologicalSort(flow.nodes, flow.edges);
    const steps: YamlStep[] = [];

    for (const node of sortedNodes) {
      const definition = nodeRegistry.get(node.type);
      if (definition) {
        const yamlSteps = definition.toYaml(node);
        steps.push(...yamlSteps);
      }
    }

    return steps;
  }

  // YAML → 流程 (导入)
  fromYaml(yamlContent: string): TestFlow {
    const yamlObj = yaml.load(yamlContent);
    return this.parseYamlToFlow(yamlObj);
  }

  private parseYamlToFlow(yamlObj: any): TestFlow {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    let yOffset = 0;

    // 添加开始节点
    nodes.push(this.createNode('start', 0, yOffset));

    // 解析步骤
    for (const step of yamlObj.flow || []) {
      yOffset += 100;
      const node = this.parseStep(step, yOffset);
      nodes.push(node);

      // 创建连线
      const prevNode = nodes[nodes.length - 2];
      edges.push({
        id: `${prevNode.id}-${node.id}`,
        source: prevNode.id,
        target: node.id,
      });
    }

    // 添加结束节点
    yOffset += 100;
    nodes.push(this.createNode('end', 0, yOffset));
    edges.push({
      id: `${nodes[nodes.length - 2].id}-${nodes[nodes.length - 1].id}`,
      source: nodes[nodes.length - 2].id,
      target: nodes[nodes.length - 1].id,
    });

    return {
      id: generateId(),
      name: yamlObj.name || 'Imported Flow',
      nodes,
      edges,
      variables: [],
      metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      version: 1,
    };
  }
}
```

### 4.3 流程验证器

```typescript
class FlowValidator {
  validate(flow: TestFlow): ValidationResult {
    const errors: ValidationError[] = [];

    // 检查开始/结束节点
    if (!this.hasStartNode(flow)) {
      errors.push({ type: 'flow', message: '缺少开始节点' });
    }
    if (!this.hasEndNode(flow)) {
      errors.push({ type: 'flow', message: '缺少结束节点' });
    }

    // 检查孤立节点
    const orphanNodes = this.findOrphanNodes(flow);
    for (const node of orphanNodes) {
      errors.push({
        type: 'node',
        nodeId: node.id,
        message: '节点未连接到流程',
      });
    }

    // 检查循环依赖
    if (this.hasCycle(flow)) {
      errors.push({ type: 'flow', message: '流程中存在循环依赖' });
    }

    // 检查各节点配置
    for (const node of flow.nodes) {
      const definition = nodeRegistry.get(node.type);
      if (definition) {
        const result = definition.validate(node.data.config);
        if (!result.valid) {
          errors.push({
            type: 'node',
            nodeId: node.id,
            message: result.errors.join(', '),
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private hasCycle(flow: TestFlow): boolean {
    // 使用 DFS 检测环
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outEdges = flow.edges.filter(e => e.source === nodeId);
      for (const edge of outEdges) {
        if (!visited.has(edge.target)) {
          if (dfs(edge.target)) return true;
        } else if (recursionStack.has(edge.target)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    const startNode = flow.nodes.find(n => n.type === 'start');
    return startNode ? dfs(startNode.id) : false;
  }
}
```

### 4.4 执行集成

```typescript
class DesignerExecutor {
  private executionEngine: ExecutionEngine;
  private highlightCallback: (nodeId: string) => void;

  async execute(flow: TestFlow): Promise<ExecutionResult> {
    // 1. 验证流程
    const validation = new FlowValidator().validate(flow);
    if (!validation.valid) {
      throw new Error(`流程验证失败: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // 2. 转换为 YAML
    const yaml = new YamlConverter().toYaml(flow);

    // 3. 执行
    return await this.executionEngine.execute(yaml, {
      onStepStart: (stepIndex) => {
        const node = this.getNodeByStepIndex(flow, stepIndex);
        if (node) {
          this.highlightCallback(node.id);
        }
      },
    });
  }
}
```

---

## 5. UI 组件设计

### 5.1 节点面板

```tsx
const NodePanel: React.FC = () => {
  const categories = [
    { id: 'action', label: '动作', nodes: ['click', 'input', 'scroll', ...] },
    { id: 'validation', label: '验证', nodes: ['assertExists', 'assertText', ...] },
    { id: 'control', label: '控制', nodes: ['ifElse', 'loop', 'parallel', ...] },
    { id: 'data', label: '数据', nodes: ['setVariable', 'extractData', ...] },
  ];

  return (
    <div className="w-64 border-r bg-gray-50 p-4">
      {categories.map(cat => (
        <div key={cat.id} className="mb-4">
          <h3 className="font-semibold mb-2">{cat.label}</h3>
          <div className="grid grid-cols-2 gap-2">
            {cat.nodes.map(nodeType => (
              <DraggableNode key={nodeType} type={nodeType} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
```

### 5.2 画布布局

```
┌────────────────────────────────────────────────────────────────┐
│  [保存] [导出] [执行] [撤销] [重做]           [缩放] [小地图]    │
├──────────┬─────────────────────────────────────┬───────────────┤
│          │                                     │               │
│  节点面板 │           React Flow 画布            │   属性面板    │
│          │                                     │               │
│  ┌─────┐ │     ┌───────┐                       │  目标元素:    │
│  │点击 │ │     │ Start │                       │  [________]   │
│  └─────┘ │     └───┬───┘                       │               │
│  ┌─────┐ │         │                           │  超时时间:    │
│  │输入 │ │     ┌───▼───┐     ┌───────┐        │  [30000] ms   │
│  └─────┘ │     │ Click │────►│ Input │        │               │
│  ┌─────┐ │     └───────┘     └───┬───┘        │  失败处理:    │
│  │断言 │ │                       │            │  [停止 ▼]     │
│  └─────┘ │                   ┌───▼───┐        │               │
│  ...     │                   │  End  │        │  [应用]       │
│          │                   └───────┘        │               │
└──────────┴─────────────────────────────────────┴───────────────┘
```

---

## 6. 实施计划

1. **Week 1**: React Flow 集成，基础节点系统
2. **Week 2**: 节点注册表，属性面板
3. **Week 3**: YAML 转换，流程验证
4. **Week 4**: 执行集成，模板系统，测试
