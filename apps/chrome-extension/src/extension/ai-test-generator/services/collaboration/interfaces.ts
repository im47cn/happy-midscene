/**
 * Collaboration Feature Service Interfaces
 *
 * Defines all core service interfaces for the collaboration system.
 * Each interface represents a contract for a specific service module.
 */

import type {
  Action,
  AuditEntry,
  Branch,
  CollaborationSession,
  Comment,
  CursorPosition,
  EditorOperation,
  Invitation,
  KnowledgeArticle,
  MemberRole,
  Participant,
  PermissionCheck,
  Resource,
  Review,
  ReviewResult,
  Reviewer,
  ReviewerStatus,
  SearchOptions,
  SearchResult,
  Version,
  VersionDiff,
  Workspace,
  WorkspaceMember,
  WorkspaceSettings,
} from '../types/collaboration';

// =============================================================================
// Workspace Manager Interface
// =============================================================================

/**
 * Interface for workspace management operations
 */
export interface IWorkspaceManager {
  /**
   * Create a new workspace
   * @param data - Workspace creation data
   * @returns The created workspace
   */
  create(data: CreateWorkspaceData): Promise<Workspace>;

  /**
   * Update an existing workspace
   * @param id - Workspace ID
   * @param data - Update data
   */
  update(id: string, data: UpdateWorkspaceData): Promise<void>;

  /**
   * Delete a workspace
   * @param id - Workspace ID
   */
  delete(id: string): Promise<void>;

  /**
   * Get a workspace by ID
   * @param id - Workspace ID
   * @returns The workspace or null if not found
   */
  get(id: string): Promise<Workspace | null>;

  /**
   * List workspaces for a user
   * @param userId - User ID
   * @returns List of workspaces
   */
  list(userId: string): Promise<Workspace[]>;

  /**
   * Add a member to a workspace
   * @param workspaceId - Workspace ID
   * @param userId - User ID to add
   * @param role - Role to assign
   */
  addMember(
    workspaceId: string,
    userId: string,
    role: MemberRole,
  ): Promise<void>;

  /**
   * Remove a member from a workspace
   * @param workspaceId - Workspace ID
   * @param userId - User ID to remove
   */
  removeMember(workspaceId: string, userId: string): Promise<void>;

  /**
   * Update a member's role
   * @param workspaceId - Workspace ID
   * @param userId - User ID
   * @param role - New role
   */
  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: MemberRole,
  ): Promise<void>;

  /**
   * Get workspace settings
   * @param workspaceId - Workspace ID
   * @returns Workspace settings
   */
  getSettings(workspaceId: string): Promise<WorkspaceSettings>;

  /**
   * Update workspace settings
   * @param workspaceId - Workspace ID
   * @param settings - New settings
   */
  updateSettings(
    workspaceId: string,
    settings: Partial<WorkspaceSettings>,
  ): Promise<void>;
}

export interface CreateWorkspaceData {
  name: string;
  description: string;
  ownerId: string;
  visibility: Workspace['visibility'];
  settings?: Partial<WorkspaceSettings>;
}

export type UpdateWorkspaceData = Partial<
  Pick<Workspace, 'name' | 'description' | 'visibility'>
>;

// =============================================================================
// Member Manager Interface
// =============================================================================

/**
 * Interface for member management operations
 */
export interface IMemberManager {
  /**
   * Get all members of a workspace
   * @param workspaceId - Workspace ID
   * @returns List of members
   */
  getMembers(workspaceId: string): Promise<WorkspaceMember[]>;

  /**
   * Get a specific member
   * @param workspaceId - Workspace ID
   * @param userId - User ID
   * @returns Member or null if not found
   */
  getMember(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null>;

  /**
   * Check if a user is a member
   * @param workspaceId - Workspace ID
   * @param userId - User ID
   */
  isMember(workspaceId: string, userId: string): Promise<boolean>;

  /**
   * Get a member's role
   * @param workspaceId - Workspace ID
   * @param userId - User ID
   * @returns Role or null if not a member
   */
  getMemberRole(
    workspaceId: string,
    userId: string,
  ): Promise<MemberRole | null>;
}

// =============================================================================
// Invitation Service Interface
// =============================================================================

/**
 * Interface for invitation operations
 */
export interface IInvitationService {
  /**
   * Create an invitation
   * @param data - Invitation data
   * @returns The created invitation
   */
  create(data: CreateInvitationData): Promise<Invitation>;

