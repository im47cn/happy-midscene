/**
 * Marketplace Home Component
 * Main page for browsing the template marketplace
 */

import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  FireOutlined,
  HistoryOutlined,
  HeartOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import {
  Button,
  Col,
  Row,
  Segmented,
  Typography,
} from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { marketplaceAPI, templateStorage } from '../services';
import type {
  CategoryInfo,
  LocalTemplate,
  SearchQuery,
  Template,
  TemplateCategory,
  TemplateSummary,
} from '../types';
import { CategoryNav } from './CategoryNav';
import { MarketplaceErrorBoundary } from './ErrorBoundary';
import { EmptyState, LoadingState } from './StateDisplay';
import { TemplateCard } from './TemplateCard';
import { TemplateDetail } from './TemplateDetail';
import { TemplateSearch } from './TemplateSearch';

const { Title } = Typography;

type ViewMode = 'browse' | 'featured' | 'popular' | 'latest' | 'favorites' | 'downloaded';

interface MarketplaceHomeProps {
  onBack?: () => void;
  onApplyTemplate?: (yaml: string, template: Template) => void;
}

export const MarketplaceHome: React.FC<MarketplaceHomeProps> = ({
  onBack,
  onApplyTemplate,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [localTemplates, setLocalTemplates] = useState<LocalTemplate[]>([]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [cats, featuredTemplates, favs] = await Promise.all([
          marketplaceAPI.getCategories(),
          marketplaceAPI.getFeatured(),
          templateStorage.getFavoriteTemplates(),
        ]);
        setCategories(cats);
        setTemplates(featuredTemplates);
        setFavorites(new Set(favs.map((f) => f.id)));
        setLocalTemplates(await templateStorage.getDownloadedTemplates());
      } catch (error) {
        console.error('Failed to load marketplace data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Load templates based on view mode
  useEffect(() => {
    const loadTemplates = async () => {
      if (selectedTemplate) return; // Don't reload when viewing detail

      setLoading(true);
      try {
        let result: TemplateSummary[] = [];
        switch (viewMode) {
          case 'featured':
            result = await marketplaceAPI.getFeatured();
            break;
          case 'popular':
            result = await marketplaceAPI.getPopular(selectedCategory);
            break;
          case 'latest':
            result = await marketplaceAPI.getLatest();
            break;
          case 'favorites':
            const favs = await templateStorage.getFavoriteTemplates();
            result = favs.map((f) => ({
              id: f.template.id,
              name: f.template.name,
              slug: f.template.slug,
              shortDescription: f.template.shortDescription,
              category: f.template.category,
              platforms: f.template.platforms,
              thumbnail: f.template.media.thumbnail,
              version: f.template.version,
              publisher: {
                id: f.template.publisher.id,
                name: f.template.publisher.name,
                verified: f.template.publisher.verified,
              },
              stats: f.template.stats,
              featured: f.template.featured,
              publishedAt: f.template.publishedAt,
            }));
            break;
          case 'downloaded':
            const downloaded = await templateStorage.getDownloadedTemplates();
            result = downloaded.map((d) => ({
              id: d.template.id,
              name: d.template.name,
              slug: d.template.slug,
              shortDescription: d.template.shortDescription,
              category: d.template.category,
              platforms: d.template.platforms,
              thumbnail: d.template.media.thumbnail,
              version: d.template.version,
              publisher: {
                id: d.template.publisher.id,
                name: d.template.publisher.name,
                verified: d.template.publisher.verified,
              },
              stats: d.template.stats,
              featured: d.template.featured,
              publishedAt: d.template.publishedAt,
            }));
            break;
          case 'browse':
          default:
            const searchResult = await marketplaceAPI.getTemplates({ category: selectedCategory });
            result = searchResult.templates;
        }
        setTemplates(result);
      } catch (error) {
        console.error('Failed to load templates:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, [viewMode, selectedCategory, selectedTemplate]);

  const handleSearch = useCallback(async (query: SearchQuery) => {
    setLoading(true);
    try {
      const result = await marketplaceAPI.searchTemplates({
        ...query,
        category: selectedCategory,
      });
      setTemplates(result.templates);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  const handleTemplateClick = useCallback(async (template: TemplateSummary) => {
    setDetailLoading(true);
    try {
      const fullTemplate = await marketplaceAPI.getTemplate(template.id);
      setSelectedTemplate(fullTemplate);
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleFavoriteClick = useCallback(async (template: TemplateSummary, isFavorite: boolean) => {
    try {
      const fullTemplate = await marketplaceAPI.getTemplate(template.id);
      await templateStorage.saveTemplate(fullTemplate);
      await templateStorage.setFavorite(template.id, isFavorite);

      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFavorite) {
          next.add(template.id);
        } else {
          next.delete(template.id);
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to update favorite:', error);
    }
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setSelectedTemplate(null);
  }, []);

  const handleApplyTemplate = useCallback((yaml: string, template: Template) => {
    if (onApplyTemplate) {
      onApplyTemplate(yaml, template);
    }
    setSelectedTemplate(null);
  }, [onApplyTemplate]);

  // Show template detail
  if (selectedTemplate) {
    return (
      <TemplateDetail
        template={selectedTemplate}
        onBack={handleBackFromDetail}
        onApply={handleApplyTemplate}
        loading={detailLoading}
      />
    );
  }

  return (
    <div className="marketplace-home" style={{ padding: '0 8px' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        {onBack && (
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
        )}
        <Title level={4} style={{ margin: 0, flex: 1 }}>
          Template Marketplace
        </Title>
      </div>

      {/* Search */}
      <TemplateSearch onSearch={handleSearch} loading={loading} />

      {/* View Mode Selector */}
      <div style={{ marginBottom: 16 }}>
        <Segmented
          value={viewMode}
          onChange={(value) => setViewMode(value as ViewMode)}
          options={[
            { value: 'browse', label: 'Browse', icon: <AppstoreOutlined /> },
            { value: 'featured', label: 'Featured', icon: <RocketOutlined /> },
            { value: 'popular', label: 'Popular', icon: <FireOutlined /> },
            { value: 'latest', label: 'Latest', icon: <HistoryOutlined /> },
            { value: 'favorites', label: 'Favorites', icon: <HeartOutlined /> },
          ]}
        />
      </div>

      {/* Category Filter */}
      {(viewMode === 'browse' || viewMode === 'popular') && (
        <div style={{ marginBottom: 16 }}>
          <CategoryNav
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>
      )}

      {/* Template Grid */}
      {loading ? (
        <LoadingState type="spinner" text="Loading templates..." />
      ) : templates.length === 0 ? (
        <EmptyState
          type={viewMode === 'favorites' ? 'favorites' : viewMode === 'browse' ? 'search' : 'templates'}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {templates.map((template) => (
            <Col key={template.id} xs={24} sm={12} lg={8}>
              <TemplateCard
                template={template}
                onClick={handleTemplateClick}
                onFavoriteClick={handleFavoriteClick}
                isFavorite={favorites.has(template.id)}
              />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

/**
 * Wrapped MarketplaceHome with ErrorBoundary
 */
const MarketplaceHomeWithErrorBoundary: React.FC<MarketplaceHomeProps> = (props) => (
  <MarketplaceErrorBoundary>
    <MarketplaceHome {...props} />
  </MarketplaceErrorBoundary>
);

export { MarketplaceHomeWithErrorBoundary };
export default MarketplaceHome;
