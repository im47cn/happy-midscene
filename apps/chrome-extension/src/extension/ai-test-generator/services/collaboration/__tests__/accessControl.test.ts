/**
 * Access Control Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Action, Resource } from '../../../types/collaboration';
import { AccessControl } from '../accessControl';
import { permissionEngine } from '../permissionEngine';
import { workspaceManager } from '../workspaceManager';

describe('AccessControl', () => {
  let ac: AccessControl;
  let testWorkspaceId: string;
  let parentResource: Resource;
  let childResource: Resource;

  beforeEach(async () => {
    ac = new AccessControl();
    permissionEngine.clearCache();

    // Create a test workspace
    const workspace = await workspaceManager.create({
      name: 'Test Workspace',
      description: 'A test workspace',
      ownerId: 'owner1',
    });
    testWorkspaceId = workspace.id;

    parentResource = {
      id: 'parent1',
      type: 'folder',
      workspaceId: testWorkspaceId,
    };

    childResource = {
      id: 'child1',
      type: 'file',
      workspaceId: testWorkspaceId,
    };
  });

  afterEach(() => {
    ac.clearInheritances();
    permissionEngine.clearCache();
    permissionEngine.clearResourcePermissions('parent1');
    permissionEngine.clearResourcePermissions('child1');
    permissionEngine.clearResourcePermissions('child2');
    permissionEngine.clearResourcePermissions('grandchild1');
    workspaceManager.clear();
  });

  describe('grant', () => {
    it('should grant permission on resource', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'user1', 'viewer');

      await ac.grant(parentResource, 'user1', 'edit' as Action);

      const result = await permissionEngine.check(
        'user1',
        parentResource,
        'edit' as Action,
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('revoke', () => {
    it('should revoke permission on resource', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'editor1', 'editor');

      await ac.revoke(parentResource, 'editor1', 'edit' as Action);

      const result = await permissionEngine.check(
        'editor1',
        parentResource,
        'edit' as Action,
      );

      expect(result.allowed).toBe(false);
    });
  });

  describe('checkResourcePermission', () => {
    it('should allow owner any action', async () => {
      const allowed = await ac.checkResourcePermission(
        'owner1',
        parentResource,
        'delete' as Action,
      );

      expect(allowed).toBe(true);
    });

    it('should deny non-member', async () => {
      const allowed = await ac.checkResourcePermission(
        'nonexistent',
        parentResource,
        'view' as Action,
      );

      expect(allowed).toBe(false);
    });

    it('should check role-based permissions', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'viewer1', 'viewer');

      const viewAllowed = await ac.checkResourcePermission(
        'viewer1',
        parentResource,
        'view' as Action,
      );

      const editAllowed = await ac.checkResourcePermission(
        'viewer1',
        parentResource,
        'edit' as Action,
      );

      expect(viewAllowed).toBe(true);
      expect(editAllowed).toBe(false);
    });
  });

  describe('setInherited', () => {
    it('should set inheritance relationship', async () => {
      await ac.setInherited(childResource, parentResource);

      expect(ac.hasInheritance(childResource.id)).toBe(true);
      expect(ac.getInheritedResource(childResource.id)).toBe(parentResource.id);
    });
  });

  describe('removeInheritance', () => {
    it('should remove inheritance', async () => {
      await ac.setInherited(childResource, parentResource);
      expect(ac.hasInheritance(childResource.id)).toBe(true);

      await ac.removeInheritance(childResource.id);

      expect(ac.hasInheritance(childResource.id)).toBe(false);
    });
  });

  describe('getInheritedResource', () => {
    it('should return parent resource id', async () => {
      await ac.setInherited(childResource, parentResource);

      const inherited = ac.getInheritedResource(childResource.id);

      expect(inherited).toBe(parentResource.id);
    });

    it('should return null when no inheritance', () => {
      const inherited = ac.getInheritedResource('nonexistent');

      expect(inherited).toBeNull();
    });
  });

  describe('getInheritingResources', () => {
    it('should return all child resources', async () => {
      await ac.setInherited(childResource, parentResource);

      const child2: Resource = { ...childResource, id: 'child2' };
      await ac.setInherited(child2, parentResource);

      const children = ac.getInheritingResources(parentResource.id);

      expect(children).toHaveLength(2);
      expect(children).toContain(childResource.id);
      expect(children).toContain('child2');
    });

    it('should return empty array when no children', () => {
      const children = ac.getInheritingResources('nonexistent');

      expect(children).toEqual([]);
    });
  });

  describe('hasInheritance', () => {
    it('should return true when inheritance exists', async () => {
      await ac.setInherited(childResource, parentResource);

      expect(ac.hasInheritance(childResource.id)).toBe(true);
    });

    it('should return false when no inheritance', () => {
      expect(ac.hasInheritance('nonexistent')).toBe(false);
    });
  });

  describe('clearInheritances', () => {
    it('should clear all inheritances', async () => {
      await ac.setInherited(childResource, parentResource);
      expect(ac.size()).toBeGreaterThan(0);

      ac.clearInheritances();

      expect(ac.size()).toBe(0);
    });
  });

  describe('getInheritanceChain', () => {
    it('should return full inheritance chain', async () => {
      const grandchild: Resource = { ...childResource, id: 'grandchild1' };

      await ac.setInherited(childResource, parentResource);
      await ac.setInherited(grandchild, childResource);

      const chain = ac.getInheritanceChain(grandchild.id);

      expect(chain).toEqual([
        'grandchild1',
        childResource.id,
        parentResource.id,
      ]);
    });

    it('should return single resource when no inheritance', () => {
      const chain = ac.getInheritanceChain('resource1');

      expect(chain).toEqual(['resource1']);
    });

    it('should handle circular references gracefully', async () => {
      await ac.setInherited(childResource, parentResource);

      // Create circular reference manually (simulate data corruption)
      (ac as any).inheritances.set(parentResource.id, {
        resourceId: parentResource.id,
        inheritFrom: childResource.id,
      });

      const chain = ac.getInheritanceChain(childResource.id);

      // Should stop at first repeat
      expect(chain).toContain(childResource.id);
    });
  });

  describe('grantRecursive', () => {
    it('should grant to all descendants', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'user1', 'viewer');

      const child2: Resource = { ...childResource, id: 'child2' };
      await ac.setInherited(childResource, parentResource);
      await ac.setInherited(child2, parentResource);

      await ac.grantRecursive(parentResource, 'user1', 'edit' as Action);

      // Check parent
      const parentAllowed = await permissionEngine.check(
        'user1',
        parentResource,
        'edit' as Action,
      );
      expect(parentAllowed.allowed).toBe(true);

      // Check children
      const child1Allowed = await permissionEngine.check(
        'user1',
        childResource,
        'edit' as Action,
      );
      expect(child1Allowed.allowed).toBe(true);

      const child2Allowed = await permissionEngine.check(
        'user1',
        child2,
        'edit' as Action,
      );
      expect(child2Allowed.allowed).toBe(true);
    });
  });

  describe('revokeRecursive', () => {
    it('should revoke from all descendants', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'editor1', 'editor');

      const child2: Resource = { ...childResource, id: 'child2' };
      await ac.setInherited(childResource, parentResource);
      await ac.setInherited(child2, parentResource);

      // First grant so we can revoke
      await ac.grantRecursive(parentResource, 'editor1', 'delete' as Action);

      // Then revoke
      await ac.revokeRecursive(parentResource, 'editor1', 'delete' as Action);

      // Check children are denied
      const child1Allowed = await permissionEngine.check(
        'editor1',
        childResource,
        'delete' as Action,
      );
      expect(child1Allowed.allowed).toBe(false);
    });
  });

  describe('copyPermissions', () => {
    it('should set up inheritance from source', async () => {
      await ac.copyPermissions(parentResource, childResource);

      expect(ac.getInheritedResource(childResource.id)).toBe(parentResource.id);
    });
  });

  describe('checkResourcePermission with inheritance', () => {
    it('should check inherited permissions', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'user1', 'viewer');

      await ac.setInherited(childResource, parentResource);

      // Grant permission on parent
      await ac.grant(parentResource, 'user1', 'edit' as Action);

      // Child should inherit
      const childAllowed = await ac.checkResourcePermission(
        'user1',
        childResource,
        'edit' as Action,
      );

      expect(childAllowed).toBe(true);
    });

    it('should fallback to parent when no direct permission', async () => {
      await workspaceManager.addMember(testWorkspaceId, 'user1', 'viewer');

      await ac.setInherited(childResource, parentResource);

      // Grant on parent, not child
      await ac.grant(parentResource, 'user1', 'edit' as Action);

      // Check child - should find parent's permission
      const allowed = await ac.checkResourcePermission(
        'user1',
        childResource,
        'edit' as Action,
      );

      expect(allowed).toBe(true);
    });
  });

  describe('size', () => {
    it('should return number of inheritances', async () => {
      expect(ac.size()).toBe(0);

      await ac.setInherited(childResource, parentResource);

      expect(ac.size()).toBe(1);
    });
  });
});
