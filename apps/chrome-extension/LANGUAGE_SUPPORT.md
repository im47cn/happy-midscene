# 🌍 Chrome 扩展多语言支持说明

## 📋 概述

Midscene.js Chrome 扩展现已支持**中英文双语界面**！系统会根据你的浏览器语言和时区自动选择合适的语言。

---

## 🎯 语言自动检测

扩展会按照以下优先级自动选择界面语言：

### 检测优先级

1. **本地存储偏好** (最高优先级)
   - 如果你之前手动设置过语言，将使用你的偏好设置

2. **浏览器语言**
   - 检测浏览器的 `navigator.language` 设置
   - 如果是中文（zh-CN, zh-TW 等），显示中文界面
   - 其他语言显示英文界面

3. **时区判断**
   - 如果浏览器语言无法确定，检查系统时区
   - 中国时区（Asia/Shanghai, Asia/Chongqing, Asia/Hong_Kong）默认中文
   - 其他时区默认英文

4. **默认语言**
   - 如果以上都无法确定，默认显示英文界面

---

## 🔄 当前版本的语言显示

### ✅ 已支持中文的界面元素

- **模式名称**
  - Playground → 测试场
  - Recorder (Preview) → 录制器 (预览)
  - Bridge Mode → 桥接模式
  - AI Test Generator → AI 测试生成器

- **菜单项**
  - 所有模式切换菜单已本地化

- **导航栏标题**
  - 顶部导航栏显示当前模式的中文名称

### 🔧 手动切换语言（开发中）

未来版本将支持手动切换语言功能，可以通过设置面板进行切换。

---

## 🧪 测试语言显示

### 方法 1: 修改浏览器语言

1. 打开 Chrome 设置
2. 搜索 "语言" 或 "Language"
3. 将中文设置为首选语言
4. 重新加载扩展

### 方法 2: 使用开发者工具

在浏览器控制台执行：

```javascript
// 设置为中文
localStorage.setItem('midscene-language', 'zh');
location.reload();

// 设置为英文
localStorage.setItem('midscene-language', 'en');
location.reload();
```

### 方法 3: 清除语言偏好（恢复自动检测）

```javascript
localStorage.removeItem('midscene-language');
location.reload();
```

---

## 📊 语言检测示例

### 示例 1: 中国用户

```
浏览器语言: zh-CN
时区: Asia/Shanghai
→ 显示中文界面 ✅
```

### 示例 2: 香港用户

```
浏览器语言: zh-HK
时区: Asia/Hong_Kong
→ 显示中文界面 ✅
```

### 示例 3: 美国用户

```
浏览器语言: en-US
时区: America/New_York
→ 显示英文界面 ✅
```

### 示例 4: 在中国使用英文浏览器

```
浏览器语言: en-US
时区: Asia/Shanghai
→ 显示中文界面 ✅ (根据时区判断)
```

---

## 🛠️ 技术实现

### 国际化文件位置

```
apps/chrome-extension/src/i18n/index.ts
```

### 核心函数

```typescript
// 获取首选语言
getPreferredLanguage(): 'zh' | 'en'

// 设置语言偏好
setLanguagePreference(lang: 'zh' | 'en')

// React Hook
const { t, lang, switchLanguage } = useI18n();
```

### 使用示例

```tsx
import { useI18n } from '../../i18n';

function MyComponent() {
  const { t, lang, switchLanguage } = useI18n();
  
  return (
    <div>
      <h1>{t('playground')}</h1>
      <p>当前语言: {lang}</p>
      <button onClick={() => switchLanguage('zh')}>中文</button>
      <button onClick={() => switchLanguage('en')}>English</button>
    </div>
  );
}
```

---

## 📝 翻译对照表

| 英文 | 中文 |
|------|------|
| Playground | 测试场 |
| Recorder (Preview) | 录制器 (预览) |
| Bridge Mode | 桥接模式 |
| AI Test Generator | AI 测试生成器 |
| Settings | 设置 |
| Environment Config | 环境配置 |
| Model Config | 模型配置 |
| Loading... | 加载中... |
| Error | 错误 |
| Success | 成功 |
| Cancel | 取消 |
| Confirm | 确认 |
| Save | 保存 |

---

## 🚀 未来计划

### 即将支持的功能

- [ ] 设置面板中的语言切换选项
- [ ] 更多界面元素的本地化
- [ ] 支持更多语言（日语、韩语等）
- [ ] 导出的测试脚本注释本地化
- [ ] 错误提示信息本地化

---

## 🐛 已知问题

1. **部分第三方组件未本地化**
   - Ant Design 组件库的部分提示文本仍为英文
   - 计划在后续版本中添加 Ant Design 的 ConfigProvider 语言配置

2. **AI 生成的内容**
   - AI 模型返回的内容语言取决于提示词和模型设置
   - 暂不影响界面语言显示

---

## 💡 常见问题

### Q: 为什么我的界面还是英文？

**A:** 请检查：
1. 浏览器语言设置是否为中文
2. 清除浏览器缓存并重新加载扩展
3. 使用开发者工具手动设置语言偏好

### Q: 如何强制使用英文界面？

**A:** 在控制台执行：
```javascript
localStorage.setItem('midscene-language', 'en');
location.reload();
```

### Q: 语言设置会同步到其他设备吗？

**A:** 不会。语言偏好存储在本地 localStorage 中，不会跨设备同步。

---

## 📞 反馈

如果你发现翻译不准确或有改进建议，欢迎：

1. 提交 GitHub Issue
2. 发起 Pull Request
3. 在社区讨论区反馈

---

**享受多语言体验！** 🎉

