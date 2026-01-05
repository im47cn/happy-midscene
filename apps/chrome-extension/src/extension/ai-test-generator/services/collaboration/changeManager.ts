/**
 * Change Manager Service
 *
 * Manages change collection, diff generation, and application.
 */

import type { Review, Change } from '../../types/collaboration';
import type { IChangeManager } from './interfaces';

/**
 * Diff line representation
 */
interface DiffLine {
  type: 'same' | 'add' | 'remove';
  content: string;
  lineNumberA?: number;
  lineNumberB?: number;
}

/**
 * Hunk of diff output
 */
interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

/**
 * Change Manager Implementation
 */
export class ChangeManager implements IChangeManager {
  /**
   * Collect changes between versions
   */
  async collectChanges(
    fileId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<Change[]> {
    // In production, this would fetch actual file versions from storage
    // For now, return an empty array
    return [];
  }

  /**
   * Generate a unified diff
   */
  generateDiff(contentA: string, contentB: string): string {
    const hunks = this.computeHunks(contentA, contentB);
    return this.formatUnifiedDiff(hunks, contentA, contentB);
  }

  /**
   * Apply a diff to content
   */
  applyDiff(content: string, diff: string): string {
    const hunks = this.parseUnifiedDiff(diff);
    let result = content;

    // Apply hunks in reverse order to preserve line numbers
    for (let i = hunks.length - 1; i >= 0; i--) {
      result = this.applyHunk(result, hunks[i]);
    }

    return result;
  }

  /**
   * Calculate change statistics
   */
  calculateStats(diff: string): { additions: number; deletions: number } {
    let additions = 0;
    let deletions = 0;

    for (const line of diff.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    return { additions, deletions };
  }

  /**
   * Compute hunks between two texts
   */
  private computeHunks(textA: string, textB: string): Hunk[] {
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');

    const hunks: Hunk[] = [];
    let i = 0;
    let j = 0;

    while (i < linesA.length || j < linesB.length) {
      // Find the start of a difference
      while (i < linesA.length && j < linesB.length && linesA[i] === linesB[j]) {
        i++;
        j++;
      }

      if (i >= linesA.length && j >= linesB.length) {
        break;
      }

      const hunkStartA = i + 1;
      const hunkStartB = j + 1;
      const lines: DiffLine[] = [];

      // Collect context and changes
      let contextCount = 0;
      const maxContext = 3;

      while (
        i < linesA.length ||
        j < linesB.length
      ) {
        const lineA = i < linesA.length ? linesA[i] : null;
        const lineB = j < linesB.length ? linesB[j] : null;

        if (lineA === lineB) {
          if (lines.length > 0 && contextCount < maxContext) {
            lines.push({ type: 'same', content: lineA!, lineNumberA: i + 1, lineNumberB: j + 1 });
            contextCount++;
            i++;
            j++;
          } else if (contextCount >= maxContext) {
            // End hunk
            break;
          } else {
            i++;
            j++;
          }
        } else {
          contextCount = 0;
          if (lineA !== null) {
            lines.push({ type: 'remove', content: lineA, lineNumberA: i + 1 });
            i++;
          }
          if (lineB !== null) {
            lines.push({ type: 'add', content: lineB, lineNumberB: j + 1 });
            j++;
          }
        }
      }

      // Add trailing context
      for (let k = 0; k < maxContext && i < linesA.length && j < linesB.length && linesA[i] === linesB[j]; k++) {
        lines.push({ type: 'same', content: linesA[i], lineNumberA: i + 1, lineNumberB: j + 1 });
        i++;
        j++;
      }

      if (lines.length > 0) {
        hunks.push({
          oldStart: hunkStartA,
          oldLines: i - hunkStartA + 1,
          newStart: hunkStartB,
          newLines: j - hunkStartB + 1,
          lines,
        });
      }
    }

    return hunks;
  }

  /**
   * Format hunks as unified diff
   */
  private formatUnifiedDiff(hunks: Hunk[], contentA: string, contentB: string): string {
    const lines: string[] = [];

    // Add header
    lines.push('--- a/file');
    lines.push('+++ b/file');

    for (const hunk of hunks) {
      // Hunk header
      lines.push(
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
      );

      // Hunk content
      for (const line of hunk.lines) {
        switch (line.type) {
          case 'same':
            lines.push(` ${line.content}`);
            break;
          case 'add':
            lines.push(`+${line.content}`);
            break;
          case 'remove':
            lines.push(`-${line.content}`);
            break;
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Parse a unified diff into hunks
   */
  private parseUnifiedDiff(diff: string): Hunk[] {
    const hunks: Hunk[] = [];
    const lines = diff.split('\n');

    let currentHunk: Hunk | null = null;

    for (const line of lines) {
      const hunkHeader = line.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
      if (hunkHeader) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = {
          oldStart: parseInt(hunkHeader[1], 10),
          oldLines: parseInt(hunkHeader[2], 10),
          newStart: parseInt(hunkHeader[3], 10),
          newLines: parseInt(hunkHeader[4], 10),
          lines: [],
        };
        continue;
      }

      if (currentHunk) {
        if (line.startsWith(' ')) {
          currentHunk.lines.push({ type: 'same', content: line.slice(1) });
        } else if (line.startsWith('+')) {
          currentHunk.lines.push({ type: 'add', content: line.slice(1) });
        } else if (line.startsWith('-')) {
          currentHunk.lines.push({ type: 'remove', content: line.slice(1) });
        }
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * Apply a single hunk to content
   */
  private applyHunk(content: string, hunk: Hunk): string {
    const lines = content.split('\n');
    const result: string[] = [];

    let i = 0;

    // Copy lines before the hunk
    while (i < hunk.oldStart - 1) {
      result.push(lines[i] || '');
      i++;
    }

    // Apply the hunk
    for (const line of hunk.lines) {
      switch (line.type) {
        case 'same':
          if (i < lines.length) {
            result.push(lines[i]);
            i++;
          }
          break;
        case 'add':
          result.push(line.content);
          break;
        case 'remove':
          i++;
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
   * Create a change object
   */
  createChange(
    fileId: string,
    fileName: string,
    oldContent: string,
    newContent: string
  ): Change {
    const diff = this.generateDiff(oldContent, newContent);
    const stats = this.calculateStats(diff);

    let changeType: 'added' | 'modified' | 'deleted';
    if (oldContent === '') {
      changeType = 'added';
    } else if (newContent === '') {
      changeType = 'deleted';
    } else {
      changeType = 'modified';
    }

    return {
      fileId,
      fileName,
      changeType,
      diff,
    };
  }

  /**
   * Compare two files and return changes
   */
  compareFiles(
    fileId: string,
    fileName: string,
    contentA: string,
    contentB: string
  ): Change {
    return this.createChange(fileId, fileName, contentA, contentB);
  }

  /**
   * Get changed files from a review
   */
  async getChangedFiles(review: Review): Promise<string[]> {
    return review.changes.map((c) => c.fileId);
  }

  /**
   * Check if a file has changes
   */
  hasChanges(diff: string): boolean {
    return this.calculateStats(diff).additions > 0 ||
           this.calculateStats(diff).deletions > 0;
  }

  /**
   * Get file summary from changes
   */
  getChangeSummary(changes: Change[]): {
    totalFiles: number;
    additions: number;
    deletions: number;
    fileCountByType: Record<string, number>;
  } {
    let additions = 0;
    let deletions = 0;
    const fileCountByType: Record<string, number> = {
      added: 0,
      modified: 0,
      deleted: 0,
    };

    for (const change of changes) {
      const stats = this.calculateStats(change.diff);
      additions += stats.additions;
      deletions += stats.deletions;
      fileCountByType[change.changeType]++;
    }

    return {
      totalFiles: changes.length,
      additions,
      deletions,
      fileCountByType,
    };
  }
}

// Export singleton instance
export const changeManager = new ChangeManager();
