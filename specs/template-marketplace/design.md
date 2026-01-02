# 测试模板市场 技术方案设计文档

## 1. 项目背景与目标

重复造轮子是效率的大敌。本模块通过建立模板共享平台，让优秀的测试用例能够被复用和传播。目标是让用户 80% 的测试场景能够通过模板快速搭建。

## 2. 系统架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Template Marketplace                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Browser    │  │   Search     │  │   Publish    │       │
│  │     UI       │  │   Engine     │  │   Manager    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Rating     │  │   Version    │  │ Notification │       │
│  │   System     │  │   Manager    │  │   Service    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  API Server  │  │   Search     │  │   Storage    │       │
│  │  (Optional)  │  │   Index      │  │   (CDN)      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 部署模式

考虑到 MVP 阶段，采用两种模式：

**模式 A: 纯客户端模式（初期）**
- 使用 GitHub Repo 作为模板存储
- 客户端直接访问 GitHub API
- 无需后端服务

**模式 B: 完整服务模式（后期）**
- 独立后端 API
- 搜索引擎 (Elasticsearch/Meilisearch)
- CDN 分发

### 2.3 技术栈选型

**客户端**
* UI 框架: React + TailwindCSS
* 状态管理: Zustand
* 搜索: 客户端 Fuse.js / 后端 Meilisearch

**后端 (可选)**
* API: Node.js + Fastify
* 数据库: PostgreSQL
* 搜索: Meilisearch
* 存储: S3 兼容存储

---

## 3. 数据模型设计

### 3.1 模板定义

```typescript
interface Template {
  id: string;
  name: string;
  slug: string;                  // URL 友好的标识
  description: string;           // Markdown 格式
  shortDescription: string;      // 简短描述

  // 分类和标签
  category: TemplateCategory;
  tags: string[];
  platforms: ('web' | 'android' | 'ios')[];
  language: string;

  // 内容
  content: {
    yaml: string;                // YAML 脚本
    parameters: ParameterDef[];  // 可配置参数
    readme?: string;             // 使用说明
  };

  // 媒体
  media: {
    thumbnail?: string;          // 缩略图 URL
    preview?: string;            // 预览 GIF URL
    screenshots?: string[];      // 截图
  };

  // 元数据
  version: string;               // 语义化版本
  license: LicenseType;
  minMidsceneVersion?: string;   // 最低兼容版本

  // 发布者
  publisher: {
    id: string;
    name: string;
    avatar?: string;
    verified: boolean;
  };

  // 统计
  stats: {
    downloads: number;
    favorites: number;
    rating: number;
    ratingCount: number;
  };

  // 时间戳
  createdAt: number;
  updatedAt: number;
  publishedAt: number;
}

type TemplateCategory =
  | 'authentication'     // 登录/认证
  | 'form'               // 表单操作
  | 'search'             // 搜索功能
  | 'shopping'           // 购物车/订单
  | 'payment'            // 支付流程
  | 'navigation'         // 导航/菜单
  | 'data-entry'         // 数据录入
  | 'crud'               // 增删改查
  | 'social'             // 社交功能
  | 'media'              // 媒体处理
  | 'utility';           // 工具类

interface ParameterDef {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'url';
  required: boolean;
  default?: any;
  options?: { label: string; value: any }[];  // for select
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
  description?: string;
}
```

### 3.2 版本记录

```typescript
interface TemplateVersion {
  id: string;
  templateId: string;
  version: string;
  changelog: string;
  content: Template['content'];
  createdAt: number;
  publishedAt: number;
}
```

### 3.3 评价记录

```typescript
interface TemplateReview {
  id: string;
  templateId: string;
  userId: string;
  userName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  helpful: number;              // 有用投票
  createdAt: number;
}
```

---

## 4. 核心模块设计

### 4.1 市场浏览器

