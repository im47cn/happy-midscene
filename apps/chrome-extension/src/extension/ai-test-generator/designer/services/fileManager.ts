/**
 * File Manager Service
 * 文件管理服务 - 处理流程的保存、加载、导入和导出
 */

import type { TestFlow } from '../../types/designer';
import { exportYaml, importYaml } from './yamlConverter';
import { generateId } from './nodeRegistry';

/**
 * 文件格式
 */
export type FileFormat = 'json' | 'yaml' | 'midscene';

/**
 * 文件元数据
 */
export interface FileMetadata {
  /** 文件名 */
  name: string;
  /** 文件路径 */
  path?: string;
  /** 文件大小 */
  size: number;
  /** 最后修改时间 */
  lastModified: number;
  /** 文件格式 */
  format: FileFormat;
  /** 流程ID */
  flowId: string;
  /** 流程名称 */
  flowName: string;
  /** 流程描述 */
  flowDescription?: string;
  /** 节点数量 */
  nodeCount: number;
  /** 边数量 */
  edgeCount: number;
}

/**
 * 保存选项
 */
export interface SaveOptions {
  /** 是否包含元数据 */
  includeMetadata?: boolean;
  /** 是否格式化输出 */
  format?: boolean;
  /** 自定义文件名 */
  filename?: string;
}

/**
 * 加载选项
 */
export interface LoadOptions {
  /** 是否验证加载的流程 */
  validate?: boolean;
  /** 是否合并到当前流程 */
  merge?: boolean;
}

/**
 * 文件管理结果
 */
export interface FileManagerResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 文件元数据 */
  metadata?: FileMetadata;
}

/**
 * 文件列表结果
 */
export interface FileListResult {
  /** 文件列表 */
  files: FileMetadata[];
  /** 错误信息 */
  error?: string;
}

/**
 * 存储键前缀
 */
const STORAGE_PREFIX = 'designer_flow_';
const STORAGE_METADATA_PREFIX = 'designer_metadata_';
const STORAGE_RECENT_KEY = 'designer_recent_files';

/**
 * 将流程转换为 JSON 格式
 */
function flowToJson(flow: TestFlow, options: SaveOptions = {}): string {
  const { includeMetadata = true } = options;

  const data = {
    ...flow,
    format: 'midscene-flow' as const,
    ...(includeMetadata && {
      metadata: {
        ...flow.metadata,
        exportedAt: Date.now(),
        exportedBy: 'midscene-designer',
      },
    }),
  };

  return JSON.stringify(data, null, options.format ? 2 : 0);
}

/**
 * 从 JSON 解析流程
 */
