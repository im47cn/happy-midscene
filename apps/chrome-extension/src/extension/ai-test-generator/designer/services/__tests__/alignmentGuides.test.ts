/**
 * AlignmentGuides Service Tests
 * 对齐辅助服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  AlignmentGuides,
  createAlignmentGuides,
  getAlignmentGuides,
  resetAlignmentGuides,
  calculateGuides,
  snapToGrid,
  alignNodes,
  autoAlign,
  distributeNodes,
  type AlignmentType,
  type AlignmentGuide,
} from '../alignmentGuides';

describe('AlignmentGuides', () => {
  let guides: AlignmentGuides;
  let mockNodes: Node[];

  beforeEach(() => {
    guides = createAlignmentGuides();

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
  });

  afterEach(() => {
    resetAlignmentGuides();
  });

  describe('calculateGuides', () => {
    it('should return empty array for non-existent moving node', () => {
      const result = guides.calculateGuides(mockNodes, 'non-existent');
      expect(result).toEqual([]);
    });

    it('should detect horizontal top alignment', () => {
      // 移动节点3使其与节点1顶部对齐
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 100, y: 5 }, // 接近0，在吸附距离内
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const result = guides.calculateGuides(nodes, '5', { snapDistance: 10 });

      // 应该检测到顶部对齐
      const topGuides = result.filter((g) => g.orientation === 'horizontal' && g.type === 'edge');
      expect(topGuides.length).toBeGreaterThan(0);
    });

    it('should detect horizontal bottom alignment', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 100, y: -5 }, // 底部接近0
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const result = guides.calculateGuides(nodes, '5', { snapDistance: 10 });

      // 应该检测到底部对齐
      const bottomGuides = result.filter((g) => g.orientation === 'horizontal' && g.type === 'edge');
      expect(bottomGuides.length).toBeGreaterThan(0);
    });

    it('should detect horizontal middle alignment', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 100, y: 2 }, // 中间接近40
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const result = guides.calculateGuides(nodes, '5', { snapDistance: 10 });

      // 应该检测到中间对齐
      const centerGuides = result.filter((g) => g.orientation === 'horizontal' && g.type === 'center');
      expect(centerGuides.length).toBeGreaterThan(0);
    });

    it('should detect vertical left alignment', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 5, y: 100 }, // 接近0，在吸附距离内
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const result = guides.calculateGuides(nodes, '5', { snapDistance: 10 });

      // 应该检测到左侧对齐
      const leftGuides = result.filter((g) => g.orientation === 'vertical' && g.type === 'edge');
      expect(leftGuides.length).toBeGreaterThan(0);
    });

    it('should detect vertical right alignment', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 195, y: 100 }, // 右侧接近200
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const result = guides.calculateGuides(nodes, '5', { snapDistance: 10 });

      // 应该检测到右侧对齐
      const rightGuides = result.filter((g) => g.orientation === 'vertical' && g.type === 'edge');
      expect(rightGuides.length).toBeGreaterThan(0);
    });

    it('should detect vertical center alignment', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 90, y: 100 }, // 中心在190，接近参考节点1的中心100
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const result = guides.calculateGuides(nodes, '5', { snapDistance: 10 });

      // 应该检测到中心对齐 (|190 - 100| = 90 > 10, 不对齐)
      // 使用更接近的位置测试中心对齐
      const nodes2 = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 8, y: 100 }, // 中心在108，接近参考节点1的中心100 (差8像素)
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const result2 = guides.calculateGuides(nodes2, '5', { snapDistance: 10 });
      const centerGuides = result2.filter((g) => g.orientation === 'vertical' && g.type === 'center');
      expect(centerGuides.length).toBeGreaterThan(0);
    });

    it('should detect grid alignment when enabled', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 18, y: 18 }, // 接近网格线(20, 20)
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const result = guides.calculateGuides(nodes, '5', { enableSnapToGrid: true, gridSize: 20 });

      // 应该检测到网格对齐
      const gridGuides = result.filter((g) => g.type === 'spacing');
      expect(gridGuides.length).toBeGreaterThan(0);
    });

    it('should not detect grid alignment when disabled', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 18, y: 18 },
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const result = guides.calculateGuides(nodes, '5', { enableSnapToGrid: false });

      const gridGuides = result.filter((g) => g.type === 'spacing');
      expect(gridGuides.length).toBe(0);
    });

    it('should use custom guide color', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 5, y: 100 },
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const result = guides.calculateGuides(nodes, '5', { guideColor: '#ff0000', enableSnapToGrid: false });

      // 节点对齐参考线应该使用自定义颜色 (不包括网格参考线)
      const nodeGuides = result.filter((g) => g.type !== 'spacing');
      nodeGuides.forEach((guide) => {
        expect(guide.color).toBe('#ff0000');
      });
    });

    it('should not detect alignment beyond snap distance', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 50, y: 50 }, // 远离任何对齐
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const result = guides.calculateGuides(nodes, '5', { snapDistance: 5 });

      // 应该没有参考线
      expect(result.length).toBe(0);
    });
  });

  describe('snapToGrid', () => {
    it('should snap node position to grid', () => {
      const node: Node = {
        id: '1',
        type: 'default',
        position: { x: 25, y: 35 },
        data: { label: 'Node 1' },
      };

      const snapped = guides.snapToGrid(node, 20);

      expect(snapped.position.x).toBe(20); // 25 -> 20
      expect(snapped.position.y).toBe(40); // 35 -> 40
    });

    it('should keep node already on grid', () => {
      const node: Node = {
        id: '1',
        type: 'default',
        position: { x: 40, y: 60 },
        data: { label: 'Node 1' },
      };

      const snapped = guides.snapToGrid(node, 20);

      expect(snapped.position.x).toBe(40);
      expect(snapped.position.y).toBe(60);
    });

    it('should use default grid size when not specified', () => {
      const guidesWithDefaultGrid = createAlignmentGuides({ defaultGridSize: 10 });
      const node: Node = {
        id: '1',
        type: 'default',
        position: { x: 14, y: 16 },
        data: { label: 'Node 1' },
      };

      const snapped = guidesWithDefaultGrid.snapToGrid(node);

      expect(snapped.position.x).toBe(10);
      expect(snapped.position.y).toBe(20);
    });

    it('should handle negative positions', () => {
      const node: Node = {
        id: '1',
        type: 'default',
        position: { x: -15, y: -25 },
        data: { label: 'Node 1' },
      };

      const snapped = guides.snapToGrid(node, 20);

      expect(snapped.position.x).toBe(-20);
      expect(snapped.position.y).toBe(-20);
    });
  });

  describe('snapNodesToGrid', () => {
    it('should snap multiple nodes to grid', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 15, y: 25 },
          data: { label: 'Node 1' },
        },
        {
          id: '2',
          type: 'default',
          position: { x: 35, y: 45 },
          data: { label: 'Node 2' },
        },
      ];

      const snapped = guides.snapNodesToGrid(nodes, 20);

      expect(snapped[0].position.x).toBe(20);
      expect(snapped[0].position.y).toBe(20);
      expect(snapped[1].position.x).toBe(40);
      expect(snapped[1].position.y).toBe(40);
    });

    it('should preserve node properties when snapping', () => {
      const node: Node = {
        id: '1',
        type: 'default',
        position: { x: 15, y: 25 },
        data: { label: 'Node 1', customProp: 'value' },
      };

      const snapped = guides.snapToGrid(node, 20);

      expect(snapped.id).toBe('1');
      expect(snapped.type).toBe('default');
      expect(snapped.data.label).toBe('Node 1');
      expect(snapped.data.customProp).toBe('value');
    });
  });

  describe('alignNodes', () => {
    it('should return empty alignments for single node', () => {
      const singleNode: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1' },
        },
      ];

      const result = guides.alignNodes(singleNode, 'left');

      expect(result.nodes).toEqual(singleNode);
      expect(result.alignments).toEqual([]);
    });

    it('should align nodes to left', () => {
      const result = guides.alignNodes(mockNodes, 'left');

      // 所有节点应该有相同的X坐标
      const xPositions = result.nodes.map((n) => n.position.x);
      const uniqueX = new Set(xPositions);
      expect(uniqueX.size).toBe(1);

      // 应该记录对齐操作
      expect(result.alignments.length).toBe(mockNodes.length);
      expect(result.alignments.every((a) => a.type === 'left')).toBe(true);
    });

    it('should align nodes to center', () => {
      const result = guides.alignNodes(mockNodes, 'center');

      // 所有节点中心应该对齐
      const centers = result.nodes.map((n) => {
        const width = (n.data as { width?: number }).width || 200;
        return n.position.x + width / 2;
      });

      const uniqueCenters = new Set(centers.map((c) => Math.round(c)));
      expect(uniqueCenters.size).toBe(1);

      expect(result.alignments.every((a) => a.type === 'center')).toBe(true);
    });

    it('should align nodes to right', () => {
      const result = guides.alignNodes(mockNodes, 'right');

      // 所有节点右边缘应该对齐
      const rightEdges = result.nodes.map((n) => {
        const width = (n.data as { width?: number }).width || 200;
        return n.position.x + width;
      });

      const uniqueRightEdges = new Set(rightEdges.map((r) => Math.round(r)));
      expect(uniqueRightEdges.size).toBe(1);

      expect(result.alignments.every((a) => a.type === 'right')).toBe(true);
    });

    it('should align nodes to top', () => {
      const result = guides.alignNodes(mockNodes, 'top');

      // 所有节点应该有相同的Y坐标
      const yPositions = result.nodes.map((n) => n.position.y);
      const uniqueY = new Set(yPositions);
      expect(uniqueY.size).toBe(1);

      expect(result.alignments.every((a) => a.type === 'top')).toBe(true);
    });

    it('should align nodes to middle', () => {
      const result = guides.alignNodes(mockNodes, 'middle');

      // 所有节点垂直中心应该对齐
      const centers = result.nodes.map((n) => {
        const height = (n.data as { height?: number }).height || 80;
        return n.position.y + height / 2;
      });

      const uniqueCenters = new Set(centers.map((c) => Math.round(c)));
      expect(uniqueCenters.size).toBe(1);

      expect(result.alignments.every((a) => a.type === 'middle')).toBe(true);
    });

    it('should align nodes to bottom', () => {
      const result = guides.alignNodes(mockNodes, 'bottom');

      // 所有节点底部应该对齐
      const bottomEdges = result.nodes.map((n) => {
        const height = (n.data as { height?: number }).height || 80;
        return n.position.y + height;
      });

      const uniqueBottomEdges = new Set(bottomEdges.map((b) => Math.round(b)));
      expect(uniqueBottomEdges.size).toBe(1);

      expect(result.alignments.every((a) => a.type === 'bottom')).toBe(true);
    });

    it('should distribute nodes horizontally', () => {
      const result = guides.alignNodes(mockNodes, 'distribute-h');

      // 分布应该保持Y坐标不变
      expect(result.nodes.every((n) => n.position.y === mockNodes.find((m) => m.id === n.id)?.position.y)).toBe(true);

      // 应该记录分布操作
      expect(result.alignments.every((a) => a.type === 'distribute-h')).toBe(true);
    });

    it('should distribute nodes vertically', () => {
      const result = guides.alignNodes(mockNodes, 'distribute-v');

      // 节点应该按Y坐标排序
      const yPositions = result.nodes.map((n) => n.position.y);
      const sortedY = [...yPositions].sort((a, b) => a - b);
      expect(yPositions).toEqual(sortedY);

      expect(result.alignments.every((a) => a.type === 'distribute-v')).toBe(true);
    });

    it('should track from and to positions in alignments', () => {
      const result = guides.alignNodes(mockNodes, 'left');

      result.alignments.forEach((alignment) => {
        expect(alignment).toHaveProperty('nodeId');
        expect(alignment).toHaveProperty('type');
        expect(alignment).toHaveProperty('from');
        expect(alignment).toHaveProperty('to');
        expect(alignment.from).toHaveProperty('x');
        expect(alignment.from).toHaveProperty('y');
        expect(alignment.to).toHaveProperty('x');
        expect(alignment.to).toHaveProperty('y');
      });
    });
  });

  describe('autoAlign', () => {
    it('should return single node unchanged', () => {
      const singleNode: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1' },
        },
      ];

      const result = guides.autoAlign(singleNode);

      expect(result).toEqual(singleNode);
    });

    it('should align middle for horizontal layout', () => {
      // 水平布局节点
      const horizontalNodes: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1', width: 200, height: 80 },
        },
        {
          id: '2',
          type: 'default',
          position: { x: 300, y: 0 },
          data: { label: 'Node 2', width: 200, height: 80 },
        },
      ];

      const result = guides.autoAlign(horizontalNodes);

      // 应该垂直居中对齐
      const yPositions = result.map((n) => n.position.y);
      const uniqueY = new Set(yPositions);
      expect(uniqueY.size).toBe(1);
    });

    it('should align center for vertical layout', () => {
      // 垂直布局节点
      const verticalNodes: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1', width: 200, height: 80 },
        },
        {
          id: '2',
          type: 'default',
          position: { x: 0, y: 300 },
          data: { label: 'Node 2', width: 200, height: 80 },
        },
      ];

      const result = guides.autoAlign(verticalNodes);

      // 应该水平居中对齐
      const centers = result.map((n) => {
        const width = (n.data as { width?: number }).width || 200;
        return n.position.x + width / 2;
      });

      const uniqueCenters = new Set(centers.map((c) => Math.round(c)));
      expect(uniqueCenters.size).toBe(1);
    });
  });

  describe('distributeNodes', () => {
    it('should return single node unchanged', () => {
      const singleNode: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1' },
        },
      ];

      const result = guides.distributeNodes(singleNode, { direction: 'horizontal' });

      expect(result).toEqual(singleNode);
    });

    it('should distribute nodes horizontally', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1', width: 100, height: 80 },
        },
        {
          id: '2',
          type: 'default',
          position: { x: 100, y: 0 },
          data: { label: 'Node 2', width: 100, height: 80 },
        },
        {
          id: '3',
          type: 'default',
          position: { x: 200, y: 0 },
          data: { label: 'Node 3', width: 100, height: 80 },
        },
      ];

      const result = guides.distributeNodes(nodes, { direction: 'horizontal' });

      // Y坐标应该保持不变
      expect(result.every((n) => n.position.y === 0)).toBe(true);
    });

    it('should distribute nodes vertically', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1', width: 100, height: 80 },
        },
        {
          id: '2',
          type: 'default',
          position: { x: 0, y: 100 },
          data: { label: 'Node 2', width: 100, height: 80 },
        },
        {
          id: '3',
          type: 'default',
          position: { x: 0, y: 200 },
          data: { label: 'Node 3', width: 100, height: 80 },
        },
      ];

      const result = guides.distributeNodes(nodes, { direction: 'vertical' });

      // X坐标应该保持不变
      expect(result.every((n) => n.position.x === 0)).toBe(true);
    });
  });

  describe('getActiveGuides', () => {
    it('should return empty array initially', () => {
      const active = guides.getActiveGuides();
      expect(active).toEqual([]);
    });

    it('should return guides after calculation', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 5, y: 100 },
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      guides.calculateGuides(nodes, '5', { snapDistance: 10 });
      const active = guides.getActiveGuides();

      expect(active.length).toBeGreaterThan(0);
    });
  });

  describe('clearGuides', () => {
    it('should clear active guides', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 5, y: 100 },
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      guides.calculateGuides(nodes, '5', { snapDistance: 10 });
      expect(guides.getActiveGuides().length).toBeGreaterThan(0);

      guides.clearGuides();
      expect(guides.getActiveGuides()).toEqual([]);
    });
  });

  describe('Singleton functions', () => {
    it('getAlignmentGuides should return same instance', () => {
      const guides1 = getAlignmentGuides();
      const guides2 = getAlignmentGuides();

      expect(guides1).toBe(guides2);
    });

    it('resetAlignmentGuides should create new instance on next get', () => {
      const guides1 = getAlignmentGuides();
      resetAlignmentGuides();
      const guides2 = getAlignmentGuides();

      expect(guides1).not.toBe(guides2);
    });
  });

  describe('Utility functions', () => {
    it('calculateGuides should work with default instance', () => {
      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 5, y: 100 },
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const guides = calculateGuides(nodes, '5', { snapDistance: 10 });

      expect(guides).toBeInstanceOf(Array);
    });

    it('snapToGrid should work with default instance', () => {
      const node: Node = {
        id: '1',
        type: 'default',
        position: { x: 25, y: 35 },
        data: { label: 'Node 1' },
      };

      const snapped = snapToGrid(node, 20);

      expect(snapped.position.x).toBe(20);
      expect(snapped.position.y).toBe(40);
    });

    it('alignNodes should work with default instance', () => {
      const result = alignNodes(mockNodes, 'left');

      expect(result.nodes).toBeDefined();
      expect(result.alignments).toBeDefined();
    });

    it('autoAlign should work with default instance', () => {
      const result = autoAlign(mockNodes);

      expect(result).toBeDefined();
      expect(result.length).toBe(mockNodes.length);
    });

    it('distributeNodes should work with default instance', () => {
      const result = distributeNodes(mockNodes, { direction: 'horizontal' });

      expect(result).toBeDefined();
      expect(result.length).toBe(mockNodes.length);
    });
  });

  describe('Custom configuration', () => {
    it('should accept custom grid size', () => {
      const customGuides = createAlignmentGuides({
        defaultGridSize: 50,
      });

      const node: Node = {
        id: '1',
        type: 'default',
        position: { x: 25, y: 75 },
        data: { label: 'Node 1' },
      };

      const snapped = customGuides.snapToGrid(node);

      expect(snapped.position.x).toBe(50); // 25 -> 50
      expect(snapped.position.y).toBe(100); // 75 -> 100
    });

    it('should accept custom snap distance', () => {
      const customGuides = createAlignmentGuides({
        defaultSnapDistance: 5,
        defaultSnapToGrid: false, // 禁用网格对齐
      });

      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 8, y: 100 }, // 8 away from 0
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const guides = customGuides.calculateGuides(nodes, '5');

      // 使用自定义5像素吸附距离，8像素不会触发对齐
      expect(guides.length).toBe(0);
    });

    it('should accept custom guide color', () => {
      const customGuides = createAlignmentGuides({
        guideColor: '#ff5722',
      });

      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 5, y: 100 },
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const guides = customGuides.calculateGuides(nodes, '5', { snapDistance: 10 });

      guides.forEach((guide) => {
        expect(guide.color).toBe('#ff5722');
      });
    });

    it('should accept disabled snap to grid by default', () => {
      const customGuides = createAlignmentGuides({
        defaultSnapToGrid: false,
      });

      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 18, y: 18 },
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const guides = customGuides.calculateGuides(nodes, '5');

      const gridGuides = guides.filter((g) => g.type === 'spacing');
      expect(gridGuides.length).toBe(0);
    });

    it('should accept disabled guides by default', () => {
      const customGuides = createAlignmentGuides({
        defaultGuides: false,
      });

      const nodes = [
        ...mockNodes,
        {
          id: '5',
          type: 'default',
          position: { x: 5, y: 100 },
          data: { label: 'Node 5', width: 200, height: 80 },
        },
      ];

      const guides = customGuides.calculateGuides(nodes, '5', { snapDistance: 10 });

      // 仍然会计算参考线，因为默认配置只是用于选项未指定时
      expect(guides.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle nodes without dimensions', () => {
      const simpleNodes: Node[] = [
        { id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'default', position: { x: 100, y: 100 }, data: {} },
      ];

      const result = guides.alignNodes(simpleNodes, 'left');

      expect(result.nodes).toBeDefined();
      expect(result.nodes.length).toBe(2);
    });

    it('should handle nodes with style dimensions', () => {
      const styledNodes: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: {},
          style: { width: 150, height: 60 },
        } as unknown as Node,
        {
          id: '2',
          type: 'default',
          position: { x: 200, y: 0 },
          data: {},
          style: { width: 150, height: 60 },
        } as unknown as Node,
      ];

      const result = guides.alignNodes(styledNodes, 'left');

      expect(result.nodes).toBeDefined();
      expect(result.nodes.length).toBe(2);
    });

    it('should handle zero-sized nodes', () => {
      const zeroSizeNodes: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { width: 0, height: 0 },
        },
        {
          id: '2',
          type: 'default',
          position: { x: 100, y: 100 },
          data: { width: 0, height: 0 },
        },
      ];

      const result = guides.alignNodes(zeroSizeNodes, 'center');

      expect(result.nodes).toBeDefined();
      expect(result.nodes.length).toBe(2);
    });

    it('should handle negative node positions', () => {
      const negativeNodes: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: -100, y: -50 },
          data: { width: 200, height: 80 },
        },
        {
          id: '2',
          type: 'default',
          position: { x: 100, y: 50 },
          data: { width: 200, height: 80 },
        },
      ];

      const result = guides.alignNodes(negativeNodes, 'left');

      expect(result.nodes).toBeDefined();
      expect(result.nodes.every((n) => n.position.x === -100)).toBe(true);
    });

    it('should handle very large node positions', () => {
      const largeNodes: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 10000, y: 10000 },
          data: { width: 200, height: 80 },
        },
        {
          id: '2',
          type: 'default',
          position: { x: 10500, y: 10050 },
          data: { width: 200, height: 80 },
        },
      ];

      const result = guides.alignNodes(largeNodes, 'left');

      expect(result.nodes).toBeDefined();
      expect(result.nodes.length).toBe(2);
    });

    it('should handle nodes with decimal positions', () => {
      const decimalNodes: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 10.5, y: 20.7 },
          data: { width: 200, height: 80 },
        },
        {
          id: '2',
          type: 'default',
          position: { x: 110.3, y: 120.9 },
          data: { width: 200, height: 80 },
        },
      ];

      const snapped = guides.snapNodesToGrid(decimalNodes, 20);

      // Math.round(10.5/20) = Math.round(0.525) = 1, 1*20 = 20
      expect(snapped[0].position.x).toBe(20); // 10.5 -> 20
      // Math.round(20.7/20) = Math.round(1.035) = 1, 1*20 = 20
      expect(snapped[0].position.y).toBe(20); // 20.7 -> 20
      // Math.round(110.3/20) = Math.round(5.515) = 6, 6*20 = 120
      expect(snapped[1].position.x).toBe(120); // 110.3 -> 120
      // Math.round(120.9/20) = Math.round(6.045) = 6, 6*20 = 120
      expect(snapped[1].position.y).toBe(120); // 120.9 -> 120
    });

    it('should handle empty node array for guide calculation', () => {
      const resultGuides = guides.calculateGuides([], '1');
      expect(resultGuides).toEqual([]);
    });

    it('should handle single node for distribution', () => {
      const singleNode: Node[] = [
        {
          id: '1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { width: 200, height: 80 },
        },
      ];

      const result = guides.distributeNodes(singleNode, { direction: 'horizontal' });

      expect(result).toEqual(singleNode);
    });
  });
});
