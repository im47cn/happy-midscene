# Adaptive Test Syntax Guide

自适应测试语法指南 - 支持条件分支、循环和变量操作

---

## Overview

自适应测试扩展现有 Markdown 测试语法，添加：
- **条件分支** - 根据运行时状态选择执行路径
- **循环** - 重复执行步骤组
- **变量操作** - 存储和复用动态值

设计原则：**声明式优先，命令式补充**

---

## Condition Syntax

### Basic Conditions

```yaml
# 元素存在性检查
when: element "提交按钮" is visible
then:
  - 点击 "提交按钮"

# 文本匹配
when: text ".status" contains "成功"
then:
  - 断言 "操作成功"

# 页面状态
when: state is loading
then:
  - 等待 2s
```

### Compound Conditions

```yaml
# AND 条件
when: element "登录按钮" is visible AND element "用户名输入框" is enabled
then:
  - 输入 "admin" into "用户名输入框"
  - 点击 "登录按钮"

# OR 条件
when: text ".message" contains "成功" OR text ".message" contains "完成"
then:
  - 断言 "操作成功"

# NOT 条件
when: NOT element "错误提示" is visible
then:
  - 继续下一步
```

### Nested Conditions

```yaml
when: element "菜单按钮" is visible
then:
  - 点击 "菜单按钮"
  when: element "用户设置" is visible
  then:
    - 点击 "用户设置"
  else:
    - 点击 "关闭按钮"
else:
  - 点击 "备用入口"
```

### Condition Operators

| Element Check | Description |
|--------------|-------------|
| `exists` | 元素存在于 DOM |
| `visible` | 元素可见 |
| `enabled` | 元素可交互 |
| `selected` | 元素被选中 |

| Text Operator | Description |
|--------------|-------------|
| `equals` | 完全匹配 |
| `contains` | 包含文本 |
| `matches` | 正则匹配 |

| Page State | Description |
|------------|-------------|
| `logged_in` | 已登录状态 |
| `loading` | 加载中 |
| `error` | 错误状态 |
| `empty` | 空状态 |
| `custom` | 自定义描述 |

---

## Loop Syntax

### Count Loop

```yaml
# 固定次数循环
repeat 3 times:
  - 点击 "下一页"
  - 等待 1s
```

### While Loop

```yaml
# 条件循环
while element "加载更多" is visible:
  - 点击 "加载更多"
  - 等待 2s
```

### ForEach Loop

```yaml
# 遍历元素
forEach ".list-item" as item:
  - 点击 item
  - 断言 "详情可见"
  - 点击 "返回"
```

### Loop Safety

所有循环都有安全限制：
- `maxIterations: 50` - 最大迭代次数
- `maxNestedDepth: 3` - 最大嵌套深度
- `timeout: 30000` - 单次迭代超时

```yaml
# 自定义安全限制
repeat 10 times with maxIterations 100:
  - 执行操作
```

---

## Variable Syntax

### Set Variable

```yaml
# 设置变量
set username = "admin"
set count = 0

# 从页面提取
extract userId from ".user-id"
extract pageTitle from document.title
```

### Get Variable

```yaml
# 使用变量
- 输入 ${username} into "用户名输入框"
- 点击 ${submitButton}
```

### Increment

```yaml
# 计数
set counter = 0
repeat 5 times:
  - 执行操作
  increment counter
```

### Variable Scope

```yaml
# 全局变量 (测试级别)
variables:
  baseUrl: "https://example.com"
  timeout: 5000

# 局部变量 (步骤级别)
set tempValue = extract from ".temp"
```

---

## Complete Example

```yaml
name: "自适应登录测试"
description: "根据不同场景执行不同登录流程"

variables:
  username: "test@example.com"
  password: "Test@123"

steps:
  # 步骤 1: 访问页面
  - 导航 to "${baseUrl}/login"

  # 步骤 2: 检查是否已登录
  when: state is logged_in
  then:
    - 断言 "用户已登录"
  else:
    # 步骤 3: 执行登录
    - 输入 ${username} into "邮箱输入框"
    - 输入 ${password} into "密码输入框"
    - 点击 "登录按钮"

    # 步骤 4: 处理可能的验证码
    when: element "验证码输入框" is visible
    then:
      extract code from ".verification-code"
      - 输入 ${code} into "验证码输入框"
      - 点击 "确认"

    # 步骤 5: 处理可能的错误
    when: element "错误提示" is visible
    then:
      extract errorText from ".error-message"
      - 记录 errorText
      - 失败 "登录失败: ${errorText}"

    # 步骤 6: 确认登录成功
    when: text ".welcome-message" contains ${username}
    then:
      - 断言 "登录成功"
    else:
      - 失败 "未找到欢迎消息"

  # 步骤 7: 批量操作
  forEach ".notification-item" as notification:
    - 点击 notification
    - 点击 "标记已读"
    - 点击 "返回列表"

  # 步骤 8: 分页浏览
  while element "下一页" is visible AND element "下一页" is enabled:
    - 点击 "下一页"
    - 等待 1s
```

