/**
 * AI Test Generator Main Component
 * Entry point for the AI-powered test generation feature
 */

import { useEffect, useState, useCallback } from 'react';
import { message, Tooltip } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { useGeneratorStore } from './store';
import {
  MarkdownInput,
  TestCasePreview,
  ExecutionView,
  CommitView,
  GitLabStatus,
  ShortcutsHelp,
} from './components';
import { useKeyboardShortcuts, getShortcutText } from './hooks';
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
      default:
        return <MarkdownInput />;
    }
  };

  return (
    <div className="ai-test-generator-container">
      <div className="generator-toolbar">
        <GitLabStatus />
        <Tooltip title="快捷键帮助 (?)">
          <KeyOutlined
            className="shortcuts-help-icon"
            onClick={() => setShowShortcutsHelp(true)}
          />
        </Tooltip>
      </div>
      <div className="generator-content">{renderContent()}</div>

      <ShortcutsHelp
        visible={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </div>
  );
}

export default AITestGenerator;
