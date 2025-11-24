/**
 * Analyze Branch Comparison Command
 * Compares two branches and analyzes the differences
 */

import * as vscode from 'vscode';
import { GitAnalysisService } from '../services/git-analysis-service.js';
import {
  executeAnalysisWithProgress,
  getWorkspaceFolder,
  handleAnalysisError,
  selectAnalysisTypes,
  showAnalyzingPanel,
  showCompletionMessage,
  updatePanelWithResults,
} from '../utils/git-analysis-helpers.js';

/**
 * Execute analyze branch comparison command
 */
export async function analyzeBranchComparison(
  context: vscode.ExtensionContext,
  gitAnalysisService: GitAnalysisService
): Promise<void> {
  try {
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
      return;
    }

    const workingDirectory = workspaceFolder.uri.fsPath;

    // Get current branch
    const currentBranch = await gitAnalysisService.getCurrentBranch(workingDirectory);

    // Get list of branches
    const branches = await gitAnalysisService.getBranches(workingDirectory);

    // Ask user to select target branch (to compare with current branch)
    const targetBranch = await vscode.window.showQuickPick(
      branches.filter((b) => b !== currentBranch),
      {
        title: 'Select Target Branch',
        placeHolder: `Compare current branch (${currentBranch}) with...`,
      }
    );

    if (!targetBranch) {
      return; // User cancelled
    }

    console.log(`[Analyze Branch] User selected: currentBranch=${currentBranch}, targetBranch=${targetBranch}`);

    // Ask user to select analysis types
    const analysisTypes = await selectAnalysisTypes(context);
    if (!analysisTypes || analysisTypes.length === 0) {
      return; // User cancelled
    }

    // Show panel immediately with analyzing state
    showAnalyzingPanel(context.extensionUri, {
      changeSource: 'branch-comparison',
      workingDirectory,
      sourceBranch: currentBranch,
      targetBranch,
    });

    // Execute analysis with progress tracking
    const result = await executeAnalysisWithProgress(
      `Comparing ${currentBranch} with ${targetBranch}`,
      async (progressCallback) => {
        return gitAnalysisService.analyzeBranchComparison(
          {
            workingDirectory,
            sourceBranch: currentBranch,
            targetBranch,
            analysisTypes,
          },
          progressCallback
        );
      }
    );

    // Update panel with results
    updatePanelWithResults(context.extensionUri, result, {
      changeSource: 'branch-comparison',
      workingDirectory,
      sourceBranch: currentBranch,
      targetBranch,
    });

    // Show completion message
    showCompletionMessage(result);
  } catch (error) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      handleAnalysisError(
        error,
        'Failed to analyze branch comparison',
        {
          changeSource: 'branch-comparison',
          workingDirectory: workspaceFolder.uri.fsPath,
        }
      );
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to analyze branch comparison: ${errorMessage}`);
    }
  }
}

