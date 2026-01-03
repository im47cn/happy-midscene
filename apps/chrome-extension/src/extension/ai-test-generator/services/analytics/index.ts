/**
 * Analytics Services Index
 */

export { analyticsStorage } from './analyticsStorage';
export { dataCollector } from './dataCollector';
export { analysisEngine } from './analysisEngine';
export { failureAnalyzer } from './failureAnalyzer';
export { reportGenerator } from './reportGenerator';
export { alertManager } from './alertManager';
export type {
  FailurePattern,
  FailureCorrelation,
  TimeDistribution,
} from './failureAnalyzer';
