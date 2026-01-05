/**
 * Collaboration Feature Type Definitions
 *
 * Provides comprehensive type definitions for the collaboration system including
 * workspaces, reviews, comments, version control, and real-time collaboration.
 */

// =============================================================================
// Workspace Types
// =============================================================================

/**
 * Represents a shared workspace for team collaboration
 */
export interface Workspace {
  /** Unique workspace identifier */
  id: string;
  /** Workspace display name */
  name: string;
  /** Workspace description */
  description: string;
  /** User ID of the workspace owner */
  ownerId: string;
  /** Visibility level of the workspace */
  visibility: WorkspaceVisibility;
  /** List of workspace members */
  members: WorkspaceMember[];
  /** Workspace configuration settings */
  settings: WorkspaceSettings;
  /** Creation timestamp (epoch ms) */
  createdAt: number;
  /** Last update timestamp (epoch ms) */
  updatedAt: number;
}

/**
 * Workspace visibility levels
 */
export type WorkspaceVisibility = 'private' | 'team' | 'public';

/**
 * Represents a member of a workspace
 */
export interface WorkspaceMember {
  /** User ID of the member */
  userId: string;
  /** Member's role in the workspace */
  role: MemberRole;
  /** When the member joined (epoch ms) */
  joinedAt: number;
  /** User ID of who invited this member */
  invitedBy: string;
}

/**
 * Member role with varying permission levels
 */
export type MemberRole = 'viewer' | 'editor' | 'admin' | 'owner';

/**
 * Workspace configuration settings
 */
export interface WorkspaceSettings {
  /** Whether review is required before merging changes */
  requireReview: boolean;
  /** Minimum number of reviewers required */
  minReviewers: number;
  /** Whether to auto-merge after approval */
  autoMerge: boolean;
  /** Whether branch protection is enabled */
  branchProtection: boolean;
}

// =============================================================================
// Review Types
// =============================================================================

/**
 * Represents a review request for changes
 */
export interface Review {
  /** Unique review identifier */
  id: string;
  /** Workspace this review belongs to */
  workspaceId: string;
  /** Review title */
  title: string;
  /** Review description */
  description: string;
  /** Current review status */
  status: ReviewStatus;
  /** User ID of the review author */
  author: string;
  /** List of assigned reviewers */
  reviewers: Reviewer[];
  /** List of changes in this review */
  changes: Change[];
  /** List of comments on this review */
  comments: Comment[];
  /** Creation timestamp (epoch ms) */
  createdAt: number;
  /** Last update timestamp (epoch ms) */
  updatedAt: number;
  /** When the review was merged (epoch ms) */
  mergedAt?: number;
}

/**
 * Review status states
 */
export type ReviewStatus =
  | 'draft'
  | 'pending'
  | 'changes_requested'
  | 'approved'
  | 'merged'
  | 'closed';

/**
 * Represents a reviewer assigned to a review
 */
export interface Reviewer {
  /** User ID of the reviewer */
  userId: string;
  /** Reviewer's status */
  status: ReviewerStatus;
  /** When the reviewer completed their review (epoch ms) */
  reviewedAt?: number;
}

/**
 * Reviewer status
 */
export type ReviewerStatus = 'pending' | 'approved' | 'changes_requested';

/**
 * Represents a single change in a review
 */
export interface Change {
  /** Unique change identifier */
  fileId: string;
  /** Name of the changed file */
  fileName: string;
  /** Type of change */
  changeType: ChangeType;
  /** Unified diff of the change */
  diff: string;
}

/**
 * Type of file change
 */
export type ChangeType = 'added' | 'modified' | 'deleted';

// =============================================================================
// Comment Types
// =============================================================================

/**
 * Represents a comment on a review or file
 */
export interface Comment {
  /** Unique comment identifier */
  id: string;
  /** Review ID if this is a review comment */
  reviewId?: string;
  /** File ID this comment is on */
  fileId: string;
  /** Line number for inline comments */
  lineNumber?: number;
  /** User ID of the comment author */
  author: string;
  /** Comment content (markdown supported) */
  content: string;
  /** List of mentioned user IDs */
  mentions: string[];
  /** Parent comment ID for replies */
  parentId?: string;
  /** Whether the comment is resolved */
  resolved: boolean;
  /** User ID of who resolved the comment */
  resolvedBy?: string;
  /** Creation timestamp (epoch ms) */
  createdAt: number;
  /** Last update timestamp (epoch ms) */
  updatedAt: number;
}

// =============================================================================
// Version Control Types
// =============================================================================

/**
 * Represents a version of a file
 */