  /**
   * Get an invitation by ID
   * @param id - Invitation ID
   * @returns Invitation or null if not found
   */
  get(id: string): Promise<Invitation | null>;

  /**
   * Get pending invitations for a workspace
   * @param workspaceId - Workspace ID
   * @returns List of pending invitations
   */
  getPendingForWorkspace(workspaceId: string): Promise<Invitation[]>;

  /**
   * Get pending invitations for an email
   * @param email - Email address
   * @returns List of pending invitations
   */
  getPendingForEmail(email: string): Promise<Invitation[]>;

  /**
   * Accept an invitation
   * @param id - Invitation ID
   * @param userId - User ID accepting
   */
  accept(id: string, userId: string): Promise<void>;

  /**
   * Decline an invitation
   * @param id - Invitation ID
   */
  decline(id: string): Promise<void>;

  /**
   * Cancel an invitation
   * @param id - Invitation ID
   */
  cancel(id: string): Promise<void>;

  /**
   * Send invitation email
   * @param invitation - Invitation to send
   */
  sendEmail(invitation: Invitation): Promise<void>;
}

export interface CreateInvitationData {
  workspaceId: string;
  invitedBy: string;
  email: string;
  role: MemberRole;
  expiresIn?: number; // milliseconds
}

// =============================================================================
// Permission Engine Interface
// =============================================================================

/**
 * Interface for permission checking operations
 */
export interface IPermissionEngine {
  /**
   * Check if a user can perform an action
   * @param userId - User ID
   * @param resource - Resource to check
   * @param action - Action to perform
   * @returns Permission check result
   */
  check(
    userId: string,
    resource: Resource,
    action: Action,
  ): Promise<PermissionCheck>;

  /**
   * Check multiple permissions at once
   * @param userId - User ID
   * @param checks - List of permission checks
   * @returns Map of action to permission result
   */
  checkBatch(
    userId: string,
    checks: Array<{ resource: Resource; action: Action }>,
  ): Promise<Map<string, PermissionCheck>>;

  /**
   * Get all permissions for a role
   * @param role - Member role
   * @returns List of allowed actions
   */
  getRolePermissions(role: MemberRole): Action[];

  /**
   * Check if a role has a specific permission
   * @param role - Member role
   * @param action - Action to check
   */
  roleHasPermission(role: MemberRole, action: Action): boolean;

  /**
   * Get a user's role in a workspace
   * @param userId - User ID
   * @param workspaceId - Workspace ID
   * @returns Role or null if not a member
   */
  getUserRole(userId: string, workspaceId: string): Promise<MemberRole | null>;
}

// =============================================================================
// Access Control Interface
// =============================================================================

/**
 * Interface for access control operations
 */
export interface IAccessControl {
  /**
   * Grant a permission on a resource
   * @param resource - Resource
   * @param userId - User ID
   * @param action - Action to grant
   */
  grant(resource: Resource, userId: string, action: Action): Promise<void>;

  /**
   * Revoke a permission on a resource
   * @param resource - Resource
   * @param userId - User ID
   * @param action - Action to revoke
   */
  revoke(resource: Resource, userId: string, action: Action): Promise<void>;

  /**
   * Check resource-level permissions
   * @param userId - User ID
   * @param resource - Resource
   * @param action - Action to check
   */
  checkResourcePermission(
    userId: string,
    resource: Resource,
    action: Action,
  ): Promise<boolean>;

  /**
   * Set inherited permissions
   * @param resource - Resource
   * @param inheritFrom - Resource to inherit from
   */
  setInherited(resource: Resource, inheritFrom: Resource): Promise<void>;
}

// =============================================================================
// Audit Logger Interface
// =============================================================================

/**
 * Interface for audit logging operations
 */
export interface IAuditLogger {
  /**
   * Log an action
   * @param entry - Audit entry
   */
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void>;

