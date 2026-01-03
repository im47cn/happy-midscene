/**
 * 国际化配置
 * Chrome Extension i18n support
 */

export const translations = {
  zh: {
    // 模式名称
    playground: '测试场',
    recorder: '录制器 (预览)',
    bridge: '桥接模式',
    aiGenerator: 'AI 测试生成器',

    // 菜单项
    menuPlayground: '测试场',
    menuRecorder: '录制器 (预览)',
    menuBridge: '桥接模式',
    menuAIGenerator: 'AI 测试生成器',

    // 通用
    welcome: '欢迎使用 Midscene.js',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    back: '返回',
    close: '关闭',
    copy: '复制',
    download: '下载',
    upload: '上传',
    clear: '清空',
    run: '运行',
    stop: '停止',
    pause: '暂停',
    resume: '继续',
    retry: '重试',

    // 设置
    settings: '设置',
    envConfig: '环境配置',
    modelConfig: '模型配置',

    // 提示信息
    setupReminder: '使用前请先设置环境变量',
    setupAction: '去设置',

    // AI 测试生成器 - 通用
    aiGenTitle: 'AI 测试生成器',
    aiGenError: 'AI Test Generator 发生错误',
    executionHistory: '执行历史',
    analyticsDashboard: '分析仪表板',
    maskingSettings: '脱敏设置',
    templateMarket: '模板市场',
    shortcutsHelp: '快捷键帮助',

    // AI 测试生成器 - 输入界面
    inputTestRequirements: '输入测试需求',
    loadExample: '加载示例',
    uploadFile: '上传文件',
    exampleLoaded: '示例已加载',
    fileLoaded: '已加载文件',
    parseAndPreview: '解析并预览',
    inputPlaceholder: '在此输入或粘贴 Markdown 格式的测试需求...\n\n支持的格式:\n1. 标题作为测试用例名称\n2. 列表项作为测试步骤\n3. 可以包含多个测试用例',

    // AI 测试生成器 - 预览界面
    testCasePreview: '测试用例预览',
    selectAll: '全选',
    deselectAll: '取消全选',
    runSelected: '运行选中',
    addTestCase: '添加测试用例',
    editTestCase: '编辑测试用例',
    deleteTestCase: '删除测试用例',
    confirmDelete: '确认删除',
    deleteTestCaseConfirm: '确定要删除这个测试用例吗?',
    testCaseName: '测试用例名称',
    steps: '步骤',
    noTestCases: '暂无测试用例',
    parseFirst: '请先解析测试需求',

    // AI 测试生成器 - 执行界面
    executionProgress: '执行进度',
    executionStatus: '执行状态',
    currentStep: '当前步骤',
    stopExecution: '停止执行',
    pauseExecution: '暂停执行',
    resumeExecution: '继续执行',
    retryStep: '重试步骤',
    skipStep: '跳过步骤',
    executionComplete: '执行完成',
    executionFailed: '执行失败',
    executionStopped: '执行已停止',
    executionPaused: '执行已暂停',
    viewResults: '查看结果',
    commitToGitLab: '提交到 GitLab',

    // AI 测试生成器 - 提交界面
    commitView: '提交视图',
    generatedYaml: '生成的 YAML',
    editYaml: '编辑 YAML',
    copyYaml: 'YAML 已复制到剪贴板',
    downloadYaml: '下载 YAML',
    selectProject: '选择项目',
    selectBranch: '选择分支',
    createNewBranch: '创建新分支',
    branchName: '分支名称',
    commitPath: '提交路径',
    commitMessage: '提交信息',
    commitToGitLabBtn: '提交到 GitLab',
    committing: '提交中...',
    commitSuccess: '提交成功',
    commitFailed: '提交失败',
    viewInGitLab: '在 GitLab 中查看',
    configureGitLab: '配置 GitLab',
    gitlabNotConfigured: 'GitLab 未配置',

    // AI 测试生成器 - 错误类型
    elementNotFound: '元素未找到',
    timeout: '操作超时',
    actionFailed: '操作失败',
    navigationFailed: '导航失败',
    assertionFailed: '验证失败',
    unknownError: '未知错误',
    errorDetails: '详细信息',
    errorSuggestions: '建议',

    // AI 测试生成器 - 消息提示
    parseSuccess: '解析成功',
    parseFailed: '解析失败',
    executionStarted: '开始执行',
    stepSuccess: '步骤执行成功',
    stepFailed: '步骤执行失败',
    stepSkipped: '步骤已跳过',
    allStepsComplete: '所有步骤已完成',
    yamlCopied: 'YAML 已复制',
    yamlDownloaded: 'YAML 已下载',
    templateApplied: '模板已应用',

    // AI 测试生成器 - 状态
    statusPending: '等待中',
    statusRunning: '运行中',
    statusSuccess: '成功',
    statusFailed: '失败',
    statusSkipped: '已跳过',
    statusStopped: '已停止',
    statusPaused: '已暂停',
  },
  en: {
    // 模式名称
    playground: 'Playground',
    recorder: 'Recorder (Preview)',
    bridge: 'Bridge Mode',
    aiGenerator: 'AI Test Generator',

    // 菜单项
    menuPlayground: 'Playground',
    menuRecorder: 'Recorder (Preview)',
    menuBridge: 'Bridge Mode',
    menuAIGenerator: 'AI Test Generator',

    // 通用
    welcome: 'Welcome to Midscene.js',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    close: 'Close',
    copy: 'Copy',
    download: 'Download',
    upload: 'Upload',
    clear: 'Clear',
    run: 'Run',
    stop: 'Stop',
    pause: 'Pause',
    resume: 'Resume',
    retry: 'Retry',

    // 设置
    settings: 'Settings',
    envConfig: 'Environment Config',
    modelConfig: 'Model Config',

    // 提示信息
    setupReminder: 'Please set up your environment variables before using',
    setupAction: 'Set up',

    // AI 测试生成器 - 通用
    aiGenTitle: 'AI Test Generator',
    aiGenError: 'AI Test Generator Error',
    executionHistory: 'Execution History',
    analyticsDashboard: 'Analytics Dashboard',
    maskingSettings: 'Masking Settings',
    templateMarket: 'Template Market',
    shortcutsHelp: 'Shortcuts Help',

    // AI 测试生成器 - 输入界面
    inputTestRequirements: 'Input Test Requirements',
    loadExample: 'Load Example',
    uploadFile: 'Upload File',
    exampleLoaded: 'Example loaded',
    fileLoaded: 'File loaded',
    parseAndPreview: 'Parse & Preview',
    inputPlaceholder: 'Enter or paste Markdown test requirements here...\n\nSupported format:\n1. Headings as test case names\n2. List items as test steps\n3. Multiple test cases supported',

    // AI 测试生成器 - 预览界面
    testCasePreview: 'Test Case Preview',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    runSelected: 'Run Selected',
    addTestCase: 'Add Test Case',
    editTestCase: 'Edit Test Case',
    deleteTestCase: 'Delete Test Case',
    confirmDelete: 'Confirm Delete',
    deleteTestCaseConfirm: 'Are you sure you want to delete this test case?',
    testCaseName: 'Test Case Name',
    steps: 'Steps',
    noTestCases: 'No test cases',
    parseFirst: 'Please parse test requirements first',

    // AI 测试生成器 - 执行界面
    executionProgress: 'Execution Progress',
    executionStatus: 'Execution Status',
    currentStep: 'Current Step',
    stopExecution: 'Stop Execution',
    pauseExecution: 'Pause Execution',
    resumeExecution: 'Resume Execution',
    retryStep: 'Retry Step',
    skipStep: 'Skip Step',
    executionComplete: 'Execution Complete',
    executionFailed: 'Execution Failed',
    executionStopped: 'Execution Stopped',
    executionPaused: 'Execution Paused',
    viewResults: 'View Results',
    commitToGitLab: 'Commit to GitLab',

    // AI 测试生成器 - 提交界面
    commitView: 'Commit View',
    generatedYaml: 'Generated YAML',
    editYaml: 'Edit YAML',
    copyYaml: 'YAML copied to clipboard',
    downloadYaml: 'Download YAML',
    selectProject: 'Select Project',
    selectBranch: 'Select Branch',
    createNewBranch: 'Create New Branch',
    branchName: 'Branch Name',
    commitPath: 'Commit Path',
    commitMessage: 'Commit Message',
    commitToGitLabBtn: 'Commit to GitLab',
    committing: 'Committing...',
    commitSuccess: 'Commit successful',
    commitFailed: 'Commit failed',
    viewInGitLab: 'View in GitLab',
    configureGitLab: 'Configure GitLab',
    gitlabNotConfigured: 'GitLab not configured',

    // AI 测试生成器 - 错误类型
    elementNotFound: 'Element not found',
    timeout: 'Timeout',
    actionFailed: 'Action failed',
    navigationFailed: 'Navigation failed',
    assertionFailed: 'Assertion failed',
    unknownError: 'Unknown error',
    errorDetails: 'Details',
    errorSuggestions: 'Suggestions',

    // AI 测试生成器 - 消息提示
    parseSuccess: 'Parse successful',
    parseFailed: 'Parse failed',
    executionStarted: 'Execution started',
    stepSuccess: 'Step successful',
    stepFailed: 'Step failed',
    stepSkipped: 'Step skipped',
    allStepsComplete: 'All steps complete',
    yamlCopied: 'YAML copied',
    yamlDownloaded: 'YAML downloaded',
    templateApplied: 'Template applied',

    // AI 测试生成器 - 状态
    statusPending: 'Pending',
    statusRunning: 'Running',
    statusSuccess: 'Success',
    statusFailed: 'Failed',
    statusSkipped: 'Skipped',
    statusStopped: 'Stopped',
    statusPaused: 'Paused',
  },
} as const;

