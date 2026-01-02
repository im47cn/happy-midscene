# 智能断言生成用户手册

本手册介绍如何使用 AI Test Generator 的智能断言生成功能，通过 AI 分析操作上下文自动推荐合适的断言验证点，降低测试用例编写门槛。

## 目录

1. [功能概述](#1-功能概述)
2. [快速开始](#2-快速开始)
3. [断言类型](#3-断言类型)
4. [智能推荐](#4-智能推荐)
5. [断言模板](#5-断言模板)
6. [断言编辑器](#6-断言编辑器)
7. [API 参考](#7-api-参考)
8. [最佳实践](#8-最佳实践)

---

## 1. 功能概述

智能断言生成模块提供以下核心能力：

- **上下文分析**：分析操作类型、目标元素、页面变化
- **意图推断**：理解用户操作的业务意图
- **断言推荐**：生成带置信度的断言建议
- **模板管理**：维护可复用的断言模板库
- **验证预览**：实时验证断言结果

---

## 2. 快速开始

### 2.1 自动推荐

在测试步骤执行完成后，系统会自动分析并推荐断言：

```
用户操作: 点击"登录"按钮
系统推荐:
  1. ✓ 验证成功提示出现 (置信度: 95%)
  2. ✓ 验证页面跳转到首页 (置信度: 85%)
  3. ✓ 验证用户名显示在导航栏 (置信度: 70%)
```

### 2.2 采用推荐

点击推荐项旁边的"采用"按钮，断言将自动添加到测试步骤中。

### 2.3 手动添加

在断言编辑器中，使用自然语言描述验证条件：

```
输入: 确认购物车商品数量为 3
生成: assert("购物车角标显示数字 3")
```

---

## 3. 断言类型

系统支持 14 种断言类型，分为 5 大类：

### 3.1 存在性断言

| 类型 | 说明 | 示例 |
|------|------|------|
| `element_visible` | 元素可见 | 验证按钮显示 |
| `element_exists` | 元素存在 | 验证表单项存在 |
| `text_present` | 文本出现 | 验证提示信息 |

```typescript
// 使用示例
{
  type: 'element_visible',
  target: '提交按钮',
  expected: true
}
```

### 3.2 内容断言

| 类型 | 说明 | 示例 |
|------|------|------|
| `text_equals` | 文本相等 | 验证标题内容 |
| `text_contains` | 文本包含 | 验证包含关键词 |
| `input_value` | 输入框值 | 验证表单填写值 |
| `list_count` | 列表数量 | 验证搜索结果数 |

```typescript
// 使用示例
{
  type: 'text_contains',
  target: '成功提示区域',
  expected: '操作成功'
}
```

### 3.3 状态断言

| 类型 | 说明 | 示例 |
|------|------|------|
| `button_enabled` | 按钮可用 | 验证按钮状态 |
| `checkbox_checked` | 复选框选中 | 验证勾选状态 |
| `element_style` | 元素样式 | 验证颜色、显示 |

```typescript
// 使用示例
{
  type: 'button_enabled',
  target: '确认按钮',
  expected: true
}
```

### 3.4 导航断言

| 类型 | 说明 | 示例 |
|------|------|------|
| `url_contains` | URL 包含 | 验证页面路径 |
| `url_matches` | URL 匹配 | 验证完整 URL |
| `page_title` | 页面标题 | 验证页面标题 |

```typescript
// 使用示例
{
  type: 'url_contains',
  expected: '/dashboard'
}
```

### 3.5 数据断言

| 类型 | 说明 | 示例 |
|------|------|------|
| `table_data` | 表格数据 | 验证表格内容 |
| `number_range` | 数值范围 | 验证金额范围 |

```typescript
// 使用示例
{
  type: 'number_range',
  target: '总金额',
  min: 100,
  max: 1000
}
```

---

## 4. 智能推荐

### 4.1 推荐策略

系统使用 6 种策略生成断言推荐：

| 策略 | 权重 | 适用场景 |
|------|------|----------|
| `success_message` | 高 | 表单提交、操作完成 |
| `navigation` | 高 | 页面跳转、路由变化 |
| `state_change` | 中 | 状态切换、开关操作 |
| `data_validation` | 中 | 数据填写、内容修改 |
| `error_prevention` | 低 | 验证无错误提示 |
| `element_visibility` | 低 | 元素显示/隐藏 |

### 4.2 上下文分析

```typescript
import { contextCollector } from './services/assertion';

// 收集操作上下文
const context = await contextCollector.collectContext({
  actionType: 'click',
  targetElement: '登录按钮',
  beforeSnapshot: { /* 操作前页面状态 */ },
  afterSnapshot: { /* 操作后页面状态 */ },
});
```

### 4.3 意图推断

```typescript
import { intentInferrer } from './services/assertion';

// 推断操作意图
const intent = await intentInferrer.inferIntent(context);
// 结果: {
//   primaryIntent: 'login_submit',
//   confidence: 0.92,
//   expectedOutcomes: ['show_success', 'navigate_home']
// }
```

### 4.4 生成推荐

```typescript
import { assertionGenerator } from './services/assertion';

// 生成断言推荐
const recommendations = await assertionGenerator.generateRecommendations(
  context,
  intent
);
// 结果: [
//   { assertion: {...}, confidence: 95, reason: '表单提交后通常显示成功提示' },
//   { assertion: {...}, confidence: 85, reason: '登录成功后跳转到首页' },
// ]
```

---

## 5. 断言模板

### 5.1 系统预置模板

系统提供以下常用断言模板：

| 模板名称 | 断言数 | 适用场景 |
|----------|--------|----------|
| 登录成功 | 3 | 用户登录操作 |
| 表单提交 | 2 | 表单提交确认 |
| 购物车操作 | 4 | 电商购物流程 |
| 搜索结果 | 3 | 搜索功能验证 |
| 删除确认 | 2 | 删除操作验证 |

### 5.2 使用模板

```typescript
import { templateManager } from './services/assertion';

// 获取模板
const template = templateManager.getTemplate('login_success');

// 应用模板生成断言
const assertions = template.assertions.map(a => ({
  ...a,
  target: a.target.replace('{username}', '张三'),
}));
```

### 5.3 创建自定义模板

```typescript
// 创建自定义模板
templateManager.createTemplate({
  id: 'custom_checkout',
  name: '结账流程',
  description: '电商结账完成后的验证',
  category: 'ecommerce',
  assertions: [
    { type: 'text_present', target: '订单成功', expected: true },
    { type: 'text_contains', target: '订单号区域', expected: '订单号' },
    { type: 'element_visible', target: '继续购物按钮', expected: true },
  ],
  variables: ['orderId'],
  isSystem: false,
});
```

### 5.4 模板变量

模板支持变量替换：

```yaml
模板: 用户登录成功
变量:
  - {username}: 用户名
断言:
  - 验证页面包含 "欢迎, {username}"
  - 验证导航栏显示 {username}
```

---

## 6. 断言编辑器

### 6.1 编辑器功能

断言编辑器支持：
- 自然语言输入
- 类型选择下拉框
- 目标元素选择器
- 预期值编辑
- 实时验证预览

### 6.2 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 确认当前推荐 |
| `Tab` | 切换到下一个推荐 |
| `Escape` | 忽略所有推荐 |
| `Ctrl+E` | 打开编辑器 |

### 6.3 验证预览

选择断言后，系统立即在当前页面执行验证：

```
断言: 验证页面包含 "登录成功"
结果: ✓ 通过 (耗时 120ms)
```

如果验证失败：

```
断言: 验证按钮文本为 "提交"
结果: ✗ 失败 - 实际值为 "确认"
建议: 修改预期值为 "确认"
```

---

## 7. API 参考

### 7.1 AssertionGenerator

```typescript
import { assertionGenerator } from './services/assertion';

// 生成推荐
generateRecommendations(
  context: OperationContext,
  intent: InferredIntent
): Promise<AssertionRecommendation[]>

// 验证断言
validateAssertion(
  assertion: Assertion,
  page: Page
): Promise<ValidationResult>

// 转换为 YAML
toYamlFormat(assertion: Assertion): string
```

### 7.2 ContextCollector

```typescript
import { contextCollector } from './services/assertion';

// 收集上下文
collectContext(operation: Operation): Promise<OperationContext>

// 比较快照
compareSnapshots(
  before: PageSnapshot,
  after: PageSnapshot
): PageDiff
```

### 7.3 IntentInferrer

```typescript
import { intentInferrer } from './services/assertion';

// 推断意图
inferIntent(context: OperationContext): Promise<InferredIntent>

// 获取操作模式
getActionPattern(actionType: string): ActionPattern
```

### 7.4 TemplateManager

```typescript
import { templateManager } from './services/assertion';

// CRUD 操作
createTemplate(template: AssertionTemplate): void
getTemplate(id: string): AssertionTemplate
updateTemplate(id: string, updates: Partial<AssertionTemplate>): void
deleteTemplate(id: string): void

// 查询
findTemplatesByCategory(category: string): AssertionTemplate[]
searchTemplates(keyword: string): AssertionTemplate[]
```

---

## 8. 最佳实践

### 8.1 断言策略

1. **必要断言**：每个关键操作后添加 1-2 个核心断言
2. **避免过度断言**：不要为每个元素添加断言
3. **使用语义化描述**：断言描述应清晰表达验证意图

### 8.2 推荐采用原则

```
置信度 > 80%: 可直接采用
置信度 50-80%: 建议人工确认
置信度 < 50%: 谨慎使用，可能需要修改
```

### 8.3 模板复用

- 为常见业务场景创建模板
- 使用变量提高模板通用性
- 定期清理不再使用的模板

### 8.4 断言维护

- 定期检查失败断言的有效性
- UI 变更后更新相关断言
- 使用断言分组管理复杂用例

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2024-01 | 初始版本，支持 14 种断言类型 |

---

## 相关文档

- [需求规格说明书](../../../specs/smart-assertion/requirements.md)
- [设计文档](../../../specs/smart-assertion/design.md)
- [开发任务](../../../specs/smart-assertion/tasks.md)