export interface Version {
  /** Unique version identifier */
  id: string;
  /** File ID this version belongs to */
  fileId: string;
  /** Version string (e.g., "1.0.0") */
  version: string;
  /** File content at this version */
  content: string;
  /** User ID of the author */
  author: string;
  /** Commit message */
  message: string;
  /** Parent version ID */
  parentVersion?: string;
  /** Creation timestamp (epoch ms) */
  createdAt: number;
}

/**
 * Represents a diff between two versions
 */
export interface VersionDiff {
  /** First version ID */
  versionA: string;
  /** Second version ID */
  versionB: string;
  /** Number of added lines */
  additions: number;
  /** Number of deleted lines */
  deletions: number;
  /** Diff hunks */
  hunks: DiffHunk[];
}

/**
 * A hunk of diff output
 */
export interface DiffHunk {
  /** Start line in version A */
  startLineA: number;
  /** Start line in version B */
  startLineB: number;
  /** Lines in the hunk */
  lines: DiffLine[];
}

/**
 * A line in a diff hunk
 */
export interface DiffLine {
  /** Line type */
  type: 'context' | 'addition' | 'deletion';
  /** Line content */
  content: string;
  /** Line number in version A */
  lineNumberA?: number;
  /** Line number in version B */
  lineNumberB?: number;
}

// =============================================================================
// Real-time Collaboration Types
// =============================================================================

/**
 * Represents an active collaboration session
 */
export interface CollaborationSession {
  /** Unique session identifier */
  id: string;
  /** File ID being edited */
  fileId: string;
  /** Active participants */
  participants: Participant[];
  /** Current editor state */
  state: EditorState;
  /** Last activity timestamp (epoch ms) */
  lastActivity: number;
}

/**
 * Represents a participant in a collaboration session
 */
export interface Participant {
  /** User ID */
  userId: string;
  /** Cursor position */
  cursor: CursorPosition;
  /** Text selection range */
  selection: SelectionRange;
  /** Color for this user's cursor/selection */
  color: string;
  /** Last seen timestamp (epoch ms) */
  lastSeen: number;
}

/**
 * Cursor position in document
 */
export interface CursorPosition {
  /** Line number (0-indexed) */
  line: number;
  /** Column number (0-indexed) */
  column: number;
}

/**
 * Text selection range
 */
export interface SelectionRange {
  /** Start position */
  start: CursorPosition;
  /** End position */
  end: CursorPosition;
}

/**
 * Editor state snapshot
 */
export interface EditorState {
  /** Current document content */
  content: string;
  /** Current document version */
  version: number;
}

/**
 * An editing operation for OT/CRDT
 */
export interface EditorOperation {
  /** Operation type */
  type: 'insert' | 'delete' | 'retain';
  /** Position in document */
  position: number;
  /** Content to insert (for insert operations) */
  content?: string;
  /** Length to delete (for delete operations) */
  length?: number;
  /** User ID of the operation author */
  userId: string;
  /** Operation timestamp (epoch ms) */
  timestamp: number;
  /** Operation version for ordering */
  version: number;
}

// =============================================================================
// Knowledge Base Types
// =============================================================================

/**
 * Represents a knowledge base article
 */
export interface KnowledgeArticle {
  /** Unique article identifier */
  id: string;
  /** Article title */
  title: string;
  /** Article content (markdown) */
  content: string;
  /** Article category */
  category: string;
  /** Article tags */
  tags: string[];
  /** User ID of the author */
  author: string;
  /** List of contributor user IDs */
  contributors: string[];
  /** Number of views */
  views: number;
  /** Number of upvotes */
  upvotes: number;
  /** Creation timestamp (epoch ms) */
  createdAt: number;
  /** Last update timestamp (epoch ms) */
  updatedAt: number;
}

/**
 * Represents a knowledge base category
 */
export interface KnowledgeCategory {
  /** Unique category identifier */
  id: string;
  /** Category name */
  name: string;
  /** Category description */
  description: string;
  /** Parent category ID for hierarchical categories */
  parentId?: string;
  /** Number of articles in this category */
  articleCount: number;
}

/**
 * Search result for knowledge base
 */
export interface SearchResult {
  /** Article ID */
  id: string;
  /** Article title */
  title: string;
  /** Matching snippet */
  snippet: string;
  /** Relevance score */
  score: number;
}

/**
 * Knowledge search options
 */
export interface SearchOptions {
  /** Maximum number of results */
  limit?: number;
  /** Category filter */
  category?: string;
  /** Tag filter */
  tags?: string[];
  /** Sort order */
  sortBy?: 'relevance' | 'recent' | 'popular';
}

// =============================================================================
// Invitation Types
// =============================================================================

/**
 * Represents a workspace invitation
 */
