# 🧪 国际化功能验证指南

## 📋 验证清单

使用本指南验证 Midscene.js Chrome 扩展的国际化功能是否正常工作。

---

## 🚀 第一步: 安装扩展

### 1.1 构建扩展（如果还没构建）

```bash
cd apps/chrome-extension
pnpm run build
```

**预期结果:**
```
✓ 构建成功
✓ 产物目录: dist/
✓ 打包文件: extension_output/midscene-extension-v1.0.4.zip
```

### 1.2 在 Chrome 中加载扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的 **"开发者模式"**
4. 点击 **"加载已解压的扩展程序"**
5. 选择 `apps/chrome-extension/dist` 目录
6. 确认扩展已成功加载

**预期结果:**
- ✅ 扩展图标出现在工具栏
- ✅ 扩展名称: Midscene.js
- ✅ 版本: 1.4

---

## 🌍 第二步: 验证自动语言检测

### 2.1 中文环境测试

**测试条件:**
- 浏览器语言设置为中文（zh-CN）
- 或者系统时区为中国时区

**操作步骤:**
1. 点击扩展图标打开 popup
2. 观察界面语言

**预期结果:**
- ✅ 导航栏显示: "测试场" / "录制器 (预览)" / "桥接模式" / "AI 测试生成器"
- ✅ 菜单项全部显示中文

**截图位置:**
- 导航栏标题
- 下拉菜单

### 2.2 英文环境测试

**测试条件:**
- 浏览器语言设置为英文（en-US）
- 系统时区为非中国时区

**操作步骤:**
1. 点击扩展图标打开 popup
2. 观察界面语言

**预期结果:**
- ✅ 导航栏显示: "Playground" / "Recorder (Preview)" / "Bridge Mode" / "AI Test Generator"
- ✅ 菜单项全部显示英文

---

## 🔄 第三步: 验证手动语言切换

### 3.1 使用测试页面

1. 在浏览器中打开 `test-i18n.html`
2. 查看 "当前浏览器信息" 部分
3. 点击 "切换到中文" 按钮
4. 重新加载扩展（在 `chrome://extensions/` 点击刷新图标）
5. 打开扩展 popup，确认显示中文

**预期结果:**
- ✅ 测试页面显示成功消息
- ✅ 扩展界面切换为中文

### 3.2 使用浏览器控制台

1. 打开扩展 popup
2. 按 F12 打开开发者工具
3. 在控制台执行:

```javascript
// 切换到中文
localStorage.setItem('midscene-language', 'zh');
location.reload();
```

**预期结果:**
- ✅ 页面重新加载
- ✅ 界面显示中文

4. 切换到英文:

```javascript
// 切换到英文
localStorage.setItem('midscene-language', 'en');
location.reload();
```

**预期结果:**
- ✅ 页面重新加载
- ✅ 界面显示英文

### 3.3 清除语言偏好

```javascript
// 恢复自动检测
localStorage.removeItem('midscene-language');
location.reload();
```

**预期结果:**
- ✅ 页面重新加载
- ✅ 根据浏览器语言/时区自动选择语言

---

## 📊 第四步: 验证所有本地化元素

### 4.1 菜单项检查

打开扩展 popup，点击右上角的菜单图标（三条横线）。

**中文环境预期:**
- ✅ 测试场
- ✅ 录制器 (预览)
- ✅ 桥接模式
- ✅ AI 测试生成器

**英文环境预期:**
- ✅ Playground
- ✅ Recorder (Preview)
- ✅ Bridge Mode
- ✅ AI Test Generator

### 4.2 导航栏标题检查

切换不同的模式，观察导航栏标题。

**中文环境预期:**
| 模式 | 标题 |
|------|------|
| Playground | 测试场 |
| Recorder | 录制器 (预览) |
| Bridge | 桥接模式 |
| AI Generator | AI 测试生成器 |

**英文环境预期:**
| 模式 | 标题 |
|------|------|
| Playground | Playground |
| Recorder | Recorder (Preview) |
| Bridge | Bridge Mode |
| AI Generator | AI Test Generator |

---

## 🐛 第五步: 边界情况测试

### 5.1 混合语言环境

**测试场景:**
- 浏览器语言: en-US
- 时区: Asia/Shanghai

**操作:**
1. 清除语言偏好
2. 重新加载扩展

**预期结果:**
- ✅ 根据时区判断，显示中文界面

### 5.2 语言偏好优先级

**测试场景:**
- 浏览器语言: zh-CN
- localStorage: 'en'

**操作:**
1. 设置 `localStorage.setItem('midscene-language', 'en')`
2. 重新加载扩展

**预期结果:**
- ✅ localStorage 优先，显示英文界面

### 5.3 无效语言代码

**测试场景:**
- localStorage: 'invalid-lang'

**操作:**
1. 设置 `localStorage.setItem('midscene-language', 'invalid-lang')`
2. 重新加载扩展

**预期结果:**
- ✅ 忽略无效值，使用浏览器语言/时区检测

---

## ✅ 验收标准

### 必须通过的测试

- [ ] 中文环境自动显示中文界面
- [ ] 英文环境自动显示英文界面
- [ ] 手动切换到中文成功
- [ ] 手动切换到英文成功
- [ ] 清除偏好后恢复自动检测
- [ ] 所有菜单项正确本地化
- [ ] 所有导航栏标题正确本地化
- [ ] localStorage 优先级最高
- [ ] 时区判断正确工作

### 可选测试

- [ ] 在不同浏览器中测试（Edge, Brave 等）
- [ ] 在不同操作系统中测试（Windows, macOS, Linux）
- [ ] 测试页面功能正常

---

## 📸 验证截图建议

建议截取以下界面截图作为验证证据:

1. **中文界面**
   - 扩展 popup 主界面
   - 菜单展开状态
   - 不同模式的导航栏

2. **英文界面**
   - 扩展 popup 主界面
   - 菜单展开状态
   - 不同模式的导航栏

3. **测试页面**
   - 浏览器信息显示
   - 语言切换操作

---

## 🔍 故障排查

### 问题 1: 界面仍显示英文

**可能原因:**
- localStorage 中有旧的语言设置
- 浏览器缓存未清除

**解决方法:**
```javascript
localStorage.clear();
location.reload();
```

### 问题 2: 切换语言无效

**可能原因:**
- 未重新加载扩展

**解决方法:**
1. 访问 `chrome://extensions/`
2. 找到 Midscene.js 扩展
3. 点击刷新图标

### 问题 3: 构建失败

**可能原因:**
- 依赖未安装
- Node 版本不兼容

**解决方法:**
```bash
pnpm install
pnpm run build
```

---

## 📞 报告问题

如果发现任何问题，请提供以下信息:

1. **环境信息**
   - 浏览器版本
   - 操作系统
   - 浏览器语言设置
   - 系统时区

2. **复现步骤**
   - 详细的操作步骤
   - 预期结果
   - 实际结果

3. **截图或录屏**
   - 问题界面截图
   - 控制台错误信息

4. **localStorage 内容**
```javascript
console.log(localStorage.getItem('midscene-language'));
```

---

**验证完成后，请在下方打勾:**

- [ ] 所有必须测试已通过
- [ ] 已截取验证截图
- [ ] 已测试边界情况
- [ ] 功能符合预期

**验证人:** _______________  
**验证日期:** _______________  
**版本:** 1.0.4

