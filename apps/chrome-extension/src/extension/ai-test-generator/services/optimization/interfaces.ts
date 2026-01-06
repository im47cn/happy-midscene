/**
 * Optimization Service Interfaces
 * Core interfaces for test optimization analysis
 */

import type {
  AnalyzeOptions,
  CoverageGap,
  EfficiencyAnalysis,
  Impact,
  MaintainabilityAnalysis,
  OptimizationReport,
  Recommendation,
  RedundancyReport,
  StabilityAnalysis,
} from '../../types/optimization';

/**
 * Main analyzer interface for comprehensive test optimization
 */
export interface IOptimizationAnalyzer {
  /**
   * Run comprehensive analysis and generate optimization report
   */
  analyze(options?: AnalyzeOptions): Promise<OptimizationReport>;

  /**
   * Analyze execution efficiency
   */
  analyzeEfficiency(): Promise<EfficiencyAnalysis>;

  /**
   * Detect redundant test cases
   */
  detectRedundancy(): Promise<RedundancyReport>;

  /**
   * Identify coverage gaps
   */
  identifyGaps(): Promise<CoverageGap[]>;

  /**
   * Analyze test stability
   */
  analyzeStability(): Promise<StabilityAnalysis>;

  /**
   * Analyze maintainability
   */
  analyzeMaintainability(): Promise<MaintainabilityAnalysis>;
}

/**
 * Recommendation engine interface
 */
export interface IRecommendEngine {
  /**
   * Generate recommendations from analysis results
   */
  generateRecommendations(analysis: {
    efficiency?: EfficiencyAnalysis;
    redundancy?: RedundancyReport;
    gaps?: CoverageGap[];
    stability?: StabilityAnalysis;
    maintainability?: MaintainabilityAnalysis;
  }): Promise<Recommendation[]>;

  /**
   * Prioritize recommendations by impact and effort
   */
  prioritizeRecommendations(
    recommendations: Recommendation[],
  ): Recommendation[];

  /**
   * Estimate impact of a recommendation
   */
  estimateImpact(recommendation: Recommendation): Impact;

  /**
   * Track recommendation adoption
   */
  trackAdoption(
    recommendationId: string,
    adopted: boolean,
    notes?: string,
  ): Promise<void>;
}

/**
 * Report generator interface
 */
export interface IOptimizationReport {
  /**
   * Generate full optimization report
   */
  generate(recommendations: Recommendation[]): Promise<OptimizationReport>;

  /**
   * Export report as HTML
   */
  exportHTML(report: OptimizationReport): string;

  /**
   * Export report as Markdown
   */
  exportMarkdown(report: OptimizationReport): string;
}

/**
 * Efficiency analyzer interface
 */
export interface IEfficiencyAnalyzer {
  /**
   * Analyze overall execution efficiency
   */
  analyze(): Promise<EfficiencyAnalysis>;

  /**
   * Identify slowest test cases
   */
  identifySlowCases(
    limit?: number,
  ): Promise<EfficiencyAnalysis['slowestCases']>;

  /**
   * Find execution bottlenecks
   */
  findBottlenecks(): Promise<EfficiencyAnalysis['bottlenecks']>;

  /**
   * Suggest parallelization opportunities
   */
  suggestParallelization(): Promise<
    EfficiencyAnalysis['parallelizationOpportunity']
  >;
}

/**
 * Redundancy detector interface
 */
export interface IRedundancyDetector {
  /**
   * Detect all redundancies
   */
  detect(): Promise<RedundancyReport>;

  /**
   * Find similar test cases
   */
  findSimilarCases(
    threshold?: number,
  ): Promise<RedundancyReport['redundantGroups']>;

  /**
   * Find duplicate steps across cases
   */
  findDuplicateSteps(): Promise<RedundancyReport['duplicateSteps']>;

  /**
   * Suggest merge strategy for redundant cases
   */
  suggestMerge(
    caseIds: string[],
  ): Promise<RedundancyReport['redundantGroups'][0]['mergeRecommendation']>;
}

/**
 * Gap identifier interface
 */
export interface IGapIdentifier {
  /**
   * Identify all coverage gaps
   */
  identify(): Promise<CoverageGap[]>;

  /**
   * Calculate feature coverage
   */
  calculateCoverage(featureId: string): Promise<number>;

  /**
   * Suggest new test cases for gaps
   */
  suggestCases(gap: CoverageGap): Promise<CoverageGap['missingScenarios']>;

  /**
   * Assess risk level for a gap
   */
  assessRisk(gap: CoverageGap): Promise<CoverageGap['riskLevel']>;
}

/**
 * Stability analyzer interface
 */
export interface IStabilityAnalyzer {
  /**
   * Analyze overall stability
   */
  analyze(): Promise<StabilityAnalysis>;

  /**
   * Identify flaky tests
   */
  identifyFlakyTests(): Promise<StabilityAnalysis['flakyTests']>;

  /**
   * Find failure patterns
   */
  findPatterns(): Promise<StabilityAnalysis['failurePatterns']>;

  /**
   * Suggest fixes for stability issues
   */
  suggestFixes(caseId: string): Promise<string[]>;
}

/**
 * Maintainability analyzer interface
 */
export interface IMaintainabilityAnalyzer {
  /**
   * Analyze overall maintainability
   */
  analyze(): Promise<MaintainabilityAnalysis>;

  /**
   * Evaluate case complexity
   */
  evaluateComplexity(caseId: string): Promise<number>;

  /**
   * Check best practice violations
   */
  checkBestPractices(): Promise<
    MaintainabilityAnalysis['bestPracticeViolations']
  >;
}

/**
 * Similarity calculator interface
 */
export interface ISimilarityCalculator {
  /**
   * Calculate similarity between two test cases
   */
  calculateCaseSimilarity(case1Id: string, case2Id: string): Promise<number>;

  /**
   * Calculate step similarity
   */
  calculateStepSimilarity(steps1: string[], steps2: string[]): number;

  /**
   * Normalize step for comparison
   */
  normalizeStep(step: string): string;
}

/**
 * Impact estimator interface
 */
export interface IImpactEstimator {
  /**
   * Estimate time savings
   */
  estimateTimeSaving(recommendation: Recommendation): number;

  /**
   * Estimate quality improvement
   */
  estimateQualityImprovement(recommendation: Recommendation): number;

  /**
   * Calculate ROI for implementing a recommendation
   */
  calculateROI(recommendation: Recommendation): number;
}
