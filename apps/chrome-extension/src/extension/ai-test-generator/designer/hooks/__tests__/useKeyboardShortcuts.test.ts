/**
 * useKeyboardShortcuts Hook Tests
 * 键盘快捷键 Hook 测试
 */

import { describe, expect, it } from 'vitest';

// Import the functions we want to test
import {
  matchShortcut,
  parseShortcutKey,
} from '../useKeyboardShortcuts';

describe('parseShortcutKey', () => {
  describe('modifier keys', () => {
    it('should parse ctrl key', () => {
      expect(parseShortcutKey('ctrl+a')).toEqual({
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'a',
      });
    });

    it('should parse control alias', () => {
      expect(parseShortcutKey('control+s')).toEqual({
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 's',
      });
    });

    it('should parse shift key', () => {
      expect(parseShortcutKey('shift+b')).toEqual({
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        key: 'b',
      });
    });

    it('should parse alt key', () => {
      expect(parseShortcutKey('alt+c')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: true,
        metaKey: false,
        key: 'c',
      });
    });

    it('should parse meta/cmd key', () => {
      expect(parseShortcutKey('meta+d')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        key: 'd',
      });
    });

    it('should parse cmd alias', () => {
      expect(parseShortcutKey('cmd+e')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        key: 'e',
      });
    });

    it('should parse multiple modifiers', () => {
      expect(parseShortcutKey('ctrl+shift+z')).toEqual({
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        key: 'z',
      });
    });

    it('should parse all modifiers', () => {
      expect(parseShortcutKey('ctrl+shift+alt+meta+a')).toEqual({
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        metaKey: true,
        key: 'a',
      });
    });
  });

  describe('special keys', () => {
    it('should parse space', () => {
      expect(parseShortcutKey('ctrl+ ')).toEqual({
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'space',
      });
    });

    it('should parse escape', () => {
      expect(parseShortcutKey('esc')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'escape',
      });
    });

    it('should parse delete', () => {
      expect(parseShortcutKey('del')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'delete',
      });
    });

    it('should parse insert', () => {
      expect(parseShortcutKey('ins')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'insert',
      });
    });

    it('should parse backspace', () => {
      expect(parseShortcutKey('bs')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'backspace',
      });
    });

    it('should parse enter', () => {
      expect(parseShortcutKey('ret')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'enter',
      });
    });
  });

  describe('arrow keys', () => {
    it('should parse arrowup', () => {
      expect(parseShortcutKey('arrowup')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'arrowup',
      });
    });

    it('should parse up alias', () => {
      expect(parseShortcutKey('up')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'arrowup',
      });
    });

    it('should parse arrowdown', () => {
      expect(parseShortcutKey('arrowdown')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'arrowdown',
      });
    });

    it('should parse down alias', () => {
      expect(parseShortcutKey('down')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'arrowdown',
      });
    });

    it('should parse arrowleft', () => {
      expect(parseShortcutKey('arrowleft')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'arrowleft',
      });
    });

    it('should parse left alias', () => {
      expect(parseShortcutKey('left')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'arrowleft',
      });
    });

    it('should parse arrowright', () => {
      expect(parseShortcutKey('arrowright')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'arrowright',
      });
    });

    it('should parse right alias', () => {
      expect(parseShortcutKey('right')).toEqual({
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'arrowright',
      });
    });
  });

  describe('case handling', () => {
    it('should handle uppercase shortcut string', () => {
      expect(parseShortcutKey('CTRL+A')).toEqual({
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'a',
      });
    });

    it('should handle mixed case shortcut string', () => {
      expect(parseShortcutKey('Ctrl+Shift+Z')).toEqual({
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        key: 'z',
      });
    });
  });
});

