## Development & Build Guide

This document is for **developers and contributors** who want to build, package, or modify the Goose SonarQube VS Code extension.

For end‑user usage and configuration, see **`README.md`**.

---

### Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **npm**: v9+ (comes with Node.js)
- **VS Code**: v1.85.0 or later
- **vsce** (optional, for manual packaging):

  ```bash
  npm install -g @vscode/vsce
  ```

---

### Install dependencies

From the project root:

```bash
npm install
```

This will install all runtime and development dependencies required for building and testing the extension.

---

### Build the extension

The project uses `esbuild` via the `esbuild.js` script.

```bash
# Compile using esbuild
npm run build

# Or run TypeScript compiler only (for type checking)
npm run build:tsc
```

Under the hood:

- `npm run build` → `npm run compile`
- `npm run compile` → `node esbuild.js`

The main compiled output is written to the `dist/` directory (entry: `dist/extension.js`).

For a production build:

```bash
npm run compile:production
```

---

### Package a VSIX file

To build a distributable `.vsix` package:

```bash
# Production compile + package using vsce
npm run package
```

This will:

1. Run `npm run compile:production`
2. Call `vsce package`

The resulting `.vsix` file (for example `goose-sonarqube-vscode-0.2.0.vsix`) will be generated in the project root directory.

If you prefer using `vsce` directly:

```bash
vsce package
```

---

### Run the extension in VS Code (debug mode)

1. Open this repository in VS Code.
2. Run **`npm install`** and **`npm run build`** once.
3. Press **`F5`** or open the **Run and Debug** view and start the **"Launch Extension"** configuration.
4. A new **Extension Development Host** window will open with the Goose SonarQube extension loaded.

You can then:

- Open a workspace with a Git repository.
- Use the Command Palette to run commands such as:
  - `Goose SonarQube: Git Analysis Menu`
  - `Goose SonarQube: Analyze Working Directory Changes`
  - `Goose SonarQube: Analyze Branch Comparison`
  - `Goose SonarQube: Analyze Pull Request`

---

### Running tests

Unit tests are implemented with **Vitest**.

```bash
# Run all tests
npm test
```

If you want coverage reports, you can configure and run Vitest with coverage options (see `vitest.config.ts` and `package.json`).

---

### Linting & formatting

The project uses **ESLint** and **Prettier**.

```bash
# Lint all files
npm run lint

# Lint and auto-fix
npm run lint:fix

# Format all source files
npm run format

# Check formatting without writing
npm run format:check
```

Please ensure lint and tests pass before committing changes.

---

### Local SonarQube with Docker (for development)

For local development and manual testing, you can run a SonarQube instance with Docker Compose:

```bash
cd docker
docker-compose up -d
```

This will start SonarQube on:

- URL: `http://localhost:9000`
- Default credentials: `admin` / `admin` (you will be prompted to change the password on first login)

To stop the server:

```bash
docker-compose down
```

You can then configure this local instance in the extension using:

- `Goose SonarQube: Add SonarQube Connection`
- `Goose SonarQube: Bind to SonarQube Project`

---

### Release checklist (manual)

1. Update version in `package.json` as needed.
2. Run:

   ```bash
   npm install
   npm run lint
   npm test
   npm run build
   npm run package
   ```

3. Verify the generated `.vsix` file installs and works in VS Code.
4. Push changes and, if applicable, publish the VSIX to the Marketplace.


