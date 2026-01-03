/**
 * DataChannel Unit Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataChannel, createDataChannel } from '../dataChannel';

describe('DataChannel', () => {
  let channel: DataChannel;

  beforeEach(() => {
    channel = createDataChannel();
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      channel.set('key1', 'value1');
      expect(channel.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      expect(channel.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      channel.set('key1', 'value1');
      expect(channel.has('key1')).toBe(true);
      expect(channel.has('key2')).toBe(false);
    });

    it('should delete keys', () => {
      channel.set('key1', 'value1');
      expect(channel.delete('key1')).toBe(true);
      expect(channel.has('key1')).toBe(false);
      expect(channel.delete('key1')).toBe(false);
    });

    it('should get all data', () => {
      channel.set('key1', 'value1');
      channel.set('key2', 'value2');
      expect(channel.getAll()).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });

    it('should set multiple values', () => {
      channel.setMultiple({ key1: 'value1', key2: 'value2' });
      expect(channel.get('key1')).toBe('value1');
      expect(channel.get('key2')).toBe('value2');
    });

    it('should clear all data', () => {
      channel.set('key1', 'value1');
      channel.set('key2', 'value2');
      channel.clear();
      expect(channel.getAll()).toEqual({});
    });
  });

  describe('event listeners', () => {
    it('should notify listeners on set', () => {
      const listener = vi.fn();
      channel.addEventListener(listener);

      channel.set('key1', 'value1', 'test-source');

      expect(listener).toHaveBeenCalledWith({
        key: 'key1',
        value: 'value1',
        previousValue: undefined,
        source: 'test-source',
        timestamp: expect.any(Number),
      });
    });

    it('should notify listeners with previous value', () => {
      const listener = vi.fn();
      channel.set('key1', 'old-value');
      channel.addEventListener(listener);

      channel.set('key1', 'new-value');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'key1',
          value: 'new-value',
          previousValue: 'old-value',
        }),
      );
    });

    it('should remove listeners', () => {
      const listener = vi.fn();
      channel.addEventListener(listener);
      channel.removeEventListener(listener);

      channel.set('key1', 'value1');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify key subscribers', () => {
      const subscriber = vi.fn();
      channel.subscribe('key1', subscriber);

      channel.set('key1', 'value1');

      expect(subscriber).toHaveBeenCalledWith('value1');
    });

    it('should unsubscribe from key', () => {
      const subscriber = vi.fn();
      const unsubscribe = channel.subscribe('key1', subscriber);

      unsubscribe();
      channel.set('key1', 'value1');

      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('should track change history', () => {
      channel.set('key1', 'value1');
      channel.set('key2', 'value2');

      const history = channel.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].key).toBe('key1');
      expect(history[1].key).toBe('key2');
    });

    it('should limit history size', () => {
      const smallChannel = new DataChannel(3);

      for (let i = 0; i < 5; i++) {
        smallChannel.set(`key${i}`, `value${i}`);
      }

      const history = smallChannel.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].key).toBe('key2');
    });
  });

  describe('interpolation', () => {
    it('should interpolate simple variables', () => {
      channel.set('name', 'World');
      expect(channel.interpolate('Hello ${name}!')).toBe('Hello World!');
    });

    it('should keep unresolved variables', () => {
      expect(channel.interpolate('Hello ${name}!')).toBe('Hello ${name}!');
    });

    it('should interpolate multiple variables', () => {
      channel.set('first', 'John');
      channel.set('last', 'Doe');
      expect(channel.interpolate('${first} ${last}')).toBe('John Doe');
    });

    it('should apply trim transformer', () => {
      channel.set('name', '  spaced  ');
      expect(channel.interpolate('${name | trim}')).toBe('spaced');
    });

    it('should apply number transformer', () => {
      channel.set('value', '42');
      const result = channel.interpolate('${value | number}');
      expect(result).toBe('42');
    });

    it('should apply uppercase transformer', () => {
      channel.set('name', 'hello');
      expect(channel.interpolate('${name | uppercase}')).toBe('HELLO');
    });

    it('should apply lowercase transformer', () => {
      channel.set('name', 'HELLO');
      expect(channel.interpolate('${name | lowercase}')).toBe('hello');
    });
  });

  describe('transform', () => {
    it('should transform with trim', () => {
      expect(channel.transform('  test  ', 'trim')).toBe('test');
    });

    it('should transform with number', () => {
      expect(channel.transform('123', 'number')).toBe(123);
    });

    it('should transform with uppercase', () => {
      expect(channel.transform('hello', 'uppercase')).toBe('HELLO');
    });

    it('should transform with lowercase', () => {
      expect(channel.transform('HELLO', 'lowercase')).toBe('hello');
    });
  });

  describe('parseVariableRef', () => {
    it('should parse simple variable reference', () => {
      const ref = channel.parseVariableRef('${name}');
      expect(ref).toEqual({ key: 'name' });
    });

    it('should parse variable with transformer', () => {
      const ref = channel.parseVariableRef('${name | trim}');
      expect(ref).toEqual({ key: 'name', transformer: 'trim' });
    });

    it('should parse variable with transformer and arg', () => {
      const ref = channel.parseVariableRef("${date | format:'YYYY-MM-DD'}");
      expect(ref).toEqual({
        key: 'date',
        transformer: 'format',
        transformerArg: 'YYYY-MM-DD',
      });
    });

    it('should return null for invalid reference', () => {
      expect(channel.parseVariableRef('not a reference')).toBeNull();
    });
  });

  describe('evaluate', () => {
    it('should evaluate simple expressions', () => {
      channel.set('a', 10);
      channel.set('b', 5);
      expect(channel.evaluate('${a} + ${b}')).toBe(15);
    });

    it('should return string for non-numeric expressions', () => {
      channel.set('name', 'World');
      expect(channel.evaluate('Hello ${name}')).toBe('Hello World');
    });
  });

  describe('clone', () => {
    it('should clone data channel', () => {
      channel.set('key1', 'value1');
      channel.set('key2', 'value2');

      const cloned = channel.clone();

      expect(cloned.get('key1')).toBe('value1');
      expect(cloned.get('key2')).toBe('value2');

      // Verify independence
      cloned.set('key1', 'modified');
      expect(channel.get('key1')).toBe('value1');
    });
  });
});
