/**
 * Test Optimization Types
 * Data models for test optimization analysis and recommendations
 */

// ============================================================================
// Core Types
// ============================================================================

export type RecommendationType =
  | 'efficiency' // Performance optimization
  | 'redundancy' // Redundant test elimination
  | 'coverage' // Coverage improvement
  | 'stability' // Stability improvement
  | 'maintainability' // Maintainability optimization
  | 'priority' // Priority adjustment
  | 'resource'; // Resource optimization

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Effort = 'low' | 'medium' | 'high';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export type BottleneckType =
  | 'sequential_dependency'
  | 'resource_contention'
  | 'slow_operation'
  | 'excessive_waiting';

// ============================================================================
// Impact & Action Types
// ============================================================================

export interface Impact {
  timeReduction?: number; // Time saved in milliseconds
  costReduction?: number; // Cost reduction percentage
  qualityImprovement?: number; // Quality improvement percentage
  description: string;
}

export interface ActionItem {
  order: number;
  action: string;
  details?: string;
}

export interface Evidence {
  type: 'execution_data' | 'pattern_match' | 'statistical' | 'comparison';
  description: string;
  data?: unknown;
}

// ============================================================================
// Recommendation Types
// ============================================================================

export interface Recommendation {
  id: string;
  type: RecommendationType;
  priority: Priority;
  title: string;
  description: string;
  impact: Impact;
  effort: Effort;
  actionItems: ActionItem[];
  relatedCases: string[];
  evidence: Evidence[];
  createdAt: number;
}

// ============================================================================
// Efficiency Analysis Types
// ============================================================================

export interface SlowStep {
  order: number;
  description: string;
  duration: number; // milliseconds
  averageDuration: number;
  suggestion?: string;
}

export interface SlowCase {
  caseId: string;
  caseName: string;
  averageDuration: number;
  percentile: number; // e.g., 95 means slower than 95% of cases
  slowSteps: SlowStep[];
}

export interface Bottleneck {
  type: BottleneckType;
  description: string;
  affectedCases: string[];
  suggestion: string;
}

export interface CaseGroup {
  groupId: string;
  caseIds: string[];
  reason: string;
}

export interface ParallelizationPlan {
  currentParallel: number;
  recommendedParallel: number;
  estimatedSaving: number; // percentage
  independentGroups: CaseGroup[];
}

export interface ResourceStats {
  screenshotSize: number; // bytes
  logSize: number;
  browserInstances: number;
  averageMemoryUsage?: number;
}

export interface EfficiencyAnalysis {
  totalDuration: number;
  averageDuration: number;
  slowestCases: SlowCase[];
  bottlenecks: Bottleneck[];
  parallelizationOpportunity: ParallelizationPlan;
  resourceUtilization: ResourceStats;
}

// ============================================================================
// Redundancy Detection Types
// ============================================================================

export interface StepInfo {
  index: number;
  description: string;
  action?: string;
  target?: string;
}

export interface StepDiff {
  stepIndex: number;
  case1Value: string;
  case2Value: string;
  type: 'action' | 'target' | 'assertion';
}

export interface StepOccurrence {
  caseId: string;
  caseName: string;
  stepIndex: number;
}

export interface MergeRecommendation {
  action: 'merge' | 'parameterize' | 'keep';
  reason: string;
  mergedCase?: {
    name: string;
    steps: string[];
    dataVariations?: Record<string, string[]>;
  };
}

export interface RedundantGroup {
  groupId: string;
  cases: string[];
  similarityScore: number; // 0-1
  commonSteps: StepInfo[];
  differences: StepDiff[];
  mergeRecommendation: MergeRecommendation;
}

export interface DuplicateStep {
  step: string;
  occurrences: StepOccurrence[];
  extractionRecommendation: string;
}

export interface RedundancyReport {
  redundantGroups: RedundantGroup[];
  duplicateSteps: DuplicateStep[];
  overlapScore: number; // 0-100
  potentialSavings: number; // estimated time savings in ms
}

// ============================================================================
// Coverage Gap Types
// ============================================================================

export interface SuggestedCase {
  name: string;
  description: string;
  steps: string[];
  priority: Priority;
}

export interface MissingScenario {
  description: string;
  importance: Priority;
  suggestedCase: SuggestedCase;
}

export interface CoverageGap {
  feature: string;
  currentCoverage: number; // 0-100
  recommendedCoverage: number;
  missingScenarios: MissingScenario[];
  riskLevel: RiskLevel;
}

export interface Feature {
  id: string;
  name: string;
  description?: string;
  requiredCoverage: number;
  relatedCases: string[];
}

export interface CoverageMatrix {
  features: Feature[];
  cases: string[];
  coverage: Record<string, string[]>; // feature id -> case ids
}

// ============================================================================
// Stability Analysis Types
// ============================================================================

export interface RootCause {
  type:
    | 'timing'
    | 'data_dependency'
    | 'network'
    | 'environment'
    | 'race_condition'
    | 'unknown';
  description: string;
  confidence: number; // 0-1
}

export interface FlakyTestAnalysis {
  caseId: string;
  caseName: string;
  flakyRate: number; // 0-1
  totalRuns: number;
  passCount: number;
  failCount: number;
  rootCauses: RootCause[];
  recommendations: string[];
}

