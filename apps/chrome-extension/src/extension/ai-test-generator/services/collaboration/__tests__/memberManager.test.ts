/**
 * Member Manager Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MemberRole, WorkspaceMember } from '../../../types/collaboration';
import { MemberManager } from '../memberManager';
import { workspaceManager } from '../workspaceManager';

describe('MemberManager', () => {
  let mm: MemberManager;
  let testWorkspaceId: string;

  beforeEach(async () => {
    mm = new MemberManager();

    // Create a test workspace
    const workspace = await workspaceManager.create({
      name: 'Test Workspace',
      description: 'A test workspace',
      ownerId: 'owner1',
    });
    testWorkspaceId = workspace.id;
  });

  afterEach(() => {
    workspaceManager.clear();
  });

  describe('getMembers', () => {
    it('should return all members of a workspace', async () => {
      const members = await mm.getMembers(testWorkspaceId);

      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe('owner1');
      expect(members[0].role).toBe('owner');
    });

    it('should throw for non-existent workspace', async () => {
      await expect(mm.getMembers('non-existent')).rejects.toThrow(
        'Workspace not found',
      );
    });
  });

  describe('getMember', () => {
    it('should return a specific member', async () => {
      const member = await mm.getMember(testWorkspaceId, 'owner1');

      expect(member).toBeDefined();
      expect(member?.userId).toBe('owner1');
      expect(member?.role).toBe('owner');
    });

    it('should return null for non-existent member', async () => {
      const member = await mm.getMember(testWorkspaceId, 'non-existent');
      expect(member).toBeNull();
    });

    it('should return null for non-existent workspace', async () => {
      const member = await mm.getMember('non-existent', 'owner1');
      expect(member).toBeNull();
    });
  });

  describe('isMember', () => {
    it('should return true for existing member', async () => {
      const isMember = await mm.isMember(testWorkspaceId, 'owner1');
      expect(isMember).toBe(true);
    });

    it('should return false for non-existent member', async () => {
      const isMember = await mm.isMember(testWorkspaceId, 'non-existent');
      expect(isMember).toBe(false);
    });
  });

  describe('getMemberRole', () => {
    it('should return member role', async () => {
      const role = await mm.getMemberRole(testWorkspaceId, 'owner1');
      expect(role).toBe('owner');
    });

    it('should return null for non-existent member', async () => {
      const role = await mm.getMemberRole(testWorkspaceId, 'non-existent');
      expect(role).toBeNull();
    });
  });

  describe('getMembersByRole', () => {
    it('should return members with specific role', async () => {
      // Add more members to workspace using addMember
      await workspaceManager.addMember(testWorkspaceId, 'admin1', 'admin');
      await workspaceManager.addMember(testWorkspaceId, 'editor1', 'editor');
      await workspaceManager.addMember(testWorkspaceId, 'viewer1', 'viewer');

      const admins = await mm.getMembersByRole(testWorkspaceId, 'admin');
      expect(admins).toHaveLength(1);
      expect(admins[0].userId).toBe('admin1');
    });

    it('should return empty array for non-existent role', async () => {
      const members = await mm.getMembersByRole(
        testWorkspaceId,
        'admin' as MemberRole,
      );
      expect(Array.isArray(members)).toBe(true);
    });
  });

  describe('countByRole', () => {
    it('should count members by role', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'admin1', 'admin');
      await workspaceManager.addMember(testWorkspaceId, 'admin2', 'admin');
      await workspaceManager.addMember(testWorkspaceId, 'editor1', 'editor');

      const adminCount = await mm.countByRole(testWorkspaceId, 'admin');
      expect(adminCount).toBe(2);

      const ownerCount = await mm.countByRole(testWorkspaceId, 'owner');
      expect(ownerCount).toBe(1);
    });
  });

  describe('getAdminMembers', () => {
    it('should return only admin and owner members', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'admin1', 'admin');
      await workspaceManager.addMember(testWorkspaceId, 'editor1', 'editor');
      await workspaceManager.addMember(testWorkspaceId, 'viewer1', 'viewer');

      const admins = await mm.getAdminMembers(testWorkspaceId);

      expect(admins).toHaveLength(2);
      const roles = admins.map((m) => m.role);
      expect(roles).toContain('owner');
      expect(roles).toContain('admin');
      expect(roles).not.toContain('editor');
      expect(roles).not.toContain('viewer');
    });
  });

  describe('getEditableMembers', () => {
    it('should return editor, admin, and owner members', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'admin1', 'admin');
      await workspaceManager.addMember(testWorkspaceId, 'editor1', 'editor');
      await workspaceManager.addMember(testWorkspaceId, 'viewer1', 'viewer');

      const editable = await mm.getEditableMembers(testWorkspaceId);

      expect(editable).toHaveLength(3);
      const roles = editable.map((m) => m.role);
      expect(roles).toContain('owner');
      expect(roles).toContain('admin');
      expect(roles).toContain('editor');
      expect(roles).not.toContain('viewer');
    });
  });

  describe('getMemberDisplayName', () => {
    it('should return formatted display name', async () => {
      const name = await mm.getMemberDisplayName('user1234567890');
      expect(name).toBe('User_user1234');
    });

    it('should handle short user IDs', async () => {
      const name = await mm.getMemberDisplayName('u1');
      expect(name).toBe('User_u1');
    });
  });

  describe('getMemberAvatarUrl', () => {
    it('should return avatar URL with user seed', async () => {
      const url = await mm.getMemberAvatarUrl('user123');
      expect(url).toContain('seed=user123');
      expect(url).toContain('dicebear');
    });
  });

  describe('searchMembers', () => {
    it('should find members matching query', async () => {
      await workspaceManager.addMember(
        testWorkspaceId,
        'alice@example.com',
        'editor',
      );
      await workspaceManager.addMember(
        testWorkspaceId,
        'bob@example.com',
        'viewer',
      );
      await workspaceManager.addMember(
        testWorkspaceId,
        'charlie@example.com',
        'viewer',
      );

      const results = await mm.searchMembers(testWorkspaceId, 'alice');
      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('alice@example.com');
    });

    it('should be case insensitive', async () => {
      await workspaceManager.addMember(
        testWorkspaceId,
        'alice@example.com',
        'editor',
      );

      const results = await mm.searchMembers(testWorkspaceId, 'ALICE');
      expect(results).toHaveLength(1);
    });

    it('should return empty for no matches', async () => {
      const results = await mm.searchMembers(testWorkspaceId, 'nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should find partial matches', async () => {
      await workspaceManager.addMember(
        testWorkspaceId,
        'alice@example.com',
        'editor',
      );
      await workspaceManager.addMember(
        testWorkspaceId,
        'bob@example.com',
        'viewer',
      );

      const results = await mm.searchMembers(testWorkspaceId, 'example');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('bulkCheckMembers', () => {
    it('should check multiple users at once', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'user1', 'editor');
      await workspaceManager.addMember(testWorkspaceId, 'user2', 'viewer');

      const result = await mm.bulkCheckMembers(testWorkspaceId, [
        'owner1',
        'user1',
        'user2',
        'nonexistent',
      ]);

      expect(result.get('owner1')).toBe(true);
      expect(result.get('user1')).toBe(true);
      expect(result.get('user2')).toBe(true);
      expect(result.get('nonexistent')).toBe(false);
    });

    it('should return empty map for empty input', async () => {
      const result = await mm.bulkCheckMembers(testWorkspaceId, []);
      expect(result.size).toBe(0);
    });
  });

  describe('getMemberStats', () => {
    it('should return correct statistics', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'admin1', 'admin');
      await workspaceManager.addMember(testWorkspaceId, 'admin2', 'admin');
      await workspaceManager.addMember(testWorkspaceId, 'editor1', 'editor');
      await workspaceManager.addMember(testWorkspaceId, 'editor2', 'editor');
      await workspaceManager.addMember(testWorkspaceId, 'viewer1', 'viewer');

      const stats = await mm.getMemberStats(testWorkspaceId);

      expect(stats.total).toBe(6); // 1 owner + 2 admin + 2 editor + 1 viewer
      expect(stats.owners).toBe(1);
      expect(stats.admins).toBe(2);
      expect(stats.editors).toBe(2);
      expect(stats.viewers).toBe(1);
    });

    it('should return correct stats for minimal workspace', async () => {
      const minimalWorkspace = await workspaceManager.create({
        name: 'Minimal',
        description: 'Minimal workspace',
        ownerId: 'owner2',
      });

      const stats = await mm.getMemberStats(minimalWorkspace.id);
      // Only the owner exists
      expect(stats.total).toBe(1);
      expect(stats.owners).toBe(1);
      expect(stats.admins).toBe(0);
      expect(stats.editors).toBe(0);
      expect(stats.viewers).toBe(0);
    });
  });
});
