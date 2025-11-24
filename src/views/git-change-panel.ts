/**
 * Git Change Analysis Panel
 * Webview panel for displaying Git change analysis results
 */

import type { CodeIssue, FileAnalysis, MergedAnalysisResult } from "../git-analyzer/index.js";
import * as path from "node:path";
import * as vscode from "vscode";

/**
 * Panel data passed to webview
 */
export interface GitChangePanelData {
  /** Analysis result (optional, can be null for initial panel) */
  result?: MergedAnalysisResult;
  /** Change source type */
  changeSource: "working-directory" | "branch-comparison" | "pull-request" | "none";
  /** Working directory path */
  workingDirectory: string;
  /** Source branch (for branch comparison) */
  sourceBranch?: string;
  /** Target branch (for branch comparison) */
  targetBranch?: string;
  /** Pull request number (for PR analysis) */
  pullRequestNumber?: number;
  /** Pull request title (for PR analysis) */
  pullRequestTitle?: string;
  /** GitHub repository (for PR analysis) */
  repository?: { owner: string; repo: string };
  /** Current status of the analysis */
  status?: "idle" | "analyzing" | "completed" | "error";
  /** Progress information */
  progress?: {
    message: string;
    percentage: number;
  };
}

/**
 * Calculate summary statistics from MergedAnalysisResult
 */
function calculateSummaryStats(result: MergedAnalysisResult): {
  totalIssues: number;
  totalFiles: number;
  qualityScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
} {
  const allIssues = result.fileAnalyses.flatMap((f: FileAnalysis) => f.issues);
  const bySeverity = {
    critical: allIssues.filter((i: CodeIssue) => i.severity === "critical").length,
    high: allIssues.filter((i: CodeIssue) => i.severity === "high").length,
    medium: allIssues.filter((i: CodeIssue) => i.severity === "medium").length,
    low: allIssues.filter((i: CodeIssue) => i.severity === "low").length,
    info: allIssues.filter((i: CodeIssue) => i.severity === "info").length,
  };

  return {
    totalIssues: allIssues.length,
    totalFiles: result.summary?.filesChanged ?? result.fileAnalyses.length,
    qualityScore: result.impactAnalysis.qualityScore,
    riskLevel: result.impactAnalysis.riskLevel,
    bySeverity,
  };
}

/**
 * Webview message types
 */
interface WebviewMessage {
  command: "openFile" | "exportReport" | "copyToClipboard" | "refresh";
  file?: string;
  line?: number;
  format?: string;
}

/**
 * Git Change Analysis Panel
 */
export class GitChangePanel {
  public static currentPanel: GitChangePanel | undefined;
  public static readonly viewType = "gooseCodeReview.gitChangePanel";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _data: GitChangePanelData;

