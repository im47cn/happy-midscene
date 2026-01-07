/**
 * Variable Store Tests
 * 测试变量存储功能
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type VariableChangeEvent,
  type VariableSnapshot,
  VariableStore,
  getVariableStore,
  resetVariableStore,
} from '../variableStore';

describe('VariableStore', () => {
  let store: VariableStore;

  beforeEach(() => {
    store = new VariableStore();
    resetVariableStore(); // Reset singleton before each test
  });

  describe('Basic Operations', () => {
    it('should get and set variables', () => {
      expect(store.get('count')).toBeUndefined();

      store.set('count', 5);
      expect(store.get('count')).toBe(5);
    });

    it('should initialize with variables', () => {
      const initializedStore = new VariableStore({
        username: 'testuser',
        count: 10,
      });

      expect(initializedStore.get('username')).toBe('testuser');
      expect(initializedStore.get('count')).toBe(10);
    });

    it('should check variable existence with has()', () => {
      expect(store.has('exists')).toBe(false);

      store.set('exists', 'value');
      expect(store.has('exists')).toBe(true);
    });

    it('should return correct size', () => {
      expect(store.size).toBe(0);

      store.set('a', 1);
      expect(store.size).toBe(1);

      store.set('b', 2);
      expect(store.size).toBe(2);

      store.delete('a');
      expect(store.size).toBe(1);
    });

    it('should get all variables', () => {
      store.set('name', 'Alice');
      store.set('age', 30);

      const all = store.getAll();

      expect(all).toEqual({
        name: 'Alice',
        age: 30,
      });
    });

    it('should clear all variables', () => {
      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);

      expect(store.size).toBe(3);

      store.clear();

      expect(store.size).toBe(0);
      expect(store.get('a')).toBeUndefined();
      expect(store.get('b')).toBeUndefined();
    });

    it('should delete variable', () => {
      store.set('temp', 'value');

      expect(store.has('temp')).toBe(true);

      const deleted = store.delete('temp');

      expect(deleted).toBe(true);
      expect(store.has('temp')).toBe(false);

      // Deleting non-existent variable returns false
      expect(store.delete('nonexistent')).toBe(false);
    });
  });

  describe('Variable Operations', () => {
    it('should increment numeric variable', () => {
      store.set('count', 5);

      const result = store.increment('count');

      expect(result).toBe(6);
      expect(store.get('count')).toBe(6);
    });

    it('should increment with custom amount', () => {
      store.set('count', 10);

      const result = store.increment('count', 5);

      expect(result).toBe(15);
      expect(store.get('count')).toBe(15);
    });

    it('should start from 0 when incrementing non-existent variable', () => {
      const result = store.increment('newCount');

      expect(result).toBe(1);
      expect(store.get('newCount')).toBe(1);
    });

    it('should start from custom amount when incrementing non-existent', () => {
      const result = store.increment('newCount', 10);

      expect(result).toBe(10);
      expect(store.get('newCount')).toBe(10);
    });

    it('should handle increment on non-numeric value', () => {
      store.set('count', 'not a number');

      const result = store.increment('count', 5);

      // Should replace with amount
      expect(result).toBe(5);
      expect(store.get('count')).toBe(5);
    });

    it('should extract variable value', () => {
      store.extract('balance', '¥100.00');

      expect(store.get('balance')).toBe('¥100.00');
    });

    it('should support different value types', () => {
      store.set('string', 'text');
      store.set('number', 42);
      store.set('boolean', true);
      store.set('object', { key: 'value' });
      store.set('array', [1, 2, 3]);
      store.set('null', null);

      expect(store.get('string')).toBe('text');
      expect(store.get('number')).toBe(42);
      expect(store.get('boolean')).toBe(true);
      expect(store.get('object')).toEqual({ key: 'value' });
      expect(store.get('array')).toEqual([1, 2, 3]);
      expect(store.get('null')).toBe(null);
    });
  });

  describe('Variable Replacement', () => {
    it('should replace variables in text', () => {
      store.set('name', 'Alice');
      store.set('age', 30);

      const result = store.replaceVariables(
        'Hello ${name}, you are ${age} years old',
      );

      expect(result).toBe('Hello Alice, you are 30 years old');
    });

    it('should keep placeholder when variable not found', () => {
      const result = store.replaceVariables('Value: ${nonexistent}');

      expect(result).toBe('Value: ${nonexistent}');
    });

    it('should handle multiple replacements of same variable', () => {
      store.set('name', 'Bob');

      const result = store.replaceVariables('${name} says hello to ${name}');

      expect(result).toBe('Bob says hello to Bob');
    });

    it('should handle empty string', () => {
      const result = store.replaceVariables('');

      expect(result).toBe('');
    });

    it('should convert numeric values to string', () => {
      store.set('count', 42);

      const result = store.replaceVariables('Count: ${count}');

      expect(result).toBe('Count: 42');
    });

    it('should handle variable with underscore', () => {
      store.set('user_name', 'alice');

      const result = store.replaceVariables('User: ${user_name}');

      expect(result).toBe('User: alice');
    });
  });

  describe('Snapshots', () => {
    it('should create snapshot', () => {
      store.set('a', 1);
      store.set('b', 2);

      const snapshot = store.createSnapshot();

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.variables).toEqual({
        a: 1,
        b: 2,
      });
    });

    it('should create multiple snapshots', () => {
      // Use store with auto-snapshots disabled to test manual snapshot creation
      const manualStore = new VariableStore({}, { enableSnapshots: false });

      manualStore.set('x', 1);
      manualStore.createSnapshot();

      manualStore.set('x', 2);
      manualStore.createSnapshot();

      manualStore.set('x', 3);
      manualStore.createSnapshot();

      const snapshots = manualStore.getSnapshots();

      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].variables.x).toBe(1);
      expect(snapshots[1].variables.x).toBe(2);
      expect(snapshots[2].variables.x).toBe(3);
    });

    it('should limit snapshots to maxSnapshots', () => {
      const limitedStore = new VariableStore({}, { maxSnapshots: 3 });

      for (let i = 1; i <= 5; i++) {
        limitedStore.set('value', i);
        limitedStore.createSnapshot();
      }

      const snapshots = limitedStore.getSnapshots();

      // Should only keep last 3 snapshots
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].variables.value).toBe(3);
      expect(snapshots[1].variables.value).toBe(4);
      expect(snapshots[2].variables.value).toBe(5);
    });

    it('should restore from snapshot', () => {
      store.set('name', 'Alice');
      store.set('age', 30);

      const snapshot = store.createSnapshot();

      // Modify values
      store.set('name', 'Bob');
      store.set('age', 25);
      store.set('city', 'Beijing');

      // Restore
      store.restoreSnapshot(snapshot);

      expect(store.get('name')).toBe('Alice');
      expect(store.get('age')).toBe(30);
      expect(store.get('city')).toBeUndefined();
    });

    it('should return copy of snapshots from getSnapshots', () => {
      store.createSnapshot();

      const snapshots1 = store.getSnapshots();
      const snapshots2 = store.getSnapshots();

      // Should be different arrays
      expect(snapshots1).not.toBe(snapshots2);

      // But same content
      expect(snapshots1).toEqual(snapshots2);
    });

    it('should auto-create snapshot when enabled', () => {
      const autoStore = new VariableStore({}, { enableSnapshots: true });

      autoStore.set('value', 1);

      expect(autoStore.getSnapshots()).toHaveLength(1);
      expect(autoStore.getSnapshots()[0].variables.value).toBe(1);
    });

    it('should not auto-create snapshot when disabled', () => {
      const noAutoStore = new VariableStore({}, { enableSnapshots: false });

      noAutoStore.set('value', 1);

      expect(noAutoStore.getSnapshots()).toHaveLength(0);
    });
  });

  describe('Change Events', () => {
    it('should not emit events when disabled', () => {
      const noEventsStore = new VariableStore(
        {},
        { enableChangeEvents: false },
      );
      const listener = vi.fn();

      noEventsStore.onChange(listener);
      noEventsStore.set('value', 1);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should emit set event', () => {
      const eventStore = new VariableStore({}, { enableChangeEvents: true });
      const listener = vi.fn();

      eventStore.onChange(listener);
      eventStore.set('count', 5);

      expect(listener).toHaveBeenCalledTimes(1);

      const event: VariableChangeEvent = listener.mock.calls[0][0];

      expect(event.name).toBe('count');
      expect(event.oldValue).toBeUndefined();
      expect(event.newValue).toBe(5);
      expect(event.operation).toBe('set');
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('should emit increment event', () => {
      const eventStore = new VariableStore(
        { count: 5 },
        { enableChangeEvents: true },
      );
      const listener = vi.fn();

      eventStore.onChange(listener);
      eventStore.increment('count', 2);

      expect(listener).toHaveBeenCalledTimes(1);

      const event: VariableChangeEvent = listener.mock.calls[0][0];

      expect(event.name).toBe('count');
      expect(event.oldValue).toBe(5);
      expect(event.newValue).toBe(7);
      expect(event.operation).toBe('increment');
    });

    it('should emit extract event', () => {
      const eventStore = new VariableStore({}, { enableChangeEvents: true });
      const listener = vi.fn();

      eventStore.onChange(listener);
      eventStore.extract('balance', '¥100.00');

      expect(listener).toHaveBeenCalledTimes(1);

      const event: VariableChangeEvent = listener.mock.calls[0][0];

      expect(event.name).toBe('balance');
      expect(event.oldValue).toBeUndefined();
      expect(event.newValue).toBe('¥100.00');
      expect(event.operation).toBe('extract');
    });

    it('should emit delete event', () => {
      const eventStore = new VariableStore(
        { temp: 'value' },
        { enableChangeEvents: true },
      );
      const listener = vi.fn();

      eventStore.onChange(listener);
      eventStore.delete('temp');

      expect(listener).toHaveBeenCalledTimes(1);

      const event: VariableChangeEvent = listener.mock.calls[0][0];

      expect(event.name).toBe('temp');
      expect(event.oldValue).toBe('value');
      expect(event.newValue).toBeUndefined();
      expect(event.operation).toBe('delete');
    });

    it('should support multiple listeners', () => {
      const eventStore = new VariableStore({}, { enableChangeEvents: true });
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventStore.onChange(listener1);
      eventStore.onChange(listener2);

      eventStore.set('value', 1);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe listener', () => {
      const eventStore = new VariableStore({}, { enableChangeEvents: true });
      const listener = vi.fn();

      const unsubscribe = eventStore.onChange(listener);

      eventStore.set('value', 1);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      eventStore.set('value', 2);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should handle listener errors gracefully', () => {
      const eventStore = new VariableStore({}, { enableChangeEvents: true });
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      eventStore.onChange(errorListener);
      eventStore.onChange(goodListener);

      // Should not throw, good listener should still be called
      expect(() => eventStore.set('value', 1)).not.toThrow();

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(goodListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Execution Context Conversion', () => {
    it('should convert to execution context', () => {
      store.set('var1', 'value1');
      store.set('var2', 42);

      const context = store.toExecutionContext();

      // Should create a copy, not a reference, for isolation
      expect(context.variables).not.toBe(store.variables);
      expect(context.variables).toEqual(store.variables);
      expect(context.loopStack).toEqual([]);
      expect(context.pathHistory).toEqual([]);
      expect(context.errorStack).toEqual([]);
      expect(context.currentDepth).toBe(0);
    });

    it('should restore from execution context', () => {
      const mockContext = {
        variables: new Map([
          ['a', 1],
          ['b', 2],
        ]),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      store.fromExecutionContext(mockContext);

      expect(store.get('a')).toBe(1);
      expect(store.get('b')).toBe(2);
    });

    it('should support round-trip conversion', () => {
      store.set('x', 100);
      store.set('y', 'test');

      const context = store.toExecutionContext();

      // Clear and restore
      store.clear();
      expect(store.get('x')).toBeUndefined();

      store.fromExecutionContext(context);

      expect(store.get('x')).toBe(100);
      expect(store.get('y')).toBe('test');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getVariableStore', () => {
      const store1 = getVariableStore();
      const store2 = getVariableStore();

      expect(store1).toBe(store2);
    });

    it('should initialize with values on first call', () => {
      const store1 = getVariableStore({ initialized: true });

      expect(store1.get('initialized')).toBe(true);

      // Subsequent calls don't reinitialize
      const store2 = getVariableStore({ initialized: false });

      expect(store2).toBe(store1);
      expect(store2.get('initialized')).toBe(true); // Still true from first call
    });

    it('should reset singleton', () => {
      const store1 = getVariableStore({ temp: 'value' });

      expect(store1.get('temp')).toBe('value');

      resetVariableStore();

      const store2 = getVariableStore();

      expect(store2).not.toBe(store1);
      expect(store2.get('temp')).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined values', () => {
      store.set('undefined', undefined);

      expect(store.has('undefined')).toBe(true);
      expect(store.get('undefined')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      store.set('name', 'Alice');
      store.set('name', 'Bob');

      expect(store.get('name')).toBe('Bob');
    });

    it('should handle special characters in variable names', () => {
      store.set('user-name', 'value');
      store.set('user_name', 'value');
      store.set('userName', 'value');

      expect(store.get('user-name')).toBe('value');
      expect(store.get('user_name')).toBe('value');
      expect(store.get('userName')).toBe('value');
    });

    it('should handle increment with negative amount', () => {
      store.set('count', 10);

      const result = store.increment('count', -3);

      expect(result).toBe(7);
    });

    it('should handle clearing empty store', () => {
      expect(() => store.clear()).not.toThrow();
      expect(store.size).toBe(0);
    });

    it('should handle deleting non-existent variable', () => {
      expect(() => store.delete('nonexistent')).not.toThrow();
    });

    it('should restore empty snapshot', () => {
      store.set('value', 1);
      const emptySnapshot: VariableSnapshot = {
        timestamp: Date.now(),
        variables: {},
      };

      store.restoreSnapshot(emptySnapshot);

      expect(store.size).toBe(0);
    });

    it('should handle large number of snapshots', () => {
      const limitedStore = new VariableStore({}, { maxSnapshots: 1000 });

      for (let i = 0; i < 2000; i++) {
        limitedStore.set('value', i);
        limitedStore.createSnapshot();
      }

      expect(limitedStore.getSnapshots().length).toBe(1000);
    });
  });

  describe('Variable Types and Conversion', () => {
    it('should preserve object references', () => {
      const obj = { nested: { value: 42 } };
      store.set('obj', obj);

      const retrieved = store.get('obj');

      expect(retrieved).toBe(obj);
      expect(retrieved.nested.value).toBe(42);
    });

    it('should preserve array references', () => {
      const arr = [1, 2, 3];
      store.set('arr', arr);

      const retrieved = store.get('arr');

      expect(retrieved).toBe(arr);
      expect(retrieved).toEqual([1, 2, 3]);
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-01');
      store.set('createdAt', date);

      expect(store.get('createdAt')).toBe(date);
    });

    it('should convert variables to string in replacement', () => {
      store.set('obj', { key: 'value' });
      store.set('null', null);

      const result1 = store.replaceVariables('Object: ${obj}');
      const result2 = store.replaceVariables('Null: ${null}');

      expect(result1).toBe('Object: [object Object]');
      expect(result2).toBe('Null: null');
    });
  });
});
