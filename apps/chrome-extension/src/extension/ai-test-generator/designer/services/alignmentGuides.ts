/**
 * Alignment Guides Service
 * 对齐辅助服务 - 提供网格对齐、参考线、自动分布等功能
 */

import type { Node } from '@xyflow/react';

/**
 * 对齐类型
 */
export type AlignmentType =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'distribute-h'
  | 'distribute-v';

/**
 * 对齐参考线
 */
export interface AlignmentGuide {
  /** 参考线位置 */
  position: number;
  /** 参考线方向 */
  orientation: 'horizontal' | 'vertical';
  /** 参考线类型 */
  type: 'edge' | 'center' | 'spacing';
  /** 参考节点ID */
  nodeId?: string;
  /** 参考线颜色 */
  color?: string;
}

/**
 * 对齐选项
 */
export interface AlignmentOptions {
  /** 网格大小 */
  gridSize?: number;
  /** 吸附距离 */
  snapDistance?: number;
  /** 是否启用网格对齐 */
  enableSnapToGrid?: boolean;
  /** 是否启用参考线 */
  enableGuides?: boolean;
  /** 参考线颜色 */
  guideColor?: string;
}

/**
 * 分布选项
 */
export interface DistributionOptions {
  /** 分布方向 */
  direction: 'horizontal' | 'vertical';
  /** 间距 */
  spacing?: number;
  /** 是否包含边界 */
  includeBounds?: boolean;
}

/**
 * 对齐结果
 */
export interface AlignmentResult {
  /** 对齐后的节点 */
  nodes: Node[];
  /** 应用的对齐操作 */
  alignments: Array<{
    nodeId: string;
    type: AlignmentType;
    from: { x: number; y: number };
    to: { x: number; y: number };
  }>;
}

/**
 * 对齐辅助配置
 */
export interface AlignmentGuidesConfig {
  /** 默认网格大小 */
  defaultGridSize: number;
  /** 默认吸附距离 */
  defaultSnapDistance: number;
  /** 默认启用网格对齐 */
  defaultSnapToGrid: boolean;
  /** 默认启用参考线 */
  defaultGuides: boolean;
  /** 参考线颜色 */
  guideColor: string;
}

/**
 * 对齐辅助服务
 */
export class AlignmentGuides {
  private config: AlignmentGuidesConfig;
  private activeGuides: AlignmentGuide[] = [];

  constructor(config?: Partial<AlignmentGuidesConfig>) {
    this.config = {
      defaultGridSize: 20,
      defaultSnapDistance: 10,
      defaultSnapToGrid: true,
      defaultGuides: true,
      guideColor: '#1890ff',
      ...config,
    };
  }

  /**
   * 计算参考线
   */
  calculateGuides(
    nodes: Node[],
    movingNodeId: string,
    options?: AlignmentOptions,
  ): AlignmentGuide[] {
    const movingNode = nodes.find((n) => n.id === movingNodeId);
    if (!movingNode) {
      return [];
    }

    const snapDistance = options?.snapDistance ?? this.config.defaultSnapDistance;
    const guides: AlignmentGuide[] = [];
    const guideColor = options?.guideColor ?? this.config.guideColor;

    const movingBounds = this.getNodeBounds(movingNode);

    for (const node of nodes) {
      if (node.id === movingNodeId) continue;

      const bounds = this.getNodeBounds(node);

      // 检查水平对齐
      guides.push(...this.checkHorizontalAlignment(movingBounds, bounds, node.id, snapDistance, guideColor));
      // 检查垂直对齐
      guides.push(...this.checkVerticalAlignment(movingBounds, bounds, node.id, snapDistance, guideColor));
    }

    // 检查网格对齐
    if (options?.enableSnapToGrid ?? this.config.defaultSnapToGrid) {
      guides.push(...this.checkGridAlignment(movingBounds, options?.gridSize ?? this.config.defaultGridSize));
    }

    this.activeGuides = guides;
    return guides;
  }

