/**
 * Types for AI Test Generator
 */

import type { DevicePreset } from './config/devicePresets';
import type {
  ExecutionContext,
  ExecutionResult,
  ExecutionStatus,
} from './services/executionEngine';
import type {
  GitLabBranch,
  GitLabCommitResult,
  GitLabProject,
} from './services/gitlabClient';
import type {
  ParseResult,
  TaskStep,
  TestCase,
} from './services/markdownParser';

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
  DevicePreset,
};

export type ViewMode =
  | 'input'
  | 'preview'
  | 'execute'
  | 'commit'
  | 'history'
  | 'analytics'
  | 'settings';

export interface GeneratorState {
  // Input state
  markdownInput: string;
  parseResult: ParseResult | null;

  // Device emulation
  selectedDeviceId: string;

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
