# ✅ 双市场发布配置完成

恭喜！您的 VS Code Extension 现在可以同时发布到 **VS Code Marketplace** 和 **Open VSX Registry**！

## 🎯 配置概述

### 已完成的工作

✅ **GitHub Actions Workflows**
- 改进了 CI workflow（多版本测试、Coverage）
- 增强了 Release workflow（双市场发布）
- 新增了 Pre-Release workflow（发布前测试）

✅ **发布目标**
- 🔵 **VS Code Marketplace** - Microsoft 官方市场
- 🟢 **Open VSX Registry** - Eclipse 开源市场

✅ **完整文档**（全中文）
- 📘 快速开始指南
- 📘 详细发布指南
- 📘 Open VSX 专门配置指南
- 📘 Workflows 说明文档
- 📘 版本变更记录模板

## 📦 覆盖的用户群体

### VS Code Marketplace 用户
- ⚡ **Visual Studio Code** - 最流行的代码编辑器
- 📊 估计覆盖：~1400 万活跃用户

### Open VSX Registry 用户
- 🦆 **VSCodium** - 开源 VS Code（无 Microsoft 遥测）
- 🌐 **Eclipse Theia** - 云和桌面 IDE
- 🚀 **Gitpod** - 云端开发环境
- 🎯 **Eclipse Che** - Kubernetes 原生 IDE
- 📊 估计覆盖：数十万开源生态用户

**总计：覆盖更广泛的开发者社区！** 🌍

## 🚀 下一步：设置两个 Tokens

您需要设置两个 GitHub Secrets：

### 1️⃣ VS Code Marketplace Token（必需）

**获取方式**：
1. 访问 https://dev.azure.com/
2. 创建 Personal Access Token
3. Scopes: **Marketplace (Manage)**

**添加到 GitHub**：
- Secret 名称: `VSCE_PAT`
- Secret 值: 您的 Azure DevOps Token

