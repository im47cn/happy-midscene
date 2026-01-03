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
    completed: '完成',
    failed: '失败',
    addStep: '添加步骤',
    detectedParams: '识别到的参数',
    backToInput: '返回输入',
    backToEdit: '返回修改',
    total: '共',
    cases: '个用例',
    selected: '已选择',
    execute: '执行',
    runAll: '执行全部',

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
    stepHealedSuccess: '步骤已通过 AI 自愈成功执行',
    healingAttempt: '正在尝试 AI 自愈',
    statusReady: '准备就绪',
    statusPaused: '已暂停',
    preparingExecution: '准备执行',
    generatingScript: '脚本生成中',
    currentCase: '当前用例',
    step: '步骤',
    stepExecutionFailed: '步骤执行失败',
    skipThisStep: '跳过此步骤',
    modifyAndRetry: '修改指令后重试',
    modifyInstructionPlaceholder: '修改指令描述...',
    retryHint: '提示：尝试使用更具体的描述，如元素的颜色、位置或文字内容',

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
    loadProjectsFailed: '加载项目列表失败',
    loadBranchesFailed: '加载分支列表失败',
    copiedToClipboard: '已复制到剪贴板',
    fileDownloaded: '文件已下载',
    pleaseSelectProject: '请选择目标项目',
    pleaseSelectOrCreateBranch: '请选择或创建分支',
    filePathMustEndWithYaml: '文件路径必须以 .yaml 或 .yml 结尾',
    scriptCommitSuccess: '脚本提交成功',
    scriptCommitSuccessDesc: '测试脚本已成功提交到 GitLab 仓库',
    viewFile: '查看文件',
    createNewTest: '创建新测试',
    scriptGenerationComplete: '脚本生成完成',
    generatedYamlScript: '生成的 YAML 脚本',
    scriptManuallyModified: '脚本已手动修改',
    gitlabNotConfiguredDesc: '请先配置 GitLab 连接信息后才能提交',
    configureNow: '立即配置',
    targetProject: '目标项目',
    searchAndSelectProject: '搜索并选择项目',
    targetBranch: '目标分支',
    default: '默认',
    newBranchNamePlaceholder: '输入新分支名称，如 feature/test-login',
    filePath: '文件路径',
    filePathPlaceholder: 'tests/ai-generated/test-case.yaml',
    commitMessagePlaceholder: 'feat(test): add automated test case',

    // AI 测试生成器 - GitLab 配置
    gitlabConfig: 'GitLab 配置',
    clearConfig: '清除配置',
    testConnection: '测试连接',
    securityTip: '安全提示',
    gitlabTokenSecurityDesc: '您的 GitLab Token 将加密存储在本地浏览器中，不会上传至任何服务器。',
    gitlabServerUrl: 'GitLab 服务器地址',
    pleaseEnterGitlabUrl: '请输入 GitLab 地址',
    pleaseEnterValidUrl: '请输入有效的 URL',
    privateAccessToken: 'Private Access Token',
    pleaseEnterToken: '请输入 Token',
    tokenPermissionsRequired: '需要 api 和 write_repository 权限。',
    howToCreateToken: '如何创建 Token?',
    connectionSuccess: '连接成功',
    connectionFailed: '连接失败',
    validationFailed: '验证失败',
    saveFailed: '保存失败',
    gitlabConfigured: 'GitLab 已配置',

    // AI 测试生成器 - 自愈对话框
    aiHealingSuccess: 'AI 自愈成功',
    rejectFix: '拒绝修复',
    acceptFix: '采用修复',
    possibleElementMatch: '发现可能的元素匹配',
    aiFoundMatchingElement: 'AI 在页面上找到了一个与原始描述匹配的元素，请确认是否采用此修复。',
    originalStep: '原始步骤',
    healingStrategy: '修复策略',
    attempts: '尝试次数',
    times: '次',
    timeCost: '耗时',
    seconds: '秒',
    confidenceAssessment: '置信度评估',
    high: '高',
    medium: '中',
    low: '低',
    normalMode: '标准模式',
    deepThink: '深度思考',
    positionOffset: '位置偏移',
    sizeChange: '尺寸变化',
    strategyScore: '策略评分',
    elementPosition: '元素位置',

    // AI 测试生成器 - 历史记录
    deleted: '已删除',
    allHistoryCleared: '已清空所有历史',
    loadedToInput: '已加载到输入区',
    rerun: '重新执行',
    confirmDeleteRecord: '确定删除此记录？',
    selectRecordToViewDetails: '选择一条记录查看详情',
    executionStats: '执行统计',
    caseCount: '用例数',
    totalSteps: '总步骤',
    confirmClearAllHistory: '确定清空所有历史记录？',
    noExecutionHistory: '暂无执行历史',
    partialSuccess: '部分成功',

    // AI 测试生成器 - 快捷键
    shortcuts: '快捷键',
    navigation: '导航',
    executionControl: '执行控制',
    operations: '操作',
    shortcutHelpTip: '提示：按 ? 随时显示此帮助',

    // AI 测试生成器 - 设备选择器
    resolution: 'Resolution',
    scale: 'Scale',
    touch: 'Touch',
    yes: 'Yes',
    no: 'No',
    desktop: 'Desktop',
    tablet: 'Tablet',
    selectDevice: 'Select device',
    h5Mode: 'H5 Mode',
    touchEventsEnabled: 'Touch events enabled',

    // AI 测试生成器 - 模板市场
    templateMarketplace: '模板市场',
    browse: '浏览',
    featured: '精选',
    popular: '热门',
    latest: '最新',
    favorites: '收藏',
    loadingTemplates: '加载模板中...',
    searchTemplates: '搜索模板...',
    mostDownloads: '下载最多',
    highestRated: '评分最高',
    newest: '最新发布',
    relevance: '相关性',
    fourPlusStars: '4+ 星',
    threePlusStars: '3+ 星',
    twoPlusStars: '2+ 星',
    platforms: '平台',
    selectPlatforms: '选择平台',
    minimumRating: '最低评分',
    anyRating: '任意评分',
    clearAllFilters: '清除所有筛选',
    filters: '筛选',
    search: '搜索',
    stars: '星',
    all: '全部',
    networkError: '网络错误',
    networkErrorMessage: '无法连接。请检查您的网络连接。',
    notFound: '未找到',
    notFoundMessage: '请求的资源未找到。',
    accessDenied: '访问被拒绝',
    accessDeniedMessage: '您没有权限访问此资源。',
    serverError: '服务器错误',
    serverErrorMessage: '服务器出现问题。请稍后再试。',
    somethingWentWrong: '出错了',
    unexpectedError: '发生意外错误。请重试。',
    tryAgain: '重试',
    noResultsFound: '未找到结果',
    tryAdjustingFilters: '尝试调整搜索或筛选条件。',
    noFavoritesYet: '还没有收藏',
    addTemplatesToFavorites: '将模板添加到收藏以在此处查看。',
    noHistory: '没有历史记录',
    templatesWillAppearHere: '您使用的模板将显示在此处。',
    noTemplates: '没有模板',
    noTemplatesInCategory: '此分类中没有可用的模板。',
    noData: '无数据',
    nothingToShow: '这里没有任何内容。',

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
    completed: 'Completed',
    failed: 'Failed',
    addStep: 'Add Step',
    detectedParams: 'Detected Parameters',
    backToInput: 'Back to Input',
    backToEdit: 'Back to Edit',
    total: 'Total',
    cases: 'cases',
    selected: 'Selected',
    execute: 'Execute',
    runAll: 'Run All',

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
    stepHealedSuccess: 'Step successfully executed with AI healing',
    healingAttempt: 'Attempting AI healing',
    statusReady: 'Ready',
    statusPaused: 'Paused',
    preparingExecution: 'Preparing execution',
    generatingScript: 'Generating Script',
    currentCase: 'Current Case',
    step: 'Step',
    stepExecutionFailed: 'Step Execution Failed',
    skipThisStep: 'Skip This Step',
    modifyAndRetry: 'Modify and Retry',
    modifyInstructionPlaceholder: 'Modify instruction description...',
    retryHint: 'Hint: Try using more specific descriptions, such as element color, position, or text content',

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
    loadProjectsFailed: 'Failed to load project list',
    loadBranchesFailed: 'Failed to load branch list',
    copiedToClipboard: 'Copied to clipboard',
    fileDownloaded: 'File downloaded',
    pleaseSelectProject: 'Please select a target project',
    pleaseSelectOrCreateBranch: 'Please select or create a branch',
    filePathMustEndWithYaml: 'File path must end with .yaml or .yml',
    scriptCommitSuccess: 'Script Commit Success',
    scriptCommitSuccessDesc: 'Test script has been successfully committed to GitLab repository',
    viewFile: 'View File',
    createNewTest: 'Create New Test',
    scriptGenerationComplete: 'Script Generation Complete',
    generatedYamlScript: 'Generated YAML Script',
    scriptManuallyModified: 'Script manually modified',
    gitlabNotConfiguredDesc: 'Please configure GitLab connection information before committing',
    configureNow: 'Configure Now',
    targetProject: 'Target Project',
    searchAndSelectProject: 'Search and select project',
    targetBranch: 'Target Branch',
    default: 'default',
    newBranchNamePlaceholder: 'Enter new branch name, e.g. feature/test-login',
    filePath: 'File Path',
    filePathPlaceholder: 'tests/ai-generated/test-case.yaml',
    commitMessagePlaceholder: 'feat(test): add automated test case',

    // AI 测试生成器 - GitLab 配置
    gitlabConfig: 'GitLab Configuration',
    clearConfig: 'Clear Config',
    testConnection: 'Test Connection',
    securityTip: 'Security Tip',
    gitlabTokenSecurityDesc: 'Your GitLab Token will be encrypted and stored locally in your browser, and will not be uploaded to any server.',
    gitlabServerUrl: 'GitLab Server URL',
    pleaseEnterGitlabUrl: 'Please enter GitLab URL',
    pleaseEnterValidUrl: 'Please enter a valid URL',
    privateAccessToken: 'Private Access Token',
    pleaseEnterToken: 'Please enter Token',
    tokenPermissionsRequired: 'Requires api and write_repository permissions.',
    howToCreateToken: 'How to create Token?',
    connectionSuccess: 'Connection successful',
    connectionFailed: 'Connection failed',
    validationFailed: 'Validation failed',
    saveFailed: 'Save failed',
    gitlabConfigured: 'GitLab Configured',

    // AI 测试生成器 - 自愈对话框
    aiHealingSuccess: 'AI Healing Success',
    rejectFix: 'Reject Fix',
    acceptFix: 'Accept Fix',
    possibleElementMatch: 'Possible Element Match Found',
    aiFoundMatchingElement: 'AI found an element on the page that matches the original description. Please confirm whether to accept this fix.',
    originalStep: 'Original Step',
    healingStrategy: 'Healing Strategy',
    attempts: 'Attempts',
    times: 'times',
    timeCost: 'Time Cost',
    seconds: 'seconds',
    confidenceAssessment: 'Confidence Assessment',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    normalMode: 'Normal Mode',
    deepThink: 'Deep Think',
    positionOffset: 'Position Offset',
    sizeChange: 'Size Change',
    strategyScore: 'Strategy Score',
    elementPosition: 'Element Position',

    // AI 测试生成器 - 历史记录
    deleted: 'Deleted',
    allHistoryCleared: 'All history cleared',
    loadedToInput: 'Loaded to input',
    rerun: 'Rerun',
    confirmDeleteRecord: 'Confirm delete this record?',
    selectRecordToViewDetails: 'Select a record to view details',
    executionStats: 'Execution Stats',
    caseCount: 'Case Count',
    totalSteps: 'Total Steps',
    confirmClearAllHistory: 'Confirm clear all history?',
    noExecutionHistory: 'No execution history',
    partialSuccess: 'Partial Success',

    // AI 测试生成器 - 快捷键
    shortcuts: 'Shortcuts',
    navigation: 'Navigation',
    executionControl: 'Execution Control',
    operations: 'Operations',
    shortcutHelpTip: 'Tip: Press ? to show this help anytime',

    // AI 测试生成器 - 设备选择器
    resolution: 'Resolution',
    scale: 'Scale',
    touch: 'Touch',
    yes: 'Yes',
    no: 'No',
    desktop: 'Desktop',
    tablet: 'Tablet',
    selectDevice: 'Select device',
    h5Mode: 'H5 Mode',
    touchEventsEnabled: 'Touch events enabled',

    // AI 测试生成器 - 模板市场
    templateMarketplace: 'Template Marketplace',
    browse: 'Browse',
    featured: 'Featured',
    popular: 'Popular',
    latest: 'Latest',
    favorites: 'Favorites',
    loadingTemplates: 'Loading templates...',
    searchTemplates: 'Search templates...',
    mostDownloads: 'Most Downloads',
    highestRated: 'Highest Rated',
    newest: 'Newest',
    relevance: 'Relevance',
    fourPlusStars: '4+ Stars',
    threePlusStars: '3+ Stars',
    twoPlusStars: '2+ Stars',
    platforms: 'Platforms',
    selectPlatforms: 'Select platforms',
    minimumRating: 'Minimum Rating',
    anyRating: 'Any rating',
    clearAllFilters: 'Clear all filters',
    filters: 'Filters',
    search: 'Search',
    stars: 'Stars',
    all: 'All',
    networkError: 'Network Error',
    networkErrorMessage: 'Unable to connect. Please check your internet connection.',
    notFound: 'Not Found',
    notFoundMessage: 'The requested resource could not be found.',
    accessDenied: 'Access Denied',
    accessDeniedMessage: 'You do not have permission to access this resource.',
    serverError: 'Server Error',
    serverErrorMessage: 'Something went wrong on our end. Please try again later.',
    somethingWentWrong: 'Something Went Wrong',
    unexpectedError: 'An unexpected error occurred. Please try again.',
    tryAgain: 'Try Again',
    noResultsFound: 'No Results Found',
    tryAdjustingFilters: 'Try adjusting your search or filters.',
    noFavoritesYet: 'No Favorites Yet',
    addTemplatesToFavorites: 'Add templates to your favorites to see them here.',
    noHistory: 'No History',
    templatesWillAppearHere: 'Templates you use will appear here.',
    noTemplates: 'No Templates',
    noTemplatesInCategory: 'No templates available in this category.',
    noData: 'No Data',
    nothingToShow: 'There is nothing to show here.',

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
