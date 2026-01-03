/**
 * Category Navigation Component
 * Displays category filters for the marketplace
 */

import {
  AppstoreOutlined,
  CreditCardOutlined,
  DatabaseOutlined,
  EditOutlined,
  FormOutlined,
  LockOutlined,
  MenuOutlined,
  PictureOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Badge, Space, Tag, Typography } from 'antd';
import type React from 'react';
import { useI18n } from '../../../../i18n';
import type { CategoryInfo, TemplateCategory } from '../types';
import { CATEGORY_METADATA } from '../types';

const { Text } = Typography;

interface CategoryNavProps {
  categories: CategoryInfo[];
  selectedCategory?: TemplateCategory;
  onCategoryChange: (category: TemplateCategory | undefined) => void;
  showCounts?: boolean;
  direction?: 'horizontal' | 'vertical';
}

/**
 * Category icon mapping
 */
const CategoryIcons: Record<TemplateCategory, React.ReactNode> = {
  authentication: <LockOutlined />,
  form: <FormOutlined />,
  search: <SearchOutlined />,
  shopping: <ShoppingCartOutlined />,
  payment: <CreditCardOutlined />,
  navigation: <MenuOutlined />,
  'data-entry': <EditOutlined />,
  crud: <DatabaseOutlined />,
  social: <TeamOutlined />,
  media: <PictureOutlined />,
  utility: <ToolOutlined />,
};

/**
 * Get icon for a category
 */
function getCategoryIcon(category: TemplateCategory): React.ReactNode {
  return CategoryIcons[category] || <AppstoreOutlined />;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
  showCounts = true,
  direction = 'horizontal',
}) => {
  const { t } = useI18n();

  const handleCategoryClick = (category: TemplateCategory) => {
    if (selectedCategory === category) {
      onCategoryChange(undefined);
    } else {
      onCategoryChange(category);
    }
  };

  if (direction === 'vertical') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          onClick={() => onCategoryChange(undefined)}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            borderRadius: 6,
            background: !selectedCategory ? '#e6f7ff' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AppstoreOutlined />
          <Text strong={!selectedCategory}>{t('all')}</Text>
        </div>
        {categories.map((cat) => (
          <div
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderRadius: 6,
              background: selectedCategory === cat.id ? '#e6f7ff' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Space size={8}>
              {getCategoryIcon(cat.id)}
              <Text strong={selectedCategory === cat.id}>{cat.name}</Text>
            </Space>
            {showCounts && (
              <Badge
                count={cat.count}
                style={{
                  backgroundColor: selectedCategory === cat.id ? '#1890ff' : '#d9d9d9',
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Tag
        color={!selectedCategory ? 'blue' : undefined}
        onClick={() => onCategoryChange(undefined)}
        style={{ cursor: 'pointer', margin: 0 }}
      >
        <Space size={4}>
          <AppstoreOutlined />
          {t('all')}
        </Space>
      </Tag>
      {categories.map((cat) => (
        <Tag
          key={cat.id}
          color={selectedCategory === cat.id ? 'blue' : undefined}
          onClick={() => handleCategoryClick(cat.id)}
          style={{ cursor: 'pointer', margin: 0 }}
        >
          <Space size={4}>
            {getCategoryIcon(cat.id)}
            {cat.name}
            {showCounts && <span style={{ opacity: 0.7 }}>({cat.count})</span>}
          </Space>
        </Tag>
      ))}
    </div>
  );
};

export default CategoryNav;
