/**
 * Invitation Service
 *
 * Manages workspace invitations.
 */

import type { Invitation, MemberRole } from '../../types/collaboration';
import type { CreateInvitationData, IInvitationService } from './interfaces';
import { workspaceManager } from './workspaceManager';

/**
 * Default invitation expiration (7 days)
 */
const DEFAULT_EXPIRATION = 7 * 24 * 60 * 60 * 1000;

/**
 * In-memory storage for invitations
 * In production, this would be replaced with a database
 */
interface InvitationStorage {
  invitations: Map<string, Invitation>;
  invitationsByWorkspace: Map<string, Set<string>>;
  invitationsByEmail: Map<string, Set<string>>;
}

/**
 * Invitation Service Implementation
 */
export class InvitationService implements IInvitationService {
  private storage: InvitationStorage;

  constructor() {
    this.storage = {
      invitations: new Map(),
      invitationsByWorkspace: new Map(),
      invitationsByEmail: new Map(),
    };
  }

  /**
   * Create an invitation
   */
  async create(data: CreateInvitationData): Promise<Invitation> {
    const id = this.generateId();
    const now = Date.now();
    const expiresAt = now + (data.expiresIn ?? DEFAULT_EXPIRATION);

    const invitation: Invitation = {
      id,
      workspaceId: data.workspaceId,
      invitedBy: data.invitedBy,
      email: data.email.toLowerCase(),
      role: data.role,
      status: 'pending',
      expiresAt,
      createdAt: now,
    };

    this.storage.invitations.set(id, invitation);
    this.addToIndex(this.storage.invitationsByWorkspace, data.workspaceId, id);
    this.addToIndex(this.storage.invitationsByEmail, invitation.email, id);

    return invitation;
  }

  /**
   * Get an invitation by ID
   */
  async get(id: string): Promise<Invitation | null> {
    const invitation = this.storage.invitations.get(id);
    return invitation ? { ...invitation } : null;
  }

  /**
   * Get pending invitations for a workspace
   */
  async getPendingForWorkspace(workspaceId: string): Promise<Invitation[]> {
    const invitationIds = this.storage.invitationsByWorkspace.get(workspaceId);
    if (!invitationIds) {
      return [];
    }

    const invitations: Invitation[] = [];
    for (const id of invitationIds) {
      const invitation = this.storage.invitations.get(id);
      if (
        invitation &&
        invitation.status === 'pending' &&
        !this.isExpired(invitation)
      ) {
        invitations.push({ ...invitation });
      }
    }

    return invitations;
  }

  /**
   * Get pending invitations for an email
   */
  async getPendingForEmail(email: string): Promise<Invitation[]> {
    const normalizedEmail = email.toLowerCase();
    const invitationIds = this.storage.invitationsByEmail.get(normalizedEmail);
    if (!invitationIds) {
      return [];
    }

    const invitations: Invitation[] = [];
    for (const id of invitationIds) {
      const invitation = this.storage.invitations.get(id);
      if (
        invitation &&
        invitation.status === 'pending' &&
        !this.isExpired(invitation)
      ) {
        invitations.push({ ...invitation });
      }
    }

    return invitations;
  }

  /**
   * Accept an invitation
   */
  async accept(id: string, userId: string): Promise<void> {
    const invitation = this.storage.invitations.get(id);
    if (!invitation) {
      throw new Error(`Invitation not found: ${id}`);
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation is not pending`);
    }

    if (this.isExpired(invitation)) {
      invitation.status = 'expired';
      throw new Error(`Invitation has expired`);
    }

    // Add user to workspace
    await workspaceManager.addMember(
      invitation.workspaceId,
      userId,
      invitation.role,
    );

    invitation.status = 'accepted';
  }

  /**
   * Decline an invitation
   */
  async decline(id: string): Promise<void> {
    const invitation = this.storage.invitations.get(id);
    if (!invitation) {
      throw new Error(`Invitation not found: ${id}`);
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation is not pending`);
    }

    invitation.status = 'declined';
  }

  /**
   * Cancel an invitation
   */
  async cancel(id: string): Promise<void> {
    const invitation = this.storage.invitations.get(id);
    if (!invitation) {
      throw new Error(`Invitation not found: ${id}`);
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Can only cancel pending invitations`);
    }

    // Remove from storage
    this.storage.invitations.delete(id);
    this.removeFromIndex(
      this.storage.invitationsByWorkspace,
      invitation.workspaceId,
      id,
    );
    this.removeFromIndex(this.storage.invitationsByEmail, invitation.email, id);
  }

  /**
   * Send invitation email
   * In production, this would integrate with an email service
   */
  async sendEmail(invitation: Invitation): Promise<void> {
    // In production, integrate with email service like SendGrid, AWS SES, etc.
    console.log(`[InvitationService] Sending email to ${invitation.email}`);
    console.log(`Invitation ID: ${invitation.id}`);
    console.log(`Workspace: ${invitation.workspaceId}`);
    console.log(`Role: ${invitation.role}`);
    console.log(`Expires: ${new Date(invitation.expiresAt).toISOString()}`);

    // Simulate email sending
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Create and send invitation
   */
  async createAndSend(data: CreateInvitationData): Promise<Invitation> {
    const invitation = await this.create(data);
    await this.sendEmail(invitation);
    return invitation;
  }

  /**
   * Clean up expired invitations
   */
  async cleanupExpired(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();

    for (const [id, invitation] of this.storage.invitations.entries()) {
      if (invitation.status === 'pending' && invitation.expiresAt < now) {
        invitation.status = 'expired';
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get invitation by token (for public accept links)
   */
  async getByToken(token: string): Promise<Invitation | null> {
    return this.get(token);
  }

  /**
   * Generate invite link
   */
  generateInviteLink(invitationId: string): string {
    // In production, this would use your actual domain
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://example.com';
    return `${origin}/invite/${invitationId}`;
  }

  /**
   * Validate invitation
   */
  async validate(id: string): Promise<boolean> {
    const invitation = this.storage.invitations.get(id);
    if (!invitation) {
      return false;
    }

    return invitation.status === 'pending' && !this.isExpired(invitation);
  }

  /**
   * Check if an invitation exists for email and workspace
   */
  async existsForWorkspace(
    workspaceId: string,
    email: string,
  ): Promise<boolean> {
    const pending = await this.getPendingForWorkspace(workspaceId);
    const normalizedEmail = email.toLowerCase();
    return pending.some((inv) => inv.email === normalizedEmail);
  }

  /**
   * Get invitation statistics
   */
  async getStats(workspaceId: string): Promise<{
    pending: number;
    accepted: number;
    declined: number;
    expired: number;
  }> {
    const invitationIds = this.storage.invitationsByWorkspace.get(workspaceId);
    if (!invitationIds) {
      return { pending: 0, accepted: 0, declined: 0, expired: 0 };
    }

    const stats = { pending: 0, accepted: 0, declined: 0, expired: 0 };

    for (const id of invitationIds) {
      const invitation = this.storage.invitations.get(id);
      if (invitation) {
        stats[invitation.status]++;
      }
    }

    return stats;
  }

  /**
   * Check if invitation is expired
   */
  private isExpired(invitation: Invitation): boolean {
    return Date.now() > invitation.expiresAt;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * Clear all invitations (for testing)
   */
  clear(): void {
    this.storage.invitations.clear();
    this.storage.invitationsByWorkspace.clear();
    this.storage.invitationsByEmail.clear();
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.invitations.size;
  }
}

// Export singleton instance
export const invitationService = new InvitationService();
