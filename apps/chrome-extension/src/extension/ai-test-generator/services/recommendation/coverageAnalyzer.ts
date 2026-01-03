/**
 * Coverage Analyzer
 * Analyzes test coverage and identifies gaps
 */

import type {
  CoverageData,
  CoverageGap,
  FeatureCoverage,
  PageCoverage,
  PathCoverage,
} from '../../types/recommendation';
import type { CaseStats, ExecutionRecord } from '../../types/analytics';
import { analyticsStorage } from '../analytics/analyticsStorage';

/**
 * Feature keywords for categorization
 */
const FEATURE_KEYWORDS: Record<string, string[]> = {
  authentication: ['login', 'logout', 'auth', 'signin', 'signout', '登录', '登出', '认证'],
  registration: ['signup', 'register', '注册', '创建账户'],
  checkout: ['checkout', 'payment', '支付', '结账', '购买'],
  search: ['search', '查找', '搜索'],
  profile: ['profile', 'settings', 'account', '个人', '设置', '账户'],
  navigation: ['home', 'dashboard', '导航', '首页', '仪表板'],
};

/**
 * URL patterns for page categorization
 */
const URL_PATTERNS: Record<string, RegExp[]> = {
  login: [/login/, /signin/, /auth/],
  home: [/^\/$/, /home/, /index/],
  dashboard: [/dashboard/, /panel/],
  settings: [/settings/, /preferences/, /config/],
  profile: [/profile/, /account/, /user/],
};

/**
 * Coverage Analyzer class
 */
export class CoverageAnalyzer {
  private cachedCoverage: CoverageData | null = null;
  private cacheTime: number = 0;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  /**
   * Analyze feature coverage
   */
  async analyzeFeatureCoverage(): Promise<FeatureCoverage[]> {
    const allStats = await analyticsStorage.getAllCaseStats();
    const featureMap = new Map<string, Set<string>>();

    // Categorize cases by feature
    for (const caseStat of allStats) {
      const features = this.identifyFeatures(caseStat.caseName);
      for (const feature of features) {
        const cases = featureMap.get(feature.id) ?? new Set<string>();
        cases.add(caseStat.caseId);
        featureMap.set(feature.id, cases);
      }
    }

    // Calculate coverage
    const featureCoverage: FeatureCoverage[] = [];
    for (const [featureId, cases] of featureMap) {
      const featureName = this.getFeatureName(featureId);
      const coveredCases = Array.from(cases);

      // Estimate coverage percentage based on case count and pass rate
      let totalPassRate = 0;
      for (const caseId of coveredCases) {
        const stat = allStats.find((s) => s.caseId === caseId);
        if (stat) totalPassRate += stat.passRate;
      }
      const avgPassRate = coveredCases.length > 0 ? totalPassRate / coveredCases.length : 0;
      const coveragePercent = Math.min(100, avgPassRate * (1 + Math.log10(coveredCases.length) * 0.1));

      featureCoverage.push({
        featureId,
        featureName,
        coveredCases,
        coveragePercent: Math.round(coveragePercent),
      });
    }

    // Sort by coverage percentage (ascending to show gaps first)
    featureCoverage.sort((a, b) => a.coveragePercent - b.coveragePercent);

    return featureCoverage;
  }

  /**
   * Analyze page coverage
   */
  async analyzePageCoverage(): Promise<PageCoverage[]> {
    const executions = await analyticsStorage.getRecentExecutions(100);
    const pageMap = new Map<string, Set<string>>();

    // Group cases by page (from URL in execution)
    for (const exec of executions) {
      const pageId = this.identifyPage(exec.environment.url);
      const cases = pageMap.get(pageId) ?? new Set<string>();
      cases.add(exec.caseId);
      pageMap.set(pageId, cases);
    }

    // Calculate coverage
    const pageCoverage: PageCoverage[] = [];
    for (const [url, cases] of pageMap) {
      const pageName = this.getPageName(url);
      const coveredCases = Array.from(cases);

      // Get pass rate for cases covering this page
      const allStats = await analyticsStorage.getAllCaseStats();
      let totalPassRate = 0;
      let validCount = 0;

      for (const caseId of coveredCases) {
        const stat = allStats.find((s) => s.caseId === caseId);
        if (stat) {
          totalPassRate += stat.passRate;
          validCount++;
        }
      }

      const avgPassRate = validCount > 0 ? totalPassRate / validCount : 0;
      const coveragePercent = Math.min(100, avgPassRate * (1 + Math.log10(coveredCases.length) * 0.1));

      pageCoverage.push({
        url,
        pageName,
        coveredCases,
        coveragePercent: Math.round(coveragePercent),
      });
    }

    pageCoverage.sort((a, b) => a.coveragePercent - b.coveragePercent);

    return pageCoverage;
  }

  /**
   * Analyze user path coverage
   */
  async analyzePathCoverage(): Promise<PathCoverage[]> {
    const executions = await analyticsStorage.getRecentExecutions(100);
    const pathMap = new Map<string, { cases: Set<string>; steps: Set<string> }>();

    // Extract paths from execution steps
    for (const exec of executions) {
      const pathId = this.extractPathId(exec);

      if (!pathMap.has(pathId)) {
        pathMap.set(pathId, { cases: new Set(), steps: new Set() });
      }

      const pathData = pathMap.get(pathId)!;
      pathData.cases.add(exec.caseId);

      for (const step of exec.steps) {
        pathData.steps.add(step.description);
      }
    }

    // Calculate coverage
    const pathCoverage: PathCoverage[] = [];
    for (const [pathId, data] of pathMap) {
      const coveredCases = Array.from(data.cases);
      const steps = Array.from(data.steps);

      // Estimate coverage based on path completion rate
      const allStats = await analyticsStorage.getAllCaseStats();
      let totalPassRate = 0;
      let validCount = 0;

      for (const caseId of coveredCases) {
        const stat = allStats.find((s) => s.caseId === caseId);
        if (stat) {
          totalPassRate += stat.passRate;
          validCount++;
        }
      }

      const avgPassRate = validCount > 0 ? totalPassRate / validCount : 0;
      const coveragePercent = Math.min(100, avgPassRate);

      pathCoverage.push({
        pathId,
        pathName: this.getPathName(pathId, steps),
        steps,
        coveredCases,
        coveragePercent: Math.round(coveragePercent),
      });
    }

    pathCoverage.sort((a, b) => a.coveragePercent - b.coveragePercent);

    return pathCoverage;
  }