export type TranslationKey = keyof typeof translations.zh;
export type Language = keyof typeof translations;

/**
 * 获取用户首选语言
 * 优先级: localStorage > 浏览器语言 > 时区判断
 */
export function getPreferredLanguage(): Language {
  // 1. 检查 localStorage
  const stored = localStorage.getItem('midscene-language');
  if (stored === 'zh' || stored === 'en') {
    return stored;
  }

  // 2. 检查浏览器语言
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) {
    return 'zh';
  }

  // 3. 检查时区（中国时区默认中文）
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone === 'Asia/Shanghai' || timeZone === 'Asia/Chongqing' || timeZone === 'Asia/Hong_Kong') {
      return 'zh';
    }
  } catch (e) {
    console.warn('Failed to detect timezone:', e);
  }

  // 4. 默认英文
  return 'en';
}

/**
 * 设置语言偏好
 */
export function setLanguagePreference(lang: Language) {
  localStorage.setItem('midscene-language', lang);
}

/**
 * 翻译函数
 */
export function createTranslator(lang: Language = getPreferredLanguage()) {
  return (key: TranslationKey): string => {
    return translations[lang][key] || translations.en[key] || key;
  };
}

/**
 * React Hook for i18n
 */
import { useEffect, useState } from 'react';

export function useI18n() {
  const [lang, setLang] = useState<Language>(getPreferredLanguage());

  useEffect(() => {
    // 监听语言变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'midscene-language' && (e.newValue === 'zh' || e.newValue === 'en')) {
        setLang(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const t = (key: TranslationKey): string => {
    return translations[lang][key] || translations.en[key] || key;
  };

  const switchLanguage = (newLang: Language) => {
    setLanguagePreference(newLang);
    setLang(newLang);
  };

  return { t, lang, switchLanguage };
}
