# 多设备协同测试 - 任务清单

## Phase 1: 核心架构

- [ ] **协调器核心** (`services/orchestrator.ts`)
  - 状态管理
  - 生命周期控制
  - 错误处理

- [ ] **设备会话抽象** (`services/deviceSession.ts`)
  - DeviceSession 接口定义
  - 连接状态管理
  - 重连机制

- [ ] **浏览器会话** (`sessions/browserSession.ts`)
  - Midscene Web Agent 封装
  - 多标签页支持
  - 数据提取

- [ ] **Android 会话** (`sessions/androidSession.ts`)
  - Midscene Android Agent 封装
  - ADB 连接管理
  - 屏幕镜像

- [ ] **iOS 会话** (`sessions/iosSession.ts`)
  - Midscene iOS Agent 封装
  - WebDriverAgent 连接
  - 设备控制

## Phase 2: 同步与数据

- [ ] **同步管理器** (`services/syncManager.ts`)
  - 同步点注册
  - 等待/释放逻辑
  - 超时处理

- [ ] **数据通道** (`services/dataChannel.ts`)
  - 共享数据存储
  - 变量插值
  - 数据转换函数

- [ ] **通信层** (`services/communicator.ts`)
  - BroadcastChannel (本地)
  - WebSocket (远程)
  - 消息序列化

## Phase 3: 脚本引擎

- [ ] **YAML 扩展解析** (`services/scriptParser.ts`)
  - 设备配置解析
  - 流程解析
  - 变量替换

- [ ] **执行计划生成** (`services/executionPlanner.ts`)
  - 依赖分析
  - 并行优化
  - 同步点识别

- [ ] **协同执行器** (`services/collaborativeExecutor.ts`)
  - 顺序执行
  - 并行执行
  - 同步协调

## Phase 4: UI 组件

- [ ] **设备管理面板** (`components/DeviceManager.tsx`)
  - 设备列表
  - 添加/移除设备
  - 连接状态

- [ ] **协同监控视图** (`components/CollaborativeMonitor.tsx`)
  - 多设备卡片
  - 实时截图
  - 步骤进度

- [ ] **时间线组件** (`components/Timeline.tsx`)
  - 执行时间线
  - 同步点标记
  - 交互式缩放

- [ ] **数据面板** (`components/SharedDataPanel.tsx`)
  - 共享变量展示
  - 数据历史
  - 手动注入

## Phase 5: 结果与报告

- [ ] **结果聚合器** (`services/resultAggregator.ts`)
  - 多设备结果合并
  - 同步耗时统计
  - 失败关联分析

- [ ] **协同报告生成** (`services/collaborativeReportGenerator.ts`)
  - 聚合报告模板
  - 时间线图表
  - 数据流转记录

## Phase 6: 集成与优化

- [ ] **设备预设配置** (`config/devicePresets.ts`)
  - 常用设备预设
  - 视口预设
  - 快速配置

- [ ] **性能优化**
  - 截图压缩
  - 消息批量发送
  - 内存管理

- [ ] **测试与文档**
  - 单设备测试
  - 协同场景测试
  - 用户文档

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── services/
│   ├── orchestrator.ts          # 协调器
│   ├── deviceSession.ts         # 设备会话抽象
│   ├── syncManager.ts           # 同步管理
│   ├── dataChannel.ts           # 数据通道
│   ├── communicator.ts          # 通信层
│   ├── scriptParser.ts          # 脚本解析
│   ├── executionPlanner.ts      # 执行计划
│   ├── collaborativeExecutor.ts # 协同执行
│   ├── resultAggregator.ts      # 结果聚合
│   └── collaborativeReportGenerator.ts  # 报告生成
├── sessions/
│   ├── browserSession.ts        # 浏览器会话
│   ├── androidSession.ts        # Android 会话
│   └── iosSession.ts            # iOS 会话
├── components/
│   ├── DeviceManager.tsx        # 设备管理
│   ├── CollaborativeMonitor.tsx # 协同监控
│   ├── Timeline.tsx             # 时间线
│   └── SharedDataPanel.tsx      # 数据面板
└── types/
    └── multiDevice.ts           # 类型定义
```

## 验收标准

1. 支持 5 设备同时协同
2. 同步点等待准确可靠
3. 数据共享实时同步 < 500ms
4. 单设备失败不影响其他设备
5. 聚合报告清晰展示完整流程
6. YAML 语法易于理解和编写
