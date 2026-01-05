/**
 * Workspace Manager Service
 *
 * Manages shared workspaces for team collaboration.
 */

import type {
  Workspace,
  WorkspaceMember,
  MemberRole,
  WorkspaceSettings,
  WorkspaceVisibility,
} from '../../types/collaboration';
import type {
  IWorkspaceManager,
  CreateWorkspaceData,
  UpdateWorkspaceData,
} from './interfaces';

/**
 * Default workspace settings
 */
const DEFAULT_SETTINGS: WorkspaceSettings = {
  requireReview: true,
  minReviewers: 1,
  autoMerge: false,
  branchProtection: true,
};

/**
 * In-memory storage for workspaces
 * In production, this would be replaced with a database
 */
interface WorkspaceStorage {
  workspaces: Map<string, Workspace>;
  workspacesByOwner: Map<string, Set<string>>;
  workspacesByMember: Map<string, Set<string>>;
}

/**
 * Workspace Manager Implementation
 */
export class WorkspaceManager implements IWorkspaceManager {
  private storage: WorkspaceStorage;

  constructor() {
    this.storage = {
      workspaces: new Map(),
      workspacesByOwner: new Map(),
      workspacesByMember: new Map(),
    };
  }

  /**
   * Create a new workspace
   */
  async create(data: CreateWorkspaceData): Promise<Workspace> {
    const id = this.generateId();
    const now = Date.now();

    const workspace: Workspace = {
      id,
      name: data.name,
      description: data.description,
      ownerId: data.ownerId,
      visibility: data.visibility,
      members: [
        {
          userId: data.ownerId,
          role: 'owner',
          joinedAt: now,
          invitedBy: data.ownerId,
        },
      ],
      settings: { ...DEFAULT_SETTINGS, ...data.settings },
      createdAt: now,
      updatedAt: now,
    };

    this.storage.workspaces.set(id, workspace);

    // Index by owner
    this.addToIndex(this.storage.workspacesByOwner, data.ownerId, id);

    // Index by member
    this.addToIndex(this.storage.workspacesByMember, data.ownerId, id);

    return workspace;
  }

  /**
   * Update an existing workspace
   */
  async update(id: string, data: UpdateWorkspaceData): Promise<void> {
    const workspace = this.storage.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }

    if (data.name !== undefined) workspace.name = data.name;
    if (data.description !== undefined) workspace.description = data.description;
    if (data.visibility !== undefined) workspace.visibility = data.visibility;

    workspace.updatedAt = Date.now();
  }

  /**
   * Delete a workspace
   */
  async delete(id: string): Promise<void> {
    const workspace = this.storage.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }

    // Remove from indexes
    this.removeFromIndex(this.storage.workspacesByOwner, workspace.ownerId, id);
    for (const member of workspace.members) {
      this.removeFromIndex(this.storage.workspacesByMember, member.userId, id);
    }

    this.storage.workspaces.delete(id);
  }

  /**
   * Get a workspace by ID
   */
  async get(id: string): Promise<Workspace | null> {
    const workspace = this.storage.workspaces.get(id);
    return workspace ? { ...workspace, members: [...workspace.members] } : null;
  }

  /**
   * List workspaces for a user
   */
  async list(userId: string): Promise<Workspace[]> {
    const workspaceIds = this.storage.workspacesByMember.get(userId);
    if (!workspaceIds) {
      return [];
    }

    const workspaces: Workspace[] = [];
    for (const id of workspaceIds) {
      const workspace = this.storage.workspaces.get(id);
      if (workspace) {
        workspaces.push({ ...workspace, members: [...workspace.members] });
      }
    }

    return workspaces.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Add a member to a workspace
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: MemberRole
  ): Promise<void> {
    const workspace = this.storage.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Check if already a member
    const existingMember = workspace.members.find((m) => m.userId === userId);
    if (existingMember) {
      throw new Error(`User is already a member of this workspace`);
    }

    workspace.members.push({
      userId,
      role,
      joinedAt: Date.now(),
      invitedBy: workspace.ownerId, // In real implementation, track who invited
    });

    workspace.updatedAt = Date.now();

    // Update index
    this.addToIndex(this.storage.workspacesByMember, userId, workspaceId);
  }

  /**
   * Remove a member from a workspace
   */
  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const workspace = this.storage.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Cannot remove owner
    if (userId === workspace.ownerId) {
      throw new Error(`Cannot remove workspace owner`);
    }

    const memberIndex = workspace.members.findIndex((m) => m.userId === userId);
    if (memberIndex === -1) {
      throw new Error(`User is not a member of this workspace`);
    }

    workspace.members.splice(memberIndex, 1);
    workspace.updatedAt = Date.now();

    // Update index
    this.removeFromIndex(this.storage.workspacesByMember, userId, workspaceId);
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: MemberRole
  ): Promise<void> {
    const workspace = this.storage.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Cannot change owner role
    if (userId === workspace.ownerId && role !== 'owner') {
      throw new Error(`Cannot change owner role directly`);
    }

    const member = workspace.members.find((m) => m.userId === userId);
    if (!member) {
      throw new Error(`User is not a member of this workspace`);
    }

    member.role = role;
    workspace.updatedAt = Date.now();
  }

  /**
   * Get workspace settings
   */
  async getSettings(workspaceId: string): Promise<WorkspaceSettings> {
    const workspace = this.storage.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    return { ...workspace.settings };
  }

  /**
   * Update workspace settings
   */
  async updateSettings(
    workspaceId: string,
    settings: Partial<WorkspaceSettings>
  ): Promise<void> {
    const workspace = this.storage.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    workspace.settings = { ...workspace.settings, ...settings };
    workspace.updatedAt = Date.now();
  }

  /**
   * Check if a workspace exists
   */
  exists(id: string): boolean {
    return this.storage.workspaces.has(id);
  }

  /**
   * Get workspace by name for a user
   */
  async getByName(ownerId: string, name: string): Promise<Workspace | null> {
    const workspaceIds = this.storage.workspacesByOwner.get(ownerId);
    if (!workspaceIds) {
      return null;
    }

    for (const id of workspaceIds) {
      const workspace = this.storage.workspaces.get(id);
      if (workspace && workspace.name === name) {
        return { ...workspace, members: [...workspace.members] };
      }
    }

    return null;
  }

  /**
   * Get member count for a workspace
   */
  getMemberCount(workspaceId: string): number {
    const workspace = this.storage.workspaces.get(workspaceId);
    return workspace ? workspace.members.length : 0;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add to index
   */
  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string
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
    value: string
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
   * Clear all workspaces (for testing)
   */
  clear(): void {
    this.storage.workspaces.clear();
    this.storage.workspacesByOwner.clear();
    this.storage.workspacesByMember.clear();
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.workspaces.size;
  }
}

// Export singleton instance
export const workspaceManager = new WorkspaceManager();
