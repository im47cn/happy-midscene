# 🚀 国际化功能 - 快速参考卡片

## 📋 一分钟快速上手

### 🎯 功能概述
Midscene.js Chrome 扩展现已支持**中英文双语**，自动检测你的语言偏好！

---

## ⚡ 快速操作

### 切换到中文
```javascript
localStorage.setItem('midscene-language', 'zh');
location.reload();
```

### 切换到英文
```javascript
localStorage.setItem('midscene-language', 'en');
location.reload();
```

### 恢复自动检测
```javascript
localStorage.removeItem('midscene-language');
location.reload();
```

---

## 🌍 语言检测规则

```
1️⃣ localStorage 偏好 (最高优先级)
   ↓
2️⃣ 浏览器语言 (navigator.language)
   ↓
3️⃣ 时区判断 (中国时区 → 中文)
   ↓
4️⃣ 默认英文
```

---

## 📚 文档导航

| 我想... | 阅读文档 |
|---------|----------|
| 快速了解功能 | [I18N_README.md](./I18N_README.md) |
| 查看使用说明 | [LANGUAGE_SUPPORT.md](./LANGUAGE_SUPPORT.md) |
| 了解技术实现 | [I18N_IMPLEMENTATION_SUMMARY.md](./I18N_IMPLEMENTATION_SUMMARY.md) |
| 测试功能 | [test-i18n.html](./test-i18n.html) |
| 验证功能 | [I18N_VERIFICATION_GUIDE.md](./I18N_VERIFICATION_GUIDE.md) |
| 查看更新日志 | [CHANGELOG_i18n.md](./CHANGELOG_i18n.md) |

---

## ✅ 已本地化元素

| 英文 | 中文 |
|------|------|
| Playground | 测试场 |
| Recorder (Preview) | 录制器 (预览) |
| Bridge Mode | 桥接模式 |
| AI Test Generator | AI 测试生成器 |

---

## 🧪 快速测试

### 方法 1: 测试页面
1. 打开 `test-i18n.html`
2. 点击语言切换按钮
3. 重新加载扩展

### 方法 2: 控制台
1. 打开扩展 popup
2. 按 F12 打开控制台
3. 执行上面的 JavaScript 代码

---

## 🔍 故障排查

### 问题: 界面还是英文
```javascript
// 清除所有设置
localStorage.clear();
location.reload();
```

### 问题: 切换无效
1. 访问 `chrome://extensions/`
2. 找到 Midscene.js
3. 点击刷新图标 🔄

---

## 💡 开发者提示

### 使用 Hook
```typescript
import { useI18n } from '../../i18n';

function MyComponent() {
  const { t, lang, switchLanguage } = useI18n();
  return <div>{t('playground')}</div>;
}
```

### 添加翻译
编辑 `src/i18n/index.ts`:
```typescript
export const translations = {
  zh: { newKey: '新翻译' },
  en: { newKey: 'New Translation' },
};
```

---

## 📞 获取帮助

- 📖 完整文档: [I18N_README.md](./I18N_README.md)
- 🐛 问题反馈: GitHub Issues
- 💬 社区讨论: 讨论区

---

**版本:** 1.0.4 | **状态:** ✅ 已完成 | **更新:** 2026-01-03

