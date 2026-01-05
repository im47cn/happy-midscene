/**
 * input: Test execution results with pass/fail status
 * output: Consecutive pattern anomaly detection results
 * pos: Detection of consecutive failures or unusual patterns
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

// ============================================================================
// Consecutive Pattern Detection
// ============================================================================

export interface ExecutionResult {
  timestamp: number;
  passed: boolean;
  caseId?: string;
}

export interface ConsecutiveDetectionOptions {
  failureThreshold?: number; // Consecutive failures to trigger (default: 3)
  successThreshold?: number; // Consecutive successes to clear (default: 2)
  timeWindowMs?: number; // Time window for pattern analysis
}

export interface ConsecutivePatternResult {
  isAnomaly: boolean;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  failureStreak: ExecutionResult[];
  pattern: 'consecutive_failures' | 'intermittent' | 'stable' | 'recovering';
}

/**
 * Detect consecutive failure patterns
 */
export function detectConsecutiveFailures(
  results: ExecutionResult[],
  options: ConsecutiveDetectionOptions = {}
): ConsecutivePatternResult {
  const { failureThreshold = 3, successThreshold = 2 } = options;

  if (results.length === 0) {
    return {
      isAnomaly: false,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      failureStreak: [],
      pattern: 'stable',
    };
  }

  // Sort by timestamp (newest first for recent pattern analysis)
  const sortedResults = [...results].sort((a, b) => b.timestamp - a.timestamp);

  // Count consecutive failures/successes from most recent
  let consecutiveFailures = 0;
  let consecutiveSuccesses = 0;
  const failureStreak: ExecutionResult[] = [];

  // Count from most recent result
  for (const result of sortedResults) {
    if (!result.passed) {
      if (consecutiveSuccesses === 0) {
        consecutiveFailures++;
        failureStreak.push(result);
      } else {
        break;
      }
    } else {
      if (consecutiveFailures === 0) {
        consecutiveSuccesses++;
      } else {
        break;
      }
    }
  }

  // Determine pattern
  let pattern: 'consecutive_failures' | 'intermittent' | 'stable' | 'recovering';
  if (consecutiveFailures >= failureThreshold) {
    pattern = 'consecutive_failures';
  } else if (consecutiveSuccesses >= successThreshold && consecutiveFailures === 0) {
    pattern = 'stable';
  } else if (consecutiveSuccesses > 0 && failureStreak.length > 0) {
    pattern = 'recovering';
  } else {
    // Check for intermittent failures
    const recentResults = sortedResults.slice(0, Math.min(10, sortedResults.length));
    const failCount = recentResults.filter((r) => !r.passed).length;
    const failRate = failCount / recentResults.length;
    pattern = failRate > 0.3 && failRate < 0.7 ? 'intermittent' : 'stable';
  }

  return {
    isAnomaly: consecutiveFailures >= failureThreshold,
    consecutiveFailures,
    consecutiveSuccesses,
    failureStreak,
    pattern,
  };
}

/**
 * Detect flaky test pattern (alternating pass/fail)
 */
export function detectFlakyPattern(
  results: ExecutionResult[],
  minExecutions: number = 5,
  flakyThreshold: number = 0.3
): { isFlaky: boolean; flakyScore: number; alternations: number } {
  if (results.length < minExecutions) {
    return { isFlaky: false, flakyScore: 0, alternations: 0 };
  }

  // Sort by timestamp
  const sorted = [...results].sort((a, b) => a.timestamp - b.timestamp);

  // Count alternations (pass -> fail or fail -> pass)
  let alternations = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].passed !== sorted[i - 1].passed) {
      alternations++;
    }
  }

  // Flaky score: ratio of alternations to possible alternations
  const maxAlternations = sorted.length - 1;
  const flakyScore = maxAlternations > 0 ? alternations / maxAlternations : 0;

  // Also check pass rate is neither too high nor too low
  const passCount = results.filter((r) => r.passed).length;
  const passRate = passCount / results.length;
  const isBalanced = passRate > 0.2 && passRate < 0.8;

  return {
    isFlaky: flakyScore >= flakyThreshold && isBalanced,
    flakyScore,
    alternations,
  };
}

/**
 * Detect sudden change in pass rate
 */
export function detectPassRateChange(
  results: ExecutionResult[],
  windowSize: number = 10,
  changeThreshold: number = 0.3
): { hasChange: boolean; previousRate: number; currentRate: number; change: number } {
  if (results.length < windowSize * 2) {
    return { hasChange: false, previousRate: 0, currentRate: 0, change: 0 };
  }

  const sorted = [...results].sort((a, b) => a.timestamp - b.timestamp);

  // Calculate pass rate for previous and current windows
  const midPoint = sorted.length - windowSize;
  const previousWindow = sorted.slice(midPoint - windowSize, midPoint);
  const currentWindow = sorted.slice(midPoint);

  const previousRate = previousWindow.filter((r) => r.passed).length / previousWindow.length;
  const currentRate = currentWindow.filter((r) => r.passed).length / currentWindow.length;
  const change = currentRate - previousRate;

  return {
    hasChange: Math.abs(change) >= changeThreshold,
    previousRate,
    currentRate,
    change,
  };
}

/**
 * Get failure trend (increasing, decreasing, stable)
 */
export function getFailureTrend(
  results: ExecutionResult[],
  windowSize: number = 5
): { trend: 'increasing' | 'decreasing' | 'stable'; slope: number } {
  if (results.length < windowSize * 2) {
    return { trend: 'stable', slope: 0 };
  }

  const sorted = [...results].sort((a, b) => a.timestamp - b.timestamp);

  // Calculate failure rate for each window
  const windowRates: number[] = [];
  for (let i = windowSize; i <= sorted.length; i += windowSize) {
    const window = sorted.slice(i - windowSize, i);
    const failRate = window.filter((r) => !r.passed).length / window.length;
    windowRates.push(failRate);
  }

  if (windowRates.length < 2) {
    return { trend: 'stable', slope: 0 };
  }

  // Simple linear regression on failure rates
  const n = windowRates.length;
  const xMean = (n - 1) / 2;
  const yMean = windowRates.reduce((sum, r) => sum + r, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (windowRates[i] - yMean);
    denominator += Math.pow(i - xMean, 2);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;

  let trend: 'increasing' | 'decreasing' | 'stable';
  if (slope > 0.05) {
    trend = 'increasing';
  } else if (slope < -0.05) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }

  return { trend, slope };
}
