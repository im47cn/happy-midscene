/**
 * Knowledge Base Service
 *
 * Manages knowledge articles and documentation.
 */

import type {
  KnowledgeArticle,
  KnowledgeArticleStatus,
} from '../../types/collaboration';
import { auditLogger } from './auditLogger';
import { categoryManager } from './categoryManager';
import type {
  ArticleQueryOptions,
  CreateArticleData,
  IKnowledgeBase,
  UpdateArticleData,
} from './interfaces';
import { knowledgeSearch } from './knowledgeSearch';

/**
 * In-memory storage for articles
 * In production, this would be replaced with a database
 */
interface ArticleStorage {
  articles: Map<string, KnowledgeArticle>;
  byCategory: Map<string, Set<string>>;
  byAuthor: Map<string, Set<string>>;
  byTag: Map<string, Set<string>>;
  byStatus: Map<KnowledgeArticleStatus, Set<string>>;
  bySlug: Map<string, string>; // slug -> articleId
}

/**
 * Knowledge Base Implementation
 */
export class KnowledgeBase implements IKnowledgeBase {
  private storage: ArticleStorage;

  constructor() {
    this.storage = {
      articles: new Map(),
      byCategory: new Map(),
      byAuthor: new Map(),
      byTag: new Map(),
      byStatus: {
        draft: new Set(),
        published: new Set(),
        archived: new Set(),
      },
      bySlug: new Map(),
    };
  }

  /**
   * Create a new article
   */
  async createArticle(data: CreateArticleData): Promise<KnowledgeArticle> {
    const id = this.generateId();
    const slug = this.generateSlug(data.title);
    const now = Date.now();

    // Verify category exists
    if (data.categoryId) {
      const category = await categoryManager.getCategory(data.categoryId);
      if (!category) {
        throw new Error(`Category not found: ${data.categoryId}`);
      }
    }

    const article: KnowledgeArticle = {
      id,
      slug,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt || this.generateExcerpt(data.content),
      categoryId: data.categoryId,
      tags: data.tags || [],
      author: data.author,
      status: data.status || 'draft',
      version: 1,
      viewCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      attachments: data.attachments || [],
      relatedArticleIds: data.relatedArticleIds || [],
      metadata: data.metadata || {},
      createdAt: now,
      updatedAt: now,
      publishedAt: data.status === 'published' ? now : undefined,
    };

    this.storage.articles.set(id, article);
    this.addToIndex(this.storage.byCategory, data.categoryId, id);
    this.addToIndex(this.storage.byAuthor, data.author, id);
    this.storage.byStatus[article.status].add(id);
    this.storage.bySlug.set(slug, id);

    // Index tags
    for (const tag of data.tags || []) {
      this.addToIndex(this.storage.byTag, tag, id);
    }

    // Add to search index
    await knowledgeSearch.indexArticle(article);

    // Log creation
    await auditLogger.log({
      userId: data.author,
      action: 'create_article',
      resourceType: 'article',
      resourceId: id,
      workspaceId: data.workspaceId || '',
      success: true,
    });

    return { ...article };
  }