  /**
   * Query audit logs
   * @param query - Query parameters
   * @returns List of audit entries
   */
  query(query: AuditQuery): Promise<AuditEntry[]>;

  /**
   * Get audit entries for a resource
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @returns List of audit entries
   */
  getByResource(
    resourceType: Resource['type'],
    resourceId: string,
  ): Promise<AuditEntry[]>;

  /**
   * Get audit entries for a user
   * @param userId - User ID
   * @param options - Query options
   * @returns List of audit entries
   */
  getByUser(userId: string, options?: AuditQueryOptions): Promise<AuditEntry[]>;

  /**
   * Export audit logs
   * @param query - Query parameters
   * @param format - Export format
   * @returns Exported data
   */
  export(query: AuditQuery, format: 'json' | 'csv'): Promise<string>;
}

export interface AuditQuery {
  workspaceId?: string;
  userId?: string;
  resourceType?: Resource['type'];
  resourceId?: string;
  action?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface AuditQueryOptions {
  startTime?: number;
  endTime?: number;
  limit?: number;
}

// =============================================================================
// Review System Interface
// =============================================================================

/**
 * Interface for review management operations
 */
export interface IReviewSystem {
  /**
   * Create a new review
   * @param data - Review creation data
   * @returns The created review
   */
  createReview(data: CreateReviewData): Promise<Review>;

  /**
   * Get a review by ID
   * @param id - Review ID
   * @returns Review or null if not found
   */
  getReview(id: string): Promise<Review | null>;

  /**
   * Submit a review for review
   * @param id - Review ID
   */
  submitReview(id: string): Promise<void>;

  /**
   * Add a reviewer to a review
   * @param reviewId - Review ID
   * @param userId - User ID of reviewer
   */
  addReviewer(reviewId: string, userId: string): Promise<void>;

  /**
   * Remove a reviewer from a review
   * @param reviewId - Review ID
   * @param userId - User ID of reviewer
   */
  removeReviewer(reviewId: string, userId: string): Promise<void>;

  /**
   * Submit a review result
   * @param reviewId - Review ID
   * @param result - Review result
   */
  submitReviewResult(reviewId: string, result: ReviewResult): Promise<void>;

  /**
   * Merge a review
   * @param reviewId - Review ID
   */
  merge(reviewId: string): Promise<void>;

  /**
   * Close a review
   * @param reviewId - Review ID
   */
  close(reviewId: string): Promise<void>;

  /**
   * List reviews for a workspace
   * @param workspaceId - Workspace ID
   * @param filters - Optional filters
   * @returns List of reviews
   */
  listReviews(workspaceId: string, filters?: ReviewFilters): Promise<Review[]>;

  /**
   * Add a comment to a review
   * @param reviewId - Review ID
   * @param data - Comment data
   * @returns The created comment
   */
  addComment(reviewId: string, data: CreateCommentData): Promise<Comment>;

  /**
   * Resolve a comment
   * @param commentId - Comment ID
   * @param userId - User ID resolving
   */
  resolveComment(commentId: string, userId: string): Promise<void>;
}

export interface CreateReviewData {
  workspaceId: string;
  title: string;
  description: string;
  author: string;
  reviewerIds: string[];
  changes: Array<{
    fileId: string;
    fileName: string;
    changeType: 'added' | 'modified' | 'deleted';
    diff: string;
  }>;
}

export interface ReviewResult {
  userId: string;
  status: 'approved' | 'changes_requested';
  comment?: string;
}

export interface ReviewFilters {
  status?: Review['status'];
  author?: string;
  reviewer?: string;
  startTime?: number;
  endTime?: number;
}

export interface CreateCommentData {
  fileId: string;
  lineNumber?: number;
  author: string;
  content: string;
  mentions?: string[];
  parentId?: string;
}

export type ReviewResult = 'approved' | 'changes_requested';

// =============================================================================
// Reviewer Manager Interface
// =============================================================================

/**
 * Interface for reviewer management operations
 */
export interface IReviewerManager {
  /**
   * Get suggested reviewers for a review
   * @param workspaceId - Workspace ID
   * @param fileIds - File IDs being changed
   * @returns List of suggested reviewer user IDs
   */
  getSuggestedReviewers(
    workspaceId: string,
    fileIds: string[],
  ): Promise<string[]>;

