# 敏感数据脱敏 技术方案设计文档

## 1. 项目背景与目标

测试过程不可避免地涉及敏感数据，但截图、日志、报告可能被广泛分享。本模块通过自动化脱敏处理，在不影响测试功能的前提下，保护敏感信息安全。

## 2. 系统架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Masking Module                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Detector   │  │    Masker    │  │    Rule      │       │
│  │   Engine     │  │   Engine     │  │   Manager    │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         └────────────┬────┴─────────────────┘               │
│                      │                                       │
│              ┌───────▼───────┐                              │
│              │  Processing   │                              │
│              │   Pipeline    │                              │
│              └───────────────┘                              │
└─────────────────────────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │   Text   │  │  Image   │  │   Log    │
   │  Masker  │  │  Masker  │  │  Masker  │
   └──────────┘  └──────────┘  └──────────┘
```

### 2.2 技术栈选型

* **文本检测**: 正则表达式 + 自定义规则引擎
* **图像处理**: Sharp.js (模糊/遮盖)
* **OCR**: Tesseract.js (可选)
* **存储**: IndexedDB (规则存储)

---

## 3. 数据模型设计

### 3.1 脱敏规则

```typescript
interface MaskingRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;                // 优先级 (0-100)

  // 匹配配置
  detection: {
    type: 'regex' | 'keyword' | 'pattern';
    pattern: string;               // 正则表达式或关键词
    flags?: string;                // 正则标志 (gi 等)
    context?: {                    // 上下文匹配
      before?: string;             // 前缀
      after?: string;              // 后缀
    };
  };

  // 脱敏配置
  masking: {
    method: MaskingMethod;
    options?: MaskingOptions;
  };

  // 适用场景
  scope: {
    text: boolean;
    screenshot: boolean;
    log: boolean;
    yaml: boolean;
  };

  // 元数据
  category: SensitiveCategory;
  builtIn: boolean;               // 是否内置规则
  createdAt: number;
  updatedAt: number;
}

type MaskingMethod =
  | 'full'           // 完全遮盖: ********
  | 'partial'        // 部分保留: 138****5678
  | 'hash'           // 哈希替换: [EMAIL:a1b2c3]
  | 'placeholder'    // 占位符: [PASSWORD]
  | 'blur';          // 模糊 (仅截图)

interface MaskingOptions {
  // partial 选项
  keepStart?: number;             // 保留开头字符数
  keepEnd?: number;               // 保留结尾字符数
  maskChar?: string;              // 遮盖字符，默认 *

  // hash 选项
  hashLength?: number;            // 哈希长度

  // placeholder 选项
  placeholder?: string;           // 自定义占位符

  // blur 选项
  blurRadius?: number;            // 模糊半径
}

type SensitiveCategory =
  | 'credential'     // 凭证
  | 'pii'            // 个人身份信息
  | 'financial'      // 金融信息
  | 'health'         // 健康信息
  | 'custom';        // 自定义
```

### 3.2 脱敏结果

```typescript
interface MaskingResult {
  original: string;
  masked: string;
  matches: MaskingMatch[];
  processingTime: number;
}

interface MaskingMatch {
  ruleId: string;
  ruleName: string;
  category: SensitiveCategory;
  position: {
    start: number;
    end: number;
  };
  originalValue: string;
  maskedValue: string;
}
```

---

## 4. 核心模块设计

### 4.1 检测引擎 (Detector Engine)

```typescript
class DetectorEngine {
  private rules: MaskingRule[] = [];

  async detect(text: string): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    // 按优先级排序规则
    const sortedRules = [...this.rules]
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const matches = this.matchRule(text, rule);
      results.push(...matches);
    }

    // 合并重叠匹配 (高优先级规则优先)
    return this.mergeOverlapping(results);
  }

  private matchRule(text: string, rule: MaskingRule): DetectionResult[] {
    const results: DetectionResult[] = [];

    switch (rule.detection.type) {
      case 'regex':
        const regex = new RegExp(rule.detection.pattern, rule.detection.flags || 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
          // 检查上下文
          if (this.checkContext(text, match, rule.detection.context)) {
            results.push({
              ruleId: rule.id,
              ruleName: rule.name,
              category: rule.category,
              position: {
                start: match.index,
                end: match.index + match[0].length,
              },
              value: match[0],
            });
          }
        }
        break;

      case 'keyword':
        // 关键词匹配...
        break;
    }

    return results;
  }

  private checkContext(
    text: string,
    match: RegExpExecArray,
    context?: { before?: string; after?: string }
  ): boolean {
    if (!context) return true;

    if (context.before) {
      const beforeText = text.substring(
        Math.max(0, match.index - context.before.length),
        match.index
      );
      if (!new RegExp(context.before).test(beforeText)) {
        return false;
      }
    }

    if (context.after) {
      const afterStart = match.index + match[0].length;
      const afterText = text.substring(afterStart, afterStart + context.after.length);
      if (!new RegExp(context.after).test(afterText)) {
        return false;
      }
    }

    return true;
  }
}
```

### 4.2 脱敏引擎 (Masker Engine)

```typescript
class MaskerEngine {
  private ruleManager: RuleManager;

