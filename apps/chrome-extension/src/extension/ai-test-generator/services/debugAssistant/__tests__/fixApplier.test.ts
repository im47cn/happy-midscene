/**
 * Unit tests for Fix Applier
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FixApplier,
  getFixApplier,
  resetFixApplier,
} from '../fixApplier';
import { KnowledgeBase } from '../knowledgeBase';
import type { FixSuggestion, DebugContext } from '../../../types/debugAssistant';

describe('FixApplier', () => {
  let fixApplier: FixApplier;
  let mockKnowledgeBase: KnowledgeBase;

  beforeEach(() => {
    vi.clearAllMocks();
    resetFixApplier();

    mockKnowledgeBase = {
      addEntry: vi.fn(),
      findMatchingPatterns: vi.fn(() => []),
      updateSuccessRate: vi.fn(),
      getEntry: vi.fn(),
      findByTags: vi.fn(() => []),
      getBySuccessRate: vi.fn(() => []),
      getRecentEntries: vi.fn(() => []),
      getStats: vi.fn(() => ({
        totalEntries: 0,
        totalFixes: 0,
        averageSuccessRate: 0,
        mostCommonPatterns: [],
      })),
      clear: vi.fn(),
      export: vi.fn(() => '[]'),
      import: vi.fn(),
    } as unknown as KnowledgeBase;

    fixApplier = getFixApplier({
      knowledgeBase: mockKnowledgeBase,
      autoSave: true,
      createBackup: true,
    });
  });

  describe('applyFix', () => {
    it('should apply wait fix', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait for element to appear',
        code: 'await waitFor(element, { state: "visible" });',
        confidence: 0.9,
      };

      const result = await fixApplier.applyFix(context, fix, {
        filePath: '/test/file.ts',
        line: 10,
        column: 0,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('等待');
      expect(result.canRevert).toBe(true);
    });

    it('should apply timeout fix', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'timeout',
        description: 'Increase timeout',
        code: '{ timeout: 30000 }',
        confidence: 0.8,
      };

      const result = await fixApplier.applyFix(context, fix);

      expect(result.success).toBe(true);
      expect(result.message).toContain('超时');
    });

    it('should apply locator fix', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'locator',
        description: 'Use better selector',
        code: 'const btn = await locate("test-id=submit");',
        confidence: 0.85,
      };

      const result = await fixApplier.applyFix(context, fix);

      expect(result.success).toBe(true);
      expect(result.message).toContain('选择器');
    });

    it('should apply retry fix', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'retry',
        description: 'Add retry logic',
        code: 'await retry(async () => click(), { times: 3 });',
        confidence: 0.75,
      };

      const result = await fixApplier.applyFix(context, fix);

      expect(result.success).toBe(true);
      expect(result.message).toContain('重试');
    });

    it('should apply assertion fix', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'assertion',
        description: 'Fix assertion',
        code: 'assert.equal(actual, expected);',
        confidence: 0.7,
      };

      const result = await fixApplier.applyFix(context, fix);

      expect(result.success).toBe(true);
      expect(result.message).toContain('断言');
    });

    it('should apply action fix', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'action',
        description: 'Add action',
        code: 'await click("close");',
        confidence: 0.8,
      };

      const result = await fixApplier.applyFix(context, fix);

      expect(result.success).toBe(true);
      expect(result.message).toContain('操作');
    });

    it('should apply debug fix', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'debug',
        description: 'Add debug output',
        code: 'console.log("debug");',
        confidence: 0.6,
      };

      const result = await fixApplier.applyFix(context, fix);

      expect(result.success).toBe(true);
      expect(result.message).toContain('调试');
    });

    it('should apply navigation fix', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'navigation',
        description: 'Navigate to page',
        code: 'await navigate("https://example.com");',
        confidence: 0.9,
      };

      const result = await fixApplier.applyFix(context, fix);

      expect(result.success).toBe(true);
      expect(result.message).toContain('导航');
    });

    it('should apply auth fix', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'auth',
        description: 'Add authentication',
        code: 'await login();',
        confidence: 0.85,
      };

      const result = await fixApplier.applyFix(context, fix);

      expect(result.success).toBe(true);
      expect(result.message).toContain('认证');
    });

    it('should return error for unsupported fix type', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix = {
        type: 'unknown' as any,
        description: 'Unknown fix',
        code: '',
        confidence: 0.5,
      };

      const result = await fixApplier.applyFix(context, fix);

      expect(result.success).toBe(false);
      expect(result.message).toContain('不支持');
    });

    it('should handle errors gracefully', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait',
        code: '',
        confidence: 0.5,
      };

      // Mock a method to throw
      const originalMethod = fixApplier['applyWaitFix'];
      fixApplier['applyWaitFix'] = vi.fn().mockRejectedValue(new Error('Apply failed'));

      const result = await fixApplier.applyFix(context, fix);

      expect(result.success).toBe(false);
      expect(result.message).toContain('应用修复失败');

      // Restore
      fixApplier['applyWaitFix'] = originalMethod;
    });
  });

  describe('wait fix specifics', () => {
    it('should require position for wait fix', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait for element',
        code: '',
        confidence: 0.9,
      };

      const result = await fixApplier.applyFix(context, fix);

      expect(result.success).toBe(false);
      expect(result.message).toContain('修复位置');
    });
  });

  describe('revertFix', () => {
    it('should revert applied fix', async () => {
      const appliedResult = {
        success: true,
        message: 'Applied',
        modifiedFiles: [
          {
            path: '/test/file.ts',
            originalContent: 'original',
            modifiedContent: 'modified',
          },
        ],
        canRevert: true,
      };

      (fixApplier as any).appliedFixes.set('fix-1', appliedResult);

      const reverted = await fixApplier.revertFix('fix-1');

      expect(reverted).toBe(true);
      expect((fixApplier as any).appliedFixes.has('fix-1')).toBe(false);
    });

    it('should return false for non-existent fix', async () => {
      const reverted = await fixApplier.revertFix('nonexistent');

      expect(reverted).toBe(false);
    });

    it('should return false for non-revertible fix', async () => {
      const appliedResult = {
        success: true,
        message: 'Applied',
        modifiedFiles: [],
        canRevert: false,
      };

      (fixApplier as any).appliedFixes.set('fix-2', appliedResult);

      const reverted = await fixApplier.revertFix('fix-2');

      expect(reverted).toBe(false);
    });
  });

  describe('previewFix', () => {
    it('should generate fix preview', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Add wait',
        code: 'await waitFor(element);',
        confidence: 0.9,
      };

      const preview = fixApplier.previewFix(context, fix);

      expect(preview.original).toBeTruthy();
      expect(preview.modified).toBeTruthy();
      expect(preview.diff).toBeTruthy();
      expect(preview.diff).toContain('```diff');
    });

    it('should use fix code if provided', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait',
        code: 'custom code here',
        confidence: 0.9,
      };

      const preview = fixApplier.previewFix(context, fix);

      expect(preview.modified).toBe('custom code here');
    });

    it('should generate code from description if no code provided', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait for element',
        code: '',
        confidence: 0.9,
      };

      const preview = fixApplier.previewFix(context, fix);

      expect(preview.modified).toContain('// Wait for element');
    });
  });

  describe('recordSuccessfulFix', () => {
    it('should record successful fix to knowledge base', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        failedStep: 'Click submit',
        lastError: {
          type: 'element_not_found',
          message: 'Cannot find element submit',
          stack: '',
        },
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait for element',
        code: 'await waitFor(element);',
        confidence: 0.9,
      };

      fixApplier.recordSuccessfulFix(context, fix, 'Cannot find element submit');

      expect(mockKnowledgeBase.addEntry).toHaveBeenCalled();
      const entry = (mockKnowledgeBase.addEntry as any).mock.calls[0][0];
      expect(entry.pattern).toContain('submit');
      expect(entry.tags).toContain('wait');
    });

    it('should add timeout tag for timeout errors', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        lastError: {
          type: 'timeout',
          message: 'Timeout waiting for element',
          stack: '',
        },
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait',
        code: '',
        confidence: 0.8,
      };

      fixApplier.recordSuccessfulFix(context, fix, 'Timeout');

      const entry = (mockKnowledgeBase.addEntry as any).mock.calls[0][0];
      expect(entry.tags).toContain('timeout');
    });

    it('should add element_not_found tag for not found errors', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        lastError: {
          type: 'element_not_found',
          message: 'Element not found',
          stack: '',
        },
      };

      const fix: FixSuggestion = {
        type: 'locator',
        description: 'Use better selector',
        code: '',
        confidence: 0.8,
      };

      fixApplier.recordSuccessfulFix(context, fix, 'Not found');

      const entry = (mockKnowledgeBase.addEntry as any).mock.calls[0][0];
      expect(entry.tags).toContain('element_not_found');
    });

    it('should not record if no knowledge base', () => {
      const noKbApplier = new FixApplier({ knowledgeBase: undefined });

      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait',
        code: '',
        confidence: 0.8,
      };

      // Should not throw
      noKbApplier.recordSuccessfulFix(context, fix, 'error');
    });
  });

  describe('recordFailedFix', () => {
    it('should update success rate for failed fix', () => {
      (mockKnowledgeBase.findMatchingPatterns as any).mockReturnValue([
        {
          id: 'kb-1',
          pattern: 'element not found',
          fixes: [],
          frequency: 1,
          successRate: 0.8,
          tags: [],
        },
      ]);

      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait',
        code: '',
        confidence: 0.8,
      };

      fixApplier.recordFailedFix(context, fix, 'element not found');

      expect(mockKnowledgeBase.findMatchingPatterns).toHaveBeenCalled();
      expect(mockKnowledgeBase.updateSuccessRate).toHaveBeenCalledWith('kb-1', false);
    });

    it('should not update if no matching pattern found', () => {
      (mockKnowledgeBase.findMatchingPatterns as any).mockReturnValue([]);

      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait',
        code: '',
        confidence: 0.8,
      };

      // Should not throw
      fixApplier.recordFailedFix(context, fix, 'unknown error');

      expect(mockKnowledgeBase.updateSuccessRate).not.toHaveBeenCalled();
    });

    it('should not record if no knowledge base', () => {
      const noKbApplier = new FixApplier({ knowledgeBase: undefined });

      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait',
        code: '',
        confidence: 0.8,
      };

      // Should not throw
      noKbApplier.recordFailedFix(context, fix, 'error');
    });
  });

  describe('getAppliedFixes', () => {
    it('should return all applied fixes', () => {
      const result1 = {
        success: true,
        message: 'Fix 1',
        modifiedFiles: [],
        canRevert: true,
      };
      const result2 = {
        success: true,
        message: 'Fix 2',
        modifiedFiles: [],
        canRevert: true,
      };

      (fixApplier as any).appliedFixes.set('fix-1', result1);
      (fixApplier as any).appliedFixes.set('fix-2', result2);

      const applied = fixApplier.getAppliedFixes();

      expect(applied.size).toBe(2);
      expect(applied.get('fix-1')).toEqual(result1);
      expect(applied.get('fix-2')).toEqual(result2);
    });

    it('should return a copy of the map', () => {
      const result = { success: true, message: 'Fix', modifiedFiles: [], canRevert: true };
      (fixApplier as any).appliedFixes.set('fix-1', result);

      const applied = fixApplier.getAppliedFixes();
      applied.clear();

      // Original should not be affected
      expect((fixApplier as any).appliedFixes.size).toBe(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear applied fixes history', () => {
      const result = { success: true, message: 'Fix', modifiedFiles: [], canRevert: true };
      (fixApplier as any).appliedFixes.set('fix-1', result);

      fixApplier.clearHistory();

      expect((fixApplier as any).appliedFixes.size).toBe(0);
    });
  });

  describe('setKnowledgeBase', () => {
    it('should update knowledge base', () => {
      const newKb = {} as KnowledgeBase;

      fixApplier.setKnowledgeBase(newKb);

      expect((fixApplier as any).knowledgeBase).toBe(newKb);
    });
  });

  describe('configuration', () => {
    it('should use default options', () => {
      const defaultApplier = new FixApplier();

      expect((defaultApplier as any).autoSave).toBe(true);
      expect((defaultApplier as any).createBackup).toBe(true);
    });

    it('should accept custom options', () => {
      const customApplier = new FixApplier({
        autoSave: false,
        createBackup: false,
      });

      expect((customApplier as any).autoSave).toBe(false);
      expect((customApplier as any).createBackup).toBe(false);
    });
  });
});