export interface Invitation {
  /** Unique invitation identifier */
  id: string;
  /** Workspace ID */
  workspaceId: string;
  /** User ID of the inviter */
  invitedBy: string;
  /** Email address of invitee */
  email: string;
  /** Role to assign upon acceptance */
  role: MemberRole;
  /** Invitation status */
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  /** Expiration timestamp (epoch ms) */
  expiresAt: number;
  /** Creation timestamp (epoch ms) */
  createdAt: number;
}

// =============================================================================
// Permission Types
// =============================================================================

/**
 * Represents a resource for permission checking
 */
export interface Resource {
  /** Resource type */
  type: ResourceType;
  /** Resource identifier */
  id: string;
  /** Workspace ID this resource belongs to */
  workspaceId: string;
}

/**
 * Resource types in the system
 */
export type ResourceType =
  | 'workspace'
  | 'file'
  | 'review'
  | 'comment'
  | 'knowledge_article';

/**
 * Actions that can be performed on resources
 */
export type Action =
  | 'view'
  | 'edit'
  | 'delete'
  | 'execute'
  | 'comment'
  | 'review'
  | 'manage_members'
  | 'settings'
  | 'merge'
  | 'approve';

/**
 * Permission check result
 */
export interface PermissionCheck {
  /** Whether the action is permitted */
  allowed: boolean;
  /** Reason if not permitted */
  reason?: string;
  /** Required role for this action */
  requiredRole?: MemberRole;
}

// =============================================================================
// Audit Types
// =============================================================================

/**
 * Represents an audit log entry
 */
export interface AuditEntry {
  /** Unique entry identifier */
  id: string;
  /** User ID who performed the action */
  userId: string;
  /** Action performed */
  action: string;
  /** Resource type affected */
  resourceType: ResourceType;
  /** Resource ID affected */
  resourceId: string;
  /** Workspace ID */
  workspaceId: string;
  /** IP address of the request */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Whether the action succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Timestamp (epoch ms) */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// WebSocket Types
// =============================================================================

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | 'operation'
  | 'cursor'
  | 'participant_join'
  | 'participant_leave'
  | 'sync_request'
  | 'sync_response'
  | 'error';

/**
 * Base WebSocket message
 */
export interface WebSocketMessage {
  /** Message type */
  type: WebSocketMessageType;
  /** Session ID */
  sessionId?: string;
  /** User ID */
  userId: string;
  /** Timestamp (epoch ms) */
  timestamp: number;
}

/**
 * Operation message
 */
export interface OperationMessage extends WebSocketMessage {
  type: 'operation';
  operation: EditorOperation;
}

/**
 * Cursor message
 */
export interface CursorMessage extends WebSocketMessage {
  type: 'cursor';
  cursor: CursorPosition;
  selection?: SelectionRange;
}

/**
 * Participant join message
 */
export interface ParticipantJoinMessage extends WebSocketMessage {
  type: 'participant_join';
  participant: Participant;
}

/**
 * Participant leave message
 */
export interface ParticipantLeaveMessage extends WebSocketMessage {
  type: 'participant_leave';
  userId: string;
}

/**
 * Sync request message
 */
export interface SyncRequestMessage extends WebSocketMessage {
  type: 'sync_request';
  fromVersion: number;
}

/**
 * Sync response message
 */
export interface SyncResponseMessage extends WebSocketMessage {
  type: 'sync_response';
  operations: EditorOperation[];
  currentVersion: number;
}

/**
 * Error message
 */
export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  code: string;
  message: string;
}

// =============================================================================
// Branch Types
// =============================================================================

/**
 * Represents a branch for parallel editing
 */
export interface Branch {
  /** Unique branch identifier */
  id: string;
  /** Branch name */
  name: string;
  /** File ID this branch belongs to */
  fileId: string;
  /** Parent branch ID */
  parentId?: string;
  /** Current version of the file */
  version: string;
  /** User ID who created the branch */
  createdBy: string;
  /** Branch status */
  status: 'active' | 'merged' | 'abandoned';
  /** Creation timestamp (epoch ms) */
  createdAt: number;
}

// =============================================================================
// Statistics Types
// =============================================================================

/**
 * Workspace statistics
 */
export interface WorkspaceStats {
  /** Total number of members */
  memberCount: number;
  /** Total number of files */
  fileCount: number;
  /** Total number of reviews */
  reviewCount: number;
  /** Number of pending reviews */
  pendingReviews: number;
  /** Number of knowledge articles */
  articleCount: number;
  /** Activity in last 7 days */
  activityLast7Days: number;
}

/**
 * User collaboration statistics
 */
export interface UserStats {
  /** Total number of reviews created */
  reviewsCreated: number;
  /** Total number of reviews completed */
  reviewsCompleted: number;
  /** Total number of comments made */
  commentsMade: number;
  /** Total number of articles contributed */
  articlesContributed: number;
  /** Average review completion time (hours) */
  avgReviewTime: number;
}
