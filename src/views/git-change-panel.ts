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
  command: "openFile" | "exportReport" | "copyToClipboard" | "refresh" | "openUrl" | "copyIssue";
  file?: string;
  line?: number;
  format?: string;
  url?: string;
  issueKey?: string;
  issueRule?: string;
  issueFile?: string;
  issueLine?: number;
  issueMessage?: string;
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
      case "openUrl":
        if (message.url) {
          await vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
        break;
      case "copyIssue":
        if (message.issueFile && message.issueLine !== undefined && message.issueMessage) {
          await this._copyIssue(
            message.issueKey,
            message.issueRule,
            message.issueFile,
            message.issueLine,
            message.issueMessage
          );
        }
        break;
    }
  }

  /**
   * Open file at specific line in a new tab beside the current editor
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

      // Determine which column to open the file in
      // Always open beside the current editor (or in column 2 if no active editor)
      // This ensures the analysis panel remains visible
      const activeEditor = vscode.window.activeTextEditor;
      const targetColumn =
        activeEditor && activeEditor.viewColumn ? vscode.ViewColumn.Beside : vscode.ViewColumn.Two;

      const targetLine = Math.max(0, (line ?? 1) - 1);
      const position = new vscode.Position(targetLine, 0);
      const range = new vscode.Range(position, position);

      // Try to open using showTextDocument first (supports viewColumn)
      try {
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document, {
          viewColumn: targetColumn,
          preview: false, // Open as a permanent tab, not preview
          selection: range,
          preserveFocus: false, // Focus the new editor so user can see it
        });

        // Ensure the line is visible and centered
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      } catch (openError) {
        // If showTextDocument fails (e.g., 50MB limit), try vscode.open as fallback
        const errorMessage = openError instanceof Error ? openError.message : String(openError);
        if (errorMessage.includes("50MB") || errorMessage.includes("cannot be synchronized")) {
          // Try vscode.open as fallback (doesn't require loading file into extension host)
          try {
            await vscode.commands.executeCommand("vscode.open", uri, {
              preview: false,
              selection: range,
            });
            vscode.window.showInformationMessage(
              `File opened. Note: Large files may not open in the preferred column.`
            );
          } catch {
            vscode.window.showWarningMessage(
              `File is too large to open automatically. Please manually open ${filePath} and navigate to line ${line}.`
            );
          }
        } else {
          throw openError;
        }
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

      // Get subtitle for panel header
      let subtitle = "";
      if (this._data.changeSource === "working-directory") {
        subtitle = "Working Directory Changes";
      } else if (this._data.changeSource === "branch-comparison") {
        subtitle = `${this._data.sourceBranch} → ${this._data.targetBranch}`;
      } else if (
        this._data.changeSource === "pull-request" &&
        this._data.pullRequestNumber &&
        this._data.repository
      ) {
        subtitle = `PR #${this._data.pullRequestNumber}: ${this._data.pullRequestTitle || "Untitled"} (${this._data.repository.owner}/${this._data.repository.repo})`;
      }

      const content = exporter.export(this._data.result, format, {
        panelHeader: {
          title: "Git Change Analysis",
          subtitle,
          changeSource: this._data.changeSource,
          sourceBranch: this._data.sourceBranch,
          targetBranch: this._data.targetBranch,
          pullRequestNumber: this._data.pullRequestNumber,
          pullRequestTitle: this._data.pullRequestTitle,
          repository: this._data.repository,
        },
      });
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

      // Get subtitle for panel header
      let subtitle = "";
      if (this._data.changeSource === "working-directory") {
        subtitle = "Working Directory Changes";
      } else if (this._data.changeSource === "branch-comparison") {
        subtitle = `${this._data.sourceBranch} → ${this._data.targetBranch}`;
      } else if (
        this._data.changeSource === "pull-request" &&
        this._data.pullRequestNumber &&
        this._data.repository
      ) {
        subtitle = `PR #${this._data.pullRequestNumber}: ${this._data.pullRequestTitle || "Untitled"} (${this._data.repository.owner}/${this._data.repository.repo})`;
      }

      const content = exporter.export(this._data.result, format, {
        panelHeader: {
          title: "Git Change Analysis",
          subtitle,
          changeSource: this._data.changeSource,
          sourceBranch: this._data.sourceBranch,
          targetBranch: this._data.targetBranch,
          pullRequestNumber: this._data.pullRequestNumber,
          pullRequestTitle: this._data.pullRequestTitle,
          repository: this._data.repository,
        },
      });

      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage(`Copied ${format.toUpperCase()} to clipboard`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to copy to clipboard: ${errorMessage}`);
    }
  }

  /**
   * Copy issue to clipboard
   */
  private async _copyIssue(
    issueKey: string | undefined,
    issueRule: string | undefined,
    issueFile: string,
    issueLine: number,
    issueMessage: string
  ): Promise<void> {
    if (!this._data.result) {
      vscode.window.showWarningMessage("No analysis result available");
      return;
    }

    try {
      // Find the issue by file, line, and message (most reliable)
      // Fallback to key or rule if available
      let targetIssue: CodeIssue | undefined;

      for (const fileAnalysis of this._data.result.fileAnalyses) {
        targetIssue = fileAnalysis.issues.find((issue) => {
          // Primary match: file, line, and message
          if (
            issue.file === issueFile &&
            issue.line === issueLine &&
            issue.message === issueMessage
          ) {
            return true;
          }
          // Fallback: match by key or rule if provided
          if (issueKey && issue.issueKey === issueKey) {
            return true;
          }
          if (issueRule && issue.rule === issueRule) {
            return true;
          }
          return false;
        });
        if (targetIssue) {
          break;
        }
      }

      if (!targetIssue) {
        vscode.window.showWarningMessage("Issue not found");
        return;
      }

      // Format issue as readable text
      const lines: string[] = [];
      lines.push(`Issue: ${targetIssue.message}`);
      lines.push(`Severity: ${targetIssue.severity.toUpperCase()}`);
      lines.push(`Type: ${targetIssue.type}`);
      lines.push(`File: ${targetIssue.file}`);
      lines.push(`Line: ${targetIssue.line}`);

      if (targetIssue.rule) {
        lines.push(`Rule: ${targetIssue.rule}`);
      }

      if (targetIssue.description) {
        lines.push(``);
        lines.push(`Description:`);
        lines.push(targetIssue.description);
      }

      if (targetIssue.whyIsThisAnIssue) {
        lines.push(``);
        lines.push(`Why is this an issue?`);
        // Strip HTML tags for plain text
        const plainText = targetIssue.whyIsThisAnIssue
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'");
        lines.push(plainText.trim());
      }

      if (targetIssue.howToFixIt) {
        lines.push(``);
        lines.push(`How to fix it:`);
        // Strip HTML tags for plain text
        const plainText = targetIssue.howToFixIt
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'");
        lines.push(plainText.trim());
      }

      if (targetIssue.suggestion) {
        lines.push(``);
        lines.push(`Suggested fix:`);
        lines.push(targetIssue.suggestion);
      }

      if (targetIssue.tags && targetIssue.tags.length > 0) {
        lines.push(``);
        lines.push(`Tags: ${targetIssue.tags.join(", ")}`);
      }

      if (targetIssue.assignee) {
        lines.push(``);
        lines.push(`Assignee: ${targetIssue.assignee}`);
      }

      if (targetIssue.issueUrl) {
        lines.push(``);
        lines.push(`View in SonarQube: ${targetIssue.issueUrl}`);
      }

      const content = lines.join("\n");
      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage("Issue copied to clipboard");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to copy issue: ${errorMessage}`);
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
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
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
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <style>
    ${this._getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <div class="analyzing-state">
      <h1>Git Change Analysis</h1>
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
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <style>
    ${this._getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <div class="empty-state">
      <h1><span class="material-icons">search</span> Git Change Analysis</h1>
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
      <h1>Git Change Analysis</h1>
      <p class="subtitle">${subtitle}</p>
      <div class="actions">
        <button onclick="copyToClipboard('markdown')"><span class="material-icons">content_copy</span> Copy Markdown</button>
        <button onclick="copyToClipboard('json')"><span class="material-icons">content_copy</span> Copy JSON</button>
        <button onclick="exportReport('markdown')"><span class="material-icons">save</span> Export Markdown</button>
        <button onclick="exportReport('json')"><span class="material-icons">save</span> Export JSON</button>
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
          <div class="issue ${issue.severity}" data-severity="${issue.severity}" data-type="${issue.type}" data-source="${issue.source}">
            <div class="issue-header">
              <div class="issue-badges">
                <span class="severity-badge ${issue.severity}">${issue.severity.toUpperCase()}</span>
                <span class="type-badge">${this._formatIssueType(issue.type)}</span>
                <span class="source-badge">${issue.source.toUpperCase()}</span>
                ${issue.rule ? `<span class="rule-badge"><span class="material-icons">description</span> ${issue.ruleUrl ? `<a href="${this._escapeHtml(issue.ruleUrl)}" onclick="openUrl('${this._escapeHtml(issue.ruleUrl)}'); return false;" class="rule-link">${this._escapeHtml(issue.rule)}</a>` : this._escapeHtml(issue.rule)}</span>` : ""}
                ${issue.status ? `<span class="status-badge status-${issue.status.toLowerCase()}">${this._formatStatus(issue.status)}</span>` : ""}
              </div>
            </div>
            
            <div class="issue-content">
              <div class="issue-message">
                <strong>Issue:</strong> ${this._escapeHtml(issue.message)}
              </div>
              
              ${this._getIssueTimeline(issue)}
              ${this._getIssueTags(issue)}
              ${this._getIssueAssignee(issue)}
              
              <div class="issue-tabs">
                <div class="tab-buttons">
                  <button class="tab-button active" onclick="switchTab(event, 'why-${issue.issueKey || issue.rule}')"><span class="material-icons">help_outline</span> Why is this an issue?</button>
                  <button class="tab-button" onclick="switchTab(event, 'fix-${issue.issueKey || issue.rule}')"><span class="material-icons">build</span> How to fix it</button>
                  <button class="tab-button" onclick="switchTab(event, 'location-${issue.issueKey || issue.rule}')"><span class="material-icons">location_on</span> Location</button>
                </div>
                
                <div id="why-${issue.issueKey || issue.rule}" class="tab-content active">
                  ${this._getWhyIsThisAnIssue(issue)}
                </div>
                
                <div id="fix-${issue.issueKey || issue.rule}" class="tab-content">
                  ${this._getHowToFixIt(issue)}
                </div>
                
                <div id="location-${issue.issueKey || issue.rule}" class="tab-content">
                  <div class="issue-location-section">
                    <span class="issue-location" onclick="openFile('${this._escapeHtml(issue.file)}', ${issue.line})">
                      <span class="material-icons">folder</span> ${this._escapeHtml(issue.file)} <span class="line-number">Line ${issue.line}</span>
                    </span>
                  </div>
                </div>
              </div>
              
              ${this._getIssueActions(issue)}
              ${this._getIssueMetadata(issue)}
            </div>
          </div>`;
          })
          .join("");

        return `
        <div class="file-section">
          <h3 class="file-header">
            <span class="material-icons">description</span> ${this._escapeHtml(fileAnalysis.file)}
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
   * Format issue type for display
   */
  private _formatIssueType(type: string): string {
    const typeMap: Record<string, string> = {
      bug: '<span class="material-icons">bug_report</span> Bug',
      vulnerability: '<span class="material-icons">lock</span> Vulnerability',
      "code-smell": '<span class="material-icons">warning</span> Code Smell',
      "security-hotspot": '<span class="material-icons">whatshot</span> Security Hotspot',
      "breaking-change": '<span class="material-icons">warning</span> Breaking Change',
      performance: '<span class="material-icons">flash_on</span> Performance',
      architecture: '<span class="material-icons">construction</span> Architecture',
      testing: '<span class="material-icons">science</span> Testing',
    };
    return typeMap[type] || type;
  }

  /**
   * Format status for display
   */
  private _formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      OPEN: '<span class="material-icons">circle</span> Open',
      CONFIRMED: '<span class="material-icons">circle</span> Confirmed',
      REOPENED: '<span class="material-icons">circle</span> Reopened',
      RESOLVED: '<span class="material-icons">check_circle</span> Resolved',
      CLOSED: '<span class="material-icons">cancel</span> Closed',
    };
    return statusMap[status] || status;
  }

  /**
   * Get timeline section HTML
   */
  private _getIssueTimeline(issue: CodeIssue): string {
    if (!issue.creationDate && !issue.updateDate) {
      return "";
    }

    return `
      <div class="issue-timeline-section">
        <div class="section-title"><span class="material-icons">calendar_today</span> Timeline</div>
        <div class="timeline-content">
          ${issue.creationDate ? `<div class="timeline-item">Created: ${this._formatDate(issue.creationDate)}</div>` : ""}
          ${issue.updateDate ? `<div class="timeline-item">Updated: ${this._formatDate(issue.updateDate)}</div>` : ""}
        </div>
      </div>`;
  }

  /**
   * Get tags section HTML
   */
  private _getIssueTags(issue: CodeIssue): string {
    if (!issue.tags || issue.tags.length === 0) {
      return "";
    }

    return `
      <div class="issue-tags-section">
        <div class="section-title"><span class="material-icons">local_offer</span> Tags</div>
        <div class="tags-container">
          ${issue.tags.map((tag) => `<span class="tag-badge">${this._escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>`;
  }

  /**
   * Get assignee section HTML
   */
  private _getIssueAssignee(issue: CodeIssue): string {
    if (!issue.assignee) {
      return "";
    }

    return `
      <div class="issue-assignee-section">
        <div class="section-title"><span class="material-icons">person</span> Assigned to</div>
        <div class="assignee-name">${this._escapeHtml(issue.assignee)}</div>
      </div>`;
  }

  /**
   * Get "Why is this an issue?" content
   */
  private _getWhyIsThisAnIssue(issue: CodeIssue): string {
    if (issue.whyIsThisAnIssue) {
      return `<div class="rule-content">${issue.whyIsThisAnIssue}</div>`;
    }

    if (issue.description) {
      return `<div class="rule-content">${this._escapeHtml(issue.description)}</div>`;
    }

    return `<div class="rule-content"><em>No detailed explanation available for this rule.</em></div>`;
  }

  /**
   * Get "How to fix it" content
   */
  private _getHowToFixIt(issue: CodeIssue): string {
    if (issue.howToFixIt) {
      return `<div class="rule-content">${issue.howToFixIt}</div>`;
    }

    if (issue.suggestion) {
      return `
        <div class="rule-content">
          <div class="fix-suggestion">
            <strong>Suggested fix:</strong>
            <pre>${this._escapeHtml(issue.suggestion)}</pre>
          </div>
        </div>`;
    }

    return `<div class="rule-content"><em>No remediation guidance available for this rule.</em></div>`;
  }

  /**
   * Escape string for use in JavaScript attribute
   */
  private _escapeJsString(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
  }

  /**
   * Get issue actions (buttons)
   */
  private _getIssueActions(issue: CodeIssue): string {
    const actions: string[] = [];

    // Copy button for all issues
    // Escape values for JavaScript string
    const escapedFile = this._escapeJsString(issue.file);
    const escapedMessage = this._escapeJsString(issue.message);
    const escapedKey = issue.issueKey ? this._escapeJsString(issue.issueKey) : "";
    const escapedRule = issue.rule ? this._escapeJsString(issue.rule) : "";

    actions.push(
      `<button class="action-button" onclick="copyIssue('${escapedKey}', '${escapedRule}', '${escapedFile}', ${issue.line}, '${escapedMessage}')"><span class="material-icons">content_copy</span> Copy Issue</button>`
    );

    if (issue.issueUrl) {
      actions.push(
        `<button class="action-button" onclick="openUrl('${this._escapeHtml(issue.issueUrl)}')"><span class="material-icons">link</span> View in SonarQube</button>`
      );
    }

    return `
      <div class="issue-actions">
        ${actions.join("")}
      </div>`;
  }

  /**
   * Format date for display
   */
  private _formatDate(isoDate: string): string {
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const formatted = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      if (diffDays === 0) {
        return `${formatted} (today)`;
      } else if (diffDays === 1) {
        return `${formatted} (yesterday)`;
      } else if (diffDays < 30) {
        return `${formatted} (${diffDays} days ago)`;
      }

      return formatted;
    } catch {
      return isoDate;
    }
  }

  /**
   * Get issue metadata HTML
   */
  private _getIssueMetadata(issue: CodeIssue): string {
    const metadata: string[] = [];

    if (issue.source === "sonarqube") {
      metadata.push(
        `<span class="metadata-item"><span class="material-icons">search</span> Detected by SonarQube static analysis</span>`
      );
    } else if (issue.source === "ai") {
      metadata.push(
        `<span class="metadata-item"><span class="material-icons">smart_toy</span> Detected by AI code review</span>`
      );
    }

    if (issue.issueKey) {
      metadata.push(
        `<span class="metadata-item">Key: <code>${this._escapeHtml(issue.issueKey)}</code></span>`
      );
    }

    if (metadata.length > 0) {
      return `
      <div class="issue-metadata">
        ${metadata.join(" · ")}
      </div>`;
    }

    return "";
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
        padding: 12px;
      }

      .material-icons {
        font-family: 'Material Icons';
        font-weight: normal;
        font-style: normal;
        font-size: 18px;
        line-height: 1;
        letter-spacing: normal;
        text-transform: none;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
        vertical-align: middle;
        margin-right: 4px;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .header {
        margin-bottom: 16px;
        border-bottom: 2px solid var(--vscode-panel-border);
        padding-bottom: 12px;
      }

      .header h1 {
        font-size: 28px;
        margin-bottom: 6px;
        font-weight: normal;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .subtitle {
        color: var(--vscode-descriptionForeground);
        font-size: 14px;
        margin-bottom: 10px;
      }

      .actions {
        display: flex;
        gap: 10px;
      }

      button {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      button .material-icons {
        font-size: 16px;
        margin-right: 0;
      }

      button:hover {
        background-color: var(--vscode-button-hoverBackground);
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .summary-card {
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        padding: 12px;
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
        margin-bottom: 4px;
        text-transform: uppercase;
      }

      .summary-value {
        font-size: 32px;
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
        font-size: 15px;
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
        font-size: 15px;
      }

      .filters {
        margin-bottom: 16px;
        padding: 12px;
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        border-radius: 8px;
      }

      .filters h3 {
        margin-bottom: 8px;
        font-weight: normal;
        font-size: 16px;
      }

      .filter-group {
        display: flex;
        gap: 12px;
        margin-bottom: 6px;
      }

      .filter-group label {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .issues-section h2 {
        margin-bottom: 12px;
        font-weight: normal;
        font-size: 20px;
      }

      .file-section {
        margin-bottom: 16px;
      }

      .file-header {
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: normal;
        font-size: 15px;
        gap: 8px;
      }

      .file-header .material-icons {
        font-size: 18px;
      }

      .file-stats {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        font-weight: normal;
      }

      .issues-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .issue {
        padding: 0;
        border-left: 4px solid;
        border-radius: 6px;
        background-color: var(--vscode-editor-inactiveSelectionBackground);
        overflow: hidden;
      }

      .issue.critical { border-left-color: #ff0000; }
      .issue.high { border-left-color: #ffa500; }
      .issue.medium { border-left-color: #ffff00; }
      .issue.low { border-left-color: #90ee90; }
      .issue.info { border-left-color: #87ceeb; }

      .issue-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background-color: rgba(0, 0, 0, 0.1);
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      .issue-badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        align-items: center;
      }

      .issue-badges .material-icons {
        font-size: 14px;
        margin-right: 2px;
      }

      .issue-header-right {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .severity-badge, .type-badge, .source-badge, .rule-badge, .status-badge {
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 11px;
        text-transform: uppercase;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .severity-badge .material-icons,
      .type-badge .material-icons,
      .source-badge .material-icons,
      .rule-badge .material-icons,
      .status-badge .material-icons {
        font-size: 14px;
        margin-right: 0;
      }

      .severity-badge.critical { background-color: #ff0000; color: white; }
      .severity-badge.high { background-color: #ffa500; color: white; }
      .severity-badge.medium { background-color: #ffff00; color: black; }
      .severity-badge.low { background-color: #90ee90; color: black; }
      .severity-badge.info { background-color: #87ceeb; color: black; }

      .type-badge {
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        text-transform: none;
      }

      .source-badge {
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }

      .rule-badge {
        background-color: var(--vscode-input-background);
        color: var(--vscode-foreground);
        text-transform: none;
        font-family: var(--vscode-editor-font-family);
      }

      .rule-badge .rule-link {
        color: var(--vscode-textLink-foreground);
        text-decoration: none;
        cursor: pointer;
      }

      .rule-badge .rule-link:hover {
        text-decoration: underline;
        color: var(--vscode-textLink-activeForeground);
      }

      .issue-content {
        padding: 12px;
      }

      .issue-message {
        font-size: 14px;
        margin-bottom: 10px;
        line-height: 1.5;
      }

      .issue-message strong {
        color: var(--vscode-textPreformat-foreground);
      }

      .section-title {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 6px;
        color: var(--vscode-textPreformat-foreground);
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .section-title .material-icons {
        font-size: 16px;
        margin-right: 0;
      }

      .issue-description-section {
        margin-bottom: 15px;
        padding: 12px;
        background-color: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
      }

      .issue-description {
        color: var(--vscode-foreground);
        font-size: 13px;
        line-height: 1.6;
      }

      .issue-location-section {
        margin-bottom: 15px;
        padding: 10px;
        background-color: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
      }

      .issue-location {
        cursor: pointer;
        color: var(--vscode-textLink-foreground);
        font-size: 13px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .issue-location .material-icons {
        font-size: 16px;
        margin-right: 0;
      }

      .issue-location:hover {
        text-decoration: underline;
      }

      .line-number {
        font-weight: 600;
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
      }

      .issue-solution-section {
        margin-bottom: 15px;
        padding: 12px;
        background-color: rgba(76, 175, 80, 0.1);
        border-left: 3px solid #4caf50;
        border-radius: 4px;
      }

      .issue-suggestion {
        color: var(--vscode-foreground);
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
      }

      .issue-metadata {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--vscode-panel-border);
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .metadata-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .metadata-item .material-icons {
        font-size: 14px;
        margin-right: 0;
      }

      .metadata-item code {
        background-color: var(--vscode-textCodeBlock-background);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: var(--vscode-editor-font-family);
      }

      /* Status badges */
      .status-badge.status-open { background-color: #f44336; color: white; }
      .status-badge.status-confirmed { background-color: #ff9800; color: white; }
      .status-badge.status-reopened { background-color: #2196f3; color: white; }
      .status-badge.status-resolved { background-color: #4caf50; color: white; }
      .status-badge.status-closed { background-color: #666; color: white; }

      /* Timeline section */
      .issue-timeline-section, .issue-tags-section, .issue-assignee-section {
        margin-bottom: 10px;
        padding: 8px 10px;
        background-color: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
      }

      .timeline-content {
        margin-top: 4px;
        font-size: 13px;
        line-height: 1.5;
      }

      .timeline-item {
        color: var(--vscode-descriptionForeground);
        margin-bottom: 2px;
      }

      /* Tags */
      .tags-container {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 5px;
      }

      .tag-badge {
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
      }

      /* Assignee */
      .assignee-name {
        margin-top: 4px;
        font-size: 13px;
        font-weight: 500;
      }

      /* Tabs */
      .issue-tabs {
        margin: 10px 0;
      }

      .tab-buttons {
        display: flex;
        gap: 4px;
        border-bottom: 2px solid var(--vscode-panel-border);
        margin-bottom: 10px;
      }

      .tab-button {
        background: none;
        border: none;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 13px;
        color: var(--vscode-foreground);
        opacity: 0.7;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .tab-button .material-icons {
        font-size: 16px;
        margin-right: 0;
      }

      .tab-button:hover {
        opacity: 1;
        background-color: rgba(0, 0, 0, 0.05);
      }

      .tab-button.active {
        opacity: 1;
        border-bottom-color: var(--vscode-button-background);
        font-weight: 600;
      }

      .tab-content {
        display: none;
        padding: 10px 0;
      }

      .tab-content.active {
        display: block;
      }

      .rule-content {
        font-size: 13px;
        line-height: 1.7;
      }

      .rule-content h1, .rule-content h2, .rule-content h3 {
        margin: 15px 0 10px 0;
        font-weight: 600;
      }

      .rule-content h1 { font-size: 18px; }
      .rule-content h2 { font-size: 16px; }
      .rule-content h3 { font-size: 14px; }

      .rule-content p {
        margin: 8px 0;
      }

      .rule-content pre {
        background-color: var(--vscode-textCodeBlock-background);
        padding: 10px;
        border-radius: 4px;
        overflow-x: auto;
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
        margin: 10px 0;
      }

      .rule-content code {
        background-color: var(--vscode-textCodeBlock-background);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
      }

      .rule-content ul, .rule-content ol {
        margin: 8px 0;
        padding-left: 25px;
      }

      .rule-content li {
        margin: 5px 0;
      }

      .fix-suggestion {
        background-color: rgba(76, 175, 80, 0.1);
        padding: 12px;
        border-left: 3px solid #4caf50;
        border-radius: 4px;
      }

      /* Issue actions */
      .issue-actions {
        margin: 10px 0;
        padding: 8px;
        background-color: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
        display: flex;
        gap: 8px;
      }

      .action-button {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .action-button .material-icons {
        font-size: 16px;
        margin-right: 0;
      }

      .action-button:hover {
        background-color: var(--vscode-button-hoverBackground);
      }

      .empty-state {
        text-align: center;
        padding: 60px 20px;
      }

      .empty-state h1 {
        font-size: 36px;
        margin-bottom: 20px;
        font-weight: normal;
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
        font-weight: normal;
      }

      .progress-container {
        margin-bottom: 30px;
      }

      .progress-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        font-size: 16px;
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

      // Tab switching
      function switchTab(event, tabId) {
        event.preventDefault();
        
        // Get the issue container
        const button = event.target;
        const tabButtons = button.parentElement;
        const issueContent = tabButtons.parentElement;
        
        // Hide all tab contents in this issue
        const tabContents = issueContent.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
          content.classList.remove('active');
        });
        
        // Remove active class from all buttons
        const buttons = tabButtons.querySelectorAll('.tab-button');
        buttons.forEach(btn => {
          btn.classList.remove('active');
        });
        
        // Show selected tab and mark button as active
        const selectedTab = document.getElementById(tabId);
        if (selectedTab) {
          selectedTab.classList.add('active');
        }
        button.classList.add('active');
      }

      // Open URL in external browser
      function openUrl(url) {
        vscode.postMessage({
          command: 'openUrl',
          url: url
        });
      }

      // Copy issue to clipboard
      function copyIssue(issueKey, issueRule, issueFile, issueLine, issueMessage) {
        vscode.postMessage({
          command: 'copyIssue',
          issueKey: issueKey || undefined,
          issueRule: issueRule || undefined,
          issueFile: issueFile,
          issueLine: issueLine,
          issueMessage: issueMessage
        });
      }

      // Make functions available globally
      window.switchTab = switchTab;
      window.openUrl = openUrl;
      window.copyIssue = copyIssue;
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
