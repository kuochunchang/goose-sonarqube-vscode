## Goose SonarQube for VS Code

A code review assistant that integrates SonarQube with Git change analysis for VS Code.

This extension helps you **review your own code changes** by leveraging SonarQube's powerful code quality analysis. It surfaces code quality issues directly inside VS Code, focusing only on the files you've modified.

**Note**: This extension requires **SonarQube Community Edition** server. SonarCloud is not supported now.

### Difference from Official SonarQube Extension

This extension focuses on Git changes, while the [official SonarQube for IDE](https://marketplace.visualstudio.com/items?itemName=SonarSource.sonarlint-vscode) focuses on real-time file analysis:

|             | This Extension                 | Official Extension      |
| ----------- | ------------------------------ | ----------------------- |
| **Scope**   | Changed files only (Git diff)  | All open files          |
| **Timing**  | On-demand (manual command)     | Real-time (as you type) |
| **Context** | Branch comparison, PR analysis | Current file editing    |
| **Output**  | Webview report with export     | Problems panel          |

### Features

- **Self-Code Review**: Review your own code changes with AI-powered insights from SonarQube
- **Git Change Analysis**: Analyze working directory changes, branch comparisons, and pull requests
- **SonarQube Integration**: Leverage SonarQube's code quality analysis engine
- **Targeted Issue Detection**: Find code quality issues only in files you've modified, not the entire project
- **Interactive Reports**: View analysis results in a rich webview panel
- **Export Reports**: Export analysis results to Markdown, JSON, or HTML for team sharing

---

### Prerequisites

This extension requires a **SonarQube Community Edition** server.

### Usage

#### 1. Install and run SonarQube Community Edition

##### Option A: Using Docker (Recommended)

For local development and testing, run SonarQube Community Edition using Docker Compose:

```bash
cd docker
docker-compose up -d
```

This will start SonarQube on `http://localhost:9000`.
Default credentials are `admin` / `admin` (you will be prompted to change the password on first login).

To stop the server:

```bash
docker-compose down
```

##### Option B: Using Docker directly

```bash
docker run -d --name sonarqube \
  -p 9000:9000 \
  -v sonarqube_data:/opt/sonarqube/data \
  -v sonarqube_extensions:/opt/sonarqube/extensions \
  -v sonarqube_logs:/opt/sonarqube/logs \
  sonarqube:community
```

##### Option C: Download and install manually

1. Download SonarQube Community Edition from [official website](https://www.sonarsource.com/products/sonarqube/downloads/)
2. Unzip and run:

   ```bash
   # On macOS/Linux
   bin/macosx-universal-64/sonar.sh start

   # On Windows
   bin\windows-x86-64\StartSonar.bat
   ```

Wait for SonarQube to fully start (may take 1-2 minutes). Access the web interface at `http://localhost:9000`.

#### 2. Set up your project in SonarQube

Before using this extension, you must create and configure your project in SonarQube:

##### Step 1: Log in to SonarQube

1. Open `http://localhost:9000` in your browser
2. Log in with default credentials: `admin` / `admin`
3. Change the password when prompted

##### Step 2: Generate an authentication token

1. In the SonarQube web interface (logged in as `admin`), click on your **user avatar** in the top-right corner
2. Select **"My Account"** → **"Security"** tab
3. Under **"Generate Tokens"** section:
   - Token name: `vscode-extension` (or any name you prefer)
   - Token type: **User Token**
   - Expires in: Choose an appropriate duration (e.g., 90 days, or "No expiration" for testing)
4. Click **"Generate"** and **copy the token immediately** (you won't be able to see it again)
5. Save the token securely - you'll need it for the VS Code extension configuration

##### Step 3: Create a new project

1. Click **"Create Project"** → **"Manually"**
2. Enter your **Project Key** (e.g., `my-project`) and **Display Name**
3. Click **"Set Up"**

#### 3. Configure the VS Code extension

Now that your project is set up in SonarQube, configure the extension:

##### Step 1: Add SonarQube connection

###### Via Command Palette

1. Run command: **"Goose SonarQube: Add SonarQube Connection"**
2. Follow the input prompts to provide:
   - **Connection ID**: A friendly name (e.g., `local-sonarqube`)
   - **Server URL**: `http://localhost:9000` (or your server URL)
   - **Authentication Token**: Paste the token you generated in Step 2
   - **Organization Key**: Leave empty (not needed for SonarQube Community Edition)

###### Via Configuration UI

1. Open the **Git Analysis Menu**:
   - Click the sonar menu icon in the **Source Control** panel title bar
2. Select **"Manage SonarQube Connections"** from the menu
3. Click **"Add New Connection"** in the webview panel
4. Fill in the connection form:
   - **Connection ID**: A friendly name (e.g., `local-sonarqube`)
   - **Server URL**: `http://localhost:9000`
   - **Authentication Token**: Paste the token you generated in Step 2
   - **Organization Key**: Leave empty for SonarQube Community Edition
5. Click **"Save"** to add the connection

##### Step 2: Bind workspace to SonarQube project

###### Via Command Palette (binding)

1. Run command: **"Goose SonarQube: Bind to SonarQube Project"**
2. Select the connection you just created from the list
3. Enter the **Project Key** you created in Step 3 (e.g., `my-project`)

###### Via Configuration UI (binding)

1. Open the **Git Analysis Menu**:
   - Click the sonar menu icon in the **Source Control** panel title bar
2. Select **"Manage Project Binding"** from the menu
3. Click **"Add Binding"** or **"Edit Binding"** in the webview panel
4. Select the connection from the dropdown
5. Enter the **Project Key** (e.g., `my-project`)
6. Click **"Save"** to bind the project

##### Step 3: Test the connection

###### Via Command Palette (testing)

1. Run command: **"Goose SonarQube: Test SonarQube Connection"** to verify everything is configured correctly
2. Alternatively, run **"Goose SonarQube: Diagnose SonarQube Integration"** for a comprehensive check of your configuration and connection status

###### Via Configuration UI (testing)

1. Open the **Git Analysis Menu**:
   - Click the sonar menu icon in the **Source Control** panel title bar
2. Select one of the following options:
   - **"Test SonarQube Connection"** - Quick connection test
   - **"Diagnose SonarQube Integration"** - Comprehensive configuration check
3. Check the result message to confirm successful connection

You should see a success message confirming the connection to your SonarQube server and project.

#### 4. Manage configuration

- Use **"Goose SonarQube: Manage SonarQube Connections"** to:
  - View all configured connections
  - Edit connection details (server URL, organization key)
  - Update authentication tokens
  - Test connections
  - Delete unused connections

- Use **"Goose SonarQube: Manage Project Binding"** to:
  - View the current project binding
  - Edit binding (change connection or project key)
  - Rebind to a different project
  - Remove binding

#### 5. Analyze changes

Now you're ready to analyze your code changes!

1. Open the **Git Analysis Menu** from the Source Control panel:
   - Click the **sonar menu icon** in the SCM title bar, or
   - Run the command **"Goose SonarQube: Git Analysis Menu"** from the Command Palette
2. Choose an analysis type:
   - **Working Directory** – Analyze uncommitted changes
   - **Branch Comparison** – Compare two branches
   - **Pull Request** – Analyze a GitHub PR
3. Review results in the **Git Change Analysis** panel and export if needed.

You can also open the analysis panel directly with **"Goose SonarQube: Open Git Change Analysis"**.

**Tip**: If you encounter connection issues, use **"Goose SonarQube: Diagnose SonarQube Integration"** to check your configuration.

---

### Commands

#### Configuration & setup

- `Goose SonarQube: Add SonarQube Connection` – Configure a new SonarQube server
- `Goose SonarQube: Manage SonarQube Connections` – View, edit, or delete connections
- `Goose SonarQube: Bind to SonarQube Project` – Link your workspace to a project
- `Goose SonarQube: Manage Project Binding` – View, edit, or remove project binding
- `Goose SonarQube: Test SonarQube Connection` – Verify connection
- `Goose SonarQube: Diagnose SonarQube Integration` – Check configuration and connection status

#### Analysis

- `Goose SonarQube: Git Analysis Menu` – Unified quick menu for all Git analysis actions
- `Goose SonarQube: Analyze Working Directory Changes` – Analyze uncommitted changes
- `Goose SonarQube: Analyze Branch Comparison` – Compare branches
- `Goose SonarQube: Analyze Pull Request` – Analyze a GitHub PR
- `Goose SonarQube: Analyze Project with SonarQube` – Full project analysis
- `Goose SonarQube: Open Git Change Analysis` – Open the Git change analysis panel

---

### Configuration

You can configure this extension from **VS Code Settings** (`Preferences → Settings`) or by editing `settings.json`.

- `gooseSonarQube.connections`
  Array of SonarQube server connections.

- `gooseSonarQube.projectBinding`  
  Binds a workspace folder to a specific SonarQube project.

- `gooseSonarQube.timeout`  
  SonarQube connection timeout in milliseconds (default: `3000`).

- `gooseSonarQube.enabled`  
  Enable or disable SonarQube integration globally.

---

### Development

For development setup and contribution guidelines, see [DEVELOPMENT.md](./DEVELOPMENT.md).

### Release

This extension uses GitHub Actions for automated publishing to VS Code Marketplace. See [Release Guide](./.github/RELEASE.md) for details.

---

### License

MIT
