/**
 * Diff Engine Service
 *
 * Computes diffs and applies patches.
 */

import type { VersionDiff } from '../../types/collaboration';
import type { IDiffEngine } from './interfaces';

/**
 * Edit operation from LCS (Longest Common Subsequence)
 */
interface EditOp {
  op: 'delete' | 'insert' | 'equal';
  oldStart?: number;
  oldEnd?: number;
  newStart?: number;
  newEnd?: number;
  oldText?: string;
  newText?: string;
}

/**
 * Diff Engine Implementation
 */
export class DiffEngine implements IDiffEngine {
  /**
   * Compute diff between two texts
   */
  computeDiff(textA: string, textB: string): VersionDiff['hunks'] {
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');

    const editScript = this.computeLCS(linesA, linesB);
    return this.editScriptToHunks(editScript, linesA, linesB);
  }

  /**
   * Generate unified diff format
   */
  toUnifiedDiff(textA: string, textB: string, fileName: string): string {
    const hunks = this.computeDiff(textA, textB);
    const lines: string[] = [];

    // Unified diff header
    lines.push(`--- a/${fileName}`);
    lines.push(`+++ b/${fileName}`);

    for (const hunk of hunks) {
      // Hunk header
      const oldLen = hunk.lines.reduce(
        (sum, l) => sum + (l.type !== 'addition' ? 1 : 0),
        0,
      );
      const newLen = hunk.lines.reduce(
        (sum, l) => sum + (l.type !== 'deletion' ? 1 : 0),
        0,
      );
      lines.push(
        `@@ -${hunk.startLineA},${oldLen} +${hunk.startLineB},${newLen} @@`,
      );

      // Hunk content
      for (const line of hunk.lines) {
        const prefix =
          line.type === 'context' ? ' ' : line.type === 'addition' ? '+' : '-';
        lines.push(`${prefix}${line.content}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Apply a patch to text
   */
  applyPatch(text: string, patch: string): string {
    const lines = text.split('\n');
    const patchLines = patch.split('\n');

    let currentLine = 0;

    for (let i = 0; i < patchLines.length; i++) {
      const line = patchLines[i];

      // Skip headers
      if (line.startsWith('---') || line.startsWith('+++')) {
        continue;
      }

      // Parse hunk header
      const hunkMatch = line.match(/^@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
      if (hunkMatch) {
        const oldStart = Number.parseInt(hunkMatch[1], 10) - 1;
        const oldLen = hunkMatch[2] ? Number.parseInt(hunkMatch[2], 10) : 1;
        const newStart = Number.parseInt(hunkMatch[3], 10) - 1;

        // Skip to hunk location
        while (currentLine < oldStart && currentLine < lines.length) {
          currentLine++;
        }

        // Apply hunk changes
        const oldIdx = 0;
        const newIdx = 0;
        const newLines: string[] = [];
        let consumedOld = 0;

        i++;
        while (
          i < patchLines.length &&
          !patchLines[i].startsWith('@@') &&
          !patchLines[i].startsWith('---') &&
          !patchLines[i].startsWith('+++')
        ) {
          const patchLine = patchLines[i];

          if (patchLine.startsWith(' ')) {
            // Context line
            newLines.push(patchLine.slice(1));
            consumedOld++;
          } else if (patchLine.startsWith('-')) {
            // Deletion
            consumedOld++;
          } else if (patchLine.startsWith('+')) {
            // Addition
            newLines.push(patchLine.slice(1));
          }

          i++;
        }

        // Remove consumed old lines and insert new lines
        lines.splice(currentLine, consumedOld, ...newLines);
        currentLine += newLines.length;
        i--; // Adjust for outer loop increment
      }
    }

    return lines.join('\n');
  }

  /**
   * Perform three-way merge
   * Applies non-conflicting changes from both branches to the base
   */
  async threeWayMerge(
    base: string,
    theirs: string,
    yours: string,
  ): Promise<string | null> {
    const hunksBaseTheirs = this.computeDiff(base, theirs);
    const hunksBaseYours = this.computeDiff(base, yours);

    // Check for conflicts
    const hasConflicts = this.hasMergeConflicts(
      hunksBaseTheirs,
      hunksBaseYours,
    );

    if (hasConflicts) {
      return null; // Conflict detected
    }

    // Apply changes from both sides simultaneously to base
    // This is more reliable than sequential application
    return this.applyMultipleHunks(base, [
      ...hunksBaseTheirs,
      ...hunksBaseYours,
    ]);
  }

  /**
   * Apply multiple hunks to text in a single pass
   */
  private applyMultipleHunks(
    text: string,
    hunks: VersionDiff['hunks'],
  ): string {
    if (hunks.length === 0) return text;

    const lines = text.split('\n');
    const result: string[] = [];

    let i = 0;
    // Sort hunks by start line to apply in order
    const sortedHunks = [...hunks].sort((a, b) => a.startLineA - b.startLineA);

    for (const hunk of sortedHunks) {
      // Copy lines up to this hunk's start (skipping context from previous hunk)
      while (i < hunk.startLineA - 1 && i < lines.length) {
        result.push(lines[i]);
        i++;
      }

      // Apply this hunk's changes
      for (const line of hunk.lines) {
        if (line.type === 'addition') {
          result.push(line.content);
        } else if (line.type === 'deletion') {
          // Skip the deleted line
          i++;
        } else if (line.type === 'context') {
          // For context, verify line matches expected content before adding
          if (
            line.lineNumberA !== undefined &&
            line.lineNumberA - 1 < lines.length
          ) {
            const expectedLine = lines[line.lineNumberA - 1];
            // Only add if we haven't already added this line (avoid duplication)
            if (
              result.length === 0 ||
              result[result.length - 1] !== expectedLine
            ) {
              result.push(expectedLine);
            }
          }
          i++;
        }
      }
    }

    // Copy remaining lines
    while (i < lines.length) {
      result.push(lines[i]);
      i++;
    }

    return result.join('\n');
  }

  /**
   * Check if two change sets have conflicts
   */
  hasMergeConflicts(
    hunksA: VersionDiff['hunks'],
    hunksB: VersionDiff['hunks'],
  ): boolean {
    // Get all line ranges changed in each
    const rangesA = this.getHunkRanges(hunksA);
    const rangesB = this.getHunkRanges(hunksB);

    // Check for overlapping ranges
    for (const rangeA of rangesA) {
      for (const rangeB of rangesB) {
        if (this.rangesOverlap(rangeA, rangeB)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Compute LCS (Longest Common Subsequence) between two arrays
   */
  private computeLCS<T>(arr1: T[], arr2: T[]): EditOp[] {
    const m = arr1.length;
    const n = arr2.length;

    // Build LCS table
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      Array(n + 1).fill(0),
    );

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (arr1[i - 1] === arr2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to find edit script
    const editScript: EditOp[] = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && arr1[i - 1] === arr2[j - 1]) {
        editScript.unshift({
          op: 'equal',
          oldStart: i - 1,
          oldEnd: i,
          newStart: j - 1,
          newEnd: j,
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        editScript.unshift({
          op: 'insert',
          newStart: j - 1,
          newEnd: j,
          newText: arr2[j - 1] as string,
        });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        editScript.unshift({
          op: 'delete',
          oldStart: i - 1,
          oldEnd: i,
          oldText: arr1[i - 1] as string,
        });
        i--;
      }
    }

    return editScript;
  }

  /**
   * Convert edit script to hunks
   */
  private editScriptToHunks(
    editScript: EditOp[],
    linesA: string[],
    linesB: string[],
  ): VersionDiff['hunks'] {
    const hunks: VersionDiff['hunks'] = [];
    let currentHunk: (typeof hunks)[0] | null = null;
    const contextSize = 3;

    for (const op of editScript) {
      if (op.op === 'equal') {
        if (currentHunk) {
          // Add context lines
          for (let i = op.oldStart!; i < op.oldEnd!; i++) {
            if (i < linesA.length) {
              currentHunk.lines.push({
                type: 'context',
                content: linesA[i],
                lineNumberA: i + 1,
                lineNumberB: (op.newStart || 0) + (i - op.oldStart!) + 1,
              });
            }
          }

          // Check if hunk should end
          const trailingContext = this.countTrailingContext(currentHunk.lines);
          if (trailingContext >= contextSize) {
            // Trim excess context
            currentHunk.lines = this.trimContext(
              currentHunk.lines,
              contextSize,
            );
            hunks.push(currentHunk);
            currentHunk = null;
          }
        }
      } else {
        if (!currentHunk) {
          currentHunk = {
            startLineA: op.oldStart !== undefined ? op.oldStart + 1 : 1,
            startLineB: op.newStart !== undefined ? op.newStart + 1 : 1,
            lines: [],
          };

          // Add leading context if available
          const contextStart = Math.max(0, (op.oldStart || 0) - contextSize);
          for (let i = contextStart; i < (op.oldStart || 0); i++) {
            if (i < linesA.length) {
              currentHunk.lines.push({
                type: 'context',
                content: linesA[i],
                lineNumberA: i + 1,
                lineNumberB: i + 1,
              });
            }
          }
        }

        if (op.op === 'delete' && op.oldText !== undefined) {
          currentHunk.lines.push({
            type: 'deletion',
            content: op.oldText,
            lineNumberA: op.oldStart! + 1,
          });
        } else if (op.op === 'insert' && op.newText !== undefined) {
          currentHunk.lines.push({
            type: 'addition',
            content: op.newText,
            lineNumberB: op.newStart! + 1,
          });
        }
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * Count trailing context lines in a hunk
   */
  private countTrailingContext(
    lines: VersionDiff['hunks'][0]['lines'],
  ): number {
    let count = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].type === 'context') {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Trim context to specified size
   */
  private trimContext(
    lines: VersionDiff['hunks'][0]['lines'],
    contextSize: number,
  ): VersionDiff['hunks'][0]['lines'] {
    // Keep leading context
    let leadingContext = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].type === 'context' && leadingContext < contextSize) {
        leadingContext++;
      } else {
        break;
      }
    }

    // Trim trailing context
    let trailingContext = 0;
    const trimmed: typeof lines = [];

    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].type === 'context' && trailingContext < contextSize) {
        trimmed.unshift(lines[i]);
        trailingContext++;
      } else if (lines[i].type !== 'context' || leadingContext > 0) {
        trimmed.unshift(lines[i]);
        if (lines[i].type === 'context' && leadingContext > 0) {
          leadingContext--;
        }
      }
    }

    return trimmed;
  }

  /**
   * Get line ranges affected by hunks
   * Only considers actual changes (additions/deletions), not context lines
   */
  private getHunkRanges(
    hunks: VersionDiff['hunks'],
  ): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];

    for (const hunk of hunks) {
      let start = hunk.startLineA;
      let end = hunk.startLineA;
      let hasChange = false;

      for (const line of hunk.lines) {
        // Only count actual changes, not context
        if (line.type === 'deletion' && line.lineNumberA !== undefined) {
          start = Math.min(start, line.lineNumberA);
          end = Math.max(end, line.lineNumberA);
          hasChange = true;
        }
        // For additions, mark the position but don't expand range
        // since additions don't affect existing line positions
        if (line.type === 'addition') {
          hasChange = true;
        }
      }

      if (hasChange && start > 0) {
        ranges.push({ start, end: Math.max(start, end) });
      }
    }

    return ranges;
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(
    a: { start: number; end: number },
    b: { start: number; end: number },
  ): boolean {
    return a.start <= b.end && b.start <= a.end;
  }

  /**
   * Apply a single hunk to text
   */
  private applyHunk(text: string, hunk: VersionDiff['hunks'][0]): string {
    const lines = text.split('\n');
    const result: string[] = [];

    let i = 0;

    // Copy lines before the hunk
    while (i < hunk.startLineA - 1 && i < lines.length) {
      result.push(lines[i]);
      i++;
    }

    // Apply the hunk
    for (const line of hunk.lines) {
      switch (line.type) {
        case 'context':
        case 'deletion':
          if (
            line.lineNumberA !== undefined &&
            line.lineNumberA - 1 < lines.length
          ) {
            result.push(lines[line.lineNumberA - 1]);
          }
          i++;
          break;
        case 'addition':
          result.push(line.content);
          break;
      }
    }

    // Copy remaining lines
    while (i < lines.length) {
      result.push(lines[i]);
      i++;
    }

    return result.join('\n');
  }

  /**
   * Get character-level diff (for single-line changes)
   */
  charDiff(textA: string, textB: string): { added: string; removed: string } {
    const hunks = this.computeDiff(textA, textB);

    let added = '';
    let removed = '';

    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'addition') {
          added += line.content;
        } else if (line.type === 'deletion') {
          removed += line.content;
        }
      }
    }

    return { added, removed };
  }

  /**
   * Get similarity ratio between two texts
   */
  getSimilarity(textA: string, textB: string): number {
    if (textA === textB) return 1;
    if (!textA || !textB) return 0;

    const hunks = this.computeDiff(textA, textB);
    let changes = 0;

    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'context') {
          changes++;
        }
      }
    }

    const totalLines = Math.max(
      textA.split('\n').length,
      textB.split('\n').length,
    );

    // Clamp the result between 0 and 1
    if (totalLines === 0) return 0;
    const similarity = 1 - changes / totalLines;
    return Math.max(0, Math.min(1, similarity));
  }
}

// Export singleton instance
export const diffEngine = new DiffEngine();
