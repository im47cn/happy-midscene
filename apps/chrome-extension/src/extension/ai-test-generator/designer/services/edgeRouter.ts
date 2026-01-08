/**
 * Edge Router Service
 * 边路由服务 - 智能路由算法，避免连线交叉，提供平滑曲线
 */

import type { Edge, Node } from '@xyflow/react';

/**
 * 路由算法类型
 */
export type RoutingAlgorithm = 'straight' | 'step' | 'smooth' | 'orthogonal' | 'smart';

/**
 * 边路径点
 */
export interface PathPoint {
  x: number;
  y: number;
}

/**
 * 路由选项
 */
export interface RoutingOptions {
  /** 算法类型 */
  algorithm?: RoutingAlgorithm;
  /** 曲线平滑度 (0-1, 仅对 smooth 算法有效) */
  curvature?: number;
  /** 正交路由的网格大小 */
  gridSize?: number;
  /** 避免其他边的最小距离 */
  padding?: number;
  /** 最大迭代次数 (用于 smart 算法) */
  maxIterations?: number;
}

/**
 * 边路由器配置
 */
export interface EdgeRouterConfig {
  /** 默认路由算法 */
  defaultAlgorithm: RoutingAlgorithm;
  /** 默认曲线平滑度 */
  defaultCurvature: number;
  /** 网格大小 */
  gridSize: number;
  /** 启用路由缓存 */
  enableCache: boolean;
}

/**
 * 边路由器
 */
export class EdgeRouter {
  private config: EdgeRouterConfig;
  private cache: Map<string, PathPoint[]> = new Map();

  constructor(config?: Partial<EdgeRouterConfig>) {
    this.config = {
      defaultAlgorithm: 'smooth',
      defaultCurvature: 0.5,
      gridSize: 20,
      enableCache: true,
      ...config,
    };
  }

  /**
   * 计算边的路径
   */
  calculatePath(
    edge: Edge,
    nodes: Node[],
    options?: RoutingOptions,
  ): PathPoint[] {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode) {
      return [];
    }

    const algorithm = options?.algorithm || this.config.defaultAlgorithm;

    // 检查缓存
    if (this.config.enableCache) {
      const cacheKey = this.getCacheKey(edge, algorithm);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    let path: PathPoint[];

    // 获取源点和目标点
    const sourcePoint = this.getEndpoint(sourceNode, edge.sourceHandle);
    const targetPoint = this.getEndpoint(targetNode, edge.targetHandle);

    switch (algorithm) {
      case 'straight':
        path = this.calculateStraightPath(sourcePoint, targetPoint);
        break;
      case 'step':
        path = this.calculateStepPath(sourcePoint, targetPoint, options?.gridSize || this.config.gridSize);
        break;
      case 'smooth':
        path = this.calculateSmoothPath(
          sourcePoint,
          targetPoint,
          options?.curvature ?? this.config.defaultCurvature,
        );
        break;
      case 'orthogonal':
        path = this.calculateOrthogonalPath(
          sourcePoint,
          targetPoint,
          options?.gridSize || this.config.gridSize,
        );
        break;
      case 'smart':
        path = this.calculateSmartPath(
          sourcePoint,
          targetPoint,
          nodes,
          edge,
          options,
        );
        break;
      default:
        path = this.calculateSmoothPath(sourcePoint, targetPoint);
    }

    // 缓存结果
    if (this.config.enableCache) {
      const cacheKey = this.getCacheKey(edge, algorithm);
      this.cache.set(cacheKey, path);
    }

    return path;
  }

  /**
   * 生成边的路径字符串 (用于 SVG path d 属性)
   */
  generatePathD(points: PathPoint[], algorithm: RoutingAlgorithm = 'smooth'): string {
    if (points.length < 2) {
      return '';
    }

    switch (algorithm) {
      case 'straight':
        return this.generateStraightPathD(points);
      case 'step':
        return this.generateStepPathD(points);
      case 'smooth':
        return this.generateSmoothPathD(points);
      case 'orthogonal':
        return this.generateOrthogonalPathD(points);
      case 'smart':
        return this.generateSmoothPathD(points);
      default:
        return this.generateSmoothPathD(points);
    }
  }

  /**
   * 批量计算边的路径
   */
  calculatePaths(
    edges: Edge[],
    nodes: Node[],
    options?: RoutingOptions,
  ): Map<string, PathPoint[]> {
    const paths = new Map<string, PathPoint[]>();

    for (const edge of edges) {
      const path = this.calculatePath(edge, nodes, options);
      paths.set(edge.id, path);
    }

    return paths;
  }

