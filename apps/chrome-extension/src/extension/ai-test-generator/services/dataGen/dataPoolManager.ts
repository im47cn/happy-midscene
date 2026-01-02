/**
 * Data Pool Manager
 * Manages predefined data pools for test data generation
 */

import type { DataPool, IDataPoolManager } from '../../types/dataGen';

/**
 * Storage key for custom pools
 */
const STORAGE_KEY = 'midscene_data_pools';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `pool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Built-in data pools
 */
const BUILT_IN_POOLS: DataPool[] = [
  {
    id: 'cn_provinces',
    name: '中国省份',
    description: '中国31个省级行政区',
    category: 'system',
    pickStrategy: 'random',
    values: [
      '北京市', '天津市', '河北省', '山西省', '内蒙古自治区',
      '辽宁省', '吉林省', '黑龙江省',
      '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
      '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区', '海南省',
      '重庆市', '四川省', '贵州省', '云南省', '西藏自治区',
      '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区',
    ],
  },
  {
    id: 'cn_cities',
    name: '中国主要城市',
    description: '中国主要城市列表',
    category: 'system',
    pickStrategy: 'random',
    values: [
      '北京市', '上海市', '广州市', '深圳市', '杭州市',
      '成都市', '武汉市', '南京市', '西安市', '重庆市',
      '天津市', '苏州市', '郑州市', '长沙市', '青岛市',
      '大连市', '宁波市', '厦门市', '沈阳市', '无锡市',
    ],
  },
  {
    id: 'cn_surnames',
    name: '中国常用姓氏',
    description: '中国百家姓常用姓氏',
    category: 'system',
    pickStrategy: 'random',
    values: [
      '王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周',
      '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗',
      '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹',
    ],
  },
  {
    id: 'cn_given_names',
    name: '中国常用名',
    description: '中国常用名字用字',
    category: 'system',
    pickStrategy: 'random',
    values: [
      '伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋',
      '勇', '艳', '杰', '涛', '明', '超', '秀英', '华', '慧', '建',
      '霞', '平', '刚', '桂英', '红', '玲', '文', '辉', '鹏', '飞',
    ],
  },
  {
    id: 'email_domains',
    name: '邮箱域名',
    description: '常用邮箱域名',
    category: 'system',
    pickStrategy: 'random',
    values: [
      'gmail.com', 'qq.com', '163.com', '126.com', 'outlook.com',
      'hotmail.com', 'yahoo.com', 'sina.com', 'sohu.com', 'foxmail.com',
    ],
  },
  {
    id: 'mobile_prefixes',
    name: '手机号前缀',
    description: '中国手机号码前三位',
    category: 'system',
    pickStrategy: 'random',
    values: [
      '130', '131', '132', '133', '134', '135', '136', '137', '138', '139',
      '150', '151', '152', '153', '155', '156', '157', '158', '159',
      '180', '181', '182', '183', '184', '185', '186', '187', '188', '189',
    ],
  },
  {
    id: 'company_suffixes',
    name: '公司名称后缀',
    description: '常用公司名称后缀',
    category: 'system',
    pickStrategy: 'random',
    values: [
      '有限公司', '股份有限公司', '集团有限公司', '科技有限公司',
      '信息技术有限公司', '网络科技有限公司', '电子商务有限公司',
    ],
  },
  {
    id: 'job_titles',
    name: '职位名称',
    description: '常用职位名称',
    category: 'system',
    pickStrategy: 'random',
    values: [
      '软件工程师', '产品经理', 'UI设计师', '测试工程师', '项目经理',
      '前端开发工程师', '后端开发工程师', '运维工程师', '数据分析师',
      '架构师', '技术总监', '产品总监', '运营经理', '市场经理', 'HR经理',
    ],
  },
  {
    id: 'cn_districts',
    name: '区/县名称',
    description: '常用区县名称',
    category: 'system',
    pickStrategy: 'random',
    values: [
      '朝阳区', '海淀区', '西城区', '东城区', '丰台区',
      '浦东新区', '黄浦区', '静安区', '徐汇区', '长宁区',
      '天河区', '越秀区', '荔湾区', '白云区', '番禺区',
      '南山区', '福田区', '罗湖区', '宝安区', '龙岗区',
    ],
  },
  {
    id: 'cn_streets',
    name: '街道名称',
    description: '常用街道名称',
    category: 'system',
    pickStrategy: 'random',
    values: [
      '建国路', '中关村大街', '南京路', '深南大道', '天府大道',
      '解放路', '人民路', '长安街', '淮海路', '东风路',
      '和平路', '胜利路', '北京路', '上海路', '广州路',
    ],
  },
];

/**
 * Data Pool Manager implementation
 */
export class DataPoolManager implements IDataPoolManager {
  private pools: Map<string, DataPool> = new Map();
  private poolIndices: Map<string, number> = new Map(); // For sequential picking
  private initialized = false;

  /**
   * Initialize pool manager
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Load built-in pools
    for (const pool of BUILT_IN_POOLS) {
      this.pools.set(pool.id, pool);
    }

    // Load custom pools from storage
    await this.loadFromStorage();

    this.initialized = true;
  }

  /**
   * Load custom pools from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const pools: DataPool[] = JSON.parse(stored);
        for (const pool of pools) {
          if (pool.category === 'user') {
            this.pools.set(pool.id, pool);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load pools from storage:', error);
    }
  }

  /**
   * Save custom pools to storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      const customPools = [...this.pools.values()].filter(
        (p) => p.category === 'user'
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customPools));
    } catch (error) {
      console.error('Failed to save pools to storage:', error);
    }
  }

  /**
   * Get a pool by ID
   */
  async getPool(id: string): Promise<DataPool | null> {
    await this.init();
    return this.pools.get(id) || null;
  }

  /**
   * Pick a value from a pool
   */
  async pick(poolId: string): Promise<unknown> {
    await this.init();

    const pool = this.pools.get(poolId);
    if (!pool || pool.values.length === 0) {
      return null;
    }

    switch (pool.pickStrategy) {
      case 'random':
        return pool.values[Math.floor(Math.random() * pool.values.length)];

      case 'sequential': {
        const currentIndex = this.poolIndices.get(poolId) || 0;
        const value = pool.values[currentIndex];
        this.poolIndices.set(poolId, (currentIndex + 1) % pool.values.length);
        return value;
      }

      case 'shuffle': {
        // Shuffle and return first item (shuffle happens each pick)
        const shuffled = [...pool.values].sort(() => Math.random() - 0.5);
        return shuffled[0];
      }

      default:
        return pool.values[0];
    }
  }

  /**
   * Pick multiple values from a pool
   */
  async pickMultiple(poolId: string, count: number): Promise<unknown[]> {
    await this.init();

    const pool = this.pools.get(poolId);
    if (!pool || pool.values.length === 0) {
      return [];
    }

    const results: unknown[] = [];
    const availableValues = [...pool.values];

    for (let i = 0; i < count && availableValues.length > 0; i++) {
      const index = Math.floor(Math.random() * availableValues.length);
      results.push(availableValues[index]);
      availableValues.splice(index, 1); // Remove to avoid duplicates
    }

    return results;
  }

  /**
   * Add a new pool
   */
  async addPool(pool: Omit<DataPool, 'id'>): Promise<DataPool> {
    await this.init();

    const newPool: DataPool = {
      ...pool,
      id: generateId(),
    };

    this.pools.set(newPool.id, newPool);

    if (newPool.category === 'user') {
      await this.saveToStorage();
    }

    return newPool;
  }

  /**
   * Update a pool
   */
  async updatePool(id: string, updates: Partial<DataPool>): Promise<DataPool | null> {
    await this.init();

    const pool = this.pools.get(id);
    if (!pool) return null;

    if (pool.category === 'system') {
      throw new Error('Cannot modify system pools');
    }

    const updatedPool: DataPool = {
      ...pool,
      ...updates,
      id: pool.id, // Prevent ID change
      category: pool.category, // Prevent category change
    };

    this.pools.set(id, updatedPool);
    await this.saveToStorage();

    return updatedPool;
  }

  /**
   * Delete a pool
   */
  async deletePool(id: string): Promise<boolean> {
    await this.init();

    const pool = this.pools.get(id);
    if (!pool) return false;

    if (pool.category === 'system') {
      throw new Error('Cannot delete system pools');
    }

    this.pools.delete(id);
    this.poolIndices.delete(id);
    await this.saveToStorage();

    return true;
  }

  /**
   * List all pools
   */
  async listPools(): Promise<DataPool[]> {
    await this.init();
    return [...this.pools.values()];
  }

  /**
   * List pools by category
   */
  async listByCategory(category: 'system' | 'user'): Promise<DataPool[]> {
    await this.init();
    return [...this.pools.values()].filter((p) => p.category === category);
  }

  /**
   * Search pools by name
   */
  async searchPools(query: string): Promise<DataPool[]> {
    await this.init();
    const lowerQuery = query.toLowerCase();
    return [...this.pools.values()].filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Add values to an existing pool
   */
  async addValues(poolId: string, values: unknown[]): Promise<void> {
    await this.init();

    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error(`Pool not found: ${poolId}`);
    }

    if (pool.category === 'system') {
      throw new Error('Cannot modify system pools');
    }

    pool.values.push(...values);
    await this.saveToStorage();
  }

  /**
   * Remove a value from a pool
   */
  async removeValue(poolId: string, value: unknown): Promise<void> {
    await this.init();

    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error(`Pool not found: ${poolId}`);
    }

    if (pool.category === 'system') {
      throw new Error('Cannot modify system pools');
    }

    const index = pool.values.indexOf(value);
    if (index !== -1) {
      pool.values.splice(index, 1);
      await this.saveToStorage();
    }
  }

  /**
   * Reset sequential index for a pool
   */
  resetPoolIndex(poolId: string): void {
    this.poolIndices.set(poolId, 0);
  }

  /**
   * Export pools
   */
  async exportPools(category?: 'system' | 'user'): Promise<string> {
    await this.init();

    let pools = [...this.pools.values()];
    if (category) {
      pools = pools.filter((p) => p.category === category);
    }

    return JSON.stringify(pools, null, 2);
  }

  /**
   * Import pools
   */
  async importPools(json: string): Promise<number> {
    await this.init();

    try {
      const pools: DataPool[] = JSON.parse(json);
      let imported = 0;

      for (const pool of pools) {
        // Skip system pools
        if (pool.category === 'system') continue;

        // Generate new ID to avoid conflicts
        const newPool: DataPool = {
          ...pool,
          id: generateId(),
          category: 'user',
        };

        this.pools.set(newPool.id, newPool);
        imported++;
      }

      await this.saveToStorage();
      return imported;
    } catch {
      throw new Error('Invalid pool JSON format');
    }
  }

  /**
   * Clear user pools
   */
  async clearUserPools(): Promise<void> {
    await this.init();

    for (const [id, pool] of this.pools) {
      if (pool.category === 'user') {
        this.pools.delete(id);
        this.poolIndices.delete(id);
      }
    }

    await this.saveToStorage();
  }
}

/**
 * Default pool manager instance
 */
export const dataPoolManager = new DataPoolManager();