  /**
   * Check if a user can review
   * @param userId - User ID
   * @param reviewId - Review ID
   */
  canReview(userId: string, reviewId: string): Promise<boolean>;

  /**
   * Get reviewer status
   * @param reviewId - Review ID
   * @param userId - User ID
   * @returns Reviewer status
   */
  getReviewerStatus(
    reviewId: string,
    userId: string,
  ): Promise<ReviewerStatus | null>;
}

// =============================================================================
// Change Manager Interface
// =============================================================================

/**
 * Interface for change management operations
 */
export interface IChangeManager {
  /**
   * Collect changes between versions
   * @param fileId - File ID
   * @param fromVersion - Start version
   * @param toVersion - End version
   * @returns List of changes
   */
  collectChanges(
    fileId: string,
    fromVersion: string,
    toVersion: string,
  ): Promise<Review['changes']>;

  /**
   * Generate a diff
   * @param contentA - Original content
   * @param contentB - Modified content
   * @returns Unified diff string
   */
  generateDiff(contentA: string, contentB: string): string;

  /**
   * Apply a diff to content
   * @param content - Original content
   * @param diff - Diff to apply
   * @returns Modified content
   */
  applyDiff(content: string, diff: string): string;

  /**
   * Calculate change statistics
   * @param diff - Diff string
   * @returns Statistics object
   */
  calculateStats(diff: string): { additions: number; deletions: number };
}

// =============================================================================
// Comment Service Interface
// =============================================================================

/**
 * Interface for comment operations
 */
export interface ICommentService {
  /**
   * Add a comment
   * @param data - Comment data
   * @returns The created comment
   */
  addComment(data: CreateCommentData & { reviewId?: string }): Promise<Comment>;

  /**
   * Update a comment
   * @param id - Comment ID
   * @param content - New content
   */
  updateComment(id: string, content: string): Promise<void>;

  /**
   * Delete a comment
   * @param id - Comment ID
   */
  deleteComment(id: string): Promise<void>;

  /**
   * Resolve a comment
   * @param id - Comment ID
   * @param userId - User ID resolving
   */
  resolveComment(id: string, userId: string): Promise<void>;

  /**
   * Unresolve a comment
   * @param id - Comment ID
   */
  unresolveComment(id: string): Promise<void>;

  /**
   * Get comments for a file
   * @param fileId - File ID
   * @param options - Query options
   * @returns List of comments
   */
  getFileComments(
    fileId: string,
    options?: CommentQueryOptions,
  ): Promise<Comment[]>;

  /**
   * Get comments for a review
   * @param reviewId - Review ID
   * @returns List of comments
   */
  getReviewComments(reviewId: string): Promise<Comment[]>;

  /**
   * Get replies to a comment
   * @param parentId - Parent comment ID
   * @returns List of replies
   */
  getReplies(parentId: string): Promise<Comment[]>;
}

export interface CommentQueryOptions {
  includeResolved?: boolean;
  line?: number;
  startTime?: number;
  endTime?: number;
}

// =============================================================================
// Mention Handler Interface
// =============================================================================

/**
 * Interface for mention handling operations
 */
export interface IMentionHandler {
  /**
   * Parse mentions from text
   * @param text - Text to parse
   * @returns List of mentioned user IDs
   */
  parseMentions(text: string): string[];

  /**
   * Replace mentions with display text
   * @param text - Text with mentions
   * @returns Text with mentions replaced
   */
  replaceMentions(text: string): string;

  /**
   * Validate a mention
   * @param userId - User ID
   * @param workspaceId - Workspace ID
   */
  validateMention(userId: string, workspaceId: string): Promise<boolean>;

  /**
   * Search for mentionable users
   * @param workspaceId - Workspace ID
   * @param query - Search query
   * @returns List of user IDs
   */
  searchMentionable(workspaceId: string, query: string): Promise<string[]>;
}

// =============================================================================
// Version Control Interface
// =============================================================================

/**
 * Interface for version control operations
 */
export interface IVersionControl {
  /**
   * Create a new version
   * @param fileId - File ID
   * @param content - File content
   * @param message - Commit message
   * @param author - User ID of author
   * @returns The created version
   */
  createVersion(
    fileId: string,
    content: string,
    message: string,
    author: string,
  ): Promise<Version>;

