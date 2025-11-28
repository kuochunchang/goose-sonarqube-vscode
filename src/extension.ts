/**
 * Goose SonarQube VS Code Extension
 * SonarQube integration and Git change analysis
 */

import * as vscode from "vscode";
import { addSonarQubeConnection } from "./commands/add-sonarqube-connection.js";
import { analyzeBranchComparison } from "./commands/analyze-branch.js";
import { registerAnalyzeProjectSonarQubeCommand } from "./commands/analyze-project-sonarqube.js";
import { analyzePullRequest } from "./commands/analyze-pull-request.js";
import { analyzeWorkingDirectory } from "./commands/analyze-working-directory.js";
import { bindSonarQubeProject } from "./commands/bind-sonarqube-project.js";
import { diagnoseSonarQube } from "./commands/diagnose-sonarqube.js";
import { exportIssues } from "./commands/export-issues.js";
import { showGitAnalysisMenu } from "./commands/git-analysis-menu.js";
import { manageSonarQubeConnections } from "./commands/manage-connections.js";
import { manageSonarQubeProjectBinding } from "./commands/manage-project-binding.js";
import { openGitChangePanel } from "./commands/open-git-change-panel.js";
import { testSonarQubeConnection } from "./commands/test-sonarqube-connection.js";
import { GitAnalysisService } from "./services/git-analysis-service.js";

const outputChannel = vscode.window.createOutputChannel("Goose SonarQube");

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    outputChannel.appendLine("Goose SonarQube extension is now active");
    console.log("Goose SonarQube extension is now active");

    (global as any).gooseOutputChannel = outputChannel;
    context.subscriptions.push(outputChannel);

    // Initialize Git Analysis Service
    const gitAnalysisService = new GitAnalysisService(context);
    gitAnalysisService.initialize().catch((error) => {
      console.error("Failed to initialize Git Analysis Service:", error);
      outputChannel.appendLine(`Failed to initialize Git Analysis Service: ${error}`);
    });
    context.subscriptions.push(gitAnalysisService);

    // Register commands
    const analyzeWorkingDirectoryCmd = vscode.commands.registerCommand(
      "gooseSonarQube.analyzeWorkingDirectory",
      () => analyzeWorkingDirectory(context, gitAnalysisService)
    );

    const analyzeBranchCmd = vscode.commands.registerCommand("gooseSonarQube.analyzeBranch", () =>
      analyzeBranchComparison(context, gitAnalysisService)
    );

    const analyzePullRequestCmd = vscode.commands.registerCommand(
      "gooseSonarQube.analyzePullRequest",
      () => analyzePullRequest(context, gitAnalysisService)
    );

    const openGitChangePanelCmd = vscode.commands.registerCommand(
      "gooseSonarQube.openGitChangePanel",
      () => openGitChangePanel(context)
    );

    const gitAnalysisMenuCmd = vscode.commands.registerCommand(
      "gooseSonarQube.showGitAnalysisMenu",
      () => showGitAnalysisMenu(context, gitAnalysisService)
    );

    const addSonarQubeConnectionCmd = vscode.commands.registerCommand(
      "gooseSonarQube.addConnection",
      () => addSonarQubeConnection(context)
    );

    const bindSonarQubeProjectCmd = vscode.commands.registerCommand(
      "gooseSonarQube.bindProject",
      () => bindSonarQubeProject(context)
    );

    const testSonarQubeConnectionCmd = vscode.commands.registerCommand(
      "gooseSonarQube.testConnection",
      () => testSonarQubeConnection(context)
    );

    const diagnoseSonarQubeCmd = vscode.commands.registerCommand("gooseSonarQube.diagnose", () =>
      diagnoseSonarQube(context)
    );

    const analyzeProjectSonarQubeCmd = registerAnalyzeProjectSonarQubeCommand(context);

    const manageConnectionsCmd = vscode.commands.registerCommand(
      "gooseSonarQube.manageConnections",
      () => manageSonarQubeConnections(context)
    );

    const manageProjectBindingCmd = vscode.commands.registerCommand(
      "gooseSonarQube.manageProjectBinding",
      () => manageSonarQubeProjectBinding(context)
    );

    const exportIssuesCmd = vscode.commands.registerCommand("gooseSonarQube.exportIssues", () =>
      exportIssues(context)
    );

    context.subscriptions.push(
      analyzeWorkingDirectoryCmd,
      analyzeBranchCmd,
      analyzePullRequestCmd,
      openGitChangePanelCmd,
      gitAnalysisMenuCmd,
      addSonarQubeConnectionCmd,
      bindSonarQubeProjectCmd,
      testSonarQubeConnectionCmd,
      diagnoseSonarQubeCmd,
      analyzeProjectSonarQubeCmd,
      manageConnectionsCmd,
      manageProjectBindingCmd,
      exportIssuesCmd
    );

    outputChannel.appendLine("All commands registered successfully");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to activate Goose SonarQube extension:", error);
    outputChannel.appendLine(`ACTIVATION ERROR: ${errorMessage}`);
    vscode.window.showErrorMessage(`Goose SonarQube failed to activate: ${errorMessage}`);
  }
}

export function deactivate(): void {
  console.log("Goose SonarQube extension is now deactivated");
}
