/**
 * useKeyboardShortcuts Hook
 * 键盘快捷键管理 - 提供统一的快捷键处理
 */

import { useEffect, useRef } from 'react';
import type { DesignerStore } from '../store/designerStore';

/**
 * 键盘组合键类型
 */
export type KeyboardShortcut = {
  /** 快捷键描述 */
  description: string;
  /** 快捷键组合 (例如: 'ctrl+c', 'delete', 'arrowup') */
  key: string;
  /** 处理函数 */
  handler: () => void;
  /** 是否启用 */
  enabled?: boolean;
  /** 作用域 (global 表示全局，否则仅在画布聚焦时生效) */
  scope?: 'global' | 'canvas';
  /** 阻止默认行为 */
  preventDefault?: boolean;
};

/**
 * 解析快捷键字符串
 */
export function parseShortcutKey(shortcut: string): {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  key: string;
} {
  const parts = shortcut.toLowerCase().split('+');
  let key = parts.pop() || '';
  const ctrlKey = parts.includes('ctrl') || parts.includes('control');
  let shiftKey = parts.includes('shift');
  const altKey = parts.includes('alt');
  const metaKey = parts.includes('meta') || parts.includes('cmd');

  // 处理特殊键名
  const keyMap: Record<string, string> = {
    ' ': 'space',
    esc: 'escape',
    del: 'delete',
    ins: 'insert',
    bs: 'backspace',
    ret: 'enter',
    plus: '=',
  };

  // Keys that require shift (e.g., + is on the same key as =)
  if (key === 'plus') {
    shiftKey = true;
  }

  if (keyMap[key]) {
    key = keyMap[key];
  }

  // 处理方向键
  const arrowMap: Record<string, string> = {
    arrowup: 'arrowup',
    arrowdown: 'arrowdown',
    arrowleft: 'arrowleft',
    arrowright: 'arrowright',
    up: 'arrowup',
    down: 'arrowdown',
    left: 'arrowleft',
    right: 'arrowright',
  };

  if (arrowMap[key]) {
    key = arrowMap[key];
  }

  return { ctrlKey, shiftKey, altKey, metaKey, key };
}

/**
 * 检查键盘事件是否匹配快捷键
 */
export function matchShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcutKey(shortcut);

  // 检查修饰键
  // For ctrl: accepts ctrlKey OR metaKey (for Mac compatibility)
  // But when meta is explicitly specified, it only matches metaKey
  if (parsed.metaKey) {
    // Explicit meta/cmd - only matches metaKey
    if (!event.metaKey) return false;
    // When meta is explicit without ctrl, ctrl should NOT be pressed
    if (!parsed.ctrlKey && event.ctrlKey) return false;
  } else if (parsed.ctrlKey) {
    // Explicit ctrl - matches either ctrlKey or metaKey (Mac behavior)
    if (!event.ctrlKey && !event.metaKey) return false;
  } else {
    // No ctrl/meta expected - neither should be pressed
    if (event.ctrlKey || event.metaKey) return false;
  }

  if (parsed.shiftKey && !event.shiftKey) return false;
  if (!parsed.shiftKey && event.shiftKey) return false;

  if (parsed.altKey && !event.altKey) return false;
  if (!parsed.altKey && event.altKey) return false;

  // 检查按键
  const eventKey = event.key.toLowerCase();
  return eventKey === parsed.key.toLowerCase();
}

/**
 * 检查是否在可编辑元素中
 */
function isEditableElement(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  if (!target) return false;

  const tagName = target.tagName.toLowerCase();
  const isInput =
    tagName === 'input' ||
    tagName === 'textarea' ||
    target.isContentEditable;

  // 检查是否是 Select 组件的下拉框
  const isSelect = target.classList.contains('ant-select-selection-search-input');

  return isInput && !isSelect;
}

/**
 * 检查是否在 Modal 中
 */
function isInModal(): boolean {
  return document.querySelectorAll('.ant-modal-open').length > 0;
}

