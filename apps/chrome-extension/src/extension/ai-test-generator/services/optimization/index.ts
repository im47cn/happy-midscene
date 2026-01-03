/**
 * Test Optimization Module
 * Comprehensive test optimization analysis and recommendations
 */

// Interfaces
export * from './interfaces';

// Analyzers
export { efficiencyAnalyzer } from './efficiencyAnalyzer';
export { redundancyDetector } from './redundancyDetector';
export { similarityCalculator } from './similarityCalculator';
export { gapIdentifier } from './gapIdentifier';
export { stabilityAnalyzer } from './stabilityAnalyzer';
export { maintainabilityAnalyzer } from './maintainabilityAnalyzer';

// Recommendation Engine
export { recommendEngine } from './recommendEngine';
export { impactEstimator } from './impactEstimator';

// Report Generator
export { optimizationReport } from './report';

// Re-export types
export type {
  AnalyzeOptions,
  Bottleneck,
  CoverageGap,
  EfficiencyAnalysis,
  FlakyTestAnalysis,
  Impact,
  MaintainabilityAnalysis,
  OptimizationReport,
  Priority,
  Recommendation,
  RecommendationType,
  RedundancyReport,
  StabilityAnalysis,
} from '../../types/optimization';
