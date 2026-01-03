/**
 * Template Marketplace Types
 * Type definitions for the template marketplace feature
 */

/**
 * Template categories
 */
export type TemplateCategory =
  | 'authentication' // Login/Auth
  | 'form' // Form operations
  | 'search' // Search functionality
  | 'shopping' // Shopping cart/orders
  | 'payment' // Payment flows
  | 'navigation' // Navigation/menus
  | 'data-entry' // Data input
  | 'crud' // CRUD operations
  | 'social' // Social features
  | 'media' // Media handling
  | 'utility'; // Utility

/**
 * License types
 */
export type LicenseType = 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'BSD-3-Clause' | 'CC-BY-4.0' | 'Proprietary';

/**
 * Platform types
 */
export type PlatformType = 'web' | 'android' | 'ios';

/**
 * Parameter types for template configuration
 */
export type ParameterType = 'string' | 'number' | 'boolean' | 'select' | 'url' | 'password';

/**
 * Parameter definition for template configuration
 */
export interface ParameterDef {
  name: string;
  label: string;
  type: ParameterType;
  required: boolean;
  default?: string | number | boolean;
  options?: { label: string; value: string | number | boolean }[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
  description?: string;
  placeholder?: string;
}

/**
 * Template content
 */
export interface TemplateContent {
  yaml: string;
  parameters: ParameterDef[];
  readme?: string;
}

/**
 * Template media assets
 */
export interface TemplateMedia {
  thumbnail?: string;
  preview?: string;
  screenshots?: string[];
}

/**
 * Publisher information
 */
export interface Publisher {
  id: string;
  name: string;
  avatar?: string;
  verified: boolean;
  bio?: string;
  website?: string;
  templateCount?: number;
}

/**
 * Template statistics
 */
export interface TemplateStats {
  downloads: number;
  favorites: number;
  rating: number;
  ratingCount: number;
}

/**
 * Template version
 */
export interface TemplateVersion {
  id: string;
  templateId: string;
  version: string;
  changelog: string;
  content: TemplateContent;
  createdAt: number;
  publishedAt: number;
}

/**
 * Template review
 */
export interface TemplateReview {
  id: string;
  templateId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  helpful: number;
  notHelpful: number;
  createdAt: number;
  updatedAt?: number;
}

/**
 * Template definition
 */
export interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;

  // Classification
  category: TemplateCategory;
  tags: string[];
  platforms: PlatformType[];
  language: string;

  // Content
  content: TemplateContent;

  // Media
  media: TemplateMedia;

  // Metadata
  version: string;
  license: LicenseType;
  minMidsceneVersion?: string;

  // Publisher
  publisher: Publisher;

  // Statistics
  stats: TemplateStats;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  publishedAt: number;

  // Flags
  featured?: boolean;
  verified?: boolean;
}

/**
 * Template summary (for list view)
 */
export interface TemplateSummary {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  category: TemplateCategory;
  platforms: PlatformType[];
  thumbnail?: string;
  version: string;
  publisher: Pick<Publisher, 'id' | 'name' | 'verified'>;
  stats: TemplateStats;
  featured?: boolean;
  publishedAt: number;
}

/**
 * Search query options
 */
export interface SearchQuery {
  keyword?: string;
  category?: TemplateCategory;
  platforms?: PlatformType[];
  language?: string;
  rating?: number;
  license?: LicenseType;
  sortBy?: 'relevance' | 'downloads' | 'rating' | 'publishedAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  featured?: boolean;
}

/**
 * Search result
 */