/**
 * 键盘快捷键 Hook
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options?: {
    /** 是否启用 (默认 true) */
    enabled?: boolean;
    /** 是否在可编辑元素中禁用 (默认 true) */
    disableInEditable?: boolean;
    /** 是否在 Modal 打开时禁用 (默认 true) */
    disableInModal?: boolean;
  },
) {
  const { enabled = true, disableInEditable = true, disableInModal = true } =
    options || {};

  const shortcutsRef = useRef(shortcuts);

  // 更新 shortcuts 引用
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 检查是否应该处理快捷键
      if (disableInEditable && isEditableElement(event)) {
        return;
      }

      if (disableInModal && isInModal()) {
        return;
      }

      // 查找匹配的快捷键
      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue;

        if (matchShortcut(event, shortcut.key)) {
          // 检查作用域
          if (shortcut.scope === 'canvas') {
            const canvas = document.querySelector('[data-testid="flow-canvas"]');
            if (!canvas || !canvas.contains(event.target as Node)) {
              continue;
            }
          }

          // 阻止默认行为
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
            event.stopPropagation();
          }

          // 执行处理函数
          shortcut.handler();
          return;
        }
      }
    };

    // 全局捕获键盘事件
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, disableInEditable, disableInModal]);
}

/**
 * 创建标准设计器快捷键
 */
export function createDesignerShortcuts(store: DesignerStore): KeyboardShortcut[] {
  return [
    // 文件操作
    {
      description: '保存',
      key: 'ctrl+s',
      handler: () => store.saveFlow(),
      scope: 'global',
    },
    {
      description: '导出 YAML',
      key: 'ctrl+e',
      handler: () => {
        const event = new CustomEvent('designer-export-yaml');
        window.dispatchEvent(event);
      },
      scope: 'global',
    },

    // 编辑操作
    {
      description: '撤销',
      key: 'ctrl+z',
      handler: () => {
        if (store.canUndo()) {
          store.undo();
        }
      },
      scope: 'global',
    },
    {
      description: '重做',
      key: 'ctrl+y',
      handler: () => {
        if (store.canRedo()) {
          store.redo();
        }
      },
      scope: 'global',
    },
    {
      description: '重做 (Alt)',
      key: 'ctrl+shift+z',
      handler: () => {
        if (store.canRedo()) {
          store.redo();
        }
      },
      scope: 'global',
    },
    {
      description: '复制选中节点',
      key: 'ctrl+c',
      handler: () => {
        const selected = store.selectedNodes;
        if (selected.length === 1) {
          const flow = store.flow;
          if (flow) {
            const node = flow.nodes.find((n) => n.id === selected[0]);
            if (node) {
              store.setFlow({
                ...flow,
                metadata: {
                  ...flow.metadata,
                  clipboard: {
                    nodes: [node],
                    edges: [],
                  },
                },
              });
            }
          }
        }
      },
      scope: 'canvas',
    },
    {
      description: '粘贴节点',
      key: 'ctrl+v',
      handler: () => {
        const flow = store.flow;
        if (flow?.metadata.clipboard?.nodes?.[0]) {
          const node = flow.metadata.clipboard.nodes[0];
          store.addNode?.({
            ...node,
            id: `${node.type}-${Date.now()}`,
            position: {
              x: node.position.x + 50,
              y: node.position.y + 50,
            },
          });
        }
      },
      scope: 'canvas',
    },
    {
      description: '删除选中节点',
      key: 'delete',
      handler: () => {
        store.selectedNodes.forEach((nodeId) => {
          store.deleteNode?.(nodeId);
        });
      },
      scope: 'canvas',
    },
    {
      description: '删除选中节点 (Backspace)',
      key: 'backspace',
      handler: () => {
        store.selectedNodes.forEach((nodeId) => {
          store.deleteNode?.(nodeId);
        });
      },
      scope: 'canvas',
    },

    // 视图操作
    {
      description: '放大',
      key: 'ctrl+plus',
      handler: () => {
        store.setZoom?.(Math.min(2, store.zoom + 0.1));
      },
      scope: 'global',
    },
    {
      description: '放大 (=)',
      key: 'ctrl+=',
      handler: () => {
        store.setZoom?.(Math.min(2, store.zoom + 0.1));
      },
      scope: 'global',
    },
    {
      description: '缩小',
      key: 'ctrl+-',
      handler: () => {
        store.setZoom?.(Math.max(0.1, store.zoom - 0.1));
      },
      scope: 'global',
    },
    {
      description: '适应视图',
      key: 'ctrl+0',
      handler: () => {
        store.fitView?.();
      },
      scope: 'global',
    },
    {
      description: '切换网格',
      key: 'ctrl+g',
      handler: () => {
        store.toggleGrid?.();
      },
      scope: 'global',
    },
    {
      description: '切换小地图',
      key: 'ctrl+m',
      handler: () => {
        store.toggleMinimap?.();
      },
      scope: 'global',
    },

    // 选择操作
    {
      description: '全选',
      key: 'ctrl+a',
      handler: () => {
        const flow = store.flow;
        if (flow) {
          store.selectNodes?.(flow.nodes.map((n) => n.id));
        }
      },
      scope: 'canvas',
    },
    {
      description: '清除选择',
      key: 'escape',
      handler: () => {
        store.clearSelection?.();
      },
      scope: 'canvas',
    },

    // 节点移动
    {
      description: '上移节点',
      key: 'arrowup',
      handler: () => {
        const selected = store.selectedNodes;
        const flow = store.flow;
        if (selected.length > 0 && flow) {
          selected.forEach((nodeId) => {
            const node = flow.nodes.find((n) => n.id === nodeId);
            if (node) {
              store.updateNode?.(nodeId, {
                position: {
                  x: node.position.x,
                  y: node.position.y - 10,
                },
              });
            }
          });
        }
      },
      scope: 'canvas',
      preventDefault: true,
    },
    {
      description: '下移节点',
      key: 'arrowdown',
      handler: () => {
        const selected = store.selectedNodes;
        const flow = store.flow;
        if (selected.length > 0 && flow) {
          selected.forEach((nodeId) => {
            const node = flow.nodes.find((n) => n.id === nodeId);
            if (node) {
              store.updateNode?.(nodeId, {
                position: {
                  x: node.position.x,
                  y: node.position.y + 10,
                },
              });
            }
          });
        }
      },
      scope: 'canvas',
      preventDefault: true,
    },
    {
      description: '左移节点',
      key: 'arrowleft',
      handler: () => {
        const selected = store.selectedNodes;
        const flow = store.flow;
        if (selected.length > 0 && flow) {
          selected.forEach((nodeId) => {
            const node = flow.nodes.find((n) => n.id === nodeId);
            if (node) {
              store.updateNode?.(nodeId, {
                position: {
                  x: node.position.x - 10,
                  y: node.position.y,
                },
              });
            }
          });
        }
      },
      scope: 'canvas',
      preventDefault: true,
    },
    {
      description: '右移节点',
      key: 'arrowright',
      handler: () => {
        const selected = store.selectedNodes;
        const flow = store.flow;
        if (selected.length > 0 && flow) {
          selected.forEach((nodeId) => {
            const node = flow.nodes.find((n) => n.id === nodeId);
            if (node) {
              store.updateNode?.(nodeId, {
                position: {
                  x: node.position.x + 10,
                  y: node.position.y,
                },
              });
            }
          });
        }
      },
      scope: 'canvas',
      preventDefault: true,
    },
  ];
}

