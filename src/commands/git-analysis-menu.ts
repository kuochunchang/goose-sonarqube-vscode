/**
 * Git Analysis Quick Menu
 * Provides a unified entry point for all Git analysis features
 */

import * as vscode from "vscode";
import type { AnalysisType } from "../git-analyzer/index.js";
import { GitAnalysisService } from "../services/git-analysis-service.js";
import { GitChangePanel } from "../views/git-change-panel.js";
import { analyzeBranchComparison } from "./analyze-branch.js";
import { analyzeWorkingDirectory } from "./analyze-working-directory.js";

/**
 * Quick menu item
 */
interface QuickMenuItem extends vscode.QuickPickItem {
  action: () => Promise<void>;
}

/**
 * Show Git Analysis Quick Menu
 */
export async function showGitAnalysisMenu(
  context: vscode.ExtensionContext,
  gitAnalysisService: GitAnalysisService
): Promise<void> {
  // Check if we have a workspace
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("No workspace folder found. Please open a folder first.");
    return;
  }

  const workingDirectory = workspaceFolder.uri.fsPath;

  // Check if there are uncommitted changes
  let hasChanges = false;
  try {
    hasChanges = !(await gitAnalysisService.isWorkingDirectoryClean(workingDirectory));
  } catch {
    // Ignore error, just disable the option
  }

  // Check if we have previous results
  const hasPreviousResults = GitChangePanel.currentPanel !== undefined;

  // Build menu items
  const menuItems: QuickMenuItem[] = [];

  // === Quick Actions ===
  if (hasChanges) {
    menuItems.push({
      label: "$(zap) Quick Analyze (Last Settings)",
      description: "Analyze working directory with previous settings",
      detail: "Fast analysis using your last selected analysis types",
      action: async () => {
        await analyzeWorkingDirectoryQuick(context, gitAnalysisService);
      },
    });
  }

  // === Main Actions ===
  menuItems.push({
    label: "",
    kind: vscode.QuickPickItemKind.Separator,
  } as QuickMenuItem);

  if (hasChanges) {
    menuItems.push({
      label: "$(git-commit) Analyze Working Directory",
      description: "Review uncommitted changes",
      detail: "Choose analysis types and review all uncommitted changes",
      action: async () => {
        await analyzeWorkingDirectory(context, gitAnalysisService);
      },
    });
  } else {
    menuItems.push({
      label: "$(info) Working Directory Clean",
      description: "No uncommitted changes",
      detail: "Make some changes first to analyze them",
      action: async () => {
        await vscode.window.showInformationMessage("No uncommitted changes found.");
      },
    });
  }

  menuItems.push({
    label: "$(git-compare) Compare Branches",
    description: "Compare two branches",
    detail: "Select branches and analyze differences",
    action: async () => {
      await analyzeBranchComparison(context, gitAnalysisService);
    },
  });

  menuItems.push({
    label: "$(git-pull-request) Analyze Pull Request",
    description: "Analyze GitHub PR",
    detail: "Review pull request changes with AI and SonarQube",
    action: async () => {
      const { analyzePullRequest } = await import("./analyze-pull-request.js");
      await analyzePullRequest(context, gitAnalysisService);
    },
  });

  // === View Results ===
  if (hasPreviousResults) {
    menuItems.push({
      label: "",
      kind: vscode.QuickPickItemKind.Separator,
    } as QuickMenuItem);

    menuItems.push({
      label: "$(eye) View Last Results",
      description: "Show previous analysis results",
      detail: "Open the analysis panel with last results",
      action: async () => {
        if (GitChangePanel.currentPanel) {
          // Panel already exists, just bring it to front
          // The panel will be shown automatically
        } else {
          await vscode.window.showInformationMessage("No previous results available.");
        }
      },
    });
  }

  // === Configuration ===
  menuItems.push({
    label: "",
    kind: vscode.QuickPickItemKind.Separator,
  } as QuickMenuItem);

  menuItems.push({
    label: "$(gear) Configure Analysis",
    description: "Open settings",
    detail: "Configure AI provider, SonarQube, and analysis options",
    action: async () => {
      await vscode.commands.executeCommand("workbench.action.openSettings", "gooseCodeReview");
    },
  });

  // Show quick pick
  const selected = await vscode.window.showQuickPick(menuItems, {
    title: "🔍 Git Analysis Menu",
    placeHolder: "Select an action...",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  // Execute selected action
  if (selected && "action" in selected) {
    await selected.action();
  }
}

/**
 * Quick analyze with last settings (helper function)
 */
async function analyzeWorkingDirectoryQuick(
  context: vscode.ExtensionContext,
  gitAnalysisService: GitAnalysisService
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("No workspace folder found.");
    return;
  }

  const workingDirectory = workspaceFolder.uri.fsPath;

  // Get last selected analysis types
  const lastSelected = context.workspaceState.get<string[]>("git-analysis.lastSelectedTypes", [
    "quality",
    "security",
    "impact",
  ]);

  const analysisTypes = lastSelected as AnalysisType[];

  // Import necessary helpers
  const {
    showAnalyzingPanel,
    executeAnalysisWithProgress,
    updatePanelWithResults,
    showCompletionMessage,
  } = await import("../utils/git-analysis-helpers.js");

  // Execute analysis
  try {
    showAnalyzingPanel(context.extensionUri, {
      changeSource: "working-directory",
      workingDirectory,
    });

    const result = await executeAnalysisWithProgress(
      "Quick Analysis (Working Directory)",
      async (progressCallback) => {
        return gitAnalysisService.analyzeWorkingDirectory(
          { workingDirectory, analysisTypes },
          progressCallback
        );
      }
    );

    updatePanelWithResults(context.extensionUri, result, {
      changeSource: "working-directory",
      workingDirectory,
    });

    showCompletionMessage(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Quick analysis failed: ${errorMessage}`);
  }
}
