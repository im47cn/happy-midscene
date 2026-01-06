# @midscene/ci

CI/CD integration for Midscene test automation with support for GitHub Actions, GitLab CI, Jenkins, Azure DevOps, and CircleCI.

## Features

- **Multi-Platform Support**: Native integrations for 5 major CI/CD platforms
- **Parallel Execution**: Intelligent test sharding for faster CI runs
- **Quality Gates**: Configurable rules to enforce code quality standards
- **Multiple Report Formats**: JUnit XML, JSON, HTML, and Markdown reports
- **Retry Mechanism**: Automatic retry for flaky tests
- **Artifact Management**: Automatic upload of screenshots and logs
- **PR Comments**: Direct feedback on pull requests

## Installation

```bash
npm install @midscene/ci
```

## Usage

### CLI

```bash
# Run tests with CI reporter
npx midscene-ci test --suite=regression

# Generate quality gate evaluation
npx midscene-ci quality-gate --config=ci.config.yml

# Generate reports
npx midscene-ci report --input=results.json --format=junit,html
```

### GitHub Actions

```yaml
name: Midscene Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: midscene/test-action@v1
        with:
          test-suite: regression
          shard: ${{ matrix.shard }}
          total-shards: 4
```

### Configuration

Create a `midscene.config.yml` file:

```yaml
version: '1.0'
suiteName: 'E2E Tests'
include: ['tests/**/*.spec.ts']
baseUrl: https://staging.example.com

parallel:
  enabled: true
  workers: 4

qualityGate:
  enabled: true
  passRateThreshold: 95
  criticalTestsMustPass: true
  maxNewFailures: 0
  maxFlakyTests: 5

report:
  formats: ['junit', 'html']
  uploadArtifacts: true
  commentOnPR: true

retry:
  enabled: true
  maxAttempts: 3
  onlyFailed: true
  delaySeconds: 30
```

## Platform Support

| Platform | Status | Features |
|----------|--------|----------|
| GitHub Actions | ✅ | Full support |
| GitLab CI | ✅ | Full support |
| Jenkins | ✅ | Plugin available |
| Azure DevOps | ✅ | Task available |
| CircleCI | ✅ | Orb available |

## License

MIT
