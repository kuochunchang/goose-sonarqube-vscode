# Changelog

All notable changes to the "Goose SonarQube" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2025-11-27

### Added
- Enhanced report export functionality with improved formatting options
- Added panel header information support in report exports (title, subtitle, change source)
- Improved issue display with tabs for "Why is this an issue?", "How to fix it", and "Location"
- Added Material Icons support for better visual presentation
- Enhanced issue metadata display (timeline, tags, assignee, status)
- Added SonarQube issue URL links for direct access to issues

### Fixed
- Improved release workflow with production build configuration
- Added format checking and TypeScript type checking to release process
- Fixed secrets checking syntax in GitHub Actions workflows
- Removed unused version input parameter from release workflow
- Resolved all ESLint and Prettier formatting errors

### Changed
- Release workflow now uses `compile:production` for proper production builds
- Enhanced CI/CD pipeline with comprehensive validation steps
- Improved MergeService type safety with refined configuration structure
- Enhanced GitAnalysisService with detailed rule information
- Migrated to ES module syntax throughout the codebase

## [0.2.0] - 2024-XX-XX

### Added
- Connection and project management commands
- Interactive connection manager
- Project binding manager
- Git change analysis features
- Working directory analysis
- Branch comparison
- Pull request analysis
- SonarQube integration

### Features
- Full SonarQube/SonarCloud integration
- Git analysis with rich webview panel
- Export to Markdown, JSON, and HTML
- Keyboard shortcuts for quick access

## [0.1.0] - Initial Release

### Added
- Basic extension structure
- SonarQube connection configuration
- Git integration

---

## How to Update

When releasing a new version:

1. Move items from `[Unreleased]` to a new version section
2. Update the version number and date
3. Add comparison links at the bottom
4. Commit the changes before creating the release tag

### Version Sections

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security vulnerability fixes

[Unreleased]: https://github.com/kuochunchang/goose-sonarqube-vscode/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/kuochunchang/goose-sonarqube-vscode/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/kuochunchang/goose-sonarqube-vscode/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/kuochunchang/goose-sonarqube-vscode/releases/tag/v0.1.0


