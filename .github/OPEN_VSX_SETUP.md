# Open VSX Registry 设置指南

本指南说明如何配置 Open VSX Registry 发布功能。

## 什么是 Open VSX？

**Open VSX Registry** 是一个由 Eclipse 基金会运营的开源扩展市场，类似于 VS Code Marketplace，但完全开源。

### 为什么需要 Open VSX？

许多开源编辑器和 IDE 使用 Open VSX 作为扩展市场：

- 🦆 **VSCodium** - 开源的 VS Code 构建版本
- 🌐 **Eclipse Theia** - 云和桌面 IDE 平台
- 🚀 **Gitpod** - 云端开发环境
- 🎯 **Eclipse Che** - Kubernetes 原生 IDE
- 📦 其他基于 VS Code 的开源项目

同时发布到 VS Code Marketplace 和 Open VSX 可以：
- ✅ 覆盖更广泛的用户群体
- ✅ 支持开源生态系统
- ✅ 为隐私导向的用户提供选择
- ✅ 在企业环境中提供替代方案

## 快速设置步骤

### 1. 创建 Open VSX 账户

1. 访问 https://open-vsx.org/
2. 点击右上角 **Sign In**
3. 选择 **GitHub** 登录（推荐）
4. 授权 Open VSX 访问您的 GitHub 账户

> 💡 使用 GitHub 登录非常方便，且与您的开发者身份关联

### 2. 生成 Access Token

1. 登录后，点击右上角的头像
2. 选择 **User Settings**
3. 在左侧菜单选择 **Access Tokens**
4. 点击 **New Access Token**
5. 填写信息：
   - **Name**: `github-actions-publish` (或任意描述性名称)
   - **Description**: (可选) "Token for automated publishing via GitHub Actions"
6. 点击 **Create**
7. **立即复制** Token（只显示一次！）

### 3. 添加到 GitHub Secrets

1. 打开您的 GitHub 仓库
2. 进入 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 输入：
   - **Name**: `OPEN_VSX_TOKEN`
   - **Value**: 粘贴刚才复制的 Access Token
5. 点击 **Add secret**

### 4. 验证设置

推送一个测试标签来验证发布：

```bash
# 创建测试标签
git tag v0.0.1-test
git push origin v0.0.1-test

# 查看 GitHub Actions 运行结果
# 访问: https://github.com/kuochunchang/goose-sonarqube-vscode/actions
```

如果发布成功，您应该能在以下位置看到扩展：
- https://open-vsx.org/extension/kuochunchang/goose-sonarqube-vscode

## 工作流说明

### Release Workflow 中的 Open VSX 步骤

```yaml
- name: Publish to Open VSX Registry
  if: github.event_name == 'release' || github.event_name == 'push'
  run: |
    npx ovsx publish *.vsix -p ${{ secrets.OPEN_VSX_TOKEN }}
  continue-on-error: true
```

**关键点**：
- 使用 `ovsx` CLI 工具发布
- 使用 `continue-on-error: true` 确保即使 Open VSX 发布失败，VS Code Marketplace 的发布仍会继续
- 发布已有的 `.vsix` 文件（与 VS Code Marketplace 使用同一个包）

## 常见问题

### Q: 是否必须配置 Open VSX？

**A:** 不是必须的。如果不配置 `OPEN_VSX_TOKEN`：
- ✅ VS Code Marketplace 的发布仍会正常进行
- ⚠️ Open VSX 发布步骤会跳过（但不会失败）
- ℹ️ 只有 VS Code 用户能安装您的扩展

### Q: Open VSX 和 VS Code Marketplace 有什么区别？

**A:** 主要区别：

| 特性 | VS Code Marketplace | Open VSX Registry |
|------|---------------------|-------------------|
| 运营方 | Microsoft | Eclipse Foundation |
| 开源 | ❌ 否 | ✅ 是 |
| 主要用户 | VS Code | VSCodium, Theia, Gitpod 等 |
| 发布方式 | `vsce` CLI | `ovsx` CLI |
| Token 来源 | Azure DevOps | Open VSX 网站 |
| 审核流程 | 自动 | 自动（首次可能需要人工审核） |

### Q: 首次发布到 Open VSX 需要注意什么？

**A:** 首次发布可能需要：

1. **命名空间验证**：
   - 首次使用 `kuochunchang` 命名空间时，Open VSX 可能会要求验证
   - 通常通过 GitHub 账户所有权自动验证
   - 如果遇到问题，访问 https://github.com/EclipseFdn/open-vsx.org/issues

2. **扩展信息**：
   - 确保 `package.json` 中有完整的信息（`description`, `repository`, `license` 等）
   - 建议添加 `icon` 和 `categories`

3. **版本管理**：
   - Open VSX 和 VS Code Marketplace 可以使用不同的版本号
   - 但建议保持一致以避免混淆

### Q: 如何查看 Open VSX 发布状态？

**A:** 有以下几种方式：

1. **GitHub Actions 日志**：
   - 访问 Actions 页面
   - 查看 Release workflow 的 "Publish to Open VSX Registry" 步骤

