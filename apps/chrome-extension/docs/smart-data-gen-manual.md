# 智能数据生成用户手册

本手册介绍如何使用 AI Test Generator 的智能数据生成功能，自动为测试用例生成符合业务规则的测试数据。

## 目录

1. [功能概述](#1-功能概述)
2. [快速开始](#2-快速开始)
3. [数据生成语法](#3-数据生成语法)
4. [支持的字段类型](#4-支持的字段类型)
5. [数据模板](#5-数据模板)
6. [数据池](#6-数据池)
7. [边界值测试](#7-边界值测试)
8. [数据脱敏](#8-数据脱敏)
9. [UI 组件使用](#9-ui-组件使用)
10. [最佳实践](#10-最佳实践)
11. [常见问题](#11-常见问题)

---

## 1. 功能概述

智能数据生成模块提供以下核心能力：

- **字段语义识别**：自动识别表单字段类型（用户名、邮箱、手机号等）
- **智能数据生成**：根据字段类型生成符合格式要求的测试数据
- **边界值分析**：自动生成边界条件测试数据
- **数据脱敏**：对敏感数据进行保护处理
- **模板管理**：保存和复用数据生成模板
- **数据池**：预定义可复用的数据集合

---

## 2. 快速开始

### 2.1 在测试步骤中使用

在编写测试步骤时，使用特殊语法标记需要自动生成的数据：

```
在用户名输入框中填写 [自动生成:用户名]
在手机号输入框中填写 [自动生成:手机]
在邮箱输入框中填写 [auto:email]
```

执行测试时，系统会自动将标记替换为生成的真实数据。

### 2.2 使用 DataGenPanel 组件

在 UI 中打开数据生成面板，选择字段类型，点击生成按钮即可获得测试数据。

---

## 3. 数据生成语法

### 3.1 自动生成语法

支持中文和英文两种格式：

| 语法 | 说明 | 示例 |
|------|------|------|
| `[自动生成:类型]` | 中文格式 | `[自动生成:手机]` |
| `[auto:type]` | 英文格式 | `[auto:email]` |

### 3.2 模板语法

使用预定义模板生成关联数据：

```
[模板:用户.姓名]
[template:user.email]
```

### 3.3 数据池语法

从预定义数据池中随机选取：

```
[数据池:城市]
[pool:provinces]
```

### 3.4 随机语法

根据上下文自动推断类型并生成：

```
在 [随机] 字段中输入值
Enter [random] value
```

---

## 4. 支持的字段类型

系统支持 22 种常见字段类型：

### 4.1 个人信息类

| 类型标识 | 中文关键词 | 英文关键词 | 示例输出 |
|----------|------------|------------|----------|
| `username` | 用户名、账号、登录名 | username, account, login | `user_a3x9k2` |
| `realname` | 姓名、真实姓名、名字 | name, real name, full name | `张三` |
| `nickname` | 昵称、别名 | nickname, display name | `快乐小精灵` |
| `password` | 密码、口令 | password, pwd | `Aa123456!` |

### 4.2 联系方式类

| 类型标识 | 中文关键词 | 英文关键词 | 示例输出 |
|----------|------------|------------|----------|
| `mobile_phone` | 手机、手机号、移动电话 | mobile, phone, cell | `13812345678` |
| `landline` | 座机、固定电话 | landline, tel | `010-12345678` |
| `email` | 邮箱、电子邮件 | email, e-mail | `test@example.com` |

### 4.3 证件类

| 类型标识 | 中文关键词 | 英文关键词 | 示例输出 |
|----------|------------|------------|----------|
| `id_card` | 身份证、身份证号 | id card, id number | `110101199001011234` |
| `bank_card` | 银行卡、卡号 | bank card, card number | `6222021234567890123` |

### 4.4 地址类

| 类型标识 | 中文关键词 | 英文关键词 | 示例输出 |
|----------|------------|------------|----------|
| `address` | 地址、详细地址 | address, street | `北京市朝阳区建国路100号` |
| `postal_code` | 邮编、邮政编码 | zip, postal | `100020` |
| `city` | 城市 | city | `上海` |
| `province` | 省份 | province, state | `广东省` |
| `country` | 国家、国籍 | country | `中国` |

### 4.5 业务类

| 类型标识 | 中文关键词 | 英文关键词 | 示例输出 |
|----------|------------|------------|----------|
| `company` | 公司、单位、企业 | company, organization | `杭州阿里巴巴科技有限公司` |
| `job_title` | 职位、职称 | job, position, title | `高级工程师` |
| `amount` | 金额、价格、费用 | amount, price | `1234.56` |
| `quantity` | 数量、件数 | quantity, qty | `10` |
| `description` | 描述、备注、说明 | description, note | `这是一段测试描述文本` |
| `url` | 网址、链接 | url, link | `https://example.com/test` |

### 4.6 其他类

| 类型标识 | 中文关键词 | 英文关键词 | 示例输出 |
|----------|------------|------------|----------|
| `captcha` | 验证码 | captcha, verification | `A3X9` |
| `date_of_birth` | 出生日期、生日 | birthday, birth date | `1990-01-15` |

---

## 5. 数据模板

### 5.1 系统预置模板

系统提供 5 个常用模板：

| 模板名称 | 包含字段 |
|----------|----------|
| `standard_user` | 用户名、邮箱、手机号、密码 |
| `chinese_user` | 姓名、身份证、手机号、地址 |
| `payment_info` | 持卡人、银行卡号、手机号 |
| `company_employee` | 姓名、公司、职位、邮箱 |
| `delivery_address` | 收货人、手机号、省份、城市、详细地址、邮编 |

### 5.2 使用模板

```typescript
import { templateManager } from './services/dataGen';

// 获取模板
const template = templateManager.getTemplate('standard_user');

// 根据模板生成数据
const userData = await templateManager.generateFromTemplate('standard_user');
// 结果: { username: 'user_x7k2m', email: 'test@163.com', ... }
```

### 5.3 自定义模板

```typescript
// 创建自定义模板
templateManager.createTemplate({
  id: 'my_template',
  name: '我的模板',
  description: '自定义测试模板',
  fields: [
    { name: 'email', semanticType: 'email', constraints: { required: true } },
    { name: 'password', semanticType: 'password', constraints: { minLength: 8 } }
  ],
  isSystem: false,
  createdAt: Date.now(),
  updatedAt: Date.now()
});
```

---

## 6. 数据池

### 6.1 内置数据池

系统提供 10 个预定义数据池：

| 数据池名称 | 数据量 | 示例数据 |
|------------|--------|----------|
| `provinces` | 34 | 北京、上海、广东省... |
| `cities` | 50+ | 北京、上海、广州、深圳... |
| `surnames` | 100 | 张、王、李、赵... |
| `given_names` | 100 | 伟、芳、敏、军... |
| `email_domains` | 10 | 163.com、qq.com、gmail.com... |
| `company_suffixes` | 10 | 科技有限公司、集团... |
| `job_titles` | 20 | 工程师、经理、总监... |
| `streets` | 30 | 中山路、人民路... |
| `districts` | 30 | 朝阳区、海淀区... |
| `descriptions` | 20 | 测试描述模板... |

### 6.2 使用数据池

```typescript
import { dataPoolManager } from './services/dataGen';

// 随机获取一个城市
const city = dataPoolManager.getRandomItem('cities');

// 获取多个不重复的值
const cities = dataPoolManager.getMultipleItems('cities', 3);

// 获取所有值
const allCities = dataPoolManager.getPool('cities');
```

### 6.3 自定义数据池

```typescript
// 创建自定义数据池
dataPoolManager.createPool({
  id: 'product_names',
  name: '产品名称',
  description: '测试用产品名称列表',
  values: ['iPhone 15', 'MacBook Pro', 'iPad Air'],
  category: 'custom'
});

// 扩展已有数据池
dataPoolManager.extendPool('cities', ['苏州', '无锡', '常州']);
```

---

## 7. 边界值测试

### 7.1 自动生成边界值

系统会根据字段约束自动生成边界值测试用例：

```typescript
import { generateBoundaryTestCases } from './services/dataGen';

const field = {
  id: 'username',
  name: 'username',
  label: '用户名',
  fieldType: 'text',
  semanticType: 'username',
  constraints: {
    required: true,
    minLength: 3,
    maxLength: 20
  }
};

const testCases = generateBoundaryTestCases(field);
```

生成结果：

| 类型 | 值 | 预期有效性 | 说明 |
|------|-----|-----------|------|
| min | `abc` | valid | 最小长度 (3字符) |
| max | `abcdefghij1234567890` | valid | 最大长度 (20字符) |
| below_min | `ab` | invalid | 低于最小长度 |
| above_max | `abcdefghij12345678901` | invalid | 超过最大长度 |
| empty | `` | invalid | 空值 (必填字段) |

### 7.2 覆盖率分析

```typescript
import { analyzeBoundaryCoverage } from './services/dataGen';

const coverage = analyzeBoundaryCoverage(testCases, field);
// 结果: { coveragePercent: 100, missingCategories: [] }
```

---

## 8. 数据脱敏

### 8.1 脱敏规则

系统对以下 7 种敏感数据类型自动脱敏：

| 数据类型 | 脱敏前 | 脱敏后 |
|----------|--------|--------|
| 手机号 | `13812345678` | `138****5678` |
| 身份证 | `110101199001011234` | `110101********1234` |
| 银行卡 | `6222021234567890123` | `6222****0123` |
| 邮箱 | `test@example.com` | `t***@example.com` |
| 姓名 | `张三` | `张**` |
| 密码 | `secret123` | `********` |
| 地址 | `北京市朝阳区建国路100号` | `北京市朝阳区******` |

### 8.2 使用脱敏功能

```typescript
import { dataMasker, maskValue, isSensitiveType } from './services/dataGen';

// 检查是否敏感类型
isSensitiveType('mobile_phone'); // true
isSensitiveType('username');     // false

// 单值脱敏
const masked = maskValue('13812345678', 'mobile_phone');
// 结果: '138****5678'

// 批量脱敏
const maskedRecord = dataMasker.maskRecord({
  name: '张三',
  phone: '13812345678',
  email: 'test@example.com'
}, {
  name: 'realname',
  phone: 'mobile_phone',
  email: 'email'
});
```

### 8.3 自定义脱敏规则

```typescript
dataMasker.addRule({
  id: 'custom_phone',
  semanticType: 'mobile_phone',
  strategy: 'partial',
  pattern: '^(\\d{3})\\d{4}(\\d{4})$',
  replacement: '$1-****-$2'
});

// 使用自定义规则
maskValue('13812345678', 'mobile_phone');
// 结果: '138-****-5678'
```

---

## 9. UI 组件使用

### 9.1 DataGenPanel 组件

```tsx
import { DataGenPanel } from './components/dataGen';

function MyComponent() {
  const handleInsertValue = (value: string, semanticType: string) => {
    console.log(`插入值: ${value}, 类型: ${semanticType}`);
  };

  return (
    <DataGenPanel
      onInsertValue={handleInsertValue}
      compact={false}
    />
  );
}
```

### 9.2 面板功能

1. **单字段生成**：选择字段类型，点击生成按钮
2. **预置表单**：一键生成整套表单数据
3. **模板管理**：创建、编辑、删除自定义模板
4. **生成历史**：查看和复用历史生成的数据

---

## 10. 最佳实践

### 10.1 测试步骤编写

```
# 推荐写法 - 使用英文类型标识
在用户名输入框中填写 [自动生成:username]
在手机号输入框中填写 [自动生成:mobile]

# 也支持中文类型标识
在邮箱输入框中填写 [自动生成:邮箱]
```

### 10.2 表单测试策略

```
1. 正常流程：使用模板生成完整数据
2. 边界测试：使用边界值测试功能
3. 异常测试：手动输入非法数据
```

### 10.3 敏感数据处理

```
- 测试报告中自动使用脱敏数据
- 日志记录使用脱敏数据
- 原始数据仅在执行时临时使用
```

---

## 11. 常见问题

### Q1: 字段类型识别不准确怎么办？

可以通过添加自定义关键词提高识别率：

```typescript
import { addSemanticKeywords } from './services/dataGen';

// 为 email 类型添加自定义关键词
addSemanticKeywords('email', ['电子邮箱', 'e-mail地址']);
```

### Q2: 如何生成特定格式的数据？

使用自定义约束：

```typescript
import { dataGenerator } from './services/dataGen';

const field = {
  id: 'custom_email',
  name: 'email',
  label: '邮箱',
  fieldType: 'email',
  semanticType: 'email',
  constraints: {
    options: ['company.com']  // 限定域名
  }
};

const email = await dataGenerator.generate(field);
// 结果: 'user_x7k2m@company.com'
```

### Q3: 如何批量生成测试数据？

```typescript
import { createFormFields, dataGenerator } from './services/dataGen';

// 生成登录表单数据
const loginFields = createFormFields('login');
const loginData = {};

for (const field of loginFields) {
  loginData[field.name] = await dataGenerator.generate(field);
}
```

### Q4: 数据脱敏后如何还原？

出于安全考虑，脱敏后的数据不可逆向还原。如需原始数据，请在执行记录中获取（仅当次会话可用）。

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2024-01 | 初始版本，支持 22 种字段类型 |

---

## 相关文档

- [需求规格说明书](../../../specs/smart-data-gen/requirements.md)
- [设计文档](../../../specs/smart-data-gen/design.md)
- [开发任务](../../../specs/smart-data-gen/tasks.md)
