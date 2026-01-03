/**
 * Template Search Component
 * Search and filter templates in the marketplace
 */

import {
  FilterOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Col,
  Dropdown,
  Input,
  Row,
  Select,
  Space,
  Tag,
} from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import type { LicenseType, PlatformType, SearchQuery, TemplateCategory } from '../types';

const { Option } = Select;

interface TemplateSearchProps {
  onSearch: (query: SearchQuery) => void;
  loading?: boolean;
}

const SORT_OPTIONS = [
  { value: 'downloads', label: 'Most Downloads' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'publishedAt', label: 'Newest' },
  { value: 'relevance', label: 'Relevance' },
];

const PLATFORM_OPTIONS: { value: PlatformType; label: string }[] = [
  { value: 'web', label: 'Web' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
];

const RATING_OPTIONS = [
  { value: 4, label: '4+ Stars' },
  { value: 3, label: '3+ Stars' },
  { value: 2, label: '2+ Stars' },
];

export const TemplateSearch: React.FC<TemplateSearchProps> = ({
  onSearch,
  loading = false,
}) => {
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<string>('downloads');
  const [platforms, setPlatforms] = useState<PlatformType[]>([]);
  const [minRating, setMinRating] = useState<number | undefined>();
  const [showAdvanced, setShowAdvanced] = useState(false);

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
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Platforms</div>
          <Select
            mode="multiple"
            placeholder="Select platforms"
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
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Minimum Rating</div>
          <Select
            placeholder="Any rating"
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
          Clear all filters
        </Button>
      ),
    },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <Row gutter={8} align="middle">
        <Col flex="auto">
          <Input
            placeholder="Search templates..."
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
            <Button
              icon={<FilterOutlined />}
              disabled={loading}
            >
              Filters
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
            Search
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
              {minRating}+ Stars
            </Tag>
          )}
        </Space>
      )}
    </div>
  );
};

export default TemplateSearch;
