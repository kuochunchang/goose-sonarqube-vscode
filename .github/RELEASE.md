# 发布指南 (Release Guide)

本文档说明如何使用 GitHub Actions 自动发布扩展到 VS Code Marketplace。

## 设置步骤

### 1. 获取 VS Code Marketplace Personal Access Token (PAT)

#### 方式一：Azure DevOps Token (用于 VS Code Marketplace)

1. 访问 [Azure DevOps](https://dev.azure.com/)
2. 登录您的 Microsoft 账户（与 VS Code Marketplace 发布者账户相同）
3. 点击右上角用户图标 → **Personal access tokens**
4. 点击 **+ New Token**
5. 配置 Token：
   - **Name**: `vscode-marketplace-publish`
   - **Organization**: 选择 **All accessible organizations**
   - **Expiration**: 建议设置较长时间（如 1 年）
   - **Scopes**: 选择 **Custom defined**，然后勾选：
     - ✅ **Marketplace** → **Manage** (完整权限)
6. 点击 **Create** 并**立即复制 Token**（关闭后无法再查看）

#### 方式二：Open VSX Token (用于 Open VSX Registry)

1. 访问 [Open VSX Registry](https://open-vsx.org/)
2. 点击右上角 **Sign In** → 使用 GitHub 账号登录
3. 登录后，点击右上角头像 → **User Settings**
4. 在左侧菜单选择 **Access Tokens**
5. 点击 **New Access Token**
6. 配置 Token：
   - **Name**: `github-actions-publish`
   - **Description**: Token for publishing via GitHub Actions (可选)
7. 点击 **Create** 并**立即复制 Token**（只显示一次）

### 2. 配置 GitHub Secrets

1. 打开您的 GitHub 仓库
2. 进入 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 添加以下两个 secrets：

   **Secret 1: VS Code Marketplace Token**
   - **Name**: `VSCE_PAT`
   - **Value**: 粘贴 Azure DevOps Personal Access Token
   
   **Secret 2: Open VSX Token**
   - **Name**: `OPEN_VSX_TOKEN`
   - **Value**: 粘贴 Open VSX Access Token

5. 点击 **Add secret** 保存（需要分别添加两次）

## 发布流程

### 方式一：使用 Git Tags 自动发布（推荐）

这是最简单的方式，只需要创建一个版本标签：

```bash
# 1. 确保当前代码已提交
git status

# 2. 更新 package.json 中的版本号
npm version patch  # 0.2.0 → 0.2.1 (bug fixes)
# 或
npm version minor  # 0.2.0 → 0.3.0 (new features)
# 或
npm version major  # 0.2.0 → 1.0.0 (breaking changes)

# 3. 推送代码和标签到 GitHub
git push && git push --tags
```

**自动流程**:
- GitHub Actions 检测到新标签（如 `v0.2.1`）
- 自动执行测试、lint、构建
- 打包生成 `.vsix` 文件
- 自动发布到 **VS Code Marketplace**
- 自动发布到 **Open VSX Registry**
- 在 GitHub 创建 Release 并附加 `.vsix` 文件

### 方式二：手动创建 Release

1. 在 GitHub 仓库页面点击 **Releases** → **Draft a new release**
2. 点击 **Choose a tag** → 输入新版本号（如 `v0.2.1`）→ **Create new tag**
3. 填写 Release 标题和说明
4. 点击 **Publish release**
5. GitHub Actions 会自动触发发布流程

### 方式三：手动触发 (可选配置)

如果需要手动触发发布，可以在 `release.yml` 中添加：

```yaml
on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:  # 添加此行启用手动触发
```

然后在 GitHub 仓库的 **Actions** 页面可以手动运行 workflow。

## CI/CD Workflows 说明

### CI Pipeline (`ci.yml`)

**触发条件**: 
- Push 到 `main` 或 `develop` 分支
- 对 `main` 或 `develop` 分支的 Pull Request

**执行内容**:
1. 运行 ESLint 检查
2. 检查代码格式（Prettier）
3. 运行单元测试
4. 构建扩展
5. 生成 VSIX 包（作为 artifact 保存）

### Release Pipeline (`release.yml`)

**触发条件**: 
- 推送版本标签（如 `v1.0.0`）

**执行内容**:
1. 运行测试和 lint
2. 构建并打包扩展
3. 发布到 **VS Code Marketplace**
4. 发布到 **Open VSX Registry**
5. 创建 GitHub Release
6. 上传 VSIX 文件到 Release

## 版本号规范

遵循 [Semantic Versioning](https://semver.org/):

- **MAJOR** (主版本): 不兼容的 API 变更 - `1.0.0` → `2.0.0`
- **MINOR** (次版本): 新增功能，向后兼容 - `1.0.0` → `1.1.0`
- **PATCH** (补丁版本): Bug 修复，向后兼容 - `1.0.0` → `1.0.1`

## 发布前检查清单

在发布前请确认：

- [ ] 所有测试通过 (`npm test`)
- [ ] Lint 检查通过 (`npm run lint`)
- [ ] 代码格式正确 (`npm run format:check`)
- [ ] 构建成功 (`npm run package`)
- [ ] `package.json` 版本号已更新
- [ ] `README.md` 和 `CHANGELOG.md` 已更新
- [ ] 本地测试扩展功能正常
- [ ] 已提交所有代码到 Git

## 故障排查

### 发布失败：401 Unauthorized (VS Code Marketplace)

**原因**: VSCE_PAT 无效或过期

**解决方案**:
1. 重新生成 Azure DevOps Personal Access Token
2. 更新 GitHub Secrets 中的 `VSCE_PAT`

### 发布失败：Open VSX 发布错误

**原因**: OPEN_VSX_TOKEN 无效或缺失

**解决方案**:
1. 访问 https://open-vsx.org/ 重新生成 Access Token
2. 更新 GitHub Secrets 中的 `OPEN_VSX_TOKEN`

**注意**: Open VSX 发布设置了 `continue-on-error: true`，即使 Open VSX 发布失败，VS Code Marketplace 的发布仍会继续

### 发布失败：Version already exists

**原因**: 该版本号已在 Marketplace 上发布

**解决方案**:
1. 更新 `package.json` 中的版本号
2. 创建新的 Git 标签

### 构建失败

**原因**: 代码有 lint 错误或测试失败

**解决方案**:
1. 本地运行 `npm run lint` 和 `npm test`
2. 修复所有错误后重新推送

## 参考链接

### VS Code Marketplace
- [VS Code Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI](https://github.com/microsoft/vscode-vsce)
- [Azure DevOps Personal Access Tokens](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)

### Open VSX Registry
- [Open VSX Registry](https://open-vsx.org/)
- [Open VSX Publishing Guide](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
- [ovsx CLI](https://github.com/eclipse/openvsx/tree/master/cli)

### GitHub Actions
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

