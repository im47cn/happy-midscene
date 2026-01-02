# 分布式执行引擎 技术方案设计文档

## 1. 项目背景与目标

大型项目可能有数千个测试用例，串行执行需要数小时。本模块通过分布式并行执行，将执行时间压缩 10 倍以上，支持 CI/CD 快速反馈循环。

## 2. 系统架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Distributed Execution Engine                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      Coordinator                            │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐           │ │
│  │  │   Task     │  │  Executor  │  │   Result   │           │ │
│  │  │  Scheduler │  │  Manager   │  │ Aggregator │           │ │
│  │  └────────────┘  └────────────┘  └────────────┘           │ │
│  │                                                            │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐           │ │
│  │  │   Queue    │  │   State    │  │    Log     │           │ │
│  │  │   Store    │  │   Store    │  │ Collector  │           │ │
│  │  └────────────┘  └────────────┘  └────────────┘           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Executor 1  │  │  Executor 2  │  │  Executor N  │          │
│  │   (Local)    │  │   (Docker)   │  │   (Cloud)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 通信架构

```
                    ┌─────────────────┐
                    │   Coordinator   │
                    │   (WebSocket)   │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │Executor │◄───────►│Executor │◄───────►│Executor │
    │   1     │  Redis  │   2     │  PubSub │   3     │
    └─────────┘         └─────────┘         └─────────┘
```

### 2.3 技术栈选型

**协调器**
* 运行时: Node.js
* 通信: WebSocket + Redis PubSub
* 任务队列: BullMQ (Redis-based)
* 状态存储: Redis

**执行器**
* 核心: Midscene.js
* 容器: Docker
* 日志: Winston + Loki (可选)

---

## 3. 数据模型设计

### 3.1 任务定义

```typescript
interface TestTask {
  id: string;
  suiteId: string;                // 测试套件 ID
  caseId: string;                 // 用例 ID
  caseName: string;
  yamlContent: string;            // YAML 脚本内容
  priority: number;               // 优先级 (0-100)
  status: TaskStatus;
  attempts: number;               // 已尝试次数
  maxAttempts: number;            // 最大尝试次数

  // 调度信息
  scheduling: {
    shardId?: string;
    executorId?: string;
    assignedAt?: number;
    startedAt?: number;
    completedAt?: number;
  };

  // 依赖关系
  dependencies?: string[];        // 依赖的任务 ID

  // 标签 (用于定向分配)
  tags?: string[];

  // 预估信息
  estimation?: {
    duration: number;             // 预估耗时 (ms)
    basedOn: 'history' | 'default';
  };
}

type TaskStatus =
  | 'pending'           // 等待分配
  | 'assigned'          // 已分配
  | 'running'           // 执行中
  | 'completed'         // 完成
  | 'failed'            // 失败
  | 'retrying'          // 重试中
  | 'cancelled';        // 已取消
```

### 3.2 执行器定义

```typescript
interface Executor {
  id: string;
  name: string;
  type: 'local' | 'docker' | 'cloud';
  status: ExecutorStatus;

  // 能力
  capabilities: {
    platforms: ('web' | 'android' | 'ios')[];
    maxParallel: number;          // 最大并行数
    tags: string[];               // 标签
  };

  // 资源
  resources: {
    cpu: number;                  // CPU 核数
    memory: number;               // 内存 (MB)
    currentLoad: number;          // 当前负载 (0-100)
  };

  // 连接信息
  connection: {
    address: string;
    port: number;
    lastHeartbeat: number;
  };

  // 当前任务
  currentTasks: string[];         // 任务 ID 列表
}

type ExecutorStatus =
  | 'idle'              // 空闲
  | 'busy'              // 忙碌
  | 'offline'           // 离线
  | 'error';            // 错误
```

### 3.3 执行结果

```typescript
interface TaskResult {
  taskId: string;
  executorId: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration: number;               // 实际耗时 (ms)

  // 详细结果
  details: {
    steps: StepResult[];
    screenshots: string[];        // 截图 URLs
    logs: string[];
  };

  // 错误信息
  error?: {
    type: string;
    message: string;
    stack?: string;
  };

  timestamps: {
    started: number;
    completed: number;
  };
}
```

---

## 4. 核心模块设计

### 4.1 任务调度器 (Task Scheduler)

