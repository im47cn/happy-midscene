/**
 * Knowledge Portal Component
 *
 * Knowledge base browser with search and categories.
 */

import React, { useState, useEffect } from 'react';
import type {
  KnowledgeArticle,
  KnowledgeCategory,
  SearchResult,
} from '../../types/collaboration';

/**
 * Props for KnowledgePortal
 */
export interface KnowledgePortalProps {
  /** Current user ID */
  currentUserId: string;
  /** Callback when article is selected */
  onArticleSelect?: (article: KnowledgeArticle) => void;
  /** Callback when article is created */
  onArticleCreate?: (data: {
    title: string;
    content: string;
    categoryId?: string;
    tags: string[];
  }) => void;
}

/**
 * View mode for portal
 */
type ViewMode = 'browse' | 'search' | 'article' | 'create';

/**
 * Knowledge Portal Component
 */
export const KnowledgePortal: React.FC<KnowledgePortalProps> = ({
  currentUserId,
  onArticleSelect,
  onArticleCreate,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [popularArticles, setPopularArticles] = useState<KnowledgeArticle[]>([]);

  /**
   * New article form state
   */
  const [newArticle, setNewArticle] = useState({
    title: '',
    content: '',
    categoryId: '',
    tags: [] as string[],
    tagInput: '',
  });

  /**
   * Load initial data
   */
  useEffect(() => {
    loadCategories();
    loadPopularArticles();
  }, []);

  /**
   * Load articles when category changes
   */
  useEffect(() => {
    if (selectedCategory) {
      loadArticlesByCategory(selectedCategory);
    } else {
      loadAllArticles();
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    // In production, fetch from categoryManager
    // const data = await categoryManager.listCategories();
    // setCategories(data);
    setCategories([]);
  };

  const loadAllArticles = async () => {
    // In production, fetch from knowledgeBase
    // const data = await knowledgeBase.listArticles({ status: 'published' });
    // setArticles(data);
    setArticles([]);
  };

  const loadArticlesByCategory = async (categoryId: string) => {
    // In production, fetch from knowledgeBase
    // const data = await knowledgeBase.getByCategory(categoryId);
    // setArticles(data.filter(a => a.status === 'published'));
    setArticles([]);
  };

  const loadPopularArticles = async () => {
    // In production, fetch from knowledgeBase
    // const data = await knowledgeBase.getPopularArticles(10);
    // setPopularArticles(data);
    setPopularArticles([]);
  };

  /**
   * Handle search
   */
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // In production, use knowledgeSearch
      // const results = await knowledgeSearch.searchDetailed(searchQuery);
      // setSearchResults(results);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Handle article click
   */
  const handleArticleClick = (article: KnowledgeArticle) => {
    setSelectedArticle(article);
    if (onArticleSelect) {
      onArticleSelect(article);
    }
    setViewMode('article');

    // Record view
    // knowledgeBase.recordView(article.id);
  };

  /**
   * Handle article creation
   */
  const handleCreateArticle = () => {
    if (newArticle.title.trim() && newArticle.content.trim()) {
      if (onArticleCreate) {
        onArticleCreate({
          title: newArticle.title,
          content: newArticle.content,
          categoryId: newArticle.categoryId || undefined,
          tags: newArticle.tags,
        });
      }
      setNewArticle({
        title: '',
        content: '',
        categoryId: '',
        tags: [],
        tagInput: '',
      });
      setViewMode('browse');
    }
  };

  /**
   * Handle tag input
   */
  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newArticle.tagInput.trim()) {
      e.preventDefault();
      const tag = newArticle.tagInput.trim().toLowerCase();
      if (!newArticle.tags.includes(tag)) {
        setNewArticle({
          ...newArticle,
          tags: [...newArticle.tags, tag],
          tagInput: '',
        });
      }
    }
  };

  /**
   * Remove tag
   */
  const removeTag = (tag: string) => {
    setNewArticle({
      ...newArticle,
      tags: newArticle.tags.filter((t) => t !== tag),
    });
  };

  /**
   * Render category tree
   */
  const renderCategoryTree = (categories: KnowledgeCategory[], parentId?: string, level = 0) => {
    const filtered = categories.filter((c) => c.parentId === parentId);

    return filtered.map((category) => (
      <div key={category.id} className="category-node">
        <div
          className={`category-item ${
            selectedCategory === category.id ? 'selected' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => setSelectedCategory(category.id)}
        >
          <span className="category-icon">📁</span>
          <span className="category-name">{category.name}</span>
          <span className="category-count">({category.articleCount})</span>
        </div>
        {renderCategoryTree(categories, category.id, level + 1)}
      </div>
    ));
  };

  /**
   * Render browse view
   */
  const renderBrowseView = () => (
    <div className="knowledge-browse">
      {/* Categories sidebar */}
      <div className="categories-sidebar">
        <h4>Categories</h4>
        <div
          className={`category-item ${selectedCategory === null ? 'selected' : ''}`}
          onClick={() => setSelectedCategory(null)}
        >
          <span className="category-icon">📚</span>
          <span className="category-name">All Articles</span>
        </div>
        {renderCategoryTree(categories)}
      </div>

      {/* Articles list */}
      <div className="articles-list">
        <div className="articles-header">
          <h3>{selectedCategory ? 'Category Articles' : 'All Articles'}</h3>
        </div>
        {articles.length === 0 ? (
          <div className="empty-state">No articles found</div>
        ) : (
          <div className="article-cards">
            {articles.map((article) => (
              <div
                key={article.id}
                className="article-card"
                onClick={() => handleArticleClick(article)}
              >
                <h4>{article.title}</h4>
                <p className="article-excerpt">
                  {article.content.slice(0, 150)}...
                </p>
                <div className="article-meta">
                  <span>By {article.author}</span>
                  <span>{article.views} views</span>
                  <span>{article.upvotes} ↑</span>
                </div>
                <div className="article-tags">
                  {article.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Popular sidebar */}
      <div className="popular-sidebar">
        <h4>Popular Articles</h4>
        {popularArticles.map((article) => (
          <div
            key={article.id}
            className="popular-item"
            onClick={() => handleArticleClick(article)}
          >
            <div className="popular-title">{article.title}</div>
            <div className="popular-views">{article.views} views</div>
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Render search view
   */
  const renderSearchView = () => (
    <div className="knowledge-search">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search knowledge base..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="search-input"
        />
        <button className="btn-primary" onClick={handleSearch}>
          Search
        </button>
      </div>

      {isSearching ? (
        <div className="loading">Searching...</div>
      ) : searchResults.length > 0 ? (
        <div className="search-results">
          <h3>Results ({searchResults.length})</h3>
          {searchResults.map((result) => (
            <div key={result.id} className="search-result-item">
              <h4>{result.title}</h4>
              <p className="result-snippet">{result.snippet}</p>
              <div className="result-score">Relevance: {Math.round(result.score * 100)}%</div>
            </div>
          ))}
        </div>
      ) : searchQuery ? (
        <div className="empty-state">No results found for "{searchQuery}"</div>
      ) : null}
    </div>
  );

  /**
   * Render article view
   */
  const renderArticleView = () => {
    if (!selectedArticle) return null;

    return (
      <div className="article-view">
        <button
          className="btn-back"
          onClick={() => {
            setViewMode('browse');
            setSelectedArticle(null);
          }}
        >
          ← Back to articles
        </button>
        <article className="article-content">
          <h1>{selectedArticle.title}</h1>
          <div className="article-header">
            <span>By {selectedArticle.author}</span>
            <span>{new Date(selectedArticle.createdAt).toLocaleDateString()}</span>
            <span>{selectedArticle.views} views</span>
          </div>
          <div className="article-body">
            <pre>{selectedArticle.content}</pre>
          </div>
          <div className="article-footer">
            <div className="article-tags">
              {selectedArticle.tags.map((tag) => (
                <span key={tag} className="tag">
                  #{tag}
                </span>
              ))}
            </div>
            <div className="article-actions">
              <button className="btn-secondary">↑ Helpful</button>
              <button className="btn-secondary">↓ Not Helpful</button>
            </div>
          </div>
        </article>
      </div>
    );
  };

  /**
   * Render create form
   */
  const renderCreateForm = () => (
    <div className="article-create">
      <button
        className="btn-back"
        onClick={() => setViewMode('browse')}
      >
        ← Cancel
      </button>
      <h2>Create New Article</h2>
      <form onSubmit={(e) => { e.preventDefault(); handleCreateArticle(); }}>
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={newArticle.title}
            onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
            className="form-input"
            placeholder="Article title..."
            required
          />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select
            value={newArticle.categoryId}
            onChange={(e) => setNewArticle({ ...newArticle, categoryId: e.target.value })}
            className="form-select"
          >
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Tags</label>
          <div className="tag-input">
            {newArticle.tags.map((tag) => (
              <span key={tag} className="tag removable" onClick={() => removeTag(tag)}>
                #{tag} ×
              </span>
            ))}
            <input
              type="text"
              value={newArticle.tagInput}
              onChange={(e) => setNewArticle({ ...newArticle, tagInput: e.target.value })}
              onKeyDown={handleTagInputKeyDown}
              className="tag-input-field"
              placeholder="Add tag and press Enter..."
            />
          </div>
        </div>
        <div className="form-group">
          <label>Content</label>
          <textarea
            value={newArticle.content}
            onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
            className="form-textarea"
            rows={15}
            placeholder="Write your article content here..."
            required
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Create Article
          </button>
          <button type="button" className="btn-secondary" onClick={() => setViewMode('browse')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="knowledge-portal">
      <div className="portal-header">
        <h2>Knowledge Base</h2>
        <div className="portal-tabs">
          <button
            className={`tab ${viewMode === 'browse' ? 'active' : ''}`}
            onClick={() => setViewMode('browse')}
          >
            Browse
          </button>
          <button
            className={`tab ${viewMode === 'search' ? 'active' : ''}`}
            onClick={() => setViewMode('search')}
          >
            Search
          </button>
          <button
            className="tab tab-create"
            onClick={() => setViewMode('create')}
          >
            + New Article
          </button>
        </div>
      </div>

      <div className="portal-content">
        {viewMode === 'browse' && renderBrowseView()}
        {viewMode === 'search' && renderSearchView()}
        {viewMode === 'article' && renderArticleView()}
        {viewMode === 'create' && renderCreateForm()}
      </div>
    </div>
  );
};

export default KnowledgePortal;
