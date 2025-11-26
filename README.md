# Goose SonarQube for VS Code

SonarQube integration and Git change analysis for VS Code.

## Features

- **Git Change Analysis**: Analyze working directory changes, branch comparisons, and pull requests
- **SonarQube Integration**: Connect to SonarQube or SonarCloud for code quality analysis
- **Issue Detection**: Find code quality issues in changed files
- **Interactive Reports**: View analysis results in a rich webview panel
- **Export Reports**: Export analysis results to Markdown, JSON, or HTML

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on Mac)
3. Search for "Goose SonarQube"
4. Click **Install**

### From VSIX File

If you have a `.vsix` file:

1. Open VS Code
2. Go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on Mac)
3. Click the `...` menu at the top of the Extensions view
4. Select **Install from VSIX...**
5. Choose the `.vsix` file

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/goose-sonarqube-vscode.git
   cd goose-sonarqube-vscode
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Press `F5` in VS Code to run the extension in development mode

## Building and Distribution

### Creating a VSIX Package

VSIX is the packaging format for VS Code extensions, used for distribution or manual installation.

**Prerequisites:**
- Node.js and npm installed
- Source code cloned or downloaded

**Build Steps:**

1. Navigate to the project directory and install dependencies:
   ```bash
   cd goose-sonarqube-vscode
   npm install
   ```

2. Install the VS Code Extension packaging tool `vsce`:
   ```bash
   npm install -g @vscode/vsce
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Package into a VSIX file:
   ```bash
   npm run package
   ```
   Or directly:
   ```bash
   vsce package
   ```

This will create a `.vsix` file in the project root (e.g., `goose-sonarqube-vscode-1.0.0.vsix`).

**Important Notes:**
- The VSIX package includes runtime dependencies (`node_modules`) required for the extension to function
- Expected package size: ~15-20 MB (includes all necessary dependencies)
- The `.vscodeignore` file controls which files are included/excluded from the package
- Runtime dependencies like `@octokit/rest`, `simple-git`, and `sonarqube-scanner` must be included

**Using the VSIX File:**
- Share with others for installation
- Install using the "From VSIX File" method above
- Suitable for internal distribution or testing versions

**Troubleshooting:**
- If the extension doesn't work after installation, ensure the VSIX includes `node_modules`
- Check the package size - if it's too small (~200KB), runtime dependencies may be missing
- Verify `.vscodeignore` doesn't exclude necessary runtime dependencies

### Publishing to VS Code Marketplace

To publish the extension to the VS Code Marketplace for public availability:

1. Create a Personal Access Token (PAT) from [Azure DevOps](https://dev.azure.com/)
2. Login with `vsce`:
   ```bash
   vsce login <publisher-name>
   ```
3. Publish the extension:
   ```bash
   vsce publish
   ```

## Uninstallation

### Remove the Extension

1. Open VS Code
2. Go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on Mac)
3. Find "Goose SonarQube" in your installed extensions
4. Click the gear icon and select **Uninstall**

### Clean Up Configuration (Optional)

After uninstalling, you may want to remove the extension's configuration:

1. Open VS Code settings (`Ctrl+,` or `Cmd+,` on Mac)
2. Search for "gooseSonarQube"
3. Remove or reset any custom settings

Or manually edit your `settings.json`:
- Remove all `gooseSonarQube.*` entries

## Running SonarQube Locally

To help you get started quickly without an existing SonarQube server, using a `docker-compose` setup for a local instance.

1. Navigate to the `docker` directory:
   ```bash
   cd docker
   ```
2. Start the SonarQube container:
   ```bash
   docker-compose up -d
   ```
3. Access SonarQube at `http://localhost:9000`
   - Default credentials: `admin` / `admin`
   - You will be prompted to change the password on first login.

Once running, you can configure this extension to connect to your local instance using `http://localhost:9000` and the token you generate in SonarQube.

**Note:** After setting up your connection, remember to create a `sonar-project.properties` file in your project root (see step 3 in Getting Started).

## Getting Started

### 1. Obtain a SonarQube Token

Before using this extension, you need to generate an authentication token from your SonarQube server or SonarCloud.

#### For SonarQube (Self-hosted)

1. **Login to SonarQube**
   - Open your SonarQube server in a browser (e.g., `http://localhost:9000`)
   - Login with your credentials

