## Goose SonarQube for VS Code

SonarQube integration and Git change analysis for VS Code.

This extension helps you review changes in your Git repository and surface SonarQube/SonarCloud issues directly inside VS Code.

### Difference from Official SonarQube Extension

This extension focuses on Git changes, while the [official SonarQube for IDE](https://marketplace.visualstudio.com/items?itemName=SonarSource.sonarlint-vscode) focuses on real-time file analysis:

| | This Extension | Official Extension |
|---|---|---|
| **Scope** | Changed files only (Git diff) | All open files |
| **Timing** | On-demand (manual command) | Real-time (as you type) |
| **Context** | Branch comparison, PR analysis | Current file editing |
| **Output** | Webview report with export | Problems panel |

### Features

- **Git Change Analysis**: Analyze working directory changes, branch comparisons, and pull requests
- **SonarQube / SonarCloud Integration**: Connect to your SonarQube server or SonarCloud organization
- **Issue Detection**: Find code quality issues in changed files, not just the whole project
- **Interactive Reports**: View analysis results in a rich webview panel
- **Export Reports**: Export analysis results to Markdown, JSON, or HTML

---



### Usage

#### 1. (Optional) Run a local SonarQube server

For local development and testing, you can run SonarQube using Docker Compose:

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

You can also use an existing SonarQube instance or SonarCloud instead of a local server.

#### 2. Configure SonarQube connection

1. Run **"Goose SonarQube: Add SonarQube Connection"** to configure your SonarQube server:
   - Provide a **connection ID**
   - Enter the **server URL**
   - Provide an **authentication token**
   - For SonarCloud, also provide the **organization key**
   - For a local Docker setup, use: `http://localhost:9000`
2. Run **"Goose SonarQube: Bind to SonarQube Project"** to link your workspace to a project:
   - Select a connection
   - Provide the **project key**
3. Run **"Goose SonarQube: Test SonarQube Connection"** to verify everything works.

#### 3. Manage configuration

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

#### 4. Analyze changes

1. Open the **Git Analysis Menu** from the Source Control panel:
   - Click the **"Git Analysis Menu"** button in the SCM title bar, or
   - Run the command **"Goose SonarQube: Git Analysis Menu"** from the Command Palette
2. Choose an analysis type:
   - **Working Directory** – Analyze uncommitted changes
   - **Branch Comparison** – Compare two branches
   - **Pull Request** – Analyze a GitHub PR
3. Review results in the **Git Change Analysis** panel and export if needed.

You can also open the analysis panel directly with **"Goose SonarQube: Open Git Change Analysis"**.


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
  Array of SonarQube/SonarCloud connections.

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
