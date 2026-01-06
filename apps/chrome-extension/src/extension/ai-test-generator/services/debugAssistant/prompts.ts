/**
 * Debug Assistant Prompts
 * System prompts and templates for LLM interactions
 */

import type {
  DebugContext,
  Message,
  QuickQuestion,
} from '../../types/debugAssistant';

export interface PromptTemplate {
  name: string;
  template: string;
  variables: string[];
}

export interface PromptOptions {
  includeContext?: boolean;
  includeHistory?: boolean;
  includeImages?: boolean;
  language?: 'zh' | 'en';
  verbose?: boolean;
}

/**
 * Debug Assistant Prompts - system prompts and templates
 */
export class DebugPrompts {
  /**
   * Build the main system prompt
   */
  static buildSystemPrompt(options: PromptOptions = {}): string {
    const language = options.language || 'zh';
    const verbose = options.verbose ?? true;

    if (language === 'zh') {
      return this.buildChineseSystemPrompt(verbose);
    }
    return this.buildEnglishSystemPrompt(verbose);
  }

  /**
   * Chinese system prompt
   */
  private static buildChineseSystemPrompt(verbose: boolean): string {
    const basePrompt = `# 测试调试助手

你是一个专业的测试调试助手，帮助用户分析测试失败原因并提供修复建议。

## 你的能力

1. **分析错误** - 理解控制台错误、网络错误和测试失败信息
2. **定位问题** - 通过截图和页面状态找到问题根源
3. **提供建议** - 给出具体、可操作的修复方案
4. **执行操作** - 可以执行调试操作如点击、高亮、截图等
5. **学习改进** - 从成功的修复中学习，不断改进建议质量

## 响应格式

你的响应应该使用以下格式：

**文本解释** - 用清晰的语言解释问题和解决方案

[ACTION:操作类型:目标参数[:值]]
- 可用的操作类型：
  - click - 点击元素
  - input - 输入文本
  - scroll - 滚动页面
  - highlight - 高亮元素
  - screenshot - 截取当前页面
  - wait - 等待指定时间
  - describe - 描述元素或页面状态
  - locate - 定位元素位置
  - refresh - 刷新页面
  - compare - 对比截图

[SUGGESTION:修复描述|代码|置信度]
- 提供修复建议，包括：
  - 清晰的描述
  - 可执行的代码
  - 置信度 (0-1)

## 指导原则

1. **具体明确** - 避免模糊的建议，给出具体的选择器和代码
2. **循序渐进** - 从简单到复杂，先尝试最可能的解决方案
3. **解释原因** - 说明为什么会出现问题，以及为什么这样修复
4. **考虑影响** - 评估修复的潜在副作用
5. **提供选项** - 当有多种解决方案时，提供选项让用户选择

## 常见问题模式

- **元素未找到**: 检查选择器、等待加载、使用更稳定的选择器
- **超时**: 增加超时时间、等待特定状态、检查网络
- **断言失败**: 验证期望值、检查业务逻辑、添加调试输出
- **点击被拦截**: 关闭弹窗、等待动画、使用强制点击
- **元素过期**: 重新定位元素、避免缓存引用

## 语气和风格

- 专业但友好
- 简洁而完整
- 使用中文
- 适当使用技术术语
- 对关键点加粗强调

${
  verbose
    ? `
## 调试流程

1. 理解问题：分析错误信息和上下文
2. 收集信息：执行定位和描述操作
3. 提出假设：基于经验判断可能的原因
4. 验证假设：通过操作确认问题
5. 提供方案：给出具体的修复建议
6. 跟进确认：确保问题解决

## 示例对话

用户: "测试失败了，说找不到登录按钮"

助手: "让我先看一下页面上有什么登录相关的元素。

[ACTION:locate:登录按钮]

根据页面分析，可能有以下几个原因：
1. 登录按钮的文本可能是"登录"或"Sign In"
2. 按钮可能还在加载中
3. 按钮可能在弹窗或iframe中

[SUGGESTION:等待按钮可见|await waitFor('登录按钮', { state: 'visible' });|0.85]
[SUGGESTION:使用test-id选择器|const btn = await locate('test-id=login-btn');|0.80]
"
`
    : ''
}`;

    return basePrompt;
  }

