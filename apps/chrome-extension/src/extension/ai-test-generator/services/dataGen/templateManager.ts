/**
 * Template Manager
 * Manages reusable data generation templates
 */

import type {
  DataTemplate,
  ITemplateManager,
  TemplateField,
} from '../../types/dataGen';
import { generateForSemanticType } from './generators';

/**
 * Storage key for templates
 */
const STORAGE_KEY = 'midscene_data_templates';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * System preset templates
 */
const SYSTEM_TEMPLATES: Omit<
  DataTemplate,
  'id' | 'createdAt' | 'updatedAt' | 'usageCount'
>[] = [
  {
    name: '标准用户注册',
    description: '常用的用户注册表单数据模板',
    category: 'system',
    fields: [
      {
        fieldId: 'username',
        fieldName: '用户名',
        generationType: 'random',
        generatorId: 'username',
      },
      {
        fieldId: 'password',
        fieldName: '密码',
        generationType: 'fixed',
        fixedValue: 'Test@123456',
      },
      {
        fieldId: 'email',
        fieldName: '邮箱',
        generationType: 'random',
        generatorId: 'email',
      },
      {
        fieldId: 'mobile',
        fieldName: '手机号',
        generationType: 'random',
        generatorId: 'mobile_phone',
      },
    ],
    variables: {},
  },
  {
    name: '用户登录',
    description: '用户登录表单数据模板',
    category: 'system',
    fields: [
      {
        fieldId: 'username',
        fieldName: '用户名',
        generationType: 'variable',
        variableName: 'loginUsername',
      },
      {
        fieldId: 'password',
        fieldName: '密码',
        generationType: 'variable',
        variableName: 'loginPassword',
      },
    ],
    variables: {
      loginUsername: 'testuser',
      loginPassword: 'Test@123456',
    },
  },
  {
    name: '个人信息',
    description: '个人信息表单数据模板',
    category: 'system',
    fields: [
      {
        fieldId: 'realname',
        fieldName: '真实姓名',
        generationType: 'random',
        generatorId: 'realname',
      },
      {
        fieldId: 'id_card',
        fieldName: '身份证号',
        generationType: 'random',
        generatorId: 'id_card',
      },
      {
        fieldId: 'address',
        fieldName: '地址',
        generationType: 'random',
        generatorId: 'address',
      },
      {
        fieldId: 'postal_code',
        fieldName: '邮编',
        generationType: 'random',
        generatorId: 'postal_code',
      },
    ],
    variables: {},
  },
  {
    name: '银行卡信息',
    description: '银行卡相关表单数据模板',
    category: 'system',
    fields: [
      {
        fieldId: 'realname',
        fieldName: '持卡人姓名',
        generationType: 'random',
        generatorId: 'realname',
      },
      {
        fieldId: 'bank_card',
        fieldName: '银行卡号',
        generationType: 'random',
        generatorId: 'bank_card',
      },
      {
        fieldId: 'mobile',
        fieldName: '预留手机号',
        generationType: 'random',
        generatorId: 'mobile_phone',
      },
    ],
    variables: {},
  },
  {
    name: '公司信息',
    description: '公司相关表单数据模板',
    category: 'system',
    fields: [
      {
        fieldId: 'company',
        fieldName: '公司名称',
        generationType: 'random',
        generatorId: 'company',
      },
      {
        fieldId: 'job_title',
        fieldName: '职位',
        generationType: 'random',
        generatorId: 'job_title',
      },
      {
        fieldId: 'address',
        fieldName: '公司地址',
        generationType: 'random',
        generatorId: 'address',
      },
    ],
    variables: {},
  },
];

/**
 * Template Manager implementation
 */
export class TemplateManager implements ITemplateManager {
  private templates: Map<string, DataTemplate> = new Map();
  private initialized = false;

  /**
   * Initialize template manager
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Load from storage
    await this.loadFromStorage();

    // Add system templates if not present
    for (const template of SYSTEM_TEMPLATES) {
      const existing = [...this.templates.values()].find(
        (t) => t.name === template.name && t.category === 'system',
      );

      if (!existing) {
        const now = Date.now();
        const fullTemplate: DataTemplate = {
          ...template,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
          usageCount: 0,
        };
        this.templates.set(fullTemplate.id, fullTemplate);
      }
    }

    await this.saveToStorage();
    this.initialized = true;
  }

  /**
   * Load templates from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const templates: DataTemplate[] = JSON.parse(stored);
        for (const template of templates) {
          this.templates.set(template.id, template);
        }
      }
    } catch (error) {
      console.error('Failed to load templates from storage:', error);
    }
  }

  /**
   * Save templates to storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      const templates = [...this.templates.values()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error('Failed to save templates to storage:', error);
    }
  }

  /**
   * Create a new template
   */
  async create(
    template: Omit<
      DataTemplate,
      'id' | 'createdAt' | 'updatedAt' | 'usageCount'
    >,
  ): Promise<DataTemplate> {
    await this.init();

    const now = Date.now();
    const newTemplate: DataTemplate = {
      ...template,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
    };

    this.templates.set(newTemplate.id, newTemplate);
    await this.saveToStorage();

    return newTemplate;
  }

