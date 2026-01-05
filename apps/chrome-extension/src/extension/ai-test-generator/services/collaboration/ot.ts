/**
 * Operational Transform (OT) Service
 *
 * Implements OT algorithm for conflict-free collaborative editing.
 */

import type { EditorOperation } from '../../types/collaboration';

/**
 * Operation types for OT
 */
type OpType = 'insert' | 'delete' | 'retain';

/**
 * Internal operation representation
 */
interface InternalOp {
  type: OpType;
  value?: string;
  length?: number;
}

/**
 * Parsed operation with position
 */
interface ParsedOp extends InternalOp {
  position: number;
}

/**
 * Transform result
 */
interface TransformResult {
  op: EditorOperation;
  transformed: boolean;
}

/**
 * Operational Transform Implementation
 */
export class OperationalTransform {
  /**
   * Transform an operation against the current document state
   */
  async transform(
    op: EditorOperation,
    currentVersion: number
  ): Promise<EditorOperation> {
    // In production, this would transform against concurrent operations
    // For now, just update the version
    return {
      ...op,
      version: currentVersion + 1,
    };
  }

  /**
   * Apply an operation to a document
   */
  async apply(document: string, operation: EditorOperation): Promise<string> {
    switch (operation.type) {
      case 'insert':
        return this.insertAt(document, operation.position, operation.content || '');
      case 'delete':
        return this.deleteAt(document, operation.position, operation.length || 0);
      case 'retain':
        return document;
    }
  }

  /**
   * Transform two operations against each other
   */
  transformOps(op1: EditorOperation, op2: EditorOperation): [EditorOperation, EditorOperation] {
    // Transform op1 against op2 and vice versa
    const transformed1 = this.transformOpAgainst(op1, op2);
    const transformed2 = this.transformOpAgainst(op2, op1);

    return [transformed1, transformed2];
  }

  /**
   * Transform one operation against another
   */
  private transformOpAgainst(
    op: EditorOperation,
    against: EditorOperation
  ): EditorOperation {
    let newPos = op.position;

    // Simple transformation based on operation types
    if (against.type === 'insert' && against.position < op.position) {
      newPos += against.content?.length || 0;
    } else if (against.type === 'delete' && against.position < op.position) {
      newPos -= against.length || 0;
      newPos = Math.max(0, newPos);
    }

    return {
      ...op,
      position: newPos,
    };
  }

  /**
   * Compose two operations into one
   */
  compose(op1: EditorOperation, op2: EditorOperation): EditorOperation[] {
    // In production, this would merge operations when possible
    return [op1, op2];
  }

  /**
   * Insert text at position
   */
  private insertAt(document: string, position: number, content: string): string {
    if (position < 0) position = 0;
    if (position > document.length) position = document.length;

    return (
      document.slice(0, position) + content + document.slice(position)
    );
  }

  /**
   * Delete text at position
   */
  private deleteAt(document: string, position: number, length: number): string {
    if (position < 0) position = 0;
    if (position >= document.length) return document;

    const endPos = Math.min(position + length, document.length);
    return document.slice(0, position) + document.slice(endPos);
  }

  /**
   * Parse operations from a string
   */
  parseOps(str: string): InternalOp[] {
    const ops: InternalOp[] = [];

    for (const char of str) {
      ops.push({ type: 'insert', value: char });
    }

    return ops;
  }

  /**
   * Validate an operation
   */
  validate(op: EditorOperation, docLength: number): boolean {
    if (op.position < 0 || op.position > docLength) {
      return false;
    }

    if (op.type === 'delete') {
      const length = op.length || 0;
      if (length < 0 || op.position + length > docLength) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate the length of an operation
   */
  opLength(op: EditorOperation): number {
    switch (op.type) {
      case 'insert':
        return op.content?.length || 0;
      case 'delete':
        return -(op.length || 0);
      case 'retain':
        return 0;
    }
  }

  /**
   * Invert an operation
   */
  invert(op: EditorOperation, doc: string): EditorOperation {
    switch (op.type) {
      case 'insert': {
        const content = op.content || '';
        return {
          type: 'delete',
          position: op.position,
          length: content.length,
          userId: op.userId,
          timestamp: op.timestamp,
          version: op.version,
        };
      }
      case 'delete': {
        const deleted = doc.slice(op.position, op.position + (op.length || 0));
        return {
          type: 'insert',
          position: op.position,
          content: deleted,
          userId: op.userId,
          timestamp: op.timestamp,
          version: op.version,
        };
      }
      case 'retain':
        return op;
    }
  }

  /**
   * Clone an operation
   */
  clone(op: EditorOperation): EditorOperation {
    return {
      type: op.type,
      position: op.position,
      content: op.content,
      length: op.length,
      userId: op.userId,
      timestamp: op.timestamp,
      version: op.version,
    };
  }

  /**
   * Check if two operations are equal
   */
  equals(a: EditorOperation, b: EditorOperation): boolean {
    return (
      a.type === b.type &&
      a.position === b.position &&
      a.content === b.content &&
      a.length === b.length &&
      a.userId === b.userId
    );
  }

  /**
   * Transform a path of operations (for undo/redo)
   */
  transformPath(
    ops: EditorOperation[],
    against: EditorOperation
  ): EditorOperation[] {
    const result: EditorOperation[] = [];

    for (const op of ops) {
      const [transformed] = this.transformOps(op, against);
      result.push(transformed);
    }

    return result;
  }

  /**
   * Get operation as string representation
   */
  opToString(op: EditorOperation): string {
    switch (op.type) {
      case 'insert':
        return `ins(${op.position}, "${op.content}")`;
      case 'delete':
        return `del(${op.position}, ${op.length})`;
      case 'retain':
        return `ret(${op.position})`;
    }
  }
}

// Export singleton instance
export const ot = new OperationalTransform();