  /**
   * Get a version by ID
   * @param versionId - Version ID
   * @returns Version or null if not found
   */
  getVersion(versionId: string): Promise<Version | null>;

  /**
   * Get version history for a file
   * @param fileId - File ID
   * @returns List of versions
   */
  getHistory(fileId: string): Promise<Version[]>;

  /**
   * Get the latest version
   * @param fileId - File ID
   * @returns Latest version or null if no versions
   */
  getLatest(fileId: string): Promise<Version | null>;

  /**
   * Get a diff between two versions
   * @param versionA - First version ID
   * @param versionB - Second version ID
   * @returns Version diff
   */
  diff(versionA: string, versionB: string): Promise<VersionDiff>;

  /**
   * Revert a file to a version
   * @param fileId - File ID
   * @param versionId - Version ID to revert to
   */
  revert(fileId: string, versionId: string): Promise<void>;

  /**
   * Delete a version
   * @param versionId - Version ID
   */
  deleteVersion(versionId: string): Promise<void>;
}

// =============================================================================
// Diff Engine Interface
// =============================================================================

/**
 * Interface for diff operations
 */
export interface IDiffEngine {
  /**
   * Compute diff between two texts
   * @param textA - Original text
   * @param textB - Modified text
   * @returns List of diff hunks
   */
  computeDiff(textA: string, textB: string): VersionDiff['hunks'];

  /**
   * Generate unified diff format
   * @param textA - Original text
   * @param textB - Modified text
   * @param fileName - File name
   * @returns Unified diff string
   */
  toUnifiedDiff(textA: string, textB: string, fileName: string): string;

  /**
   * Apply a patch to text
   * @param text - Original text
   * @param patch - Patch to apply
   * @returns Patched text
   */
  applyPatch(text: string, patch: string): string;

  /**
   * Perform three-way merge
   * @param base - Base version
   * @param theirs - Their changes
   * @param yours - Your changes
   * @returns Merged text or null if conflict
   */
  threeWayMerge(
    base: string,
    theirs: string,
    yours: string,
  ): Promise<string | null>;
}

// =============================================================================
// Branch Manager Interface
// =============================================================================

/**
 * Interface for branch management operations
 */
export interface IBranchManager {
  /**
   * Create a new branch
   * @param data - Branch creation data
   * @returns The created branch
   */
  createBranch(data: CreateBranchData): Promise<Branch>;

  /**
   * Get a branch by ID
   * @param branchId - Branch ID
   * @returns Branch or null if not found
   */
  getBranch(branchId: string): Promise<Branch | null>;

  /**
   * List branches for a file
   * @param fileId - File ID
   * @returns List of branches
   */
  listBranches(fileId: string): Promise<Branch[]>;

  /**
   * Merge a branch
   * @param branchId - Branch ID to merge
   * @param targetBranchId - Target branch ID
   */
  merge(branchId: string, targetBranchId: string): Promise<void>;

  /**
   * Abandon a branch
   * @param branchId - Branch ID
   */
  abandon(branchId: string): Promise<void>;

  /**
   * Resolve merge conflicts
   * @param branchId - Branch ID
   * @param resolutions - Conflict resolutions
   */
  resolveConflicts(
    branchId: string,
    resolutions: ConflictResolution[],
  ): Promise<void>;
}

export interface CreateBranchData {
  name: string;
  fileId: string;
  parentId?: string;
  createdBy: string;
}

export interface ConflictResolution {
  path: string;
  resolution: 'accept_theirs' | 'accept_yours' | 'manual';
  content?: string;
}

// =============================================================================
// Collaboration Hub Interface
// =============================================================================

/**
 * Interface for real-time collaboration operations
 */
export interface ICollaborationHub {
  /**
   * Join a collaboration session
   * @param fileId - File ID
   * @param userId - User ID
   * @returns The collaboration session
   */
  joinSession(fileId: string, userId: string): Promise<CollaborationSession>;

  /**
   * Leave a collaboration session
   * @param sessionId - Session ID
   * @param userId - User ID
   */
  leaveSession(sessionId: string, userId: string): Promise<void>;

