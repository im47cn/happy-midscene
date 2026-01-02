# 多设备协同测试 需求规格说明书

## 1. 引言

本功能旨在支持跨多个设备/浏览器的协同测试场景，实现端到端的业务流程验证。例如：Web 端下单 → 移动端查看订单 → 后台审核的完整链路测试。

## 2. 术语定义

* **设备 (Device)**: 指参与测试的浏览器实例或移动设备。
* **会话 (Session)**: 单个设备上的测试执行上下文。
* **协调器 (Orchestrator)**: 负责管理和同步多设备执行的核心组件。
* **同步点 (Sync Point)**: 多设备需要等待对齐的执行节点。
* **数据通道 (Data Channel)**: 设备间共享数据的通信机制。

---

## 3. 功能需求 (Functional Requirements)

### 3.1 设备管理 (Device Management)

* **系统** 必须 支持以下设备类型：
  - Chrome 浏览器（当前标签页）
  - Chrome 浏览器（新窗口/新标签）
  - Android 设备（通过 ADB）
  - iOS 设备（通过 WebDriverAgent）
  - 远程浏览器（通过 WebSocket）

* **当** 用户添加设备时，**系统** 必须 验证设备连接状态并显示在线/离线状态。
* **系统** 应 支持设备别名配置，便于在脚本中引用。

### 3.2 协同脚本定义 (Collaborative Script)

* **系统** 必须 扩展 YAML 语法以支持多设备场景：

```yaml
devices:
  web:
    type: browser
    viewport: { width: 1920, height: 1080 }
  mobile:
    type: android
    device: "emulator-5554"
  admin:
    type: browser
    url: "https://admin.example.com"

flow:
  - device: web
    steps:
      - ai: "登录用户账号"
      - ai: "添加商品到购物车"
      - ai: "提交订单"
      - export: { orderId: "获取订单号" }

  - sync: "order_created"        # 同步点

  - device: mobile
    steps:
      - ai: "打开订单列表"
      - ai: "验证订单 ${orderId} 存在"

  - device: admin
    parallel: true               # 与上一步并行执行
    steps:
      - ai: "登录管理后台"
      - ai: "审核订单 ${orderId}"

  - sync: "order_approved"

  - device: web
    steps:
      - ai: "刷新页面"
      - assert: "订单状态为已审核"
```

* **系统** 必须 支持以下协同原语：
  - `device`: 指定执行设备
  - `sync`: 定义同步点
  - `parallel`: 标记可并行执行
  - `export/import`: 跨设备数据共享

### 3.3 执行协调 (Execution Coordination)

* **当** 用户启动协同测试时，**系统** 必须 初始化所有配置的设备会话。
* **系统** 必须 按照脚本定义的顺序和并行关系执行步骤。
* **当** 遇到同步点时，**系统** 必须 等待所有相关设备到达该点后再继续。
* **如果** 任一设备执行失败，**系统** 应 提供以下选项：
  - 暂停所有设备等待修复
  - 继续其他设备执行
  - 终止整个测试

### 3.4 数据共享 (Data Sharing)

* **系统** 必须 支持跨设备的数据提取和注入：
  - `export`: 从当前页面提取数据到共享变量
  - 变量插值: `${variableName}` 在任意设备中使用

* **系统** 应 支持数据转换函数：
  - `${orderId | trim}` - 去除空格
  - `${price | number}` - 转为数字
  - `${date | format:'YYYY-MM-DD'}` - 日期格式化

### 3.5 实时监控 (Real-time Monitoring)

* **当** 协同测试执行时，**系统** 必须 提供多设备实时监控视图：
  - 每个设备的当前步骤和状态
  - 同步点等待状态
  - 执行时间线
  - 实时截图（可选）

* **系统** 应 支持单设备暂停/继续而不影响其他设备。

### 3.6 结果聚合 (Result Aggregation)

* **当** 协同测试完成时，**系统** 必须 生成聚合报告：
  - 整体执行结果
  - 每个设备的执行详情
  - 同步点耗时统计
  - 数据流转记录

---

## 4. 非功能需求 (Non-Functional Requirements)

### 4.1 性能 (Performance)

* **系统** 应 支持最多 5 个设备同时协同执行。
* **系统** 的同步点等待超时默认为 60 秒，可配置。
* **系统** 的设备间通信延迟应 < 500ms。

### 4.2 可靠性 (Reliability)

* **系统** 必须 处理设备断连情况，提供重连机制。
* **系统** 应 支持测试断点续跑。

### 4.3 安全性 (Security)

* **系统** 必须 确保跨设备数据传输加密。
* **系统** 应 隔离不同测试会话的数据。

---

## 5. 限制与假设 (Constraints & Assumptions)

* **假设**: 所有设备在同一网络环境下可互相访问。
* **限制**: 移动设备需要提前配置好连接（ADB/WDA）。
* **限制**: 远程浏览器需要部署 WebSocket 代理服务。
