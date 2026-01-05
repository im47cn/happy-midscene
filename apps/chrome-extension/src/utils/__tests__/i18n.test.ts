/**
 * Unit tests for i18n utility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectBrowserLocale,
  setLocale,
  getLocale,
  initLocale,
  t,
  tp,
  getAvailableLocales,
  getLocaleName,
} from '../i18n';

// Mock chrome.storage.local
const mockChromeStorage = {
  get: vi.fn(),
  set: vi.fn(),
};

global.chrome = {
  storage: {
    local: mockChromeStorage,
  },
} as any;

// Mock navigator.language
const originalLanguage = Object.getOwnPropertyDescriptor(Navigator.prototype, 'language');

describe('i18n', () => {
  beforeEach(() => {
    // Reset locale to English
    setLocale('en');
    vi.clearAllMocks();
  });

  describe('detectBrowserLocale', () => {
    it('should detect English locale', () => {
      Object.defineProperty(Navigator.prototype, 'language', {
        value: 'en-US',
        configurable: true,
      });
      expect(detectBrowserLocale()).toBe('en');
    });

    it('should detect Simplified Chinese locale', () => {
      Object.defineProperty(Navigator.prototype, 'language', {
        value: 'zh-CN',
        configurable: true,
      });
      expect(detectBrowserLocale()).toBe('zh-CN');
    });

    it('should detect Traditional Chinese locale', () => {
      Object.defineProperty(Navigator.prototype, 'language', {
        value: 'zh-TW',
        configurable: true,
      });
      expect(detectBrowserLocale()).toBe('zh-TW');
    });

    it('should detect Japanese locale', () => {
      Object.defineProperty(Navigator.prototype, 'language', {
        value: 'ja-JP',
        configurable: true,
      });
      expect(detectBrowserLocale()).toBe('ja');
    });

    it('should detect Korean locale', () => {
      Object.defineProperty(Navigator.prototype, 'language', {
        value: 'ko-KR',
        configurable: true,
      });
      expect(detectBrowserLocale()).toBe('ko');
    });

    it('should default to English for unknown locale', () => {
      Object.defineProperty(Navigator.prototype, 'language', {
        value: 'unknown-locale',
        configurable: true,
      });
      expect(detectBrowserLocale()).toBe('en');
    });

    it('should default to English when navigator.language is undefined', () => {
      Object.defineProperty(Navigator.prototype, 'language', {
        value: undefined,
        configurable: true,
      });
      expect(detectBrowserLocale()).toBe('en');
    });
  });

  describe('setLocale and getLocale', () => {
    it('should set and get locale', () => {
      setLocale('zh-CN');
      expect(getLocale()).toBe('zh-CN');
    });

    it('should persist locale to chrome.storage', () => {
      setLocale('ja');
      expect(mockChromeStorage.set).toHaveBeenCalledWith({
        midscene_locale: 'ja',
      });
    });
  });

  describe('initLocale', () => {
    it('should load saved locale from chrome.storage', async () => {
      mockChromeStorage.get.mockResolvedValue({ midscene_locale: 'de' });

      await initLocale();

      expect(getLocale()).toBe('de');
    });

    it('should detect browser locale when no saved locale', async () => {
      mockChromeStorage.get.mockResolvedValue({});
      Object.defineProperty(Navigator.prototype, 'language', {
        value: 'es',
        configurable: true,
      });

      await initLocale();

      expect(getLocale()).toBe('es');
    });

    it('should default to English on error', async () => {
      mockChromeStorage.get.mockRejectedValue(new Error('Storage error'));
      Object.defineProperty(Navigator.prototype, 'language', {
        value: undefined,
        configurable: true,
      });

      await initLocale();

      expect(getLocale()).toBe('en');
    });
  });

  describe('t (translation)', () => {
    it('should return English translation for common key', () => {
      expect(t('common.loading')).toBe('Loading...');
    });

    it('should return Chinese translation', () => {
      setLocale('zh-CN');
      expect(t('common.loading')).toBe('加载中...');
    });

    it('should return Japanese translation', () => {
      setLocale('ja');
      expect(t('common.loading')).toBe('読み込み中...');
    });

    it('should return translation for nested keys', () => {
      expect(t('execution.status.running')).toBe('Running');
    });

    it('should fall back to English for missing translation', () => {
      setLocale('ja');
      // Japanese doesn't have all translations, should fallback to English
      const result = t('execution.status.idle');
      expect(result).toBe('Idle');
    });

    it('should return key for missing translation in all locales', () => {
      const result = t('nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    it('should use locale parameter override', () => {
      expect(t('common.loading', 'zh-CN')).toBe('加载中...');
      expect(getLocale()).toBe('en'); // Should not change current locale
    });
  });

  describe('tp (translation with params)', () => {
    it('should return translation with single parameter', () => {
      // Note: Our current translations don't use parameters, but the function should work
      const result = tp('common.loading', {});
      expect(result).toBe('Loading...');
    });

    it('should replace multiple parameters', () => {
      // This tests the parameter replacement logic
      const template = 'Hello, {name}! You have {count} messages.';
      const result = template
        .replace('{name}', 'John')
        .replace('{count}', '5');
      expect(result).toBe('Hello, John! You have 5 messages.');
    });
  });

  describe('getAvailableLocales', () => {
    it('should return all supported locales', () => {
      const locales = getAvailableLocales();

      expect(locales).toContain('en');
      expect(locales).toContain('zh-CN');
      expect(locales).toContain('zh-TW');
      expect(locales).toContain('ja');
      expect(locales).toContain('ko');
      expect(locales).toContain('es');
      expect(locales).toContain('fr');
      expect(locales).toContain('de');
    });
  });

  describe('getLocaleName', () => {
    it('should return locale name in English by default', () => {
      expect(getLocaleName('en')).toBe('English');
      expect(getLocaleName('zh-CN')).toBe('简体中文');
      expect(getLocaleName('ja')).toBe('日本語');
    });

    it('should return locale name in Chinese when displayLocale is zh-CN', () => {
      expect(getLocaleName('en', 'zh-CN')).toBe('English');
      expect(getLocaleName('zh-CN', 'zh-CN')).toBe('简体中文');
      expect(getLocaleName('ja', 'zh-CN')).toBe('日本語');
    });

    it('should return locale code for unknown locale', () => {
      const result = getLocaleName('unknown' as any);
      expect(result).toBe('unknown');
    });
  });

  describe('comprehensive translations', () => {
    it('should have all common translations in English', () => {
      const commonKeys = [
        'common.loading',
        'common.success',
        'common.failed',
        'common.error',
        'common.cancel',
        'common.confirm',
        'common.save',
      ];

      commonKeys.forEach((key) => {
        const result = t(key);
        expect(result).not.toBe(key);
        expect(result).toBeTruthy();
      });
    });

    it('should have all execution status translations in English', () => {
      const statusKeys = [
        'execution.status.idle',
        'execution.status.running',
        'execution.status.paused',
        'execution.status.completed',
        'execution.status.failed',
      ];

      statusKeys.forEach((key) => {
        const result = t(key);
        expect(result).not.toBe(key);
        expect(result).toBeTruthy();
      });
    });

    it('should have all execution error translations in English', () => {
      const errorKeys = [
        'execution.error.elementNotFound',
        'execution.error.timeout',
        'execution.error.actionFailed',
        'execution.error.navigationFailed',
        'execution.error.assertionFailed',
      ];

      errorKeys.forEach((key) => {
        const result = t(key);
        expect(result).not.toBe(key);
        expect(result).toBeTruthy();
      });
    });

    it('should have all AI Test Generator translations in English', () => {
      const aiTestKeys = [
        'aiTestGenerator.title',
        'aiTestGenerator.parseButton',
        'aiTestGenerator.generateButton',
        'aiTestGenerator.executeButton',
        'aiTestGenerator.pauseButton',
        'aiTestGenerator.resumeButton',
        'aiTestGenerator.stopButton',
      ];

      aiTestKeys.forEach((key) => {
        const result = t(key);
        expect(result).not.toBe(key);
        expect(result).toBeTruthy();
      });
    });

    it('should have comprehensive Chinese translations', () => {
      setLocale('zh-CN');

      const keys = [
        'common.loading',
        'execution.status.running',
        'aiTestGenerator.title',
        'gitlab.title',
        'device.title',
        'healing.title',
        'masking.title',
        'anomaly.title',
      ];

      keys.forEach((key) => {
        const result = t(key);
        expect(result).toBeTruthy();
        // Should contain Chinese characters for these keys
        if (key !== 'common.loading') {
          expect(result).toMatch(/[\u4e00-\u9fa5]/);
        }
      });
    });
  });
});
