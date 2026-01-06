/**
 * Member Manager Service
 *
 * Manages workspace members and their roles.
 */

import type { MemberRole, WorkspaceMember } from '../../types/collaboration';
import type { IMemberManager } from './interfaces';
import { workspaceManager } from './workspaceManager';

/**
 * Member Manager Implementation
 */
export class MemberManager implements IMemberManager {
  /**
   * Get all members of a workspace
   */
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const workspace = await workspaceManager.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    return [...workspace.members];
  }

  /**
   * Get a specific member
   */
  async getMember(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const workspace = await workspaceManager.get(workspaceId);
    if (!workspace) {
      return null;
    }

    return workspace.members.find((m) => m.userId === userId) || null;
  }

  /**
   * Check if a user is a member
   */
  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.getMember(workspaceId, userId);
    return member !== null;
  }

  /**
   * Get a member's role
   */
  async getMemberRole(
    workspaceId: string,
    userId: string,
  ): Promise<MemberRole | null> {
    const member = await this.getMember(workspaceId, userId);
    return member ? member.role : null;
  }

  /**
   * Get all members with a specific role
   */
  async getMembersByRole(
    workspaceId: string,
    role: MemberRole,
  ): Promise<WorkspaceMember[]> {
    const members = await this.getMembers(workspaceId);
    return members.filter((m) => m.role === role);
  }

  /**
   * Count members by role
   */
  async countByRole(workspaceId: string, role: MemberRole): Promise<number> {
    const members = await this.getMembersByRole(workspaceId, role);
    return members.length;
  }

  /**
   * Get admin members (editors and above)
   */
  async getAdminMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const members = await this.getMembers(workspaceId);
    return members.filter((m) => m.role === 'admin' || m.role === 'owner');
  }

  /**
   * Get editable members (editors and above)
   */
  async getEditableMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const members = await this.getMembers(workspaceId);
    return members.filter(
      (m) => m.role === 'editor' || m.role === 'admin' || m.role === 'owner',
    );
  }

  /**
   * Get member display name (in real app, would fetch from user service)
   */
  async getMemberDisplayName(userId: string): Promise<string> {
    // In production, this would call a user service
    return `User_${userId.substr(0, 8)}`;
  }

  /**
   * Get member avatar URL (in real app, would fetch from user service)
   */
  async getMemberAvatarUrl(userId: string): Promise<string> {
    // In production, this would call a user service
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
  }

  /**
   * Search members by name/email
   */
  async searchMembers(
    workspaceId: string,
    query: string,
  ): Promise<WorkspaceMember[]> {
    const members = await this.getMembers(workspaceId);
    const lowerQuery = query.toLowerCase();

    // In production, would search actual user names/emails
    return members.filter((m) => m.userId.toLowerCase().includes(lowerQuery));
  }

  /**
   * Bulk check if users are members
   */
  async bulkCheckMembers(
    workspaceId: string,
    userIds: string[],
  ): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    const members = await this.getMembers(workspaceId);
    const memberIds = new Set(members.map((m) => m.userId));

    for (const userId of userIds) {
      result.set(userId, memberIds.has(userId));
    }

    return result;
  }

  /**
   * Get member statistics
   */
  async getMemberStats(workspaceId: string): Promise<{
    total: number;
    owners: number;
    admins: number;
    editors: number;
    viewers: number;
  }> {
    const members = await this.getMembers(workspaceId);

    return {
      total: members.length,
      owners: members.filter((m) => m.role === 'owner').length,
      admins: members.filter((m) => m.role === 'admin').length,
      editors: members.filter((m) => m.role === 'editor').length,
      viewers: members.filter((m) => m.role === 'viewer').length,
    };
  }
}

// Export singleton instance
export const memberManager = new MemberManager();
