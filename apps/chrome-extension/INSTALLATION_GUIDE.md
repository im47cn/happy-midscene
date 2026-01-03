# Chrome 扩展安装与集成测试指南

## 📦 构建状态

✅ **构建成功完成！**

- **构建产物目录**: `apps/chrome-extension/dist/`
- **打包文件**: `apps/chrome-extension/extension_output/midscene-extension-v1.0.4.zip` (8.8MB)
- **构建时间**: 约 22.5 秒

## 🚀 安装步骤

### 方法一：加载未打包的扩展（推荐用于开发测试）

1. **打开 Chrome 扩展管理页面**
   - 在 Chrome 浏览器地址栏输入: `chrome://extensions/`
   - 或者点击菜单 → 更多工具 → 扩展程序

2. **启用开发者模式**
   - 在页面右上角找到"开发者模式"开关
   - 将其切换为**开启**状态

3. **加载扩展**
   - 点击左上角的"加载已解压的扩展程序"按钮
   - 在文件选择器中导航到项目目录
   - 选择 `apps/chrome-extension/dist` 文件夹
   - 点击"选择"按钮

4. **验证安装**
   - 扩展列表中应该出现 **Midscene.js** 扩展
   - 图标显示为蓝色的 Midscene logo
   - 状态应该是"已启用"

### 方法二：从 ZIP 文件安装

1. **解压 ZIP 文件**

   ```bash
   cd apps/chrome-extension/extension_output
   unzip midscene-extension-v1.0.4.zip -d midscene-unpacked
   ```

2. **按照方法一的步骤 1-4 操作**
   - 在步骤 3 中选择解压后的 `midscene-unpacked` 文件夹

## 🧪 集成测试清单

### 1. 基础功能测试

#### 1.1 扩展加载测试

- [ ] 扩展图标显示在浏览器工具栏
- [ ] 点击扩展图标能打开侧边栏面板
- [ ] 侧边栏显示正常，无控制台错误

#### 1.2 Playground 模式测试

- [ ] 打开任意网页（如 <https://google.com）>
- [ ] 点击扩展图标打开侧边栏
- [ ] 在 Playground 中输入测试指令，例如：

  ```
  在搜索框中输入 "Midscene.js"
  ```

- [ ] 验证指令是否正确执行

#### 1.3 Recorder 模式测试

- [ ] 切换到 Recorder 模式（点击菜单图标选择）
- [ ] 点击"开始录制"按钮
- [ ] 在页面上执行一些操作（点击、输入等）
- [ ] 停止录制
- [ ] 验证录制的操作是否正确显示

#### 1.4 Bridge 模式测试

- [ ] 切换到 Bridge 模式
- [ ] 验证 Bridge 界面正常显示
- [ ] 测试与页面的通信功能

#### 1.5 AI Test Generator 测试

- [ ] 切换到 AI Test Generator 模式
- [ ] 验证 AI 测试生成界面正常显示
- [ ] 测试模板市场功能（需要配置 AI API）

### 2. 权限测试

- [ ] 验证扩展可以访问当前标签页
- [ ] 验证扩展可以注入脚本到页面
- [ ] 验证扩展可以捕获屏幕截图

### 3. 性能测试

- [ ] 打开扩展后，页面响应速度正常
- [ ] 执行自动化操作时，浏览器不卡顿
- [ ] 检查 Chrome 任务管理器中扩展的内存占用

### 4. 兼容性测试

测试以下网站的兼容性：

- [ ] Google (<https://google.com>)
- [ ] GitHub (<https://github.com>)
- [ ] 本地开发网站
- [ ] 复杂的 SPA 应用

## 🔧 常见问题排查

### 问题 1: 扩展无法加载

**解决方案**:

- 确认选择的是 `dist` 文件夹，而不是项目根目录
- 检查 `dist/manifest.json` 文件是否存在
- 查看 Chrome 扩展页面的错误信息

### 问题 2: 侧边栏打不开

**解决方案**:

- 检查浏览器控制台是否有错误
- 尝试重新加载扩展
- 确认 Chrome 版本支持 Manifest V3

### 问题 3: AI 功能不工作

**解决方案**:

- 需要配置 AI API 密钥
- 点击设置图标，配置 OpenAI API Key
- 或设置环境变量 `OPENAI_API_KEY`

## 📝 开发模式

如果需要在开发模式下运行（支持热重载）：

```bash
cd apps/chrome-extension
pnpm run dev
```

这将启动开发服务器并自动打开 Chrome 浏览器加载扩展。

## 🔄 更新扩展

当代码有更新时：

1. **重新构建**:

   ```bash
   cd apps/chrome-extension
   pnpm run build
   ```

2. **重新加载扩展**:
   - 在 `chrome://extensions/` 页面
   - 找到 Midscene.js 扩展
   - 点击刷新图标 🔄

## 📊 测试报告模板

```markdown
## 测试环境
- Chrome 版本:
- 操作系统:
- 扩展版本: 1.0.4

## 测试结果
- Playground 模式: ✅/❌
- Recorder 模式: ✅/❌
- Bridge 模式: ✅/❌
- AI Generator 模式: ✅/❌

## 发现的问题
1.
2.

## 备注
```

---

**祝测试顺利！** 🎉
