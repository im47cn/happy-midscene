/**
 * UserProfile Component
 * Displays user avatar and profile info with dropdown menu
 */

import {
  GithubOutlined,
  LogoutOutlined,
  SettingOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown, Space, Typography, message } from 'antd';
import type { MenuProps } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../../i18n';
import { githubAuth } from '../services/githubAuth';
import type { AuthState, GitHubUser } from '../types';

const { Text } = Typography;

interface UserProfileProps {
  onPublish?: () => void;
  onMyTemplates?: () => void;
  onSettings?: () => void;
  compact?: boolean;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  onPublish,
  onMyTemplates,
  onSettings,
  compact = false,
}) => {
  const { t } = useI18n();
  const [authState, setAuthState] = useState<AuthState>(
    githubAuth.getAuthState(),
  );

  useEffect(() => {
    const unsubscribe = githubAuth.subscribe((state) => {
      setAuthState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    await githubAuth.logout();
    message.success(t('logoutSuccess'));
  }, [t]);

  const handleViewProfile = useCallback(() => {
    if (authState.user?.html_url) {
      window.open(authState.user.html_url, '_blank');
    }
  }, [authState.user]);

  const menuItems: MenuProps['items'] = useMemo(() => {
    const items: MenuProps['items'] = [];

    // View profile on GitHub
    items.push({
      key: 'profile',
      label: t('viewProfile'),
      icon: <GithubOutlined />,
      onClick: handleViewProfile,
    });

    // My templates
    if (onMyTemplates) {
      items.push({
        key: 'myTemplates',
        label: t('myTemplates'),
        icon: <UserOutlined />,
        onClick: onMyTemplates,
      });
    }

    // Publish template
    if (onPublish) {
      items.push({
        key: 'publish',
        label: t('publishTemplate'),
        icon: <UploadOutlined />,
        onClick: onPublish,
      });
    }

    // Divider
    items.push({ type: 'divider' });

    // Settings
    if (onSettings) {
      items.push({
        key: 'settings',
        label: t('settings'),
        icon: <SettingOutlined />,
        onClick: onSettings,
      });
    }

    // Logout
    items.push({
      key: 'logout',
      label: t('logout'),
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    });

    return items;
  }, [
    t,
    handleViewProfile,
    handleLogout,
    onMyTemplates,
    onPublish,
    onSettings,
  ]);

  if (!authState.isAuthenticated || !authState.user) {
    return null;
  }

  const { user } = authState;
  const displayName = user.name || user.login;

  if (compact) {
    return (
      <Dropdown
        menu={{ items: menuItems }}
        trigger={['click']}
        placement="bottomRight"
      >
        <Avatar
          src={user.avatar_url}
          size="small"
          style={{ cursor: 'pointer' }}
          icon={<UserOutlined />}
        />
      </Dropdown>
    );
  }

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Space style={{ cursor: 'pointer' }}>
        <Avatar src={user.avatar_url} size="small" icon={<UserOutlined />} />
        <Text style={{ fontSize: 12 }}>{displayName}</Text>
      </Space>
    </Dropdown>
  );
};

export default UserProfile;