⏱️ **时间**: ~5 分钟  
📖 **详细步骤**: [QUICKSTART.md](./QUICKSTART.md#步骤-1-获取-vs-code-marketplace-token)

### 2️⃣ Open VSX Token（推荐）

**获取方式**：
1. 访问 https://open-vsx.org/
2. 用 GitHub 账号登录
3. User Settings → Access Tokens → 创建新 Token

**添加到 GitHub**：
- Secret 名称: `OPEN_VSX_TOKEN`
- Secret 值: 您的 Open VSX Token

⏱️ **时间**: ~3 分钟  
📖 **详细步骤**: [OPEN_VSX_SETUP.md](./OPEN_VSX_SETUP.md#快速设置步骤)

> 💡 **提示**: 如果不设置 `OPEN_VSX_TOKEN`，扩展仍会发布到 VS Code Marketplace，只是跳过 Open VSX。

## 📋 文件清单

### Workflows (自动化流程)
```
.github/workflows/
├── ci.yml              ✅ 持续集成（测试、lint、构建）
├── release.yml         ✅ 双市场发布
└── pre-release.yml     ✅ 发布前验证
```

### 文档 (全中文)
```
.github/
├── QUICKSTART.md           📘 5 分钟快速设置
├── RELEASE.md              📘 完整发布指南
├── OPEN_VSX_SETUP.md       📘 Open VSX 配置专门指南
├── SETUP_COMPLETE.md       📘 设置完成说明
├── DUAL_MARKETPLACE_SETUP.md  📘 本文件
└── workflows/README.md     📘 Workflows 详细说明

CHANGELOG.md                📘 版本变更记录
README.md                   📘 更新了安装说明
```

## 🎨 工作流程图

```
┌─────────────────────────────────────────────────────────┐
│  开发者推送标签: git push origin v1.0.0                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions: Release Workflow                       │
├─────────────────────────────────────────────────────────┤
│  1. ✅ 运行测试和 Lint                                   │
│  2. 📦 构建并打包 VSIX                                   │
│  3. 🔵 发布到 VS Code Marketplace                       │
│  4. 🟢 发布到 Open VSX Registry                         │
│  5. 📝 创建 GitHub Release                              │
│  6. 📎 上传 VSIX 文件                                    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  结果：扩展在两个市场上线！                              │
├─────────────────────────────────────────────────────────┤
│  ✅ VS Code Marketplace                                 │
│     https://marketplace.visualstudio.com/items?         │
│     itemName=kuochunchang.goose-sonarqube-vscode        │
│                                                          │
│  ✅ Open VSX Registry                                   │
│     https://open-vsx.org/extension/kuochunchang/        │
│     goose-sonarqube-vscode                              │
│                                                          │
│  ✅ GitHub Release                                      │
│     https://github.com/kuochunchang/                    │
│     goose-sonarqube-vscode/releases                     │
└─────────────────────────────────────────────────────────┘
```

## 💻 使用示例

### 发布新版本（只需 2 个命令！）

```bash
# 1. 更新版本号
npm version patch  # 或 minor / major

# 2. 推送标签
git push --follow-tags
```

就这么简单！GitHub Actions 会自动：
- ✅ 运行所有测试
- ✅ 发布到 VS Code Marketplace
- ✅ 发布到 Open VSX Registry
- ✅ 创建 GitHub Release

### 用户安装（多种方式）

**VS Code 用户**:
```bash
code --install-extension kuochunchang.goose-sonarqube-vscode
```

**VSCodium 用户**:
```bash
codium --install-extension kuochunchang.goose-sonarqube-vscode
```

**手动安装**:
从 GitHub Releases 下载 `.vsix` 文件

## 📊 监控发布状态

### GitHub Actions
查看自动化流程: https://github.com/kuochunchang/goose-sonarqube-vscode/actions

### VS Code Marketplace
管理扩展: https://marketplace.visualstudio.com/manage/publishers/kuochunchang

### Open VSX Registry
查看扩展: https://open-vsx.org/user-settings/extensions

### GitHub Releases
查看发布: https://github.com/kuochunchang/goose-sonarqube-vscode/releases

## 🎓 学习资源

### 快速上手
- 🚀 [快速开始](./QUICKSTART.md) - 5 步完成设置
- 📖 [发布指南](./RELEASE.md) - 完整发布流程

### 深入了解
- 🔍 [Open VSX 配置](./OPEN_VSX_SETUP.md) - Open VSX 详细说明
- ⚙️ [Workflows 说明](./workflows/README.md) - 每个 workflow 详解

### 官方文档
- [VS Code Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Open VSX Wiki](https://github.com/eclipse/openvsx/wiki)
- [GitHub Actions](https://docs.github.com/en/actions)

## 🎯 功能特性

### ✅ 双市场发布
- 一次推送，发布到两个市场
- Open VSX 发布失败不影响 VS Code Marketplace
- 使用相同的 VSIX 文件

### ✅ 完整测试
- Node.js 18.x 和 20.x 双版本测试
- 代码覆盖率报告
- ESLint 和 Prettier 检查
- TypeScript 类型检查

### ✅ 自动化 Release
- 自动创建 GitHub Release
- 自动生成 Release Notes
- 自动上传 VSIX 文件
- 中文安装说明

### ✅ 灵活触发
- Git 标签推送自动触发
- GitHub Release 创建触发
- 手动触发选项

## 🔒 安全性

### Secrets 管理
- ✅ 所有 Token 存储在 GitHub Secrets
- ✅ 永远不会在日志中显示
- ✅ 只有 Actions 可以访问
- ✅ 支持定期轮换

### 权限说明
| Secret | 用途 | 权限范围 |
|--------|------|---------|
| `VSCE_PAT` | VS Code Marketplace 发布 | Marketplace: Manage |
| `OPEN_VSX_TOKEN` | Open VSX Registry 发布 | Extension Publishing |
| `GITHUB_TOKEN` | 创建 Release | 自动提供，无需配置 |

## 🐛 常见问题

### Q: 两个市场必须都配置吗？

**A:** 不是。配置的优先级：

- ✅ **只配置 VSCE_PAT**: 只发布到 VS Code Marketplace
- ✅ **配置两个 Token**: 发布到两个市场（推荐）
- ❌ **都不配置**: 发布失败

### Q: Open VSX 发布失败会怎样？

**A:** 不会影响 VS Code Marketplace 的发布。
- `continue-on-error: true` 确保流程继续
- VS Code Marketplace 仍会正常发布
- GitHub Release 仍会正常创建

### Q: 如何只发布到一个市场？

**A:** 在 workflow 中注释掉相应的发布步骤，详见 [OPEN_VSX_SETUP.md](./OPEN_VSX_SETUP.md#q-可以只发布到-open-vsx-而不发布到-vs-code-marketplace-吗)

### Q: 版本号需要保持一致吗？

**A:** 强烈建议保持一致，避免用户混淆。使用 `package.json` 中的同一个版本号。

## 🎉 完成清单

推送前请确认：

- [ ] 已设置 `VSCE_PAT` secret
- [ ] 已设置 `OPEN_VSX_TOKEN` secret（推荐）
- [ ] 已更新 `CHANGELOG.md`
- [ ] 已更新 `package.json` 版本号
- [ ] 本地测试通过
- [ ] 已推送所有代码到 GitHub

全部完成后：

```bash
git add .
git commit -m "ci: add dual marketplace publishing with GitHub Actions"
git push origin main
```

## 🌟 优势总结

### 为什么要双市场发布？

1. **更广覆盖** 🌍
   - VS Code: 1400万+ 用户
   - Open VSX: 数十万开源用户
   - 总计: 最大化用户覆盖

2. **开源友好** 💚
   - 支持开源生态系统
   - 为隐私意识用户提供选择
   - 支持企业自托管场景

3. **零额外成本** 💰
   - Open VSX 完全免费
   - 使用相同的 VSIX 包
   - 几乎无额外维护成本

4. **自动化省心** 🤖
   - 一次推送，双市场发布
   - 全自动测试和部署
   - 失败不互相影响

## 📞 获取帮助

**文档**:
- [QUICKSTART.md](./QUICKSTART.md) - 快速开始
- [RELEASE.md](./RELEASE.md) - 发布指南
- [OPEN_VSX_SETUP.md](./OPEN_VSX_SETUP.md) - Open VSX 配置

**社区**:
- [GitHub Issues](https://github.com/kuochunchang/goose-sonarqube-vscode/issues)
- [GitHub Discussions](https://github.com/kuochunchang/goose-sonarqube-vscode/discussions)

---

**🎊 祝贺您完成双市场发布配置！**

现在您的扩展可以触达更多用户，支持更广泛的开源社区！

**下一步**: 阅读 [QUICKSTART.md](./QUICKSTART.md) 开始设置 Tokens 🚀


