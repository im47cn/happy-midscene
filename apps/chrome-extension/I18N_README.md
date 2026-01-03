# 🌍 Midscene.js Chrome 扩展 - 国际化文档索引

## 📚 文档导航

本目录包含 Midscene.js Chrome 扩展国际化功能的完整文档。

---

## 📖 快速开始

### 🎯 我想...

#### 了解语言支持功能
👉 阅读 [LANGUAGE_SUPPORT.md](./LANGUAGE_SUPPORT.md)
- 语言自动检测机制
- 支持的语言列表
- 手动切换语言方法
- 常见问题解答

#### 查看更新内容
👉 阅读 [CHANGELOG_i18n.md](./CHANGELOG_i18n.md)
- 版本 1.0.4 更新内容
- 技术实现细节
- 已知问题
- 未来计划

#### 了解完整实现
👉 阅读 [I18N_IMPLEMENTATION_SUMMARY.md](./I18N_IMPLEMENTATION_SUMMARY.md)
- 实现概述
- 技术架构
- 代码示例
- 开发者指南

#### 验证功能是否正常
👉 阅读 [I18N_VERIFICATION_GUIDE.md](./I18N_VERIFICATION_GUIDE.md)
- 详细验证步骤
- 测试用例
- 故障排查
- 验收标准

#### 快速测试语言切换
👉 打开 [test-i18n.html](./test-i18n.html)
- 交互式测试页面
- 浏览器信息显示
- 一键切换语言
- 安装指南

---

## 🗂️ 文档结构

```
apps/chrome-extension/
├── I18N_README.md                    # 📍 你在这里 - 文档索引
├── LANGUAGE_SUPPORT.md               # 语言支持详细说明
├── CHANGELOG_i18n.md                 # 国际化更新日志
├── I18N_IMPLEMENTATION_SUMMARY.md    # 实现总结
├── I18N_VERIFICATION_GUIDE.md        # 验证指南
├── test-i18n.html                    # 测试页面
└── src/
    └── i18n/
        └── index.ts                  # 国际化核心代码
```

---

## ⚡ 快速参考

### 支持的语言

| 语言 | 代码 | 状态 |
|------|------|------|
| 中文 | `zh` | ✅ 已支持 |
| English | `en` | ✅ 已支持 |

### 语言检测优先级

```
1. localStorage 偏好 (最高)
2. 浏览器语言
3. 时区判断
4. 默认英文 (最低)
```

### 快速切换语言

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

### 已本地化的元素

- ✅ 菜单项（4个模式）
- ✅ 导航栏标题
- ✅ 通用文本（加载中、错误等）

---

## 🎓 学习路径

### 初学者路径

1. **了解功能** → [LANGUAGE_SUPPORT.md](./LANGUAGE_SUPPORT.md)
2. **动手测试** → [test-i18n.html](./test-i18n.html)
3. **查看更新** → [CHANGELOG_i18n.md](./CHANGELOG_i18n.md)

### 开发者路径

1. **实现总结** → [I18N_IMPLEMENTATION_SUMMARY.md](./I18N_IMPLEMENTATION_SUMMARY.md)
2. **查看代码** → `src/i18n/index.ts`
3. **验证功能** → [I18N_VERIFICATION_GUIDE.md](./I18N_VERIFICATION_GUIDE.md)

### 测试人员路径

1. **验证指南** → [I18N_VERIFICATION_GUIDE.md](./I18N_VERIFICATION_GUIDE.md)
2. **测试页面** → [test-i18n.html](./test-i18n.html)
3. **故障排查** → [I18N_VERIFICATION_GUIDE.md#故障排查](./I18N_VERIFICATION_GUIDE.md#故障排查)

---

## 🔗 相关链接

### 项目文档
- [快速开始](./QUICK_START.md)
- [安装指南](./INSTALLATION_GUIDE.md)
- [开发指南](./DEVELOPMENT_GUIDE.md)

### 源代码
- [国际化核心](./src/i18n/index.ts)
- [Popup 组件](./src/extension/popup/index.tsx)

---

## 📊 功能概览

### ✅ 已实现

- [x] 中英文双语支持
- [x] 智能语言检测
- [x] 本地化存储
- [x] React Hook (`useI18n`)
- [x] 菜单项本地化
- [x] 导航栏本地化
- [x] 完整文档
- [x] 测试页面

### 🚧 计划中

- [ ] 设置面板语言切换
- [ ] Ant Design 组件本地化
- [ ] 更多语言支持
- [ ] 错误提示本地化
- [ ] 导出脚本注释本地化

---

## 🎯 使用场景

### 场景 1: 中国用户
```
浏览器: Chrome (zh-CN)
时区: Asia/Shanghai
→ 自动显示中文 ✅
```

### 场景 2: 国际用户
```
浏览器: Chrome (en-US)
时区: America/New_York
→ 自动显示英文 ✅
```

### 场景 3: 手动切换
```
用户操作: 设置 localStorage
→ 强制使用指定语言 ✅
```

---

## 💡 常见问题

### Q: 如何切换语言?

**A:** 有三种方法:
1. 使用 [test-i18n.html](./test-i18n.html) 测试页面
2. 在浏览器控制台执行 JavaScript 代码
3. 修改浏览器语言设置

详见 [LANGUAGE_SUPPORT.md](./LANGUAGE_SUPPORT.md)

### Q: 为什么界面还是英文?

**A:** 请检查:
1. 浏览器语言设置
2. localStorage 中的语言偏好
3. 是否重新加载了扩展

详见 [I18N_VERIFICATION_GUIDE.md#故障排查](./I18N_VERIFICATION_GUIDE.md#故障排查)

### Q: 如何添加新的翻译?

**A:** 编辑 `src/i18n/index.ts` 文件，添加新的键值对。

详见 [I18N_IMPLEMENTATION_SUMMARY.md#开发者指南](./I18N_IMPLEMENTATION_SUMMARY.md#开发者指南)

---

## 📞 获取帮助

### 文档问题
- 查看 [常见问题](./LANGUAGE_SUPPORT.md#常见问题)
- 阅读 [故障排查](./I18N_VERIFICATION_GUIDE.md#故障排查)

### 功能问题
- 提交 GitHub Issue
- 在社区讨论区发帖

### 贡献翻译
- Fork 项目
- 编辑 `src/i18n/index.ts`
- 提交 Pull Request

---

## 🎉 开始使用

1. **构建扩展**
   ```bash
   cd apps/chrome-extension
   pnpm run build
   ```

2. **加载扩展**
   - 访问 `chrome://extensions/`
   - 开启开发者模式
   - 加载 `dist` 目录

3. **测试语言**
   - 打开 [test-i18n.html](./test-i18n.html)
   - 切换语言
   - 验证效果

---

**版本:** 1.0.4  
**更新日期:** 2026-01-03  
**状态:** ✅ 已完成

**享受多语言体验!** 🌍