  /**
   * 检测边是否相交
   */
  detectIntersection(edge1: Edge, edge2: Edge, nodes: Node[]): boolean {
    const path1 = this.calculatePath(edge1, nodes);
    const path2 = this.calculatePath(edge2, nodes);

    if (path1.length < 2 || path2.length < 2) {
      return false;
    }

    // 检查路径的每个线段是否相交
    for (let i = 0; i < path1.length - 1; i++) {
      for (let j = 0; j < path2.length - 1; j++) {
        if (this.segmentsIntersect(path1[i], path1[i + 1], path2[j], path2[j + 1])) {
          // 忽略共享端点的情况
          if (this.isSharedEndpoint(edge1, edge2, path1[i], path2[j]) ||
              this.isSharedEndpoint(edge1, edge2, path1[i], path2[j + 1]) ||
              this.isSharedEndpoint(edge1, edge2, path1[i + 1], path2[j]) ||
              this.isSharedEndpoint(edge1, edge2, path1[i + 1], path2[j + 1])) {
            continue;
          }
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 计算边的所有交点
   */
  findIntersections(edges: Edge[], nodes: Node[]): Map<string, string[]> {
    const intersections = new Map<string, string[]>();

    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        if (this.detectIntersection(edges[i], edges[j], nodes)) {
          const edge1Intersections = intersections.get(edges[i].id) || [];
          const edge2Intersections = intersections.get(edges[j].id) || [];

          edge1Intersections.push(edges[j].id);
          edge2Intersections.push(edges[i].id);

          intersections.set(edges[i].id, edge1Intersections);
          intersections.set(edges[j].id, edge2Intersections);
        }
      }
    }

    return intersections;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取端点位置
   */
  private getEndpoint(node: Node, handleId?: string | null): PathPoint {
    const position = node.position;
    const width = (node.data as any)?.width || node.style?.width || 200;
    const height = (node.data as any)?.height || node.style?.height || 80;

    // 默认从右侧输出，从左侧输入
    if (handleId) {
      // 根据 handle ID 确定位置
      if (handleId.includes('top')) {
        return { x: position.x + width / 2, y: position.y };
      } else if (handleId.includes('bottom')) {
        return { x: position.x + width / 2, y: position.y + height };
      } else if (handleId.includes('left')) {
        return { x: position.x, y: position.y + height / 2 };
      } else if (handleId.includes('right')) {
        return { x: position.x + width, y: position.y + height / 2 };
      }
    }

    // 默认：源节点从右侧输出，目标节点从左侧输入
    return { x: position.x + width / 2, y: position.y + height / 2 };
  }

  /**
   * 直线路径
   */
  private calculateStraightPath(from: PathPoint, to: PathPoint): PathPoint[] {
    return [from, to];
  }

  /**
   * 阶梯路径
   */
  private calculateStepPath(from: PathPoint, to: PathPoint, gridSize: number): PathPoint[] {
    const points: PathPoint[] = [from];

    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // 先水平移动，再垂直移动
    const midX = from.x + Math.round(dx / gridSize) * gridSize;
    points.push({ x: midX, y: from.y });
    points.push({ x: midX, y: to.y });
    points.push(to);

    return points;
  }

  /**
   * 平滑曲线路径 (贝塞尔曲线)
   */
  private calculateSmoothPath(from: PathPoint, to: PathPoint, curvature = 0.5): PathPoint[] {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // 控制点偏移量
    const controlOffset = Math.max(Math.abs(dx), Math.abs(dy)) * curvature;

    // 计算控制点
    const control1: PathPoint = {
      x: from.x + Math.max(dx, 0) * (1 - curvature) + controlOffset,
      y: from.y,
    };
    const control2: PathPoint = {
      x: to.x - Math.max(dx, 0) * (1 - curvature) - controlOffset,
      y: to.y,
    };

    // 生成曲线路径点
    return this.generateBezierPoints(from, control1, control2, to, 20);
  }

  /**
   * 正交路径
   */
  private calculateOrthogonalPath(from: PathPoint, to: PathPoint, gridSize: number): PathPoint[] {
    const points: PathPoint[] = [from];

    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // 对齐到网格
    const gridX = Math.round(dx / gridSize) * gridSize;
    const gridY = Math.round(dy / gridSize) * gridSize;

    // 选择主方向
    if (Math.abs(dx) > Math.abs(dy)) {
      // 主要水平移动
      const midX = from.x + gridX;
      points.push({ x: midX, y: from.y });
      points.push({ x: midX, y: to.y });
    } else {
      // 主要垂直移动
      const midY = from.y + gridY;
      points.push({ x: from.x, y: midY });
      points.push({ x: to.x, y: midY });
    }

    points.push(to);
    return points;
  }

  /**
   * 智能路径 - 避免节点和其他边
   */
  private calculateSmartPath(
    from: PathPoint,
    to: PathPoint,
    nodes: Node[],
    edge: Edge,
    options?: RoutingOptions,
  ): PathPoint[] {
    // 简化版：先使用正交路径，然后检查是否与节点相交
    const gridSize = options?.gridSize || this.config.gridSize;
    let path = this.calculateOrthogonalPath(from, to, gridSize);

    // 检查路径是否穿过节点
    const maxIterations = options?.maxIterations || 10;
    for (let i = 0; i < maxIterations; i++) {
      const intersectingNode = this.findIntersectingNode(path, nodes, [edge.source, edge.target]);

      if (!intersectingNode) {
        break;
      }

      // 调整路径以避开节点
      path = this.adjustPathToAvoidNode(path, intersectingNode, gridSize);
    }

    return path;
  }

  /**
   * 查找与路径相交的节点
   */
  private findIntersectingNode(path: PathPoint[], nodes: Node[], excludeIds: string[]): Node | null {
    for (const node of nodes) {
      if (excludeIds.includes(node.id)) {
        continue;
      }

      const position = node.position;
      const width = (node.data as any)?.width || node.style?.width || 200;
      const height = (node.data as any)?.height || node.style?.height || 80;

      const bounds = {
        x: position.x,
        y: position.y,
        width,
        height,
      };

      for (let i = 0; i < path.length - 1; i++) {
        if (this.segmentIntersectsRect(path[i], path[i + 1], bounds)) {
          return node;
        }
      }
    }

    return null;
  }

  /**
   * 调整路径以避开节点
   */
  private adjustPathToAvoidNode(path: PathPoint[], node: Node, gridSize: number): PathPoint[] {
    const position = node.position;
    const width = (node.data as any)?.width || node.style?.width || 200;
    const height = (node.data as any)?.height || node.style?.height || 80;

    // 找到节点中心点
    const nodeCenter = {
      x: position.x + width / 2,
      y: position.y + height / 2,
    };

    // 在路径中插入绕行点
    const newPath: PathPoint[] = [path[0]];

    for (let i = 1; i < path.length; i++) {
      const prev = newPath[newPath.length - 1];
      const curr = path[i];

      // 检查线段是否穿过节点
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;

      if (midX > position.x && midX < position.x + width &&
          midY > position.y && midY < position.y + height) {
        // 需要绕行，选择绕行方向（上、下、左、右）
        const goAround = this.calculateAroundPoint(prev, curr, position, width, height, gridSize);
        newPath.push(goAround);
      }

      newPath.push(curr);
    }

    return newPath;
  }

  /**
   * 计算绕行点
   */
  private calculateAroundPoint(
    from: PathPoint,
    to: PathPoint,
    nodePos: { x: number; y: number },
    nodeWidth: number,
    nodeHeight: number,
    gridSize: number,
  ): PathPoint {
    // 选择绕行方向：优先选择距离较短的方向
    const distances = [
      { point: { x: from.x, y: nodePos.y - gridSize }, dir: 'top' },
      { point: { x: from.x, y: nodePos.y + nodeHeight + gridSize }, dir: 'bottom' },
      { point: { x: nodePos.x - gridSize, y: from.y }, dir: 'left' },
      { point: { x: nodePos.x + nodeWidth + gridSize, y: from.y }, dir: 'right' },
    ];

    // 找到最短路径
    let bestPoint = distances[0].point;
    let minDist = this.distance(from, distances[0].point) + this.distance(distances[0].point, to);

    for (const { point } of distances) {
      const dist = this.distance(from, point) + this.distance(point, to);
      if (dist < minDist) {
        minDist = dist;
        bestPoint = point;
      }
    }

    return bestPoint;
  }

  /**
   * 生成贝塞尔曲线上的点
   */
  private generateBezierPoints(
    p0: PathPoint,
    p1: PathPoint,
    p2: PathPoint,
    p3: PathPoint,
    numPoints: number,
  ): PathPoint[] {
    const points: PathPoint[] = [];

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const x = this.cubicBezier(p0.x, p1.x, p2.x, p3.x, t);
      const y = this.cubicBezier(p0.y, p1.y, p2.y, p3.y, t);
      points.push({ x, y });
    }

    return points;
  }

  /**
   * 三次贝塞尔曲线计算
   */
  private cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }

  /**
   * 生成直线路径的 SVG path d
   */
  private generateStraightPathD(points: PathPoint[]): string {
    if (points.length < 2) return '';
    const [start, ...rest] = points;
    let d = `M ${start.x} ${start.y}`;
    for (const point of rest) {
      d += ` L ${point.x} ${point.y}`;
    }
    return d;
  }

  /**
   * 生成阶梯路径的 SVG path d
   */
  private generateStepPathD(points: PathPoint[]): string {
    return this.generateStraightPathD(points);
  }

  /**
   * 生成平滑曲线路径的 SVG path d
   */
  private generateSmoothPathD(points: PathPoint[]): string {
    if (points.length < 2) return '';
    const [start, ...rest] = points;
    let d = `M ${start.x} ${start.y}`;

    // 使用简化的平滑算法
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      if (next) {
        // 使用控制点创建平滑曲线
        const cp1x = prev.x + (curr.x - prev.x) / 2;
        const cp1y = prev.y + (curr.y - prev.y) / 2;
        const cp2x = curr.x - (next.x - curr.x) / 2;
        const cp2y = curr.y - (next.y - curr.y) / 2;
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      } else {
        d += ` L ${curr.x} ${curr.y}`;
      }
    }

    return d;
  }

