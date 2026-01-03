/**
 * YAML Preview Component
 * Displays YAML content with syntax highlighting and copy functionality
 */

import {
  CheckOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { Button, message, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';

const { Text } = Typography;

interface YamlPreviewProps {
  yaml: string;
  title?: string;
  maxHeight?: number;
  showLineNumbers?: boolean;
  highlightParameters?: boolean;
}

/**
 * Simple YAML syntax highlighting
 */
function highlightYaml(yaml: string, highlightParams: boolean): React.ReactNode {
  const lines = yaml.split('\n');

  return lines.map((line, index) => {
    let highlighted = line;

    // Highlight keys (words before colon)
    highlighted = highlighted.replace(
      /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*):/,
      '$1<span class="yaml-key">$2</span>:'
    );

    // Highlight strings
    highlighted = highlighted.replace(
      /"([^"]*)"$/,
      '"<span class="yaml-string">$1</span>"'
    );
    highlighted = highlighted.replace(
      /'([^']*)'$/,
      "'<span class=\"yaml-string\">$1</span>'"
    );

    // Highlight parameters ${...}
    if (highlightParams) {
      highlighted = highlighted.replace(
        /\$\{([^}]+)\}/g,
        '<span class="yaml-param">${$1}</span>'
      );
    }

    // Highlight comments
    highlighted = highlighted.replace(
      /#(.*)$/,
      '<span class="yaml-comment">#$1</span>'
    );

    // Highlight boolean and null
    highlighted = highlighted.replace(
      /:\s*(true|false|null)(\s|$)/gi,
      ': <span class="yaml-boolean">$1</span>$2'
    );

    // Highlight numbers
    highlighted = highlighted.replace(
      /:\s*(\d+)(\s|$)/,
      ': <span class="yaml-number">$1</span>$2'
    );

    return (
      <span
        key={index}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  });
}

export const YamlPreview: React.FC<YamlPreviewProps> = ({
  yaml,
  title,
  maxHeight = 400,
  showLineNumbers = true,
  highlightParameters = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      message.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('Failed to copy');
    }
  }, [yaml]);

  const lines = useMemo(() => yaml.split('\n'), [yaml]);
  const lineNumberWidth = useMemo(() => String(lines.length).length * 10 + 16, [lines.length]);

  return (
    <div className="yaml-preview">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: '#1e1e1e',
          borderRadius: '8px 8px 0 0',
          borderBottom: '1px solid #333',
        }}
      >
        <Text style={{ color: '#888', fontSize: 12 }}>
          {title || 'YAML'}
        </Text>
        <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
          <Button
            type="text"
            size="small"
            icon={copied ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
            onClick={handleCopy}
            style={{ color: '#888' }}
          />
        </Tooltip>
      </div>

      {/* Content */}
      <div
        style={{
          background: '#1e1e1e',
          borderRadius: '0 0 8px 8px',
          overflow: 'auto',
          maxHeight,
        }}
      >
        <pre
          style={{
            margin: 0,
            padding: '12px 16px',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 13,
            lineHeight: 1.6,
            color: '#d4d4d4',
            display: 'flex',
          }}
        >
          {showLineNumbers && (
            <div
              style={{
                width: lineNumberWidth,
                textAlign: 'right',
                paddingRight: 16,
                marginRight: 16,
                borderRight: '1px solid #333',
                color: '#666',
                userSelect: 'none',
              }}
            >
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}
          <code style={{ flex: 1 }}>
            {lines.map((line, i) => (
              <div key={i}>{highlightYaml(line, highlightParameters)}</div>
            ))}
          </code>
        </pre>
      </div>

      {/* Inline styles for syntax highlighting */}
      <style>{`
        .yaml-preview .yaml-key { color: #9cdcfe; }
        .yaml-preview .yaml-string { color: #ce9178; }
        .yaml-preview .yaml-param { color: #4ec9b0; font-weight: bold; }
        .yaml-preview .yaml-comment { color: #6a9955; }
        .yaml-preview .yaml-boolean { color: #569cd6; }
        .yaml-preview .yaml-number { color: #b5cea8; }
      `}</style>
    </div>
  );
};

export default YamlPreview;