```typescript
class MarketplaceBrowser {
  private api: MarketplaceAPI;
  private cache: TemplateCache;

  async getFeatured(): Promise<Template[]> {
    return this.api.getTemplates({ featured: true, limit: 10 });
  }

  async getPopular(category?: TemplateCategory): Promise<Template[]> {
    return this.api.getTemplates({
      category,
      sortBy: 'downloads',
      limit: 20,
    });
  }

  async getLatest(): Promise<Template[]> {
    return this.api.getTemplates({
      sortBy: 'publishedAt',
      limit: 20,
    });
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    return this.api.searchTemplates(query);
  }

  async getTemplate(id: string): Promise<Template> {
    // 优先从缓存获取
    const cached = await this.cache.get(id);
    if (cached) return cached;

    const template = await this.api.getTemplate(id);
    await this.cache.set(id, template);
    return template;
  }
}

interface SearchQuery {
  keyword?: string;
  category?: TemplateCategory;
  platforms?: string[];
  rating?: number;
  sortBy?: 'relevance' | 'downloads' | 'rating' | 'publishedAt';
  page?: number;
  limit?: number;
}
```

### 4.2 模板使用器

```typescript
class TemplateApplier {
  async apply(template: Template, params: Record<string, any>): Promise<string> {
    // 1. 验证参数
    this.validateParams(template.content.parameters, params);

    // 2. 替换参数
    let yaml = template.content.yaml;
    for (const [key, value] of Object.entries(params)) {
      yaml = yaml.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
    }

    // 3. 记录使用
    await this.recordUsage(template.id);

    return yaml;
  }

  private validateParams(
    definitions: ParameterDef[],
    values: Record<string, any>
  ): void {
    for (const def of definitions) {
      const value = values[def.name];

      if (def.required && (value === undefined || value === '')) {
        throw new Error(`参数 ${def.label} 是必填的`);
      }

      if (value !== undefined && def.validation) {
        if (def.validation.pattern) {
          const regex = new RegExp(def.validation.pattern);
          if (!regex.test(String(value))) {
            throw new Error(`参数 ${def.label} 格式不正确`);
          }
        }
      }
    }
  }
}
```

### 4.3 模板发布器

```typescript
class TemplatePublisher {
  async publish(draft: TemplateDraft): Promise<Template> {
    // 1. 内容审核
    const auditResult = await this.audit(draft);
    if (!auditResult.passed) {
      throw new Error(`审核未通过: ${auditResult.reasons.join(', ')}`);
    }

    // 2. 上传媒体资源
    const mediaUrls = await this.uploadMedia(draft.media);

    // 3. 创建模板记录
    const template = await this.api.createTemplate({
      ...draft,
      media: mediaUrls,
      status: 'published',
    });

    return template;
  }

  private async audit(draft: TemplateDraft): Promise<AuditResult> {
    const issues: string[] = [];

    // 检测敏感信息
    const sensitivePatterns = [
      /password\s*[:=]\s*["'][^"']+["']/gi,
      /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi,
      /token\s*[:=]\s*["'][^"']+["']/gi,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(draft.content.yaml)) {
        issues.push('检测到硬编码的敏感信息');
        break;
      }
    }

    // 检测恶意代码
    const maliciousPatterns = [
      /eval\s*\(/,
      /exec\s*\(/,
      /<script>/i,
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(draft.content.yaml)) {
        issues.push('检测到潜在恶意代码');
        break;
      }
    }

    return {
      passed: issues.length === 0,
      reasons: issues,
    };
  }
}
```

### 4.4 评价系统

```typescript
class RatingSystem {
  async submitReview(review: Omit<TemplateReview, 'id' | 'createdAt'>): Promise<void> {
    // 检查用户是否已评价过
    const existing = await this.api.getUserReview(review.templateId, review.userId);
    if (existing) {
      throw new Error('您已评价过此模板');
    }

    await this.api.createReview(review);
    await this.updateTemplateRating(review.templateId);
  }

  private async updateTemplateRating(templateId: string): Promise<void> {
    const reviews = await this.api.getTemplateReviews(templateId);
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await this.api.updateTemplate(templateId, {
      'stats.rating': avgRating,
      'stats.ratingCount': reviews.length,
    });
  }
}
```

---

## 5. API 设计 (GitHub 模式)

使用 GitHub Repo 作为存储后端：

```
midscene-templates/
├── index.json                   # 模板索引
├── templates/
│   ├── login-basic/
│   │   ├── template.yaml        # 模板内容
│   │   ├── metadata.json        # 元数据
│   │   ├── readme.md            # 使用说明
│   │   └── preview.gif          # 预览
│   ├── search-product/
│   │   └── ...
│   └── ...
└── publishers/
    ├── official/
    │   └── profile.json
    └── ...
```

