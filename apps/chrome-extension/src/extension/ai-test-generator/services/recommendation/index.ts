/**
 * Recommendation Services Module
 * Exports all recommendation-related services
 */

// Core services
export { RecommendEngine, recommendEngine } from './recommendEngine';
export { ScoreCalculator } from './scoreCalculator';
export { PriorityRanker, priorityRanker } from './priorityRanker';

// Analysis services
export { CorrelationFinder, correlationFinder } from './correlationFinder';
export { CoverageAnalyzer, coverageAnalyzer } from './coverageAnalyzer';
export { ChangeAnalyzer, changeAnalyzer } from './changeAnalyzer';
export { FeedbackTracker, feedbackTracker } from './feedbackTracker';

// Types
export * from '../../types/recommendation';