  /**
   * Update an existing template
   */
  async update(
    id: string,
    updates: Partial<DataTemplate>,
  ): Promise<DataTemplate | null> {
    await this.init();

    const template = this.templates.get(id);
    if (!template) return null;

    // Don't allow modifying system templates
    if (template.category === 'system') {
      throw new Error('Cannot modify system templates');
    }

    const updatedTemplate: DataTemplate = {
      ...template,
      ...updates,
      id: template.id, // Prevent ID change
      category: template.category, // Prevent category change
      createdAt: template.createdAt, // Prevent createdAt change
      updatedAt: Date.now(),
    };

    this.templates.set(id, updatedTemplate);
    await this.saveToStorage();

    return updatedTemplate;
  }

  /**
   * Delete a template
   */
  async delete(id: string): Promise<boolean> {
    await this.init();

    const template = this.templates.get(id);
    if (!template) return false;

    if (template.category === 'system') {
      throw new Error('Cannot delete system templates');
    }

    this.templates.delete(id);
    await this.saveToStorage();

    return true;
  }

  /**
   * Get a template by ID
   */
  async get(id: string): Promise<DataTemplate | null> {
    await this.init();
    return this.templates.get(id) || null;
  }

  /**
   * List all templates
   */
  async list(): Promise<DataTemplate[]> {
    await this.init();
    return [...this.templates.values()];
  }

  /**
   * Get templates by category
   */
  async getByCategory(category: 'system' | 'user'): Promise<DataTemplate[]> {
    await this.init();
    return [...this.templates.values()].filter((t) => t.category === category);
  }

  /**
   * Apply a template to generate data
   */
  async applyTemplate(
    templateId: string,
    variables: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    await this.init();

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const result: Record<string, unknown> = {};
    const mergedVariables = { ...template.variables, ...variables };

    for (const field of template.fields) {
      let value: unknown;

      switch (field.generationType) {
        case 'fixed':
          value = field.fixedValue;
          break;

        case 'random':
          if (field.generatorId) {
            value = generateForSemanticType(field.generatorId as any);
          }
          break;

        case 'variable':
          if (field.variableName) {
            value = mergedVariables[field.variableName];
          }
          break;

        case 'pool':
          // Pool generation would be handled by DataPoolManager
          value = null;
          break;
      }

      result[field.fieldId] = value;
    }

    // Increment usage count
    template.usageCount++;
    template.updatedAt = Date.now();
    await this.saveToStorage();

    return result;
  }

  /**
   * Get popular templates (by usage count)
   */
  async getPopular(limit = 5): Promise<DataTemplate[]> {
    await this.init();
    return [...this.templates.values()]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Export templates
   */
  async exportTemplates(category?: 'system' | 'user'): Promise<string> {
    await this.init();

    let templates = [...this.templates.values()];
    if (category) {
      templates = templates.filter((t) => t.category === category);
    }

    return JSON.stringify(templates, null, 2);
  }

  /**
   * Import templates
   */
  async importTemplates(json: string): Promise<number> {
    await this.init();

    try {
      const templates: DataTemplate[] = JSON.parse(json);
      let imported = 0;

      for (const template of templates) {
        // Skip system templates
        if (template.category === 'system') continue;

        // Generate new ID to avoid conflicts
        const newTemplate: DataTemplate = {
          ...template,
          id: generateId(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        this.templates.set(newTemplate.id, newTemplate);
        imported++;
      }

      await this.saveToStorage();
      return imported;
    } catch (error) {
      throw new Error('Invalid template JSON format');
    }
  }

  /**
   * Clear user templates
   */
  async clearUserTemplates(): Promise<void> {
    await this.init();

    for (const [id, template] of this.templates) {
      if (template.category === 'user') {
        this.templates.delete(id);
      }
    }

    await this.saveToStorage();
  }
}

/**
 * Default template manager instance
 */
export const templateManager = new TemplateManager();
