/**
 * Category Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CategoryManager } from '../categoryManager';

describe('CategoryManager', () => {
  let cm: CategoryManager;

  beforeEach(() => {
    cm = new CategoryManager();
  });

  afterEach(() => {
    cm.clear();
  });

  describe('createCategory', () => {
    it('should create a new root category', async () => {
      const category = await cm.createCategory({
        name: 'Test Category',
        description: 'A test category',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      expect(category.id).toBeDefined();
      expect(category.name).toBe('Test Category');
      expect(category.description).toBe('A test category');
      expect(category.slug).toBe('test-category');
      expect(category.parentId).toBeUndefined();
    });

    it('should create a child category', async () => {
      const parent = await cm.createCategory({
        name: 'Parent',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child = await cm.createCategory({
        name: 'Child',
        parentId: parent.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      expect(child.parentId).toBe(parent.id);
    });

    it('should generate unique slugs for same names', async () => {
      const cat1 = await cm.createCategory({
        name: 'Test',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const cat2 = await cm.createCategory({
        name: 'Test',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      expect(cat1.slug).toBe('test');
      expect(cat2.slug).toBe('test-1');
    });

    it('should throw error for non-existent parent', async () => {
      await expect(
        cm.createCategory({
          name: 'Child',
          parentId: 'non-existent',
          createdBy: 'user1',
          workspaceId: 'workspace1',
        })
      ).rejects.toThrow('Parent category not found');
    });

    it('should set order field', async () => {
      const category = await cm.createCategory({
        name: 'Test',
        order: 5,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      expect(category.order).toBe(5);
    });
  });

  describe('getCategory', () => {
    it('should retrieve category by ID', async () => {
      const created = await cm.createCategory({
        name: 'Test',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const retrieved = await cm.getCategory(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test');
    });

    it('should return null for non-existent category', async () => {
      const result = await cm.getCategory('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getBySlug', () => {
    it('should retrieve category by slug', async () => {
      const created = await cm.createCategory({
        name: 'Test Category',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const retrieved = await cm.getBySlug('test-category');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent slug', async () => {
      const result = await cm.getBySlug('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateCategory', () => {
    it('should update category name and description', async () => {
      const category = await cm.createCategory({
        name: 'Original',
        description: 'Original desc',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const updated = await cm.updateCategory(category.id, {
        name: 'Updated',
        description: 'Updated desc',
      });

      expect(updated.name).toBe('Updated');
      expect(updated.description).toBe('Updated desc');
      expect(updated.slug).toBe('updated');
    });

    it('should update category parent', async () => {
      const cat1 = await cm.createCategory({
        name: 'Cat1',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const cat2 = await cm.createCategory({
        name: 'Cat2',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const updated = await cm.updateCategory(cat2.id, {
        parentId: cat1.id,
      });

      expect(updated.parentId).toBe(cat1.id);
    });

    it('should prevent circular reference', async () => {
      const cat = await cm.createCategory({
        name: 'Cat',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      await expect(
        cm.updateCategory(cat.id, { parentId: cat.id })
      ).rejects.toThrow('Category cannot be its own parent');
    });

    it('should throw error for non-existent category', async () => {
      await expect(
        cm.updateCategory('non-existent', { name: 'New Name' })
      ).rejects.toThrow('Category not found');
    });

    it('should throw error for non-existent parent', async () => {
      const category = await cm.createCategory({
        name: 'Cat',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      await expect(
        cm.updateCategory(category.id, { parentId: 'non-existent' })
      ).rejects.toThrow('Parent category not found');
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category', async () => {
      const category = await cm.createCategory({
        name: 'Test',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      await cm.deleteCategory(category.id);

      const retrieved = await cm.getCategory(category.id);
      expect(retrieved).toBeNull();
    });

    it('should throw error for category with children', async () => {
      const parent = await cm.createCategory({
        name: 'Parent',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      await cm.createCategory({
        name: 'Child',
        parentId: parent.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      await expect(cm.deleteCategory(parent.id)).rejects.toThrow(
        'Cannot delete category with child categories'
      );
    });

    it('should throw error for non-existent category', async () => {
      await expect(cm.deleteCategory('non-existent')).rejects.toThrow(
        'Category not found'
      );
    });
  });

  describe('listCategories', () => {
    it('should return all categories', async () => {
      await cm.createCategory({
        name: 'A',
        order: 2,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      await cm.createCategory({
        name: 'B',
        order: 1,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const categories = await cm.listCategories();

      expect(categories).toHaveLength(2);
      // Should be sorted by order
      expect(categories[0].name).toBe('B');
      expect(categories[1].name).toBe('A');
    });

    it('should return empty array when no categories', async () => {
      const categories = await cm.listCategories();
      expect(categories).toEqual([]);
    });
  });

  describe('getRootCategories', () => {
    it('should return only root categories', async () => {
      const root1 = await cm.createCategory({
        name: 'Root1',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const root2 = await cm.createCategory({
        name: 'Root2',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      await cm.createCategory({
        name: 'Child',
        parentId: root1.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const roots = await cm.getRootCategories();

      expect(roots).toHaveLength(2);
      expect(roots.every((r) => !r.parentId)).toBe(true);
    });
  });

  describe('getChildren', () => {
    it('should return child categories', async () => {
      const parent = await cm.createCategory({
        name: 'Parent',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child1 = await cm.createCategory({
        name: 'Child1',
        parentId: parent.id,
        order: 2,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child2 = await cm.createCategory({
        name: 'Child2',
        parentId: parent.id,
        order: 1,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const children = await cm.getChildren(parent.id);

      expect(children).toHaveLength(2);
      expect(children[0].id).toBe(child2.id); // Sorted by order
      expect(children[1].id).toBe(child1.id);
    });

    it('should return empty array for category with no children', async () => {
      const category = await cm.createCategory({
        name: 'No Children',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const children = await cm.getChildren(category.id);
      expect(children).toEqual([]);
    });
  });

  describe('getTree', () => {
    it('should return hierarchical tree', async () => {
      const root1 = await cm.createCategory({
        name: 'Root1',
        order: 1,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child1 = await cm.createCategory({
        name: 'Child1',
        parentId: root1.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const grandchild = await cm.createCategory({
        name: 'Grandchild',
        parentId: child1.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const tree = await cm.getTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('Root1');
      expect(tree[0].children).toBeDefined();
      expect(tree[0].children![0].name).toBe('Child1');
      expect(tree[0].children![0].children![0].name).toBe('Grandchild');
    });

    it('should return empty array when no categories', async () => {
      const tree = await cm.getTree();
      expect(tree).toEqual([]);
    });
  });

  describe('getPath', () => {
    it('should return path from root to category', async () => {
      const root = await cm.createCategory({
        name: 'Root',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child = await cm.createCategory({
        name: 'Child',
        parentId: root.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const grandchild = await cm.createCategory({
        name: 'Grandchild',
        parentId: child.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const path = await cm.getPath(grandchild.id);

      expect(path).toHaveLength(3);
      expect(path[0].name).toBe('Root');
      expect(path[1].name).toBe('Child');
      expect(path[2].name).toBe('Grandchild');
    });

    it('should return single category for root category', async () => {
      const root = await cm.createCategory({
        name: 'Root',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const path = await cm.getPath(root.id);

      expect(path).toHaveLength(1);
      expect(path[0].name).toBe('Root');
    });
  });

  describe('getDescendants', () => {
    it('should return all descendants', async () => {
      const root = await cm.createCategory({
        name: 'Root',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child1 = await cm.createCategory({
        name: 'Child1',
        parentId: root.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child2 = await cm.createCategory({
        name: 'Child2',
        parentId: root.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const grandchild = await cm.createCategory({
        name: 'Grandchild',
        parentId: child1.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const descendants = await cm.getDescendants(root.id);

      expect(descendants).toHaveLength(3);
      const ids = descendants.map((d) => d.id);
      expect(ids).toContain(child1.id);
      expect(ids).toContain(child2.id);
      expect(ids).toContain(grandchild.id);
    });

    it('should return empty array for leaf category', async () => {
      const leaf = await cm.createCategory({
        name: 'Leaf',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const descendants = await cm.getDescendants(leaf.id);
      expect(descendants).toEqual([]);
    });
  });

  describe('move', () => {
    it('should move category to new parent', async () => {
      const parent1 = await cm.createCategory({
        name: 'Parent1',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const parent2 = await cm.createCategory({
        name: 'Parent2',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child = await cm.createCategory({
        name: 'Child',
        parentId: parent1.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      await cm.move(child.id, parent2.id);

      const updated = await cm.getCategory(child.id);
      expect(updated?.parentId).toBe(parent2.id);
    });

    it('should move category to root', async () => {
      const parent = await cm.createCategory({
        name: 'Parent',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child = await cm.createCategory({
        name: 'Child',
        parentId: parent.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      await cm.move(child.id, null);

      const updated = await cm.getCategory(child.id);
      expect(updated?.parentId).toBeUndefined();
    });

    it('should prevent moving into descendant', async () => {
      const parent = await cm.createCategory({
        name: 'Parent',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child = await cm.createCategory({
        name: 'Child',
        parentId: parent.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      await expect(
        cm.move(parent.id, child.id)
      ).rejects.toThrow('Cannot move category into its own descendant');
    });

    it('should throw error for non-existent category', async () => {
      await expect(
        cm.move('non-existent', null)
      ).rejects.toThrow('Category not found');
    });
  });

  describe('reorder', () => {
    it('should reorder categories', async () => {
      const cat1 = await cm.createCategory({
        name: 'Cat1',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const cat2 = await cm.createCategory({
        name: 'Cat2',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const cat3 = await cm.createCategory({
        name: 'Cat3',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      await cm.reorder([cat3.id, cat1.id, cat2.id]);

      const categories = await cm.listCategories();
      expect(categories[0].id).toBe(cat3.id);
      expect(categories[1].id).toBe(cat1.id);
      expect(categories[2].id).toBe(cat2.id);
    });
  });

  describe('getCategoryWithChildren', () => {
    it('should return category with its children', async () => {
      const parent = await cm.createCategory({
        name: 'Parent',
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child1 = await cm.createCategory({
        name: 'Child1',
        parentId: parent.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const child2 = await cm.createCategory({
        name: 'Child2',
        parentId: parent.id,
        createdBy: 'user1',
        workspaceId: 'workspace1',
      });

      const result = await cm.getCategoryWithChildren(parent.id);

      expect(result).toBeDefined();
      expect(result?.name).toBe('Parent');
      expect(result?.children).toHaveLength(2);
      expect(result?.children[0].name).toBe('Child1');
      expect(result?.children[1].name).toBe('Child2');
    });

    it('should return null for non-existent category', async () => {
      const result = await cm.getCategoryWithChildren('non-existent');
      expect(result).toBeNull();
    });
  });
});
