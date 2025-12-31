/**
 * AI Test Generator Main Component
 * Entry point for the AI-powered test generation feature
 */

import { useEffect } from 'react';
import { useGeneratorStore } from './store';
import {
  MarkdownInput,
  TestCasePreview,
  ExecutionView,
  CommitView,
  GitLabStatus,
} from './components';
import './styles.less';

export function AITestGenerator() {
  const { currentView, checkGitLabConfig } = useGeneratorStore();

  useEffect(() => {
    // Check GitLab configuration on mount
    checkGitLabConfig();
  }, []);

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
      </div>
      <div className="generator-content">{renderContent()}</div>
    </div>
  );
}

export default AITestGenerator;
