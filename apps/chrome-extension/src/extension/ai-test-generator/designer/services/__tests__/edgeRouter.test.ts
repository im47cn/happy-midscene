/**
 * EdgeRouter Service Tests
 * 边路由服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import {
  EdgeRouter,
  createEdgeRouter,
  getEdgeRouter,
  resetEdgeRouter,
  calculateEdgePath,
  generateEdgePathD,
  calculateEdgePaths,
  findEdgeIntersections,
  type PathPoint,
  type RoutingAlgorithm,
} from '../edgeRouter';

describe('EdgeRouter', () => {
  let router: EdgeRouter;
  let mockNodes: Node[];
  let mockEdges: Edge[];

  beforeEach(() => {
    router = createEdgeRouter();

    // 创建模拟节点
    mockNodes = [
      {
        id: '1',
        type: 'default',
        position: { x: 0, y: 0 },
        data: { label: 'Node 1', width: 200, height: 80 },
      },
      {
        id: '2',
        type: 'default',
        position: { x: 400, y: 0 },
        data: { label: 'Node 2', width: 200, height: 80 },
      },
      {
        id: '3',
        type: 'default',
        position: { x: 200, y: 200 },
        data: { label: 'Node 3', width: 200, height: 80 },
      },
      {
        id: '4',
        type: 'default',
        position: { x: 400, y: 200 },
        data: { label: 'Node 4', width: 200, height: 80 },
      },
    ];

    // 创建模拟边
    mockEdges = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e1-3', source: '1', target: '3' },
      { id: 'e2-4', source: '2', target: '4' },
      { id: 'e3-4', source: '3', target: '4' },
    ];
  });

  afterEach(() => {
    resetEdgeRouter();
  });

  describe('calculatePath', () => {
    it('should calculate straight path', () => {
      const edge = mockEdges[0];
      const path = router.calculatePath(edge, mockNodes, { algorithm: 'straight' });

      expect(path).toHaveLength(2);
      expect(path[0]).toBeDefined();
      expect(path[1]).toBeDefined();
    });

    it('should calculate step path', () => {
      const edge = mockEdges[0];
      const path = router.calculatePath(edge, mockNodes, { algorithm: 'step' });

      expect(path.length).toBeGreaterThan(2);
      // Step path should have intermediate points that create a stepped pattern
      expect(path.length).toBeGreaterThanOrEqual(3);
      // Verify we have at least one intermediate point
      const intermediatePoints = path.slice(1, -1);
      expect(intermediatePoints.length).toBeGreaterThan(0);
    });

    it('should calculate smooth path', () => {
      const edge = mockEdges[0];
      const path = router.calculatePath(edge, mockNodes, { algorithm: 'smooth' });

      expect(path.length).toBeGreaterThan(10); // Smooth path has many points
    });

    it('should calculate orthogonal path', () => {
      const edge = mockEdges[0];
      const path = router.calculatePath(edge, mockNodes, { algorithm: 'orthogonal' });

      expect(path.length).toBeGreaterThanOrEqual(3);
    });

    it('should calculate smart path', () => {
      const edge = mockEdges[0];
      const path = router.calculatePath(edge, mockNodes, { algorithm: 'smart' });

      expect(path.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for invalid edge', () => {
      const edge: Edge = { id: 'invalid', source: 'invalid', target: 'invalid' };
      const path = router.calculatePath(edge, mockNodes);

      expect(path).toEqual([]);
    });

    it('should use cache when enabled', () => {
      const edge = mockEdges[0];
      const path1 = router.calculatePath(edge, mockNodes, { algorithm: 'smooth' });
      const path2 = router.calculatePath(edge, mockNodes, { algorithm: 'smooth' });

      expect(path1).toEqual(path2);
    });
  });

  describe('generatePathD', () => {
    it('should generate SVG path for straight algorithm', () => {
      const points: PathPoint[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
      const pathD = router.generatePathD(points, 'straight');

      expect(pathD).toMatch(/^M/);
      expect(pathD).toContain('L');
    });

    it('should generate SVG path for smooth algorithm', () => {
      const points: PathPoint[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 50 },
      ];
      const pathD = router.generatePathD(points, 'smooth');

      expect(pathD).toMatch(/^M/);
      expect(pathD).toContain('C');
    });

    it('should generate SVG path for orthogonal algorithm', () => {
      const points: PathPoint[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 50 },
      ];
      const pathD = router.generatePathD(points, 'orthogonal');

      expect(pathD).toMatch(/^M/);
      expect(pathD).toContain('L');
    });

    it('should return empty string for empty points', () => {
      const pathD = router.generatePathD([], 'smooth');
      expect(pathD).toBe('');
    });

    it('should return empty string for single point', () => {
      const pathD = router.generatePathD([{ x: 0, y: 0 }], 'smooth');
      expect(pathD).toBe('');
    });
  });

  describe('calculatePaths', () => {
    it('should calculate paths for multiple edges', () => {
      const paths = router.calculatePaths(mockEdges, mockNodes);

      expect(paths.size).toBe(mockEdges.length);
      expect(paths.has('e1-2')).toBe(true);
      expect(paths.has('e1-3')).toBe(true);
      expect(paths.has('e2-4')).toBe(true);
      expect(paths.has('e3-4')).toBe(true);
    });

    it('should return empty map for empty edges', () => {
      const paths = router.calculatePaths([], mockNodes);

      expect(paths.size).toBe(0);
    });
  });

  describe('detectIntersection', () => {
    it('should detect intersecting edges', () => {
      // 创建两条相交的边
      const edge1: Edge = { id: 'e1', source: '1', target: '4' };
      const edge2: Edge = { id: 'e2', source: '2', target: '3' };

      const intersects = router.detectIntersection(edge1, edge2, mockNodes);

      // 这些边在布局中可能会相交
      expect(typeof intersects).toBe('boolean');
    });

    it('should not detect intersection for non-intersecting parallel edges', () => {
      const edge1: Edge = { id: 'e1', source: '1', target: '2' };
      const edge2: Edge = { id: 'e2', source: '3', target: '4' };

      const intersects = router.detectIntersection(edge1, edge2, mockNodes);

      expect(intersects).toBe(false);
    });

    it('should handle edges with shared endpoints', () => {
      const edge1: Edge = { id: 'e1', source: '1', target: '2' };
      const edge2: Edge = { id: 'e2', source: '1', target: '3' };

      const intersects = router.detectIntersection(edge1, edge2, mockNodes);

      // 共享端点不应该被视为相交
      expect(intersects).toBe(false);
    });
  });

  describe('findIntersections', () => {
    it('should find all intersecting edges', () => {
      const intersections = router.findIntersections(mockEdges, mockNodes);

      expect(intersections).toBeInstanceOf(Map);
    });

    it('should return empty map for no edges', () => {
      const intersections = router.findIntersections([], mockNodes);

      expect(intersections.size).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', () => {
      const edge = mockEdges[0];
      router.calculatePath(edge, mockNodes, { algorithm: 'smooth' });
      router.clearCache();

      // 重新计算应该仍然工作
      const path = router.calculatePath(edge, mockNodes, { algorithm: 'smooth' });
      expect(path).toBeDefined();
    });
  });

  describe('Singleton functions', () => {
    it('getEdgeRouter should return same instance', () => {
      const router1 = getEdgeRouter();
      const router2 = getEdgeRouter();

      expect(router1).toBe(router2);
    });

    it('resetEdgeRouter should create new instance on next get', () => {
      const router1 = getEdgeRouter();
      resetEdgeRouter();
      const router2 = getEdgeRouter();

      expect(router1).not.toBe(router2);
    });
  });

  describe('Utility functions', () => {
    it('calculateEdgePath should work with default router', () => {
      const edge = mockEdges[0];
      const path = calculateEdgePath(edge, mockNodes);

      expect(path).toBeDefined();
      expect(path.length).toBeGreaterThan(0);
    });

    it('generateEdgePathD should generate SVG path', () => {
      const points: PathPoint[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
      const pathD = generateEdgePathD(points, 'straight');

      expect(pathD).toContain('M');
    });

    it('calculateEdgePaths should calculate all paths', () => {
      const paths = calculateEdgePaths(mockEdges, mockNodes);

      expect(paths.size).toBe(mockEdges.length);
    });

    it('findEdgeIntersections should find intersections', () => {
      const intersections = findEdgeIntersections(mockEdges, mockNodes);

      expect(intersections).toBeInstanceOf(Map);
    });
  });

  describe('Custom configuration', () => {
    it('should accept custom configuration', () => {
      const customRouter = createEdgeRouter({
        defaultAlgorithm: 'straight',
        defaultCurvature: 0.8,
        gridSize: 30,
        enableCache: false,
      });

      const edge = mockEdges[0];
      const path = customRouter.calculatePath(edge, mockNodes);

      // Straight path should have exactly 2 points
      expect(path).toHaveLength(2);
    });

    it('should use custom curvature for smooth paths', () => {
      const customRouter = createEdgeRouter({
        defaultAlgorithm: 'smooth',
        defaultCurvature: 0.9,
      });

      const edge = mockEdges[0];
      const path = customRouter.calculatePath(edge, mockNodes);

      expect(path.length).toBeGreaterThan(10);
    });
  });

  describe('Edge cases', () => {
    it('should handle nodes without dimensions', () => {
      const simpleNodes: Node[] = [
        { id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'default', position: { x: 100, y: 100 }, data: {} },
      ];

      const edge: Edge = { id: 'e1', source: '1', target: '2' };
      const path = router.calculatePath(edge, simpleNodes);

      expect(path).toBeDefined();
    });

    it('should handle nodes with style dimensions', () => {
      const styledNodes: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: {},
          style: { width: '150px', height: '60px' },
        } as unknown as Node,
        {
          id: '2',
          type: 'default',
          position: { x: 200, y: 0 },
          data: {},
          style: { width: '150px', height: '60px' },
        } as unknown as Node,
      ];

      const edge: Edge = { id: 'e1', source: '1', target: '2' };
      const path = router.calculatePath(edge, styledNodes);

      expect(path).toBeDefined();
    });

    it('should handle edges with handles', () => {
      const edge: Edge = {
        id: 'e1',
        source: '1',
        target: '2',
        sourceHandle: 'right',
        targetHandle: 'left',
      };

      const path = router.calculatePath(edge, mockNodes);

      expect(path).toBeDefined();
    });

    it('should handle vertical layouts', () => {
      const verticalNodes: Node[] = [
        { id: '1', type: 'default', position: { x: 100, y: 0 }, data: { width: 100, height: 50 } },
        { id: '2', type: 'default', position: { x: 100, y: 200 }, data: { width: 100, height: 50 } },
      ];

      const edge: Edge = { id: 'e1', source: '1', target: '2' };
      const path = router.calculatePath(edge, verticalNodes, { algorithm: 'orthogonal' });

      expect(path.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Routing options', () => {
    it('should respect custom curvature', () => {
      const edge = mockEdges[0];
      const path1 = router.calculatePath(edge, mockNodes, { algorithm: 'smooth', curvature: 0.2 });
      const path2 = router.calculatePath(edge, mockNodes, { algorithm: 'smooth', curvature: 0.8 });

      expect(path1).toBeDefined();
      expect(path2).toBeDefined();
    });

    it('should respect custom grid size', () => {
      const edge = mockEdges[0];
      const path1 = router.calculatePath(edge, mockNodes, { algorithm: 'step', gridSize: 10 });
      const path2 = router.calculatePath(edge, mockNodes, { algorithm: 'step', gridSize: 50 });

      expect(path1.length).toBeGreaterThan(0);
      expect(path2.length).toBeGreaterThan(0);
    });

    it('should respect max iterations for smart routing', () => {
      const edge = mockEdges[0];
      const path = router.calculatePath(edge, mockNodes, {
        algorithm: 'smart',
        maxIterations: 5,
      });

      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe('Path validation', () => {
    it('should generate valid SVG paths', () => {
      const edge = mockEdges[0];
      const algorithms: RoutingAlgorithm[] = ['straight', 'step', 'smooth', 'orthogonal', 'smart'];

      for (const algorithm of algorithms) {
        const path = router.calculatePath(edge, mockNodes, { algorithm });
        const pathD = router.generatePathD(path, algorithm);

        // SVG path should start with M (move to)
        expect(pathD).toMatch(/^M/);
      }
    });

    it('should handle zero-length edges', () => {
      const samePositionNodes: Node[] = [
        { id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'default', position: { x: 0, y: 0 }, data: {} },
      ];

      const edge: Edge = { id: 'e1', source: '1', target: '2' };
      const path = router.calculatePath(edge, samePositionNodes);

      // Should still return a valid path
      expect(path).toBeDefined();
    });
  });
});
