/**
 * Version Control Service
 *
 * Manages version history for files.
 */

import type { Version, VersionDiff } from '../../types/collaboration';
import { auditLogger } from './auditLogger';
import { diffEngine } from './diffEngine';
import type { IVersionControl } from './interfaces';

/**
 * Version storage structure
 */
interface FileVersions {
  fileId: string;
  versions: Version[];
  currentVersion: string;
}

/**
 * In-memory storage for versions
 * In production, this would be replaced with a database
 */
interface VersionStorage {
  versions: Map<string, FileVersions>;
}

/**
 * Version Control Implementation
 */
export class VersionControl implements IVersionControl {
  private storage: VersionStorage;
  private versionCounter = 0;

  constructor() {
    this.storage = {
      versions: new Map(),
    };
  }

  /**
   * Create a new version
   */
  async createVersion(
    fileId: string,
    content: string,
    message: string,
    author: string,
  ): Promise<Version> {
    const id = this.generateId();
    const now = Date.now();

    // Get or create file versions
    let fileVersions = this.storage.versions.get(fileId);
    if (!fileVersions) {
      fileVersions = {
        fileId,
        versions: [],
        currentVersion: '',
      };
      this.storage.versions.set(fileId, fileVersions);
    }

    // Generate version number
    const versionNumber = fileVersions.versions.length + 1;
    const versionString = `v${versionNumber}.0.0`;

    const parentVersion = fileVersions.currentVersion || undefined;

    const version: Version = {
      id,
      fileId,
      version: versionString,
      content,
      author,
      message,
      parentVersion,
      createdAt: now,
    };

    fileVersions.versions.push(version);
    fileVersions.currentVersion = id;

    // Log version creation
    await auditLogger.log({
      userId: author,
      action: 'create_version',
      resourceType: 'file',
      resourceId: fileId,
      workspaceId: '', // To be filled by caller
      success: true,
      metadata: { version: versionString, messageId: id },
    });

    return { ...version };
  }

  /**
   * Get a version by ID
   */
  async getVersion(versionId: string): Promise<Version | null> {
    for (const fileVersions of this.storage.versions.values()) {
      const version = fileVersions.versions.find((v) => v.id === versionId);
      if (version) {
        return { ...version };
      }
    }
    return null;
  }

  /**
   * Get version history for a file
   */
  async getHistory(fileId: string): Promise<Version[]> {
    const fileVersions = this.storage.versions.get(fileId);
    if (!fileVersions) {
      return [];
    }

    return fileVersions.versions.map((v) => ({ ...v }));
  }

  /**
   * Get the latest version
   */
  async getLatest(fileId: string): Promise<Version | null> {
    const fileVersions = this.storage.versions.get(fileId);
    if (!fileVersions || fileVersions.versions.length === 0) {
      return null;
    }

    const currentId = fileVersions.currentVersion;
    const version = fileVersions.versions.find((v) => v.id === currentId);
    return version ? { ...version } : null;
  }

  /**
   * Get a diff between two versions
   */
  async diff(versionA: string, versionB: string): Promise<VersionDiff> {
    const vA = await this.getVersion(versionA);
    const vB = await this.getVersion(versionB);

    if (!vA || !vB) {
      throw new Error('One or both versions not found');
    }

    const hunks = diffEngine.computeDiff(vA.content, vB.content);

    let additions = 0;
    let deletions = 0;

    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'addition') additions++;
        if (line.type === 'deletion') deletions++;
      }
    }

    return {
      versionA,
      versionB,
      additions,
      deletions,
      hunks,
    };
  }

  /**
   * Revert a file to a version
   */
  async revert(fileId: string, versionId: string): Promise<void> {
    const fileVersions = this.storage.versions.get(fileId);
    if (!fileVersions) {
      throw new Error(`File not found: ${fileId}`);
    }

    const version = fileVersions.versions.find((v) => v.id === versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    // Create a new version with the reverted content
    const newVersion = await this.createVersion(
      fileId,
      version.content,
      `Revert to ${version.version}`,
      version.author, // In production, use actual user
    );

    fileVersions.currentVersion = newVersion.id;
  }

  /**
   * Delete a version
   */
  async deleteVersion(versionId: string): Promise<void> {
    for (const fileVersions of this.storage.versions.values()) {
      const index = fileVersions.versions.findIndex((v) => v.id === versionId);
      if (index !== -1) {
        // Cannot delete current version
        if (fileVersions.currentVersion === versionId) {
          throw new Error('Cannot delete current version');
        }

        fileVersions.versions.splice(index, 1);
        return;
      }
    }

    throw new Error(`Version not found: ${versionId}`);
  }

  /**
   * Get current content of a file
   */
  async getCurrentContent(fileId: string): Promise<string> {
    const version = await this.getLatest(fileId);
    return version ? version.content : '';
  }

  /**
   * Compare current content with a version
   */
  async compareWithCurrent(
    fileId: string,
    versionId: string,
  ): Promise<VersionDiff | null> {
    const current = await this.getLatest(fileId);
    const previous = await this.getVersion(versionId);

    if (!current || !previous) {
      return null;
    }

    return this.diff(current.id, previous.id);
  }

  /**
   * Get version by version string
   */
  async getByVersionString(
    fileId: string,
    versionString: string,
  ): Promise<Version | null> {
    const fileVersions = this.storage.versions.get(fileId);
    if (!fileVersions) {
      return null;
    }

    const version = fileVersions.versions.find(
      (v) => v.version === versionString,
    );
    return version ? { ...version } : null;
  }

  /**
   * Get all versions for a user
   */
  async getVersionsByAuthor(authorId: string): Promise<Version[]> {
    const versions: Version[] = [];

    for (const fileVersions of this.storage.versions.values()) {
      for (const version of fileVersions.versions) {
        if (version.author === authorId) {
          versions.push({ ...version });
        }
      }
    }

    return versions.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get version statistics
   */
  async getVersionStats(fileId: string): Promise<{
    totalVersions: number;
    totalSize: number;
    authors: Set<string>;
  }> {
    const fileVersions = this.storage.versions.get(fileId);
    if (!fileVersions) {
      return {
        totalVersions: 0,
        totalSize: 0,
        authors: new Set(),
      };
    }

    const authors = new Set<string>();
    let totalSize = 0;

    for (const version of fileVersions.versions) {
      authors.add(version.author);
      totalSize += version.content.length;
    }

    return {
      totalVersions: fileVersions.versions.length,
      totalSize,
      authors,
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `ver_${Date.now()}_${++this.versionCounter}`;
  }

  /**
   * Clear all versions (for testing)
   */
  clear(): void {
    this.storage.versions.clear();
    this.versionCounter = 0;
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.versions.size;
  }
}

// Export singleton instance
export const versionControl = new VersionControl();
