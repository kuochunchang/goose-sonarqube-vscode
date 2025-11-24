/**
 * Analyze Working Directory Command
 * Analyzes uncommitted changes in the current working directory
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
 * Execute analyze working directory command
 */
export async function analyzeWorkingDirectory(
  context: vscode.ExtensionContext,
  gitAnalysisService: GitAnalysisService
): Promise<void> {
  try {
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
      return;
    }

    const workingDirectory = workspaceFolder.uri.fsPath;

    // Check if working directory is clean
    const isClean = await gitAnalysisService.isWorkingDirectoryClean(workingDirectory);
    if (isClean) {
      vscode.window.showInformationMessage('No changes found in working directory.');
      return;
    }

    // Ask user to select analysis types
    const analysisTypes = await selectAnalysisTypes(context);
    if (!analysisTypes || analysisTypes.length === 0) {
      return; // User cancelled
    }

    // Show panel immediately with analyzing state
    showAnalyzingPanel(context.extensionUri, {
      changeSource: 'working-directory',
      workingDirectory,
    });

    // Execute analysis with progress tracking
    const result = await executeAnalysisWithProgress(
      'Analyzing Working Directory Changes',
      async (progressCallback) => {
        return gitAnalysisService.analyzeWorkingDirectory(
          {
            workingDirectory,
            analysisTypes,
          },
          progressCallback
        );
      }
    );

    // Update panel with results
    updatePanelWithResults(context.extensionUri, result, {
      changeSource: 'working-directory',
      workingDirectory,
    });

    // Show completion message
    showCompletionMessage(result);
  } catch (error) {
    const workspaceFolder = getWorkspaceFolder();
    if (workspaceFolder) {
      handleAnalysisError(
        error,
        'Failed to analyze working directory',
        {
          changeSource: 'working-directory',
          workingDirectory: workspaceFolder.uri.fsPath,
        }
      );
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to analyze working directory: ${errorMessage}`);
    }
  }
}

