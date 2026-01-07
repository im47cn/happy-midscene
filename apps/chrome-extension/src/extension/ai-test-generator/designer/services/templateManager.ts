/**
 * Template Manager Service
 * 模板管理服务 - 管理测试流程模板的保存、加载、导入和导出
 */

import yaml from 'js-yaml';
import type { DesignerNode, TestFlow, VariableDefinition } from '../../types/designer';
import { exportYaml, importYaml } from './yamlConverter';

/**
 * 模板元数据
 */
export interface TemplateMetadata {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description?: string;
  /** 分类 */
  category?: string;
  /** 标签 */
  tags?: string[];
  /** 作者 */
  author?: string;
  /** 版本 */
  version?: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 使用次数 */
  useCount?: number;
  /** 缩略图 (base64) */
  thumbnail?: string;
  /** 节点数量 */
  nodeCount?: number;
  /** 预估执行时间 (ms) */
  estimatedDuration?: number;
}

/**
 * 模板
 */
export interface Template {
  /** 元数据 */
  metadata: TemplateMetadata;
  /** 流程数据 (不含 nodes/edges 的完整流程用于预览) */
  flow: Omit<TestFlow, 'nodes' | 'edges'> & {
    /** 序列化的节点 */
    nodes: DesignerNode[];
    /** 序列化的边 */
    edges: any[];
  };
}

/**
 * 模板分类
 */
export interface TemplateCategory {
  /** 分类 ID */
  id: string;
  /** 分类名称 */
  name: string;
  /** 图标 */
  icon?: string;
  /** 颜色 */
  color?: string;
  /** 描述 */
  description?: string;
  /** 排序 */
  order?: number;
}

/**
 * 内置模板分类
 */
export const BUILT_IN_CATEGORIES: TemplateCategory[] = [
  {
    id: 'basic',
    name: '基础操作',
    icon: '🔧',
    color: '#1890ff',
    description: '常用的基础测试操作',
    order: 1,
  },
  {
    id: 'form',
    name: '表单测试',
    icon: '📝',
    color: '#52c41a',
    description: '表单填写和提交测试',
    order: 2,
  },
  {
    id: 'navigation',
    name: '导航测试',
    icon: '🧭',
    color: '#722ed1',
    description: '页面导航和跳转测试',
    order: 3,
  },
  {
    id: 'authentication',
    name: '认证流程',
    icon: '🔐',
    color: '#fa8c16',
    description: '登录、注册等认证流程',
    order: 4,
  },
  {
    id: 'ecommerce',
    name: '电商流程',
    icon: '🛒',
    color: '#eb2f96',
    description: '购物、下单等电商测试',
    order: 5,
  },
  {
    id: 'advanced',
    name: '高级用法',
    icon: '⚡',
    color: '#13c2c2',
    description: '条件判断、循环等高级功能',
    order: 6,
  },
  {
    id: 'custom',
    name: '自定义',
    icon: '📁',
    color: '#8c8c8c',
    description: '用户自定义的模板',
    order: 99,
  },
];

/**
 * 模板存储键前缀
 */
const STORAGE_PREFIX = 'designer_template_';
const CATEGORIES_KEY = 'designer_template_categories';
const USAGE_KEY = 'designer_template_usage';

/**
 * 模板管理器
 */
export class TemplateManager {
  private templates: Map<string, Template> = new Map();
  private categories: Map<string, TemplateCategory> = new Map();
  private usageCache: Map<string, number> = new Map();

  constructor() {
    this.loadCategories();
    this.loadUsageCache();
  }

  /**
   * 初始化 - 加载所有模板
   */
  async initialize(): Promise<void> {
    await this.loadAllTemplates();
  }

