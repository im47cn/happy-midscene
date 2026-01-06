/**
 * i18n (Internationalization) utility
 * Provides multi-language support for the Chrome extension
 */

export type SupportedLocale =
  | 'en'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja'
  | 'ko'
  | 'es'
  | 'fr'
  | 'de';

export interface TranslationResources {
  [key: string]: string | TranslationResources;
}

/**
 * Translation resources for all supported languages
 */
const translations: Record<SupportedLocale, TranslationResources> = {
  en: {
    // Common
    common: {
      loading: 'Loading...',
      success: 'Success',
      failed: 'Failed',
      error: 'Error',
      warning: 'Warning',
      info: 'Info',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      retry: 'Retry',
    },

    // Execution Engine
    execution: {
      status: {
        idle: 'Idle',
        running: 'Running',
        paused: 'Paused',
        completed: 'Completed',
        failed: 'Failed',
      },
      stepStatus: {
        pending: 'Pending',
        running: 'Running',
        success: 'Success',
        failed: 'Failed',
        skipped: 'Skipped',
      },
      error: {
        elementNotFound: 'Element not found',
        timeout: 'Operation timeout',
        actionFailed: 'Action failed',
        navigationFailed: 'Navigation failed',
        assertionFailed: 'Assertion failed',
        unknown: 'Unknown error',
      },
      suggestion: {
        elementNotFound:
          'Try: 1. Use more specific description 2. Check if element is visible 3. Wait for page to fully load',
        timeout:
          'Check: 1. Network connection 2. Page loading 3. Element appearance time',
        actionFailed:
          'Check: 1. Element is clickable 2. Not blocked by other elements 3. Page fully loaded',
      },
    },

    // AI Test Generator
    aiTestGenerator: {
      title: 'AI Test Generator',
      inputPlaceholder: 'Enter test requirements in Markdown format...',
      parseButton: 'Parse',
      generateButton: 'Generate Script',
      executeButton: 'Execute',
      pauseButton: 'Pause',
      resumeButton: 'Resume',
      stopButton: 'Stop',
      retryButton: 'Retry Step',
      clearButton: 'Clear',
      importButton: 'Import File',
      exampleButton: 'Load Example',

      // Status messages
      parsing: 'Parsing requirements...',
      generating: 'Generating test script...',
      executing: 'Executing tests...',
      completed: 'All tests completed',
      failed: 'Tests failed',

      // Steps
      step: 'Step',
      steps: 'Steps',
      addStep: 'Add Step',
      editStep: 'Edit Step',
      deleteStep: 'Delete Step',

      // Results
      results: 'Results',
      viewResults: 'View Results',
      exportResults: 'Export Results',
      screenshot: 'Screenshot',
      errorLog: 'Error Log',
    },

    // GitLab Integration
    gitlab: {
      title: 'GitLab Integration',
      configure: 'Configure GitLab',
      tokenLabel: 'GitLab Personal Access Token',
      tokenPlaceholder: 'glpat-xxxxxxxxxxxx',
      urlLabel: 'GitLab URL',
      urlPlaceholder: 'https://gitlab.com',
      testConnection: 'Test Connection',
      connectionSuccess: 'Connection successful',
      connectionFailed: 'Connection failed',
      projectLabel: 'Project',
      branchLabel: 'Branch',
      commitMessage: 'Commit message',
      commitButton: 'Commit to GitLab',
      pushButton: 'Push',
    },

    // Device Emulation
    device: {
      title: 'Device Emulation',
      selectDevice: 'Select Device',
      desktop: 'Desktop',
      mobile: 'Mobile',
      tablet: 'Tablet',
      custom: 'Custom',
      width: 'Width',
      height: 'Height',
      scale: 'Scale Factor',
      userAgent: 'User Agent',
    },

    // Self-Healing
    healing: {
      title: 'Self-Healing',
      enabled: 'Enable Self-Healing',
      attempt: 'Attempting to heal...',
      foundAlternative: 'Found alternative element',
      confirmTitle: 'Confirm Healing',
      confirmMessage: 'Found an alternative element. Use it?',
      useButton: 'Use Alternative',
      ignoreButton: 'Ignore',
      strategy: {
        aiRelocate: 'AI Relocate',
        similarElement: 'Similar Element',
        nearbyElement: 'Nearby Element',
      },
      // Statistics
      statistics: 'Statistics',
      noData: 'No healing data available',
      totalAttempts: 'Total Attempts',
      successRate: 'Success Rate',
      avgConfidence: 'Avg Confidence',
      avgTimeCost: 'Avg Time Cost',
      strategyBreakdown: 'Strategy Breakdown',
      outcomeBreakdown: 'Outcome Breakdown',
      unstableElements: 'Unstable Elements',
      rank: 'Rank',
      element: 'Element',
      healingCount: 'Healing Count',
      times: 'times',
      normalMode: 'Normal Mode',
      deepThink: 'DeepThink',
      success: 'Success',
      failure: 'Failure',
    },

    // Data Masking
    masking: {
      title: 'Data Masking',
      enabled: 'Enable Data Masking',
      screenshotMasking: 'Screenshot Masking',
      logMasking: 'Log Masking',
      yamlMasking: 'YAML Masking',
      level: {
        off: 'Off',
        standard: 'Standard',
        strict: 'Strict',
      },
      detectedSensitive: 'Detected sensitive data',
      maskedPlaceholder: '[MASKED]',
    },

    // Anomaly Detection
    anomaly: {
      title: 'Anomaly Detection',
      enabled: 'Enable Anomaly Detection',
      status: {
        normal: 'Normal',
        warning: 'Warning',
        critical: 'Critical',
      },
      metrics: {
        duration: 'Execution Duration',
        memory: 'Memory Usage',
        network: 'Network Requests',
      },
      alert: {
        highDuration: 'Execution time exceeded threshold',
        highMemory: 'Memory usage exceeded threshold',
        networkError: 'Network error rate exceeded threshold',
      },
    },
  },

  'zh-CN': {
    // 通用
    common: {
      loading: '加载中...',
      success: '成功',
      failed: '失败',
      error: '错误',
      warning: '警告',
      info: '信息',
      cancel: '取消',
      confirm: '确认',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      close: '关闭',
      back: '返回',
      next: '下一步',
      retry: '重试',
    },

    // 执行引擎
    execution: {
      status: {
        idle: '空闲',
        running: '运行中',
        paused: '已暂停',
        completed: '已完成',
        failed: '失败',
      },
      stepStatus: {
        pending: '待执行',
        running: '执行中',
        success: '成功',
        failed: '失败',
        skipped: '已跳过',
      },
      error: {
        elementNotFound: '未找到元素',
        timeout: '操作超时',
        actionFailed: '操作失败',
        navigationFailed: '导航失败',
        assertionFailed: '断言失败',
        unknown: '未知错误',
      },
      suggestion: {
        elementNotFound:
          '请尝试：1. 使用更具体的描述 2. 检查元素是否可见 3. 等待页面完全加载',
        timeout:
          '请检查：1. 网络连接是否正常 2. 页面是否正在加载 3. 目标元素是否需要更长时间才能出现',
        actionFailed:
          '请检查：1. 元素是否可点击 2. 是否被其他元素遮挡 3. 页面是否完全加载',
      },
    },

    // AI 测试生成器
    aiTestGenerator: {
      title: 'AI 测试生成器',
      inputPlaceholder: '输入 Markdown 格式的测试需求...',
      parseButton: '解析',
      generateButton: '生成脚本',
      executeButton: '执行',
      pauseButton: '暂停',
      resumeButton: '继续',
      stopButton: '停止',
      retryButton: '重试',
      clearButton: '清空',
      importButton: '导入文件',
      exampleButton: '加载示例',

      // 状态消息
      parsing: '正在解析需求...',
      generating: '正在生成测试脚本...',
      executing: '正在执行测试...',
      completed: '所有测试已完成',
      failed: '测试失败',

      // 步骤
      step: '步骤',
      steps: '步骤',
      addStep: '添加步骤',
      editStep: '编辑步骤',
      deleteStep: '删除步骤',

      // 结果
      results: '结果',
      viewResults: '查看结果',
      exportResults: '导出结果',
      screenshot: '截图',
      errorLog: '错误日志',
    },

    // GitLab 集成
    gitlab: {
      title: 'GitLab 集成',
      configure: '配置 GitLab',
      tokenLabel: 'GitLab 个人访问令牌',
      tokenPlaceholder: 'glpat-xxxxxxxxxxxx',
      urlLabel: 'GitLab URL',
      urlPlaceholder: 'https://gitlab.com',
      testConnection: '测试连接',
      connectionSuccess: '连接成功',
      connectionFailed: '连接失败',
      projectLabel: '项目',
      branchLabel: '分支',
      commitMessage: '提交信息',
      commitButton: '提交到 GitLab',
      pushButton: '推送',
    },

    // 设备模拟
    device: {
      title: '设备模拟',
      selectDevice: '选择设备',
      desktop: '桌面端',
      mobile: '移动端',
      tablet: '平板',
      custom: '自定义',
      width: '宽度',
      height: '高度',
      scale: '缩放比例',
      userAgent: '用户代理',
    },

    // 自愈
    healing: {
      title: '自愈',
      enabled: '启用自愈',
      attempt: '正在尝试自愈...',
      foundAlternative: '找到备用元素',
      confirmTitle: '确认自愈',
      confirmMessage: '找到备用元素，是否使用？',
      useButton: '使用备用元素',
      ignoreButton: '忽略',
      strategy: {
        aiRelocate: 'AI 重定位',
        similarElement: '相似元素',
        nearbyElement: '附近元素',
      },
      // 统计
      statistics: '统计',
      noData: '暂无自愈数据',
      totalAttempts: '总尝试次数',
      successRate: '成功率',
      avgConfidence: '平均置信度',
      avgTimeCost: '平均耗时',
      strategyBreakdown: '策略分布',
      outcomeBreakdown: '结果分布',
      unstableElements: '不稳定元素',
      rank: '排名',
      element: '元素',
      healingCount: '自愈次数',
      times: '次',
      normalMode: '标准模式',
      deepThink: '深度思考',
      success: '成功',
      failure: '失败',
    },

    // 数据脱敏
    masking: {
      title: '数据脱敏',
      enabled: '启用数据脱敏',
      screenshotMasking: '截图脱敏',
      logMasking: '日志脱敏',
      yamlMasking: 'YAML 脱敏',
      level: {
        off: '关闭',
        standard: '标准',
        strict: '严格',
      },
      detectedSensitive: '检测到敏感数据',
      maskedPlaceholder: '[已脱敏]',
    },

    // 异常检测
    anomaly: {
      title: '异常检测',
      enabled: '启用异常检测',
      status: {
        normal: '正常',
        warning: '警告',
        critical: '严重',
      },
      metrics: {
        duration: '执行时长',
        memory: '内存使用',
        network: '网络请求',
      },
      alert: {
        highDuration: '执行时间超过阈值',
        highMemory: '内存使用超过阈值',
        networkError: '网络错误率超过阈值',
      },
    },
  },

  'zh-TW': {
    common: {
      loading: '載入中...',
      success: '成功',
      failed: '失敗',
      error: '錯誤',
      warning: '警告',
      info: '資訊',
      cancel: '取消',
      confirm: '確認',
      save: '儲存',
      delete: '刪除',
      edit: '編輯',
      close: '關閉',
      back: '返回',
      next: '下一步',
      retry: '重試',
    },
    execution: {
      status: {
        idle: '閒置',
        running: '執行中',
        paused: '已暫停',
        completed: '已完成',
        failed: '失敗',
      },
      stepStatus: {
        pending: '待執行',
        running: '執行中',
        success: '成功',
        failed: '失敗',
        skipped: '已跳過',
      },
      error: {
        elementNotFound: '未找到元素',
        timeout: '操作超時',
        actionFailed: '操作失敗',
        navigationFailed: '導航失敗',
        assertionFailed: '斷言失敗',
        unknown: '未知錯誤',
      },
      suggestion: {
        elementNotFound:
          '請嘗試：1. 使用更具體的描述 2. 檢查元素是否可見 3. 等待頁面完全加載',
        timeout:
          '請檢查：1. 網絡連接是否正常 2. 頁面是否正在加載 3. 目標元素是否需要更長時間才能出現',
        actionFailed:
          '請檢查：1. 元素是否可點擊 2. 是否被其他元素遮擋 3. 頁面是否完全加載',
      },
    },
    aiTestGenerator: {
      title: 'AI 測試生成器',
      inputPlaceholder: '輸入 Markdown 格式的測試需求...',
      parseButton: '解析',
      generateButton: '生成腳本',
      executeButton: '執行',
      pauseButton: '暫停',
      resumeButton: '繼續',
      stopButton: '停止',
      retryButton: '重試',
      clearButton: '清空',
      importButton: '導入文件',
      exampleButton: '加載示例',
      parsing: '正在解析需求...',
      generating: '正在生成測試腳本...',
      executing: '正在執行測試...',
      completed: '所有測試已完成',
      failed: '測試失敗',
      step: '步驟',
      steps: '步驟',
      results: '結果',
      viewResults: '查看結果',
      exportResults: '導出結果',
      screenshot: '截圖',
      errorLog: '錯誤日誌',
    },
  },

  ja: {
    common: {
      loading: '読み込み中...',
      success: '成功',
      failed: '失敗',
      error: 'エラー',
      warning: '警告',
      info: '情報',
      cancel: 'キャンセル',
      confirm: '確認',
      save: '保存',
      delete: '削除',
      edit: '編集',
      close: '閉じる',
      back: '戻る',
      next: '次へ',
      retry: '再試行',
    },
    aiTestGenerator: {
      title: 'AIテスト生成',
      inputPlaceholder: 'Markdown形式でテスト要件を入力...',
      parseButton: '解析',
      generateButton: 'スクリプト生成',
      executeButton: '実行',
      pauseButton: '一時停止',
      resumeButton: '再開',
      stopButton: '停止',
      retryButton: '再試行',
      step: 'ステップ',
      steps: 'ステップ',
      results: '結果',
      screenshot: 'スクリーンショット',
      errorLog: 'エラーログ',
    },
  },

  ko: {
    common: {
      loading: '로딩 중...',
      success: '성공',
      failed: '실패',
      error: '오류',
      warning: '경고',
      info: '정보',
      cancel: '취소',
      confirm: '확인',
      save: '저장',
      delete: '삭제',
      edit: '편집',
      close: '닫기',
      back: '뒤로',
      next: '다음',
      retry: '재시도',
    },
    aiTestGenerator: {
      title: 'AI 테스트 생성기',
      inputPlaceholder: 'Markdown 형식으로 테스트 요구사항을 입력하세요...',
      parseButton: '파싱',
      generateButton: '스크립트 생성',
      executeButton: '실행',
      pauseButton: '일시정지',
      resumeButton: '재개',
      stopButton: '중지',
      retryButton: '재시도',
      step: '단계',
      steps: '단계',
      results: '결과',
      screenshot: '스크린샷',
      errorLog: '오류 로그',
    },
  },

  es: {
    common: {
      loading: 'Cargando...',
      success: 'Éxito',
      failed: 'Falló',
      error: 'Error',
      warning: 'Advertencia',
      info: 'Información',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      close: 'Cerrar',
      back: 'Atrás',
      next: 'Siguiente',
      retry: 'Reintentar',
    },
    aiTestGenerator: {
      title: 'Generador de Pruebas AI',
      inputPlaceholder: 'Ingrese requisitos de prueba en formato Markdown...',
      parseButton: 'Analizar',
      generateButton: 'Generar Script',
      executeButton: 'Ejecutar',
      pauseButton: 'Pausar',
      resumeButton: 'Reanudar',
      stopButton: 'Detener',
      retryButton: 'Reintentar',
      step: 'Paso',
      steps: 'Pasos',
      results: 'Resultados',
      screenshot: 'Captura de pantalla',
      errorLog: 'Registro de errores',
    },
  },

  fr: {
    common: {
      loading: 'Chargement...',
      success: 'Succès',
      failed: 'Échec',
      error: 'Erreur',
      warning: 'Avertissement',
      info: 'Information',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      save: 'Enregistrer',
      delete: 'Supprimer',
      edit: 'Modifier',
      close: 'Fermer',
      back: 'Retour',
      next: 'Suivant',
      retry: 'Réessayer',
    },
    aiTestGenerator: {
      title: 'Générateur de Tests AI',
      inputPlaceholder: 'Entrez les exigences de test au format Markdown...',
      parseButton: 'Analyser',
      generateButton: 'Générer le Script',
      executeButton: 'Exécuter',
      pauseButton: 'Pause',
      resumeButton: 'Reprendre',
      stopButton: 'Arrêter',
      retryButton: 'Réessayer',
      step: 'Étape',
      steps: 'Étapes',
      results: 'Résultats',
      screenshot: "Capture d'écran",
      errorLog: 'Journal des erreurs',
    },
  },

  de: {
    common: {
      loading: 'Laden...',
      success: 'Erfolg',
      failed: 'Fehlgeschlagen',
      error: 'Fehler',
      warning: 'Warnung',
      info: 'Information',
      cancel: 'Abbrechen',
      confirm: 'Bestätigen',
      save: 'Speichern',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      close: 'Schließen',
      back: 'Zurück',
      next: 'Weiter',
      retry: 'Wiederholen',
    },
    aiTestGenerator: {
      title: 'KI-Test-Generator',
      inputPlaceholder: 'Testanforderungen im Markdown-Format eingeben...',
      parseButton: 'Analysieren',
      generateButton: 'Skript generieren',
      executeButton: 'Ausführen',
      pauseButton: 'Pausieren',
      resumeButton: 'Fortsetzen',
      stopButton: 'Stoppen',
      retryButton: 'Wiederholen',
      step: 'Schritt',
      steps: 'Schritte',
      results: 'Ergebnisse',
      screenshot: 'Screenshot',
      errorLog: 'Fehlerprotokoll',
    },
  },
};

