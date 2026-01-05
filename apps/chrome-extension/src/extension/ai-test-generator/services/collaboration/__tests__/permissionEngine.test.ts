/**
 * Permission Engine Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PermissionEngine } from '../permissionEngine';
import { workspaceManager } from '../workspaceManager';
import type { Resource, Action } from '../../../types/collaboration';

describe('PermissionEngine', () => {
  let pe: PermissionEngine;
  let testWorkspaceId: string;
  let testResource: Resource;

  beforeEach(async () => {
    pe = new PermissionEngine();

    // Create a test workspace
    const workspace = await workspaceManager.create({
      name: 'Test Workspace',
      description: 'A test workspace',
      ownerId: 'owner1',
    });
    testWorkspaceId = workspace.id;

    testResource = {
      id: 'resource1',
      type: 'test',
      workspaceId: testWorkspaceId,
    };
  });

  afterEach(() => {
    pe.clearCache();
    pe.clearResourcePermissions('resource1');
    workspaceManager.clear();
  });

  describe('check', () => {
    it('should allow owner to perform any action', async () => {
      const result = await pe.check('owner1', testResource, 'delete' as Action);

      expect(result.allowed).toBe(true);
    });

    it('should deny non-member', async () => {
      const result = await pe.check('nonexistent', testResource, 'view' as Action);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not a member');
    });

    it('should cache permission checks', async () => {
      await pe.check('owner1', testResource, 'view' as Action);
      const cacheSize = pe.getCacheSize();

      expect(cacheSize).toBeGreaterThan(0);
    });
  });

  describe('checkBatch', () => {
    it('should check multiple permissions at once', async () => {
      const checks = [
        { resource: testResource, action: 'view' as Action },
        { resource: testResource, action: 'edit' as Action },
        { resource: testResource, action: 'delete' as Action },
      ];

      const results = await pe.checkBatch('owner1', checks);

      expect(results.size).toBe(3);
      expect(results.get('test:view')?.allowed).toBe(true);
      expect(results.get('test:edit')?.allowed).toBe(true);
      expect(results.get('test:delete')?.allowed).toBe(true);
    });
  });

  describe('getRolePermissions', () => {
    it('should return viewer permissions', () => {
      const permissions = pe.getRolePermissions('viewer');

      expect(permissions).toContain('view');
      expect(permissions).toContain('execute');
      expect(permissions).not.toContain('edit');
    });

    it('should return editor permissions', () => {
      const permissions = pe.getRolePermissions('editor');

      expect(permissions).toContain('view');
      expect(permissions).toContain('edit');
      expect(permissions).toContain('comment');
      expect(permissions).not.toContain('delete');
    });

    it('should return admin permissions', () => {
      const permissions = pe.getRolePermissions('admin');

      expect(permissions).toContain('view');
      expect(permissions).toContain('edit');
      expect(permissions).toContain('delete');
      expect(permissions).toContain('manage_members');
    });

    it('should return owner wildcard permissions', () => {
      const permissions = pe.getRolePermissions('owner');

      expect(permissions).toContain('*');
    });
  });

  describe('roleHasPermission', () => {
    it('should return true for viewer viewing', () => {
      expect(pe.roleHasPermission('viewer', 'view' as Action)).toBe(true);
    });

    it('should return false for viewer editing', () => {
      expect(pe.roleHasPermission('viewer', 'edit' as Action)).toBe(false);
    });

    it('should return true for editor editing', () => {
      expect(pe.roleHasPermission('editor', 'edit' as Action)).toBe(true);
    });

    it('should return true for owner with any action', () => {
      expect(pe.roleHasPermission('owner', 'any_action' as Action)).toBe(true);
    });
  });

  describe('getUserRole', () => {
    it('should return owner role for workspace owner', async () => {
      const role = await pe.getUserRole('owner1', testWorkspaceId);

      expect(role).toBe('owner');
    });

    it('should return null for non-member', async () => {
      const role = await pe.getUserRole('nonexistent', testWorkspaceId);

      expect(role).toBeNull();
    });
  });

  describe('grantResourcePermission', () => {
    it('should grant permission to user', async () => {
      // Add a viewer to workspace
      await workspaceManager.addMember(testWorkspaceId, 'viewer1', 'viewer');

      // Grant edit permission on specific resource
      pe.grantResourcePermission('resource1', 'viewer1', 'edit' as Action);

      const result = await pe.check(
        'viewer1',
        testResource,
        'edit' as Action
      );

      expect(result.allowed).toBe(true);
    });

    it('should accumulate multiple grants', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'viewer1', 'viewer');

      pe.grantResourcePermission('resource1', 'viewer1', 'edit' as Action);
      pe.grantResourcePermission('resource1', 'viewer1', 'delete' as Action);

      const editResult = await pe.check('viewer1', testResource, 'edit' as Action);
      const deleteResult = await pe.check('viewer1', testResource, 'delete' as Action);

      expect(editResult.allowed).toBe(true);
      expect(deleteResult.allowed).toBe(true);
    });
  });

  describe('revokeResourcePermission', () => {
    it('should revoke granted permission', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'editor1', 'editor');

      // First grant
      pe.grantResourcePermission('resource1', 'editor1', 'delete' as Action);

      // Then revoke
      pe.revokeResourcePermission('resource1', 'editor1', 'delete' as Action);

      const result = await pe.check(
        'editor1',
        testResource,
        'delete' as Action
      );

      expect(result.allowed).toBe(false);
    });

    it('should deny action after revoking role permission', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'editor1', 'editor');

      // Editor normally can edit
      const before = await pe.check('editor1', testResource, 'edit' as Action);
      expect(before.allowed).toBe(true);

      // But explicitly revoke on this resource
      pe.revokeResourcePermission('resource1', 'editor1', 'edit' as Action);

      const after = await pe.check('editor1', testResource, 'edit' as Action);
      expect(after.allowed).toBe(false);
      expect(after.reason).toContain('denied');
    });
  });

  describe('clearResourcePermissions', () => {
    it('should clear all permissions for a resource', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'viewer1', 'viewer');

      pe.grantResourcePermission('resource1', 'viewer1', 'edit' as Action);
      pe.clearResourcePermissions('resource1');

      const result = await pe.check('viewer1', testResource, 'edit' as Action);

      expect(result.allowed).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear permission cache', async () => {
      await pe.check('owner1', testResource, 'view' as Action);
      expect(pe.getCacheSize()).toBeGreaterThan(0);

      pe.clearCache();
      expect(pe.getCacheSize()).toBe(0);
    });
  });

  describe('getRoleHierarchy', () => {
    it('should return roles in order', () => {
      const hierarchy = PermissionEngine.getRoleHierarchy();

      expect(hierarchy).toEqual(['viewer', 'editor', 'admin', 'owner']);
    });
  });

  describe('compareRoles', () => {
    it('should return positive when roleA > roleB', () => {
      expect(PermissionEngine.compareRoles('admin', 'viewer')).toBeGreaterThan(0);
    });

    it('should return negative when roleA < roleB', () => {
      expect(PermissionEngine.compareRoles('viewer', 'admin')).toBeLessThan(0);
    });

    it('should return zero for equal roles', () => {
      expect(PermissionEngine.compareRoles('editor', 'editor')).toBe(0);
    });
  });

  describe('roleCanActAs', () => {
    it('should allow higher role to act as lower', () => {
      expect(PermissionEngine.roleCanActAs('admin', 'viewer')).toBe(true);
      expect(PermissionEngine.roleCanActAs('admin', 'editor')).toBe(true);
    });

    it('should not allow lower role to act as higher', () => {
      expect(PermissionEngine.roleCanActAs('viewer', 'admin')).toBe(false);
    });

    it('should allow role to act as itself', () => {
      expect(PermissionEngine.roleCanActAs('editor', 'editor')).toBe(true);
    });
  });

  describe('resource-specific permission overrides', () => {
    it('should allow explicitly granted permission', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'viewer1', 'viewer');

      pe.grantResourcePermission('resource1', 'viewer1', 'edit' as Action);

      const result = await pe.check('viewer1', testResource, 'edit' as Action);
      expect(result.allowed).toBe(true);
    });

    it('should deny explicitly revoked permission', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'editor1', 'editor');

      pe.revokeResourcePermission('resource1', 'editor1', 'edit' as Action);

      const result = await pe.check('editor1', testResource, 'edit' as Action);
      expect(result.allowed).toBe(false);
    });
  });

  describe('permission cache', () => {
    it('should cache results for TTL period', async () => {
      await pe.check('owner1', testResource, 'view' as Action);
      const firstSize = pe.getCacheSize();

      // Second check should use cache
      await pe.check('owner1', testResource, 'view' as Action);
      const secondSize = pe.getCacheSize();

      expect(firstSize).toBe(secondSize);
    });
  });
});