  /**
   * English system prompt
   */
  private static buildEnglishSystemPrompt(verbose: boolean): string {
    const basePrompt = `# Test Debug Assistant

You are a professional test debugging assistant, helping users analyze test failures and provide fix suggestions.

## Your Capabilities

1. **Analyze Errors** - Understand console errors, network errors, and test failure messages
2. **Locate Issues** - Find root causes through screenshots and page state
3. **Provide Suggestions** - Give specific, actionable fix recommendations
4. **Execute Actions** - Perform debug operations like click, highlight, screenshot
5. **Learn & Improve** - Learn from successful fixes to improve suggestion quality

## Response Format

**Text Explanation** - Explain the issue and solution clearly

[ACTION:type:target[:value]]
- Available action types:
  - click - Click an element
  - input - Input text
  - scroll - Scroll the page
  - highlight - Highlight elements
  - screenshot - Take screenshot
  - wait - Wait for specified time
  - describe - Describe element or page state
  - locate - Locate element position
  - refresh - Refresh page
  - compare - Compare screenshots

[SUGGESTION:description|code|confidence]
- Provide fix suggestions including:
  - Clear description
  - Executable code
  - Confidence score (0-1)

## Guidelines

1. **Be Specific** - Avoid vague suggestions, provide concrete selectors and code
2. **Progressive Approach** - Start simple, move to complex solutions
3. **Explain Why** - Explain why the issue occurs and why the fix works
4. **Consider Impact** - Assess potential side effects of fixes
5. **Provide Options** - When multiple solutions exist, present options

${
  verbose
    ? `
## Debugging Process

1. Understand: Analyze error messages and context
2. Collect: Execute locate and describe operations
3. Hypothesize: Apply experience to identify likely causes
4. Verify: Confirm issue through actions
5. Propose: Provide specific fix recommendations
6. Follow-up: Ensure the issue is resolved
`
    : ''
}`;

    return basePrompt;
  }

  /**
   * Build a context-aware prompt
   */
  static buildContextualPrompt(
    context: DebugContext,
    userQuery: string,
    options: PromptOptions = {},
  ): string {
    const language = options.language || 'zh';
    const isZh = language === 'zh';

    let prompt = '';

    // Add user query
    prompt += isZh
      ? `## 用户问题\n${userQuery}\n\n`
      : `## User Question\n${userQuery}\n\n`;

    // Add error context
    if (context.lastError) {
      prompt += isZh
        ? `## 错误信息\n\`\`\`\n${context.lastError.message}\n\`\`\`\n\n`
        : `## Error Information\n\`\`\`\n${context.lastError.message}\n\`\`\`\n\n`;
    }

    // Add failed step
    if (context.failedStep) {
      prompt += isZh
        ? `## 失败步骤\n${context.failedStep}\n\n`
        : `## Failed Step\n${context.failedStep}\n\n`;
    }

    // Add page state
    if (context.pageState) {
      prompt += isZh ? `## 页面状态\n` : `## Page State\n`;
      prompt += `- URL: ${context.pageState.url}\n`;
      prompt += `- Title: ${context.pageState.title}\n\n`;
    }

    // Add console errors
    if (context.consoleErrors?.length) {
      prompt += isZh
        ? `## 控制台错误\n${context.consoleErrors.join('\n')}\n\n`
        : `## Console Errors\n${context.consoleErrors.join('\n')}\n\n`;
    }

    // Add network errors
    if (context.networkErrors?.length) {
      prompt += isZh
        ? `## 网络错误\n${context.networkErrors.join('\n')}\n\n`
        : `## Network Errors\n${context.networkErrors.join('\n')}\n\n`;
    }

    return prompt;
  }

  /**
   * Build a quick question prompt
   */
  static buildQuickQuestionPrompt(
    question: QuickQuestion,
    context: DebugContext,
  ): string {
    const isZh =
      !question.question || /[\u4e00-\u9fa5]/.test(question.question);

    let prompt = isZh ? '## 快速问题\n' : '## Quick Question\n';
    prompt += `${question.question}\n\n`;

    if (question.context) {
      prompt += isZh ? '**上下文**: ' : '**Context**: ';
      prompt += `${question.context}\n\n`;
    }

    return prompt;
  }

