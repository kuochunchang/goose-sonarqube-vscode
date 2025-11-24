/**
 * Git Analysis Helper Functions
 * Shared utilities for Git analysis commands
 */

import type { AnalysisType, FileAnalysis, MergedAnalysisResult } from '../git-analyzer/index.js';
import * as vscode from 'vscode';
import { GitChangePanel } from '../views/git-change-panel.js';

/**
 * Get workspace folder or show error
 */
export function getWorkspaceFolder(): vscode.WorkspaceFolder | null {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
  }
  return workspaceFolder ?? null;
}

/**
 * Select analysis types via quick pick
 */
export async function selectAnalysisTypes(
  context: vscode.ExtensionContext
): Promise<AnalysisType[] | undefined> {
  // Read last selected types from workspace state
  const lastSelected = context.workspaceState.get<string[]>(
    'git-analysis.lastSelectedTypes',
    ['quality', 'security', 'impact']
  );

  const items: vscode.QuickPickItem[] = [
    {
      label: 'Quality',
      description: 'Code quality, complexity, and maintainability',
      picked: lastSelected.includes('quality'),
    },
    {
      label: 'Security',
      description: 'Security vulnerabilities and hotspots',
      picked: lastSelected.includes('security'),
    },
    {
      label: 'Impact',
      description: 'Impact analysis and risk assessment',
      picked: lastSelected.includes('impact'),
    },
    {
      label: 'Architecture',
      description: 'Architecture review and design patterns',
      picked: lastSelected.includes('architecture'),
    },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: 'Select Analysis Types',
    placeHolder: 'Choose analysis types (previously selected are pre-checked)',
  });

  if (!selected || selected.length === 0) {
    return undefined;
  }

  const selectedTypes = selected.map((item) => item.label.toLowerCase() as AnalysisType);

  // Save selection for next time
  await context.workspaceState.update('git-analysis.lastSelectedTypes', selectedTypes);

  return selectedTypes;
}

/**
 * Update panel progress
 */
function updatePanelProgress(message: string, increment?: number): void {
  const currentPanel = GitChangePanel.currentPanel;
  if (currentPanel && increment !== undefined) {
    currentPanel.updateProgress(message, increment);
  }
}

/**
 * Show panel with analyzing state
 */
export function showAnalyzingPanel(
  extensionUri: vscode.Uri,
  config: {
    changeSource: 'working-directory' | 'branch-comparison' | 'pull-request';
    workingDirectory: string;
    sourceBranch?: string;
    targetBranch?: string;
    pullRequestNumber?: number;
    pullRequestTitle?: string;
    repository?: { owner: string; repo: string };
  }
): void {
  GitChangePanel.createOrShow(extensionUri, {
    changeSource: config.changeSource,
    workingDirectory: config.workingDirectory,
    sourceBranch: config.sourceBranch,
    targetBranch: config.targetBranch,
    pullRequestNumber: config.pullRequestNumber,
    pullRequestTitle: config.pullRequestTitle,
    repository: config.repository,
    status: 'analyzing',
    progress: {
      message: config.changeSource === 'pull-request'
        ? `Analyzing PR #${config.pullRequestNumber}...`
        : config.changeSource === 'branch-comparison'
          ? 'Initializing branch comparison...'
          : 'Initializing analysis...',
      percentage: 0,
    },
  });
}

/**
 * Update panel with completed results
 */
export function updatePanelWithResults(
  extensionUri: vscode.Uri,
  result: MergedAnalysisResult,
  config: {
    changeSource: 'working-directory' | 'branch-comparison' | 'pull-request';
    workingDirectory: string;
    sourceBranch?: string;
    targetBranch?: string;
    pullRequestNumber?: number;
    pullRequestTitle?: string;
    repository?: { owner: string; repo: string };
  }
): void {
  GitChangePanel.createOrShow(extensionUri, {
    result,
    changeSource: config.changeSource,
    workingDirectory: config.workingDirectory,
    sourceBranch: config.sourceBranch,
    targetBranch: config.targetBranch,
    pullRequestNumber: config.pullRequestNumber,
    pullRequestTitle: config.pullRequestTitle,
    repository: config.repository,
    status: 'completed',
  });
}

/**
 * Update panel with error state
 */
export function updatePanelWithError(
  config: {
    changeSource: 'working-directory' | 'branch-comparison' | 'pull-request';
    workingDirectory: string;
    sourceBranch?: string;
    targetBranch?: string;
    pullRequestNumber?: number;
    pullRequestTitle?: string;
    repository?: { owner: string; repo: string };
  }
): void {
  const currentPanel = GitChangePanel.currentPanel;
  if (currentPanel) {
    currentPanel.update({
      changeSource: config.changeSource,
      workingDirectory: config.workingDirectory,
      sourceBranch: config.sourceBranch,
      targetBranch: config.targetBranch,
      pullRequestNumber: config.pullRequestNumber,
      pullRequestTitle: config.pullRequestTitle,
      repository: config.repository,
      status: 'error',
    });
  }
}

/**
 * Show analysis completion message
 */
export function showCompletionMessage(result: MergedAnalysisResult): void {
  const totalIssues = result.fileAnalyses.flatMap((f: FileAnalysis) => f.issues).length;
  const totalFiles = result.fileAnalyses.length;
  vscode.window.showInformationMessage(
    `Analysis complete! Found ${totalIssues} issue(s) in ${totalFiles} file(s).`
  );
}

/**
 * Create progress reporter that updates both VS Code progress and panel
 */
export function createProgressReporter(progress: vscode.Progress<{ message?: string; increment?: number }>) {
  return (message: string, increment?: number): void => {
    progress.report({ message, increment });
    updatePanelProgress(message, increment);
  };
}

/**
 * Execute analysis with progress tracking
 */
export async function executeAnalysisWithProgress<T extends MergedAnalysisResult>(
  title: string,
  analysisFn: (progressCallback: (message: string, increment?: number) => void) => Promise<T>
): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false,
    },
    async (progress) => {
      const progressCallback = createProgressReporter(progress);
      return analysisFn(progressCallback);
    }
  );
}

/**
 * Handle analysis error
 */
export function handleAnalysisError(
  error: unknown,
  errorContext: string,
  panelConfig: {
    changeSource: 'working-directory' | 'branch-comparison' | 'pull-request';
    workingDirectory: string;
    sourceBranch?: string;
    targetBranch?: string;
    pullRequestNumber?: number;
    pullRequestTitle?: string;
    repository?: { owner: string; repo: string };
  }
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  updatePanelWithError(panelConfig);
  vscode.window.showErrorMessage(`${errorContext}: ${errorMessage}`);
}

