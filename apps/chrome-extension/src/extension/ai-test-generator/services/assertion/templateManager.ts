/**
 * Template Manager for Smart Assertion System
 * Manages assertion templates for reuse
 */

import type {
  AssertionParams,
  AssertionRecommendation,
  AssertionTemplate,
  AssertionType,
  TemplateCategory,
  TemplateTrigger,
} from '../../types/assertion';

/**
 * Storage key for templates
 */
const STORAGE_KEY = 'midscene_assertion_templates';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * System preset templates
 */
const SYSTEM_TEMPLATES: Omit<
  AssertionTemplate,
  'id' | 'createdAt' | 'usageCount'
>[] = [
  // Login success
  {
    name: '登录成功验证',
    description: '验证登录后显示欢迎消息或跳转到首页',
    category: 'system',
    trigger: {
      intentPattern: 'login',
    },
    assertion: {
      type: 'text_contains',
      parameters: {
        operator: 'contains',
      },
    },
  },
  // Form submit success
  {
    name: '表单提交成功',
    description: '验证表单提交后显示成功提示',
    category: 'system',
    trigger: {
      intentPattern: 'submit_form',
    },
    assertion: {
      type: 'text_contains',
      parameters: {
        operator: 'contains',
      },
    },
  },
  // Navigation check
  {
    name: '页面跳转验证',
    description: '验证页面成功跳转到目标页面',
    category: 'system',
    trigger: {
      intentPattern: 'navigate_to',
    },
    assertion: {
      type: 'url_contains',
      parameters: {
        operator: 'contains',
      },
    },
  },
  // Add to cart
  {
    name: '加入购物车验证',
    description: '验证商品成功加入购物车',
    category: 'system',
    trigger: {
      intentPattern: 'add_to_cart',
    },
    assertion: {
      type: 'text_contains',
      parameters: {
        target: '加入购物车',
        operator: 'contains',
      },
    },
  },
  // Delete confirmation
  {
    name: '删除确认',
    description: '验证删除操作后项目不再显示',
    category: 'system',
    trigger: {
      intentPattern: 'delete_item',
    },
    assertion: {
      type: 'element_exists',
      parameters: {},
    },
  },
  // Search results
  {
    name: '搜索结果验证',
    description: '验证搜索后显示结果',
    category: 'system',
    trigger: {
      intentPattern: 'search',
    },
    assertion: {
      type: 'element_visible',
      parameters: {
        target: '结果',
      },
    },
  },
  // Error message check
  {
    name: '错误提示检查',
    description: '验证页面没有显示错误信息',
    category: 'system',
    trigger: {
      actionType: 'input',
    },
    assertion: {
      type: 'element_exists',
      parameters: {},
    },
  },
];

/**
 * Template Manager class
 */
class TemplateManager {
  private templates: Map<string, AssertionTemplate> = new Map();
  private initialized = false;

  /**
   * Initialize template manager
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load user templates from storage
    await this.loadFromStorage();

    // Add system templates if not already present
    this.initSystemTemplates();

    this.initialized = true;
  }

  /**
   * Initialize system templates
   */
  private initSystemTemplates(): void {
    for (const templateData of SYSTEM_TEMPLATES) {
      const existingSystem = Array.from(this.templates.values()).find(
        (t) => t.category === 'system' && t.name === templateData.name,
      );

      if (!existingSystem) {
        const template: AssertionTemplate = {
          ...templateData,
          id: generateId(),
          createdAt: Date.now(),
          usageCount: 0,
        };
        this.templates.set(template.id, template);
      }
    }
  }

