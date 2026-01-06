/**
 * Knowledge Base Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CreateArticleData } from '../../../types/collaboration';
import { categoryManager } from '../categoryManager';
import { KnowledgeBase } from '../knowledgeBase';

describe('KnowledgeBase', () => {
  let kb: KnowledgeBase;
  let testCategoryId: string;

  beforeEach(async () => {
    kb = new KnowledgeBase();

    // Create a test category using the singleton
    const category = await categoryManager.createCategory({
      name: 'Test Category',
      description: 'A test category',
      createdBy: 'user1',
      workspaceId: 'workspace1',
    });
    testCategoryId = category.id;
  });

  afterEach(() => {
    kb.clear();
    categoryManager.clear();
  });

  describe('createArticle', () => {
    it('should create a new article', async () => {
      const data: CreateArticleData = {
        title: 'Test Article',
        content: 'Test content',
        author: 'user1',
      };

      const article = await kb.createArticle(data);

      expect(article.id).toBeDefined();
      expect(article.title).toBe('Test Article');
      expect(article.content).toBe('Test content');
      expect(article.author).toBe('user1');
      expect(article.status).toBe('draft');
      expect(article.slug).toBeDefined();
      expect(article.version).toBe(1);
    });

    it('should generate excerpt from content', async () => {
      const longContent = 'a'.repeat(300);
      const article = await kb.createArticle({
        title: 'Test',
        content: longContent,
        author: 'user1',
      });

      expect(article.excerpt).toBeDefined();
      expect(article.excerpt!.length).toBeLessThanOrEqual(203); // 200 + '...'
    });

    it('should create article with category', async () => {
      const article = await kb.createArticle({
        title: 'Test Article',
        content: 'Content',
        categoryId: testCategoryId,
        author: 'user1',
      });

      expect(article.categoryId).toBe(testCategoryId);
    });

    it('should create published article', async () => {
      const article = await kb.createArticle({
        title: 'Test Article',
        content: 'Content',
        author: 'user1',
        status: 'published',
      });

      expect(article.status).toBe('published');
      expect(article.publishedAt).toBeDefined();
    });

    it('should create article with tags', async () => {
      const article = await kb.createArticle({
        title: 'Test Article',
        content: 'Content',
        author: 'user1',
        tags: ['tag1', 'tag2', 'tag3'],
      });

      expect(article.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should throw error for non-existent category', async () => {
      await expect(
        kb.createArticle({
          title: 'Test',
          content: 'Content',
          categoryId: 'non-existent',
          author: 'user1',
        }),
      ).rejects.toThrow('Category not found');
    });
  });

  describe('updateArticle', () => {
    it('should update article title and content', async () => {
      const article = await kb.createArticle({
        title: 'Original Title',
        content: 'Original content',
        author: 'user1',
      });

      const updated = await kb.updateArticle(article.id, {
        title: 'Updated Title',
        content: 'Updated content',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('Updated content');
      expect(updated.version).toBe(2);
    });

    it('should update article status', async () => {
      const article = await kb.createArticle({
        title: 'Test',
        content: 'Content',
        author: 'user1',
        status: 'draft',
      });

      const updated = await kb.updateArticle(article.id, {
        status: 'published',
      });

      expect(updated.status).toBe('published');
      expect(updated.publishedAt).toBeDefined();
    });

    it('should update article tags', async () => {
      const article = await kb.createArticle({
        title: 'Test',
        content: 'Content',
        author: 'user1',
        tags: ['tag1'],
      });

      const updated = await kb.updateArticle(article.id, {
        tags: ['tag2', 'tag3'],
      });

      expect(updated.tags).toEqual(['tag2', 'tag3']);
    });

    it('should throw error for non-existent article', async () => {
      await expect(
        kb.updateArticle('non-existent', { title: 'New Title' }),
      ).rejects.toThrow('Article not found');
    });
  });

  describe('deleteArticle', () => {
    it('should delete an article', async () => {
      const article = await kb.createArticle({
        title: 'Test',
        content: 'Content',
        author: 'user1',
      });

      await kb.deleteArticle(article.id);
      const result = await kb.getArticle(article.id);

      expect(result).toBeNull();
    });

    it('should throw error for non-existent article', async () => {
      await expect(kb.deleteArticle('non-existent')).rejects.toThrow(
        'Article not found',
      );
    });
  });

  describe('getArticle', () => {
    it('should retrieve article by ID', async () => {
      const created = await kb.createArticle({
        title: 'Test',
        content: 'Content',
        author: 'user1',
      });

      const retrieved = await kb.getArticle(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Test');
    });

    it('should return null for non-existent article', async () => {
      const result = await kb.getArticle('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getBySlug', () => {
    it('should retrieve article by slug', async () => {
      const created = await kb.createArticle({
        title: 'Test Article',
        content: 'Content',
        author: 'user1',
      });

      const retrieved = await kb.getBySlug(created.slug);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent slug', async () => {
      const result = await kb.getBySlug('non-existent-slug');
      expect(result).toBeNull();
    });
  });

  describe('listArticles', () => {
    beforeEach(async () => {
      await kb.createArticle({
        title: 'Published 1',
        content: 'Content',
        author: 'user1',
        status: 'published',
      });
      await kb.createArticle({
        title: 'Draft 1',
        content: 'Content',
        author: 'user1',
        status: 'draft',
      });
      await kb.createArticle({
        title: 'Published 2',
        content: 'Content',
        author: 'user2',
        status: 'published',
      });
    });

    it('should list all articles', async () => {
      const articles = await kb.listArticles();
      expect(articles).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const published = await kb.listArticles({ status: 'published' });
      expect(published).toHaveLength(2);

      const draft = await kb.listArticles({ status: 'draft' });
      expect(draft).toHaveLength(1);
    });

    it('should filter by author', async () => {
      const user1Articles = await kb.listArticles({ author: 'user1' });
      expect(user1Articles).toHaveLength(2);
    });

    it('should filter by tag', async () => {
      await kb.createArticle({
        title: 'Tagged Article',
        content: 'Content',
        author: 'user1',
        tags: ['test'],
        status: 'published',
      });

      const tagged = await kb.listArticles({ tag: 'test' });
      expect(tagged).toHaveLength(1);
      expect(tagged[0].title).toBe('Tagged Article');
    });

    it('should limit results', async () => {
      const articles = await kb.listArticles({ limit: 2 });
      expect(articles).toHaveLength(2);
    });

    it('should offset results', async () => {
      const page1 = await kb.listArticles({ limit: 2, offset: 0 });
      const page2 = await kb.listArticles({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
    });

    it('should sort by title', async () => {
      const sorted = await kb.listArticles({ sortBy: 'title' });
      expect(sorted[0].title).toBe('Draft 1');
    });
  });

  describe('recordView', () => {
    it('should increment view count', async () => {
      const article = await kb.createArticle({
        title: 'Test',
        content: 'Content',
        author: 'user1',
      });

      await kb.recordView(article.id);
      const updated = await kb.getArticle(article.id);

      expect(updated?.viewCount).toBe(1);
    });
  });

  describe('markHelpful', () => {
    it('should increment helpful count', async () => {
      const article = await kb.createArticle({
        title: 'Test',
        content: 'Content',
        author: 'user1',
      });

      await kb.markHelpful(article.id, true);
      const updated = await kb.getArticle(article.id);

      expect(updated?.helpfulCount).toBe(1);
    });

    it('should increment not helpful count', async () => {
      const article = await kb.createArticle({
        title: 'Test',
        content: 'Content',
        author: 'user1',
      });

      await kb.markHelpful(article.id, false);
      const updated = await kb.getArticle(article.id);

      expect(updated?.notHelpfulCount).toBe(1);
    });
  });

  describe('getPopularArticles', () => {
    it('should return articles sorted by views', async () => {
      const article1 = await kb.createArticle({
        title: 'Article 1',
        content: 'Content',
        author: 'user1',
        status: 'published',
      });

      const article2 = await kb.createArticle({
        title: 'Article 2',
        content: 'Content',
        author: 'user1',
        status: 'published',
      });

      await kb.recordView(article1.id);
      await kb.recordView(article1.id);
      await kb.recordView(article2.id);

      const popular = await kb.getPopularArticles(2);

      expect(popular[0].id).toBe(article1.id);
      expect(popular[1].id).toBe(article2.id);
    });

    it('should limit results', async () => {
      await kb.createArticle({
        title: 'Article 1',
        content: 'Content',
        author: 'user1',
        status: 'published',
      });
      await kb.createArticle({
        title: 'Article 2',
        content: 'Content',
        author: 'user1',
        status: 'published',
      });

      const popular = await kb.getPopularArticles(1);
      expect(popular).toHaveLength(1);
    });
  });

  describe('getRelatedArticles', () => {
    it('should return articles with similar tags', async () => {
      const article1 = await kb.createArticle({
        title: 'Article 1',
        content: 'Content',
        author: 'user1',
        tags: ['common', 'tag1'],
        status: 'published',
      });

      const article2 = await kb.createArticle({
        title: 'Article 2',
        content: 'Content',
        author: 'user1',
        tags: ['common', 'tag2'],
        status: 'published',
      });

      const related = await kb.getRelatedArticles(article1.id);

      // Check that article2 is in the related articles by finding it by id
      const found = related.find((r) => r.id === article2.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(article2.id);
    });

    it('should limit related articles', async () => {
      const article1 = await kb.createArticle({
        title: 'Article 1',
        content: 'Content',
        author: 'user1',
        tags: ['common'],
        status: 'published',
      });

      for (let i = 0; i < 10; i++) {
        await kb.createArticle({
          title: `Article ${i + 2}`,
          content: 'Content',
          author: 'user1',
          tags: ['common'],
          status: 'published',
        });
      }

      const related = await kb.getRelatedArticles(article1.id);
      expect(related.length).toBeLessThanOrEqual(5);
    });
  });
});
