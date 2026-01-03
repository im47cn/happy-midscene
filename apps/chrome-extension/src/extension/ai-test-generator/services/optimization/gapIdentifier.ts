/**
 * Gap Identifier
 * Identifies coverage gaps and suggests new test cases
 */

import type { ExecutionRecord } from '../../types/analytics';
import type {
  CoverageGap,
  Feature,
  MissingScenario,
  Priority,
  RiskLevel,
  SuggestedCase,
} from '../../types/optimization';
import type { IGapIdentifier } from './interfaces';
import { analyticsStorage } from '../analytics/analyticsStorage';

// Common features to check for coverage
const COMMON_FEATURES: Feature[] = [
  {
    id: 'auth-login',
    name: '登录功能',
    requiredCoverage: 80,
    relatedCases: [],
  },
  {
    id: 'auth-logout',
    name: '登出功能',
    requiredCoverage: 60,
    relatedCases: [],
  },
  {
    id: 'auth-password-reset',
    name: '密码重置',
    requiredCoverage: 70,
    relatedCases: [],
  },
  {
    id: 'form-validation',
    name: '表单验证',
    requiredCoverage: 75,
    relatedCases: [],
  },
  {
    id: 'error-handling',
    name: '错误处理',
    requiredCoverage: 70,
    relatedCases: [],
  },
  {
    id: 'navigation',
    name: '页面导航',
    requiredCoverage: 60,
    relatedCases: [],
  },
  {
    id: 'search',
    name: '搜索功能',
    requiredCoverage: 70,
    relatedCases: [],
  },
  {
    id: 'pagination',
    name: '分页功能',
    requiredCoverage: 50,
    relatedCases: [],
  },
  {
    id: 'responsive',
    name: '响应式设计',
    requiredCoverage: 40,
    relatedCases: [],
  },
  {
    id: 'accessibility',
    name: '无障碍访问',
    requiredCoverage: 30,
    relatedCases: [],
  },
];

// Keywords for feature detection
const FEATURE_KEYWORDS: Record<string, string[]> = {
  'auth-login': ['login', '登录', 'sign in', 'signin', '认证', 'authenticate'],
  'auth-logout': ['logout', '登出', 'sign out', 'signout', '退出'],
  'auth-password-reset': ['password', 'reset', '密码', '重置', 'forgot'],
  'form-validation': ['validate', '验证', 'required', 'error', '必填', 'invalid'],
  'error-handling': ['error', '错误', 'fail', '失败', 'exception', '异常'],
  'navigation': ['navigate', '导航', 'menu', '菜单', 'link', 'route'],
  'search': ['search', '搜索', 'find', '查找', 'filter', '筛选'],
  'pagination': ['page', '分页', 'next', 'previous', '上一页', '下一页'],
  'responsive': ['mobile', '移动', 'tablet', 'viewport', '视口', 'responsive'],
  'accessibility': ['a11y', 'aria', 'screen reader', 'keyboard', '无障碍'],
};

class GapIdentifier implements IGapIdentifier {
  /**
   * Identify all coverage gaps
   */
  async identify(): Promise<CoverageGap[]> {
    const executions = await analyticsStorage.getRecentExecutions(1000);
    const gaps: CoverageGap[] = [];

    // Map executions to features
    const featureCoverage = this.mapExecutionsToFeatures(executions);

    // Check each feature for gaps
    for (const feature of COMMON_FEATURES) {
      const coverage = featureCoverage.get(feature.id) || 0;

      if (coverage < feature.requiredCoverage) {
        const missingScenarios = await this.suggestCases({
          feature: feature.name,
          currentCoverage: coverage,
          recommendedCoverage: feature.requiredCoverage,
          missingScenarios: [],
          riskLevel: this.calculateRiskLevel(feature.requiredCoverage, coverage),
        });

        gaps.push({
          feature: feature.name,
          currentCoverage: coverage,
          recommendedCoverage: feature.requiredCoverage,
          missingScenarios,
          riskLevel: this.calculateRiskLevel(feature.requiredCoverage, coverage),
        });
      }
    }

    // Sort by risk level
    return gaps.sort(
      (a, b) => this.riskPriority(b.riskLevel) - this.riskPriority(a.riskLevel),
    );
  }

