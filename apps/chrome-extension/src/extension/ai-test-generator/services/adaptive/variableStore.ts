/**
 * Variable Store
 * 变量存储 - 管理测试执行过程中的变量
 */

import type { ExecutionContext as AdaptiveExecutionContext } from '../../types/adaptive';

/**
 * 变量快照
 */
export interface VariableSnapshot {
  timestamp: number;
  variables: Record<string, any>;
}

/**
 * 变量变更事件
 */
export interface VariableChangeEvent {
  name: string;
  oldValue: any;
  newValue: any;
  operation: 'set' | 'increment' | 'extract' | 'delete';
  timestamp: number;
}

/**
 * 变量存储选项
 */
export interface VariableStoreOptions {
  enableSnapshots?: boolean;
  maxSnapshots?: number;
  enableChangeEvents?: boolean;
}

/**
 * 变量存储类
 */
export class VariableStore {
  private variables: Map<string, any> = new Map();
  private snapshots: VariableSnapshot[] = [];
  private changeListeners: Set<(event: VariableChangeEvent) => void> = new Set();
  private options: VariableStoreOptions;

  constructor(
    initialVariables: Record<string, any> = {},
    options: VariableStoreOptions = {}
  ) {
    this.options = {
      enableSnapshots: true,
      maxSnapshots: 100,
      enableChangeEvents: false,
      ...options,
    };

    // Initialize with provided variables
    for (const [key, value] of Object.entries(initialVariables)) {
      this.variables.set(key, value);
    }
  }

  /**
   * 获取变量值
   */
  get(name: string): any {
    return this.variables.get(name);
  }

  /**
   * 设置变量值
   */
  set(name: string, value: any): void {
    const oldValue = this.variables.get(name);
    this.variables.set(name, value);

    this.emitChange({
      name,
      oldValue,
      newValue: value,
      operation: 'set',
      timestamp: Date.now(),
    });

    this.createSnapshotIfNeeded();
  }

  /**
   * 增加变量值
   */
  increment(name: string, amount = 1): number {
    const oldValue = this.variables.get(name) ?? 0;
    const newValue = typeof oldValue === 'number' ? oldValue + amount : amount;
    this.variables.set(name, newValue);

    this.emitChange({
      name,
      oldValue,
      newValue,
      operation: 'increment',
      timestamp: Date.now(),
    });

    this.createSnapshotIfNeeded();
    return newValue;
  }

  /**
   * 从页面提取变量值
   */
  extract(name: string, value: any): void {
    const oldValue = this.variables.get(name);
    this.variables.set(name, value);

    this.emitChange({
      name,
      oldValue,
      newValue: value,
      operation: 'extract',
      timestamp: Date.now(),
    });

    this.createSnapshotIfNeeded();
  }

  /**
   * 删除变量
   */
  delete(name: string): boolean {
    const oldValue = this.variables.get(name);
    const deleted = this.variables.delete(name);

    if (deleted) {
      this.emitChange({
        name,
        oldValue,
        newValue: undefined,
        operation: 'delete',
        timestamp: Date.now(),
      });

      this.createSnapshotIfNeeded();
    }

    return deleted;
  }

  /**
   * 检查变量是否存在
   */
  has(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * 获取所有变量
   */
  getAll(): Record<string, any> {
    return Object.fromEntries(this.variables.entries());
  }

  /**
   * 清空所有变量
   */
  clear(): void {
    const oldVariables = this.getAll();
    this.variables.clear();

    for (const [name, oldValue] of Object.entries(oldVariables)) {
      this.emitChange({
        name,
        oldValue,
        newValue: undefined,
        operation: 'delete',
        timestamp: Date.now(),
      });
    }

    this.createSnapshotIfNeeded();
  }

  /**
   * 获取变量数量
   */
  get size(): number {
    return this.variables.size;
  }

  /**
   * 创建快照
   */
  createSnapshot(): VariableSnapshot {
    const snapshot: VariableSnapshot = {
      timestamp: Date.now(),
      variables: this.getAll(),
    };

    this.snapshots.push(snapshot);

    // Limit snapshots
    if (this.options.maxSnapshots && this.snapshots.length > this.options.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * 获取所有快照
   */
  getSnapshots(): VariableSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * 恢复快照
   */
  restoreSnapshot(snapshot: VariableSnapshot): void {
    this.variables.clear();
    for (const [key, value] of Object.entries(snapshot.variables)) {
      this.variables.set(key, value);
    }
  }

  /**
   * 监听变量变更
   */
  onChange(listener: (event: VariableChangeEvent) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /**
   * 转换为执行上下文
   */
  toExecutionContext(): AdaptiveExecutionContext {
    return {
      variables: this.variables,
      loopStack: [],
      pathHistory: [],
      errorStack: [],
      currentDepth: 0,
    };
  }

  /**
   * 从执行上下文恢复
   */
  fromExecutionContext(context: AdaptiveExecutionContext): void {
    this.variables = context.variables;
  }

  /**
   * 替换字符串中的变量引用 ${varName}
   */
  replaceVariables(text: string): string {
    return text.replace(/\$\{(\w+)\}/g, (match, varName) => {
      const value = this.get(varName);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * 创建快照（如果启用）
   */
  private createSnapshotIfNeeded(): void {
    if (this.options.enableSnapshots) {
      this.createSnapshot();
    }
  }

  /**
   * 发出变更事件
   */
  private emitChange(event: VariableChangeEvent): void {
    if (this.options.enableChangeEvents) {
      for (const listener of this.changeListeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('[VariableStore] Error in change listener:', error);
        }
      }
    }
  }
}

/**
 * 默认变量存储实例
 */
let defaultStore: VariableStore | null = null;

/**
 * 获取默认变量存储
 */
export function getVariableStore(initialVariables?: Record<string, any>): VariableStore {
  if (!defaultStore) {
    defaultStore = new VariableStore(initialVariables);
  }
  return defaultStore;
}

/**
 * 重置默认变量存储
 */
export function resetVariableStore(): void {
  defaultStore = null;
}
