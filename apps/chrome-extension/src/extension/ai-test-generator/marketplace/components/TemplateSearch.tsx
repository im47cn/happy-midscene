/**
 * Template Search Component
 * Search and filter templates in the marketplace
 */

import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Col, Dropdown, Input, Row, Select, Space, Tag } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { useI18n } from '../../../../i18n';
import type {
  LicenseType,
  PlatformType,
  SearchQuery,
  TemplateCategory,
} from '../types';

const { Option } = Select;

interface TemplateSearchProps {
  onSearch: (query: SearchQuery) => void;
  loading?: boolean;
}

export const TemplateSearch: React.FC<TemplateSearchProps> = ({
  onSearch,
  loading = false,
}) => {
  const { t } = useI18n();
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<string>('downloads');
  const [platforms, setPlatforms] = useState<PlatformType[]>([]);
  const [minRating, setMinRating] = useState<number | undefined>();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const SORT_OPTIONS = [
    { value: 'downloads', label: t('mostDownloads') },
    { value: 'rating', label: t('highestRated') },
    { value: 'publishedAt', label: t('newest') },
    { value: 'relevance', label: t('relevance') },
  ];

  const PLATFORM_OPTIONS: { value: PlatformType; label: string }[] = [
    { value: 'web', label: 'Web' },
    { value: 'android', label: 'Android' },
    { value: 'ios', label: 'iOS' },
  ];

  const RATING_OPTIONS = [
    { value: 4, label: t('fourPlusStars') },
    { value: 3, label: t('threePlusStars') },
    { value: 2, label: t('twoPlusStars') },
  ];

  const handleSearch = useCallback(() => {
    const query: SearchQuery = {
      keyword: keyword.trim() || undefined,
      sortBy: sortBy as SearchQuery['sortBy'],
      platforms: platforms.length > 0 ? platforms : undefined,
      rating: minRating,
    };
    onSearch(query);
  }, [keyword, sortBy, platforms, minRating, onSearch]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearFilters = () => {
    setPlatforms([]);
    setMinRating(undefined);
    setSortBy('downloads');
    onSearch({});
  };

  const activeFiltersCount = [
    platforms.length > 0,
    minRating !== undefined,
  ].filter(Boolean).length;

  const filterItems = [
    {
      key: 'platforms',
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            {t('platforms')}
          </div>
          <Select
            mode="multiple"
            placeholder={t('selectPlatforms')}
            value={platforms}
            onChange={setPlatforms}
            style={{ width: '100%' }}
            allowClear
          >
            {PLATFORM_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </div>
      ),
    },
    {
      key: 'rating',
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            {t('minimumRating')}
          </div>
          <Select
            placeholder={t('anyRating')}
            value={minRating}
            onChange={setMinRating}
            style={{ width: '100%' }}
            allowClear
          >
            {RATING_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </div>
      ),
    },
    {
      key: 'clear',
      label: (
        <Button type="link" onClick={handleClearFilters} style={{ padding: 0 }}>
          {t('clearAllFilters')}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <Row gutter={8} align="middle">
        <Col flex="auto">
          <Input
            placeholder={t('searchTemplates')}
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyPress={handleKeyPress}
            allowClear
            disabled={loading}
          />
        </Col>
        <Col>
          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 140 }}
            disabled={loading}
          >
            {SORT_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </Col>
        <Col>
          <Dropdown
            menu={{ items: filterItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button icon={<FilterOutlined />} disabled={loading}>
              {t('filters')}
              {activeFiltersCount > 0 && (
                <Tag color="blue" style={{ marginLeft: 4, marginRight: 0 }}>
                  {activeFiltersCount}
                </Tag>
              )}
            </Button>
          </Dropdown>
        </Col>
        <Col>
          <Button type="primary" onClick={handleSearch} loading={loading}>
            {t('search')}
          </Button>
        </Col>
      </Row>

      {/* Active filters display */}
      {(platforms.length > 0 || minRating !== undefined) && (
        <Space style={{ marginTop: 8 }} wrap>
          {platforms.map((p) => (
            <Tag
              key={p}
              closable
              onClose={() => setPlatforms(platforms.filter((x) => x !== p))}
            >
              {p.toUpperCase()}
            </Tag>
          ))}
          {minRating !== undefined && (
            <Tag closable onClose={() => setMinRating(undefined)}>
              {minRating}+ {t('stars')}
            </Tag>
          )}
        </Space>
      )}
    </div>
  );
};

export default TemplateSearch;
