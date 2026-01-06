/**
 * Permission Engine Service
 *
 * Handles permission checking and validation for collaborative operations.
 */

import type {
  Action,
  MemberRole,
  PermissionCheck,
  Resource,
} from '../../types/collaboration';
import type { IPermissionEngine } from './interfaces';
import { memberManager } from './memberManager';

/**
 * Permission matrix defining what each role can do
 */
const ROLE_PERMISSIONS: Record<MemberRole, Action[]> = {
  viewer: ['view', 'execute'],
  editor: ['view', 'execute', 'edit', 'comment', 'review'],
  admin: [
    'view',
    'execute',
    'edit',
    'delete',
    'comment',
    'review',
    'manage_members',
    'settings',
  ],
  owner: ['*'], // Wildcard means all permissions
};

/**
 * Resource-specific permission overrides
 * In production, these would be stored in database
 */
interface ResourcePermission {
  resourceId: string;
  userId: string;
  allowedActions: Action[];
  deniedActions: Action[];
}

/**
 * Permission cache entry
 */
interface CacheEntry {
  allowed: boolean;
  timestamp: number;
}

/**
 * Permission Engine Implementation
 */
export class PermissionEngine implements IPermissionEngine {
  private cache: Map<string, CacheEntry>;
  private resourcePermissions: Map<string, ResourcePermission[]>;
  private cacheTTL = 60000; // 1 minute cache

  constructor() {
    this.cache = new Map();
    this.resourcePermissions = new Map();
  }

  /**
   * Check if a user can perform an action
   */
  async check(
    userId: string,
    resource: Resource,
    action: Action,
  ): Promise<PermissionCheck> {
    // Check cache first
    const cacheKey = this.getCacheKey(userId, resource, action);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return { allowed: cached.allowed };
    }

    // Get user's role in workspace
    const role = await memberManager.getMemberRole(
      resource.workspaceId,
      userId,
    );

    if (!role) {
      const result: PermissionCheck = {
        allowed: false,
        reason: 'User is not a member of this workspace',
      };
      this.setCache(cacheKey, result.allowed);
      return result;
    }

    // Check resource-specific overrides FIRST (can grant beyond role or deny role permissions)
    const resourceOverride = this.checkResourceOverride(
      resource.id,
      userId,
      action,
    );
    if (resourceOverride !== null) {
      const result: PermissionCheck = {
        allowed: resourceOverride,
        reason: resourceOverride
          ? undefined
          : 'Explicitly denied by resource policy',
      };
      this.setCache(cacheKey, result.allowed);
      return result;
    }

    // No override, check role permissions
    const roleAllowed = this.roleHasPermission(role, action);
    if (!roleAllowed) {
      const result: PermissionCheck = {
        allowed: false,
        reason: `Role '${role}' does not have permission '${action}'`,
        requiredRole: this.getRequiredRole(action),
      };
      this.setCache(cacheKey, result.allowed);
      return result;
    }

