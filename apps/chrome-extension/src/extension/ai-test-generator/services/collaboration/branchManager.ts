/**
 * Branch Manager Service
 *
 * Manages branches for parallel editing and merging.
 */

import type { Branch } from '../../types/collaboration';
import { diffEngine } from './diffEngine';
import type {
  ConflictResolution,
  CreateBranchData,
  IBranchManager,
} from './interfaces';
import { versionControl } from './versionControl';

/**
 * In-memory storage for branches
 * In production, this would be replaced with a database
 */
interface BranchStorage {
  branches: Map<string, Branch>;
  byFile: Map<string, Set<string>>;
}

/**
 * Branch Manager Implementation
 */
export class BranchManager implements IBranchManager {
  private storage: BranchStorage;

  constructor() {
    this.storage = {
      branches: new Map(),
      byFile: new Map(),
    };
  }

  /**
   * Create a new branch
   */
  async createBranch(data: CreateBranchData): Promise<Branch> {
    const id = this.generateId();
    const now = Date.now();

    // Get current file content as base version
    const currentVersion = await versionControl.getLatest(data.fileId);
    const baseVersion = currentVersion
      ? currentVersion.id
      : `base_${Date.now()}`;

    const branch: Branch = {
      id,
      name: data.name,
      fileId: data.fileId,
      parentId: data.parentId,
      version: baseVersion,
      createdBy: data.createdBy,
      status: 'active',
      createdAt: now,
    };

    this.storage.branches.set(id, branch);
    this.addToIndex(this.storage.byFile, data.fileId, id);

    return { ...branch };
  }

  /**
   * Get a branch by ID
   */
  async getBranch(branchId: string): Promise<Branch | null> {
    const branch = this.storage.branches.get(branchId);
    return branch ? { ...branch } : null;
  }

  /**
   * List branches for a file
   */
  async listBranches(fileId: string): Promise<Branch[]> {
    const branchIds = this.storage.byFile.get(fileId);
    if (!branchIds) {
      return [];
    }

    const branches: Branch[] = [];
    for (const id of branchIds) {
      const branch = this.storage.branches.get(id);
      if (branch) {
        branches.push({ ...branch });
      }
    }

    return branches.filter((b) => b.status === 'active');
  }

  /**
   * Merge a branch
   */
  async merge(branchId: string, targetBranchId: string): Promise<void> {
    const source = this.storage.branches.get(branchId);
    const target = this.storage.branches.get(targetBranchId);

    if (!source || !target) {
      throw new Error('One or both branches not found');
    }

    if (source.status !== 'active' || target.status !== 'active') {
      throw new Error('Can only merge active branches');
    }

    if (source.fileId !== target.fileId) {
      throw new Error('Cannot merge branches from different files');
    }

    // Get content from both branches
    const sourceVersion = await versionControl.getVersion(source.version);
    const targetVersion = await versionControl.getVersion(target.version);

    if (!sourceVersion || !targetVersion) {
      throw new Error('One or both branch versions not found');
    }

    // Perform three-way merge
    const result = await diffEngine.threeWayMerge(
      targetVersion.content, // Use target as base for simplicity
      sourceVersion.content,
      targetVersion.content,
    );

    if (result === null) {
      source.status = 'abandoned';
      throw new Error(
        'Merge conflict detected. Please resolve conflicts manually.',
      );
    }

    // Create new version with merged content
    await versionControl.createVersion(
      source.fileId,
      result,
      `Merge branch ${source.name} into ${target.name}`,
      source.createdBy,
    );

    // Update target branch
    target.version = source.version;

    // Mark source as merged
    source.status = 'merged';
  }

  /**
   * Abandon a branch
   */
  async abandon(branchId: string): Promise<void> {
    const branch = this.storage.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    branch.status = 'abandoned';
  }

