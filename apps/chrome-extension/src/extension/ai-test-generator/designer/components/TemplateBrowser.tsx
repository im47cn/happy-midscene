/**
 * Template Browser Component
 * 模板浏览器 - 浏览、搜索和管理测试流程模板
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FileOutlined,
  FolderOutlined,
  SearchOutlined,
  StarOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  PlusOutlined,
  TagOutlined,
  CloseOutlined,
  CheckOutlined,
  EditOutlined,
  AppstoreOutlined,
  BarsOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  Modal,
  Input,
  Card,
  Space,
  Tag,
  Button,
  List,
  Tabs,
  Select,
  Tooltip,
  Image,
  Typography,
  Empty,
  message,
  Divider,
  Row,
  Col,
  Dropdown,
  Popconfirm,
  Form,
  Alert,
} from 'antd';
import type {
  Template,
  TemplateCategory,
  TemplateMetadata,
} from '../services/templateManager';
import {
  getTemplateManager,
  BUILT_IN_CATEGORIES,
} from '../services/templateManager';

const { Search } = Input;
const { Text, Paragraph, Title } = Typography;

/**
 * 视图模式
 */
type ViewMode = 'grid' | 'list';

/**
 * 模板卡片项
 */
function TemplateCard({
  template,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onExport,
}: {
  template: Template;
  isSelected: boolean;
  onSelect: (template: Template) => void;
  onEdit: (template: Template) => void;
  onDelete: (templateId: string) => void;
  onExport: (templateId: string) => void;
}) {
  const {
    id,
    name,
    description,
    category,
    tags,
    useCount,
    nodeCount,
    estimatedDuration,
    thumbnail,
    updatedAt,
  } = template.metadata;

  const categoryInfo = BUILT_IN_CATEGORIES.find((c) => c.id === category);

  return (
    <Card
      hoverable
      style={{
        height: '100%',
        borderColor: isSelected ? '#1890ff' : undefined,
        borderWidth: isSelected ? 2 : 1,
      }}
      bodyStyle={{ padding: 12 }}
      onClick={() => onSelect(template)}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {/* 标题区域 */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <span style={{ fontSize: 18 }}>{categoryInfo?.icon || '📁'}</span>
            <Text strong ellipsis style={{ maxWidth: 140 }}>
              {name}
            </Text>
          </Space>
          {isSelected && <CheckOutlined style={{ color: '#52c41a' }} />}
        </div>

        {/* 缩略图 */}
        {thumbnail && (
          <div
            style={{
              width: '100%',
              height: 100,
              background: '#f5f5f5',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <img
              src={thumbnail}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* 描述 */}
        {description && (
          <Paragraph
            ellipsis={{ rows: 2 }}
            style={{ margin: 0, fontSize: 12, color: '#666' }}
          >
            {description}
          </Paragraph>
        )}

        {/* 标签 */}
        {tags && tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.slice(0, 3).map((tag) => (
              <Tag key={tag} size="small">
                {tag}
              </Tag>
            ))}
            {tags.length > 3 && (
              <Tag size="small">+{tags.length - 3}</Tag>
            )}
          </div>
        )}

        {/* 元信息 */}
        <Space size="small" style={{ fontSize: 11, color: '#999' }}>
          <span>{nodeCount || 0} nodes</span>
          <span>·</span>
          <span>{estimatedDuration ? `${(estimatedDuration / 1000).toFixed(0)}s` : 'N/A'}</span>
          {useCount !== undefined && useCount > 0 && (
            <>
              <span>·</span>
              <span>{useCount} uses</span>
            </>
          )}
        </Space>

        {/* 操作按钮 */}
        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title="Edit">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(template)}
            />
          </Tooltip>
          <Tooltip title="Export">
            <Button
              size="small"
              type="text"
              icon={<DownloadOutlined />}
              onClick={() => onExport(id)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete template?"
            description="This action cannot be undone"
            onConfirm={() => onDelete(id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      </Space>
    </Card>
  );
}

export interface TemplateBrowserProps {
  visible?: boolean;
  onClose?: () => void;
  onSelectTemplate?: (flow: any) => void;
}

/**
 * Template Browser Component
 */
export function TemplateBrowser({
  visible = false,
  onClose,
  onSelectTemplate,
}: TemplateBrowserProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'popular'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'usage'>('updated');
  const [loading, setLoading] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveForm] = Form.useForm();

  /**
   * 加载模板
   */
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const manager = getTemplateManager();
      await manager.initialize();

      let loadedTemplates: Template[] = [];

      switch (activeTab) {
        case 'recent':
          loadedTemplates = manager.getRecentTemplates(50);
          break;
        case 'popular':
          loadedTemplates = manager.getPopularTemplates(50);
          break;
        default:
          loadedTemplates = manager.getAllTemplates();
      }

      // 应用分类过滤
      if (selectedCategory !== 'all') {
        loadedTemplates = loadedTemplates.filter(
          (t) => t.metadata.category === selectedCategory,
        );
      }

      // 应用搜索过滤
      if (searchQuery) {
        loadedTemplates = manager.searchTemplates(searchQuery);
        if (selectedCategory !== 'all') {
          loadedTemplates = loadedTemplates.filter(
            (t) => t.metadata.category === selectedCategory,
          );
        }
      }

      // 应用排序
      loadedTemplates = [...loadedTemplates].sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.metadata.name.localeCompare(b.metadata.name);
          case 'usage':
            return (b.metadata.useCount || 0) - (a.metadata.useCount || 0);
          case 'updated':
          default:
            return b.metadata.updatedAt - a.metadata.updatedAt;
        }
      });

      setTemplates(loadedTemplates);
      setCategories(manager.getAllCategories());
    } catch (error) {
      message.error('Failed to load templates: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedCategory, searchQuery, sortBy]);

  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible, loadTemplates]);

  /**
   * 选择模板
   */
  const handleSelectTemplate = useCallback(
    async (template: Template) => {
      setSelectedTemplate(template);
    },
    [],
  );

  /**
   * 确认选择并加载模板
   */
  const handleConfirmSelection = useCallback(async () => {
    if (!selectedTemplate) {
      message.warning('Please select a template first');
      return;
    }

    try {
      const manager = getTemplateManager();
      const flow = await manager.loadTemplate(selectedTemplate.metadata.id);
      if (flow && onSelectTemplate) {
        onSelectTemplate(flow);
        message.success('Template loaded: ' + selectedTemplate.metadata.name);
        handleClose();
      }
    } catch (error) {
      message.error('Failed to load template: ' + (error as Error).message);
    }
  }, [selectedTemplate, onSelectTemplate]);

  /**
   * 编辑模板
   */
  const handleEditTemplate = useCallback((template: Template) => {
    saveForm.setFieldsValue({
      name: template.metadata.name,
      description: template.metadata.description,
      category: template.metadata.category,
      tags: template.metadata.tags?.join(', ') || '',
    });
    setSelectedTemplate(template);
    setShowSaveDialog(true);
  }, [saveForm]);

  /**
   * 删除模板
   */
  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      try {
        const manager = getTemplateManager();
        await manager.deleteTemplate(templateId);
        message.success('Template deleted');
        loadTemplates();
      } catch (error) {
        message.error('Failed to delete template: ' + (error as Error).message);
      }
    },
    [loadTemplates],
  );

  /**
   * 导出模板
   */
  const handleExportTemplate = useCallback(
    async (templateId: string) => {
      try {
        const manager = getTemplateManager();
        const content = manager.exportTemplateToFile(templateId);
        if (!content) {
          message.error('Template not found');
          return;
        }

        const blob = new Blob([content], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `template-${templateId}.yaml`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('Template exported');
      } catch (error) {
        message.error('Failed to export template: ' + (error as Error).message);
      }
    },
    [],
  );

  /**
   * 导入模板
   */
  const handleImportTemplate = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const manager = getTemplateManager();
        await manager.importTemplateFromFile(text, {
          name: file.name.replace(/\.(yaml|yml)$/, ''),
        });
        message.success('Template imported');
        setShowImportDialog(false);
        loadTemplates();
      } catch (error) {
        message.error('Failed to import template: ' + (error as Error).message);
      }
    },
    [loadTemplates],
  );

  /**
   * 保存模板更新
   */
  const handleSaveTemplate = useCallback(
    async (values: any) => {
      try {
        const manager = getTemplateManager();
        // 这里需要获取当前的 flow 数据
        message.info('Template update feature requires current flow data');
        setShowSaveDialog(false);
      } catch (error) {
        message.error('Failed to update template: ' + (error as Error).message);
      }
    },
    [],
  );

  /**
   * 关闭对话框
   */
  const handleClose = useCallback(() => {
    setSelectedTemplate(null);
    setSearchQuery('');
    setSelectedCategory('all');
    onClose?.();
  }, [onClose]);

  /**
   * 获取统计信息
   */
  const getStats = useCallback(() => {
    const manager = getTemplateManager();
    return manager.getStats();
  }, []);

  const stats = getStats();

  return (
    <>
      <Modal
        title={
          <Space>
            <AppstoreOutlined />
            <span>Template Browser</span>
            {selectedTemplate && (
              <Tag color="blue">{selectedTemplate.metadata.name}</Tag>
            )}
          </Space>
        }
        open={visible}
        onCancel={handleClose}
        width={900}
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button
                icon={<UploadOutlined />}
                onClick={() => setShowImportDialog(true)}
              >
                Import
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => setShowSaveDialog(true)}
              >
                New Template
              </Button>
            </Space>
            <Space>
              <Button onClick={handleClose}>Cancel</Button>
              <Button
                type="primary"
                onClick={handleConfirmSelection}
                disabled={!selectedTemplate}
              >
                Load Template
              </Button>
            </Space>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* 搜索和过滤 */}
          <Space style={{ width: '100%' }} wrap>
            <Search
              placeholder="Search templates..."
              allowClear
              style={{ width: 240 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefix={<SearchOutlined />}
            />
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ width: 160 }}
            >
              <Select.Option value="all">All Categories</Select.Option>
              {categories.map((cat) => (
                <Select.Option key={cat.id} value={cat.id}>
                  <Space>
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </Space>
                </Select.Option>
              ))}
            </Select>
            <Select
              value={sortBy}
              onChange={(v) => setSortBy(v as any)}
              style={{ width: 140 }}
            >
              <Select.Option value="updated">Recently Updated</Select.Option>
              <Select.Option value="usage">Most Used</Select.Option>
              <Select.Option value="name">Alphabetical</Select.Option>
            </Select>
            <Button.Group>
              <Button
                type={viewMode === 'grid' ? 'primary' : 'default'}
                icon={<AppstoreOutlined />}
                onClick={() => setViewMode('grid')}
              />
              <Button
                type={viewMode === 'list' ? 'primary' : 'default'}
                icon={<BarsOutlined />}
                onClick={() => setViewMode('list')}
              />
            </Button.Group>
          </Space>

          {/* 标签页 */}
          <Tabs
            activeKey={activeTab}
            onChange={(v) => setActiveTab(v as any)}
            items={[
              {
                key: 'all',
                label: (
                  <Space>
                    <FileOutlined />
                    All Templates ({stats.totalTemplates})
                  </Space>
                ),
              },
              {
                key: 'recent',
                label: (
                  <Space>
                    <ClockCircleOutlined />
                    Recent
                  </Space>
                ),
              },
              {
                key: 'popular',
                label: (
                  <Space>
                    <StarOutlined />
                    Popular
                  </Space>
                ),
              },
            ]}
          />

          {/* 模板列表 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">Loading templates...</Text>
            </div>
          ) : templates.length === 0 ? (
            <Empty
              description={
                searchQuery
                  ? 'No templates match your search'
                  : 'No templates available'
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : viewMode === 'grid' ? (
            <Row gutter={[12, 12]}>
              {templates.map((template) => (
                <Col key={template.metadata.id} span={8}>
                  <TemplateCard
                    template={template}
                    isSelected={selectedTemplate?.metadata.id === template.metadata.id}
                    onSelect={handleSelectTemplate}
                    onEdit={handleEditTemplate}
                    onDelete={handleDeleteTemplate}
                    onExport={handleExportTemplate}
                  />
                </Col>
              ))}
            </Row>
          ) : (
            <List
              dataSource={templates}
              renderItem={(template) => (
                <List.Item
                  key={template.metadata.id}
                  style={{
                    padding: 12,
                    border: '1px solid #f0f0f0',
                    borderRadius: 4,
                    marginBottom: 8,
                    cursor: 'pointer',
                    background:
                      selectedTemplate?.metadata.id === template.metadata.id
                        ? '#e6f7ff'
                        : undefined,
                  }}
                  onClick={() => handleSelectTemplate(template)}
                >
                  <List.Item.Meta
                    avatar={
                      <span style={{ fontSize: 24 }}>
                        {
                          BUILT_IN_CATEGORIES.find(
                            (c) => c.id === template.metadata.category,
                          )?.icon || '📁'
                        }
                      </span>
                    }
                    title={
                      <Space>
                        <Text strong>{template.metadata.name}</Text>
                        <Tag color="blue">
                          {
                            BUILT_IN_CATEGORIES.find(
                              (c) => c.id === template.metadata.category,
                            )?.name
                          }
                        </Tag>
                        {template.metadata.useCount !== undefined &&
                          template.metadata.useCount > 0 && (
                            <Tag
                              icon={<StarOutlined />}
                              color="gold"
                            >
                              {template.metadata.useCount}
                            </Tag>
                          )}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size="small">
                        {template.metadata.description && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {template.metadata.description}
                          </Text>
                        )}
                        <Space size="small">
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {template.metadata.nodeCount || 0} nodes
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Updated:{' '}
                            {new Date(
                              template.metadata.updatedAt,
                            ).toLocaleDateString()}
                          </Text>
                        </Space>
                      </Space>
                    }
                  />
                  <Space>
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTemplate(template);
                      }}
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<DownloadOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportTemplate(template.metadata.id);
                      }}
                    />
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Space>
      </Modal>

      {/* 导入对话框 */}
      <Modal
        title="Import Template"
        open={showImportDialog}
        onCancel={() => setShowImportDialog(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            message="Import Template"
            description="Select a YAML or JSON file to import as a template."
            type="info"
            showIcon
          />
          <input
            type="file"
            accept=".yaml,.yml,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleImportTemplate(file);
              }
            }}
            style={{ display: 'block' }}
          />
        </Space>
      </Modal>

      {/* 保存/编辑对话框 */}
      <Modal
        title={selectedTemplate ? 'Edit Template' : 'Save as Template'}
        open={showSaveDialog}
        onCancel={() => setShowSaveDialog(false)}
        onOk={() => saveForm.submit()}
      >
        <Form
          form={saveForm}
          layout="vertical"
          onFinish={handleSaveTemplate}
        >
          <Form.Item
            name="name"
            label="Template Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="My Template" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea
              placeholder="Describe what this template does..."
              rows={3}
            />
          </Form.Item>
          <Form.Item name="category" label="Category" initialValue="custom">
            <Select>
              {categories.map((cat) => (
                <Select.Option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="tags" label="Tags">
            <Input placeholder="tag1, tag2, tag3" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

/**
 * 模板浏览器触发按钮
 */
export function TemplateBrowserButton({
  onSelectTemplate,
}: {
  onSelectTemplate?: (flow: any) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Button
        icon={<FolderOutlined />}
        onClick={() => setVisible(true)}
      >
        Browse Templates
      </Button>
      <TemplateBrowser
        visible={visible}
        onClose={() => setVisible(false)}
        onSelectTemplate={(flow) => {
          onSelectTemplate?.(flow);
          setVisible(false);
        }}
      />
    </>
  );
}

export default TemplateBrowser;
