/**
 * Workspace Manager Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  CreateWorkspaceData,
  Workspace,
} from '../../../types/collaboration';
import { WorkspaceManager } from '../workspaceManager';

describe('WorkspaceManager', () => {
  let manager: WorkspaceManager;

  beforeEach(() => {
    manager = new WorkspaceManager();
  });

  afterEach(() => {
    manager.clear();
  });

  describe('create', () => {
    it('should create a new workspace', async () => {
      const data: CreateWorkspaceData = {
        name: 'Test Workspace',
        description: 'A test workspace',
        ownerId: 'user1',
        visibility: 'private',
      };

      const workspace = await manager.create(data);

      expect(workspace.id).toBeDefined();
      expect(workspace.name).toBe('Test Workspace');
      expect(workspace.description).toBe('A test workspace');
      expect(workspace.ownerId).toBe('user1');
      expect(workspace.visibility).toBe('private');
      expect(workspace.members).toHaveLength(1);
      expect(workspace.members[0].userId).toBe('user1');
      expect(workspace.members[0].role).toBe('owner');
      expect(workspace.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('should create workspace with default settings', async () => {
      const data: CreateWorkspaceData = {
        name: 'Test Workspace',
        ownerId: 'user1',
      };

      const workspace = await manager.create(data);

      // visibility is only set if provided
      expect(workspace.visibility).toBeUndefined();
      expect(workspace.settings.requireReview).toBe(true); // Default is true
      expect(workspace.settings.minReviewers).toBe(1);
    });

    it('should create workspace with custom settings', async () => {
      const data: CreateWorkspaceData = {
        name: 'Test Workspace',
        ownerId: 'user1',
        visibility: 'public',
        settings: {
          requireReview: true,
          minReviewers: 2,
          autoMerge: false,
          branchProtection: true,
        },
      };

      const workspace = await manager.create(data);

      expect(workspace.visibility).toBe('public');
      expect(workspace.settings.requireReview).toBe(true);
      expect(workspace.settings.minReviewers).toBe(2);
    });
  });

  describe('get', () => {
    it('should retrieve a workspace by ID', async () => {
      const data: CreateWorkspaceData = {
        name: 'Test Workspace',
        ownerId: 'user1',
      };

      const created = await manager.create(data);
      const retrieved = await manager.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Workspace');
    });

    it('should return null for non-existent workspace', async () => {
      const result = await manager.get('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update workspace name and description', async () => {
      const workspace = await manager.create({
        name: 'Original Name',
        ownerId: 'user1',
      });

      await manager.update(workspace.id, {
        name: 'Updated Name',
        description: 'Updated description',
      });

      const updated = await manager.get(workspace.id);
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Updated description');
    });

    it('should update workspace visibility', async () => {
      const workspace = await manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
        visibility: 'private',
      });

      await manager.update(workspace.id, { visibility: 'public' });

      const updated = await manager.get(workspace.id);
      expect(updated?.visibility).toBe('public');
    });

    it('should update workspace settings using updateSettings', async () => {
      const workspace = await manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
      });

      await manager.updateSettings(workspace.id, {
        requireReview: true,
        minReviewers: 3,
        autoMerge: true,
        branchProtection: true,
      });

      const updated = await manager.get(workspace.id);
      expect(updated?.settings.requireReview).toBe(true);
      expect(updated?.settings.minReviewers).toBe(3);
    });

    it('should throw error for non-existent workspace', async () => {
      await expect(
        manager.update('non-existent', { name: 'New Name' }),
      ).rejects.toThrow('Workspace not found');
    });
  });

  describe('delete', () => {
    it('should delete a workspace', async () => {
      const workspace = await manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
      });

      await manager.delete(workspace.id);
      const result = await manager.get(workspace.id);

      expect(result).toBeNull();
    });

    it('should throw error for non-existent workspace', async () => {
      await expect(manager.delete('non-existent')).rejects.toThrow(
        'Workspace not found',
      );
    });
  });

  describe('list', () => {
    it('should list all workspaces for a user', async () => {
      await manager.create({ name: 'Workspace 1', ownerId: 'user1' });
      await manager.create({ name: 'Workspace 2', ownerId: 'user1' });
      await manager.create({ name: 'Workspace 3', ownerId: 'user2' });

      const user1Workspaces = await manager.list('user1');
      expect(user1Workspaces).toHaveLength(2);

      const user2Workspaces = await manager.list('user2');
      expect(user2Workspaces).toHaveLength(1);
    });

    it('should return empty array for user with no workspaces', async () => {
      const workspaces = await manager.list('non-existent');
      expect(workspaces).toEqual([]);
    });
  });

  describe('addMember', () => {
    it('should add a member to workspace', async () => {
      const workspace = await manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
      });

      await manager.addMember(workspace.id, 'user2', 'editor');

      const updated = await manager.get(workspace.id);
      expect(updated?.members).toHaveLength(2);
      expect(updated?.members.find((m) => m.userId === 'user2')?.role).toBe(
        'editor',
      );
    });

    it('should throw error for non-existent workspace', async () => {
      await expect(
        manager.addMember('non-existent', 'user2', 'editor'),
      ).rejects.toThrow('Workspace not found');
    });

    it('should not add duplicate member', async () => {
      const workspace = await manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
      });

      await expect(
        manager.addMember(workspace.id, 'user1', 'editor'),
      ).rejects.toThrow('User is already a member');
    });
  });

  describe('removeMember', () => {
    it('should remove a member from workspace', async () => {
      const workspace = await manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
      });

      await manager.addMember(workspace.id, 'user2', 'editor');
      await manager.removeMember(workspace.id, 'user2');

      const updated = await manager.get(workspace.id);
      expect(updated?.members).toHaveLength(1);
      expect(
        updated?.members.find((m) => m.userId === 'user2'),
      ).toBeUndefined();
    });

    it('should not allow removing owner', async () => {
      const workspace = await manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
      });

      await expect(manager.removeMember(workspace.id, 'user1')).rejects.toThrow(
        'Cannot remove workspace owner',
      );
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const workspace = await manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
      });

      await manager.addMember(workspace.id, 'user2', 'editor');
      await manager.updateMemberRole(workspace.id, 'user2', 'admin');

      const updated = await manager.get(workspace.id);
      expect(updated?.members.find((m) => m.userId === 'user2')?.role).toBe(
        'admin',
      );
    });

    it('should not allow changing owner role', async () => {
      const workspace = await manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
      });

      await expect(
        manager.updateMemberRole(workspace.id, 'user1', 'admin'),
      ).rejects.toThrow('Cannot change owner role');
    });
  });

  describe('getSettings', () => {
    it('should get workspace settings', async () => {
      const workspace = await manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
        settings: {
          requireReview: false,
          minReviewers: 2,
        },
      });

      const settings = await manager.getSettings(workspace.id);
      expect(settings.requireReview).toBe(false);
      expect(settings.minReviewers).toBe(2);
    });
  });

  describe('exists', () => {
    it('should return true for existing workspace', () => {
      manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
      });

      const allWorkspaces = manager['storage']['workspaces'];
      const id = allWorkspaces.keys().next().value;
      expect(manager.exists(id)).toBe(true);
    });

    it('should return false for non-existent workspace', () => {
      expect(manager.exists('non-existent')).toBe(false);
    });
  });

  describe('getByName', () => {
    it('should get workspace by name for owner', async () => {
      await manager.create({
        name: 'My Workspace',
        ownerId: 'user1',
      });

      const workspace = await manager.getByName('user1', 'My Workspace');
      expect(workspace).toBeDefined();
      expect(workspace?.name).toBe('My Workspace');
    });

    it('should return null for non-existent workspace', async () => {
      const workspace = await manager.getByName('user1', 'Non-existent');
      expect(workspace).toBeNull();
    });
  });

  describe('getMemberCount', () => {
    it('should return member count', async () => {
      const workspace = await manager.create({
        name: 'Test Workspace',
        ownerId: 'user1',
      });

      expect(manager.getMemberCount(workspace.id)).toBe(1);

      await manager.addMember(workspace.id, 'user2', 'editor');
      expect(manager.getMemberCount(workspace.id)).toBe(2);
    });

    it('should return 0 for non-existent workspace', () => {
      expect(manager.getMemberCount('non-existent')).toBe(0);
    });
  });
});