/**
 * Current locale
 */
let currentLocale: SupportedLocale = 'en';

/**
 * Get the user's preferred locale from browser settings
 */
export function detectBrowserLocale(): SupportedLocale {
  const browserLang = navigator.language || 'en';

  // Map browser language codes to our supported locales
  const localeMap: Record<string, SupportedLocale> = {
    en: 'en',
    'en-US': 'en',
    'en-GB': 'en',
    zh: 'zh-CN',
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    'zh-HK': 'zh-TW',
    ja: 'ja',
    'ja-JP': 'ja',
    ko: 'ko',
    'ko-KR': 'ko',
    es: 'es',
    'es-ES': 'es',
    'es-MX': 'es',
    fr: 'fr',
    'fr-FR': 'fr',
    de: 'de',
    'de-DE': 'de',
  };

  return localeMap[browserLang] || localeMap[browserLang.split('-')[0]] || 'en';
}

/**
 * Set the current locale
 */
export function setLocale(locale: SupportedLocale): void {
  currentLocale = locale;

  // Persist to chrome.storage if available
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ midscene_locale: locale });
  }
}

/**
 * Get the current locale
 */
export function getLocale(): SupportedLocale {
  return currentLocale;
}

/**
 * Initialize locale from browser settings or saved preference
 */