export interface SearchResult {
  templates: TemplateSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Template draft for publishing
 */
export interface TemplateDraft {
  name: string;
  description: string;
  shortDescription: string;
  category: TemplateCategory;
  tags: string[];
  platforms: PlatformType[];
  language: string;
  content: TemplateContent;
  media?: {
    thumbnail?: File | string;
    preview?: File | string;
    screenshots?: (File | string)[];
  };
  license: LicenseType;
  version: string;
  changelog?: string;
}

/**
 * Audit result for template publishing
 */
export interface AuditResult {
  passed: boolean;
  reasons: string[];
  warnings?: string[];
  suggestions?: string[];
}

/**
 * Local template storage entry
 */
export interface LocalTemplate {
  id: string;
  template: Template;
  downloadedAt: number;
  lastUsedAt?: number;
  usageCount: number;
  isFavorite: boolean;
  customParameters?: Record<string, unknown>;
}

/**
 * Template usage history
 */
export interface TemplateUsageHistory {
  id: string;
  templateId: string;
  templateName: string;
  parameters: Record<string, unknown>;
  usedAt: number;
  generatedYaml: string;
}

/**
 * Category information
 */
export interface CategoryInfo {
  id: TemplateCategory;
  name: string;
  description: string;
  icon: string;
  count: number;
}

/**
 * Marketplace configuration
 */
export interface MarketplaceConfig {
  baseUrl: string;
  cacheEnabled: boolean;
  cacheTTL: number;
  pageSize: number;
  offlineMode: boolean;
}

/**
 * Default marketplace configuration
 */
export const DEFAULT_MARKETPLACE_CONFIG: MarketplaceConfig = {
  baseUrl: 'https://raw.githubusercontent.com/midscene/templates/main',
  cacheEnabled: true,
  cacheTTL: 15 * 60 * 1000, // 15 minutes
  pageSize: 20,
  offlineMode: false,
};

/**
 * Category metadata
 */
export const CATEGORY_METADATA: Record<TemplateCategory, { name: string; description: string; icon: string }> = {
  authentication: { name: 'Authentication', description: 'Login/Logout flows', icon: 'lock' },
  form: { name: 'Form', description: 'Form submissions', icon: 'form' },
  search: { name: 'Search', description: 'Search functionality', icon: 'search' },
  shopping: { name: 'Shopping', description: 'E-commerce flows', icon: 'shopping-cart' },
  payment: { name: 'Payment', description: 'Payment processing', icon: 'credit-card' },
  navigation: { name: 'Navigation', description: 'Menu and navigation', icon: 'menu' },
  'data-entry': { name: 'Data Entry', description: 'Data input forms', icon: 'edit' },
  crud: { name: 'CRUD', description: 'Create/Read/Update/Delete', icon: 'database' },
  social: { name: 'Social', description: 'Social interactions', icon: 'team' },
  media: { name: 'Media', description: 'Media handling', icon: 'picture' },
  utility: { name: 'Utility', description: 'Utility operations', icon: 'tool' },
};

/**
 * Interface for marketplace API
 */
export interface IMarketplaceAPI {
  getTemplates(options?: SearchQuery): Promise<SearchResult>;
  searchTemplates(query: SearchQuery): Promise<SearchResult>;
  getTemplate(id: string): Promise<Template>;
  getTemplateVersions(id: string): Promise<TemplateVersion[]>;
  getTemplateReviews(id: string, page?: number, limit?: number): Promise<TemplateReview[]>;
  getPublisher(id: string): Promise<Publisher>;
  getCategories(): Promise<CategoryInfo[]>;
  getFeatured(): Promise<TemplateSummary[]>;
  getPopular(category?: TemplateCategory, limit?: number): Promise<TemplateSummary[]>;
  getLatest(limit?: number): Promise<TemplateSummary[]>;
}

/**
 * Interface for template storage
 */
export interface ITemplateStorage {
  saveTemplate(template: Template): Promise<void>;
  getTemplate(id: string): Promise<LocalTemplate | null>;
  getDownloadedTemplates(): Promise<LocalTemplate[]>;
  getFavoriteTemplates(): Promise<LocalTemplate[]>;
  setFavorite(id: string, isFavorite: boolean): Promise<void>;
  recordUsage(id: string, parameters: Record<string, unknown>, generatedYaml: string): Promise<void>;
  getUsageHistory(limit?: number): Promise<TemplateUsageHistory[]>;
  deleteTemplate(id: string): Promise<void>;
  clearCache(): Promise<void>;
}

/**
 * Interface for template applier
 */
export interface ITemplateApplier {
  apply(template: Template, params: Record<string, unknown>): string;
  validateParams(parameters: ParameterDef[], values: Record<string, unknown>): { valid: boolean; errors: Record<string, string> };
  getDefaultParams(parameters: ParameterDef[]): Record<string, unknown>;
  previewYaml(template: Template, params: Record<string, unknown>): string;
}

/**
 * Interface for template auditor
 */
export interface ITemplateAuditor {
  audit(draft: TemplateDraft): Promise<AuditResult>;
  detectSensitiveInfo(content: string): { found: boolean; matches: string[] };
  detectMaliciousCode(content: string): { found: boolean; matches: string[] };
  validateYaml(yaml: string): { valid: boolean; errors: string[] };
}

/**
 * Interface for rating system
 */
export interface IRatingSystem {
  submitReview(review: Omit<TemplateReview, 'id' | 'createdAt' | 'helpful' | 'notHelpful'>): Promise<TemplateReview>;
  voteHelpful(reviewId: string, helpful: boolean): Promise<void>;
  getUserReview(templateId: string, userId: string): Promise<TemplateReview | null>;
  getReviewStats(templateId: string): Promise<{ average: number; count: number; distribution: Record<number, number> }>;
}