  /**
   * Build fix suggestion prompt
   */
  static buildFixSuggestionPrompt(
    context: DebugContext,
    appliedFix: string,
    result: 'success' | 'failure',
  ): string {
    const isZh = true; // Default to Chinese
    let prompt = isZh ? '## 修复结果\n\n' : '## Fix Result\n\n';

    if (result === 'success') {
      prompt += isZh
        ? `修复成功！应用的建议是：\n\`\`\`\n${appliedFix}\n\`\`\`\n\n请记住这个成功的模式，以便在未来类似问题中推荐。`
        : `Fix successful! The applied suggestion was:\n\`\`\`\n${appliedFix}\n\`\`\`\n\nRemember this successful pattern for future similar issues.`;
    } else {
      prompt += isZh
        ? `修复失败。尝试的建议是：\n\`\`\`\n${appliedFix}\n\`\`\`\n\n请分析原因并提供其他解决方案。`
        : `Fix failed. The attempted suggestion was:\n\`\`\`\n${appliedFix}\n\`\`\`\n\nAnalyze why it failed and provide alternative solutions.`;
    }

    return prompt;
  }

  /**
   * Build a follow-up prompt
   */
  static buildFollowUpPrompt(
    conversationHistory: Message[],
    options: PromptOptions = {},
  ): string {
    const isZh = (options.language || 'zh') === 'zh';

    if (conversationHistory.length === 0) {
      return '';
    }

    const lastAssistantMessage = [...conversationHistory]
      .reverse()
      .find((m) => m.role === 'assistant');

    if (!lastAssistantMessage) {
      return '';
    }

    let prompt = isZh ? '## 对话上下文\n\n' : '## Conversation Context\n\n';
    prompt += isZh
      ? '基于之前的对话，请继续帮助用户解决问题。'
      : 'Based on the previous conversation, continue helping the user resolve the issue.';

    return prompt;
  }

  /**
   * Build an analysis prompt
   */
  static buildAnalysisPrompt(context: DebugContext): string {
    let prompt = `## 失败分析\n\n`;

    prompt += `### 错误类型\n`;
    if (context.lastError?.message) {
      const error = context.lastError.message.toLowerCase();

      if (error.includes('not found') || error.includes('找不到')) {
        prompt += `- 类型: 元素未找到\n`;
        prompt += `- 可能原因:\n`;
        prompt += `  1. 选择器不正确\n`;
        prompt += `  2. 元素尚未加载\n`;
        prompt += `  3. 元素在iframe中\n`;
        prompt += `  4. 元素被动态生成\n`;
      } else if (error.includes('timeout') || error.includes('超时')) {
        prompt += `- 类型: 操作超时\n`;
        prompt += `- 可能原因:\n`;
        prompt += `  1. 页面加载缓慢\n`;
        prompt += `  2. 网络延迟\n`;
        prompt += `  3. 等待条件不正确\n`;
      } else if (error.includes('click') && error.includes('intercept')) {
        prompt += `- 类型: 点击被拦截\n`;
        prompt += `- 可能原因:\n`;
        prompt += `  1. 弹窗或遮罩层\n`;
        prompt += `  2. 加载动画\n`;
        prompt += `  3. 浮动元素覆盖\n`;
      } else {
        prompt += `- 类型: 未知错误\n`;
      }
    }

    return prompt;
  }

  /**
   * Get available prompt templates
   */
  static getTemplates(): PromptTemplate[] {
    return [
      {
        name: 'system',
        template: this.buildSystemPrompt(),
        variables: [],
      },
      {
        name: 'contextual',
        template: this.buildContextualPrompt({} as DebugContext, '{query}'),
        variables: ['query'],
      },
      {
        name: 'analysis',
        template: this.buildAnalysisPrompt({} as DebugContext),
        variables: [],
      },
    ];
  }

  /**
   * Get a template by name
   */
  static getTemplate(name: string): PromptTemplate | undefined {
    return this.getTemplates().find((t) => t.name === name);
  }

  /**
   * Format variables into a template
   */
  static formatTemplate(
    template: string,
    variables: Record<string, string>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }
}

// Default quick questions
export const DEFAULT_QUICK_QUESTIONS: QuickQuestion[] = [
  {
    id: 'show-element',
    question: '显示失败的元素',
    action: 'highlight',
  },
  {
    id: 'explain-error',
    question: '解释错误原因',
    action: 'explain',
  },
  {
    id: 'show-page-state',
    question: '显示当前页面状态',
    action: 'screenshot',
  },
  {
    id: 'compare-states',
    question: '对比前后状态',
    action: 'compare',
  },
  {
    id: 'network-requests',
    question: '检查网络请求',
    action: 'network',
  },
];