  /**
   * 生成正交路径的 SVG path d
   */
  private generateOrthogonalPathD(points: PathPoint[]): string {
    return this.generateStraightPathD(points);
  }

  /**
   * 检查两条线段是否相交
   */
  private segmentsIntersect(
    p1: PathPoint,
    p2: PathPoint,
    p3: PathPoint,
    p4: PathPoint,
  ): boolean {
    const ccw = (a: PathPoint, b: PathPoint, c: PathPoint) => {
      return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    };

    return (
      ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
      ccw(p1, p2, p3) !== ccw(p1, p2, p4)
    );
  }

  /**
   * 检查线段是否与矩形相交
   */
  private segmentIntersectsRect(
    p1: PathPoint,
    p2: PathPoint,
    rect: { x: number; y: number; width: number; height: number },
  ): boolean {
    // 检查线段端点是否在矩形内
    if (this.pointInRect(p1, rect) || this.pointInRect(p2, rect)) {
      return true;
    }

    // 检查线段是否与矩形边相交
    const edges = [
      [{ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y }],
      [{ x: rect.x + rect.width, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height }],
      [{ x: rect.x + rect.width, y: rect.y + rect.height }, { x: rect.x, y: rect.y + rect.height }],
      [{ x: rect.x, y: rect.y + rect.height }, { x: rect.x, y: rect.y }],
    ];

    for (const [edge1, edge2] of edges) {
      if (this.segmentsIntersect(p1, p2, edge1 as PathPoint, edge2 as PathPoint)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查点是否在矩形内
   */
  private pointInRect(point: PathPoint, rect: { x: number; y: number; width: number; height: number }): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  /**
   * 检查是否为共享端点
   */
  private isSharedEndpoint(edge1: Edge, edge2: Edge, point1: PathPoint, point2: PathPoint): boolean {
    const threshold = 5;
    return (
      (edge1.source === edge2.source || edge1.source === edge2.target ||
       edge1.target === edge2.source || edge1.target === edge2.target) &&
      Math.abs(point1.x - point2.x) < threshold &&
      Math.abs(point1.y - point2.y) < threshold
    );
  }

  /**
   * 计算两点之间的距离
   */
  private distance(p1: PathPoint, p2: PathPoint): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(edge: Edge, algorithm: RoutingAlgorithm): string {
    return `${edge.source}-${edge.target}-${edge.sourceHandle || ''}-${edge.targetHandle || ''}-${algorithm}`;
  }
}

/**
 * 默认路由器实例
 */
let defaultRouter: EdgeRouter | null = null;

/**
 * 获取默认路由器实例
 */
export function getEdgeRouter(): EdgeRouter {
  if (!defaultRouter) {
    defaultRouter = new EdgeRouter();
  }
  return defaultRouter;
}

/**
 * 创建新的路由器实例
 */
export function createEdgeRouter(config?: Partial<EdgeRouterConfig>): EdgeRouter {
  return new EdgeRouter(config);
}

/**
 * 重置默认路由器
 */
export function resetEdgeRouter(): void {
  defaultRouter = null;
}

/**
 * 快捷方法：计算单个边的路径
 */
export function calculateEdgePath(
  edge: Edge,
  nodes: Node[],
  options?: RoutingOptions,
): PathPoint[] {
  return getEdgeRouter().calculatePath(edge, nodes, options);
}

/**
 * 快捷方法：生成 SVG path d 字符串
 */
export function generateEdgePathD(points: PathPoint[], algorithm?: RoutingAlgorithm): string {
  return getEdgeRouter().generatePathD(points, algorithm);
}

/**
 * 快捷方法：批量计算边路径
 */
export function calculateEdgePaths(
  edges: Edge[],
  nodes: Node[],
  options?: RoutingOptions,
): Map<string, PathPoint[]> {
  return getEdgeRouter().calculatePaths(edges, nodes, options);
}

/**
 * 快捷方法：查找边的交点
 */
export function findEdgeIntersections(edges: Edge[], nodes: Node[]): Map<string, string[]> {
  return getEdgeRouter().findIntersections(edges, nodes);
}

export default EdgeRouter;
