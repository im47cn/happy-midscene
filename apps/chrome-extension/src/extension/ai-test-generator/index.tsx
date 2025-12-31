/**
 * AI Test Generator Main Component
 * Entry point for the AI-powered test generation feature
 */

import { useEffect, useState, useCallback } from 'react';
import { message, Tooltip } from 'antd';
import { KeyOutlined, HistoryOutlined } from '@ant-design/icons';
import { useGeneratorStore } from './store';
import {
  MarkdownInput,
  TestCasePreview,
  ExecutionView,
  CommitView,
  GitLabStatus,
  ShortcutsHelp,
  HistoryView,
  ErrorBoundary,
} from './components';
import { useKeyboardShortcuts } from './hooks';
import './styles.less';

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
  } = useGeneratorStore();

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
        message.success('解析成功');
      }
    }
  }, [currentView, markdownInput, parseInput, setCurrentView]);

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
      message.success('YAML 已复制到剪贴板');
    }
  }, [currentView, generatedYaml]);

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
      default:
        return <MarkdownInput />;
    }
  };

  return (
    <div className="ai-test-generator-container">
      <div className="generator-toolbar">
        <GitLabStatus />
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="执行历史">
            <HistoryOutlined
              className="shortcuts-help-icon"
              onClick={handleOpenHistory}
            />
          </Tooltip>
          <Tooltip title="快捷键帮助 (?)">
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
