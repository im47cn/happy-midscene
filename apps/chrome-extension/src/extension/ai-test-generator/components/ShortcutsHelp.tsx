/**
 * Shortcuts Help Modal Component
 * Displays all available keyboard shortcuts
 */

import { KeyOutlined } from '@ant-design/icons';
import { Divider, Modal, Space, Tag, Typography } from 'antd';
import { useI18n } from '../../../i18n';
import { getAllShortcuts } from '../hooks';

const { Text, Title } = Typography;

interface ShortcutsHelpProps {
  visible: boolean;
  onClose: () => void;
}

export function ShortcutsHelp({ visible, onClose }: ShortcutsHelpProps) {
  const { t } = useI18n();
  const shortcuts = getAllShortcuts();

  // Group shortcuts by category
  const categories = [
    {
      title: t('navigation'),
      shortcuts: shortcuts.filter((s) =>
        ['解析需求', '开始执行', '返回上一视图'].includes(s.description),
      ),
    },
    {
      title: t('executionControl'),
      shortcuts: shortcuts.filter((s) =>
        ['暂停执行', '继续执行', '停止执行', '下一步'].includes(s.description),
      ),
    },
    {
      title: t('operations'),
      shortcuts: shortcuts.filter((s) =>
        ['复制 YAML', '保存/提交', '显示快捷键帮助'].includes(s.description),
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <KeyOutlined />
          <span>{t('shortcuts')}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={400}
    >
      <div className="shortcuts-help-content">
        {categories.map((category, index) => (
          <div key={category.title} className="shortcut-category">
            {index > 0 && <Divider style={{ margin: '12px 0' }} />}
            <Title level={5} style={{ marginBottom: 8, fontSize: 13 }}>
              {category.title}
            </Title>
            <div className="shortcut-list">
              {category.shortcuts.map((shortcut) => (
                <div key={shortcut.key} className="shortcut-item">
                  <Tag className="shortcut-key">{shortcut.key}</Tag>
                  <Text className="shortcut-desc">{shortcut.description}</Text>
                </div>
              ))}
            </div>
          </div>
        ))}

        <Divider style={{ margin: '12px 0' }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('shortcutHelpTip')}
        </Text>
      </div>
    </Modal>
  );
}
