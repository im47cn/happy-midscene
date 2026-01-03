/**
 * Analytics Types for AI Test Generator
 * Data models for execution analytics dashboard
 */

/**
 * Failure type classification
 */
export type FailureType =
  | 'locator_failed'
  | 'assertion_failed'
  | 'timeout'
  | 'network_error'
  | 'script_error'
  | 'unknown';

/**
 * Step execution record
 */
export interface StepRecord {
  index: number;
  description: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  aiResponseTime?: number;
  retryCount: number;
}

/**
 * Execution record for a single test case run
 */
export interface ExecutionRecord {
  id: string;
  caseId: string;
  caseName: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'passed' | 'failed' | 'skipped' | 'error';

  steps: StepRecord[];

  failure?: {
    type: FailureType;
    message: string;
    stepIndex: number;
    screenshot?: string;
  };

  healing?: {
    attempted: boolean;
    success: boolean;
    strategy?: string;
  };

  environment: {
    browser: string;
    viewport: { width: number; height: number };
    url: string;
  };
}

/**
 * Daily aggregated statistics
 */
export interface DailyStats {
  date: string; // YYYY-MM-DD
  totalExecutions: number;
  passed: number;
  failed: number;
  skipped: number;
  error: number;
  avgDuration: number;
  failuresByType: Record<FailureType, number>;
}

/**
 * Test case statistics
 */
export interface CaseStats {
  caseId: string;
  caseName: string;
  totalRuns: number;
  passRate: number;
  avgDuration: number;
  lastRun: number;
  stabilityScore: number; // 0-100
  isFlaky: boolean;
  recentResults: ('passed' | 'failed')[];
}

/**
 * Overall health score
 */
export interface HealthScore {
  overall: number; // 0-100
  components: {
    passRate: number;
    stability: number;
    performance: number;
    coverage: number;
  };
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Failure hotspot
 */
export interface Hotspot {
  description: string;
  stepIndex?: number;
  failureCount: number;
  percentage: number;
  failureType?: FailureType;
}

/**
 * Time range filter
 */
export type TimeRange = 'today' | '7days' | '30days' | 'custom';

/**
 * Custom date range
 */
export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Dashboard overview data
 */
export interface DashboardOverview {
  timeRange: TimeRange;
  dateRange?: DateRange;

  // KPI metrics
  totalExecutions: number;
  passRate: number;
  passRateTrend: number; // percentage change
  avgDuration: number;
  avgDurationTrend: number;
  healthScore: HealthScore;

  // Trend data
  dailyStats: DailyStats[];

  // Failure analysis
  failuresByType: Record<FailureType, number>;
  hotspots: Hotspot[];

  // Case summary
  totalCases: number;
  stableCases: number;
  flakyCases: number;
  unstableCases: number;
}

/**
 * Alert condition types
 */
export type AlertConditionType =
  | 'pass_rate'
  | 'consecutive_failures'
  | 'duration'
  | 'flaky_detected';

/**
 * Alert condition
 */
export interface AlertCondition {
  type: AlertConditionType;
  threshold: number;
  timeWindow?: number; // minutes
}

/**
 * Notification channels
 */
export type NotificationChannel = 'browser' | 'webhook';

/**
 * Notification configuration
 */
export interface NotificationConfig {
  channels: NotificationChannel[];
  webhookUrl?: string;
}

/**
 * Alert rule
 */
export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: AlertCondition;
  notification: NotificationConfig;
  createdAt: number;
  lastTriggered?: number;
}

/**
 * Alert event
 */
export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  triggeredAt: number;
  condition: AlertCondition;
  currentValue: number;
  message: string;
  acknowledged: boolean;
}

/**
 * Report types
 */
export type ReportType = 'daily' | 'weekly' | 'custom';

/**
 * Report summary
 */
export interface ReportSummary {
  totalExecutions: number;
  passRate: string;
  avgDuration: string;
  healthScore: number;
}

/**
 * Failure analysis in report
 */
export interface ReportFailureAnalysis {
  byType: Record<FailureType, number>;
  hotspots: Hotspot[];
}

/**
 * Masking statistics for reports
 */
export interface MaskingStats {
  enabled: boolean;
  totalMasked: number;
  byCategory: Record<string, number>;
  byType: {
    text: number;
    screenshot: number;
    log: number;
    yaml: number;
  };
}

/**
 * Generated report
 */
export interface Report {
  id: string;
  type: ReportType;
  title: string;
  generatedAt: number;
  dateRange: DateRange;
  summary: ReportSummary;
  failureAnalysis: ReportFailureAnalysis;
  recommendations: string[];
  caseStats: CaseStats[];
  maskingStats?: MaskingStats;
}

/**
 * Default failure types record
 */
export const DEFAULT_FAILURES_BY_TYPE: Record<FailureType, number> = {
  locator_failed: 0,
  assertion_failed: 0,
  timeout: 0,
  network_error: 0,
  script_error: 0,
  unknown: 0,
};

/**
 * Failure type display names
 */
export const FAILURE_TYPE_LABELS: Record<FailureType, string> = {
  locator_failed: '定位失败',
  assertion_failed: '断言失败',
  timeout: '超时',
  network_error: '网络错误',
  script_error: '脚本错误',
  unknown: '未知错误',
};