/**
 * 快捷键帮助信息
 */
export const SHORTCUT_HELP: Array<{ category: string; shortcuts: Array<{ key: string; description: string }> }> = [
  {
    category: '文件操作',
    shortcuts: [
      { key: 'Ctrl+S', description: '保存流程' },
      { key: 'Ctrl+E', description: '导出 YAML' },
    ],
  },
  {
    category: '编辑操作',
    shortcuts: [
      { key: 'Ctrl+Z', description: '撤销' },
      { key: 'Ctrl+Y / Ctrl+Shift+Z', description: '重做' },
      { key: 'Ctrl+C', description: '复制节点' },
      { key: 'Ctrl+V', description: '粘贴节点' },
      { key: 'Delete / Backspace', description: '删除选中节点' },
    ],
  },
  {
    category: '视图操作',
    shortcuts: [
      { key: 'Ctrl++ / Ctrl+=', description: '放大' },
      { key: 'Ctrl+-', description: '缩小' },
      { key: 'Ctrl+0', description: '适应视图' },
      { key: 'Ctrl+G', description: '切换网格' },
      { key: 'Ctrl+M', description: '切换小地图' },
    ],
  },
  {
    category: '选择操作',
    shortcuts: [
      { key: 'Ctrl+A', description: '全选' },
      { key: 'Escape', description: '清除选择' },
    ],
  },
  {
    category: '节点移动',
    shortcuts: [
      { key: '↑', description: '上移 10px' },
      { key: '↓', description: '下移 10px' },
      { key: '←', description: '左移 10px' },
      { key: '→', description: '右移 10px' },
    ],
  },
];

export default useKeyboardShortcuts;
