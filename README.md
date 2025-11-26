# Goose SonarQube for VS Code

SonarQube integration and Git change analysis for VS Code.

## Features

- **Git Change Analysis**: Analyze working directory changes, branch comparisons, and pull requests
- **SonarQube Integration**: Connect to SonarQube or SonarCloud for code quality analysis
- **Issue Detection**: Find code quality issues in changed files
- **Interactive Reports**: View analysis results in a rich webview panel
- **Export Reports**: Export analysis results to Markdown, JSON, or HTML

## Usage

### Setup
1. Run **"Goose SonarQube: Add SonarQube Connection"** to configure your SonarQube server
   - Provide connection ID, server URL, and authentication token
   - For SonarCloud, also provide organization key
2. Run **"Goose SonarQube: Bind to SonarQube Project"** to link your workspace
   - Select a connection and provide project key
3. Run **"Goose SonarQube: Test SonarQube Connection"** to verify everything works

### Managing Configuration
- Use **"Goose SonarQube: Manage SonarQube Connections"** to:
  - View all configured connections
  - Edit connection details (server URL, organization key)
  - Update authentication tokens
  - Test connections
  - Delete unused connections
  
- Use **"Goose SonarQube: Manage Project Binding"** to:
  - View current project binding
  - Edit binding (change connection or project key)
  - Rebind to a different project
  - Remove binding

### Analyze Changes
1. Open the Git Analysis Menu from the Source Control panel
2. Choose analysis type:
   - **Working Directory**: Analyze uncommitted changes
   - **Branch Comparison**: Compare two branches
   - **Pull Request**: Analyze a GitHub PR

## Commands

### Configuration & Setup
- `Goose SonarQube: Add SonarQube Connection` - Configure a new SonarQube server
- `Goose SonarQube: Manage SonarQube Connections` - View, edit, or delete connections
- `Goose SonarQube: Bind to SonarQube Project` - Link workspace to a project
- `Goose SonarQube: Manage Project Binding` - View, edit, or remove project binding
- `Goose SonarQube: Test SonarQube Connection` - Verify connection

### Analysis
- `Goose SonarQube: Analyze Working Directory Changes` - Analyze uncommitted changes
- `Goose SonarQube: Analyze Branch Comparison` - Compare branches
- `Goose SonarQube: Analyze Pull Request` - Analyze a GitHub PR
- `Goose SonarQube: Analyze Project with SonarQube` - Full project analysis

### Diagnostics
- `Goose SonarQube: Diagnose SonarQube Integration` - Check configuration and connection status

## Configuration

Configure in VS Code settings:
- `gooseSonarQube.connections`: SonarQube server connections
- `gooseSonarQube.projectBinding`: Project binding configuration
- `gooseSonarQube.enabled`: Enable/disable integration

## License

MIT
