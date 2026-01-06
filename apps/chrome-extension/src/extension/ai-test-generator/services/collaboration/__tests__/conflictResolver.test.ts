/**
 * Conflict Resolver Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConflictResolver } from '../conflictResolver';
import type {
  ConflictResolution,
  ConflictType,
  EditorOperation,
} from '../conflictResolver';

describe('ConflictResolver', () => {
  let cr: ConflictResolver;

  beforeEach(() => {
    cr = new ConflictResolver();
  });

  afterEach(() => {
    cr.clearConflicts();
  });

  const createOp = (
    type: EditorOperation['type'],
    position: number,
    userId: string,
    extra: Partial<EditorOperation> = {},
  ): EditorOperation => ({
    type,
    position,
    userId,
    timestamp: Date.now(),
    version: 1,
    ...extra,
  });

  describe('resolve', () => {
    it('should return resolved when no conflicts', async () => {
      const op1 = createOp('insert', 0, 'user1', { content: 'Hello' });
      const op2 = createOp('insert', 10, 'user2', { content: 'World' });

      const result = await cr.resolve(op1, op2);

      expect(result.resolved).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect concurrent edit at same position', async () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      const result = await cr.resolve(op1, op2);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('concurrent_edit');
    });

    it('should auto-resolve concurrent inserts', async () => {
      const op1 = createOp('insert', 5, 'user1', {
        content: 'A',
        timestamp: 100,
      });
      const op2 = createOp('insert', 5, 'user2', {
        content: 'B',
        timestamp: 200,
      });

      const result = await cr.resolve(op1, op2);

      // Both inserts at same position should be auto-resolved by timestamp ordering
      expect(result.resolved).toBe(true);
    });

    it('should not conflict for same user operations', async () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user1', { content: 'B' });

      const result = await cr.resolve(op1, op2);

      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect delete-edit conflict', async () => {
      const op1 = createOp('delete', 5, 'user1', { length: 3 });
      const op2 = createOp('insert', 5, 'user2', { content: 'X' });

      const result = await cr.resolve(op1, op2);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('delete_edit');
    });

    it('should detect edit-delete conflict', async () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'X' });
      const op2 = createOp('delete', 5, 'user2', { length: 3 });

      const result = await cr.resolve(op1, op2);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('edit_delete');
    });
  });

  describe('detectConflicts', () => {
    it('should find no conflicts for non-overlapping operations', () => {
      const op1 = createOp('insert', 0, 'user1', { content: 'A' });
      const op2 = createOp('insert', 10, 'user2', { content: 'B' });

      const conflicts = cr.detectConflicts([op1, op2]);

      expect(conflicts).toHaveLength(0);
    });

    it('should detect conflict for same position different users', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      const conflicts = cr.detectConflicts([op1, op2]);

      expect(conflicts).toHaveLength(1);
    });

    it('should detect overlapping deletes', () => {
      const op1 = createOp('delete', 5, 'user1', { length: 10 });
      const op2 = createOp('delete', 10, 'user2', { length: 5 });

      const conflicts = cr.detectConflicts([op1, op2]);

      expect(conflicts).toHaveLength(1);
    });

    it('should detect insert within delete range', () => {
      const op1 = createOp('delete', 5, 'user1', { length: 10 });
      const op2 = createOp('insert', 8, 'user2', { content: 'X' });

      const conflicts = cr.detectConflicts([op1, op2]);

      expect(conflicts).toHaveLength(1);
    });

    it('should handle multiple operations', () => {
      const ops = [
        createOp('insert', 0, 'user1', { content: 'A' }),
        createOp('insert', 5, 'user2', { content: 'B' }),
        createOp('insert', 5, 'user3', { content: 'C' }),
      ];

      const conflicts = cr.detectConflicts(ops);

      // user2 and user3 have conflict at position 5
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('manualResolve', () => {
    it('should accept theirs operation', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      // First create a conflict
      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      const result = cr.manualResolve(conflict.id, 'accept_theirs');

      expect(result).toBeDefined();
      expect(result?.userId).toBe('user1');
    });

    it('should accept yours operation', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      const result = cr.manualResolve(conflict.id, 'accept_yours');

      expect(result).toBeDefined();
      expect(result?.userId).toBe('user2');
    });

    it('should merge two inserts', () => {
      const op1 = createOp('insert', 5, 'user1', {
        content: 'A',
        timestamp: 100,
      });
      const op2 = createOp('insert', 5, 'user2', {
        content: 'B',
        timestamp: 200,
      });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      const result = cr.manualResolve(conflict.id, 'merge');

      expect(result).toBeDefined();
      expect(result?.type).toBe('insert');
    });

    it('should handle manual resolution with custom content', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      const result = cr.manualResolve(conflict.id, 'manual', 'Custom');

      expect(result).toBeDefined();
      expect(result?.content).toBe('Custom');
    });

    it('should return null for non-existent conflict', () => {
      const result = cr.manualResolve('non-existent', 'accept_theirs');
      expect(result).toBeNull();
    });

    it('should return null for manual without custom content', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      const result = cr.manualResolve(conflict.id, 'manual');

      expect(result).toBeNull();
    });

    it('should mark conflict as resolved', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      expect(conflict.resolved).toBe(false);

      cr.manualResolve(conflict.id, 'accept_theirs');

      const resolved = cr.getConflict(conflict.id);
      expect(resolved?.resolved).toBe(true);
    });

    it('should set resolution type', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      cr.manualResolve(conflict.id, 'accept_yours');

      const resolved = cr.getConflict(conflict.id);
      expect(resolved?.resolution).toBe('accept_yours');
    });
  });

  describe('getUnresolvedConflicts', () => {
    it('should return empty array initially', () => {
      const conflicts = cr.getUnresolvedConflicts();
      expect(conflicts).toEqual([]);
    });

    it('should return detected conflicts', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      cr.detectConflicts([op1, op2]);

      const conflicts = cr.getUnresolvedConflicts();
      expect(conflicts).toHaveLength(1);
    });

    it('should exclude resolved conflicts', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      cr.manualResolve(conflict.id, 'accept_theirs');

      const conflicts = cr.getUnresolvedConflicts();
      expect(conflicts).toHaveLength(0);
    });

    it('should return multiple conflicts', () => {
      const ops = [
        createOp('insert', 5, 'user1', { content: 'A' }),
        createOp('insert', 5, 'user2', { content: 'B' }),
        createOp('insert', 10, 'user3', { content: 'C' }),
        createOp('insert', 10, 'user4', { content: 'D' }),
      ];

      cr.detectConflicts(ops);

      const conflicts = cr.getUnresolvedConflicts();
      expect(conflicts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getConflict', () => {
    it('should return conflict by ID', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      const found = cr.getConflict(conflict.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(conflict.id);
    });

    it('should return null for non-existent conflict', () => {
      const found = cr.getConflict('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('clearConflicts', () => {
    it('should clear all conflicts', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      cr.detectConflicts([op1, op2]);
      expect(cr.getConflictCount()).toBeGreaterThan(0);

      cr.clearConflicts();

      expect(cr.getConflictCount()).toBe(0);
    });

    it('should handle clearing empty conflicts', () => {
      expect(() => cr.clearConflicts()).not.toThrow();
    });
  });

  describe('getConflictCount', () => {
    it('should return 0 initially', () => {
      expect(cr.getConflictCount()).toBe(0);
    });

    it('should increment with each conflict', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      cr.detectConflicts([op1, op2]);

      expect(cr.getConflictCount()).toBe(1);
    });

    it('should count multiple conflicts', () => {
      const ops = [
        createOp('insert', 5, 'user1', { content: 'A' }),
        createOp('insert', 5, 'user2', { content: 'B' }),
        createOp('insert', 10, 'user3', { content: 'C' }),
        createOp('insert', 10, 'user4', { content: 'D' }),
      ];

      cr.detectConflicts(ops);

      expect(cr.getConflictCount()).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getExtendedConflict', () => {
    it('should return extended conflict with content previews', async () => {
      const baseContent = 'Hello World';
      const op1 = createOp('insert', 5, 'user1', { content: 'Beautiful' });
      const op2 = createOp('insert', 5, 'user2', { content: 'Amazing' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      const extended = await cr.getExtendedConflict(conflict.id, baseContent);

      expect(extended).toBeDefined();
      expect(extended?.baseContent).toBe(baseContent);
      expect(extended?.theirsContent).toBeDefined();
      expect(extended?.yoursContent).toBeDefined();
    });

    it('should return null for non-existent conflict', async () => {
      const extended = await cr.getExtendedConflict('non-existent', 'content');
      expect(extended).toBeNull();
    });

    it('should include merged content when merge possible', async () => {
      const baseContent = 'Hello World';
      const op1 = createOp('insert', 5, 'user1', {
        content: 'A',
        timestamp: 100,
      });
      const op2 = createOp('insert', 5, 'user2', {
        content: 'B',
        timestamp: 200,
      });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      const extended = await cr.getExtendedConflict(conflict.id, baseContent);

      expect(extended?.mergedContent).toBeDefined();
    });

    it('should apply insert operation correctly', async () => {
      const baseContent = 'Hello World';
      const op1 = createOp('insert', 6, 'user1', { content: 'Beautiful ' });
      // Create overlapping operation to trigger conflict
      const op2 = createOp('insert', 6, 'user2', { content: 'Amazing ' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      const extended = await cr.getExtendedConflict(conflict.id, baseContent);

      expect(extended?.theirsContent).toContain('Beautiful');
    });

    it('should apply delete operation correctly', async () => {
      const baseContent = 'Hello World';
      const op1 = createOp('delete', 5, 'user1', { length: 6 });
      // Create overlapping operation to trigger conflict (insert at delete position)
      const op2 = createOp('insert', 5, 'user2', { content: 'XXX' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      const extended = await cr.getExtendedConflict(conflict.id, baseContent);

      expect(extended?.theirsContent).toBe('Hello');
    });
  });

  describe('conflict types', () => {
    it('should create concurrent_edit type for same position inserts', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'A' });
      const op2 = createOp('insert', 5, 'user2', { content: 'B' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      expect(conflict.type).toBe('concurrent_edit');
    });

    it('should create delete_edit type for delete then insert', () => {
      const op1 = createOp('delete', 5, 'user1', { length: 3 });
      const op2 = createOp('insert', 5, 'user2', { content: 'X' });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      expect(conflict.type).toBe('delete_edit');
    });

    it('should create edit_delete type for insert then delete', () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'X' });
      const op2 = createOp('delete', 5, 'user2', { length: 3 });

      cr.detectConflicts([op1, op2]);
      const conflict = cr.getUnresolvedConflicts()[0];

      expect(conflict.type).toBe('edit_delete');
    });
  });

  describe('auto-resolution strategies', () => {
    it('should auto-resolve delete-edit conflicts', async () => {
      const op1 = createOp('delete', 5, 'user1', { length: 3 });
      const op2 = createOp('insert', 5, 'user2', { content: 'X' });

      const result = await cr.resolve(op1, op2);

      expect(result.resolved).toBe(true);
    });

    it('should auto-resolve edit-delete conflicts', async () => {
      const op1 = createOp('insert', 5, 'user1', { content: 'X' });
      const op2 = createOp('delete', 5, 'user2', { length: 3 });

      const result = await cr.resolve(op1, op2);

      expect(result.resolved).toBe(true);
    });

    it('should order concurrent inserts by timestamp', async () => {
      const op1 = createOp('insert', 5, 'user1', {
        content: 'A',
        timestamp: 100,
      });
      const op2 = createOp('insert', 5, 'user2', {
        content: 'B',
        timestamp: 200,
      });

      const result = await cr.resolve(op1, op2);

      expect(result.resolved).toBe(true);
    });
  });
});