```typescript
class TaskScheduler {
  private queue: Queue;
  private executorManager: ExecutorManager;
  private strategyMap: Map<string, ShardingStrategy>;

  constructor() {
    this.strategyMap.set('even', new EvenShardingStrategy());
    this.strategyMap.set('time-balanced', new TimeBalancedStrategy());
    this.strategyMap.set('dependency-aware', new DependencyAwareStrategy());
  }

  async schedule(suite: TestSuite): Promise<ScheduleResult> {
    // 1. 选择分片策略
    const strategy = this.selectStrategy(suite);

    // 2. 获取可用执行器
    const executors = await this.executorManager.getAvailable({
      tags: suite.requiredTags,
    });

    // 3. 分片
    const shards = strategy.shard(suite.tasks, executors);

    // 4. 入队
    for (const shard of shards) {
      for (const task of shard.tasks) {
        await this.queue.add('execute', task, {
          priority: task.priority,
          attempts: task.maxAttempts,
          backoff: { type: 'exponential', delay: 1000 },
        });
      }
    }

    return {
      totalTasks: suite.tasks.length,
      shardCount: shards.length,
      estimatedDuration: this.estimateDuration(shards),
    };
  }

  private selectStrategy(suite: TestSuite): ShardingStrategy {
    // 有历史数据 → 耗时均衡
    if (suite.hasHistoricalData) {
      return this.strategyMap.get('time-balanced')!;
    }
    // 有依赖关系 → 依赖感知
    if (suite.hasDependencies) {
      return this.strategyMap.get('dependency-aware')!;
    }
    // 默认 → 均匀分片
    return this.strategyMap.get('even')!;
  }
}

// 耗时均衡分片策略
class TimeBalancedStrategy implements ShardingStrategy {
  shard(tasks: TestTask[], executors: Executor[]): Shard[] {
    // 按预估耗时排序 (降序)
    const sortedTasks = [...tasks].sort(
      (a, b) => (b.estimation?.duration || 0) - (a.estimation?.duration || 0)
    );

    // 贪心分配: 每次将任务分配给当前总耗时最少的执行器
    const shards: Shard[] = executors.map(e => ({
      executorId: e.id,
      tasks: [],
      totalDuration: 0,
    }));

    for (const task of sortedTasks) {
      // 找到负载最轻的分片
      const minShard = shards.reduce((min, s) =>
        s.totalDuration < min.totalDuration ? s : min
      );

      minShard.tasks.push(task);
      minShard.totalDuration += task.estimation?.duration || 30000; // 默认 30s
    }

    return shards;
  }
}
```

### 4.2 执行器管理器 (Executor Manager)

```typescript
class ExecutorManager {
  private executors: Map<string, Executor> = new Map();
  private heartbeatInterval = 5000; // 5秒
  private heartbeatTimeout = 15000; // 15秒

  async register(executor: Executor): Promise<void> {
    this.executors.set(executor.id, executor);
    this.emit('executor:registered', executor);

    // 启动心跳监控
    this.startHeartbeatMonitor(executor.id);
  }

  async unregister(executorId: string): Promise<void> {
    const executor = this.executors.get(executorId);
    if (executor) {
      // 重新分配该执行器的任务
      await this.reassignTasks(executor.currentTasks);
      this.executors.delete(executorId);
      this.emit('executor:unregistered', executor);
    }
  }

  async getAvailable(filter?: ExecutorFilter): Promise<Executor[]> {
    return Array.from(this.executors.values()).filter(e => {
      if (e.status === 'offline' || e.status === 'error') return false;
      if (e.currentTasks.length >= e.capabilities.maxParallel) return false;
      if (filter?.tags && !filter.tags.every(t => e.capabilities.tags.includes(t))) {
        return false;
      }
      return true;
    });
  }

  private startHeartbeatMonitor(executorId: string): void {
    setInterval(async () => {
      const executor = this.executors.get(executorId);
      if (!executor) return;

      const timeSinceHeartbeat = Date.now() - executor.connection.lastHeartbeat;
      if (timeSinceHeartbeat > this.heartbeatTimeout) {
        executor.status = 'offline';
        await this.reassignTasks(executor.currentTasks);
        this.emit('executor:offline', executor);
      }
    }, this.heartbeatInterval);
  }

  private async reassignTasks(taskIds: string[]): Promise<void> {
    for (const taskId of taskIds) {
      // 重新入队，保持原优先级
      await this.scheduler.requeue(taskId);
    }
  }
}
```

