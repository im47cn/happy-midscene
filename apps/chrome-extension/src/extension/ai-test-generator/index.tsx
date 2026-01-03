/**
 * AI Test Generator Main Component
 * Entry point for the AI-powered test generation feature
 */

import {
  BarChartOutlined,
  HistoryOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { Tooltip, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  CommitView,
  DeviceSelectorCompact,
  ErrorBoundary,
  ExecutionView,
  GitLabStatus,
  HistoryView,
  MarkdownInput,
  ShortcutsHelp,
  TestCasePreview,
} from './components';
import { Dashboard } from './components/analytics';
import { MaskingSettings } from './components/masking';
import { useKeyboardShortcuts } from './hooks';
import { MarketplaceHome } from './marketplace';
import { useGeneratorStore } from './store';
import './styles.less';
import { useI18n } from '../../i18n';

export function AITestGenerator() {
  const {
    currentView,
    checkGitLabConfig,
    setCurrentView,
    parseInput,
    markdownInput,
    parseResult,
    executionStatus,
    generatedYaml,
    selectedDeviceId,
    setSelectedDeviceId,
  } = useGeneratorStore();

  const { t } = useI18n();
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  useEffect(() => {
    // Check GitLab configuration on mount
    checkGitLabConfig();
  }, []);

  // Keyboard shortcut handlers
  const handleParse = useCallback(() => {
    if (currentView === 'input' && markdownInput.trim()) {
      parseInput();
      const result = useGeneratorStore.getState().parseResult;
      if (result?.cases.length) {
        setCurrentView('preview');
        message.success(t('parseSuccess'));
      }
    }
  }, [currentView, markdownInput, parseInput, setCurrentView, t]);

  const handleRun = useCallback(() => {
    if (currentView === 'preview' && parseResult?.cases.length) {
      setCurrentView('execute');
    }
  }, [currentView, parseResult, setCurrentView]);

  const handleBack = useCallback(() => {
    switch (currentView) {
      case 'preview':
        setCurrentView('input');
        break;
      case 'execute':
        setCurrentView('preview');
        break;
      case 'commit':
        setCurrentView('preview');
        break;
    }
  }, [currentView, setCurrentView]);

  const handleCopyYaml = useCallback(() => {
    if (currentView === 'commit' && generatedYaml) {
      navigator.clipboard.writeText(generatedYaml);
      message.success(t('copyYaml'));
    }
  }, [currentView, generatedYaml, t]);

  const handleHelp = useCallback(() => {
    setShowShortcutsHelp(true);
  }, []);

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    onParse: handleParse,
    onRun: handleRun,
    onBack: handleBack,
    onCopyYaml: handleCopyYaml,
    onHelp: handleHelp,
    enabled: true,
  });

  const handleOpenHistory = useCallback(() => {
    setCurrentView('history');
  }, [setCurrentView]);

  const handleCloseHistory = useCallback(() => {
    setCurrentView('input');
  }, [setCurrentView]);

  const handleOpenAnalytics = useCallback(() => {
    setCurrentView('analytics');
  }, [setCurrentView]);

  const handleCloseAnalytics = useCallback(() => {
    setCurrentView('input');
  }, [setCurrentView]);

  const handleOpenSettings = useCallback(() => {
    setCurrentView('settings');
  }, [setCurrentView]);

  const handleCloseSettings = useCallback(() => {
    setCurrentView('input');
  }, [setCurrentView]);

  const handleOpenMarketplace = useCallback(() => {
    setCurrentView('marketplace');
  }, [setCurrentView]);

  const handleCloseMarketplace = useCallback(() => {
    setCurrentView('input');
  }, [setCurrentView]);

  const handleApplyTemplate = useCallback(
    (yaml: string) => {
      // Apply the template YAML to the input
      useGeneratorStore.getState().setMarkdownInput(
        `# Applied Template\n\n\`\`\`yaml\n${yaml}\n\`\`\`\n`
      );
      setCurrentView('input');
      message.success(t('templateApplied') + '! You can now modify and run it.');
    },
    [setCurrentView, t]
  );

  const renderContent = () => {
    switch (currentView) {
      case 'input':
        return <MarkdownInput />;
      case 'preview':
        return <TestCasePreview />;
      case 'execute':
        return <ExecutionView />;
      case 'commit':
        return <CommitView />;
      case 'history':
        return <HistoryView onBack={handleCloseHistory} />;
      case 'analytics':
        return <Dashboard onBack={handleCloseAnalytics} />;
      case 'settings':
        return (
          <div style={{ padding: '8px 0' }}>
            <MaskingSettings />
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleCloseSettings}
                style={{
                  padding: '6px 16px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  border: '1px solid #d9d9d9',
                  background: '#fff',
                }}
              >
                {t('back')}
              </button>
            </div>
          </div>
        );
      case 'marketplace':
        return (
          <MarketplaceHome
            onBack={handleCloseMarketplace}
            onApplyTemplate={handleApplyTemplate}
          />
        );
      default:
        return <MarkdownInput />;
    }
  };

  return (
    <div className="ai-test-generator-container">
      <div className="generator-toolbar">
        <GitLabStatus />
        <div className="toolbar-right">
          <DeviceSelectorCompact
            value={selectedDeviceId}
            onChange={setSelectedDeviceId}
            disabled={executionStatus === 'running'}
          />
          <Tooltip title={t('executionHistory')}>
            <HistoryOutlined
              className="shortcuts-help-icon"
              onClick={handleOpenHistory}
            />
          </Tooltip>
          <Tooltip title={t('analyticsDashboard')}>
            <BarChartOutlined
              className="shortcuts-help-icon"
              onClick={handleOpenAnalytics}
            />
          </Tooltip>
          <Tooltip title={t('maskingSettings')}>
            <SafetyCertificateOutlined
              className="shortcuts-help-icon"
              onClick={handleOpenSettings}
            />
          </Tooltip>
          <Tooltip title={t('templateMarket')}>
            <ShopOutlined
              className="shortcuts-help-icon"
              onClick={handleOpenMarketplace}
            />
          </Tooltip>
          <Tooltip title={t('shortcutsHelp') + ' (?)'}>
            <KeyOutlined
              className="shortcuts-help-icon"
              onClick={() => setShowShortcutsHelp(true)}
            />
          </Tooltip>
        </div>
      </div>
      <div className="generator-content">{renderContent()}</div>

      <ShortcutsHelp
        visible={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </div>
  );
}

// Wrapped with ErrorBoundary for crash protection
function AITestGeneratorWithErrorBoundary() {
  const handleReset = useCallback(() => {
    // Reset store state on error recovery
    useGeneratorStore.getState().setCurrentView('input');
    useGeneratorStore.getState().setError(null);
  }, []);

  return (
    <ErrorBoundary
      fallbackTitle="AI Test Generator 发生错误"
      onReset={handleReset}
    >
      <AITestGenerator />
    </ErrorBoundary>
  );
}

export default AITestGeneratorWithErrorBoundary;