2. **Generate a User Token**
   - Click your **profile avatar** (top right) → **My Account**
   - Select the **Security** tab
   - In the **Generate Tokens** section:
     - **Token Name**: Enter a descriptive name (e.g., `vscode-extension`)
     - **Type**: Select `User Token`
     - **Expires in**: Choose expiration period (recommended: `No expiration` or `90 days`)
   - Click **Generate**
   - **Copy the generated token** (it will only be shown once!)

#### For SonarCloud

1. **Login to SonarCloud**
   - Go to [https://sonarcloud.io](https://sonarcloud.io)
   - Login with your GitHub/Bitbucket/Azure DevOps account

2. **Generate a Token**
   - Click your **profile avatar** (top right) → **My Account**
   - Select the **Security** tab
   - In the **Generate Tokens** section:
     - **Token Name**: Enter a descriptive name (e.g., `vscode-extension`)
     - **Expires in**: Choose expiration period
   - Click **Generate**
   - **Copy the generated token** (it will only be shown once!)

**Required Token Permissions:**
- ✅ **Browse** - View projects and issues
- ✅ **Execute Analysis** - Run code analysis (if needed)

### 2. Configure the Extension

#### Add a SonarQube Connection

1. Open the Command Palette (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux)
2. Type and select: **Goose SonarQube: Add SonarQube Connection**
3. Follow the prompts:
   - **Connection ID**: Enter a unique identifier (e.g., `my-sonarqube`)
   - **Server URL**: Enter the server URL
     - For local SonarQube: `http://localhost:9000`
     - For SonarCloud: `https://sonarcloud.io`
   - **Organization Key** (SonarCloud only): Enter your organization key
   - **Token**: Paste the token you generated earlier
4. Choose whether to test the connection immediately

#### Manage Connections

You can manage your connections using:
- **Goose SonarQube: Manage SonarQube Connections** - View, test, or delete connections

#### Bind a Project

1. Open the Command Palette
2. Type and select: **Goose SonarQube: Bind to SonarQube Project**
3. Follow the prompts:
   - **Select Connection**: Choose from your configured connections
   - **Project Key**: Enter the SonarQube project key (e.g., `my-project`)
   - **Project Name** (optional): Enter a display name

#### Manage Project Binding

You can manage your project binding using:
- **Goose SonarQube: Manage Project Binding** - View, change, or clear the current binding

**Security Note:**
- Tokens are securely stored in VS Code's Secret Storage (not in plain text)
- Tokens are never logged or displayed in the UI
- Each workspace can have its own project binding

### 3. Configure SonarQube Project Properties

**IMPORTANT:** Before running analysis, you must create a `sonar-project.properties` file in your project root directory. This file tells the SonarQube scanner how to analyze your project.

#### Create sonar-project.properties

Create a file named `sonar-project.properties` in your project root with the following content:

```properties
# Project identification
sonar.projectKey=your-project-key
sonar.projectName=Your Project Name
sonar.projectVersion=1.0

# Source code location
sonar.sources=src
# sonar.tests=tests

# Encoding
sonar.sourceEncoding=UTF-8

# Language-specific settings (uncomment as needed)
# For JavaScript/TypeScript projects:
# sonar.javascript.node.maxspace=4096
# sonar.typescript.lcov.reportPaths=coverage/lcov.info

# For Java projects:
# sonar.java.source=11
# sonar.java.binaries=target/classes

# Exclusions (optional)
# sonar.exclusions=**/node_modules/**,**/dist/**,**/build/**
# sonar.coverage.exclusions=**/*.test.ts,**/*.spec.ts
```

#### Configuration Parameters

- **sonar.projectKey**: Must match the project key you configured in step 2
- **sonar.projectName**: Display name for your project
- **sonar.sources**: Comma-separated paths to source directories (e.g., `src,lib`)
- **sonar.tests**: Comma-separated paths to test directories (optional)
- **sonar.exclusions**: Files/directories to exclude from analysis (optional)

#### Example Configurations

**TypeScript/JavaScript Project:**
```properties
sonar.projectKey=my-typescript-app
sonar.projectName=My TypeScript App
sonar.sources=src
sonar.tests=tests
sonar.exclusions=**/node_modules/**,**/dist/**,**/*.test.ts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

**Java Project:**
```properties
sonar.projectKey=my-java-app
sonar.projectName=My Java App
sonar.sources=src/main/java
sonar.tests=src/test/java
sonar.java.source=17
sonar.java.binaries=target/classes
```

**Python Project:**
```properties
sonar.projectKey=my-python-app
sonar.projectName=My Python App
sonar.sources=src
sonar.tests=tests
sonar.python.version=3.11
sonar.exclusions=**/__pycache__/**,**/venv/**
```

For more details, see the [SonarQube documentation](https://docs.sonarqube.org/latest/analysis/analysis-parameters/).

### 4. Verify Configuration

Test your connection to ensure everything is set up correctly:

1. Open the Command Palette
2. Type and select: **Goose SonarQube: Test SonarQube Connection**
3. Check the result message for connection status

## Usage

**Prerequisites:**
- Ensure you have a `sonar-project.properties` file in your project root (see [Configure SonarQube Project Properties](#3-configure-sonarqube-project-properties))
- Your SonarQube connection must be configured and tested

### Analyze Changes
1. Open the Git Analysis Menu from the Source Control panel
2. Choose analysis type:
   - **Working Directory**: Analyze uncommitted changes
   - **Branch Comparison**: Compare two branches
   - **Pull Request**: Analyze a GitHub PR

## Commands

### Connection Management
- `Goose SonarQube: Add SonarQube Connection` - Add a new SonarQube/SonarCloud connection
- `Goose SonarQube: Manage SonarQube Connections` - View, test, or delete existing connections
- `Goose SonarQube: Test SonarQube Connection` - Verify the current project's connection

### Project Binding
- `Goose SonarQube: Bind to SonarQube Project` - Bind the current workspace to a SonarQube project
- `Goose SonarQube: Manage Project Binding` - View, change, or clear the current project binding

### Code Analysis
- `Goose SonarQube: Analyze Working Directory Changes` - Analyze uncommitted changes
- `Goose SonarQube: Analyze Branch Comparison` - Compare code quality between branches
- `Goose SonarQube: Analyze Pull Request` - Analyze a GitHub pull request
- `Goose SonarQube: Diagnose SonarQube Integration` - Troubleshoot connection and configuration issues

## Configuration

### Settings Overview

This extension uses VS Code's configuration system with two scopes:

#### User Settings (Global)
Stored in your user settings file and shared across all workspaces:

- `gooseSonarQube.connections` (array)
  - List of SonarQube/SonarCloud server connections
  - Each connection includes: `connectionId`, `serverUrl`, `organizationKey` (for SonarCloud)
  - Tokens are stored separately in VS Code's secure Secret Storage

- `gooseSonarQube.enabled` (boolean, default: `true`)
  - Enable or disable the SonarQube integration globally

- `gooseSonarQube.timeout` (number, default: `3000`)
  - Connection timeout in milliseconds (1000-30000)

#### Workspace Settings (Project-specific)
Stored in `.vscode/settings.json` in your workspace:

- `gooseSonarQube.projectBinding` (object)
  - Binds the current workspace to a specific SonarQube project
  - Includes: `connectionId`, `projectKey`, `projectName`
  - Each workspace can have different project bindings

### Configuration Files Location

- **User Settings**: `~/.config/Code/User/settings.json` (Linux/Mac) or `%APPDATA%\Code\User\settings.json` (Windows)
- **Workspace Settings**: `.vscode/settings.json` (in your project root)
- **Tokens**: Stored securely in VS Code's Secret Storage (encrypted)

### Example Configuration

**User Settings** (`settings.json`):
```json
{
  "gooseSonarQube.connections": [
    {
      "connectionId": "local-sonarqube",
      "serverUrl": "http://localhost:9000"
    },
    {
      "connectionId": "sonarcloud",
      "serverUrl": "https://sonarcloud.io",
      "organizationKey": "my-org"
    }
  ],
  "gooseSonarQube.enabled": true,
  "gooseSonarQube.timeout": 5000
}
```

**Workspace Settings** (`.vscode/settings.json`):
```json
{
  "gooseSonarQube.projectBinding": {
    "connectionId": "local-sonarqube",
    "projectKey": "my-project-key",
    "projectName": "My Awesome Project"
  }
}
```

**Note:** We recommend using the interactive commands instead of manually editing these files.

## License

MIT
