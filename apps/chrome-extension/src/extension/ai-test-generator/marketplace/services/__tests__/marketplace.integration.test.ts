/**
 * Marketplace Integration Tests
 * Tests the integration between marketplace services
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { marketplaceAPI } from '../marketplaceAPI';
import { templateStorage } from '../templateStorage';
import { templateApplier } from '../templateApplier';
import { templateAuditor } from '../templateAuditor';
import { ratingSystem } from '../ratingSystem';
import { offlineManager } from '../offlineManager';
import type { Template, TemplateDraft } from '../../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Marketplace Integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Template Discovery Flow', () => {
    it('should fetch categories and templates', async () => {
      const categories = await marketplaceAPI.getCategories();
      expect(categories).toBeInstanceOf(Array);
      expect(categories.length).toBeGreaterThan(0);

      const templates = await marketplaceAPI.getTemplates({ limit: 5 });
      expect(templates.templates).toBeInstanceOf(Array);
    });

    it('should search templates by keyword', async () => {
      const result = await marketplaceAPI.searchTemplates({
        keyword: 'login',
        limit: 10,
      });

      expect(result.templates).toBeInstanceOf(Array);
    });

    it('should filter templates by category', async () => {
      const result = await marketplaceAPI.getTemplates({
        category: 'authentication',
        limit: 10,
      });

      expect(result.templates).toBeInstanceOf(Array);
      result.templates.forEach(template => {
        expect(template.category).toBe('authentication');
      });
    });

    it('should get featured templates', async () => {
      const featured = await marketplaceAPI.getFeatured();
      expect(featured).toBeInstanceOf(Array);
    });

    it('should get popular templates', async () => {
      const popular = await marketplaceAPI.getPopular();
      expect(popular).toBeInstanceOf(Array);
    });
  });

  describe('Template Usage Flow', () => {
    it('should download, save, and apply template', async () => {
      // Get a template
      const templates = await marketplaceAPI.getTemplates({ limit: 1 });
      expect(templates.templates.length).toBeGreaterThan(0);

      const templateId = templates.templates[0].id;
      const template = await marketplaceAPI.getTemplate(templateId);

      // Save to local storage
      await templateStorage.saveTemplate(template);
      const downloaded = await templateStorage.getDownloadedTemplates();
      expect(downloaded.some(t => t.id === templateId)).toBe(true);

      // Apply with parameters
      const params = templateApplier.getDefaultParams(template.content.parameters);
      const yaml = templateApplier.apply(template, params);
      expect(yaml).toBeTruthy();
      expect(typeof yaml).toBe('string');

      // Record usage
      await templateStorage.recordUsage(templateId, params, yaml);
      const history = await templateStorage.getUsageHistory(10);
      expect(history.some(h => h.templateId === templateId)).toBe(true);
    });

    it('should handle favorite templates', async () => {
      const templates = await marketplaceAPI.getTemplates({ limit: 1 });
      const templateId = templates.templates[0].id;
      const template = await marketplaceAPI.getTemplate(templateId);

      // Save and favorite
      await templateStorage.saveTemplate(template);
      await templateStorage.setFavorite(templateId, true);

      const favorites = await templateStorage.getFavoriteTemplates();
      expect(favorites.some(f => f.id === templateId)).toBe(true);

      // Unfavorite
      await templateStorage.setFavorite(templateId, false);
      const updatedFavorites = await templateStorage.getFavoriteTemplates();
      expect(updatedFavorites.some(f => f.id === templateId)).toBe(false);
    });
  });

  describe('Template Publishing Flow', () => {
    it('should validate template before publishing', async () => {
      const validDraft: TemplateDraft = {
        name: 'Test Template',
        description: 'A test template for integration testing purposes',
        shortDescription: 'Test template for testing',
        category: 'utility',
        tags: ['test', 'example'],
        platforms: ['web'],
        language: 'en',
        content: {
          yaml: `target:
  url: "\${targetUrl}"
flow:
  - ai: "Navigate to the target page"`,
          parameters: [
            {
              name: 'targetUrl',
              label: 'Target URL',
              type: 'url',
              required: true,
              description: 'The URL to navigate to',
            },
          ],
        },
        license: 'MIT',
        version: '1.0.0',
      };

      const result = await templateAuditor.audit(validDraft);
      expect(result.passed).toBe(true);
    });

    it('should reject template with sensitive data', async () => {
      const invalidDraft: TemplateDraft = {
        name: 'Invalid Template',
        description: 'Template with hardcoded password',
        shortDescription: 'Invalid template',
        category: 'authentication',
        tags: ['test'],
        platforms: ['web'],
        language: 'en',
        content: {
          yaml: `target:
  url: "https://example.com"
  password: "secret123"
flow:
  - ai: "Login with credentials"`,
          parameters: [],
        },
        license: 'MIT',
        version: '1.0.0',
      };

      const result = await templateAuditor.audit(invalidDraft);
      expect(result.passed).toBe(false);
      expect(result.reasons.some(r => r.includes('Sensitive'))).toBe(true);
    });

    it('should reject template with malicious code', async () => {
      const maliciousDraft: TemplateDraft = {
        name: 'Malicious Template',
        description: 'Template with eval',
        shortDescription: 'Malicious template',
        category: 'utility',
        tags: ['test'],
        platforms: ['web'],
        language: 'en',
        content: {
          yaml: `target:
  url: "javascript:eval('alert(1)')"
flow:
  - ai: "Execute script"`,
          parameters: [],
        },
        license: 'MIT',
        version: '1.0.0',
      };

      const result = await templateAuditor.audit(maliciousDraft);
      expect(result.passed).toBe(false);
      expect(result.reasons.some(r => r.includes('malicious'))).toBe(true);
    });
  });

  describe('Rating System Flow', () => {
    it('should have submitReview method', () => {
      expect(typeof ratingSystem.submitReview).toBe('function');
    });

    it('should have getReviewStats method', () => {
      expect(typeof ratingSystem.getReviewStats).toBe('function');
    });

    it('should have getUserReview method', () => {
      expect(typeof ratingSystem.getUserReview).toBe('function');
    });

    it('should have getTemplateReviews method', () => {
      expect(typeof ratingSystem.getTemplateReviews).toBe('function');
    });

    it('should have voteHelpful method', () => {
      expect(typeof ratingSystem.voteHelpful).toBe('function');
    });

    it('should have clearAll method', () => {
      expect(typeof ratingSystem.clearAll).toBe('function');
    });
  });

  describe('Offline Support Flow', () => {
    it('should cache templates for offline use', () => {
      const mockTemplate: Template = {
        id: 'offline-test-1',
        name: 'Offline Test Template',
        slug: 'offline-test',
        description: 'Template for offline testing',
        shortDescription: 'Offline test',
        category: 'utility',
        tags: ['test'],
        platforms: ['web'],
        language: 'en',
        content: {
          yaml: 'target:\n  url: "${url}"',
          parameters: [],
        },
        media: {},
        version: '1.0.0',
        license: 'MIT',
        publisher: {
          id: 'test-publisher',
          name: 'Test Publisher',
          verified: false,
        },
        stats: {
          downloads: 0,
          favorites: 0,
          rating: 0,
          ratingCount: 0,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        publishedAt: Date.now(),
        featured: false,
      };

      // Cache template
      offlineManager.cacheTemplate(mockTemplate);

      // Retrieve from cache
      const cached = offlineManager.getCachedTemplate('offline-test-1');
      expect(cached).not.toBeNull();
      expect(cached?.id).toBe('offline-test-1');
      expect(cached?.name).toBe('Offline Test Template');
    });

    it('should return cache statistics', () => {
      const stats = offlineManager.getCacheStats();

      expect(stats).toHaveProperty('templateCount');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('pendingSyncItems');
    });

    it('should clear cache', () => {
      const mockTemplate: Template = {
        id: 'clear-test-1',
        name: 'Clear Test Template',
        slug: 'clear-test',
        description: 'Template for clear testing',
        shortDescription: 'Clear test',
        category: 'utility',
        tags: [],
        platforms: ['web'],
        language: 'en',
        content: {
          yaml: 'test: true',
          parameters: [],
        },
        media: {},
        version: '1.0.0',
        license: 'MIT',
        publisher: {
          id: 'test',
          name: 'Test',
          verified: false,
        },
        stats: {
          downloads: 0,
          favorites: 0,
          rating: 0,
          ratingCount: 0,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        publishedAt: Date.now(),
        featured: false,
      };

      offlineManager.cacheTemplate(mockTemplate);
      offlineManager.clearCache();

      const cached = offlineManager.getCachedTemplate('clear-test-1');
      expect(cached).toBeNull();
    });
  });

  describe('Parameter Validation Flow', () => {
    it('should validate required parameters', () => {
      const parameters = [
        { name: 'url', label: 'URL', type: 'url' as const, required: true },
        { name: 'username', label: 'Username', type: 'string' as const, required: true },
        { name: 'optional', label: 'Optional', type: 'string' as const, required: false },
      ];

      // Missing required parameter
      const invalidResult = templateApplier.validateParams(parameters, {
        url: 'https://example.com',
        // missing username
      });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.username).toBeTruthy();

      // All required parameters present
      const validResult = templateApplier.validateParams(parameters, {
        url: 'https://example.com',
        username: 'testuser',
      });
      expect(validResult.valid).toBe(true);
    });

    it('should validate URL format', () => {
      const parameters = [
        { name: 'website', label: 'Website', type: 'url' as const, required: true },
      ];

      const invalidResult = templateApplier.validateParams(parameters, {
        website: 'not-a-url',
      });
      expect(invalidResult.valid).toBe(false);

      const validResult = templateApplier.validateParams(parameters, {
        website: 'https://example.com',
      });
      expect(validResult.valid).toBe(true);
    });

    it('should validate email is provided when required', () => {
      const parameters = [
        { name: 'email', label: 'Email', type: 'email' as const, required: true },
      ];

      // Missing email should fail
      const invalidResult = templateApplier.validateParams(parameters, {});
      expect(invalidResult.valid).toBe(false);

      // Provided email should pass
      const validResult = templateApplier.validateParams(parameters, {
        email: 'test@example.com',
      });
      expect(validResult.valid).toBe(true);
    });
  });
});