  /**
   * 对齐节点到网格
   */
  snapToGrid(node: Node, gridSize?: number): Node {
    const size = gridSize ?? this.config.defaultGridSize;
    const position = node.position;

    return {
      ...node,
      position: {
        x: Math.round(position.x / size) * size,
        y: Math.round(position.y / size) * size,
      },
    };
  }

  /**
   * 对齐多个节点到网格
   */
  snapNodesToGrid(nodes: Node[], gridSize?: number): Node[] {
    return nodes.map((node) => this.snapToGrid(node, gridSize));
  }

  /**
   * 对齐节点
   */
  alignNodes(nodes: Node[], alignmentType: AlignmentType): AlignmentResult {
    if (nodes.length < 2) {
      return { nodes, alignments: [] };
    }

    let alignedNodes = [...nodes];
    const alignments: AlignmentResult['alignments'] = [];

    switch (alignmentType) {
      case 'left':
        alignedNodes = this.alignLeft(nodes, alignments);
        break;
      case 'center':
        alignedNodes = this.alignCenter(nodes, alignments);
        break;
      case 'right':
        alignedNodes = this.alignRight(nodes, alignments);
        break;
      case 'top':
        alignedNodes = this.alignTop(nodes, alignments);
        break;
      case 'middle':
        alignedNodes = this.alignMiddle(nodes, alignments);
        break;
      case 'bottom':
        alignedNodes = this.alignBottom(nodes, alignments);
        break;
      case 'distribute-h':
        alignedNodes = this.distributeHorizontal(nodes, alignments);
        break;
      case 'distribute-v':
        alignedNodes = this.distributeVertical(nodes, alignments);
        break;
    }

    return { nodes: alignedNodes, alignments };
  }

  /**
   * 自动对齐
   */
  autoAlign(nodes: Node[]): Node[] {
    if (nodes.length < 2) return nodes;

    // 检测节点的主要布局方向
    const bounds = nodes.map((n) => this.getNodeBounds(n));
    const width = Math.max(...bounds.map((b) => b.x + b.width)) - Math.min(...bounds.map((b) => b.x));
    const height = Math.max(...bounds.map((b) => b.y + b.height)) - Math.min(...bounds.map((b) => b.y));

    // 如果宽度大于高度，使用水平对齐，否则使用垂直对齐
    const isHorizontal = width > height;

    if (isHorizontal) {
      // 水平布局：垂直居中对齐
      return this.alignNodes(nodes, 'middle').nodes;
    } else {
      // 垂直布局：水平居中对齐
      return this.alignNodes(nodes, 'center').nodes;
    }
  }

  /**
   * 分布节点
   */
  distributeNodes(nodes: Node[], options: DistributionOptions): Node[] {
    if (nodes.length < 2) return nodes;

    const result = this.alignNodes(nodes, options.direction === 'horizontal' ? 'distribute-h' : 'distribute-v');
    return result.nodes;
  }

  /**
   * 获取当前活动的参考线
   */
  getActiveGuides(): AlignmentGuide[] {
    return this.activeGuides;
  }

  /**
   * 清除参考线
   */
  clearGuides(): void {
    this.activeGuides = [];
  }

  /**
   * 检查水平对齐
   */
  private checkHorizontalAlignment(
    movingBounds: { x: number; y: number; width: number; height: number },
    targetBounds: { x: number; y: number; width: number; height: number },
    targetId: string,
    snapDistance: number,
    color: string,
  ): AlignmentGuide[] {
    const guides: AlignmentGuide[] = [];

    // 顶部对齐
    if (Math.abs(movingBounds.y - targetBounds.y) < snapDistance) {
      guides.push({
        position: targetBounds.y,
        orientation: 'horizontal',
        type: 'edge',
        nodeId: targetId,
        color,
      });
    }

    // 底部对齐
    if (Math.abs((movingBounds.y + movingBounds.height) - (targetBounds.y + targetBounds.height)) < snapDistance) {
      guides.push({
        position: targetBounds.y + targetBounds.height,
        orientation: 'horizontal',
        type: 'edge',
        nodeId: targetId,
        color,
      });
    }

    // 垂直居中对齐
    const movingMiddle = movingBounds.y + movingBounds.height / 2;
    const targetMiddle = targetBounds.y + targetBounds.height / 2;
    if (Math.abs(movingMiddle - targetMiddle) < snapDistance) {
      guides.push({
        position: targetMiddle,
        orientation: 'horizontal',
        type: 'center',
        nodeId: targetId,
        color,
      });
    }

    return guides;
  }

