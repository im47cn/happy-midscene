/**
 * Keyboard Shortcuts Hook for AI Test Generator
 * Provides keyboard navigation and control without leaving the keyboard
 */

import { useCallback, useEffect } from 'react';
import { useGeneratorStore } from '../store';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  enabled?: boolean;
}

// Platform detection for modifier key display
const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modifierKey = isMac ? '⌘' : 'Ctrl';

/**
 * All available shortcuts with descriptions
 */
export const SHORTCUTS = {
  // Navigation
  PARSE: {
    key: 'Enter',
    ctrl: true,
    description: `${modifierKey}+Enter: 解析需求`,
  },
  RUN: { key: 'r', ctrl: true, description: `${modifierKey}+R: 开始执行` },

  // Execution control
  PAUSE: { key: 'p', ctrl: true, description: `${modifierKey}+P: 暂停执行` },
  RESUME: {
    key: 'p',
    ctrl: true,
    shift: true,
    description: `${modifierKey}+Shift+P: 继续执行`,
  },
  STOP: { key: 'Escape', description: 'Esc: 停止执行' },
  NEXT_STEP: { key: 'n', ctrl: true, description: `${modifierKey}+N: 下一步` },

  // View navigation
  BACK: { key: 'Backspace', alt: true, description: 'Alt+← : 返回上一视图' },

  // Actions
  COPY_YAML: {
    key: 'c',
    ctrl: true,
    shift: true,
    description: `${modifierKey}+Shift+C: 复制 YAML`,
  },
  SAVE: { key: 's', ctrl: true, description: `${modifierKey}+S: 保存/提交` },

  // Help
  HELP: { key: '?', shift: true, description: '?: 显示快捷键帮助' },
} as const;

/**
 * Check if a keyboard event matches a shortcut config
 */
function matchesShortcut(
  event: KeyboardEvent,
  config: Omit<ShortcutConfig, 'description' | 'action'>,
): boolean {
  const ctrlOrMeta = isMac ? event.metaKey : event.ctrlKey;

  return (
    event.key.toLowerCase() === config.key.toLowerCase() &&
    (config.ctrl ? ctrlOrMeta : !ctrlOrMeta || config.key === 'Escape') &&
    (config.shift ? event.shiftKey : !event.shiftKey) &&
    (config.alt ? event.altKey : !event.altKey)
  );
}

interface UseKeyboardShortcutsOptions {
  onParse?: () => void;
  onRun?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onNextStep?: () => void;
  onBack?: () => void;
  onCopyYaml?: () => void;
  onSave?: () => void;
  onHelp?: () => void;
  enabled?: boolean;
}

/**
 * Hook to handle keyboard shortcuts
 */
export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions = {},
) {
  const {
    onParse,
    onRun,
    onPause,
    onResume,
    onStop,
    onNextStep,
    onBack,
    onCopyYaml,
    onSave,
    onHelp,
    enabled = true,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Allow some shortcuts even in input fields
      const allowInInput = ['Escape'];
      if (isInputField && !allowInInput.includes(event.key)) {
        // Allow Ctrl+Enter in textareas for parse
        if (!(event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
          return;
        }
      }

      // Parse (Ctrl+Enter)
      if (matchesShortcut(event, { key: 'Enter', ctrl: true }) && onParse) {
        event.preventDefault();
        onParse();
        return;
      }

      // Run (Ctrl+R)
      if (matchesShortcut(event, { key: 'r', ctrl: true }) && onRun) {
        event.preventDefault();
        onRun();
        return;
      }

      // Pause (Ctrl+P)
      if (
        matchesShortcut(event, { key: 'p', ctrl: true }) &&
        !event.shiftKey &&
        onPause
      ) {
        event.preventDefault();
        onPause();
        return;
      }

      // Resume (Ctrl+Shift+P)
      if (
        matchesShortcut(event, { key: 'p', ctrl: true, shift: true }) &&
        onResume
      ) {
        event.preventDefault();
        onResume();
        return;
      }

      // Stop (Escape)
      if (event.key === 'Escape' && onStop) {
        event.preventDefault();
        onStop();
        return;
      }

      // Next Step (Ctrl+N)
      if (matchesShortcut(event, { key: 'n', ctrl: true }) && onNextStep) {
        event.preventDefault();
        onNextStep();
        return;
      }

      // Back (Alt+Backspace)
      if (matchesShortcut(event, { key: 'Backspace', alt: true }) && onBack) {
        event.preventDefault();
        onBack();
        return;
      }

      // Copy YAML (Ctrl+Shift+C)
      if (
        matchesShortcut(event, { key: 'c', ctrl: true, shift: true }) &&
        onCopyYaml
      ) {
        event.preventDefault();
        onCopyYaml();
        return;
      }

      // Save (Ctrl+S)
      if (matchesShortcut(event, { key: 's', ctrl: true }) && onSave) {
        event.preventDefault();
        onSave();
        return;
      }

      // Help (?)
      if (event.key === '?' && event.shiftKey && onHelp) {
        event.preventDefault();
        onHelp();
        return;
      }
    },
    [
      enabled,
      onParse,
      onRun,
      onPause,
      onResume,
      onStop,
      onNextStep,
      onBack,
      onCopyYaml,
      onSave,
      onHelp,
    ],
  );

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);
}

/**
 * Get shortcut display text for a given action
 */
export function getShortcutText(shortcutKey: keyof typeof SHORTCUTS): string {
  const shortcut = SHORTCUTS[shortcutKey];
  return shortcut.description.split(': ')[0];
}

/**
 * Get all shortcuts as an array for help display
 */
export function getAllShortcuts(): Array<{ key: string; description: string }> {
  return Object.values(SHORTCUTS).map((s) => ({
    key: s.description.split(': ')[0],
    description: s.description.split(': ')[1],
  }));
}