  /**
   * Send an editing operation
   * @param sessionId - Session ID
   * @param operation - Operation to send
   */
  sendOperation(sessionId: string, operation: EditorOperation): Promise<void>;

  /**
   * Update cursor position
   * @param sessionId - Session ID
   * @param userId - User ID
   * @param cursor - Cursor position
   * @param selection - Optional selection
   */
  updateCursor(
    sessionId: string,
    userId: string,
    cursor: CursorPosition,
    selection?: CursorPosition,
  ): Promise<void>;

  /**
   * Get participants in a session
   * @param sessionId - Session ID
   * @returns List of participants
   */
  getParticipants(sessionId: string): Promise<Participant[]>;

  /**
   * Get current session state
   * @param sessionId - Session ID
   * @returns Current editor state
   */
  getSessionState(sessionId: string): Promise<EditorState>;

  /**
   * Broadcast a message to all participants
   * @param sessionId - Session ID
   * @param message - Message to broadcast
   * @param excludeUserId - User ID to exclude (sender)
   */
  broadcast(
    sessionId: string,
    message: unknown,
    excludeUserId?: string,
  ): Promise<void>;
}

// =============================================================================
// Sync Engine Interface
// =============================================================================

/**
 * Interface for synchronization operations
 */
export interface ISyncEngine {
  /**
   * Connect to the sync server
   * @param sessionId - Session ID
   * @param userId - User ID
   */
  connect(sessionId: string, userId: string): Promise<void>;

  /**
   * Disconnect from the sync server
   */
  disconnect(): Promise<void>;

  /**
   * Send a message
   * @param message - Message to send
   */
  send(message: unknown): Promise<void>;

  /**
   * Subscribe to messages
   * @param callback - Callback for received messages
   */
  subscribe(callback: (message: unknown) => void): void;

  /**
   * Request a sync
   * @param fromVersion - Version to sync from
   */
  requestSync(fromVersion: number): Promise<void>;

  /**
   * Check connection status
   */
  isConnected(): boolean;
}

// =============================================================================
// Knowledge Base Interface
// =============================================================================

/**
 * Interface for knowledge base operations
 */
export interface IKnowledgeBase {
  /**
   * Create an article
   * @param data - Article creation data
   * @returns The created article
   */
  createArticle(data: CreateArticleData): Promise<KnowledgeArticle>;

  /**
   * Get an article by ID
   * @param id - Article ID
   * @returns Article or null if not found
   */
  getArticle(id: string): Promise<KnowledgeArticle | null>;

  /**
   * Update an article
   * @param id - Article ID
   * @param data - Update data
   */
  updateArticle(id: string, data: UpdateArticleData): Promise<void>;

  /**
   * Delete an article
   * @param id - Article ID
   */
  deleteArticle(id: string): Promise<void>;

  /**
   * List articles
   * @param options - List options
   * @returns List of articles
   */
  listArticles(options?: ListArticlesOptions): Promise<KnowledgeArticle[]>;

  /**
   * Increment article view count
   * @param id - Article ID
   */
  incrementViews(id: string): Promise<void>;

  /**
   * Upvote an article
   * @param id - Article ID
   * @param userId - User ID
   */
  upvote(id: string, userId: string): Promise<void>;

  /**
   * Remove upvote from an article
   * @param id - Article ID
   * @param userId - User ID
   */
  removeUpvote(id: string, userId: string): Promise<void>;
}

export interface CreateArticleData {
  title: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
}

export type UpdateArticleData = Partial<
  Pick<KnowledgeArticle, 'title' | 'content' | 'category' | 'tags'>
>;

export interface ListArticlesOptions {
  category?: string;
  tags?: string[];
  limit?: number;
  sortBy?: 'recent' | 'popular' | 'views';
}

// =============================================================================
// Knowledge Search Interface
// =============================================================================

/**
 * Interface for knowledge search operations
 */
export interface IKnowledgeSearch {
  /**
   * Search articles
   * @param query - Search query
   * @param options - Search options
   * @returns List of search results
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Search by tag
   * @param tag - Tag to search for
   * @returns List of articles
   */
  searchByTag(tag: string): Promise<KnowledgeArticle[]>;

