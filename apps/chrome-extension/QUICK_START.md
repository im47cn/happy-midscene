# 🚀 Midscene.js Chrome 扩展快速开始

## 📋 目录

- [构建状态](#构建状态)
- [5分钟快速上手](#5分钟快速上手)
- [功能演示](#功能演示)
- [常用命令](#常用命令)
- [故障排除](#故障排除)

---

## ✅ 构建状态

**当前构建已完成！**

```
✓ 构建产物: apps/chrome-extension/dist/
✓ 打包文件: apps/chrome-extension/extension_output/midscene-extension-v1.0.4.zip (8.8MB)
✓ Manifest 版本: V3
✓ 扩展版本: 1.4
✓ 多语言支持: 中文/English (自动检测)
```

---

## 🎯 5分钟快速上手

### 步骤 1: 打开 Chrome 扩展页面

在 Chrome 地址栏输入并访问:

```
chrome://extensions/
```

或者运行命令:

```bash
open -a 'Google Chrome' 'chrome://extensions/'
```

### 步骤 2: 启用开发者模式

在扩展页面右上角，打开 **"开发者模式"** 开关。

### 步骤 3: 加载扩展

1. 点击左上角的 **"加载已解压的扩展程序"** 按钮
2. 导航到项目目录并选择:

   ```
   /Users/dreambt/sources/happy-midscene/apps/chrome-extension/dist
   ```

3. 点击 **"选择"** 按钮

### 步骤 4: 验证安装

✅ 扩展列表中应该出现 **Midscene.js** 扩展
✅ 浏览器工具栏出现 Midscene.js 图标
✅ 状态显示为 "已启用"

### 步骤 5: 开始使用

1. 打开任意网页（推荐: <https://www.google.com）>
2. 点击工具栏的 Midscene.js 图标
3. 侧边栏打开，开始体验！

---

## 🎬 功能演示

### 演示 1: Playground 模式 - 自动化搜索

**场景**: 在 Google 上自动搜索

1. 打开 <https://www.google.com>
2. 点击 Midscene.js 图标打开侧边栏
3. 在 Playground 输入框中输入:

   ```
   在搜索框中输入 "Midscene.js 自动化测试"
   ```

4. 点击执行按钮
5. 观察页面自动执行操作

**预期效果**: Google 搜索框自动填入文本

---

### 演示 2: Recorder 模式 - 录制操作

**场景**: 录制用户在网页上的操作

1. 打开任意网页
2. 打开 Midscene.js 侧边栏
3. 点击菜单图标（☰），选择 **"Recorder"**
4. 点击 **"开始录制"** 按钮
5. 在页面上执行一些操作:
   - 点击按钮
   - 填写表单
   - 滚动页面
6. 点击 **"停止录制"**
7. 查看录制的操作步骤

**预期效果**: 所有操作被准确记录并显示

---

### 演示 3: Bridge 模式 - 页面通信

**场景**: 与页面进行数据交互

1. 打开侧边栏
2. 切换到 **"Bridge Mode"**
3. 查看页面元素信息
4. 测试数据传输功能

**预期效果**: 能够查看和操作页面数据

---

### 演示 4: AI Test Generator - 智能测试生成

**场景**: 使用 AI 生成测试用例

1. 打开侧边栏
2. 切换到 **"AI Test Generator"**
3. 浏览模板市场
4. 选择或创建测试模板

**预期效果**: AI 辅助生成测试脚本

---

## 🛠️ 常用命令

### 开发相关

```bash
# 进入扩展目录
cd apps/chrome-extension

# 构建扩展（生产模式）
pnpm run build

# 开发模式（支持热重载）
pnpm run dev

# 运行测试
pnpm run test

# 打包扩展为 ZIP
pnpm run pack-extension
```

### 验证构建

```bash
# 运行集成测试脚本
./test-extension.sh

# 检查构建产物
ls -lh dist/

# 检查打包文件
ls -lh extension_output/
```

### Chrome 操作

```bash
# 打开扩展管理页面
open -a 'Google Chrome' 'chrome://extensions/'

# 打开 Chrome 开发者工具
# 在侧边栏右键 → 检查
```

---

## 🔧 故障排除

### 问题 1: 扩展无法加载

**症状**: 点击"加载已解压的扩展程序"后没有反应

**解决方案**:

1. 确认选择的是 `dist` 文件夹，不是项目根目录
2. 检查 `dist/manifest.json` 是否存在
3. 查看 Chrome 扩展页面是否有错误提示
4. 尝试重新构建: `pnpm run build`

---

### 问题 2: 侧边栏打不开

**症状**: 点击扩展图标没有反应

**解决方案**:

1. 右键点击扩展图标 → 检查弹出窗口
2. 查看控制台是否有错误
3. 刷新扩展: 在 `chrome://extensions/` 点击刷新图标
4. 重新加载页面

---

### 问题 3: 功能不工作

**症状**: 自动化指令执行失败

**解决方案**:

1. 检查是否在受限页面（如 `chrome://`）
2. 确认页面已完全加载
3. 查看浏览器控制台错误信息
4. 尝试在简单页面（如 Google）测试

---

### 问题 4: AI 功能不可用

**症状**: AI Test Generator 无法使用

**解决方案**:

1. 需要配置 OpenAI API Key
2. 点击设置图标进行配置
3. 或设置环境变量:

   ```bash
   export OPENAI_API_KEY="your-api-key"
   ```

---

### 问题 5: 构建失败

**症状**: `pnpm run build` 报错

**解决方案**:

1. 清理缓存:

   ```bash
   pnpm run clean
   ```

2. 重新安装依赖:

   ```bash
   pnpm install
   ```

3. 检查 Node.js 版本 (需要 >= 18.19.0)
4. 查看具体错误信息

---

## 📚 更多资源

- **详细安装指南**: [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)
- **测试用例**: [TEST_CASES.md](./TEST_CASES.md)
- **项目文档**: [README.md](./README.md)
- **官方网站**: <https://midscenejs.com>

---

## 🎉 开始测试

现在你已经准备好了！按照上面的步骤:

1. ✅ 加载扩展到 Chrome
2. ✅ 打开测试网页
3. ✅ 点击扩展图标
4. ✅ 开始体验自动化功能

**祝测试愉快！** 🚀

---

## 💡 提示

- 使用 **Playground** 模式快速测试自动化指令
- 使用 **Recorder** 模式录制复杂的操作流程
- 使用 **Bridge** 模式进行高级页面交互
- 使用 **AI Generator** 模式智能生成测试用例

有问题？查看 [故障排除](#故障排除) 部分或提交 Issue。
