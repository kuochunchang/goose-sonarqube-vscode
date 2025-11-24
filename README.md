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
1. Configure SonarQube connection in VS Code settings
2. Bind your workspace to a SonarQube project
3. Test the connection to ensure everything works

### Analyze Changes
1. Open the Git Analysis Menu from the Source Control panel
2. Choose analysis type:
   - **Working Directory**: Analyze uncommitted changes
   - **Branch Comparison**: Compare two branches
   - **Pull Request**: Analyze a GitHub PR

## Commands

- `Goose SonarQube: Add SonarQube Connection` - Configure a new SonarQube server
- `Goose SonarQube: Bind to SonarQube Project` - Link workspace to a project
- `Goose SonarQube: Test SonarQube Connection` - Verify connection
- `Goose SonarQube: Analyze Working Directory Changes` - Analyze uncommitted changes
- `Goose SonarQube: Analyze Branch Comparison` - Compare branches
- `Goose SonarQube: Analyze Pull Request` - Analyze a GitHub PR

## Configuration

Configure in VS Code settings:
- `gooseSonarQube.connections`: SonarQube server connections
- `gooseSonarQube.projectBinding`: Project binding configuration
- `gooseSonarQube.enabled`: Enable/disable integration

## License

MIT