---

## Best Practices

### 1. 简洁优先

```yaml
# 好的做法 - 简洁的声明式条件
when: element "提交按钮" is visible
then:
  - 点击 "提交按钮"

# 避免 - 过于复杂的命令式逻辑
# 应该让系统处理细节
```

### 2. 明确的超时

```yaml
# 为长时间操作设置超时
while state is loading with timeout 60000:
  - 等待 1s
```

### 3. 错误处理

```yaml
# 预期可能的错误
when: element "错误提示" is visible
then:
  extract error from ".error-text"
  - 记录 error
  - 执行清理
else:
  - 继续正常流程
```

### 4. 变量命名

```yaml
# 使用有意义的变量名
set userEmailAddress = "user@example.com"  # 好
set val1 = "user@example.com"             # 差

# 统一命名风格
set submitButton = "提交按钮"
set maxRetryCount = 3
```

### 5. 条件顺序

```yaml
# 先检查简单条件，再检查复杂条件
when: element "快速通道" is visible
then:
  - 使用快速通道
else when: element "正常入口" is visible
then:
  - 使用正常入口
else:
  - 失败 "无可用入口"
```

---

## Syntax Reference

### Condition Expression

```
condition ::= elementCondition | textCondition | stateCondition | variableCondition | compoundCondition

elementCondition ::= "element" string ("is" | "is not") elementCheck
textCondition ::= "text" string textOperator string
stateCondition ::= "state is" pageState
variableCondition ::= string comparisonOperator any
compoundCondition ::= condition logicalOperator condition

elementCheck ::= "exists" | "visible" | "enabled" | "selected"
textOperator ::= "equals" | "contains" | "matches"
comparisonOperator ::= "==" | "!=" | ">" | "<" | ">=" | "<="
logicalOperator ::= "AND" | "OR" | "NOT"
pageState ::= "logged_in" | "loading" | "error" | "empty" | "custom"
```

### Loop Expression

```
loop ::= countLoop | whileLoop | forEachLoop

countLoop ::= "repeat" number "times" [loopOptions]
whileLoop ::= "while" condition [loopOptions]
forEachLoop ::= "forEach" string "as" identifier [loopOptions]

loopOptions ::= "with" "maxIterations" number | "with" "timeout" number
```

### Variable Expression

```
variableOp ::= "set" identifier "=" any
            | "extract" identifier "from" string
            | "increment" identifier

variableReference ::= "${" identifier "}"
```

---

## Migration Guide

### From Plain Markdown

```yaml
# 之前
- 点击 "提交按钮"
- 等待加载
- 点击 "确认"

# 之后 - 添加自适应
when: element "提交按钮" is visible
then:
  - 点击 "提交按钮"
  while state is loading:
    - 等待 1s
  when: element "确认按钮" is visible
  then:
    - 点击 "确认按钮"
```

### From Code

```yaml
# 之前 (需要写代码)
if (await elementExists("提交按钮")) {
  await click("提交按钮");
  while (await isLoading()) {
    await wait(1000);
  }
}

# 之后 (声明式)
when: element "提交按钮" is visible
then:
  - 点击 "提交按钮"
  while state is loading:
    - 等待 1s
```

---

## Troubleshooting

### Infinite Loop Prevention

```yaml
# 系统会自动检测并中断无限循环
# 默认最大迭代次数: 50
# 自定义限制:
while element "item" is visible with maxIterations 100:
  - 处理 item
```

### Condition Fallback

```yaml
# 条件评估失败时的回退行为
when: element "不稳定元素" is visible with fallback false
then:
  - 执行此路径
else:
  - 执行备用路径

# 全局配置:
config:
  defaultConditionFallback: false
```

### Debug Logging

```yaml
# 启用调试日志
config:
  enableDebugLogging: true
  saveVariableSnapshots: true
```

---

## API Integration

这些语法会转换为以下 API 调用：

```typescript
// 条件评估
await conditionEngine.evaluate(conditionExpression, context)

// 循环执行
await controlFlowExecutor.loop(loopConfig, context)

// 变量操作
await variableStore.set(name, value)
await variableStore.get(name)
```

详见 `services/adaptive/` 模块实现。
