/**
 * Operational Transform Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OperationalTransform } from '../ot';
import type { EditorOperation } from '../../../types/collaboration';

describe('OperationalTransform', () => {
  let ot: OperationalTransform;

  beforeEach(() => {
    ot = new OperationalTransform();
  });

  describe('apply', () => {
    it('should apply insert operation', async () => {
      const result = await ot.apply('Hello', {
        type: 'insert',
        position: 5,
        content: ' World',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      });

      expect(result).toBe('Hello World');
    });

    it('should apply insert at beginning', async () => {
      const result = await ot.apply('World', {
        type: 'insert',
        position: 0,
        content: 'Hello ',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      });

      expect(result).toBe('Hello World');
    });

    it('should apply delete operation', async () => {
      const result = await ot.apply('Hello World', {
        type: 'delete',
        position: 5,
        length: 6,
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      });

      expect(result).toBe('Hello');
    });

    it('should apply retain operation', async () => {
      const result = await ot.apply('Hello World', {
        type: 'retain',
        position: 0,
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      });

      expect(result).toBe('Hello World');
    });

    it('should handle out of bounds position', async () => {
      const result = await ot.apply('Hello', {
        type: 'insert',
        position: 100,
        content: ' World',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      });

      expect(result).toBe('Hello World');
    });

    it('should handle negative position', async () => {
      const result = await ot.apply('Hello', {
        type: 'insert',
        position: -5,
        content: 'World ',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      });

      expect(result).toBe('World Hello');
    });
  });

  describe('transformOps', () => {
    it('should transform two concurrent inserts', () => {
      const op1: EditorOperation = {
        type: 'insert',
        position: 5,
        content: ' A',
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      const op2: EditorOperation = {
        type: 'insert',
        position: 7,
        content: ' B',
        userId: 'user2',
        timestamp: 100,
        version: 1,
      };

      const [transformed1, transformed2] = ot.transformOps(op1, op2);

      // op2 happens after op1's position, so op2 should be shifted
      expect(transformed2.position).toBe(7 + 2); // Shifted by op1's content length (" A" = 2 chars)
    });

    it('should transform insert against delete', () => {
      const op1: EditorOperation = {
        type: 'insert',
        position: 5,
        content: 'A',
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      const op2: EditorOperation = {
        type: 'delete',
        position: 3,
        length: 4,
        userId: 'user2',
        timestamp: 100,
        version: 1,
      };

      const [transformed1] = ot.transformOps(op1, op2);

      // Insert position should be adjusted for prior delete
      expect(transformed1.position).toBeLessThanOrEqual(op1.position);
    });

    it('should transform two concurrent deletes', () => {
      const op1: EditorOperation = {
        type: 'delete',
        position: 5,
        length: 3,
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      const op2: EditorOperation = {
        type: 'delete',
        position: 8,
        length: 2,
        userId: 'user2',
        timestamp: 100,
        version: 1,
      };

      const [transformed1, transformed2] = ot.transformOps(op1, op2);

      // op2's position should shift due to op1's delete
      expect(transformed2.position).toBeLessThan(op2.position);
    });
  });

  describe('compose', () => {
    it('should compose two operations', () => {
      const op1: EditorOperation = {
        type: 'insert',
        position: 5,
        content: ' World',
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      const op2: EditorOperation = {
        type: 'insert',
        position: 11,
        content: '!',
        userId: 'user1',
        timestamp: 101,
        version: 2,
      };

      const composed = ot.compose(op1, op2);

      expect(composed).toHaveLength(2);
      expect(composed[0]).toEqual(op1);
      expect(composed[1]).toEqual(op2);
    });
  });

  describe('invert', () => {
    it('should invert insert to delete', () => {
      const op: EditorOperation = {
        type: 'insert',
        position: 5,
        content: ' World',
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      const inverted = ot.invert(op, 'Hello World');

      expect(inverted.type).toBe('delete');
      expect(inverted.position).toBe(5);
      expect(inverted.length).toBe(6);
    });

    it('should invert delete to insert', () => {
      const op: EditorOperation = {
        type: 'delete',
        position: 5,
        length: 6,
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      const inverted = ot.invert(op, 'Hello World');

      expect(inverted.type).toBe('insert');
      expect(inverted.position).toBe(5);
      expect(inverted.content).toBe(' World');
    });

    it('should keep retain as is', () => {
      const op: EditorOperation = {
        type: 'retain',
        position: 0,
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      const inverted = ot.invert(op, 'Hello World');

      expect(inverted.type).toBe('retain');
    });
  });

  describe('validate', () => {
    it('should validate correct operation', () => {
      const op: EditorOperation = {
        type: 'insert',
        position: 5,
        content: 'text',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      const valid = ot.validate(op, 10);

      expect(valid).toBe(true);
    });

    it('should reject operation with negative position', () => {
      const op: EditorOperation = {
        type: 'insert',
        position: -1,
        content: 'text',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      const valid = ot.validate(op, 10);

      expect(valid).toBe(false);
    });

    it('should reject operation with position beyond document', () => {
      const op: EditorOperation = {
        type: 'insert',
        position: 20,
        content: 'text',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      const valid = ot.validate(op, 10);

      expect(valid).toBe(false);
    });

    it('should reject delete beyond document bounds', () => {
      const op: EditorOperation = {
        type: 'delete',
        position: 8,
        length: 5,
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      const valid = ot.validate(op, 10);

      expect(valid).toBe(false);
    });
  });

  describe('opLength', () => {
    it('should return length of insert operation', () => {
      const op: EditorOperation = {
        type: 'insert',
        position: 0,
        content: 'hello',
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      expect(ot.opLength(op)).toBe(5);
    });

    it('should return negative length for delete', () => {
      const op: EditorOperation = {
        type: 'delete',
        position: 0,
        length: 5,
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      expect(ot.opLength(op)).toBe(-5);
    });

    it('should return 0 for retain', () => {
      const op: EditorOperation = {
        type: 'retain',
        position: 0,
        userId: 'user1',
        timestamp: Date.now(),
        version: 1,
      };

      expect(ot.opLength(op)).toBe(0);
    });
  });

  describe('clone', () => {
    it('should clone operation', () => {
      const op: EditorOperation = {
        type: 'insert',
        position: 5,
        content: 'text',
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      const cloned = ot.clone(op);

      expect(cloned).toEqual(op);
      expect(cloned).not.toBe(op);
    });
  });

  describe('equals', () => {
    it('should return true for equal operations', () => {
      const op1: EditorOperation = {
        type: 'insert',
        position: 5,
        content: 'text',
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      const op2: EditorOperation = {
        type: 'insert',
        position: 5,
        content: 'text',
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      expect(ot.equals(op1, op2)).toBe(true);
    });

    it('should return false for different operations', () => {
      const op1: EditorOperation = {
        type: 'insert',
        position: 5,
        content: 'text',
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      const op2: EditorOperation = {
        type: 'insert',
        position: 6,
        content: 'text',
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      expect(ot.equals(op1, op2)).toBe(false);
    });
  });

  describe('transformPath', () => {
    it('should transform path of operations', () => {
      const op1: EditorOperation = {
        type: 'insert',
        position: 5,
        content: 'A',
        userId: 'user1',
        timestamp: 100,
        version: 1,
      };

      const op2: EditorOperation = {
        type: 'insert',
        position: 5,
        content: 'B',
        userId: 'user2',
        timestamp: 100,
        version: 1,
      };

      const path: EditorOperation[] = [op1, op2];
      const against: EditorOperation = {
        type: 'insert',
        position: 3,
        content: 'X',
        userId: 'user3',
        timestamp: 99,
        version: 1,
      };

      const transformed = ot.transformPath(path, against);

      expect(transformed).toHaveLength(2);
      // Both positions should be shifted by the against operation
      expect(transformed[0].position).toBeGreaterThan(op1.position);
      expect(transformed[1].position).toBeGreaterThan(op2.position);
    });
  });
});
