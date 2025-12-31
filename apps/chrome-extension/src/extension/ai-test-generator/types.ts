/**
 * Types for AI Test Generator
 */

import type { TestCase, TaskStep, ParseResult } from './services/markdownParser';
import type { GitLabProject, GitLabBranch, GitLabCommitResult } from './services/gitlabClient';
import type { ExecutionResult, ExecutionStatus, ExecutionContext } from './services/executionEngine';

export type {
  TestCase,
  TaskStep,
  ParseResult,
  GitLabProject,
  GitLabBranch,
  GitLabCommitResult,
  ExecutionResult,
  ExecutionStatus,
  ExecutionContext,
};

export type ViewMode = 'input' | 'preview' | 'execute' | 'commit' | 'history';

export interface GeneratorState {
  // Input state
  markdownInput: string;
  parseResult: ParseResult | null;

  // Execution state
  executionStatus: ExecutionStatus;
  currentStepIndex: number;
  executionResults: ExecutionResult[];

  // Output state
  generatedYaml: string;
  yamlEdited: boolean;

  // GitLab state
  gitlabConfigured: boolean;
  selectedProject: GitLabProject | null;
  selectedBranch: string;
  newBranchName: string;
  commitPath: string;
  commitMessage: string;

  // UI state
  currentView: ViewMode;
  isLoading: boolean;
  error: string | null;
}

export interface CommitOptions {
  projectId: number;
  branch: string;
  createNewBranch: boolean;
  baseBranch?: string;
  filePath: string;
  commitMessage: string;
}
