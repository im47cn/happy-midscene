/**
 * Marketplace API Service
 * Provides API access to the template marketplace using GitHub as backend
 */

import Fuse from 'fuse.js';
import type {
  CategoryInfo,
  IMarketplaceAPI,
  MarketplaceConfig,
  Publisher,
  SearchQuery,
  SearchResult,
  Template,
  TemplateCategory,
  TemplateReview,
  TemplateSummary,
  TemplateVersion,
} from '../types';
import { DEFAULT_MARKETPLACE_CONFIG } from '../types';

/**
 * Template index structure from GitHub
 */
interface TemplateIndex {
  version: string;
  updatedAt: number;
  templates: TemplateSummary[];
  categories: CategoryInfo[];
}

/**
 * Cache entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * GitHub-based Marketplace API implementation
 */
export class GitHubMarketplaceAPI implements IMarketplaceAPI {
  private config: MarketplaceConfig;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private indexCache: TemplateIndex | null = null;
  private indexCacheTime = 0;
  private fuse: Fuse<TemplateSummary> | null = null;

  constructor(config?: Partial<MarketplaceConfig>) {
    this.config = { ...DEFAULT_MARKETPLACE_CONFIG, ...config };
  }

  /**
   * Get cached data or fetch fresh
   */
  private async getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (!this.config.cacheEnabled) {
      return fetcher();
    }