  /**
   * Calculate coverage for a specific feature
   */
  async calculateCoverage(featureId: string): Promise<number> {
    const executions = await analyticsStorage.getRecentExecutions(1000);
    const featureCoverage = this.mapExecutionsToFeatures(executions);
    return featureCoverage.get(featureId) || 0;
  }

  /**
   * Suggest test cases for a coverage gap
   */
  async suggestCases(gap: CoverageGap): Promise<MissingScenario[]> {
    const scenarios: MissingScenario[] = [];
    const featureId = this.findFeatureId(gap.feature);

    if (!featureId) {
      return scenarios;
    }

    // Generate scenarios based on feature type
    const templates = this.getScenarioTemplates(featureId);

    for (const template of templates) {
      scenarios.push({
        description: template.description,
        importance: template.priority,
        suggestedCase: {
          name: template.name,
          description: template.description,
          steps: template.steps,
          priority: template.priority,
        },
      });
    }

    return scenarios.slice(0, 5); // Limit to top 5 suggestions
  }

  /**
   * Assess risk level for a gap
   */
  async assessRisk(gap: CoverageGap): Promise<RiskLevel> {
    return this.calculateRiskLevel(gap.recommendedCoverage, gap.currentCoverage);
  }

  /**
   * Map executions to features and calculate coverage
   */
  private mapExecutionsToFeatures(
    executions: ExecutionRecord[],
  ): Map<string, number> {
    const featureExecutions = new Map<string, Set<string>>();

    // Initialize feature sets
    for (const feature of COMMON_FEATURES) {
      featureExecutions.set(feature.id, new Set());
    }

    // Map each execution to features based on keywords
    for (const exec of executions) {
      const stepDescriptions = exec.steps.map((s) =>
        s.description.toLowerCase(),
      );
      const allText = stepDescriptions.join(' ');

      for (const [featureId, keywords] of Object.entries(FEATURE_KEYWORDS)) {
        if (keywords.some((keyword) => allText.includes(keyword.toLowerCase()))) {
          featureExecutions.get(featureId)?.add(exec.caseId);
        }
      }
    }

    // Calculate coverage as percentage of test cases covering each feature
    const uniqueCaseIds = new Set(executions.map((e) => e.caseId));
    const totalCases = uniqueCaseIds.size || 1;

    const coverage = new Map<string, number>();

    for (const [featureId, caseIds] of featureExecutions) {
      const percentage = (caseIds.size / totalCases) * 100;
      coverage.set(featureId, Math.round(percentage));
    }

    return coverage;
  }

  /**
   * Calculate risk level based on coverage gap
   */
  private calculateRiskLevel(required: number, current: number): RiskLevel {
    const gap = required - current;

    if (gap >= 50) return 'critical';
    if (gap >= 30) return 'high';
    if (gap >= 15) return 'medium';
    return 'low';
  }

  /**
   * Get priority value for risk level
   */
  private riskPriority(risk: RiskLevel): number {
    const priorities: Record<RiskLevel, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return priorities[risk];
  }

  /**
   * Find feature ID by name
   */
  private findFeatureId(featureName: string): string | null {
    const feature = COMMON_FEATURES.find((f) => f.name === featureName);
    return feature?.id || null;
  }