  async maskText(text: string, scope: 'text' | 'log' | 'yaml'): Promise<MaskingResult> {
    const startTime = Date.now();
    const rules = this.ruleManager.getRulesForScope(scope);

    let result = text;
    const matches: MaskingMatch[] = [];

    // 检测敏感数据
    const detections = await this.detector.detect(text);

    // 从后向前替换，避免位置偏移
    const sortedDetections = [...detections].sort(
      (a, b) => b.position.start - a.position.start
    );

    for (const detection of sortedDetections) {
      const rule = this.ruleManager.getRule(detection.ruleId);
      if (!rule) continue;

      const masked = this.applyMasking(detection.value, rule.masking);

      result =
        result.substring(0, detection.position.start) +
        masked +
        result.substring(detection.position.end);

      matches.push({
        ruleId: detection.ruleId,
        ruleName: detection.ruleName,
        category: detection.category,
        position: detection.position,
        originalValue: detection.value,
        maskedValue: masked,
      });
    }

    return {
      original: text,
      masked: result,
      matches,
      processingTime: Date.now() - startTime,
    };
  }

  private applyMasking(value: string, config: MaskingRule['masking']): string {
    const { method, options = {} } = config;

    switch (method) {
      case 'full':
        return (options.maskChar || '*').repeat(value.length);

      case 'partial':
        const keepStart = options.keepStart || 3;
        const keepEnd = options.keepEnd || 4;
        const maskChar = options.maskChar || '*';

        if (value.length <= keepStart + keepEnd) {
          return maskChar.repeat(value.length);
        }

        return (
          value.substring(0, keepStart) +
          maskChar.repeat(value.length - keepStart - keepEnd) +
          value.substring(value.length - keepEnd)
        );

      case 'hash':
        const hash = this.generateHash(value, options.hashLength || 6);
        return `[MASKED:${hash}]`;

      case 'placeholder':
        return options.placeholder || '[SENSITIVE]';

      default:
        return value;
    }
  }

  private generateHash(value: string, length: number): string {
    // 简单哈希实现
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, length);
  }
}
```

### 4.3 截图脱敏器 (Image Masker)

```typescript
class ImageMasker {
  private sharp: typeof import('sharp');
  private ocrEngine?: TesseractWorker;

  async maskScreenshot(
    imageBuffer: Buffer,
    level: 'off' | 'standard' | 'strict'
  ): Promise<MaskedImage> {
    if (level === 'off') {
      return { buffer: imageBuffer, regions: [] };
    }

    const regions: MaskRegion[] = [];

    // 标准模式: 检测已知敏感区域 (密码输入框等)
    if (level === 'standard' || level === 'strict') {
      const inputRegions = await this.detectSensitiveInputs(imageBuffer);
      regions.push(...inputRegions);
    }

    // 严格模式: OCR 全文检测
    if (level === 'strict' && this.ocrEngine) {
      const ocrRegions = await this.detectWithOCR(imageBuffer);
      regions.push(...ocrRegions);
    }

    // 应用模糊/遮盖
    if (regions.length === 0) {
      return { buffer: imageBuffer, regions: [] };
    }

    const maskedBuffer = await this.applyMasks(imageBuffer, regions);
    return { buffer: maskedBuffer, regions };
  }

  private async detectSensitiveInputs(imageBuffer: Buffer): Promise<MaskRegion[]> {
    // 使用图像分析检测密码输入框等
    // 通常依赖 DOM 信息或 AI 模型
    // 这里使用简化实现
    return [];
  }

  private async detectWithOCR(imageBuffer: Buffer): Promise<MaskRegion[]> {
    if (!this.ocrEngine) return [];

    const { data: { words } } = await this.ocrEngine.recognize(imageBuffer);
    const regions: MaskRegion[] = [];

    for (const word of words) {
      // 检查每个识别的文本是否敏感
      const isSensitive = await this.checkSensitive(word.text);
      if (isSensitive) {
        regions.push({
          x: word.bbox.x0,
          y: word.bbox.y0,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0,
          type: 'blur',
        });
      }
    }

    return regions;
  }

  private async applyMasks(
    imageBuffer: Buffer,
    regions: MaskRegion[]
  ): Promise<Buffer> {
    let image = this.sharp(imageBuffer);

    for (const region of regions) {
      // 创建模糊层
      const blur = await this.sharp(imageBuffer)
        .extract({
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
        })
        .blur(region.type === 'blur' ? 10 : 0)
        .toBuffer();

      // 合成
      image = image.composite([{
        input: blur,
        left: region.x,
        top: region.y,
      }]);
    }

    return image.toBuffer();
  }
}

interface MaskRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'blur' | 'fill';
}

