# ✅ GitHub Actions 自动发布设置完成

恭喜！您的项目已经配置好 GitHub Actions 自动发布功能。

## 📦 已创建的文件

### Workflows (自动化流程)

```
.github/workflows/
├── ci.yml              # 持续集成：测试、lint、构建
├── release.yml         # 自动发布到 VS Code Marketplace
└── pre-release.yml     # 发布前测试和验证
```

### 文档

```
.github/
├── RELEASE.md          # 完整发布指南（中文）
├── QUICKSTART.md       # 快速开始指南（中文）
└── workflows/README.md # Workflows 详细说明（中文）

CHANGELOG.md            # 版本变更记录
README.md               # 更新了安装和发布说明
```

## 🎯 下一步行动

### 1️⃣ 立即执行：设置 Marketplace Tokens

**这是唯一必须手动完成的步骤！**

#### 必需：VS Code Marketplace Token
1. 访问 https://dev.azure.com/
2. 创建 Personal Access Token (详细步骤见 [QUICKSTART.md](./.github/QUICKSTART.md))
3. 在 GitHub 仓库添加 Secret：
   - 名称: `VSCE_PAT`
   - 值: 您的 Azure DevOps Token

#### 推荐：Open VSX Token (覆盖更多用户)
1. 访问 https://open-vsx.org/ 并用 GitHub 登录
2. 创建 Access Token (详细步骤见 [QUICKSTART.md](./.github/QUICKSTART.md))
3. 在 GitHub 仓库添加 Secret：
   - 名称: `OPEN_VSX_TOKEN`
   - 值: 您的 Open VSX Token

⏱️ **预计时间**: 8-10 分钟 (两个 Token)

📖 **详细指南**: [.github/QUICKSTART.md](./.github/QUICKSTART.md)

### 2️⃣ 推送到 GitHub

```bash
# 添加新文件
git add .github/ CHANGELOG.md README.md

# 提交
git commit -m "ci: add GitHub Actions workflows for automated publishing"

# 推送
git push origin main
```

### 3️⃣ 测试自动发布

```bash
# 更新版本号
npm version patch

# 推送并触发发布
git push && git push --tags
```

🚀 **GitHub Actions 会自动发布到 VS Code Marketplace 和 Open VSX Registry！**

## 🔍 验证设置

### 检查 GitHub Actions

访问: https://github.com/kuochunchang/goose-sonarqube-vscode/actions

您应该看到：
- ✅ CI workflow (绿色勾)
- ✅ Release workflow (标签推送后)

### 检查发布状态

**VS Code Marketplace**:  
访问: https://marketplace.visualstudio.com/manage/publishers/kuochunchang

您应该看到：
- ✅ `goose-sonarqube-vscode` 扩展
- ✅ 最新版本号

**Open VSX Registry**:  
访问: https://open-vsx.org/user-settings/namespaces

您应该看到：
- ✅ 扩展已发布
- ✅ 版本号更新

## 📊 Workflows 触发条件

| Workflow | 何时运行 | 做什么 |
|----------|---------|--------|
| **CI** | 每次 push/PR 到 `main`/`develop` | 测试、lint、构建 |
| **Release** | 推送版本标签 (如 `v0.2.1`) | 发布到 VS Code Marketplace + Open VSX + 创建 GitHub Release |
| **Pre-Release** | Push 到 `release/**` 或手动触发 | 生成测试用 VSIX 包 |

## 🎓 学习资源

### 快速上手
- 📘 [快速开始指南](./QUICKSTART.md) - 5 步完成设置
- 📗 [发布指南](./RELEASE.md) - 详细发布流程和故障排查

### 深入了解
- 📙 [Workflows 说明](./workflows/README.md) - 每个 workflow 的详细说明
- 📕 [开发指南](../DEVELOPMENT.md) - 本地开发环境

### 官方文档
- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)

## 🔄 日常工作流

### 开发新功能
```bash
git checkout -b feature/awesome-feature
# ... 编码 ...
git commit -m "feat: add awesome feature"
git push origin feature/awesome-feature
# 创建 PR → CI 自动运行
```

### 发布新版本
```bash
# 更新版本号（自动创建 commit 和 tag）
npm version patch  # 或 minor / major

# 推送（自动触发发布）
git push && git push --tags

# 等待 5-10 分钟，查看:
# - GitHub Actions: https://github.com/kuochunchang/goose-sonarqube-vscode/actions
# - Marketplace: https://marketplace.visualstudio.com/items?itemName=kuochunchang.goose-sonarqube-vscode
```

### 发布前测试
```bash
# 创建 release 分支
git checkout -b release/v0.3.0

# 推送（触发 Pre-Release workflow）
git push origin release/v0.3.0

# 从 Actions 下载 VSIX 进行测试
# 测试通过后合并到 main 并打标签发布
```

## 🐛 故障排查

### ❌ Release 失败: "401 Unauthorized"

**原因**: Token 无效或过期

**解决**:
1. 重新生成 Personal Access Token
2. 更新 GitHub Secret `VSCE_PAT`

### ❌ Release 失败: "Version already exists"

**原因**: 版本号重复

**解决**:
```bash
# 更新版本号
npm version patch
git push && git push --tags
```

### ❌ CI 失败

**原因**: 代码有 lint 或测试错误

**解决**:
```bash
# 本地检查
npm run lint
npm test
npm run package

# 修复错误后重新推送
```

## 📈 监控发布状态

### GitHub Actions 徽章

在 README 中添加状态徽章：

```markdown
![CI](https://github.com/kuochunchang/goose-sonarqube-vscode/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/kuochunchang/goose-sonarqube-vscode/actions/workflows/release.yml/badge.svg)
```

### 通知

GitHub Actions 会在以下情况发送邮件通知：
- ✅ 发布成功
- ❌ 发布失败
- ⚠️ CI 失败

## 🎉 完成！

您现在拥有一个完全自动化的 CI/CD 流程：

- ✅ 每次提交自动测试
- ✅ 每次标签自动发布到两个市场
- ✅ 同时发布到 VS Code Marketplace 和 Open VSX
- ✅ 自动创建 GitHub Release
- ✅ 自动上传 VSIX 文件
- ✅ 发布前自动验证

**只需一个命令即可发布新版本：**

```bash
npm version patch && git push --follow-tags
```

就是这么简单！🚀

---

**需要帮助？**

- 📖 查看 [QUICKSTART.md](./QUICKSTART.md)
- 📖 查看 [RELEASE.md](./RELEASE.md)
- 💬 提交 [GitHub Issue](https://github.com/kuochunchang/goose-sonarqube-vscode/issues)
- 💬 访问 [GitHub Discussions](https://github.com/kuochunchang/goose-sonarqube-vscode/discussions)

**祝发布顺利！** 🎊

