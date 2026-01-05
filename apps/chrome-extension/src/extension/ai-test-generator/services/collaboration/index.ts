/**
 * Collaboration Services Module
 *
 * Central export point for all collaboration-related services.
 */

// Core interfaces
export * from './interfaces';

// Workspace management
export * from './workspaceManager';
export * from './memberManager';
export * from './invitationService';

// Permission system
export * from './permissionEngine';
export * from './accessControl';
export * from './auditLogger';

// Review system
export * from './reviewSystem';
export * from './reviewerManager';
export * from './changeManager';

// Comment system
export * from './commentService';
export * from './mentionHandler';

// Version control
export * from './versionControl';
export * from './diffEngine';
export * from './branchManager';

// Real-time collaboration
export * from './collaborationHub';
export * from './ot';
export * from './syncEngine';

// Knowledge base
export * from './knowledgeBase';
export * from './categoryManager';
export * from './knowledgeSearch';

// Statistics
export * from './statisticsService';