  /**
   * Get related articles
   * @param articleId - Article ID
   * @returns List of related articles
   */
  getRelated(articleId: string): Promise<KnowledgeArticle[]>;

  /**
   * Get search suggestions
   * @param query - Partial query
   * @returns List of suggestions
   */
  getSuggestions(query: string): Promise<string[]>;

  /**
   * Build search index
   */
  buildIndex(): Promise<void>;

  /**
   * Update search index for an article
   * @param article - Article to index
   */
  indexArticle(article: KnowledgeArticle): Promise<void>;

  /**
   * Remove article from search index
   * @param articleId - Article ID
   */
  removeFromIndex(articleId: string): Promise<void>;
}

// =============================================================================
// Category Manager Interface
// =============================================================================

/**
 * Interface for category management operations
 */
export interface ICategoryManager {
  /**
   * Create a category
   * @param data - Category creation data
   * @returns The created category
   */
  createCategory(data: CreateCategoryData): Promise<KnowledgeCategory>;

  /**
   * Get a category by ID
   * @param id - Category ID
   * @returns Category or null if not found
   */
  getCategory(id: string): Promise<KnowledgeCategory | null>;

  /**
   * Update a category
   * @param id - Category ID
   * @param data - Update data
   */
  updateCategory(
    id: string,
    data: Partial<Pick<KnowledgeCategory, 'name' | 'description' | 'parentId'>>,
  ): Promise<void>;

  /**
   * Delete a category
   * @param id - Category ID
   */
  deleteCategory(id: string): Promise<void>;

  /**
   * List all categories
   * @returns List of categories
   */
  listCategories(): Promise<KnowledgeCategory[]>;

  /**
   * Get category tree
   * @returns Hierarchical category tree
   */
  getCategoryTree(): Promise<CategoryNode[]>;

  /**
   * Get articles in a category
   * @param categoryId - Category ID
   * @returns List of articles
   */
  getCategoryArticles(categoryId: string): Promise<KnowledgeArticle[]>;
}

export interface CreateCategoryData {
  name: string;
  description: string;
  parentId?: string;
}

export interface CategoryNode extends KnowledgeCategory {
  children: CategoryNode[];
}

// =============================================================================
// Statistics Interface
// =============================================================================

/**
 * Interface for statistics operations
 */
export interface IStatisticsService {
  /**
   * Get workspace statistics
   * @param workspaceId - Workspace ID
   * @returns Workspace statistics
   */
  getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats>;

  /**
   * Get user statistics
   * @param userId - User ID
   * @param workspaceId - Workspace ID
   * @returns User statistics
   */
  getUserStats(userId: string, workspaceId: string): Promise<UserStats>;

  /**
   * Get activity timeline
   * @param workspaceId - Workspace ID
   * @param options - Query options
   * @returns Activity data points
   */
  getActivityTimeline(
    workspaceId: string,
    options?: ActivityQueryOptions,
  ): Promise<ActivityDataPoint[]>;

  /**
   * Get review metrics
   * @param workspaceId - Workspace ID
   * @param options - Query options
   * @returns Review metrics
   */
  getReviewMetrics(
    workspaceId: string,
    options?: ReviewMetricsOptions,
  ): Promise<ReviewMetrics>;
}

export interface ActivityQueryOptions {
  startTime?: number;
  endTime?: number;
  granularity?: 'day' | 'week' | 'month';
}

export interface ActivityDataPoint {
  timestamp: number;
  count: number;
}

export interface ReviewMetricsOptions {
  startTime?: number;
  endTime?: number;
}

export interface ReviewMetrics {
  totalReviews: number;
  avgReviewTime: number; // hours
  approvalRate: number; // percentage
  changesRequestedRate: number; // percentage
}

export interface WorkspaceStats {
  memberCount: number;
  fileCount: number;
  reviewCount: number;
  pendingReviews: number;
  articleCount: number;
  activityLast7Days: number;
}

export interface UserStats {
  reviewsCreated: number;
  reviewsCompleted: number;
  commentsMade: number;
  articlesContributed: number;
  avgReviewTime: number;
}