### 4.3 执行器 Worker

```typescript
class ExecutorWorker {
  private coordinator: CoordinatorClient;
  private midscene: MidsceneAgent;
  private config: ExecutorConfig;

  async start(): Promise<void> {
    // 1. 连接协调器
    await this.coordinator.connect();

    // 2. 注册自己
    await this.coordinator.register({
      id: this.config.id,
      name: this.config.name,
      type: this.config.type,
      capabilities: this.config.capabilities,
    });

    // 3. 开始心跳
    this.startHeartbeat();

    // 4. 监听任务
    this.coordinator.on('task:assigned', this.handleTask.bind(this));
  }

  private async handleTask(task: TestTask): Promise<void> {
    const startTime = Date.now();

    try {
      // 报告开始
      await this.coordinator.reportProgress(task.id, 'running');

      // 执行测试
      const result = await this.midscene.execute(task.yamlContent, {
        onStepComplete: (step, result) => {
          this.coordinator.reportStepProgress(task.id, step, result);
        },
      });

      // 报告结果
      await this.coordinator.reportResult({
        taskId: task.id,
        executorId: this.config.id,
        status: result.success ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        details: result,
      });

    } catch (error) {
      await this.coordinator.reportResult({
        taskId: task.id,
        executorId: this.config.id,
        status: 'error',
        duration: Date.now() - startTime,
        error: {
          type: error.constructor.name,
          message: error.message,
          stack: error.stack,
        },
      });
    }
  }

  private startHeartbeat(): void {
    setInterval(async () => {
      await this.coordinator.heartbeat({
        executorId: this.config.id,
        load: this.getSystemLoad(),
        currentTasks: this.currentTaskIds,
      });
    }, 5000);
  }
}
```

### 4.4 结果聚合器 (Result Aggregator)

```typescript
class ResultAggregator {
  async aggregate(suiteId: string): Promise<SuiteReport> {
    const tasks = await this.getTasksForSuite(suiteId);
    const results = await this.getResultsForTasks(tasks.map(t => t.id));

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const error = results.filter(r => r.status === 'error').length;

    return {
      suiteId,
      summary: {
        total: tasks.length,
        passed,
        failed,
        error,
        passRate: (passed / tasks.length) * 100,
      },
      duration: {
        total: this.calculateTotalDuration(results),
        wallClock: this.calculateWallClockTime(tasks),
        saved: this.calculateTimeSaved(results),
      },
      executors: this.groupByExecutor(results),
      failures: results.filter(r => r.status !== 'passed').map(r => ({
        taskId: r.taskId,
        caseName: tasks.find(t => t.id === r.taskId)?.caseName,
        error: r.error,
        screenshots: r.details?.screenshots,
      })),
      timeline: this.buildTimeline(results),
    };
  }

  private calculateTimeSaved(results: TaskResult[]): number {
    // 串行执行总时间
    const serialTime = results.reduce((sum, r) => sum + r.duration, 0);
    // 实际执行时间 (并行)
    const parallelTime = this.calculateWallClockTime(results);

    return serialTime - parallelTime;
  }
}
```

---

## 5. 部署方案

### 5.1 Docker 执行器

```dockerfile
FROM node:20-slim

# 安装依赖
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 设置环境变量
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

CMD ["node", "executor.js"]
```

### 5.2 docker-compose 示例

```yaml
version: '3.8'

services:
  coordinator:
    image: midscene/coordinator:latest
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  executor-1:
    image: midscene/executor:latest
    environment:
      - COORDINATOR_URL=ws://coordinator:3000
      - EXECUTOR_ID=executor-1
      - MAX_PARALLEL=2
    depends_on:
      - coordinator

  executor-2:
    image: midscene/executor:latest
    environment:
      - COORDINATOR_URL=ws://coordinator:3000
      - EXECUTOR_ID=executor-2
      - MAX_PARALLEL=2
    depends_on:
      - coordinator

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

---

## 6. 实施计划

1. **Week 1**: 任务调度器，队列系统
2. **Week 2**: 执行器管理，心跳机制
3. **Week 3**: 执行器 Worker，Docker 化
4. **Week 4**: 结果聚合，监控 UI，测试
