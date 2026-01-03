/**
 * Context Collector Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ContextCollector } from '../contextCollector';

describe('ContextCollector', () => {
  let collector: ContextCollector;

  beforeEach(() => {
    collector = new ContextCollector();
  });

  describe('createContextFromResult', () => {
    it('should create context from step result', () => {
      const context = collector.createContextFromResult(
        'step-1',
        0,
        '点击登录按钮',
        'https://example.com/login',
        'https://example.com/dashboard',
      );

      expect(context.stepId).toBe('step-1');
      expect(context.stepIndex).toBe(0);
      expect(context.action.type).toBe('click');
      expect(context.pageState.beforeUrl).toBe('https://example.com/login');
      expect(context.pageState.afterUrl).toBe('https://example.com/dashboard');
    });

    it('should infer action type correctly', () => {
      const clickContext = collector.createContextFromResult(
        'step-1',
        0,
        '点击提交按钮',
        '',
        '',
      );
      expect(clickContext.action.type).toBe('click');

      const inputContext = collector.createContextFromResult(
        'step-2',
        1,
        '输入用户名 admin',
        '',
        '',
      );
      expect(inputContext.action.type).toBe('input');

      const navigateContext = collector.createContextFromResult(
        'step-3',
        2,
        '打开 https://example.com',
        '',
        '',
      );
      expect(navigateContext.action.type).toBe('navigate');

      const assertContext = collector.createContextFromResult(
        'step-4',
        3,
        '验证登录成功',
        '',
        '',
      );
      expect(assertContext.action.type).toBe('assert');
    });

    it('should infer action intent correctly', () => {
      const loginContext = collector.createContextFromResult(
        'step-1',
        0,
        '点击登录按钮',
        '',
        '',
      );
      expect(loginContext.semantic.actionIntent).toBe('login');

      const submitContext = collector.createContextFromResult(
        'step-2',
        1,
        '点击提交按钮',
        '',
        '',
      );
      expect(submitContext.semantic.actionIntent).toBe('submit_form');

      const deleteContext = collector.createContextFromResult(
        'step-3',
        2,
        '点击删除按钮',
        '',
        '',
      );
      expect(deleteContext.semantic.actionIntent).toBe('delete_item');
    });

    it('should extract target description', () => {
      const context = collector.createContextFromResult(
        'step-1',
        0,
        '点击登录按钮',
        '',
        '',
      );
      expect(context.action.target.text).toBe('登录按钮');
    });

    it('should extract input value', () => {
      const context = collector.createContextFromResult(
        'step-1',
        0,
        '输入 "admin" 到用户名输入框',
        '',
        '',
      );
      expect(context.action.value).toBe('admin');
    });

    it('should handle element info', () => {
      const context = collector.createContextFromResult(
        'step-1',
        0,
        '点击按钮',
        '',
        '',
        { text: 'Submit', tagName: 'button' },
      );
      expect(context.action.target.text).toBe('Submit');
      expect(context.action.target.tagName).toBe('button');
    });
  });

  describe('startCollection and completeCollection', () => {
    it('should return null when no collection started', () => {
      const result = collector.completeCollection();
      expect(result).toBeNull();
    });

    it('should cancel collection', () => {
      collector.startCollection('step-1', 0, '点击按钮');
      collector.cancelCollection();
      const result = collector.completeCollection();
      expect(result).toBeNull();
    });
  });
});