```typescript
class GitHubMarketplaceAPI implements MarketplaceAPI {
  private baseUrl = 'https://raw.githubusercontent.com/midscene/templates/main';

  async getTemplates(options: QueryOptions): Promise<Template[]> {
    const index = await fetch(`${this.baseUrl}/index.json`).then(r => r.json());

    let templates = index.templates;

    // 过滤
    if (options.category) {
      templates = templates.filter(t => t.category === options.category);
    }

    // 排序
    if (options.sortBy === 'downloads') {
      templates.sort((a, b) => b.stats.downloads - a.stats.downloads);
    }

    // 分页
    const start = (options.page || 0) * (options.limit || 20);
    return templates.slice(start, start + (options.limit || 20));
  }

  async getTemplate(id: string): Promise<Template> {
    const metadata = await fetch(
      `${this.baseUrl}/templates/${id}/metadata.json`
    ).then(r => r.json());

    const yaml = await fetch(
      `${this.baseUrl}/templates/${id}/template.yaml`
    ).then(r => r.text());

    return {
      ...metadata,
      content: { yaml, parameters: metadata.parameters },
    };
  }
}
```

---

## 6. UI 设计

### 6.1 市场首页

```
┌────────────────────────────────────────────────────────────────┐
│  🛒 模板市场                              [发布模板] [我的模板]  │
├────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐   │
│  │ 🔍 搜索模板...                          [高级搜索]     │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  分类: [全部] [登录] [表单] [搜索] [购物] [支付] [更多...]     │
│                                                                │
│  ── 精选模板 ────────────────────────────────────────────────  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ [预览图] │ │ [预览图] │ │ [预览图] │ │ [预览图] │         │
│  │ 通用登录 │ │ 商品搜索 │ │ 购物车   │ │ 表单提交 │         │
│  │ ⭐ 4.8   │ │ ⭐ 4.6   │ │ ⭐ 4.9   │ │ ⭐ 4.5   │         │
│  │ ↓ 1.2k   │ │ ↓ 890    │ │ ↓ 2.1k   │ │ ↓ 650    │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
│  ── 热门模板 ────────────────────────────────────────────────  │
│  ...                                                           │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 模板详情

```
┌────────────────────────────────────────────────────────────────┐
│  ← 返回                                                        │
├────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  通用登录模板                          │
│  │                    │  ⭐ 4.8 (128 评价)  ↓ 1,234 下载       │
│  │    [预览 GIF]      │                                        │
│  │                    │  适用于各类网站的登录场景，支持用户名   │
│  └────────────────────┘  密码登录、记住我、错误处理等。        │
│                                                                │
│  平台: 🌐 Web  📱 Android                                      │
│  分类: 登录认证  |  版本: 2.1.0  |  更新: 2024-01-15          │
│                                                                │
│  发布者: Midscene Official ✓                                   │
│                                                                │
│  [使用模板]  [收藏]  [举报]                                    │
│                                                                │
│  ── 参数配置 ────────────────────────────────────────────────  │
│  │ 登录页 URL:      [https://example.com/login        ]  │     │
│  │ 用户名:          [test@example.com                 ]  │     │
│  │ 密码:            [••••••••                         ]  │     │
│  │ 记住我:          [✓]                                │     │
│                                                                │
│  ── YAML 预览 ───────────────────────────────────────────────  │
│  │ target:                                               │     │
│  │   url: "${loginUrl}"                                  │     │
│  │ flow:                                                 │     │
│  │   - ai: "输入用户名 ${username}"                       │     │
│  │   - ai: "输入密码 ${password}"                         │     │
│  │   - ai: "点击登录按钮"                                 │     │
│                                                                │
│  ── 用户评价 ────────────────────────────────────────────────  │
│  │ ⭐⭐⭐⭐⭐ 非常好用，省了很多时间！          — 用户A  │     │
│  │ ⭐⭐⭐⭐ 参数配置灵活，但文档可以更详细。    — 用户B  │     │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. 实施计划

1. **Week 1**: 数据模型，GitHub API 集成
2. **Week 2**: 市场浏览 UI，搜索功能
3. **Week 3**: 模板详情，参数配置，使用功能
4. **Week 4**: 发布功能，评价系统，测试
