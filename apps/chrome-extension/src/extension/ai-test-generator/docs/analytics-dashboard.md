# Analytics Dashboard User Guide

## Overview

The Analytics Dashboard provides comprehensive insights into your test execution history, helping you identify trends, detect flaky tests, and monitor overall test health.

## Features

### 1. Dashboard Overview

Access the dashboard by clicking the "Analytics" button in the AI Test Generator panel.

#### KPI Cards
- **Total Executions**: Number of test runs in the selected time range
- **Pass Rate**: Percentage of successful tests with trend indicator
- **Average Duration**: Mean execution time with trend comparison
- **Health Score**: Overall test suite health (0-100)

#### Time Range Filter
- **Today**: Current day's data
- **7 Days**: Last week's data
- **30 Days**: Last month's data
- **Custom**: Select specific date range

### 2. Trend Charts

#### Execution Trend
Stacked bar chart showing daily pass/fail distribution:
- Green bars: Passed tests
- Red bars: Failed tests

#### Pass Rate Trend
Line chart tracking daily pass rate percentage over time.

#### Duration Trend
Line chart showing average execution time trends.

### 3. Failure Analysis

#### Failure Type Distribution
Donut chart categorizing failures by type:
- **Locator Failed**: Element not found
- **Assertion Failed**: Validation errors
- **Timeout**: Operation exceeded time limit
- **Network Error**: Connection issues
- **Script Error**: Runtime exceptions
- **Unknown**: Unclassified errors

#### Failure Hotspots
Ranked list of most frequently failing test steps, helping identify problematic areas.

#### Failure Patterns
AI-detected patterns in test failures with suggested remediation actions.

### 4. Test Case Management

#### Case List
Sortable table showing all test cases with:
- Case name
- Total runs
- Pass rate
- Stability score
- Recent results (last 10 runs)
- Last run timestamp

#### Stability Indicators
- **Stable** (Green): Consistently passing
- **Flaky** (Yellow): Intermittent failures (20-80% pass rate)
- **Unstable** (Red): Frequently failing

### 5. Alert System

#### Alert Rules
Configure automatic notifications when conditions are met:

| Condition Type | Description | Example |
|---------------|-------------|---------|
| Pass Rate | Triggers when pass rate drops below threshold | < 70% in last hour |
| Consecutive Failures | Triggers after N consecutive failures | 3+ failures in a row |
| Duration | Triggers when execution time exceeds baseline | > 150% of average |
| Flaky Detection | Triggers when new flaky test is detected | - |

#### Notification Channels
- **Browser Notification**: Desktop push notifications
- **Webhook**: HTTP POST to custom endpoint

#### Managing Rules
1. Click "Add Rule" to create new alert
2. Select condition type and set threshold
3. Choose notification channels
4. Enable/disable rules with toggle switch
5. Edit or delete existing rules as needed

#### Alert Events
- View recent triggered alerts
- Click "Confirm" to acknowledge handled alerts
- Badge shows unacknowledged alert count

## Configuration

### Data Retention
Analytics data is stored locally using localStorage. Data is automatically cleaned up based on retention policy (default: 90 days).

### Webhook Integration

Example webhook payload:
```json
{
  "type": "test_alert",
  "event": {
    "id": "event-xxx",
    "ruleName": "Pass Rate Alert",
    "message": "Pass rate (65.5%) below threshold 70%",
    "triggeredAt": 1704123456789,
    "condition": {
      "type": "pass_rate",
      "threshold": 70,
      "timeWindow": 60
    },
    "currentValue": 65.5
  }
}
```

### DingTalk Integration

Configure webhook URL with your DingTalk robot:
```
https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN
```

## Best Practices

### 1. Monitor Health Score
- Score > 80: Healthy test suite
- Score 50-80: Needs attention
- Score < 50: Critical issues

### 2. Address Flaky Tests
- Review tests marked as "Flaky"
- Check failure patterns for root cause
- Consider adding waits or improving locators

### 3. Set Up Alerts
- Configure pass rate alert at 70-80%
- Enable consecutive failure alerts (3-5 threshold)
- Use webhooks to integrate with team chat

### 4. Regular Review
- Check dashboard weekly
- Export reports for team meetings
- Track trend improvements over time

## Troubleshooting

### No Data Displayed
- Ensure tests have been executed at least once
- Check selected time range includes test runs
- Verify localStorage is not cleared

### Alerts Not Triggering
- Confirm rule is enabled
- Check threshold values are appropriate
- Verify notification permissions for browser alerts

### Webhook Failures
- Validate webhook URL is accessible
- Check CORS settings on target server
- Review browser console for error details

## API Reference

### Data Collector
```typescript
import { dataCollector } from './services/analytics';

// Record execution automatically via ExecutionEngine
// Or manually:
const record = dataCollector.createExecutionRecord(
  caseId,
  caseName,
  stepRecords,
  environment,
  healingInfo
);
await dataCollector.recordExecution(record);
```

### Analysis Engine
```typescript
import { analysisEngine } from './services/analytics';

// Get dashboard overview
const overview = await analysisEngine.getDashboardOverview('7days');

// Get case statistics
const cases = await analysisEngine.getCaseStatsSorted('passRate', false);

// Calculate health score
const health = await analysisEngine.calculateHealthScore('30days');
```

### Alert Manager
```typescript
import { alertManager } from './services/analytics';

// Initialize with default rules
await alertManager.init();

// Create custom rule
const rule = await alertManager.createRule({
  name: 'Custom Alert',
  enabled: true,
  condition: { type: 'pass_rate', threshold: 80, timeWindow: 30 },
  notification: { channels: ['browser', 'webhook'], webhookUrl: '...' }
});

// Check alerts manually
const events = await alertManager.checkAlerts(executionRecord);
```

### Report Generator
```typescript
import { reportGenerator } from './services/analytics';

// Generate daily report
const report = await reportGenerator.generateDailyReport();

// Export as Markdown
const markdown = reportGenerator.exportAsMarkdown(report);

// Export as HTML
const html = reportGenerator.exportAsHTML(report);
```