  /**
   * 加载所有模板
   */
  private async loadAllTemplates(): Promise<void> {
    try {
      // 从 Chrome Storage 加载
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await new Promise<Record<string, string>>((resolve) => {
          chrome.storage.local.get(null, (data) => {
            resolve(data as Record<string, string>);
          });
        });

        for (const [key, value] of Object.entries(result)) {
          if (key.startsWith(STORAGE_PREFIX)) {
            try {
              const template = JSON.parse(value) as Template;
              this.templates.set(template.metadata.id, template);
            } catch (error) {
              console.warn(`Failed to parse template ${key}:`, error);
            }
          }
        }
      }

      // 从 localStorage 加载 (fallback)
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(STORAGE_PREFIX)) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              const template = JSON.parse(value) as Template;
              this.templates.set(template.metadata.id, template);
            }
          } catch (error) {
            console.warn(`Failed to parse template ${key}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  /**
   * 加载分类
   */
  private loadCategories(): void {
    // 先加载内置分类
    BUILT_IN_CATEGORIES.forEach((category) => {
      this.categories.set(category.id, category);
    });

    // 加载自定义分类
    try {
      const stored = localStorage.getItem(CATEGORIES_KEY);
      if (stored) {
        const customCategories = JSON.parse(stored) as TemplateCategory[];
        customCategories.forEach((category) => {
          this.categories.set(category.id, category);
        });
      }
    } catch (error) {
      console.warn('Failed to load categories:', error);
    }
  }

  /**
   * 加载使用统计
   */
  private loadUsageCache(): void {
    try {
      const stored = localStorage.getItem(USAGE_KEY);
      if (stored) {
        const usage = JSON.parse(stored) as Record<string, number>;
        Object.entries(usage).forEach(([id, count]) => {
          this.usageCache.set(id, count);
        });
      }
    } catch (error) {
      console.warn('Failed to load usage cache:', error);
    }
  }

  /**
   * 保存使用统计
   */
  private saveUsageCache(): void {
    try {
      const usage = Object.fromEntries(this.usageCache);
      localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    } catch (error) {
      console.warn('Failed to save usage cache:', error);
    }
  }

  /**
   * 保存模板
   */
  async saveTemplate(flow: TestFlow, metadata: Partial<TemplateMetadata>): Promise<Template> {
    const now = Date.now();
    const existingTemplate = this.templates.get(flow.id);

    const template: Template = {
      metadata: {
        id: flow.id,
        name: metadata.name || flow.name,
        description: metadata.description || flow.description,
        category: metadata.category || 'custom',
        tags: metadata.tags || [],
        author: metadata.author,
        version: metadata.version,
        createdAt: existingTemplate?.metadata.createdAt || now,
        updatedAt: now,
        useCount: existingTemplate?.metadata.useCount || 0,
        nodeCount: flow.nodes.length,
        estimatedDuration: this.estimateDuration(flow),
        ...metadata,
      },
      flow: {
        ...flow,
        nodes: flow.nodes,
        edges: flow.edges,
      },
    };

    this.templates.set(template.metadata.id, template);

    // 保存到 Chrome Storage
    const key = `${STORAGE_PREFIX}${template.metadata.id}`;
    const value = JSON.stringify(template);

    if (typeof chrome !== 'undefined' && chrome.storage) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      });
    }

    // 同时保存到 localStorage 作为备份
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Failed to save template to localStorage:', error);
    }

    return template;
  }

  /**
   * 加载模板
   */
  async loadTemplate(templateId: string): Promise<TestFlow | null> {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    // 增加使用计数
    template.metadata.useCount = (template.metadata.useCount || 0) + 1;
    this.usageCache.set(templateId, template.metadata.useCount);
    this.saveUsageCache();

    // 更新使用时间
    template.metadata.updatedAt = Date.now();
    await this.saveTemplate(
      { ...template.flow, id: templateId } as TestFlow,
      template.metadata,
    );

    return {
      ...template.flow,
      id: templateId,
      // 生成新的 ID 以避免冲突
      nodes: template.flow.nodes.map((node) => ({
        ...node,
        id: `${node.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      })),
      edges: template.flow.edges.map((edge) => ({
        ...edge,
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      })),
    };
  }

  /**
   * 删除模板
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    if (!this.templates.has(templateId)) {
      return false;
    }

    this.templates.delete(templateId);

    // 从 Chrome Storage 删除
    const key = `${STORAGE_PREFIX}${templateId}`;

    if (typeof chrome !== 'undefined' && chrome.storage) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.remove(key, () => resolve());
      });
    }

    // 从 localStorage 删除
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to delete template from localStorage:', error);
    }

    return true;
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): Template[] {
    return Array.from(this.templates.values()).sort(
      (a, b) => b.metadata.updatedAt - a.metadata.updatedAt,
    );
  }

  /**
   * 按分类获取模板
   */
  getTemplatesByCategory(categoryId: string): Template[] {
    return this.getAllTemplates().filter(
      (t) => t.metadata.category === categoryId,
    );
  }

  /**
   * 搜索模板
   */
  searchTemplates(query: string): Template[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTemplates().filter(
      (t) =>
        t.metadata.name.toLowerCase().includes(lowerQuery) ||
        t.metadata.description?.toLowerCase().includes(lowerQuery) ||
        t.metadata.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)),
    );
  }

  /**
   * 获取模板元数据
   */
  getTemplateMetadata(templateId: string): TemplateMetadata | null {
    const template = this.templates.get(templateId);
    return template?.metadata || null;
  }

  /**
   * 获取所有分类
   */
  getAllCategories(): TemplateCategory[] {
    return Array.from(this.categories.values()).sort(
      (a, b) => (a.order || 99) - (b.order || 99),
    );
  }

  /**
   * 创建自定义分类
   */
  async createCategory(category: Omit<TemplateCategory, 'id'>): Promise<TemplateCategory> {
    const newCategory: TemplateCategory = {
      ...category,
      id: `category-${Date.now()}`,
    };

    this.categories.set(newCategory.id, newCategory);

    // 保存到 localStorage
    try {
      const customCategories = Array.from(this.categories.values()).filter(
        (c) => !BUILT_IN_CATEGORIES.some((bc) => bc.id === c.id),
      );
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(customCategories));
    } catch (error) {
      console.warn('Failed to save categories:', error);
    }

    return newCategory;
  }

  /**
   * 导出模板为文件
   */
  exportTemplateToFile(templateId: string): string | null {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    // 转换为 YAML
    const yamlContent = exportYaml(
      {
        ...template.flow,
        id: templateId,
      },
      { includeMetadata: true },
    );

    // 添加模板元数据注释
    const metadata = template.metadata;
    const header = `# ${metadata.name}
# ${metadata.description || 'No description'}
# Category: ${metadata.category}
# Tags: ${metadata.tags?.join(', ') || 'none'}
# Version: ${metadata.version || '1.0.0'}
# Author: ${metadata.author || 'unknown'}
# Created: ${new Date(metadata.createdAt).toISOString()}
# Updated: ${new Date(metadata.updatedAt).toISOString()}
`;

    return header + yamlContent;
  }

  /**
   * 从文件导入模板
   */
  async importTemplateFromFile(
    content: string,
    metadata: Partial<TemplateMetadata>,
  ): Promise<TestFlow | null> {
    try {
      const flow = importYaml(content);
      if (!flow) {
        return null;
      }

      // 保存为新模板
      await this.saveTemplate(flow, {
        ...metadata,
        name: metadata.name || flow.name,
      });

      return flow;
    } catch (error) {
      console.error('Failed to import template:', error);
      return null;
    }
  }

  /**
   * 导出多个模板
   */
  exportMultipleTemplates(templateIds: string[]): string {
    const templates = templateIds
      .map((id) => this.templates.get(id))
      .filter((t): t is Template => t !== undefined);

    const data = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      templates: templates.map((t) => ({
        metadata: t.metadata,
        flow: t.flow,
      })),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * 导入多个模板
   */
  async importMultipleTemplates(content: string): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      const data = JSON.parse(content) as {
        templates?: Array<{ metadata: Partial<TemplateMetadata>; flow: TestFlow }>;
      };

      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error('Invalid template pack format');
      }

      for (const item of data.templates) {
        try {
          await this.saveTemplate(item.flow, item.metadata);
          success++;
        } catch (error) {
          failed++;
          errors.push(
            `${item.metadata.name || 'Unknown'}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    return { success, failed, errors };
  }

  /**
   * 获取常用模板
   */
  getPopularTemplates(limit = 10): Template[] {
    return Array.from(this.templates.values())
      .sort((a, b) => (b.metadata.useCount || 0) - (a.metadata.useCount || 0))
      .slice(0, limit);
  }

  /**
   * 获取最近使用的模板
   */
  getRecentTemplates(limit = 10): Template[] {
    return Array.from(this.templates.values())
      .sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt)
      .slice(0, limit);
  }

  /**
   * 估算执行时间
   */
  private estimateDuration(flow: TestFlow): number {
    // 基础时间估算 (ms)
    const baseTime: Record<string, number> = {
      start: 0,
      end: 0,
      click: 500,
      input: 1000,
      scroll: 300,
      wait: 0, // wait 节点有配置的 duration
      navigate: 2000,
      hover: 300,
      drag: 1000,
      assertExists: 500,
      assertText: 500,
      assertState: 300,
      aiAssert: 1000,
      ifElse: 100,
      loop: 100,
      parallel: 100,
      setVariable: 100,
      extractData: 500,
      externalData: 500,
      comment: 0,
      group: 0,
      subflow: 1000,
    };

    let total = 0;
    for (const node of flow.nodes) {
      if (node.type === 'wait') {
        const config = node.data.config as { duration?: number } | undefined;
        total += config?.duration || 1000;
      } else {
        total += baseTime[node.type] || 500;
      }
    }

    return total;
  }

  /**
   * 清理未使用的模板
   */
  async cleanupUnusedTemplates(daysThreshold = 30): Promise<number> {
    const threshold = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;
    const toDelete: string[] = [];

    for (const [id, template] of this.templates) {
      // 保留内置分类的模板
      if (template.metadata.category !== 'custom') {
        continue;
      }

      // 检查是否长时间未使用
      if (
        template.metadata.updatedAt < threshold &&
        (template.metadata.useCount || 0) === 0
      ) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      await this.deleteTemplate(id);
    }

    return toDelete.length;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalTemplates: number;
    templatesByCategory: Record<string, number>;
    totalUsage: number;
    averageNodeCount: number;
  } {
    const templates = this.getAllTemplates();
    const templatesByCategory: Record<string, number> = {};
    let totalUsage = 0;
    let totalNodes = 0;

    for (const template of templates) {
      const category = template.metadata.category || 'custom';
      templatesByCategory[category] = (templatesByCategory[category] || 0) + 1;
      totalUsage += template.metadata.useCount || 0;
      totalNodes += template.metadata.nodeCount || 0;
    }

    return {
      totalTemplates: templates.length,
      templatesByCategory,
      totalUsage,
      averageNodeCount: templates.length > 0 ? totalNodes / templates.length : 0,
    };
  }

  /**
   * 创建流程快照 (用于撤销/重做)
   */
  createFlowSnapshot(flow: TestFlow): string {
    return JSON.stringify({
      id: flow.id,
      name: flow.name,
      nodes: flow.nodes,
      edges: flow.edges,
      variables: flow.variables,
      timestamp: Date.now(),
    });
  }

  /**
   * 从快照恢复流程
   */
  restoreFlowSnapshot(snapshot: string): TestFlow | null {
    try {
      const data = JSON.parse(snapshot);
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        version: data.version || 1,
        nodes: data.nodes || [],
        edges: data.edges || [],
        variables: data.variables || [],
        metadata: data.metadata || {
          createdAt: data.timestamp,
          updatedAt: Date.now(),
        },
      };
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      return null;
    }
  }
}

/**
 * 单例实例
 */
let templateManagerInstance: TemplateManager | null = null;

/**
 * 获取模板管理器实例
 */
export function getTemplateManager(): TemplateManager {
  if (!templateManagerInstance) {
    templateManagerInstance = new TemplateManager();
    templateManagerInstance.initialize();
  }
  return templateManagerInstance;
}

/**
 * 重置模板管理器 (用于测试)
 */
export function resetTemplateManager(): void {
  templateManagerInstance = null;
}

export default TemplateManager;
