/**
 * Conflict Resolver Service
 *
 * Handles automatic and manual conflict resolution.
 */

import type { EditorOperation } from '../../types/collaboration';

/**
 * Conflict type
 */
export type ConflictType = 'concurrent_edit' | 'delete_edit' | 'edit_delete';

/**
 * Detected conflict
 */
export interface Conflict {
  id: string;
  type: ConflictType;
  position: number;
  operations: EditorOperation[];
  resolved: boolean;
  resolution?: ConflictResolution;
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolution =
  | 'accept_theirs'
  | 'accept_yours'
  | 'merge'
  | 'manual';

/**
 * Resolution result
 */
export interface ResolutionResult {
  resolved: boolean;
  operation?: EditorOperation;
  conflicts: Conflict[];
}

/**
 * Conflict with additional metadata
 */
export interface ExtendedConflict extends Conflict {
  baseContent: string;
  theirsContent: string;
  yoursContent: string;
  mergedContent?: string;
}

/**
 * Conflict Resolver Implementation
 */
export class ConflictResolver {
  private conflicts: Map<string, Conflict> = new Map();
  private conflictCounter = 0;

  /**
   * Automatically resolve a conflict
   */
  async resolve(op1: EditorOperation, op2: EditorOperation): Promise<ResolutionResult> {
    const conflicts = this.detectConflicts([op1, op2]);

    if (conflicts.length === 0) {
      // No conflict - can apply both operations
      return {
        resolved: true,
        conflicts: [],
      };
    }

    // Attempt automatic resolution
    const results: Conflict[] = [];

    for (const conflict of conflicts) {
      const autoResolution = this.attemptAutoResolve(conflict);
      results.push(autoResolution);
    }

    const hasUnresolved = results.some((c) => !c.resolved);

    return {
      resolved: !hasUnresolved,
      conflicts: results,
    };
  }

