/**
 * Recommendation Types for AI Test Generator
 * Data models for intelligent test case recommendations
 */

import type { CaseStats, ExecutionRecord } from './analytics';

/**
 * Recommendation reason types
 */
export type ReasonType =
  | 'recent_failure' // 最近失败
  | 'high_risk' // 高风险
  | 'long_not_run' // 长时间未执行
  | 'change_impact' // 变更影响
  | 'correlation' // 关联用例
  | 'coverage_gap' // 覆盖率缺口
  | 'user_preference'; // 用户偏好

/**
 * Recommendation categories
 */
export type RecommendCategory =
  | 'must_run' // 必须执行
  | 'should_run' // 建议执行
  | 'could_run' // 可选执行
  | 'low_priority'; // 低优先级

/**
 * Priority levels
 */
export type Priority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Recommendation reason with explanation
 */
export interface RecommendReason {
  type: ReasonType;
  description: string;
  weight: number; // 0-1, contribution to final score
  data?: Record<string, unknown>;
}

/**
 * Main recommendation result
 */
export interface Recommendation {
  id: string;
  caseId: string;
  caseName: string;
  score: number; // 0-100
  reasons: RecommendReason[];
  priority: Priority;
  category: RecommendCategory;
  estimatedDuration: number; // milliseconds
  lastExecuted?: number;
  lastResult?: 'passed' | 'failed';
}

/**
 * Priority configuration weights
 */
export interface PriorityWeights {
  riskFactor: number; // 风险系数权重
  businessValue: number; // 业务价值权重
  executionCost: number; // 执行成本权重
  changeImpact: number; // 变更影响权重
  recency: number; // 时效性权重
}

/**
 * Priority thresholds
 */
export interface PriorityThresholds {
  critical: number; // 关键优先级阈值
  high: number; // 高优先级阈值
  medium: number; // 中优先级阈值
}

/**
 * Priority configuration
 */
export interface PriorityConfig {
  weights: PriorityWeights;
  thresholds: PriorityThresholds;
}

/**
 * Default priority configuration
 */
export const DEFAULT_PRIORITY_CONFIG: PriorityConfig = {
  weights: {
    riskFactor: 0.3,
    businessValue: 0.2,
    executionCost: 0.1,
    changeImpact: 0.25,
    recency: 0.15,
  },
  thresholds: {
    critical: 80,
    high: 60,
    medium: 40,
  },
};

/**
 * Correlation types between test cases
 */
export type CorrelationType =
  | 'co_failure' // 共同失败
  | 'shared_precondition' // 共享前置条件
  | 'execution_sequence' // 执行顺序依赖
  | 'same_feature' // 同一功能
  | 'similar_pattern'; // 相似模式

/**
 * Correlation evidence
 */
export interface CorrelationEvidence {
  type: string;
  description: string;
  timestamp: number;
  strength?: number;
}

/**
 * Case correlation relationship
 */
export interface CaseCorrelation {
  caseId1: string;
  caseId2: string;
  correlationType: CorrelationType;
  strength: number; // 0-1
  evidence: CorrelationEvidence[];
}

/**
 * Feature coverage info
 */
export interface FeatureCoverage {
  featureId: string;
  featureName: string;
  coveredCases: string[];
  coveragePercent: number;
}

/**
 * Page coverage info
 */
export interface PageCoverage {
  url: string;
  pageName: string;
  coveredCases: string[];
  coveragePercent: number;
}

/**
 * User path coverage info
 */
export interface PathCoverage {
  pathId: string;
  pathName: string;
  steps: string[];
  coveredCases: string[];
  coveragePercent: number;
}

/**
 * Coverage gap
 */
export interface CoverageGap {
  type: 'feature' | 'page' | 'path';
  target: string;
  description: string;
  suggestedCases: string[];
}

/**
 * Overall coverage data
 */
export interface CoverageData {
  features: FeatureCoverage[];
  pages: PageCoverage[];
  userPaths: PathCoverage[];
  overallScore: number;
  gaps: CoverageGap[];
}