  /**
   * Get scenario templates for a feature
   */
  private getScenarioTemplates(
    featureId: string,
  ): {
    name: string;
    description: string;
    steps: string[];
    priority: Priority;
  }[] {
    const templates: Record<
      string,
      { name: string; description: string; steps: string[]; priority: Priority }[]
    > = {
      'auth-login': [
        {
          name: '登录成功 - 有效凭证',
          description: '使用有效用户名和密码登录',
          steps: [
            '打开登录页面',
            '输入有效用户名',
            '输入有效密码',
            '点击登录按钮',
            '验证登录成功',
          ],
          priority: 'high',
        },
        {
          name: '登录失败 - 无效密码',
          description: '使用错误密码尝试登录',
          steps: [
            '打开登录页面',
            '输入有效用户名',
            '输入错误密码',
            '点击登录按钮',
            '验证错误提示',
          ],
          priority: 'high',
        },
        {
          name: '登录失败 - 空字段验证',
          description: '不填写任何字段尝试登录',
          steps: [
            '打开登录页面',
            '点击登录按钮',
            '验证必填字段提示',
          ],
          priority: 'medium',
        },
      ],
      'auth-logout': [
        {
          name: '正常登出',
          description: '用户正常登出系统',
          steps: ['登录系统', '点击登出按钮', '验证跳转到登录页'],
          priority: 'medium',
        },
        {
          name: '登出后会话清除',
          description: '验证登出后会话数据被清除',
          steps: [
            '登录系统',
            '点击登出',
            '尝试访问受保护页面',
            '验证重定向到登录页',
          ],
          priority: 'high',
        },
      ],
      'auth-password-reset': [
        {
          name: '密码重置请求',
          description: '发送密码重置邮件',
          steps: [
            '打开忘记密码页面',
            '输入注册邮箱',
            '点击发送重置链接',
            '验证成功提示',
          ],
          priority: 'high',
        },
        {
          name: '密码重置 - 无效邮箱',
          description: '使用未注册邮箱请求密码重置',
          steps: [
            '打开忘记密码页面',
            '输入未注册邮箱',
            '点击发送重置链接',
            '验证错误提示',
          ],
          priority: 'medium',
        },
      ],
      'form-validation': [
        {
          name: '必填字段验证',
          description: '验证表单必填字段',
          steps: [
            '打开包含表单的页面',
            '不填写任何字段',
            '提交表单',
            '验证必填字段提示',
          ],
          priority: 'high',
        },
        {
          name: '格式验证 - 邮箱',
          description: '验证邮箱格式',
          steps: [
            '打开表单',
            '输入无效邮箱格式',
            '触发验证',
            '验证格式错误提示',
          ],
          priority: 'medium',
        },
        {
          name: '长度限制验证',
          description: '验证输入长度限制',
          steps: [
            '打开表单',
            '输入超长文本',
            '验证长度限制提示',
          ],
          priority: 'medium',
        },
      ],
      'error-handling': [
        {
          name: '网络错误处理',
          description: '验证网络错误时的用户提示',
          steps: [
            '模拟网络断开',
            '执行网络请求',
            '验证错误提示',
            '验证可以重试',
          ],
          priority: 'high',
        },
        {
          name: '服务器错误处理',
          description: '验证服务器错误时的处理',
          steps: [
            '触发服务器错误',
            '验证错误页面或提示',
            '验证错误可以恢复',
          ],
          priority: 'high',
        },
      ],
      'navigation': [
        {
          name: '主导航功能',
          description: '验证主要导航链接',
          steps: [
            '打开首页',
            '点击导航菜单项',
            '验证跳转到正确页面',
          ],
          priority: 'medium',
        },
        {
          name: '面包屑导航',
          description: '验证面包屑导航功能',
          steps: [
            '导航到深层页面',
            '验证面包屑显示正确',
            '点击面包屑链接',
            '验证正确跳转',
          ],
          priority: 'low',
        },
      ],
      'search': [
        {
          name: '基本搜索',
          description: '验证搜索功能',
          steps: [
            '打开搜索页面',
            '输入搜索关键词',
            '执行搜索',
            '验证搜索结果',
          ],
          priority: 'high',
        },
        {
          name: '空搜索结果',
          description: '验证无搜索结果时的处理',
          steps: [
            '输入不存在的关键词',
            '执行搜索',
            '验证空结果提示',
          ],
          priority: 'medium',
        },
      ],
      'pagination': [
        {
          name: '分页导航',
          description: '验证分页功能',
          steps: [
            '打开列表页',
            '点击下一页',
            '验证数据变化',
            '点击上一页',
            '验证返回正确',
          ],
          priority: 'medium',
        },
      ],
      'responsive': [
        {
          name: '移动端布局',
          description: '验证移动端响应式布局',
          steps: [
            '设置移动端视口',
            '验证页面布局正确',
            '验证导航菜单可用',
          ],
          priority: 'medium',
        },
      ],
      'accessibility': [
        {
          name: '键盘导航',
          description: '验证键盘可访问性',
          steps: [
            '使用Tab键导航',
            '验证焦点可见',
            '使用Enter键激活',
          ],
          priority: 'medium',
        },
      ],
    };

    return templates[featureId] || [];
  }
}

export const gapIdentifier = new GapIdentifier();