  /**
   * Detect conflicts between operations
   */
  detectConflicts(operations: EditorOperation[]): Conflict[] {
    const conflicts: Conflict[] = [];

    for (let i = 0; i < operations.length; i++) {
      for (let j = i + 1; j < operations.length; j++) {
        const op1 = operations[i];
        const op2 = operations[j];

        const conflict = this.checkConflict(op1, op2);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Manually resolve a conflict
   */
  manualResolve(
    conflictId: string,
    resolution: ConflictResolution,
    customContent?: string
  ): EditorOperation | null {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      return null;
    }

    switch (resolution) {
      case 'accept_theirs':
        conflict.resolved = true;
        conflict.resolution = resolution;
        return conflict.operations[0]; // "theirs" is first op

      case 'accept_yours':
        conflict.resolved = true;
        conflict.resolution = resolution;
        return conflict.operations[1]; // "yours" is second op

      case 'merge':
        // Attempt merge
        const merged = this.mergeOperations(conflict.operations[0], conflict.operations[1]);
        if (merged) {
          conflict.resolved = true;
          conflict.resolution = resolution;
          return merged;
        }
        return null;

      case 'manual':
        if (customContent !== undefined) {
          conflict.resolved = true;
          conflict.resolution = resolution;
          return {
            type: 'insert',
            position: conflict.position,
            content: customContent,
            userId: conflict.operations[0].userId,
            timestamp: Date.now(),
            version: conflict.operations[0].version,
          };
        }
        return null;
    }
  }

  /**
   * Get all unresolved conflicts
   */
  getUnresolvedConflicts(): Conflict[] {
    return Array.from(this.conflicts.values()).filter((c) => !c.resolved);
  }

  /**
   * Get conflict by ID
   */
  getConflict(id: string): Conflict | null {
    return this.conflicts.get(id) || null;
  }

  /**
   * Clear all conflicts
   */
  clearConflicts(): void {
    this.conflicts.clear();
  }

  /**
   * Check if two operations conflict
   */
  private checkConflict(
    op1: EditorOperation,
    op2: EditorOperation
  ): Conflict | null {
    // Operations by the same user don't conflict
    if (op1.userId === op2.userId) {
      return null;
    }

    // Same position conflicts
    if (op1.position === op2.position) {
      let type: ConflictType;

      if (op1.type === 'delete' && op2.type === 'insert') {
        type = 'delete_edit';
      } else if (op1.type === 'insert' && op2.type === 'delete') {
        type = 'edit_delete';
      } else {
        type = 'concurrent_edit';
      }

      return this.createConflict(type, op1.position, [op1, op2]);
    }

    // Overlapping delete
    if (
      op1.type === 'delete' &&
      op2.type === 'delete' &&
      this.rangesOverlap(op1.position, op1.length || 0, op2.position, op2.length || 0)
    ) {
      return this.createConflict('concurrent_edit', op1.position, [op1, op2]);
    }

    // Insert within delete range
    if (
      op1.type === 'delete' &&
      op2.type === 'insert' &&
      this.isInRange(op2.position, op1.position, op1.length || 0)
    ) {
      return this.createConflict('delete_edit', op1.position, [op1, op2]);
    }

    if (
      op2.type === 'delete' &&
      op1.type === 'insert' &&
      this.isInRange(op1.position, op2.position, op2.length || 0)
    ) {
      return this.createConflict('edit_delete', op2.position, [op1, op2]);
    }

    return null;
  }

  /**
   * Create a conflict record
   */
  private createConflict(
    type: ConflictType,
    position: number,
    operations: EditorOperation[]
  ): Conflict {
    const id = this.generateId();
    const conflict: Conflict = {
      id,
      type,
      position,
      operations,
      resolved: false,
    };

    this.conflicts.set(id, conflict);
    return conflict;
  }

  /**
   * Attempt automatic resolution of a conflict
   */
  private attemptAutoResolve(conflict: Conflict): Conflict {
    // Auto-resolution strategies based on conflict type

    switch (conflict.type) {
      case 'concurrent_edit':
        // If both are inserts at same position, order by timestamp
        if (
          conflict.operations[0].type === 'insert' &&
          conflict.operations[1].type === 'insert'
        ) {
          const ops = [...conflict.operations].sort(
            (a, b) => a.timestamp - b.timestamp
          );
          conflict.resolved = true;
          conflict.resolution = 'merge';
          return conflict;
        }
        break;

      case 'delete_edit':
      case 'edit_delete':
        // Delete wins - delete should happen first, then insert
        conflict.resolved = true;
        conflict.resolution = 'accept_theirs';
        return conflict;
    }

    return conflict;
  }

  /**
   * Merge two operations
   */
  private mergeOperations(
    op1: EditorOperation,
    op2: EditorOperation
  ): EditorOperation | null {
    // If both are inserts, concatenate
    if (op1.type === 'insert' && op2.type === 'insert') {
      // Order by timestamp
      const [first, second] = op1.timestamp < op2.timestamp ? [op1, op2] : [op2, op1];

      return {
        type: 'insert',
        position: first.position,
        content: (first.content || '') + (second.content || ''),
        userId: first.userId,
        timestamp: Date.now(),
        version: Math.max(first.version || 0, second.version || 0),
      };
    }

    return null;
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(
    start1: number,
    len1: number,
    start2: number,
    len2: number
  ): boolean {
    const end1 = start1 + len1;
    const end2 = start2 + len2;

    return start1 < end2 && start2 < end1;
  }

  /**
   * Check if a value is in a range
   */
  private isInRange(value: number, start: number, length: number): boolean {
    return value >= start && value < start + length;
  }

  /**
   * Generate a unique conflict ID
   */
  private generateId(): string {
    return `conflict_${Date.now()}_${++this.conflictCounter}`;
  }

  /**
   * Get conflict count
   */
  getConflictCount(): number {
    return this.conflicts.size;
  }

  /**
   * Get extended conflict info with content
   */
  async getExtendedConflict(
    conflictId: string,
    baseContent: string
  ): Promise<ExtendedConflict | null> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      return null;
    }

    const op1 = conflict.operations[0];
    const op2 = conflict.operations[1];

    const theirsContent = this.applyOp(baseContent, op1);
    const yoursContent = this.applyOp(baseContent, op2);

    const mergedContent = this.mergeOperations(op1, op2);

    return {
      ...conflict,
      baseContent,
      theirsContent,
      yoursContent,
      mergedContent: mergedContent ? this.applyOp(baseContent, mergedContent) : undefined,
    };
  }

  /**
   * Apply an operation to content (for conflict preview)
   */
  private applyOp(content: string, op: EditorOperation): string {
    switch (op.type) {
      case 'insert':
        return (
          content.slice(0, op.position) +
          (op.content || '') +
          content.slice(op.position)
        );
      case 'delete':
        return (
          content.slice(0, op.position) +
          content.slice(op.position + (op.length || 0))
        );
      case 'retain':
        return content;
    }
  }
}

// Export singleton instance
export const conflictResolver = new ConflictResolver();