  /**
   * Update an article
   */
  async updateArticle(
    id: string,
    data: UpdateArticleData,
  ): Promise<KnowledgeArticle> {
    const article = this.storage.articles.get(id);
    if (!article) {
      throw new Error(`Article not found: ${id}`);
    }

    const oldCategory = article.categoryId;
    const oldStatus = article.status;
    const oldTags = [...article.tags];
    const now = Date.now();

    // Update fields
    if (data.title !== undefined) {
      article.title = data.title;
      article.slug = this.generateSlug(data.title);
    }
    if (data.content !== undefined) {
      article.content = data.content;
      article.excerpt = this.generateExcerpt(data.content);
    }
    if (data.excerpt !== undefined) {
      article.excerpt = data.excerpt;
    }
    if (data.categoryId !== undefined) {
      // Verify category exists
      if (data.categoryId) {
        const category = await categoryManager.getCategory(data.categoryId);
        if (!category) {
          throw new Error(`Category not found: ${data.categoryId}`);
        }
      }

      // Update category index
      if (oldCategory) {
        this.removeFromIndex(this.storage.byCategory, oldCategory, id);
      }
      if (data.categoryId) {
        this.addToIndex(this.storage.byCategory, data.categoryId, id);
      }
      article.categoryId = data.categoryId;
    }
    if (data.tags !== undefined) {
      // Update tag indexes
      for (const tag of oldTags) {
        this.removeFromIndex(this.storage.byTag, tag, id);
      }
      for (const tag of data.tags) {
        this.addToIndex(this.storage.byTag, tag, id);
      }
      article.tags = data.tags;
    }
    if (data.status !== undefined) {
      article.status = data.status;
      if (data.status === 'published' && !article.publishedAt) {
        article.publishedAt = now;
      }
      this.storage.byStatus[oldStatus].delete(id);
      this.storage.byStatus[data.status].add(id);
    }
    if (data.metadata !== undefined) {
      article.metadata = { ...article.metadata, ...data.metadata };
    }
    if (data.attachments !== undefined) {
      article.attachments = data.attachments;
    }
    if (data.relatedArticleIds !== undefined) {
      article.relatedArticleIds = data.relatedArticleIds;
    }

    article.version++;
    article.updatedAt = now;

    // Re-index in search
    await knowledgeSearch.indexArticle(article);

    // Log update
    await auditLogger.log({
      userId: article.author,
      action: 'update_article',
      resourceType: 'article',
      resourceId: id,
      workspaceId: '',
      success: true,
    });

    return { ...article };
  }

  /**
   * Delete an article
   */
  async deleteArticle(id: string): Promise<void> {
    const article = this.storage.articles.get(id);
    if (!article) {
      throw new Error(`Article not found: ${id}`);
    }

    // Remove from all indexes
    if (article.categoryId) {
      this.removeFromIndex(this.storage.byCategory, article.categoryId, id);
    }
    this.removeFromIndex(this.storage.byAuthor, article.author, id);
    for (const tag of article.tags) {
      this.removeFromIndex(this.storage.byTag, tag, id);
    }
    this.storage.byStatus[article.status].delete(id);
    this.storage.bySlug.delete(article.slug);

    // Remove from search index
    await knowledgeSearch.removeArticle(id);

    this.storage.articles.delete(id);
  }

  /**
   * Get an article by ID
   */
  async getArticle(id: string): Promise<KnowledgeArticle | null> {
    const article = this.storage.articles.get(id);
    return article ? { ...article } : null;
  }

  /**
   * Get an article by slug
   */
  async getBySlug(slug: string): Promise<KnowledgeArticle | null> {
    const id = this.storage.bySlug.get(slug);
    if (!id) {
      return null;
    }
    return this.getArticle(id);
  }

  /**
   * List articles with optional filters
   */
  async listArticles(
    options?: ArticleQueryOptions,
  ): Promise<KnowledgeArticle[]> {
    let articles: KnowledgeArticle[] = [];

    // Start with all articles or filter by initial criteria
    if (options?.categoryId) {
      const ids = this.storage.byCategory.get(options.categoryId);
      if (ids) {
        for (const id of ids) {
          const article = this.storage.articles.get(id);
          if (article) {
            articles.push({ ...article });
          }
        }
      }
    } else if (options?.author) {
      const ids = this.storage.byAuthor.get(options.author);
      if (ids) {
        for (const id of ids) {
          const article = this.storage.articles.get(id);
          if (article) {
            articles.push({ ...article });
          }
        }
      }
    } else if (options?.status) {
      const ids = this.storage.byStatus[options.status];
      for (const id of ids) {
        const article = this.storage.articles.get(id);
        if (article) {
          articles.push({ ...article });
        }
      }
    } else if (options?.tag) {
      const ids = this.storage.byTag.get(options.tag);
      if (ids) {
        for (const id of ids) {
          const article = this.storage.articles.get(id);
          if (article) {
            articles.push({ ...article });
          }
        }
      }
    } else {
      // All articles
      for (const article of this.storage.articles.values()) {
        articles.push({ ...article });
      }
    }

    // Apply additional filters
    if (options?.searchQuery) {
      const ids = await knowledgeSearch.search(options.searchQuery);
      const idSet = new Set(ids);
      articles = articles.filter((a) => idSet.has(a.id));
    }

    // Sorting
    articles.sort((a, b) => {
      switch (options?.sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'views':
          return b.viewCount - a.viewCount;
        case 'helpful':
          return b.helpfulCount - a.helpfulCount;
        case 'updated':
        default:
          return b.updatedAt - a.updatedAt;
      }
    });

    // Pagination
    if (options?.limit !== undefined) {
      const offset = options.offset || 0;
      articles = articles.slice(offset, offset + options.limit);
    }

    return articles;
  }

