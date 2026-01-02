# AI Test Generator 用户手册索引

本目录包含 AI Test Generator 各功能模块的用户手册。

## 已完成模块

| 模块 | 手册 | 功能说明 |
|------|------|----------|
| **智能数据生成** | [smart-data-gen-manual.md](./smart-data-gen-manual.md) | 22 种字段类型的测试数据生成、边界值分析、数据脱敏、模板管理 |
| **执行分析仪表板** | [analytics-dashboard-manual.md](./analytics-dashboard-manual.md) | 测试执行数据可视化、健康度评分、趋势分析、告警规则、报告生成 |
| **智能断言生成** | [smart-assertion-manual.md](./smart-assertion-manual.md) | 上下文分析、意图推断、14 种断言类型、断言模板库 |
| **测试用例自愈** | [self-healing-manual.md](./self-healing-manual.md) | 语义指纹采集、两层修复策略、置信度计算、修复确认 |

## 快速链接

### 智能数据生成
- [支持的字段类型](./smart-data-gen-manual.md#4-支持的字段类型)
- [数据生成语法](./smart-data-gen-manual.md#3-数据生成语法)
- [数据脱敏规则](./smart-data-gen-manual.md#8-数据脱敏)

### 执行分析
- [健康度评分](./analytics-dashboard-manual.md#42-健康度评分)
- [告警规则配置](./analytics-dashboard-manual.md#6-告警规则)
- [报告生成](./analytics-dashboard-manual.md#7-报告生成)

### 智能断言
- [断言类型](./smart-assertion-manual.md#3-断言类型)
- [推荐策略](./smart-assertion-manual.md#4-智能推荐)
- [断言模板](./smart-assertion-manual.md#5-断言模板)

### 自愈功能
- [工作原理](./self-healing-manual.md#2-工作原理)
- [置信度计算](./self-healing-manual.md#6-置信度计算)
- [配置管理](./self-healing-manual.md#7-配置管理)

## 规格文档

各模块的详细规格文档位于 `specs/` 目录：

| 模块 | 需求文档 | 设计文档 | 任务清单 |
|------|----------|----------|----------|
| 智能数据生成 | [requirements.md](../../specs/smart-data-gen/requirements.md) | [design.md](../../specs/smart-data-gen/design.md) | [tasks.md](../../specs/smart-data-gen/tasks.md) |
| 执行分析仪表板 | [requirements.md](../../specs/analytics-dashboard/requirements.md) | [design.md](../../specs/analytics-dashboard/design.md) | [tasks.md](../../specs/analytics-dashboard/tasks.md) |
| 智能断言生成 | [requirements.md](../../specs/smart-assertion/requirements.md) | [design.md](../../specs/smart-assertion/design.md) | [tasks.md](../../specs/smart-assertion/tasks.md) |
| 测试用例自愈 | [requirements.md](../../specs/self-healing/requirements.md) | [design.md](../../specs/self-healing/design.md) | [tasks.md](../../specs/self-healing/tasks.md) |

## 版本信息

| 模块 | 版本 | 测试覆盖 |
|------|------|----------|
| 智能数据生成 | 1.0.0 | 168 tests |
| 执行分析仪表板 | 1.0.0 | 154 tests |
| 智能断言生成 | 1.0.0 | 63 tests |
| 测试用例自愈 | 1.0.0 | 32 tests |

**总测试数**: 417 tests (所有通过)