  /**
   * Create or show panel
   */
  public static createOrShow(extensionUri: vscode.Uri, data: GitChangePanelData): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel already exists, update it
    if (GitChangePanel.currentPanel) {
      GitChangePanel.currentPanel._panel.reveal(column);
      GitChangePanel.currentPanel.update(data);
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      GitChangePanel.viewType,
      "Git Change Analysis",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    GitChangePanel.currentPanel = new GitChangePanel(panel, extensionUri, data);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    data: GitChangePanelData
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._data = data;

    // Set initial content
    this._update();

    // Listen for panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        void this._handleMessage(message);
      },
      null,
      this._disposables
    );
  }

  /**
   * Update panel with new data
   */
  public update(data: GitChangePanelData): void {
    this._data = data;
    this._update();
  }

  /**
   * Update progress
   */
  public updateProgress(message: string, percentage: number): void {
    this._data.status = "analyzing";
    this._data.progress = { message, percentage };

    // If we are already in analyzing state, just send update message
    // Otherwise, we need to re-render to show the progress view
    this._panel.webview.postMessage({
      command: "updateProgress",
      message,
      percentage,
    });
  }

  /**
   * Dispose panel
   */
  public dispose(): void {
    GitChangePanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Update webview content
   */
  private _update(): void {
    const webview = this._panel.webview;
    this._panel.title = "Git Change Analysis";
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  /**
   * Handle messages from webview
   */
  private async _handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.command) {
      case "openFile":
        if (message.file !== undefined && message.line !== undefined) {
          await this._openFile(message.file, message.line);
        }
        break;
      case "exportReport":
        if (message.format === "markdown" || message.format === "json") {
          await this._exportReport(message.format);
        }
        break;
      case "copyToClipboard":
        if (message.format === "markdown" || message.format === "json") {
          await this._copyToClipboard(message.format);
        }
        break;
      case "refresh":
        // Refresh analysis (re-run)
        vscode.window.showInformationMessage("Refresh analysis not yet implemented");
        break;
    }
  }

  /**
   * Open file at specific line
   */
  private async _openFile(filePath: string, line: number): Promise<void> {
    try {
      // Resolve file path - if relative, make it absolute using working directory
      let resolvedPath = filePath;
      if (!filePath.startsWith("/") && !filePath.match(/^[a-zA-Z]:\\/)) {
        // Relative path - prepend working directory
        resolvedPath = path.join(this._data.workingDirectory, filePath);
      }

      const uri = vscode.Uri.file(resolvedPath);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      // Jump to line
      if (line > 0) {
        const position = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to open file: ${errorMessage}`);
    }
  }

  /**
   * Export report to file
   */
  private async _exportReport(format: "markdown" | "json"): Promise<void> {
    if (!this._data.result) {
      vscode.window.showWarningMessage("No analysis result to export");
      return;
    }

    try {
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`git-analysis-report.${format}`),
        filters: {
          [format.toUpperCase()]: [format],
        },
      });

      if (!uri) {
        return; // User cancelled
      }

      // Import ReportExporter dynamically
      const { ReportExporter } = await import("../git-analyzer/index.js");
      const exporter = new ReportExporter();
      const content = exporter.export(this._data.result, format);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));

      vscode.window.showInformationMessage(`Report exported to ${uri.fsPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to export report: ${errorMessage}`);
    }
  }

  /**
   * Copy report to clipboard
   */
  private async _copyToClipboard(format: "markdown" | "json"): Promise<void> {
    if (!this._data.result) {
      vscode.window.showWarningMessage("No analysis result to copy");
      return;
    }

    try {
      // Import ReportExporter dynamically
      const { ReportExporter } = await import("../git-analyzer/index.js");
      const exporter = new ReportExporter();
      const content = exporter.export(this._data.result, format);

      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage(`Copied ${format.toUpperCase()} to clipboard`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to copy to clipboard: ${errorMessage}`);
    }
  }

  /**
   * Get HTML for webview
   */
  private _getHtmlForWebview(_webview: vscode.Webview): string {
    const result = this._data.result;
    const status = this._data.status || "idle";

    if (status === "analyzing") {
      return this._getAnalyzingStateHtml();
    }

    if (!result) {
      return this._getEmptyStateHtml();
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Git Change Analysis</title>
  <style>
    ${this._getStyles()}
  </style>
</head>
<body>
  <div class="container">
    ${this._getHeaderHtml(result)}
    ${this._getSummaryHtml(result)}
    ${this._getFiltersHtml()}
    ${this._getIssuesHtml(result)}
  </div>
  <script>
    ${this._getScript()}
  </script>
</body>
</html>`;
  }

  /**
   * Get analyzing state HTML
   */
  private _getAnalyzingStateHtml(): string {
    const progress = this._data.progress || { message: "Initializing...", percentage: 0 };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Git Change Analysis</title>
  <style>
    ${this._getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <div class="analyzing-state">
      <h1>🔍 Git Change Analysis</h1>
      <div class="progress-container">
        <div class="progress-info">
          <span id="progress-message">${progress.message}</span>
          <span id="progress-percentage">${Math.round(progress.percentage)}%</span>
        </div>
        <div class="progress-bar-bg">
          <div id="progress-bar" class="progress-bar-fill" style="width: ${progress.percentage}%"></div>
        </div>
      </div>
      <div class="analyzing-details">
        <p>Please wait while we analyze your changes...</p>
        <p class="sub-text">This may take a few moments depending on the size of changes.</p>
      </div>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'updateProgress':
          document.getElementById('progress-message').textContent = message.message;
          document.getElementById('progress-percentage').textContent = Math.round(message.percentage) + '%';
          document.getElementById('progress-bar').style.width = message.percentage + '%';
          break;
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get empty state HTML
   */
  private _getEmptyStateHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Git Change Analysis</title>
  <style>
    ${this._getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <div class="empty-state">
      <h1>🔍 Git Change Analysis</h1>
      <p>No analysis results yet. Run an analysis to get started:</p>
      <ul>
        <li><strong>Analyze Working Directory</strong> - Review uncommitted changes</li>
        <li><strong>Analyze Branch Comparison</strong> - Compare two branches</li>
      </ul>
      <p>Use the Command Palette (Ctrl+Shift+P / Cmd+Shift+P) to run these commands.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Get header HTML
   */
  private _getHeaderHtml(_result: MergedAnalysisResult): string {
    const {
      changeSource,
      sourceBranch,
      targetBranch,
      pullRequestNumber,
      pullRequestTitle,
      repository,
    } = this._data;
    let subtitle = "";

    if (changeSource === "working-directory") {
      subtitle = "Working Directory Changes";
    } else if (changeSource === "branch-comparison") {
      subtitle = `${sourceBranch} → ${targetBranch}`;
    } else if (changeSource === "pull-request" && pullRequestNumber && repository) {
      subtitle = `PR #${pullRequestNumber}: ${pullRequestTitle || "Untitled"} (${repository.owner}/${repository.repo})`;
    }

    return `
    <div class="header">
      <h1>🔍 Git Change Analysis</h1>
      <p class="subtitle">${subtitle}</p>
      <div class="actions">
        <button onclick="copyToClipboard('markdown')">📋 Copy Markdown</button>
        <button onclick="copyToClipboard('json')">📋 Copy JSON</button>
        <button onclick="exportReport('markdown')">💾 Export Markdown</button>
        <button onclick="exportReport('json')">💾 Export JSON</button>
      </div>
    </div>`;
  }

  /**
   * Get summary HTML
   */
  private _getSummaryHtml(result: MergedAnalysisResult): string {
    const summary = calculateSummaryStats(result);

    return `
    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">Total Issues</div>
        <div class="summary-value">${summary.totalIssues}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Files Changed</div>
        <div class="summary-value">${summary.totalFiles}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Quality Score</div>
        <div class="summary-value">${summary.qualityScore}/100</div>
      </div>
      <div class="summary-card ${this._getRiskClass(summary.riskLevel)}">
        <div class="summary-label">Risk Level</div>
        <div class="summary-value">${summary.riskLevel.toUpperCase()}</div>
      </div>
    </div>

    <div class="severity-breakdown">
      <h3>Issues by Severity</h3>
      <div class="severity-bars">
        ${this._getSeverityBar("Critical", summary.bySeverity.critical || 0, "critical")}
        ${this._getSeverityBar("High", summary.bySeverity.high || 0, "high")}
        ${this._getSeverityBar("Medium", summary.bySeverity.medium || 0, "medium")}
        ${this._getSeverityBar("Low", summary.bySeverity.low || 0, "low")}
        ${this._getSeverityBar("Info", summary.bySeverity.info || 0, "info")}
      </div>
    </div>`;
  }

  /**
   * Get severity bar HTML
   */
  private _getSeverityBar(label: string, count: number, severity: string): string {
    const maxCount = 50; // For scaling
    const width = Math.min((count / maxCount) * 100, 100);

    return `
    <div class="severity-bar">
      <span class="severity-label ${severity}">${label}</span>
      <div class="bar-container">
        <div class="bar ${severity}" style="width: ${width}%"></div>
      </div>
      <span class="severity-count">${count}</span>
    </div>`;
  }

  /**
   * Get filters HTML
   */
  private _getFiltersHtml(): string {
    return `
    <div class="filters">
      <h3>Filters</h3>
      <div class="filter-group">
        <label>
          <input type="checkbox" id="filter-critical" checked> Critical
        </label>
        <label>
          <input type="checkbox" id="filter-high" checked> High
        </label>
        <label>
          <input type="checkbox" id="filter-medium" checked> Medium
        </label>
        <label>
          <input type="checkbox" id="filter-low" checked> Low
        </label>
        <label>
          <input type="checkbox" id="filter-info" checked> Info
        </label>
      </div>
      <div class="filter-group">
        <label>
          Group by:
          <select id="group-by">
            <option value="file">File</option>
            <option value="severity">Severity</option>
            <option value="type">Type</option>
          </select>
        </label>
      </div>
    </div>`;
  }

  /**
   * Get issues HTML
   */
  private _getIssuesHtml(result: MergedAnalysisResult): string {
    const issuesHtml = result.fileAnalyses
      .map((fileAnalysis: FileAnalysis) => {
        const issuesForFile = fileAnalysis.issues
          .map((issue: CodeIssue) => {
            return `
          <div class="issue ${issue.severity}" data-severity="${issue.severity}">
            <div class="issue-header">
              <span class="severity-badge ${issue.severity}">${issue.severity.toUpperCase()}</span>
              <span class="type-badge">${issue.type}</span>
              <span class="source-badge">${issue.source}</span>
            </div>
            <div class="issue-message">${this._escapeHtml(issue.message)}</div>
            ${issue.description ? `<div class="issue-description">${this._escapeHtml(issue.description)}</div>` : ""}
            <div class="issue-footer">
              <span class="issue-location" onclick="openFile('${this._escapeHtml(issue.file)}', ${issue.line})">
                📄 ${this._escapeHtml(issue.file)}:${issue.line}
              </span>
              ${issue.effort ? `<span class="issue-effort">⏱️ ${issue.effort}min</span>` : ""}
            </div>
            ${issue.suggestion ? `<div class="issue-suggestion">💡 ${this._escapeHtml(issue.suggestion)}</div>` : ""}
          </div>`;
          })
          .join("");

        return `
        <div class="file-section">
          <h3 class="file-header">
            📄 ${this._escapeHtml(fileAnalysis.file)}
            <span class="file-stats">${fileAnalysis.issues.length} issue(s) · ${fileAnalysis.linesChanged} lines changed</span>
          </h3>
          <div class="issues-container">
            ${issuesForFile}
          </div>
        </div>`;
      })
      .join("");

    return `
    <div class="issues-section">
      <h2>Issues</h2>
      ${issuesHtml}
    </div>`;
  }

  /**
   * Get CSS styles
   */
  private _getStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
        padding: 20px;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .header {
        margin-bottom: 30px;
        border-bottom: 2px solid var(--vscode-panel-border);
        padding-bottom: 20px;
      }

      .header h1 {
        font-size: 28px;
        margin-bottom: 10px;
      }

      .subtitle {
        color: var(--vscode-descriptionForeground);
        font-size: 14px;
        margin-bottom: 15px;
      }

      .actions {
        display: flex;
        gap: 10px;
      }

      button {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
      }

      button:hover {
        background-color: var(--vscode-button-hoverBackground);
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 30px;
      }

      .summary-card {
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        padding: 20px;
        border-radius: 8px;
        text-align: center;
      }

      .summary-card.critical {
        background-color: rgba(255, 0, 0, 0.1);
        border: 2px solid #ff0000;
      }

      .summary-card.high {
        background-color: rgba(255, 165, 0, 0.1);
        border: 2px solid #ffa500;
      }

      .summary-label {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 8px;
        text-transform: uppercase;
      }

      .summary-value {
        font-size: 32px;
        font-weight: bold;
      }

      .severity-breakdown {
        margin-bottom: 30px;
        padding: 20px;
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        border-radius: 8px;
      }

      .severity-breakdown h3 {
        margin-bottom: 15px;
      }

      .severity-bars {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .severity-bar {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .severity-label {
        width: 80px;
        font-weight: bold;
      }

      .severity-label.critical { color: #ff0000; }
      .severity-label.high { color: #ffa500; }
      .severity-label.medium { color: #ffff00; }
      .severity-label.low { color: #90ee90; }
      .severity-label.info { color: #87ceeb; }

      .bar-container {
        flex: 1;
        height: 20px;
        background-color: var(--vscode-input-background);
        border-radius: 10px;
        overflow: hidden;
      }

      .bar {
        height: 100%;
        transition: width 0.3s ease;
      }

      .bar.critical { background-color: #ff0000; }
      .bar.high { background-color: #ffa500; }
      .bar.medium { background-color: #ffff00; }
      .bar.low { background-color: #90ee90; }
      .bar.info { background-color: #87ceeb; }

      .severity-count {
        width: 50px;
        text-align: right;
        font-weight: bold;
      }

      .filters {
        margin-bottom: 30px;
        padding: 15px;
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        border-radius: 8px;
      }

      .filters h3 {
        margin-bottom: 10px;
      }

      .filter-group {
        display: flex;
        gap: 15px;
        margin-bottom: 10px;
      }

      .filter-group label {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .issues-section h2 {
        margin-bottom: 20px;
      }

      .file-section {
        margin-bottom: 30px;
      }

      .file-header {
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .file-stats {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        font-weight: normal;
      }

      .issues-container {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .issue {
        padding: 15px;
        border-left: 4px solid;
        border-radius: 4px;
        background-color: var(--vscode-editor-inactiveSelectionBackground);
      }

      .issue.critical { border-left-color: #ff0000; }
      .issue.high { border-left-color: #ffa500; }
      .issue.medium { border-left-color: #ffff00; }
      .issue.low { border-left-color: #90ee90; }
      .issue.info { border-left-color: #87ceeb; }

      .issue-header {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
      }

      .severity-badge, .type-badge, .source-badge {
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: bold;
        text-transform: uppercase;
      }

      .severity-badge.critical { background-color: #ff0000; color: white; }
      .severity-badge.high { background-color: #ffa500; color: white; }
      .severity-badge.medium { background-color: #ffff00; color: black; }
      .severity-badge.low { background-color: #90ee90; color: black; }
      .severity-badge.info { background-color: #87ceeb; color: black; }

      .type-badge {
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
      }

      .source-badge {
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }

      .issue-message {
        font-weight: bold;
        margin-bottom: 8px;
      }

      .issue-description {
        color: var(--vscode-descriptionForeground);
        margin-bottom: 8px;
        font-size: 13px;
      }

      .issue-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }

      .issue-location {
        cursor: pointer;
        color: var(--vscode-textLink-foreground);
      }

      .issue-location:hover {
        text-decoration: underline;
      }

      .issue-suggestion {
        margin-top: 10px;
        padding: 10px;
        background-color: var(--vscode-editor-background);
        border-radius: 4px;
        font-size: 13px;
      }

      .empty-state {
        text-align: center;
        padding: 60px 20px;
      }

      .empty-state h1 {
        font-size: 36px;
        margin-bottom: 20px;
      }

      .empty-state ul {
        text-align: left;
        max-width: 500px;
        margin: 20px auto;
      }

      .empty-state li {
        margin-bottom: 10px;
      }

      .analyzing-state {
        text-align: center;
        padding: 60px 20px;
        max-width: 600px;
        margin: 0 auto;
      }

      .analyzing-state h1 {
        font-size: 36px;
        margin-bottom: 40px;
      }

      .progress-container {
        margin-bottom: 30px;
      }

      .progress-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        font-size: 14px;
        font-weight: bold;
      }

      .progress-bar-bg {
        height: 10px;
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        border-radius: 5px;
        overflow: hidden;
      }

      .progress-bar-fill {
        height: 100%;
        background-color: var(--vscode-progressBar-background);
        transition: width 0.3s ease;
      }

      .analyzing-details {
        color: var(--vscode-descriptionForeground);
      }

      .sub-text {
        font-size: 12px;
        margin-top: 5px;
        opacity: 0.8;
      }
    `;
  }

  /**
   * Get JavaScript for webview
   */
  private _getScript(): string {
    return `
      const vscode = acquireVsCodeApi();

      function openFile(file, line) {
        vscode.postMessage({
          command: 'openFile',
          file: file,
          line: line
        });
      }

      function exportReport(format) {
        vscode.postMessage({
          command: 'exportReport',
          format: format
        });
      }

      function copyToClipboard(format) {
        vscode.postMessage({
          command: 'copyToClipboard',
          format: format
        });
      }

      // Filter functionality
      const filterCheckboxes = document.querySelectorAll('[id^="filter-"]');
      const groupBySelect = document.getElementById('group-by');

      filterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
      });

      if (groupBySelect) {
        groupBySelect.addEventListener('change', applyGrouping);
      }

      function applyFilters() {
        const issues = document.querySelectorAll('.issue');
        issues.forEach(issue => {
          const severity = issue.dataset.severity;
          const checkbox = document.getElementById('filter-' + severity);
          if (checkbox && checkbox.checked) {
            issue.style.display = 'block';
          } else {
            issue.style.display = 'none';
          }
        });
      }

      function applyGrouping() {
        // TODO: Implement grouping logic
        console.log('Grouping by:', groupBySelect.value);
      }
    `;
  }

  /**
   * Get risk level CSS class
   */
  private _getRiskClass(riskLevel: string): string {
    return riskLevel;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private _escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