export async function initLocale(): Promise<void> {
  // Try to load saved locale first
  if (typeof chrome !== 'undefined' && chrome.storage) {
    try {
      const result = await chrome.storage.local.get('midscene_locale');
      if (result.midscene_locale && translations[result.midscene_locale]) {
        currentLocale = result.midscene_locale;
        return;
      }
    } catch {
      // Fall through to browser detection
    }
  }

  // Detect from browser
  currentLocale = detectBrowserLocale();
}

/**
 * Get a translation value by key path (e.g., 'common.loading')
 */
export function t(key: string, locale?: SupportedLocale): string {
  const targetLocale = locale || currentLocale;
  const resources = translations[targetLocale];

  if (!resources) {
    console.warn(`Locale not found: ${targetLocale}`);
    return key;
  }

  // Navigate the key path (e.g., 'common.loading' -> resources.common.loading)
  const keys = key.split('.');
  let value: any = resources;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Key not found, try English as fallback
      if (targetLocale !== 'en') {
        return t(key, 'en');
      }
      return key;
    }
  }

  return typeof value === 'string' ? value : key;
}

/**
 * Format a translation with parameters
 * @param key - Translation key
 * @param params - Parameters to interpolate
 * @returns Formatted string
 *
 * @example
 * t('greeting', { name: 'John' }) // "Hello, John!" if translation is "Hello, {name}!"
 */
