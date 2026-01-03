# 测试模板市场 - 任务清单

## Phase 1: 数据层

- [x] **数据模型定义** (`types/marketplace.ts`)
  - Template 接口
  - ParameterDef 接口
  - TemplateReview 接口

- [x] **API 抽象层** (`services/marketplaceAPI.ts`)
  - 统一 API 接口
  - GitHub 模式实现
  - 缓存策略

- [x] **本地存储** (`services/templateStorage.ts`)
  - 已下载模板管理
  - 收藏列表
  - 使用历史

## Phase 2: 市场浏览

- [x] **市场首页** (`components/MarketplaceHome.tsx`)
  - 精选模板展示
  - 热门/最新模板
  - 分类导航

- [x] **搜索功能** (`components/TemplateSearch.tsx`)
  - 关键词搜索
  - 高级筛选
  - 搜索结果列表

- [x] **模板卡片** (`components/TemplateCard.tsx`)
  - 缩略图展示
  - 基本信息
  - 统计数据

- [x] **分类导航** (`components/CategoryNav.tsx`)
  - 分类列表
  - 分类筛选
  - 分类统计

## Phase 3: 模板详情

- [x] **模板详情页** (`components/TemplateDetail.tsx`)
  - 基本信息展示
  - 媒体预览
  - 发布者信息

- [x] **参数配置表单** (`components/ParameterForm.tsx`)
  - 动态表单生成
  - 参数验证
  - 默认值处理

- [x] **YAML 预览** (`components/YamlPreview.tsx`)
  - 语法高亮
  - 参数替换预览
  - 复制功能

- [x] **评价列表** (`components/ReviewList.tsx`)
  - 评价展示
  - 排序筛选
  - 评价统计

## Phase 4: 模板使用

- [x] **模板应用器** (`services/templateApplier.ts`)
  - 参数替换
  - YAML 生成
  - 导入到项目

- [x] **使用向导** (`components/ApplyWizard.tsx`)
  - 步骤引导
  - 参数配置
  - 预览确认

- [x] **版本选择** (`components/VersionSelector.tsx`)
  - 版本列表
  - 版本比较
  - 更新日志

## Phase 5: 模板发布

- [x] **发布表单** (`components/PublishForm.tsx`)
  - 基本信息输入
  - 媒体上传
  - 参数定义

- [x] **内容审核** (`services/templateAuditor.ts`)
  - 敏感信息检测
  - 恶意代码检测
  - 内容规范检查

- [x] **发布预览** (`components/PublishPreview.tsx`)
  - 最终效果预览
  - 审核状态展示
  - 提交确认

## Phase 6: 评价系统

- [x] **评价提交** (`components/ReviewForm.tsx`)
  - 评分选择
  - 评价输入
  - 提交处理

- [x] **评价管理** (`services/ratingSystem.ts`)
  - 评价提交
  - 评分计算
  - 有用投票

## Phase 7: 集成与优化

- [x] **市场入口集成**
  - 侧边栏入口
  - 快捷访问
  - 推荐展示

- [x] **离线支持** (`services/offlineSupport.ts`)
  - 模板缓存
  - 离线浏览
  - 同步机制

- [x] **性能优化** (`services/performanceOptimizations.ts`)
  - 图片懒加载
  - 搜索防抖
  - 列表虚拟化

- [x] **测试与文档**
  - 单元测试
  - 集成测试
  - 发布指南

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── marketplace/
│   ├── components/
│   │   ├── MarketplaceHome.tsx  # 市场首页
│   │   ├── TemplateSearch.tsx   # 搜索组件
│   │   ├── TemplateCard.tsx     # 模板卡片
│   │   ├── TemplateDetail.tsx   # 模板详情
│   │   ├── ParameterForm.tsx    # 参数表单
│   │   ├── YamlPreview.tsx      # YAML 预览
│   │   ├── ReviewList.tsx       # 评价列表
│   │   ├── ReviewForm.tsx       # 评价表单
│   │   ├── PublishForm.tsx      # 发布表单
│   │   ├── PublishPreview.tsx   # 发布预览
│   │   ├── ApplyWizard.tsx      # 使用向导
│   │   ├── VersionSelector.tsx  # 版本选择
│   │   └── CategoryNav.tsx      # 分类导航
│   ├── services/
│   │   ├── marketplaceAPI.ts    # API 接口
│   │   ├── templateStorage.ts   # 本地存储
│   │   ├── templateApplier.ts   # 模板应用
│   │   ├── templateAuditor.ts   # 内容审核
│   │   ├── ratingSystem.ts      # 评价系统
│   │   ├── offlineSupport.ts    # 离线支持
│   │   └── performanceOptimizations.ts # 性能优化
│   └── types/
│       └── marketplace.ts       # 类型定义
```

## 验收标准

1. ✅ 市场首页加载 < 3s (使用本地 mock 数据)
2. ✅ 搜索响应 < 1s (使用 Fuse.js 客户端搜索)
3. ✅ 支持 1000+ 模板浏览 (分页支持)
4. ✅ 参数配置功能完整
5. ✅ 发布审核有效拦截敏感信息
6. ✅ 评价系统正常运作
