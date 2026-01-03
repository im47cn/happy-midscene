# 🌍 国际化更新日志

## 版本 1.0.4 - 2026-01-03

### ✨ 新增功能

#### 多语言支持
- ✅ 添加中英文双语界面支持
- ✅ 智能语言检测（浏览器语言 + 时区判断）
- ✅ 本地化存储语言偏好

#### 已本地化的界面元素

**导航栏和菜单**
- Playground → 测试场
- Recorder (Preview) → 录制器 (预览)
- Bridge Mode → 桥接模式
- AI Test Generator → AI 测试生成器

**通用文本**
- Welcome → 欢迎
- Loading → 加载中
- Error → 错误
- Success → 成功
- Settings → 设置

### 🔧 技术实现

#### 新增文件
```
apps/chrome-extension/src/i18n/index.ts
```

#### 核心功能
1. **自动语言检测**
   - 优先级: localStorage > 浏览器语言 > 时区 > 默认英文
   - 支持中国时区自动切换中文

2. **React Hook**
   ```typescript
   const { t, lang, switchLanguage } = useI18n();
   ```

3. **翻译函数**
   ```typescript
   t('playground') // 返回 "测试场" 或 "Playground"
   ```

### 📝 修改的文件

1. **apps/chrome-extension/src/extension/popup/index.tsx**
   - 导入 `useI18n` hook
   - 使用 `t()` 函数替换硬编码文本
   - 菜单项和标题全部本地化

2. **apps/chrome-extension/src/i18n/index.ts** (新建)
   - 定义中英文翻译对照表
   - 实现语言检测逻辑
   - 提供 React Hook

### 🎯 语言检测逻辑

```typescript
function getPreferredLanguage(): 'zh' | 'en' {
  // 1. 检查 localStorage
  const stored = localStorage.getItem('midscene-language');
  if (stored) return stored;
  
  // 2. 检查浏览器语言
  if (navigator.language.startsWith('zh')) return 'zh';
  
  // 3. 检查时区
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZone.includes('Shanghai') || timeZone.includes('Hong_Kong')) {
    return 'zh';
  }
  
  // 4. 默认英文
  return 'en';
}
```

### 🧪 测试方法

#### 方法 1: 浏览器控制台
```javascript
// 切换到中文
localStorage.setItem('midscene-language', 'zh');
location.reload();

// 切换到英文
localStorage.setItem('midscene-language', 'en');
location.reload();

// 恢复自动检测
localStorage.removeItem('midscene-language');
location.reload();
```

#### 方法 2: 修改浏览器语言
1. Chrome 设置 → 语言
2. 将中文设为首选语言
3. 重新加载扩展

### 📊 构建信息

```bash
# 构建命令
pnpm run build

# 构建结果
✓ 构建成功
✓ 文件大小: 9.2MB (打包后)
✓ 无错误，仅有警告（可选依赖）
```

### 🐛 已知问题

1. **Ant Design 组件**
   - 部分 Ant Design 组件的提示文本仍为英文
   - 计划后续添加 ConfigProvider 语言配置

2. **第三方库**
   - tesseract.js (OCR) 为可选依赖，不影响核心功能
   - 构建时会有警告，可以忽略

### 📚 相关文档

- **语言支持说明**: [LANGUAGE_SUPPORT.md](./LANGUAGE_SUPPORT.md)
- **快速开始**: [QUICK_START.md](./QUICK_START.md)
- **安装指南**: [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)

### 🚀 下一步计划

- [ ] 添加设置面板中的语言切换选项
- [ ] 本地化更多界面元素
- [ ] 添加 Ant Design ConfigProvider 语言配置
- [ ] 支持更多语言（日语、韩语等）
- [ ] 错误提示信息本地化

### 💡 使用建议

1. **中国用户**
   - 界面会自动显示中文
   - 如需切换英文，使用控制台命令

2. **国际用户**
   - 界面默认显示英文
   - 可手动切换到中文

3. **开发者**
   - 使用 `useI18n()` hook 添加新的翻译
   - 在 `src/i18n/index.ts` 中添加新的翻译键值对

---

**更新时间**: 2026-01-03  
**版本**: 1.0.4  
**状态**: ✅ 已完成并测试