  /**
   * 检查垂直对齐
   */
  private checkVerticalAlignment(
    movingBounds: { x: number; y: number; width: number; height: number },
    targetBounds: { x: number; y: number; width: number; height: number },
    targetId: string,
    snapDistance: number,
    color: string,
  ): AlignmentGuide[] {
    const guides: AlignmentGuide[] = [];

    // 左侧对齐
    if (Math.abs(movingBounds.x - targetBounds.x) < snapDistance) {
      guides.push({
        position: targetBounds.x,
        orientation: 'vertical',
        type: 'edge',
        nodeId: targetId,
        color,
      });
    }

    // 右侧对齐
    if (Math.abs((movingBounds.x + movingBounds.width) - (targetBounds.x + targetBounds.width)) < snapDistance) {
      guides.push({
        position: targetBounds.x + targetBounds.width,
        orientation: 'vertical',
        type: 'edge',
        nodeId: targetId,
        color,
      });
    }

    // 水平居中对齐
    const movingCenter = movingBounds.x + movingBounds.width / 2;
    const targetCenter = targetBounds.x + targetBounds.width / 2;
    if (Math.abs(movingCenter - targetCenter) < snapDistance) {
      guides.push({
        position: targetCenter,
        orientation: 'vertical',
        type: 'center',
        nodeId: targetId,
        color,
      });
    }

    return guides;
  }

  /**
   * 检查网格对齐
   */
  private checkGridAlignment(
    bounds: { x: number; y: number; width: number; height: number },
    gridSize: number,
  ): AlignmentGuide[] {
    const guides: AlignmentGuide[] = [];

    // 检查X轴对齐
    const gridX = Math.round(bounds.x / gridSize) * gridSize;
    if (Math.abs(bounds.x - gridX) < this.config.defaultSnapDistance) {
      guides.push({
        position: gridX,
        orientation: 'vertical',
        type: 'spacing',
        color: this.config.guideColor,
      });
    }

    // 检查Y轴对齐
    const gridY = Math.round(bounds.y / gridSize) * gridSize;
    if (Math.abs(bounds.y - gridY) < this.config.defaultSnapDistance) {
      guides.push({
        position: gridY,
        orientation: 'horizontal',
        type: 'spacing',
        color: this.config.guideColor,
      });
    }

    return guides;
  }

  /**
   * 获取节点边界
   */
  private getNodeBounds(node: Node): { x: number; y: number; width: number; height: number } {
    const style = node.style as Record<string, unknown> | undefined;
    const data = node.data as Record<string, unknown> | undefined;

    const width = Number((data?.width as number) || (style?.width as number) || 200);
    const height = Number((data?.height as number) || (style?.height as number) || 80);

    return {
      x: node.position.x,
      y: node.position.y,
      width,
      height,
    };
  }

  /**
   * 左对齐
   */
  private alignLeft(nodes: Node[], alignments: AlignmentResult['alignments']): Node[] {
    const leftMost = Math.min(...nodes.map((n) => n.position.x));

    return nodes.map((node) => {
      const from = { x: node.position.x, y: node.position.y };
      const to = { x: leftMost, y: node.position.y };

      alignments.push({
        nodeId: node.id,
        type: 'left',
        from,
        to,
      });

      return {
        ...node,
        position: { x: leftMost, y: node.position.y },
      };
    });
  }

