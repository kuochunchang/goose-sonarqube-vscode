# 快速开始 - GitHub Actions 自动发布

本指南帮助您快速设置 GitHub Actions 自动发布到 VS Code Marketplace。

## 📋 准备工作

- [x] 已经有 GitHub 仓库
- [ ] 拥有 VS Code Marketplace 发布者账户
- [ ] 拥有 Open VSX 账户（可选，用于发布到开源市场）
- [ ] 已安装 `@vscode/vsce` (已包含在 `devDependencies` 中)

## 🚀 设置流程

### 步骤 1: 获取 VS Code Marketplace Token

1. 访问 https://dev.azure.com/
2. 登录 Microsoft 账户
3. 点击右上角 **用户图标** → **Personal access tokens**
4. 点击 **+ New Token**
5. 配置 Token：
   - Name: `vscode-marketplace-publish`
   - Organization: **All accessible organizations**
   - Expiration: 建议 **1 年**
   - Scopes: **Custom defined** → 勾选 **Marketplace (Manage)**
6. 点击 **Create** 并**立即复制** Token（只显示一次！）

### 步骤 2: 获取 Open VSX Token (可选但推荐)

1. 访问 https://open-vsx.org/
2. 点击右上角 **Sign In** → 使用 **GitHub 账号**登录
3. 登录后，点击右上角头像 → **User Settings**
4. 在左侧菜单选择 **Access Tokens**
5. 点击 **New Access Token**
6. 配置：
   - Name: `github-actions-publish`
7. 点击 **Create** 并**立即复制** Token

> 💡 **为什么需要 Open VSX？**  
> Open VSX 是开源的扩展市场，被 VSCodium、Eclipse Theia、Gitpod 等编辑器使用。同时发布到两个市场可以覆盖更多用户！

### 步骤 3: 添加 GitHub Secrets

1. 打开 GitHub 仓库: https://github.com/kuochunchang/goose-sonarqube-vscode
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 添加第一个 secret:
   - 点击 **New repository secret**
   - Name: `VSCE_PAT`
   - Value: 粘贴 VS Code Marketplace Token
   - 点击 **Add secret**
4. 添加第二个 secret (如果有 Open VSX Token):
   - 再次点击 **New repository secret**
   - Name: `OPEN_VSX_TOKEN`
   - Value: 粘贴 Open VSX Token
   - 点击 **Add secret**

> ⚠️ **注意**: 如果不设置 `OPEN_VSX_TOKEN`，只会跳过 Open VSX 发布，不会影响 VS Code Marketplace 的发布。

### 步骤 4: 推送 Workflows 到 GitHub

```bash
# 确保您在项目根目录
cd /Users/kc.chang/workspace/goose-sonarqube-vscode

# 添加新文件
git add .github/

# 提交
git commit -m "ci: add GitHub Actions workflows for automated publishing"

# 推送到 GitHub
git push origin main
```

### 步骤 5: 更新版本号

```bash
# 更新到新版本（例如 0.2.1）
npm version patch

# 或者手动编辑 package.json
# "version": "0.2.1"
```

### 步骤 6: 创建 Release 标签

```bash
# 推送代码
git push

# 创建并推送标签
git tag v0.2.1
git push origin v0.2.1
```

🎉 **完成！** GitHub Actions 会自动：
- 运行测试和 lint
- 构建扩展
- 发布到 **VS Code Marketplace**
- 发布到 **Open VSX Registry** (如果配置了 Token)
- 创建 GitHub Release

## 📊 查看发布进度

1. 访问 [Actions 页面](https://github.com/kuochunchang/goose-sonarqube-vscode/actions)
2. 点击 **Release** workflow
3. 查看最新的 run

## ✅ 验证发布成功

发布完成后（约 5-10 分钟）：

### 1. VS Code Marketplace
访问: https://marketplace.visualstudio.com/items?itemName=kuochunchang.goose-sonarqube-vscode

或在 VS Code 中搜索 "Goose SonarQube"

### 2. Open VSX Registry
访问: https://open-vsx.org/extension/kuochunchang/goose-sonarqube-vscode

或在 VSCodium 中搜索 "Goose SonarQube"

### 3. GitHub Releases
访问: https://github.com/kuochunchang/goose-sonarqube-vscode/releases

## 🔄 日常发布流程

以后每次发布只需要 2 个命令：

```bash
# 1. 更新版本号（自动创建 commit）
npm version patch  # 或 minor / major

# 2. 推送标签（自动触发发布）
git push && git push --tags
```

就这么简单！🎯

## 🐛 常见问题

### Q: 发布失败，提示 "401 Unauthorized"

**A:** Token 无效或过期，需要：

**如果是 VS Code Marketplace 失败**:
1. 重新生成 Azure DevOps Personal Access Token
2. 更新 GitHub Secrets 中的 `VSCE_PAT`

**如果是 Open VSX 失败**:
1. 访问 https://open-vsx.org/ 重新生成 Token
2. 更新 GitHub Secrets 中的 `OPEN_VSX_TOKEN`

> 💡 Open VSX 发布失败不会影响 VS Code Marketplace 的发布

### Q: 发布失败，提示 "Version already exists"

**A:** 该版本号已经发布过，需要：
1. 更新 `package.json` 中的版本号
2. 创建新的 Git 标签

### Q: CI 测试失败

**A:** 在本地先运行：
```bash
npm run lint     # 检查代码规范
npm test         # 运行测试
npm run package  # 测试打包
```

修复所有错误后再推送。

### Q: 如何发布 beta 版本？

**A:** 使用 pre-release 版本号：
```bash
# 版本格式: X.Y.Z-beta.N
npm version 0.3.0-beta.1

# 推送标签
git push && git push --tags
```

然后使用 `vsce publish --pre-release` 发布为预发布版本。

## 📚 更多资源

- [完整发布指南](./RELEASE.md)
- [Workflows 说明](./workflows/README.md)
- [开发指南](../DEVELOPMENT.md)
- [VS Code Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

---

需要帮助？查看 [GitHub Discussions](https://github.com/kuochunchang/goose-sonarqube-vscode/discussions) 或提交 [Issue](https://github.com/kuochunchang/goose-sonarqube-vscode/issues)。