export interface FailurePattern {
  patternId: string;
  pattern: string;
  frequency: number;
  affectedCases: string[];
  commonFactor: string;
  solution: string;
}

export interface EnvironmentIssue {
  type: 'browser' | 'network' | 'viewport' | 'timing' | 'data';
  description: string;
  affectedCases: string[];
  suggestion: string;
}

export interface StabilityAnalysis {
  overallScore: number; // 0-100
  flakyTests: FlakyTestAnalysis[];
  failurePatterns: FailurePattern[];
  environmentIssues: EnvironmentIssue[];
}

// ============================================================================
// Maintainability Types
// ============================================================================

export interface MaintainabilityIssue {
  type:
    | 'hardcoded_selector'
    | 'long_steps'
    | 'missing_cleanup'
    | 'duplicate_logic'
    | 'poor_naming';
  severity: Priority;
  caseId: string;
  caseName: string;
  description: string;
  suggestion: string;
  location?: {
    stepIndex: number;
    field?: string;
  };
}

export interface BestPracticeViolation {
  rule: string;
  severity: Priority;
  violations: {
    caseId: string;
    caseName: string;
    detail: string;
  }[];
  recommendation: string;
}

export interface MaintainabilityAnalysis {
  overallScore: number; // 0-100
  issues: MaintainabilityIssue[];
  bestPracticeViolations: BestPracticeViolation[];
  improvementSuggestions: string[];
}

// ============================================================================
// Priority Optimization Types
// ============================================================================

export interface PriorityGroup {
  name: string;
  cases: string[];
  estimatedDuration: number;
  priority: Priority;
  reason: string;
}

export interface ExecutionOrder {
  groups: PriorityGroup[];
  estimatedTotalDuration: number;
  optimizationBenefit: {
    earlyDetectionImprovement: number; // percentage
    feedbackTimeReduction: number; // percentage
  };
}

// ============================================================================
// Resource Optimization Types
// ============================================================================

export interface ResourceOptimization {
  type: 'screenshot' | 'parallel' | 'browser_reuse' | 'cache' | 'storage';
  currentUsage: number;
  recommendedUsage: number;
  estimatedSaving: {
    value: number;
    unit: string;
  };
  suggestion: string;
}

// ============================================================================
// Optimization Report Types
// ============================================================================

export interface OptimizationSummary {
  totalRecommendations: number;
  byPriority: Record<Priority, number>;
  byType: Record<RecommendationType, number>;
  estimatedTotalSavings: {
    time: number; // milliseconds
    percentage: number;
  };
  topIssues: string[];
}

export interface OptimizationReport {
  id: string;
  generatedAt: number;
  summary: OptimizationSummary;
  efficiencyAnalysis: EfficiencyAnalysis;
  redundancyReport: RedundancyReport;
  coverageGaps: CoverageGap[];
  stabilityAnalysis: StabilityAnalysis;
  maintainabilityAnalysis: MaintainabilityAnalysis;
  recommendations: Recommendation[];
  executionOrder?: ExecutionOrder;
  resourceOptimizations: ResourceOptimization[];
}

// ============================================================================
// Analysis Options Types
// ============================================================================

export type AnalysisScope = 'all' | 'recent' | 'specific';

// Import and re-export DateRange from analytics to avoid duplicate export error
import type { DateRange } from './analytics';
export type { DateRange };

export interface AnalyzeOptions {
  scope?: AnalysisScope;
  caseIds?: string[];
  timeRange?: DateRange;
  analysisTypes?: RecommendationType[];
  minExecutions?: number; // minimum executions required for analysis
}

// ============================================================================
// Tracking Types
// ============================================================================

export interface RecommendationAdoption {
  recommendationId: string;
  adopted: boolean;
  adoptedAt?: number;
  outcome?: 'improved' | 'no_change' | 'degraded';
  notes?: string;
}

export interface OptimizationTrend {
  date: string;
  healthScore: number;
  recommendations: number;
  adoptedCount: number;
  improvements: {
    efficiency: number;
    stability: number;
    coverage: number;
  };
}

// ============================================================================
// Template Types
// ============================================================================

export interface RecommendationTemplate {
  id: string;
  type: RecommendationType;
  titleTemplate: string;
  descriptionTemplate: string;
  actionTemplates: string[];
}

// ============================================================================
// Constants
// ============================================================================

export const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const EFFORT_LABELS: Record<Effort, string> = {
  low: '低成本',
  medium: '中等成本',
  high: '高成本',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

export const RECOMMENDATION_TYPE_LABELS: Record<RecommendationType, string> = {
  efficiency: '执行效率',
  redundancy: '冗余消除',
  coverage: '覆盖率提升',
  stability: '稳定性改进',
  maintainability: '维护性优化',
  priority: '优先级调整',
  resource: '资源优化',
};

export const BOTTLENECK_TYPE_LABELS: Record<BottleneckType, string> = {
  sequential_dependency: '顺序依赖',
  resource_contention: '资源竞争',
  slow_operation: '慢操作',
  excessive_waiting: '过度等待',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};
