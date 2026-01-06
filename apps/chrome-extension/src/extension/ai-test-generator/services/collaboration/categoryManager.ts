/**
 * Category Manager Service
 *
 * Manages hierarchical categories for knowledge base.
 */

import type { KnowledgeCategory } from '../../types/collaboration';
import { auditLogger } from './auditLogger';
import type {
  CreateCategoryData,
  ICategoryManager,
  UpdateCategoryData,
} from './interfaces';

/**
 * In-memory storage for categories
 * In production, this would be replaced with a database
 */
interface CategoryStorage {
  categories: Map<string, KnowledgeCategory>;
  byParent: Map<string, Set<string>>; // parentId -> child category IDs
  bySlug: Map<string, string>; // slug -> categoryId
  rootCategories: Set<string>;
}

/**
 * Category Manager Implementation
 */
export class CategoryManager implements ICategoryManager {
  private storage: CategoryStorage;

  constructor() {
    this.storage = {
      categories: new Map(),
      byParent: new Map(),
      bySlug: new Map(),
      rootCategories: new Set(),
    };
  }

  /**
   * Create a new category
   */
  async createCategory(data: CreateCategoryData): Promise<KnowledgeCategory> {
    const id = this.generateId();
    const slug = this.generateSlug(data.name);
    const now = Date.now();

    // Verify parent exists if specified
    if (data.parentId) {
      const parent = this.storage.categories.get(data.parentId);
      if (!parent) {
        throw new Error(`Parent category not found: ${data.parentId}`);
      }
    }

    const category: KnowledgeCategory = {
      id,
      slug,
      name: data.name,
      description: data.description || '',
      icon: data.icon,
      color: data.color,
      parentId: data.parentId,
      order: data.order || 0,
      metadata: data.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    this.storage.categories.set(id, category);
    this.storage.bySlug.set(slug, id);

    if (data.parentId) {
      this.addToIndex(this.storage.byParent, data.parentId, id);
    } else {
      this.storage.rootCategories.add(id);
    }

    // Log creation
    await auditLogger.log({
      userId: data.createdBy,
      action: 'create_category',
      resourceType: 'category',
      resourceId: id,
      workspaceId: data.workspaceId || '',
      success: true,
    });

    return { ...category };
  }

  /**
   * Update a category
   */
  async updateCategory(
    id: string,
    data: UpdateCategoryData,
  ): Promise<KnowledgeCategory> {
    const category = this.storage.categories.get(id);
    if (!category) {
      throw new Error(`Category not found: ${id}`);
    }

    const oldParent = category.parentId;
    const now = Date.now();

    if (data.name !== undefined) {
      category.name = data.name;
      category.slug = this.generateSlug(data.name);
    }
    if (data.description !== undefined) {
      category.description = data.description;
    }
    if (data.icon !== undefined) {
      category.icon = data.icon;
    }
    if (data.color !== undefined) {
      category.color = data.color;
    }
    if (data.order !== undefined) {
      category.order = data.order;
    }
    if (data.parentId !== undefined) {
      // Verify parent exists
      if (data.parentId) {
        const parent = this.storage.categories.get(data.parentId);
        if (!parent) {
          throw new Error(`Parent category not found: ${data.parentId}`);
        }
        // Prevent circular reference
        if (data.parentId === id) {
          throw new Error('Category cannot be its own parent');
        }
      }

      // Update parent index
      if (oldParent) {
        this.removeFromIndex(this.storage.byParent, oldParent, id);
      } else {
        this.storage.rootCategories.delete(id);
      }

      if (data.parentId) {
        this.addToIndex(this.storage.byParent, data.parentId, id);
      } else {
        this.storage.rootCategories.add(id);
      }

      category.parentId = data.parentId;
    }
    if (data.metadata !== undefined) {
      category.metadata = { ...category.metadata, ...data.metadata };
    }

    category.updatedAt = now;

    return { ...category };
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    const category = this.storage.categories.get(id);
    if (!category) {
      throw new Error(`Category not found: ${id}`);
    }

    // Check if category has children
    const children = this.storage.byParent.get(id);
    if (children && children.size > 0) {
      throw new Error(
        'Cannot delete category with child categories. Move or delete children first.',
      );
    }

    // Remove from all indexes
    if (category.parentId) {
      this.removeFromIndex(this.storage.byParent, category.parentId, id);
    } else {
      this.storage.rootCategories.delete(id);
    }
    this.storage.bySlug.delete(category.slug);

    this.storage.categories.delete(id);
  }

  /**
   * Get a category by ID
   */
  async getCategory(id: string): Promise<KnowledgeCategory | null> {
    const category = this.storage.categories.get(id);
    return category ? { ...category } : null;
  }

  /**
   * Get a category by slug
   */
  async getBySlug(slug: string): Promise<KnowledgeCategory | null> {
    const id = this.storage.bySlug.get(slug);
    if (!id) {
      return null;
    }
    return this.getCategory(id);
  }

  /**
   * List all categories
   */
  async listCategories(): Promise<KnowledgeCategory[]> {
    const categories: KnowledgeCategory[] = [];
    for (const category of this.storage.categories.values()) {
      categories.push({ ...category });
    }
    return categories.sort((a, b) => a.order - b.order);
  }

  /**
   * Get root categories
   */
  async getRootCategories(): Promise<KnowledgeCategory[]> {
    const categories: KnowledgeCategory[] = [];
    for (const id of this.storage.rootCategories) {
      const category = this.storage.categories.get(id);
      if (category) {
        categories.push({ ...category });
      }
    }
    return categories.sort((a, b) => a.order - b.order);
  }

  /**
   * Get child categories
   */
  async getChildren(parentId: string): Promise<KnowledgeCategory[]> {
    const childIds = this.storage.byParent.get(parentId);
    if (!childIds) {
      return [];
    }

    const children: KnowledgeCategory[] = [];
    for (const id of childIds) {
      const category = this.storage.categories.get(id);
      if (category) {
        children.push({ ...category });
      }
    }
    return children.sort((a, b) => a.order - b.order);
  }

  /**
   * Get category tree
   */
  async getTree(): Promise<KnowledgeCategory[]> {
    return this.buildTree();
  }

  /**
   * Get category path (all ancestors)
   */
  async getPath(categoryId: string): Promise<KnowledgeCategory[]> {
    const path: KnowledgeCategory[] = [];
    let current = await this.getCategory(categoryId);

    while (current) {
      path.unshift(current);
      if (current.parentId) {
        current = await this.getCategory(current.parentId);
      } else {
        break;
      }
    }

    return path;
  }

  /**
   * Get descendants (all children, grandchildren, etc.)
   */
  async getDescendants(categoryId: string): Promise<KnowledgeCategory[]> {
    const descendants: KnowledgeCategory[] = [];
    const children = await this.getChildren(categoryId);

    for (const child of children) {
      descendants.push(child);
      const childDescendants = await this.getDescendants(child.id);
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  /**
   * Move category to new parent
   */
  async move(categoryId: string, newParentId: string | null): Promise<void> {
    const category = this.storage.categories.get(categoryId);
    if (!category) {
      throw new Error(`Category not found: ${categoryId}`);
    }

    // Verify new parent exists if specified
    if (newParentId) {
      const newParent = this.storage.categories.get(newParentId);
      if (!newParent) {
        throw new Error(`Parent category not found: ${newParentId}`);
      }
      // Prevent circular reference
      if (newParentId === categoryId) {
        throw new Error('Category cannot be its own parent');
      }
      // Check if newParent is a descendant
      const descendants = await this.getDescendants(categoryId);
      if (descendants.find((d) => d.id === newParentId)) {
        throw new Error('Cannot move category into its own descendant');
      }
    }

    // Remove from current parent
    if (category.parentId) {
      this.removeFromIndex(
        this.storage.byParent,
        category.parentId,
        categoryId,
      );
    } else {
      this.storage.rootCategories.delete(categoryId);
    }

    // Add to new parent
    if (newParentId) {
      this.addToIndex(this.storage.byParent, newParentId, categoryId);
      category.parentId = newParentId;
    } else {
      this.storage.rootCategories.add(categoryId);
      category.parentId = undefined;
    }

    category.updatedAt = Date.now();
  }

  /**
   * Reorder categories
   */
  async reorder(categoryIds: string[]): Promise<void> {
    for (let i = 0; i < categoryIds.length; i++) {
      const category = this.storage.categories.get(categoryIds[i]);
      if (category) {
        category.order = i;
        category.updatedAt = Date.now();
      }
    }
  }

  /**
   * Get category with children
   */
  async getCategoryWithChildren(
    id: string,
  ): Promise<(KnowledgeCategory & { children: KnowledgeCategory[] }) | null> {
    const category = await this.getCategory(id);
    if (!category) {
      return null;
    }

    const children = await this.getChildren(id);

    return {
      ...category,
      children,
    };
  }

  /**
   * Build category tree recursively
   */
  private async buildTree(parentId?: string): Promise<KnowledgeCategory[]> {
    const categories: KnowledgeCategory[] = [];

    const sourceIds = parentId
      ? this.storage.byParent.get(parentId) || new Set()
      : this.storage.rootCategories;

    for (const id of sourceIds) {
      const category = this.storage.categories.get(id);
      if (category) {
        const children = await this.buildTree(id);
        categories.push({
          ...category,
          children: children.length > 0 ? children : undefined,
        } as KnowledgeCategory & { children?: KnowledgeCategory[] });
      }
    }

    return categories.sort((a, b) => a.order - b.order);
  }

  /**
   * Generate a URL-friendly slug
   */
  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    let slug = base;
    let counter = 1;

    while (this.storage.bySlug.has(slug)) {
      slug = `${base}-${counter++}`;
    }

    return slug;
  }

  /**
   * Add to index
   */
  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string,
  ): void {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(value);
  }

  /**
   * Remove from index
   */
  private removeFromIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string,
  ): void {
    const set = index.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all categories (for testing)
   */
  clear(): void {
    this.storage.categories.clear();
    this.storage.byParent.clear();
    this.storage.bySlug.clear();
    this.storage.rootCategories.clear();
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.categories.size;
  }
}

// Export singleton instance
export const categoryManager = new CategoryManager();