  /**
   * Get articles by category
   */
  async getByCategory(categoryId: string): Promise<KnowledgeArticle[]> {
    return this.listArticles({ categoryId });
  }

  /**
   * Get articles by author
   */
  async getByAuthor(authorId: string): Promise<KnowledgeArticle[]> {
    return this.listArticles({ author: authorId });
  }

  /**
   * Get related articles
   */
  async getRelatedArticles(articleId: string): Promise<KnowledgeArticle[]> {
    const article = this.storage.articles.get(articleId);
    if (!article) {
      return [];
    }

    const related: KnowledgeArticle[] = [];

    // Add explicitly related articles
    for (const relatedId of article.relatedArticleIds) {
      const a = this.storage.articles.get(relatedId);
      if (a && a.status === 'published') {
        related.push({ ...a });
      }
    }

    // Find articles with similar tags
    for (const tag of article.tags) {
      const ids = this.storage.byTag.get(tag);
      if (ids) {
        for (const id of ids) {
          if (id !== articleId && !related.find((r) => r.id === id)) {
            const a = this.storage.articles.get(id);
            if (a && a.status === 'published') {
              related.push({ ...a });
            }
          }
        }
      }
    }

    return related.slice(0, 5); // Limit to 5 related articles
  }

  /**
   * Get popular articles
   */
  async getPopularArticles(limit = 10): Promise<KnowledgeArticle[]> {
    const all = await this.listArticles({ status: 'published' });
    return all.sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
  }

  /**
   * Record a view
   */
  async recordView(id: string): Promise<void> {
    const article = this.storage.articles.get(id);
    if (article) {
      article.viewCount++;
    }
  }

  /**
   * Mark article as helpful/not helpful
   */
  async markHelpful(id: string, helpful: boolean): Promise<void> {
    const article = this.storage.articles.get(id);
    if (article) {
      if (helpful) {
        article.helpfulCount++;
      } else {
        article.notHelpfulCount++;
      }
    }
  }

  /**
   * Get article history
   */
  async getHistory(id: string): Promise<KnowledgeArticle[]> {
    // In production, this would return version history
    // For now, return current version
    const article = await this.getArticle(id);
    return article ? [article] : [];
  }

  /**
   * Get article version
   */
  async getVersion(
    id: string,
    version: number,
  ): Promise<KnowledgeArticle | null> {
    // In production, this would return specific version
    const article = await this.getArticle(id);
    return article && article.version === version ? article : null;
  }

  /**
   * Generate a URL-friendly slug
   */
  private generateSlug(title: string): string {
    const base = title
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
   * Generate excerpt from content
   */
  private generateExcerpt(content: string, maxLength = 200): string {
    // Strip HTML tags if present
    const text = content.replace(/<[^>]*>/g, '');
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength).trim() + '...';
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
    return `article_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all articles (for testing)
   */
  clear(): void {
    this.storage.articles.clear();
    this.storage.byCategory.clear();
    this.storage.byAuthor.clear();
    this.storage.byTag.clear();
    this.storage.byStatus.draft.clear();
    this.storage.byStatus.published.clear();
    this.storage.byStatus.archived.clear();
    this.storage.bySlug.clear();
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.articles.size;
  }
}

// Export singleton instance
export const knowledgeBase = new KnowledgeBase();