  /**
   * Identify coverage gaps
   */
  async identifyGaps(): Promise<CoverageGap[]> {
    const gaps: CoverageGap[] = [];

    const [features, pages, paths] = await Promise.all([
      this.analyzeFeatureCoverage(),
      this.analyzePageCoverage(),
      this.analyzePathCoverage(),
    ]);

    // Find feature gaps
    for (const feature of features) {
      if (feature.coveragePercent < 60) {
        gaps.push({
          type: 'feature',
          target: feature.featureId,
          description: `功能 "${feature.featureName}" 覆盖率仅 ${feature.coveragePercent}%`,
          suggestedCases: [],
        });
      }
    }

    // Find page gaps
    for (const page of pages) {
      if (page.coveragePercent < 60) {
        gaps.push({
          type: 'page',
          target: page.url,
          description: `页面 "${page.pageName}" 覆盖率仅 ${page.coveragePercent}%`,
          suggestedCases: [],
        });
      }
    }

    // Find path gaps
    for (const path of paths) {
      if (path.coveragePercent < 60) {
        gaps.push({
          type: 'path',
          target: path.pathId,
          description: `路径 "${path.pathName}" 覆盖率仅 ${path.coveragePercent}%`,
          suggestedCases: [],
        });
      }
    }

    return gaps;
  }

  /**
   * Get overall coverage data
   */
  async getOverallCoverage(): Promise<CoverageData> {
    const now = Date.now();
    if (this.cachedCoverage && now - this.cacheTime < this.CACHE_DURATION) {
      return this.cachedCoverage;
    }

    const [features, pages, paths, gaps] = await Promise.all([
      this.analyzeFeatureCoverage(),
      this.analyzePageCoverage(),
      this.analyzePathCoverage(),
      this.identifyGaps(),
    ]);

    // Calculate overall score
    const featureScore =
      features.length > 0
        ? features.reduce((sum, f) => sum + f.coveragePercent, 0) / features.length
        : 100;
    const pageScore =
      pages.length > 0
        ? pages.reduce((sum, p) => sum + p.coveragePercent, 0) / pages.length
        : 100;
    const pathScore =
      paths.length > 0
        ? paths.reduce((sum, p) => sum + p.coveragePercent, 0) / paths.length
        : 100;

    const overallScore = Math.round((featureScore * 0.4 + pageScore * 0.3 + pathScore * 0.3));

    this.cachedCoverage = {
      features,
      pages,
      userPaths: paths,
      overallScore,
      gaps,
    };
    this.cacheTime = now;

    return this.cachedCoverage;
  }

  /**
   * Clear coverage cache
   */
  clearCache(): void {
    this.cachedCoverage = null;
    this.cacheTime = 0;
  }

  /**
   * Identify features from case name
   */
  private identifyFeatures(caseName: string): Array<{ id: string; name: string }> {
    const lowerName = caseName.toLowerCase();
    const features: Array<{ id: string; name: string }> = [];

    for (const [featureId, keywords] of Object.entries(FEATURE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerName.includes(keyword)) {
          features.push({ id: featureId, name: this.getFeatureName(featureId) });
          break;
        }
      }
    }

    return features.length > 0 ? features : [{ id: 'other', name: '其他' }];
  }

  /**
   * Get feature display name
   */
  private getFeatureName(featureId: string): string {
    const names: Record<string, string> = {
      authentication: '认证登录',
      registration: '注册',
      checkout: '支付购买',
      search: '搜索',
      profile: '个人中心',
      navigation: '导航',
      other: '其他',
    };
    return names[featureId] ?? featureId;
  }

  /**
   * Identify page from URL
   */
  private identifyPage(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();

      for (const [pageId, patterns] of Object.entries(URL_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(pathname)) {
            return pageId;
          }
        }
      }

      // Return path as page ID if no match
      return pathname.split('/').filter(Boolean).join('-') || 'home';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get page display name
   */
  private getPageName(pageId: string): string {
    const names: Record<string, string> = {
      home: '首页',
      login: '登录页',
      dashboard: '仪表板',
      settings: '设置页',
      profile: '个人资料页',
      unknown: '未知页面',
    };
    return names[pageId] ?? pageId;
  }

  /**
   * Extract path ID from execution
   */
  private extractPathId(exec: ExecutionRecord): string {
    // Create a simple path signature from the first few steps
    const stepDescriptions = exec.steps.slice(0, 3).map((s) => s.description.toLowerCase());
    return stepDescriptions.join('->').slice(0, 50) || 'unknown-path';
  }

  /**
   * Get path display name
   */
  private getPathName(pathId: string, steps: string[]): string {
    if (steps.length > 0) {
      return `${steps[0].slice(0, 20)}... (+${steps.length - 1})`;
    }
    return pathId;
  }
}

// Export singleton instance
export const coverageAnalyzer = new CoverageAnalyzer();