  /**
   * Load templates from localStorage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const templates: AssertionTemplate[] = JSON.parse(stored);
        for (const template of templates) {
          this.templates.set(template.id, template);
        }
      }
    } catch (error) {
      console.debug('Failed to load templates from storage:', error);
    }
  }

  /**
   * Save templates to localStorage
   */
  private async saveToStorage(): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      const templates = Array.from(this.templates.values()).filter(
        (t) => t.category !== 'system',
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      console.debug('Failed to save templates to storage:', error);
    }
  }

  /**
   * Get all templates
   */
  async getAll(): Promise<AssertionTemplate[]> {
    await this.init();
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  async getByCategory(
    category: TemplateCategory,
  ): Promise<AssertionTemplate[]> {
    await this.init();
    return Array.from(this.templates.values()).filter(
      (t) => t.category === category,
    );
  }

  /**
   * Get template by ID
   */
  async getById(id: string): Promise<AssertionTemplate | null> {
    await this.init();
    return this.templates.get(id) || null;
  }

  /**
   * Create new template
   */
  async create(
    data: Omit<AssertionTemplate, 'id' | 'createdAt' | 'usageCount'>,
  ): Promise<AssertionTemplate> {
    await this.init();

    const template: AssertionTemplate = {
      ...data,
      id: generateId(),
      createdAt: Date.now(),
      usageCount: 0,
    };

    this.templates.set(template.id, template);
    await this.saveToStorage();

    return template;
  }

  /**
   * Create template from recommendation
   */
  async createFromRecommendation(
    recommendation: AssertionRecommendation,
    name: string,
    trigger: TemplateTrigger,
  ): Promise<AssertionTemplate> {
    return this.create({
      name,
      description: recommendation.description,
      category: 'user',
      trigger,
      assertion: {
        type: recommendation.type,
        parameters: recommendation.parameters,
      },
    });
  }

  /**
   * Update template
   */
  async update(
    id: string,
    updates: Partial<Omit<AssertionTemplate, 'id' | 'createdAt'>>,
  ): Promise<AssertionTemplate | null> {
    await this.init();

    const existing = this.templates.get(id);
    if (!existing) {
      return null;
    }

    // Don't allow updating system templates
    if (existing.category === 'system' && updates.category !== 'system') {
      throw new Error('Cannot modify system templates');
    }

    const updated: AssertionTemplate = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    this.templates.set(id, updated);
    await this.saveToStorage();

    return updated;
  }

  /**
   * Delete template
   */
  async delete(id: string): Promise<boolean> {
    await this.init();

    const template = this.templates.get(id);
    if (!template) {
      return false;
    }

    // Don't allow deleting system templates
    if (template.category === 'system') {
      throw new Error('Cannot delete system templates');
    }

    this.templates.delete(id);
    await this.saveToStorage();

    return true;
  }

  /**
   * Increment usage count
   */
  async incrementUsage(id: string): Promise<void> {
    await this.init();

    const template = this.templates.get(id);
    if (template) {
      template.usageCount++;
      template.updatedAt = Date.now();
      await this.saveToStorage();
    }
  }

  /**
   * Find matching templates for context
   */
  async findMatching(
    intent: string,
    actionType?: string,
    targetText?: string,
    url?: string,
  ): Promise<AssertionTemplate[]> {
    await this.init();

    const matches: AssertionTemplate[] = [];

    for (const template of this.templates.values()) {
      if (
        this.matchesTrigger(
          template.trigger,
          intent,
          actionType,
          targetText,
          url,
        )
      ) {
        matches.push(template);
      }
    }

    // Sort by usage count (most used first)
    return matches.sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Check if template trigger matches context
   */
  private matchesTrigger(
    trigger: TemplateTrigger,
    intent: string,
    actionType?: string,
    targetText?: string,
    url?: string,
  ): boolean {
    // Check intent pattern
    if (trigger.intentPattern) {
      const regex = new RegExp(trigger.intentPattern, 'i');
      if (!regex.test(intent)) {
        return false;
      }
    }

    // Check action type
    if (trigger.actionType && actionType && trigger.actionType !== actionType) {
      return false;
    }

    // Check element pattern
    if (trigger.elementPattern && targetText) {
      const regex = new RegExp(trigger.elementPattern, 'i');
      if (!regex.test(targetText)) {
        return false;
      }
    }

    // Check URL pattern
    if (trigger.urlPattern && url) {
      const regex = new RegExp(trigger.urlPattern, 'i');
      if (!regex.test(url)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Export templates as JSON
   */
  async exportTemplates(category?: TemplateCategory): Promise<string> {
    await this.init();

    let templates = Array.from(this.templates.values());
    if (category) {
      templates = templates.filter((t) => t.category === category);
    }

    return JSON.stringify(templates, null, 2);
  }

  /**
   * Import templates from JSON
   */
  async importTemplates(json: string, overwrite = false): Promise<number> {
    await this.init();

    try {
      const templates: AssertionTemplate[] = JSON.parse(json);
      let imported = 0;

      for (const template of templates) {
        // Skip system templates
        if (template.category === 'system') {
          continue;
        }

        // Check for existing
        const existing = Array.from(this.templates.values()).find(
          (t) => t.name === template.name && t.category === template.category,
        );

        if (existing && !overwrite) {
          continue;
        }

        if (existing) {
          // Update existing
          this.templates.set(existing.id, {
            ...template,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: Date.now(),
          });
        } else {
          // Create new with new ID
          this.templates.set(template.id || generateId(), {
            ...template,
            id: template.id || generateId(),
            createdAt: template.createdAt || Date.now(),
          });
        }

        imported++;
      }

      await this.saveToStorage();
      return imported;
    } catch (error) {
      throw new Error('Invalid template JSON format');
    }
  }

  /**
   * Get popular templates
   */
  async getPopular(limit = 10): Promise<AssertionTemplate[]> {
    await this.init();

    return Array.from(this.templates.values())
      .filter((t) => t.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Clear all user templates
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

// Export singleton instance
export const templateManager = new TemplateManager();

// Export class for testing
export { TemplateManager };