  /**
   * Resolve merge conflicts
   */
  async resolveConflicts(
    branchId: string,
    resolutions: ConflictResolution[],
  ): Promise<void> {
    const branch = this.storage.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    // Get current content
    const currentVersion = await versionControl.getLatest(branch.fileId);
    if (!currentVersion) {
      throw new Error('No current version found');
    }

    let content = currentVersion.content;
    const lines = content.split('\n');

    // Apply resolutions
    for (const resolution of resolutions) {
      const { path, resolution: type, content: newContent } = resolution;

      if (type === 'manual' && newContent !== undefined) {
        // Use manually provided content
        content = newContent;
      } else if (type === 'accept_theirs') {
        // In production, would handle properly
        // For now, keep current content
      } else if (type === 'accept_yours') {
        // In production, would handle properly
        // For now, keep current content
      }
    }

    // Create new version with resolved content
    await versionControl.createVersion(
      branch.fileId,
      content,
      `Resolved merge conflicts for ${branch.name}`,
      branch.createdBy,
    );

    // Update branch version
    branch.version = (await versionControl.getLatest(branch.fileId))!.id;
  }

  /**
   * Get branch by name
   */
  async getByName(fileId: string, name: string): Promise<Branch | null> {
    const branches = await this.listBranches(fileId);
    return branches.find((b) => b.name === name) || null;
  }

  /**
   * Compare two branches
   */
  async compareBranches(
    branchIdA: string,
    branchIdB: string,
  ): Promise<{
    ahead: number;
    behind: number;
    diverged: boolean;
  }> {
    const branchA = this.storage.branches.get(branchIdA);
    const branchB = this.storage.branches.get(branchIdB);

    if (!branchA || !branchB) {
      throw new Error('One or both branches not found');
    }

    const versionA = await versionControl.getVersion(branchA.version);
    const versionB = await versionControl.getVersion(branchB.version);

    if (!versionA || !versionB) {
      return { ahead: 0, behind: 0, diverged: false };
    }

    // Count commits ahead/behind
    // In production, would walk version history
    return {
      ahead: 0,
      behind: 0,
      diverged: branchA.version !== branchB.version,
    };
  }

  /**
   * Get branch status
   */
  async getBranchStatus(branchId: string): Promise<{
    status: Branch['status'];
    hasConflicts: boolean;
    canMerge: boolean;
  }> {
    const branch = this.storage.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    // Check for conflicts with main
    const mainBranches = await this.listBranches(branch.fileId);
    const main = mainBranches.find((b) => b.name === 'main');

    let hasConflicts = false;
    if (main) {
      const mainVersion = await versionControl.getVersion(main.version);
      const branchVersion = await versionControl.getVersion(branch.version);

      if (mainVersion && branchVersion) {
        const mergeResult = await diffEngine.threeWayMerge(
          mainVersion.content,
          branchVersion.content,
          mainVersion.content,
        );
        hasConflicts = mergeResult === null;
      }
    }

    return {
      status: branch.status,
      hasConflicts,
      canMerge: branch.status === 'active' && !hasConflicts,
    };
  }

  /**
   * Rename a branch
   */
  async rename(branchId: string, newName: string): Promise<void> {
    const branch = this.storage.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    branch.name = newName;
  }

  /**
   * Delete a branch
   */
  async delete(branchId: string): Promise<void> {
    const branch = this.storage.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    if (branch.status === 'active') {
      throw new Error('Cannot delete active branch. Abandon it first.');
    }

    this.storage.branches.delete(branchId);
    this.removeFromIndex(this.storage.byFile, branch.fileId, branchId);
  }

  /**
   * Get all active branches
   */
  async getActiveBranches(fileId: string): Promise<Branch[]> {
    const branches = await this.listBranches(fileId);
    return branches.filter((b) => b.status === 'active');
  }

  /**
   * Get branch history
   */
  async getBranchHistory(branchId: string): Promise<Branch[]> {
    const branch = this.storage.branches.get(branchId);
    if (!branch) {
      return [];
    }

    const history: Branch[] = [branch];

    // Walk up the parent chain
    let currentParent = branch.parentId;
    while (currentParent) {
      const parent = this.storage.branches.get(currentParent);
      if (parent) {
        history.push({ ...parent });
        currentParent = parent.parentId;
      } else {
        break;
      }
    }

    return history;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add to index
   */
  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string,
  ): void {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(value);
  }

  /**
   * Remove from index
   */
  private removeFromIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string,
  ): void {
    const set = index.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  /**
   * Clear all branches (for testing)
   */
  clear(): void {
    this.storage.branches.clear();
    this.storage.byFile.clear();
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.branches.size;
  }
}

// Export singleton instance
export const branchManager = new BranchManager();
