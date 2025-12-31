/**
 * Zustand Store for AI Test Generator
 */

import { create } from 'zustand';
import type { GeneratorState, ViewMode, CommitOptions } from './types';
import type { TestCase, ParseResult, ExecutionResult, ExecutionStatus } from './types';
import type { GitLabProject, GitLabBranch } from './services/gitlabClient';
import { parseMarkdown } from './services/markdownParser';
import { gitlabClient } from './services/gitlabClient';

interface GeneratorStore extends GeneratorState {
  // Input actions
  setMarkdownInput: (input: string) => void;
  parseInput: () => void;

  // Execution actions
  setExecutionStatus: (status: ExecutionStatus) => void;
  setCurrentStepIndex: (index: number) => void;
  addExecutionResult: (result: ExecutionResult) => void;
  clearExecutionResults: () => void;
  updateStepStatus: (stepId: string, status: 'pending' | 'running' | 'success' | 'failed' | 'skipped') => void;

  // Output actions
  setGeneratedYaml: (yaml: string) => void;
  updateYaml: (yaml: string) => void;

  // GitLab actions
  checkGitLabConfig: () => Promise<void>;
  setSelectedProject: (project: GitLabProject | null) => void;
  setSelectedBranch: (branch: string) => void;
  setNewBranchName: (name: string) => void;
  setCommitPath: (path: string) => void;
  setCommitMessage: (message: string) => void;

  // Batch execution
  selectedCaseIds: string[];
  setSelectedCaseIds: (ids: string[]) => void;

  // UI actions
  setCurrentView: (view: ViewMode) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: GeneratorState & { selectedCaseIds: string[] } = {
  markdownInput: '',
  parseResult: null,
  executionStatus: 'idle',
  currentStepIndex: 0,
  executionResults: [],
  generatedYaml: '',
  yamlEdited: false,
  gitlabConfigured: false,
  selectedProject: null,
  selectedBranch: '',
  newBranchName: '',
  commitPath: 'tests/ai-generated/',
  commitMessage: '',
  currentView: 'input',
  isLoading: false,
  error: null,
  selectedCaseIds: [],
};

export const useGeneratorStore = create<GeneratorStore>((set, get) => ({
  ...initialState,

  // Input actions
  setMarkdownInput: (input) => {
    set({ markdownInput: input, parseResult: null, error: null });
  },

  parseInput: () => {
    const { markdownInput } = get();
    if (!markdownInput.trim()) {
      set({ parseResult: null, error: 'Please enter markdown content' });
      return;
    }

    const result = parseMarkdown(markdownInput);
    set({
      parseResult: result,
      error: result.parseErrors.length > 0 ? result.parseErrors.join('\n') : null,
    });
  },

  // Execution actions
  setExecutionStatus: (status) => set({ executionStatus: status }),

  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),

  addExecutionResult: (result) => {
    set((state) => ({
      executionResults: [...state.executionResults, result],
    }));
  },

  clearExecutionResults: () => {
    set({ executionResults: [], currentStepIndex: 0 });
  },

  updateStepStatus: (stepId, status) => {
    set((state) => {
      if (!state.parseResult) return state;

      const updatedCases = state.parseResult.cases.map((testCase) => ({
        ...testCase,
        steps: testCase.steps.map((step) =>
          step.id === stepId ? { ...step, status } : step
        ),
      }));

      return {
        parseResult: {
          ...state.parseResult,
          cases: updatedCases,
        },
      };
    });
  },

  // Output actions
  setGeneratedYaml: (yaml) => set({ generatedYaml: yaml, yamlEdited: false }),

  updateYaml: (yaml) => set({ generatedYaml: yaml, yamlEdited: true }),

  // GitLab actions
  checkGitLabConfig: async () => {
    const config = await gitlabClient.loadConfig();
    set({ gitlabConfigured: config !== null });
  },

  setSelectedProject: (project) => {
    set({ selectedProject: project, selectedBranch: project?.default_branch || '' });
  },

  setSelectedBranch: (branch) => set({ selectedBranch: branch }),

  setNewBranchName: (name) => set({ newBranchName: name }),

  setCommitPath: (path) => set({ commitPath: path }),

  setCommitMessage: (message) => set({ commitMessage: message }),

  // Batch execution
  selectedCaseIds: [],
  setSelectedCaseIds: (ids) => set({ selectedCaseIds: ids }),

  // UI actions
  setCurrentView: (view) => set({ currentView: view }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