    this.setCache(cacheKey, true);
    return { allowed: true };
  }

  /**
   * Check multiple permissions at once
   */
  async checkBatch(
    userId: string,
    checks: Array<{ resource: Resource; action: Action }>,
  ): Promise<Map<string, PermissionCheck>> {
    const results = new Map<string, PermissionCheck>();

    for (const check of checks) {
      const key = `${check.resource.type}:${check.action}`;
      const result = await this.check(userId, check.resource, check.action);
      results.set(key, result);
    }

    return results;
  }

  /**
   * Get all permissions for a role
   */
  getRolePermissions(role: MemberRole): Action[] {
    return [...ROLE_PERMISSIONS[role]];
  }

  /**
   * Check if a role has a specific permission
   */
  roleHasPermission(role: MemberRole, action: Action): boolean {
    const permissions = ROLE_PERMISSIONS[role];
    return permissions.includes('*') || permissions.includes(action);
  }

  /**
   * Get a user's role in a workspace
   */
  async getUserRole(
    userId: string,
    workspaceId: string,
  ): Promise<MemberRole | null> {
    return memberManager.getMemberRole(workspaceId, userId);
  }

  /**
   * Grant a permission on a resource
   */
  grantResourcePermission(
    resourceId: string,
    userId: string,
    action: Action,
  ): void {
    const key = `resource:${resourceId}`;
    if (!this.resourcePermissions.has(key)) {
      this.resourcePermissions.set(key, []);
    }

    const permissions = this.resourcePermissions.get(key)!;
    const existing = permissions.find((p) => p.userId === userId);

    if (existing) {
      if (!existing.allowedActions.includes(action)) {
        existing.allowedActions.push(action);
      }
      // Remove from denied if present
      existing.deniedActions = existing.deniedActions.filter(
        (a) => a !== action,
      );
    } else {
      permissions.push({
        resourceId,
        userId,
        allowedActions: [action],
        deniedActions: [],
      });
    }

    // Clear cache for this resource
    this.clearResourceCache(resourceId);
  }

  /**
   * Revoke a permission on a resource
   */
  revokeResourcePermission(
    resourceId: string,
    userId: string,
    action: Action,
  ): void {
    const key = `resource:${resourceId}`;
    if (!this.resourcePermissions.has(key)) {
      this.resourcePermissions.set(key, []);
    }

    const permissions = this.resourcePermissions.get(key)!;
    let existing = permissions.find((p) => p.userId === userId);

    if (!existing) {
      // Create new entry for this user with this action explicitly denied
      existing = {
        resourceId,
        userId,
        allowedActions: [],
        deniedActions: [action],
      };
      permissions.push(existing);
    } else {
      // Remove from allowed if present
      existing.allowedActions = existing.allowedActions.filter(
        (a) => a !== action,
      );
      // Add to denied if not already there
      if (!existing.deniedActions.includes(action)) {
        existing.deniedActions.push(action);
      }
    }

    // Clear cache for this resource
    this.clearResourceCache(resourceId);
  }

  /**
   * Clear resource-specific permissions
   */
  clearResourcePermissions(resourceId: string): void {
    const key = `resource:${resourceId}`;
    this.resourcePermissions.delete(key);
    this.clearResourceCache(resourceId);
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get all roles ordered by permission level
   */
  static getRoleHierarchy(): MemberRole[] {
    return ['viewer', 'editor', 'admin', 'owner'];
  }

  /**
   * Compare two roles
   * Returns positive if roleA > roleB, negative if roleA < roleB, 0 if equal
   */
  static compareRoles(roleA: MemberRole, roleB: MemberRole): number {
    const hierarchy = this.getRoleHierarchy();
    return hierarchy.indexOf(roleA) - hierarchy.indexOf(roleB);
  }

  /**
   * Check if one role can perform actions of another role
   */
  static roleCanActAs(actor: MemberRole, target: MemberRole): boolean {
    return this.compareRoles(actor, target) >= 0;
  }

  /**
   * Get the minimum required role for an action
   */
  private getRequiredRole(action: Action): MemberRole {
    for (const role of PermissionEngine.getRoleHierarchy()) {
      if (this.roleHasPermission(role, action)) {
        return role;
      }
    }
    return 'owner';
  }

  /**
   * Check resource-specific permission overrides
   * Returns true if explicitly allowed, false if explicitly denied, null if no override
   */
  private checkResourceOverride(
    resourceId: string,
    userId: string,
    action: Action,
  ): boolean | null {
    const key = `resource:${resourceId}`;
    const permissions = this.resourcePermissions.get(key);
    const override = permissions?.find((p) => p.userId === userId);

    if (!override) {
      return null;
    }

    if (override.deniedActions.includes(action)) {
      return false;
    }

    if (override.allowedActions.includes(action)) {
      return true;
    }

    return null;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    userId: string,
    resource: Resource,
    action: Action,
  ): string {
    return `${userId}:${resource.workspaceId}:${resource.type}:${resource.id}:${action}`;
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, allowed: boolean): void {
    this.cache.set(key, {
      allowed,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    if (this.cache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (now - v.timestamp > this.cacheTTL) {
          this.cache.delete(k);
        }
      }
    }
  }

  /**
   * Clear cache for a specific resource
   */
  private clearResourceCache(resourceId: string): void {
    const prefix = `:${resourceId}:`;
    for (const key of this.cache.keys()) {
      if (key.includes(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size (for testing)
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

// Export singleton instance
export const permissionEngine = new PermissionEngine();