function flowFromJson(jsonContent: string): TestFlow | null {
  try {
    const data = JSON.parse(jsonContent);

    // 验证格式
    if (data.format !== 'midscene-flow') {
      throw new Error('Invalid file format');
    }

    // 提取流程数据
    const flow: TestFlow = {
      id: data.id || generateId('flow'),
      name: data.name || 'Untitled Flow',
      description: data.description || '',
      version: data.version || 1,
      nodes: data.nodes || [],
      edges: data.edges || [],
      variables: data.variables || [],
      metadata: data.metadata || {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    return flow;
  } catch (error) {
    console.error('Failed to parse JSON flow:', error);
    return null;
  }
}

/**
 * 生成文件元数据
 */
function generateMetadata(flow: TestFlow, format: FileFormat, filename?: string): FileMetadata {
  return {
    name: filename || `${flow.name}.${format}`,
    flowId: flow.id,
    flowName: flow.name,
    flowDescription: flow.description,
    nodeCount: flow.nodes?.length || 0,
    edgeCount: flow.edges?.length || 0,
    format,
    size: 0, // 会在保存时更新
    lastModified: Date.now(),
  };
}

/**
 * 保存流程到浏览器存储
 */
export function saveToStorage(flow: TestFlow, options: SaveOptions = {}): FileManagerResult {
  try {
    if (!flow || !flow.id) {
      return { success: false, error: 'Invalid flow data' };
    }

    // 保存流程数据（JSON 格式）
    const jsonContent = flowToJson(flow, options);
    const key = `${STORAGE_PREFIX}${flow.id}`;
    localStorage.setItem(key, jsonContent);

    // 保存元数据
    const metadata = generateMetadata(flow, 'json', options.filename);
    metadata.size = jsonContent.length;
    const metadataKey = `${STORAGE_METADATA_PREFIX}${flow.id}`;
    localStorage.setItem(metadataKey, JSON.stringify(metadata));

    // 更新最近文件列表
    addToRecentFiles(metadata);

    return { success: true, metadata };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 从浏览器存储加载流程
 */
export function loadFromStorage(flowId: string, options: LoadOptions = {}): TestFlow | null {
  try {
    const key = `${STORAGE_PREFIX}${flowId}`;
    const content = localStorage.getItem(key);

    if (!content) {
      return null;
    }

    return flowFromJson(content);
  } catch (error) {
    console.error('Failed to load flow from storage:', error);
    return null;
  }
}

/**
 * 删除存储中的流程
 */
export function deleteFromStorage(flowId: string): boolean {
  try {
    const key = `${STORAGE_PREFIX}${flowId}`;
    const metadataKey = `${STORAGE_METADATA_PREFIX}${flowId}`;

    localStorage.removeItem(key);
    localStorage.removeItem(metadataKey);

    // 从最近文件列表中移除
    removeFromRecentFiles(flowId);

    return true;
  } catch (error) {
    console.error('Failed to delete flow from storage:', error);
    return false;
  }
}

/**
 * 获取所有存储的流程元数据
 */
export function listStoredFlows(): FileListResult {
  try {
    const files: FileMetadata[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_METADATA_PREFIX)) {
        const content = localStorage.getItem(key);
        if (content) {
          try {
            const metadata = JSON.parse(content) as FileMetadata;
            files.push(metadata);
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    // 按最后修改时间排序
    files.sort((a, b) => b.lastModified - a.lastModified);

    return { files };
  } catch (error) {
    return {
      files: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 导出流程为文件
 */
export function exportFlow(flow: TestFlow, format: FileFormat = 'json', options: SaveOptions = {}): FileManagerResult {
  try {
    if (!flow || !flow.id) {
      return { success: false, error: 'Invalid flow data' };
    }

    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'yaml':
        content = exportYaml(flow, options);
        mimeType = 'text/yaml';
        extension = 'yaml';
        break;

      case 'midscene':
        content = flowToJson(flow, options);
        mimeType = 'application/json';
        extension = 'midscene';
        break;

      case 'json':
      default:
        content = flowToJson(flow, options);
        mimeType = 'application/json';
        extension = 'json';
        break;
    }

    // 创建下载链接
    const filename = options.filename || `${flow.name}.${extension}`;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const metadata = generateMetadata(flow, format, filename);
    metadata.size = content.length;

    // 添加到最近文件
    addToRecentFiles(metadata);

    return { success: true, metadata };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 从文件导入流程
 */
export function importFlow(file: File, options: LoadOptions = {}): Promise<TestFlow | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;

        if (!content) {
          reject(new Error('File content is empty'));
          return;
        }

        let flow: TestFlow | null = null;

        // 根据文件扩展名判断格式
        const extension = file.name.split('.').pop()?.toLowerCase();

        if (extension === 'yaml' || extension === 'yml') {
          flow = importYaml(content);
        } else {
          // JSON 格式
          flow = flowFromJson(content);
        }

        if (flow) {
          // 更新元数据
          flow.metadata = {
            ...flow.metadata,
            importedAt: Date.now(),
            importedFrom: file.name,
          };

          // 保存到存储
          saveToStorage(flow);

          resolve(flow);
        } else {
          reject(new Error('Failed to parse flow file'));
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * 从 URL 导入流程
 */
export async function importFromUrl(url: string, options: LoadOptions = {}): Promise<TestFlow | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const content = await response.text();
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'imported.json';
    const extension = filename.split('.').pop()?.toLowerCase();

    let flow: TestFlow | null = null;

    if (extension === 'yaml' || extension === 'yml') {
      flow = importYaml(content);
    } else {
      flow = flowFromJson(content);
    }

    if (flow) {
      flow.metadata = {
        ...flow.metadata,
        importedAt: Date.now(),
        importedFrom: url,
      };

      saveToStorage(flow);
    }

    return flow;
  } catch (error) {
    console.error('Failed to import flow from URL:', error);
    return null;
  }
}

/**
 * 克隆流程
 */
export function cloneFlow(flow: TestFlow, newName?: string): TestFlow {
  const cloned: TestFlow = {
    ...flow,
    id: generateId('flow'),
    name: newName || `${flow.name} (副本)`,
    nodes: flow.nodes?.map((node) => ({
      ...node,
      id: generateId(node.type),
    })) || [],
    edges: flow.edges?.map((edge) => ({
      ...edge,
      id: generateId('edge'),
    })) || [],
    metadata: {
      ...flow.metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      clonedFrom: flow.id,
    },
  };

  return cloned;
}

/**
 * 合并两个流程
 */
export function mergeFlows(targetFlow: TestFlow, sourceFlow: TestFlow): TestFlow {
  // 创建节点ID映射
  const nodeIdMap = new Map<string, string>();
  const sourceNodes = sourceFlow.nodes || [];
  const mergedNodes = sourceNodes.map((node) => {
    const newId = generateId(node.type);
    nodeIdMap.set(node.id, newId);
    return {
      ...node,
      id: newId,
    };
  });

  // 合并边，更新节点ID
  const sourceEdges = sourceFlow.edges || [];
  const mergedEdges = sourceEdges.map((edge) => ({
    ...edge,
    id: generateId('edge'),
    source: nodeIdMap.get(edge.source) || edge.source,
    target: nodeIdMap.get(edge.target) || edge.target,
  }));

  return {
    ...targetFlow,
    nodes: [...(targetFlow.nodes || []), ...mergedNodes],
    edges: [...(targetFlow.edges || []), ...mergedEdges],
    variables: [...(targetFlow.variables || []), ...(sourceFlow.variables || [])],
    metadata: {
      ...targetFlow.metadata,
      updatedAt: Date.now(),
      mergedWith: sourceFlow.id,
    },
  };
}

/**
 * 添加到最近文件列表
 */
function addToRecentFiles(metadata: FileMetadata): void {
  try {
    const recentJson = localStorage.getItem(STORAGE_RECENT_KEY);
    const recent: FileMetadata[] = recentJson ? JSON.parse(recentJson) : [];

    // 移除重复项
    const filtered = recent.filter((f) => f.flowId !== metadata.flowId);

    // 添加到开头
    filtered.unshift(metadata);

    // 保留最近 20 个
    const trimmed = filtered.slice(0, 20);

    localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to update recent files:', error);
  }
}

/**
 * 从最近文件列表移除
 */
function removeFromRecentFiles(flowId: string): void {
  try {
    const recentJson = localStorage.getItem(STORAGE_RECENT_KEY);
    const recent: FileMetadata[] = recentJson ? JSON.parse(recentJson) : [];

    const filtered = recent.filter((f) => f.flowId !== flowId);
    localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to update recent files:', error);
  }
}

/**
 * 获取最近文件列表
 */
export function getRecentFiles(): FileMetadata[] {
  try {
    const recentJson = localStorage.getItem(STORAGE_RECENT_KEY);
    return recentJson ? JSON.parse(recentJson) : [];
  } catch (error) {
    return [];
  }
}

/**
 * 清空最近文件列表
 */
export function clearRecentFiles(): void {
  try {
    localStorage.removeItem(STORAGE_RECENT_KEY);
  } catch (error) {
    console.error('Failed to clear recent files:', error);
  }
}

/**
 * 清空所有存储的流程
 */
export function clearAllStorage(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        keys.push(key);
      }
    }

    keys.forEach((key) => {
      if (
        key.startsWith(STORAGE_PREFIX) ||
        key.startsWith(STORAGE_METADATA_PREFIX)
      ) {
        localStorage.removeItem(key);
      }
    });

    clearRecentFiles();
  } catch (error) {
    console.error('Failed to clear storage:', error);
  }
}

/**
 * 获取存储使用情况
 */
export function getStorageUsage(): { used: number; total: number; percentage: number } {
  let used = 0;
  const total = 5 * 1024 * 1024; // 5MB (localStorage 典型限制)

  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage[key].length + key.length;
    }
  }

  return {
    used,
    total,
    percentage: (used / total) * 100,
  };
}

export default {
  saveToStorage,
  loadFromStorage,
  deleteFromStorage,
  listStoredFlows,
  exportFlow,
  importFlow,
  importFromUrl,
  cloneFlow,
  mergeFlows,
  getRecentFiles,
  clearRecentFiles,
  clearAllStorage,
  getStorageUsage,
};