  /**
   * 水平居中对齐
   */
  private alignCenter(nodes: Node[], alignments: AlignmentResult['alignments']): Node[] {
    const centerX = nodes.reduce((sum, n) => {
      const bounds = this.getNodeBounds(n);
      return sum + bounds.x + bounds.width / 2;
    }, 0) / nodes.length;

    return nodes.map((node) => {
      const bounds = this.getNodeBounds(node);
      const from = { x: node.position.x, y: node.position.y };
      const to = { x: centerX - bounds.width / 2, y: node.position.y };

      alignments.push({
        nodeId: node.id,
        type: 'center',
        from,
        to,
      });

      return {
        ...node,
        position: { x: to.x, y: node.position.y },
      };
    });
  }

  /**
   * 右对齐
   */
  private alignRight(nodes: Node[], alignments: AlignmentResult['alignments']): Node[] {
    const rightMost = Math.max(...nodes.map((n) => {
      const bounds = this.getNodeBounds(n);
      return bounds.x + bounds.width;
    }));

    return nodes.map((node) => {
      const bounds = this.getNodeBounds(node);
      const from = { x: node.position.x, y: node.position.y };
      const to = { x: rightMost - bounds.width, y: node.position.y };

      alignments.push({
        nodeId: node.id,
        type: 'right',
        from,
        to,
      });

      return {
        ...node,
        position: { x: to.x, y: node.position.y },
      };
    });
  }

  /**
   * 顶部对齐
   */
  private alignTop(nodes: Node[], alignments: AlignmentResult['alignments']): Node[] {
    const topMost = Math.min(...nodes.map((n) => n.position.y));

    return nodes.map((node) => {
      const from = { x: node.position.x, y: node.position.y };
      const to = { x: node.position.x, y: topMost };

      alignments.push({
        nodeId: node.id,
        type: 'top',
        from,
        to,
      });

      return {
        ...node,
        position: { x: node.position.x, y: topMost },
      };
    });
  }

  /**
   * 垂直居中对齐
   */
  private alignMiddle(nodes: Node[], alignments: AlignmentResult['alignments']): Node[] {
    const centerY = nodes.reduce((sum, n) => {
      const bounds = this.getNodeBounds(n);
      return sum + bounds.y + bounds.height / 2;
    }, 0) / nodes.length;

    return nodes.map((node) => {
      const bounds = this.getNodeBounds(node);
      const from = { x: node.position.x, y: node.position.y };
      const to = { x: node.position.x, y: centerY - bounds.height / 2 };

      alignments.push({
        nodeId: node.id,
        type: 'middle',
        from,
        to,
      });

      return {
        ...node,
        position: { x: node.position.x, y: to.y },
      };
    });
  }

  /**
   * 底部对齐
   */
  private alignBottom(nodes: Node[], alignments: AlignmentResult['alignments']): Node[] {
    const bottomMost = Math.max(...nodes.map((n) => {
      const bounds = this.getNodeBounds(n);
      return bounds.y + bounds.height;
    }));

    return nodes.map((node) => {
      const bounds = this.getNodeBounds(node);
      const from = { x: node.position.x, y: node.position.y };
      const to = { x: node.position.x, y: bottomMost - bounds.height };

      alignments.push({
        nodeId: node.id,
        type: 'bottom',
        from,
        to,
      });

      return {
        ...node,
        position: { x: node.position.x, y: to.y },
      };
    });
  }

  /**
   * 水平分布
   */
  private distributeHorizontal(nodes: Node[], alignments: AlignmentResult['alignments']): Node[] {
    // 按X坐标排序
    const sortedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x);

    // 计算可用空间
    const firstNode = this.getNodeBounds(sortedNodes[0]);
    const lastNode = this.getNodeBounds(sortedNodes[sortedNodes.length - 1]);
    const totalWidth = lastNode.x + lastNode.width - firstNode.x;

    // 计算平均间距
    const avgNodeWidth = sortedNodes.reduce((sum, n) => sum + this.getNodeBounds(n).width, 0) / sortedNodes.length;
    const spacing = (totalWidth - avgNodeWidth * sortedNodes.length) / (sortedNodes.length - 1);

    let currentX = firstNode.x;
    const alignedNodes: Node[] = [];