2. **Open VSX 网站**：
   - 访问: https://open-vsx.org/user-settings/extensions
   - 查看您已发布的扩展列表

3. **Open VSX API**：
   ```bash
   curl https://open-vsx.org/api/kuochunchang/goose-sonarqube-vscode
   ```

### Q: Open VSX 发布失败了怎么办？

**A:** 常见错误及解决方案：

#### 错误 1: "401 Unauthorized"
**原因**: Token 无效或过期  
**解决**: 
1. 重新生成 Access Token
2. 更新 GitHub Secret `OPEN_VSX_TOKEN`

#### 错误 2: "Extension already exists"
**原因**: 命名空间已被占用  
**解决**:
1. 检查是否已在 Open VSX 上发布过
2. 如需要命名空间，访问 https://github.com/EclipseFdn/open-vsx.org/issues

#### 错误 3: "Invalid VSIX file"
**原因**: VSIX 文件格式问题  
**解决**:
1. 确保 `package.json` 符合规范
2. 本地测试: `npx ovsx verify-pat <token>`
3. 检查文件大小和内容

#### 错误 4: 首次发布命名空间问题
**原因**: 命名空间需要验证  
**解决**:
1. 确保 GitHub 账户名与 publisher 匹配
2. 访问 Open VSX 网站的 User Settings 验证账户
3. 如需帮助，在 https://github.com/EclipseFdn/open-vsx.org/issues 提交 issue

### Q: 如何手动发布到 Open VSX？

**A:** 如果 GitHub Actions 发布失败，可以手动发布：

```bash
# 1. 安装 ovsx CLI
npm install -g ovsx

# 2. 打包扩展
npm run package

# 3. 发布到 Open VSX
ovsx publish goose-sonarqube-vscode-*.vsix -p <YOUR_TOKEN>

# 或者使用环境变量
export OVSX_PAT=<YOUR_TOKEN>
ovsx publish goose-sonarqube-vscode-*.vsix
```

### Q: 可以只发布到 Open VSX 而不发布到 VS Code Marketplace 吗？

**A:** 可以，但需要修改 workflow：

在 `.github/workflows/release.yml` 中：

```yaml
# 注释掉 VS Code Marketplace 发布步骤
# - name: Publish to VS Code Marketplace
#   run: npx @vscode/vsce publish -p ${{ secrets.VSCE_PAT }}

# 保留 Open VSX 发布步骤
- name: Publish to Open VSX Registry
  run: npx ovsx publish *.vsix -p ${{ secrets.OPEN_VSX_TOKEN }}
```

## 最佳实践

### 1. 保持版本一致

在两个市场使用相同的版本号，避免用户混淆：

```json
{
  "version": "1.0.0"
}
```

### 2. 完善扩展信息

确保 `package.json` 包含完整信息：

```json
{
  "name": "goose-sonarqube-vscode",
  "displayName": "Goose SonarQube",
  "description": "SonarQube integration and Git change analysis for VS Code",
  "version": "0.2.0",
  "publisher": "kuochunchang",
  "icon": "resources/icons/extension-icon.jpg",
  "repository": {
    "type": "git",
    "url": "https://github.com/kuochunchang/goose-sonarqube-vscode.git"
  },
  "license": "MIT",
  "keywords": ["sonarqube", "code-quality", "git", "analysis"],
  "categories": ["Linters", "Other"]
}
```

### 3. 添加 Open VSX 徽章

在 README 中添加徽章：

```markdown
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/kuochunchang.goose-sonarqube-vscode)](https://marketplace.visualstudio.com/items?itemName=kuochunchang.goose-sonarqube-vscode)
[![Open VSX](https://img.shields.io/open-vsx/v/kuochunchang/goose-sonarqube-vscode)](https://open-vsx.org/extension/kuochunchang/goose-sonarqube-vscode)
```

### 4. 文档中提及两个市场

在安装说明中同时提及 VS Code Marketplace 和 Open VSX：

```markdown
## Installation

### VS Code
```bash
code --install-extension kuochunchang.goose-sonarqube-vscode
```

### VSCodium
```bash
codium --install-extension kuochunchang.goose-sonarqube-vscode
```
```

## 相关资源

### 官方文档
- [Open VSX Registry](https://open-vsx.org/)
- [Open VSX GitHub](https://github.com/eclipse/openvsx)
- [Publishing Guide](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
- [ovsx CLI](https://github.com/eclipse/openvsx/tree/master/cli)

### 支持的编辑器
- [VSCodium](https://vscodium.com/)
- [Eclipse Theia](https://theia-ide.org/)
- [Gitpod](https://www.gitpod.io/)
- [Eclipse Che](https://www.eclipse.org/che/)

### 社区
- [Open VSX Issues](https://github.com/EclipseFdn/open-vsx.org/issues)
- [Eclipse Foundation](https://www.eclipse.org/)

---

**配置完成后**，您的扩展将同时出现在两个市场，覆盖更广泛的用户群体！🎉


