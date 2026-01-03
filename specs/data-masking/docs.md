# Data Masking Documentation

This document provides comprehensive guidance for the data masking module in the AI Test Generator Chrome Extension.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Built-in Rules Reference](#built-in-rules-reference)
4. [Custom Rules Guide](#custom-rules-guide)
5. [API Reference](#api-reference)
6. [Best Practices](#best-practices)

---

## Overview

The data masking module automatically detects and masks sensitive data in:
- **Text**: Test steps, assertions, log messages
- **Screenshots**: Visual test reports
- **YAML**: Test script files
- **Logs**: Console output

### Key Features

- 13+ built-in detection rules covering credentials, PII, and financial data
- Multi-region support (China, International)
- Configurable masking methods (full, partial, hash, placeholder)
- Whitelist management for exclusions
- Performance-optimized for real-time use

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       MaskerEngine                               │
│  ┌──────────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │ DetectorEngine   │  │ WhitelistMgr  │  │ MaskingMethods  │  │
│  │ (Pattern Match)  │  │ (Exclusions)  │  │ (full/partial..)│  │
│  └────────┬─────────┘  └───────────────┘  └─────────────────┘  │
│           │                                                      │
│  ┌────────▼─────────┐                                           │
│  │ Built-in Rules   │                                           │
│  │ (13+ rules)      │                                           │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌────────────────┐   ┌────────────────┐
│  LogMasker    │   │  ImageMasker   │   │  YamlChecker   │
│  (Console)    │   │  (Screenshots) │   │  (Scripts)     │
└───────────────┘   └────────────────┘   └────────────────┘
```

---

## Built-in Rules Reference

### Credential Rules (High Priority)

| Rule ID | Name | Pattern | Priority | Default |
|---------|------|---------|----------|---------|
| `builtin-password` | Password Field | `password=xxx` | 90 | Enabled |
| `builtin-api-key` | API Key | `apikey=xxx` | 95 | Enabled |
| `builtin-bearer-token` | Bearer Token | `Bearer xxx` | 95 | Enabled |
| `builtin-jwt` | JWT Token | `eyJ...` | 95 | Enabled |
| `builtin-aws-key` | AWS Access Key | `AKIA...` | 95 | Enabled |
| `builtin-private-key` | Private Key | `-----BEGIN...` | 98 | Enabled |
| `builtin-openai-key` | OpenAI API Key | `sk-xxx` | 95 | Enabled |

### PII Rules (Medium Priority)

| Rule ID | Name | Pattern | Priority | Default |
|---------|------|---------|----------|---------|
| `builtin-phone-cn` | China Mobile | `1[3-9]xxxxxxxxx` | 80 | Enabled |
| `builtin-phone-intl` | International Phone | `+xx xxx-xxxx` | 75 | Enabled |
| `builtin-id-card-cn` | China ID Card | 18-digit ID | 85 | Enabled |
| `builtin-email` | Email Address | `xxx@xxx.xxx` | 70 | Enabled |
| `builtin-name-cn` | Chinese Name | 姓名: xxx | 50 | **Disabled** |
| `builtin-address-cn` | Chinese Address | 地址: xxx | 45 | **Disabled** |

### Financial Rules (High Priority)

| Rule ID | Name | Pattern | Priority | Default |
|---------|------|---------|----------|---------|
| `builtin-bank-card` | Bank Card Number | 16-19 digits | 85 | Enabled |
| `builtin-credit-card-cvv` | CVV Code | `cvv: xxx` | 80 | Enabled |

### Masking Methods

| Method | Description | Example |
|--------|-------------|---------|
| `full` | Replace all characters | `secret123` → `*********` |
| `partial` | Keep start/end chars | `13812345678` → `138****5678` |
| `hash` | Consistent hash output | `email@test.com` → `[EMAIL:a3b4c5]` |
| `placeholder` | Fixed replacement | `sk-xxx` → `[OPENAI_KEY]` |

---

## Custom Rules Guide

### Rule Structure

```typescript
interface DetectionRule {
  id: string;           // Unique identifier
  name: string;         // Display name
  description: string;  // Rule description
  enabled: boolean;     // Whether rule is active
  priority: number;     // Higher = matches first (0-100)
  detection: {
    type: 'regex';      // Currently only regex supported
    pattern: string;    // Regex pattern
    flags?: string;     // Regex flags (default: 'g')
    context?: {         // Optional context constraints
      before?: string;  // Required text before match
      after?: string;   // Required text after match
    };
  };
  masking: {
    method: 'full' | 'partial' | 'hash' | 'placeholder';
    options?: {
      maskChar?: string;      // Default: '*'
      keepStart?: number;     // Chars to keep at start
      keepEnd?: number;       // Chars to keep at end
      hashLength?: number;    // Length of hash output
      placeholder?: string;   // Replacement text
    };
  };
  scope: {
    text: boolean;       // Apply to text
    screenshot: boolean; // Apply to screenshots
    log: boolean;        // Apply to logs
    yaml: boolean;       // Apply to YAML
  };
  category: 'credential' | 'pii' | 'financial' | 'health' | 'custom';
  builtIn?: boolean;     // System rules cannot be deleted
}
```

### Adding a Custom Rule

```typescript
import { detectorEngine } from './services/masking';

// Add a custom rule for internal employee IDs
detectorEngine.addRule({
  id: 'custom-employee-id',
  name: 'Employee ID',
  description: 'Detect internal employee ID format',
  enabled: true,
  priority: 60,
  detection: {
    type: 'regex',
    pattern: 'EMP-[A-Z]{2}\\d{6}',
    flags: 'g',
  },
  masking: {
    method: 'partial',
    options: { keepStart: 4, keepEnd: 2, maskChar: '*' },
  },
  scope: { text: true, screenshot: true, log: true, yaml: true },
  category: 'custom',
});
```

### Rule Priority Guidelines

| Priority Range | Use Case |
|---------------|----------|
| 90-100 | Critical credentials (API keys, passwords) |
| 80-89 | Financial data, ID cards |
| 70-79 | Contact information (phone, email) |
| 50-69 | Names, addresses |
| 0-49 | Low-confidence patterns |

---

## API Reference

### MaskerEngine

```typescript
import { maskerEngine } from './services/masking';

// Mask text
const result = await maskerEngine.maskText(input, 'text');
console.log(result.masked);    // Masked output
console.log(result.matches);   // Detection details

// Configure masking
maskerEngine.setConfig({
  enabled: true,
  textMasking: true,
  logMasking: true,
  yamlMasking: true,
  screenshotMasking: 'standard', // 'off' | 'minimal' | 'standard' | 'aggressive'
});
```

### DetectorEngine

```typescript
import { detectorEngine } from './services/masking';

// Detect sensitive data
const detections = await detectorEngine.detect(text, 'text');

// Manage rules
detectorEngine.addRule(customRule);
detectorEngine.removeRule('custom-rule-id');
detectorEngine.enableRule('builtin-email');
detectorEngine.disableRule('builtin-name-cn');
```

### WhitelistManager

```typescript
import { whitelistManager } from './services/masking';

// Add whitelist entry
whitelistManager.addEntry({
  type: 'exact',      // 'exact' | 'pattern' | 'domain' | 'path'
  value: 'test@example.com',
  description: 'Test email for E2E',
  enabled: true,
});

// Check whitelist
if (!whitelistManager.isWhitelisted(value)) {
  // Apply masking
}

// Manage whitelist
whitelistManager.enable();
whitelistManager.disable();
whitelistManager.getEntries();
whitelistManager.removeEntry(id);
```

### LogMasker

```typescript
import { logMasker } from './services/masking';

// Manual masking
const { message, data } = logMasker.mask('password=secret', { key: 'value' });

// Auto-wrap console (affects all console.* calls)
logMasker.wrapConsole();
console.log('password=secret123'); // Outputs: password=[PASSWORD]
logMasker.unwrapConsole();
```

### YamlChecker

```typescript
import { yamlChecker } from './services/masking';

// Check YAML for hardcoded secrets
const result = await yamlChecker.check(yamlContent);

if (result.hasSensitiveData) {
  console.log(result.warnings);     // List of warnings
  console.log(result.suggestions);  // Replacement suggestions

  // Apply suggestions
  const fixed = yamlChecker.applySuggestions(yamlContent, result.suggestions);

  // Generate parameter definitions
  const params = yamlChecker.generateParameterDefinitions(result.suggestions);
}
```

### ImageMasker

```typescript
import { imageMasker } from './services/masking';

// Mask regions in image
const regions = [
  { x: 100, y: 200, width: 150, height: 30, type: 'password' },
];
const maskedBlob = await imageMasker.maskImage(imageBlob, regions);

// Use OCR detection
import { detectScreenshotMaskRegions } from './services/masking';
const autoRegions = await detectScreenshotMaskRegions(imageBlob);
```

---

## Best Practices

### 1. Test Your Rules

Always test custom rules before deployment:

```typescript
const testCases = [
  { input: 'EMP-AB123456', shouldMatch: true },
  { input: 'EMP-123456', shouldMatch: false },
  { input: 'Contains EMP-CD654321 in text', shouldMatch: true },
];

for (const { input, shouldMatch } of testCases) {
  const matches = await detectorEngine.detect(input, 'text');
  console.assert(
    (matches.length > 0) === shouldMatch,
    `Failed: ${input}`
  );
}
```

### 2. Use Appropriate Scopes

Not all rules need all scopes:

```typescript
// PII in user-facing text but not in YAML scripts
scope: { text: true, screenshot: true, log: true, yaml: false }

// Credentials everywhere
scope: { text: true, screenshot: true, log: true, yaml: true }
```

### 3. Balance Precision vs Recall

- **High false positives**: Reduce priority, add context constraints
- **Missing detections**: Broaden pattern, increase priority

```typescript
// Add context to reduce false positives
detection: {
  type: 'regex',
  pattern: '\\d{11}',
  context: {
    before: '(?:手机|电话|phone)',  // Only match when preceded by phone-related text
  },
}
```

### 4. Whitelist Test Data

Avoid masking test fixtures:

```typescript
// Whitelist test domain
whitelistManager.addEntry({
  type: 'domain',
  value: 'test.example.com',
  description: 'Test environment',
  enabled: true,
});

// Whitelist specific test values
whitelistManager.addEntry({
  type: 'exact',
  value: 'testuser@example.com',
  description: 'E2E test email',
  enabled: true,
});
```

### 5. Performance Considerations

- Masking adds ~5-10ms per KB of text
- Screenshot masking with OCR: ~200-500ms per image
- Disable unused scopes for better performance

```typescript
// Disable screenshot masking in development
maskerEngine.setConfig({
  screenshotMasking: 'off',
});
```

### 6. YAML Script Security

Always check YAML before saving:

```typescript
async function saveTestScript(yaml: string) {
  const result = await yamlChecker.check(yaml);

  if (result.hasSensitiveData) {
    const warnings = yamlChecker.formatWarnings(result.warnings);
    throw new Error(`Sensitive data detected:\n${warnings.join('\n')}`);
  }

  // Safe to save
}
```

### 7. Audit Logging

Track masking activity for compliance:

```typescript
import { auditLogger } from './services/masking';

// Log masking events
await auditLogger.log({
  type: 'text',
  ruleId: 'builtin-password',
  category: 'credential',
  source: 'test-step-123',
  matchCount: 1,
});

// Generate audit report
const stats = await auditLogger.getStats(startTime, endTime);
const report = await auditLogger.exportToJSON();
```

---

## Troubleshooting

### Rule Not Matching

1. Check if rule is enabled: `detectorEngine.getRule(id)?.enabled`
2. Verify scope includes your use case
3. Test regex pattern independently
4. Check priority (higher priority rules may consume matches)

### Over-Masking

1. Add value to whitelist
2. Reduce rule priority
3. Add context constraints to pattern
4. Disable rule for specific scopes

### Performance Issues

1. Disable unused scopes
2. Set `screenshotMasking: 'minimal'` or `'off'`
3. Reduce number of enabled rules
4. Use LogMasker's sync mode for hot paths

---

## Changelog

- **v1.0.0**: Initial release with 13 built-in rules
- Support for text, screenshot, log, and YAML masking
- Whitelist management
- Audit logging with IndexedDB storage