export function tp(
  key: string,
  params: Record<string, string | number>,
  locale?: SupportedLocale,
): string {
  let translation = t(key, locale);

  // Replace {param} placeholders
  for (const [param, value] of Object.entries(params)) {
    translation = translation.replace(
      new RegExp(`\\{${param}\\}`, 'g'),
      String(value),
    );
  }

  return translation;
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): SupportedLocale[] {
  return Object.keys(translations) as SupportedLocale[];
}

/**
 * Get locale display name
 */
export function getLocaleName(
  locale: SupportedLocale,
  displayLocale?: SupportedLocale,
): string {
  const names: Record<SupportedLocale, Record<SupportedLocale, string>> = {
    en: {
      en: 'English',
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
      ja: '日本語',
      ko: '한국어',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
    },
    'zh-CN': {
      en: 'English',
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
      ja: '日本語',
      ko: '한국어',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
    },
    'zh-TW': {
      en: 'English',
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
      ja: '日本語',
      ko: '한국어',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
    },
    ja: {
      en: 'English',
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
      ja: '日本語',
      ko: '한국어',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
    },
    ko: {
      en: 'English',
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
      ja: '日本語',
      ko: '한국어',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
    },
    es: {
      en: 'English',
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
      ja: '日本語',
      ko: '한국어',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
    },
    fr: {
      en: 'English',
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
      ja: '日本語',
      ko: '한국어',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
    },
    de: {
      en: 'English',
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
      ja: '日本語',
      ko: '한국어',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
    },
  };

  return names[displayLocale || currentLocale]?.[locale] || locale;
}

// Re-export types
export type { TranslationResources };
