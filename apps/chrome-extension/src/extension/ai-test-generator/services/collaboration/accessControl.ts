/**
 * Access Control Service
 *
 * Manages resource-level access control and inherited permissions.
 */

import type { Resource, Action } from '../../types/collaboration';
import type { IAccessControl } from './interfaces';
import { permissionEngine } from './permissionEngine';

/**
 * Inheritance relationship between resources
 */
interface Inheritance {
  resourceId: string;
  inheritFrom: string;
}

/**
 * Access Control Implementation
 */
export class AccessControl implements IAccessControl {
  private inheritances: Map<string, Inheritance>;

  constructor() {
    this.inheritances = new Map();
  }

  /**
   * Grant a permission on a resource
   */
  async grant(
    resource: Resource,
    userId: string,
    action: Action
  ): Promise<void> {
    permissionEngine.grantResourcePermission(resource.id, userId, action);
  }

  /**
   * Revoke a permission on a resource
   */
  async revoke(
    resource: Resource,
    userId: string,
    action: Action
  ): Promise<void> {
    permissionEngine.revokeResourcePermission(resource.id, userId, action);
  }

  /**
   * Check resource-level permissions
   */
  async checkResourcePermission(
    userId: string,
    resource: Resource,
    action: Action
  ): Promise<boolean> {
    // First check if explicitly denied at resource level
    const result = await permissionEngine.check(userId, resource, action);

    // If not explicitly allowed, check inherited permissions
    if (!result.allowed) {
      const inherited = this.getInheritedResource(resource.id);
      if (inherited) {
        const inheritedResource: Resource = {
          ...resource,
          id: inherited,
        };
        return this.checkResourcePermission(userId, inheritedResource, action);
      }
    }

    return result.allowed;
  }

  /**
   * Set inherited permissions
   */
  async setInherited(
    resource: Resource,
    inheritFrom: Resource
  ): Promise<void> {
    this.inheritances.set(resource.id, {
      resourceId: resource.id,
      inheritFrom: inheritFrom.id,
    });
  }

  /**
   * Remove inheritance
   */
  async removeInheritance(resourceId: string): Promise<void> {
    this.inheritances.delete(resourceId);
  }

  /**
   * Get the resource this resource inherits from
   */
  getInheritedResource(resourceId: string): string | null {
    const inheritance = this.inheritances.get(resourceId);
    return inheritance ? inheritance.inheritFrom : null;
  }

  /**
   * Get all resources that inherit from a resource
   */
  getInheritingResources(resourceId: string): string[] {
    const inheriting: string[] = [];
    for (const [id, inheritance] of this.inheritances.entries()) {
      if (inheritance.inheritFrom === resourceId) {
        inheriting.push(id);
      }
    }
    return inheriting;
  }

  /**
   * Check if a resource has inheritance
   */
  hasInheritance(resourceId: string): boolean {
    return this.inheritances.has(resourceId);
  }

  /**
   * Clear all inheritances
   */
  clearInheritances(): void {
    this.inheritances.clear();
  }

  /**
   * Get inheritance chain for a resource
   */
  getInheritanceChain(resourceId: string): string[] {
    const chain: string[] = [];
    let current = resourceId;
    const visited = new Set<string>();

    while (current && !visited.has(current)) {
      visited.add(current);
      chain.push(current);
      const inherited = this.getInheritedResource(current);
      current = inherited || '';
    }

    return chain;
  }

  /**
   * Set permission on a resource and all its descendants
   */
  async grantRecursive(
    resource: Resource,
    userId: string,
    action: Action
  ): Promise<void> {
    await this.grant(resource, userId, action);

    // Grant to all inheriting resources
    const descendants = this.getInheritingResources(resource.id);
    for (const descendantId of descendants) {
      await this.grantRecursive(
        { ...resource, id: descendantId },
        userId,
        action
      );
    }
  }

  /**
   * Revoke permission on a resource and all its descendants
   */
  async revokeRecursive(
    resource: Resource,
    userId: string,
    action: Action
  ): Promise<void> {
    await this.revoke(resource, userId, action);

    // Revoke from all inheriting resources
    const descendants = this.getInheritingResources(resource.id);
    for (const descendantId of descendants) {
      await this.revokeRecursive(
        { ...resource, id: descendantId },
        userId,
        action
      );
    }
  }

  /**
   * Copy permissions from one resource to another
   */
  async copyPermissions(
    fromResource: Resource,
    toResource: Resource
  ): Promise<void> {
    // In production, this would copy actual permissions
    // For now, we just set up inheritance
    await this.setInherited(toResource, fromResource);
  }

  /**
   * Get inheritance count (for testing)
   */
  size(): number {
    return this.inheritances.size;
  }
}

// Export singleton instance
export const accessControl = new AccessControl();