    for (const node of sortedNodes) {
      const bounds = this.getNodeBounds(node);
      const from = { x: node.position.x, y: node.position.y };

      // 第一个节点保持原位置
      let x = node.position.x;
      if (node.id !== sortedNodes[0].id) {
        x = currentX;
      }

      const to = { x, y: node.position.y };
      alignments.push({
        nodeId: node.id,
        type: 'distribute-h',
        from,
        to,
      });

      alignedNodes.push({
        ...node,
        position: { x, y: node.position.y },
      });

      currentX += bounds.width + spacing;
    }

    // 返回按原始顺序排列的节点
    const nodeMap = new Map(alignedNodes.map((n) => [n.id, n]));
    return nodes.map((n) => nodeMap.get(n.id) || n);
  }

  /**
   * 垂直分布
   */
  private distributeVertical(nodes: Node[], alignments: AlignmentResult['alignments']): Node[] {
    // 按Y坐标排序
    const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

    // 计算可用空间
    const firstNode = this.getNodeBounds(sortedNodes[0]);
    const lastNode = this.getNodeBounds(sortedNodes[sortedNodes.length - 1]);
    const totalHeight = lastNode.y + lastNode.height - firstNode.y;

    // 计算平均间距
    const avgNodeHeight = sortedNodes.reduce((sum, n) => sum + this.getNodeBounds(n).height, 0) / sortedNodes.length;
    const spacing = (totalHeight - avgNodeHeight * sortedNodes.length) / (sortedNodes.length - 1);

    let currentY = firstNode.y;
    const alignedNodes: Node[] = [];

    for (const node of sortedNodes) {
      const bounds = this.getNodeBounds(node);
      const from = { x: node.position.x, y: node.position.y };

      // 第一个节点保持原位置
      let y = node.position.y;
      if (node.id !== sortedNodes[0].id) {
        y = currentY;
      }

      const to = { x: node.position.x, y };
      alignments.push({
        nodeId: node.id,
        type: 'distribute-v',
        from,
        to,
      });

      alignedNodes.push({
        ...node,
        position: { x: node.position.x, y },
      });

      currentY += bounds.height + spacing;
    }

    // 返回按原始顺序排列的节点
    const nodeMap = new Map(alignedNodes.map((n) => [n.id, n]));
    return nodes.map((n) => nodeMap.get(n.id) || n);
  }
}

/**
 * 默认对齐辅助实例
 */
let defaultAlignmentGuides: AlignmentGuides | null = null;

/**
 * 获取默认对齐辅助实例
 */
export function getAlignmentGuides(): AlignmentGuides {
  if (!defaultAlignmentGuides) {
    defaultAlignmentGuides = new AlignmentGuides();
  }
  return defaultAlignmentGuides;
}

/**
 * 创建新的对齐辅助实例
 */
export function createAlignmentGuides(config?: Partial<AlignmentGuidesConfig>): AlignmentGuides {
  return new AlignmentGuides(config);
}

/**
 * 重置默认对齐辅助实例
 */
export function resetAlignmentGuides(): void {
  defaultAlignmentGuides = null;
}

/**
 * 快捷方法：对齐节点
 */
export function alignNodes(nodes: Node[], alignmentType: AlignmentType): AlignmentResult {
  return getAlignmentGuides().alignNodes(nodes, alignmentType);
}

/**
 * 快捷方法：对齐到网格
 */
export function snapToGrid(node: Node, gridSize?: number): Node {
  return getAlignmentGuides().snapToGrid(node, gridSize);
}

/**
 * 快捷方法：计算参考线
 */
export function calculateGuides(
  nodes: Node[],
  movingNodeId: string,
  options?: AlignmentOptions,
): AlignmentGuide[] {
  return getAlignmentGuides().calculateGuides(nodes, movingNodeId, options);
}

/**
 * 快捷方法：自动对齐
 */
export function autoAlign(nodes: Node[]): Node[] {
  return getAlignmentGuides().autoAlign(nodes);
}

/**
 * 快捷方法：分布节点
 */
export function distributeNodes(nodes: Node[], options: DistributionOptions): Node[] {
  return getAlignmentGuides().distributeNodes(nodes, options);
}

export default AlignmentGuides;