interface MaskedImage {
  buffer: Buffer;
  regions: MaskRegion[];
}
```

### 4.4 内置规则库

```typescript
const builtInRules: MaskingRule[] = [
  // 密码
  {
    id: 'builtin-password',
    name: '密码字段',
    description: '检测密码相关字段',
    enabled: true,
    priority: 90,
    detection: {
      type: 'regex',
      pattern: '(?:password|pwd|passwd|secret)\\s*[:=]\\s*["\']?([^"\'\\s]+)["\']?',
      flags: 'gi',
    },
    masking: { method: 'placeholder', options: { placeholder: '[PASSWORD]' } },
    scope: { text: true, screenshot: true, log: true, yaml: true },
    category: 'credential',
    builtIn: true,
  },

  // 中国手机号
  {
    id: 'builtin-phone-cn',
    name: '中国手机号',
    description: '检测中国大陆手机号码',
    enabled: true,
    priority: 80,
    detection: {
      type: 'regex',
      pattern: '1[3-9]\\d{9}',
      flags: 'g',
    },
    masking: { method: 'partial', options: { keepStart: 3, keepEnd: 4 } },
    scope: { text: true, screenshot: true, log: true, yaml: false },
    category: 'pii',
    builtIn: true,
  },

  // 身份证号
  {
    id: 'builtin-id-card-cn',
    name: '中国身份证号',
    description: '检测中国居民身份证号码',
    enabled: true,
    priority: 85,
    detection: {
      type: 'regex',
      pattern: '[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]',
      flags: 'g',
    },
    masking: { method: 'partial', options: { keepStart: 6, keepEnd: 4 } },
    scope: { text: true, screenshot: true, log: true, yaml: false },
    category: 'pii',
    builtIn: true,
  },

  // 邮箱
  {
    id: 'builtin-email',
    name: '邮箱地址',
    description: '检测电子邮箱地址',
    enabled: true,
    priority: 70,
    detection: {
      type: 'regex',
      pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      flags: 'gi',
    },
    masking: { method: 'hash', options: { hashLength: 6 } },
    scope: { text: true, screenshot: false, log: true, yaml: false },
    category: 'pii',
    builtIn: true,
  },

  // API Key
  {
    id: 'builtin-api-key',
    name: 'API Key',
    description: '检测 API 密钥',
    enabled: true,
    priority: 95,
    detection: {
      type: 'regex',
      pattern: '(?:api[_-]?key|apikey)\\s*[:=]\\s*["\']?([a-zA-Z0-9_-]{20,})["\']?',
      flags: 'gi',
    },
    masking: { method: 'placeholder', options: { placeholder: '[API_KEY]' } },
    scope: { text: true, screenshot: true, log: true, yaml: true },
    category: 'credential',
    builtIn: true,
  },

  // Bearer Token
  {
    id: 'builtin-bearer-token',
    name: 'Bearer Token',
    description: '检测 Bearer 令牌',
    enabled: true,
    priority: 95,
    detection: {
      type: 'regex',
      pattern: 'Bearer\\s+([a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+)',
      flags: 'gi',
    },
    masking: { method: 'placeholder', options: { placeholder: '[BEARER_TOKEN]' } },
    scope: { text: true, screenshot: true, log: true, yaml: true },
    category: 'credential',
    builtIn: true,
  },

  // 银行卡号
  {
    id: 'builtin-bank-card',
    name: '银行卡号',
    description: '检测银行卡号码',
    enabled: true,
    priority: 85,
    detection: {
      type: 'regex',
      pattern: '\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}(?:[\\s-]?\\d{1,3})?',
      flags: 'g',
    },
    masking: { method: 'partial', options: { keepStart: 4, keepEnd: 4, maskChar: '*' } },
    scope: { text: true, screenshot: true, log: true, yaml: false },
    category: 'financial',
    builtIn: true,
  },
];
```

---

## 5. 集成点

### 5.1 ExecutionEngine 集成

```typescript
// 在 ExecutionEngine 中集成脱敏
class ExecutionEngine {
  private masker: MaskerEngine;
  private imageMasker: ImageMasker;
  private config: MaskingConfig;

  async captureScreenshot(): Promise<string> {
    const screenshot = await this.page.screenshot();

    if (this.config.screenshotMasking !== 'off') {
      const masked = await this.imageMasker.maskScreenshot(
        screenshot,
        this.config.screenshotMasking
      );
      return masked.buffer.toString('base64');
    }

    return screenshot.toString('base64');
  }

  private log(level: string, message: string, data?: any): void {
    if (this.config.logMasking) {
      message = this.masker.maskText(message, 'log').masked;
      if (data) {
        data = JSON.parse(
          this.masker.maskText(JSON.stringify(data), 'log').masked
        );
      }
    }

    this.logger[level](message, data);
  }
}
```

---

## 6. 实施计划

1. **Week 1**: 检测引擎，内置规则库
2. **Week 2**: 文本脱敏器，日志脱敏器
3. **Week 3**: 截图脱敏器，OCR 集成
4. **Week 4**: 规则管理 UI，ExecutionEngine 集成