describe('matchShortcut', () => {
  const createMockEvent = (
    key: string,
    ctrlKey = false,
    shiftKey = false,
    altKey = false,
    metaKey = false,
  ): KeyboardEvent => {
    return {
      key,
      ctrlKey,
      shiftKey,
      altKey,
      metaKey,
    } as KeyboardEvent;
  };

  describe('simple shortcuts', () => {
    it('should match simple key press', () => {
      const event = createMockEvent('a');
      expect(matchShortcut(event, 'a')).toBe(true);
    });

    it('should not match different key', () => {
      const event = createMockEvent('a');
      expect(matchShortcut(event, 'b')).toBe(false);
    });

    it('should be case insensitive for key', () => {
      const event = createMockEvent('A');
      expect(matchShortcut(event, 'a')).toBe(true);
    });
  });

  describe('modifier combinations', () => {
    it('should match ctrl+a', () => {
      const event = createMockEvent('a', true);
      expect(matchShortcut(event, 'ctrl+a')).toBe(true);
    });

    it('should match ctrl+s', () => {
      const event = createMockEvent('s', true);
      expect(matchShortcut(event, 'ctrl+s')).toBe(true);
    });

    it('should not match ctrl+a when only ctrl is pressed but key is different', () => {
      const event = createMockEvent('b', true);
      expect(matchShortcut(event, 'ctrl+a')).toBe(false);
    });

    it('should not match ctrl+a when ctrl is not pressed', () => {
      const event = createMockEvent('a');
      expect(matchShortcut(event, 'ctrl+a')).toBe(false);
    });

    it('should match ctrl+shift+z', () => {
      const event = createMockEvent('z', true, true);
      expect(matchShortcut(event, 'ctrl+shift+z')).toBe(true);
    });

    it('should match ctrl+shift+z with meta as ctrl (Mac behavior)', () => {
      const event = createMockEvent('z', false, true, false, true);
      expect(matchShortcut(event, 'ctrl+shift+z')).toBe(true);
    });
  });

  describe('meta key handling', () => {
    it('should match meta+a when meta is pressed', () => {
      const event = createMockEvent('a', false, false, false, true);
      expect(matchShortcut(event, 'meta+a')).toBe(true);
    });

    it('should match cmd+a when meta is pressed', () => {
      const event = createMockEvent('a', false, false, false, true);
      expect(matchShortcut(event, 'cmd+a')).toBe(true);
    });

    it('should not match meta+a when meta is not pressed', () => {
      const event = createMockEvent('a');
      expect(matchShortcut(event, 'meta+a')).toBe(false);
    });

    it('should match ctrl+a with meta as ctrl (Mac compatibility)', () => {
      const event = createMockEvent('a', false, false, false, true);
      expect(matchShortcut(event, 'ctrl+a')).toBe(true);
    });
  });

  describe('special keys', () => {
    it('should match escape', () => {
      const event = createMockEvent('Escape');
      expect(matchShortcut(event, 'esc')).toBe(true);
    });

    it('should match delete', () => {
      const event = createMockEvent('Delete');
      expect(matchShortcut(event, 'delete')).toBe(true);
    });

    it('should match delete with del alias', () => {
      const event = createMockEvent('Delete');
      expect(matchShortcut(event, 'del')).toBe(true);
    });

    it('should match backspace', () => {
      const event = createMockEvent('Backspace');
      expect(matchShortcut(event, 'backspace')).toBe(true);
    });

    it('should match backspace with bs alias', () => {
      const event = createMockEvent('Backspace');
      expect(matchShortcut(event, 'bs')).toBe(true);
    });

    it('should match enter', () => {
      const event = createMockEvent('Enter');
      expect(matchShortcut(event, 'enter')).toBe(true);
    });

    it('should match enter with ret alias', () => {
      const event = createMockEvent('Enter');
      expect(matchShortcut(event, 'ret')).toBe(true);
    });
  });

  describe('arrow keys', () => {
    it('should match arrowup', () => {
      const event = createMockEvent('ArrowUp');
      expect(matchShortcut(event, 'arrowup')).toBe(true);
    });

    it('should match up alias for arrowup', () => {
      const event = createMockEvent('ArrowUp');
      expect(matchShortcut(event, 'up')).toBe(true);
    });

    it('should match arrowdown', () => {
      const event = createMockEvent('ArrowDown');
      expect(matchShortcut(event, 'arrowdown')).toBe(true);
    });

    it('should match arrowleft', () => {
      const event = createMockEvent('ArrowLeft');
      expect(matchShortcut(event, 'arrowleft')).toBe(true);
    });

    it('should match arrowright', () => {
      const event = createMockEvent('ArrowRight');
      expect(matchShortcut(event, 'arrowright')).toBe(true);
    });
  });

  describe('complex shortcuts', () => {
    it('should match ctrl+shift+z', () => {
      const event = createMockEvent('z', true, true);
      expect(matchShortcut(event, 'ctrl+shift+z')).toBe(true);
    });

    it('should match ctrl+0', () => {
      const event = createMockEvent('0', true);
      expect(matchShortcut(event, 'ctrl+0')).toBe(true);
    });

    it('should match ctrl+plus using = key', () => {
      // In many keyboards, + is on the same key as = (requires shift)
      const event = createMockEvent('=', true, true);
      expect(matchShortcut(event, 'ctrl+plus')).toBe(true);
    });

    it('should match ctrl+-', () => {
      const event = createMockEvent('-', true);
      expect(matchShortcut(event, 'ctrl+-')).toBe(true);
    });
  });

  describe('negative cases', () => {
    it('should not match when extra modifier is pressed', () => {
      const event = createMockEvent('a', true, false, true);
      expect(matchShortcut(event, 'ctrl+a')).toBe(false);
    });

    it('should not match when modifier is missing', () => {
      const event = createMockEvent('a', false, true);
      expect(matchShortcut(event, 'ctrl+shift+a')).toBe(false);
    });

    it('should not match when key is different', () => {
      const event = createMockEvent('b', true);
      expect(matchShortcut(event, 'ctrl+a')).toBe(false);
    });
  });
});
