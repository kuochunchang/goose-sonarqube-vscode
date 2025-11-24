/**
 * Open Git Change Panel Command
 * Opens the Git Change Analysis panel for interactive analysis
 */

import * as vscode from "vscode";
import { GitChangePanel } from "../views/git-change-panel.js";

/**
 * Execute open git change panel command
 */
export async function openGitChangePanel(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found. Please open a folder first.");
      return;
    }

    const workingDirectory = workspaceFolder.uri.fsPath;

    // Open panel without analysis result (user will trigger analysis from UI)
    GitChangePanel.createOrShow(context.extensionUri, {
      changeSource: "none",
      workingDirectory,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to open Git Change Panel: ${errorMessage}`);
  }
}