    const cached = this.cache.get(key) as CacheEntry<T> | undefined;
    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Fetch JSON from GitHub
   */
  private async fetchJson<T>(path: string): Promise<T> {
    const url = `${this.config.baseUrl}/${path}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Fetch text from GitHub
   */
  private async fetchText(path: string): Promise<string> {
    const url = `${this.config.baseUrl}/${path}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
    }
    return response.text();
  }

  /**
   * Get template index
   */
  private async getIndex(): Promise<TemplateIndex> {
    if (this.indexCache && Date.now() - this.indexCacheTime < this.config.cacheTTL) {
      return this.indexCache;
    }

    try {
      this.indexCache = await this.fetchJson<TemplateIndex>('index.json');
      this.indexCacheTime = Date.now();
      this.initFuse(this.indexCache.templates);
      return this.indexCache;
    } catch {
      // Return mock data for development/offline mode
      return this.getMockIndex();
    }
  }

  /**
   * Initialize Fuse.js for client-side search
   */
  private initFuse(templates: TemplateSummary[]): void {
    this.fuse = new Fuse(templates, {
      keys: [
        { name: 'name', weight: 2 },
        { name: 'shortDescription', weight: 1.5 },
        { name: 'category', weight: 1 },
        { name: 'publisher.name', weight: 0.5 },
      ],
      threshold: 0.4,
      includeScore: true,
    });
  }

  /**
   * Get mock index for development
   */
  private getMockIndex(): TemplateIndex {
    const mockTemplates: TemplateSummary[] = [
      {
        id: 'login-basic',
        name: 'Basic Login',
        slug: 'login-basic',
        shortDescription: 'Universal login template supporting username/password authentication',
        category: 'authentication',
        platforms: ['web'],
        thumbnail: undefined,
        version: '1.0.0',
        publisher: { id: 'official', name: 'Midscene Official', verified: true },
        stats: { downloads: 1234, favorites: 89, rating: 4.8, ratingCount: 45 },
        featured: true,
        publishedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'product-search',
        name: 'Product Search',
        slug: 'product-search',
        shortDescription: 'E-commerce product search with filters and sorting',
        category: 'search',
        platforms: ['web', 'android'],
        thumbnail: undefined,
        version: '2.1.0',
        publisher: { id: 'official', name: 'Midscene Official', verified: true },
        stats: { downloads: 890, favorites: 56, rating: 4.6, ratingCount: 32 },
        featured: true,
        publishedAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'shopping-cart',
        name: 'Shopping Cart',
        slug: 'shopping-cart',
        shortDescription: 'Add to cart, update quantity, and checkout flow',
        category: 'shopping',
        platforms: ['web', 'android', 'ios'],
        thumbnail: undefined,
        version: '1.5.0',
        publisher: { id: 'official', name: 'Midscene Official', verified: true },
        stats: { downloads: 2100, favorites: 120, rating: 4.9, ratingCount: 78 },
        featured: true,
        publishedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'form-validation',
        name: 'Form Validation',
        slug: 'form-validation',
        shortDescription: 'Comprehensive form validation with error handling',
        category: 'form',
        platforms: ['web'],
        thumbnail: undefined,
        version: '1.2.0',
        publisher: { id: 'community-1', name: 'TestMaster', verified: false },
        stats: { downloads: 650, favorites: 34, rating: 4.5, ratingCount: 22 },
        featured: false,
        publishedAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'payment-checkout',
        name: 'Payment Checkout',
        slug: 'payment-checkout',
        shortDescription: 'Complete payment flow with card input validation',
        category: 'payment',
        platforms: ['web'],
        thumbnail: undefined,
        version: '1.0.0',
        publisher: { id: 'official', name: 'Midscene Official', verified: true },
        stats: { downloads: 456, favorites: 28, rating: 4.7, ratingCount: 15 },
        featured: false,
        publishedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'user-registration',
        name: 'User Registration',
        slug: 'user-registration',
        shortDescription: 'User signup with email verification flow',
        category: 'authentication',
        platforms: ['web', 'android'],
        thumbnail: undefined,
        version: '1.1.0',
        publisher: { id: 'community-2', name: 'AutoTester', verified: false },
        stats: { downloads: 345, favorites: 18, rating: 4.3, ratingCount: 12 },
        featured: false,
        publishedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
      },
    ];

    const categories: CategoryInfo[] = [
      { id: 'authentication', name: 'Authentication', description: 'Login/Logout flows', icon: 'lock', count: 2 },
      { id: 'form', name: 'Form', description: 'Form submissions', icon: 'form', count: 1 },
      { id: 'search', name: 'Search', description: 'Search functionality', icon: 'search', count: 1 },
      { id: 'shopping', name: 'Shopping', description: 'E-commerce flows', icon: 'shopping-cart', count: 1 },
      { id: 'payment', name: 'Payment', description: 'Payment processing', icon: 'credit-card', count: 1 },
    ];

    this.initFuse(mockTemplates);

    return {
      version: '1.0.0',
      updatedAt: Date.now(),
      templates: mockTemplates,
      categories,
    };
  }

  /**
   * Get templates with optional filtering
   */
  async getTemplates(options?: SearchQuery): Promise<SearchResult> {
    const index = await this.getIndex();
    let templates = [...index.templates];

    // Apply filters
    if (options?.category) {
      templates = templates.filter((t) => t.category === options.category);
    }
    if (options?.platforms?.length) {
      templates = templates.filter((t) =>
        options.platforms!.some((p) => t.platforms.includes(p))
      );
    }
    if (options?.rating) {
      templates = templates.filter((t) => t.stats.rating >= options.rating!);
    }
    if (options?.featured !== undefined) {
      templates = templates.filter((t) => t.featured === options.featured);
    }

    // Apply sorting
    const sortBy = options?.sortBy || 'downloads';
    const sortOrder = options?.sortOrder || 'desc';
    templates.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'downloads':
          comparison = a.stats.downloads - b.stats.downloads;
          break;
        case 'rating':
          comparison = a.stats.rating - b.stats.rating;
          break;
        case 'publishedAt':
          comparison = a.publishedAt - b.publishedAt;
          break;
        default:
          comparison = a.stats.downloads - b.stats.downloads;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const page = options?.page || 0;
    const limit = options?.limit || this.config.pageSize;
    const start = page * limit;
    const paginatedTemplates = templates.slice(start, start + limit);

    return {
      templates: paginatedTemplates,
      total: templates.length,
      page,
      limit,
      hasMore: start + limit < templates.length,
    };
  }

  /**
   * Search templates
   */
  async searchTemplates(query: SearchQuery): Promise<SearchResult> {
    const index = await this.getIndex();

    if (!query.keyword || !this.fuse) {
      return this.getTemplates(query);
    }

    // Use Fuse.js for fuzzy search
    const searchResults = this.fuse.search(query.keyword);
    let templates = searchResults.map((r) => r.item);

    // Apply additional filters
    if (query.category) {
      templates = templates.filter((t) => t.category === query.category);
    }
    if (query.platforms?.length) {
      templates = templates.filter((t) =>
        query.platforms!.some((p) => t.platforms.includes(p))
      );
    }
    if (query.rating) {
      templates = templates.filter((t) => t.stats.rating >= query.rating!);
    }

    // Apply pagination
    const page = query.page || 0;
    const limit = query.limit || this.config.pageSize;
    const start = page * limit;
    const paginatedTemplates = templates.slice(start, start + limit);

    return {
      templates: paginatedTemplates,
      total: templates.length,
      page,
      limit,
      hasMore: start + limit < templates.length,
    };
  }

  /**
   * Get template details
   */
  async getTemplate(id: string): Promise<Template> {
    return this.getCached(`template:${id}`, async () => {
      try {
        const metadata = await this.fetchJson<Omit<Template, 'content'>>(`templates/${id}/metadata.json`);
        const yaml = await this.fetchText(`templates/${id}/template.yaml`);

        let readme: string | undefined;
        try {
          readme = await this.fetchText(`templates/${id}/readme.md`);
        } catch {
          // README is optional
        }

        return {
          ...metadata,
          content: {
            yaml,
            parameters: metadata.content?.parameters || [],
            readme,
          },
        } as Template;
      } catch {
        // Return mock template for development
        return this.getMockTemplate(id);
      }
    });
  }

  /**
   * Get mock template for development
   */
  private getMockTemplate(id: string): Template {
    const mockYaml = `target:
  url: "\${loginUrl}"
flow:
  - ai: "Enter username \${username} into the username field"
  - ai: "Enter password \${password} into the password field"
  - ai: "Click the login button"
  - sleep: 2000
  - aiAssert: "Should see welcome message or dashboard"
`;

    return {
      id,
      name: 'Basic Login',
      slug: id,
      description: '# Basic Login Template\n\nA universal login template that works with most web applications.\n\n## Features\n\n- Username/password authentication\n- Remember me option\n- Error handling\n\n## Usage\n\nConfigure the login URL and credentials, then run the test.',
      shortDescription: 'Universal login template supporting username/password authentication',
      category: 'authentication',
      tags: ['login', 'authentication', 'basic'],
      platforms: ['web'],
      language: 'en',
      content: {
        yaml: mockYaml,
        parameters: [
          {
            name: 'loginUrl',
            label: 'Login Page URL',
            type: 'url',
            required: true,
            placeholder: 'https://example.com/login',
            description: 'The URL of the login page',
          },
          {
            name: 'username',
            label: 'Username',
            type: 'string',
            required: true,
            placeholder: 'test@example.com',
            description: 'Username or email for login',
          },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            required: true,
            placeholder: 'Enter password',
            description: 'Password for login',
          },
        ],
        readme: '# Basic Login Template\n\nThis template provides a reusable login flow.',
      },
      media: {},
      version: '1.0.0',
      license: 'MIT',
      minMidsceneVersion: '0.13.0',
      publisher: {
        id: 'official',
        name: 'Midscene Official',
        verified: true,
        bio: 'Official templates from the Midscene team',
      },
      stats: {
        downloads: 1234,
        favorites: 89,
        rating: 4.8,
        ratingCount: 45,
      },
      createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      publishedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      featured: true,
      verified: true,
    };
  }

  /**
   * Get template versions
   */
  async getTemplateVersions(id: string): Promise<TemplateVersion[]> {
    return this.getCached(`versions:${id}`, async () => {
      try {
        return await this.fetchJson<TemplateVersion[]>(`templates/${id}/versions.json`);
      } catch {
        // Return mock versions
        return [
          {
            id: `${id}-v1.0.0`,
            templateId: id,
            version: '1.0.0',
            changelog: 'Initial release',
            content: { yaml: '', parameters: [] },
            createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
            publishedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          },
        ];
      }
    });
  }

  /**
   * Get template reviews
   */
  async getTemplateReviews(id: string, page = 0, limit = 10): Promise<TemplateReview[]> {
    return this.getCached(`reviews:${id}:${page}:${limit}`, async () => {
      try {
        const allReviews = await this.fetchJson<TemplateReview[]>(`templates/${id}/reviews.json`);
        return allReviews.slice(page * limit, (page + 1) * limit);
      } catch {
        // Return mock reviews
        return [
          {
            id: 'review-1',
            templateId: id,
            userId: 'user-1',
            userName: 'TestUser',
            rating: 5,
            comment: 'Great template! Saved me a lot of time.',
            helpful: 12,
            notHelpful: 1,
            createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
          },
          {
            id: 'review-2',
            templateId: id,
            userId: 'user-2',
            userName: 'Developer',
            rating: 4,
            comment: 'Good template, but documentation could be improved.',
            helpful: 8,
            notHelpful: 2,
            createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
          },
        ];
      }
    });
  }

  /**
   * Get publisher information
   */
  async getPublisher(id: string): Promise<Publisher> {
    return this.getCached(`publisher:${id}`, async () => {
      try {
        return await this.fetchJson<Publisher>(`publishers/${id}/profile.json`);
      } catch {
        return {
          id,
          name: id === 'official' ? 'Midscene Official' : 'Community Contributor',
          verified: id === 'official',
          bio: id === 'official' ? 'Official templates from the Midscene team' : 'Community contributor',
          templateCount: 5,
        };
      }
    });
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<CategoryInfo[]> {
    const index = await this.getIndex();
    return index.categories;
  }

  /**
   * Get featured templates
   */
  async getFeatured(): Promise<TemplateSummary[]> {
    const result = await this.getTemplates({ featured: true, limit: 10 });
    return result.templates;
  }

  /**
   * Get popular templates
   */
  async getPopular(category?: TemplateCategory, limit = 20): Promise<TemplateSummary[]> {
    const result = await this.getTemplates({
      category,
      sortBy: 'downloads',
      limit,
    });
    return result.templates;
  }

  /**
   * Get latest templates
   */
  async getLatest(limit = 20): Promise<TemplateSummary[]> {
    const result = await this.getTemplates({
      sortBy: 'publishedAt',
      limit,
    });
    return result.templates;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.indexCache = null;
    this.indexCacheTime = 0;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<MarketplaceConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance
export const marketplaceAPI = new GitHubMarketplaceAPI();