/**
 * Change information for impact analysis
 */
export interface ChangeInfo {
  type: 'file' | 'component' | 'feature';
  target: string;
  description?: string;
  timestamp?: number;
}

/**
 * Change impact result
 */
export interface ChangeImpact {
  change: ChangeInfo;
  affectedCases: string[];
  impactLevel: 'high' | 'medium' | 'low';
  reasoning: string[];
}

/**
 * User feedback on recommendation
 */
export interface Feedback {
  recommendationId: string;
  caseId: string;
  accepted: boolean;
  executed?: boolean;
  result?: 'passed' | 'failed';
  rating?: number; // 1-5
  comment?: string;
  timestamp: number;
}

/**
 * Recommendation options
 */
export interface RecommendOptions {
  limit?: number;
  categories?: RecommendCategory[];
  minScore?: number;
  timeLimit?: number; // time budget in minutes
  includeReasons?: boolean;
}

/**
 * Regression set types
 */
export type RegressionType = 'minimal' | 'standard' | 'full';

/**
 * Ranked case with priority
 */
export interface RankedCase {
  caseId: string;
  caseName: string;
  priority: Priority;
  score: number;
  factors: Record<string, number>;
}

/**
 * Recommendation context
 */
export interface RecommendContext {
  caseStats: CaseStats[];
  recentExecutions: ExecutionRecord[];
  config: PriorityConfig;
  changes?: ChangeInfo[];
  timeRange?: { start: number; end: number };
}

/**
 * Correlation graph node
 */
export interface CorrelationNode {
  caseId: string;
  caseName: string;
  connections: number;
  riskLevel: 'high' | 'medium' | 'low';
}

/**
 * Correlation graph edge
 */
export interface CorrelationEdge {
  source: string;
  target: string;
  type: CorrelationType;
  strength: number;
}

/**
 * Full correlation graph
 */
export interface CorrelationGraph {
  nodes: CorrelationNode[];
  edges: CorrelationEdge[];
  clusters?: CorrelationCluster[];
}

/**
 * Cluster of correlated cases
 */
export interface CorrelationCluster {
  id: string;
  cases: string[];
  centerCase: string;
  avgStrength: number;
}

/**
 * Category thresholds
 */
export const CATEGORY_THRESHOLDS: Record<
  RecommendCategory,
  { minScore: number; maxScore?: number }
> = {
  must_run: { minScore: 80 },
  should_run: { minScore: 60, maxScore: 79 },
  could_run: { minScore: 40, maxScore: 59 },
  low_priority: { minScore: 0, maxScore: 39 },
};

/**
 * Convert score to category
 */
export function scoreToCategory(score: number): RecommendCategory {
  if (score >= CATEGORY_THRESHOLDS.must_run.minScore) return 'must_run';
  if (score >= CATEGORY_THRESHOLDS.should_run.minScore) return 'should_run';
  if (score >= CATEGORY_THRESHOLDS.could_run.minScore) return 'could_run';
  return 'low_priority';
}

/**
 * Convert score to priority
 */
export function scoreToPriority(
  score: number,
  thresholds: PriorityThresholds,
): Priority {
  if (score >= thresholds.critical) return 'critical';
  if (score >= thresholds.high) return 'high';
  if (score >= thresholds.medium) return 'medium';
  return 'low';
}

/**
 * Reason type labels
 */
export const REASON_TYPE_LABELS: Record<ReasonType, string> = {
  recent_failure: '最近失败',
  high_risk: '高风险',
  long_not_run: '长时间未执行',
  change_impact: '变更影响',
  correlation: '关联用例',
  coverage_gap: '覆盖率缺口',
  user_preference: '用户偏好',
};

/**
 * Priority labels
 */
export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: '关键',
  high: '高',
  medium: '中',
  low: '低',
};

/**
 * Category labels
 */
export const CATEGORY_LABELS: Record<RecommendCategory, string> = {
  must_run: '必须执行',
  should_run: '建议执行',
  could_run: '可选执行',
  low_priority: '低优先级',
};
