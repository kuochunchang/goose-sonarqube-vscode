# GitHub Actions Workflows

本项目使用 GitHub Actions 进行自动化 CI/CD。

## Workflows 概览

| Workflow | 触发条件 | 用途 |
|----------|---------|------|
| **CI** (`ci.yml`) | Push/PR 到 `main` 或 `develop` | 持续集成：测试、lint、构建 |
| **Release** (`release.yml`) | 推送版本标签 (如 `v1.0.0`) | 自动发布到 VS Code Marketplace |
| **Pre-Release** (`pre-release.yml`) | Push 到 `release/**` 分支或手动触发 | 发布前验证和测试 |

## Workflow 详细说明

### CI Workflow

**触发条件**:
- `push` 事件：当代码推送到 `main` 或 `develop` 分支
- `pull_request` 事件：对 `main` 或 `develop` 分支的 PR

**执行步骤**:
1. ✅ Checkout 代码
2. ✅ 设置 Node.js 20 环境
3. ✅ 安装依赖 (`npm ci`)
4. ✅ 运行 ESLint (`npm run lint`)
5. ✅ 检查 Prettier 格式 (`npm run format:check`)
6. ✅ 运行单元测试 (`npm run test`)
7. ✅ 构建扩展 (`npm run compile:production`)
8. ✅ 打包 VSIX 并上传为 artifact

**用途**: 确保所有提交和 PR 都通过质量检查。

---

### Release Workflow

**触发条件**:
- 推送版本标签，格式: `v*` (例如：`v1.0.0`, `v0.2.1`)

**执行步骤**:
1. ✅ Checkout 代码
2. ✅ 设置 Node.js 20 环境
3. ✅ 安装依赖
4. ✅ 运行测试和 lint
5. ✅ 构建并打包扩展
6. 🚀 **发布到 VS Code Marketplace**
7. 🚀 **发布到 Open VSX Registry**
8. 📦 创建 GitHub Release
9. 📎 上传 VSIX 文件到 Release

**所需 Secrets**:
- `VSCE_PAT`: VS Code Marketplace Personal Access Token (必需)
- `OPEN_VSX_TOKEN`: Open VSX Access Token (可选，但推荐)
- `GITHUB_TOKEN`: 自动提供，用于创建 Release

**用途**: 自动化发布流程，一键发布到两个扩展市场。

---

### Pre-Release Workflow

**触发条件**:
- Push 到 `release/**` 分支（如 `release/v1.0.0`）
- 手动触发（通过 Actions 页面）

**执行步骤**:
1. ✅ 完整 CI 流程（测试、lint、构建）
2. ✅ 验证 `package.json` 版本号格式
3. ✅ 打包 VSIX
4. 📎 上传 VSIX 为 artifact（保留 14 天）
5. 💬 在 PR 上评论构建结果（如果是 PR 触发）

**用途**: 发布前的最终验证，生成测试用 VSIX 包。

## 使用场景

### 场景 1: 日常开发

```bash
# 开发功能
git checkout -b feature/new-feature
# ... 编码 ...
git commit -m "feat: add new feature"
git push origin feature/new-feature
```

→ 创建 PR 到 `develop` 分支  
→ **CI Workflow** 自动运行  
→ 通过后合并

### 场景 2: 准备发布

```bash
# 创建 release 分支
git checkout -b release/v0.3.0

# 更新版本号
npm version 0.3.0
git push origin release/v0.3.0
```

→ **Pre-Release Workflow** 自动运行  
→ 下载 artifact 进行测试  
→ 确认无误后合并到 `main`

### 场景 3: 正式发布

```bash
# 在 main 分支上
git checkout main
git pull

# 创建版本标签
git tag v0.3.0
git push origin v0.3.0
```

→ **Release Workflow** 自动运行  
→ 自动发布到 VS Code Marketplace  
→ 自动创建 GitHub Release

### 场景 4: 手动测试构建

1. 访问 [Actions 页面](../../actions)
2. 选择 "Pre-Release" workflow
3. 点击 "Run workflow"
4. 选择分支并运行
5. 下载生成的 VSIX artifact 进行测试

## 状态徽章

可以在 README 中添加这些徽章来显示构建状态：

```markdown
![CI](https://github.com/kuochunchang/goose-sonarqube-vscode/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/kuochunchang/goose-sonarqube-vscode/actions/workflows/release.yml/badge.svg)
```

## 故障排查

### Workflow 失败

1. 访问 [Actions 页面](../../actions)
2. 点击失败的 workflow run
3. 查看失败的 job 和 step
4. 查看日志输出

### 发布失败

如果 Release workflow 失败：

1. 检查 `VSCE_TOKEN` 是否正确设置
2. 检查 token 是否过期
3. 检查版本号是否已存在
4. 查看详细日志确定具体错误

## 相关文档

- [发布指南](../RELEASE.md) - 完整的发布流程和 Token 设置
- [Open VSX 设置指南](../OPEN_VSX_SETUP.md) - Open VSX Registry 配置详解
- [开发指南](../../DEVELOPMENT.md) - 本地开发环境设置
- [GitHub Actions 文档](https://docs.github.com/en/actions)

