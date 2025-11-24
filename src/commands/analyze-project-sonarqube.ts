/**
 * Analyze Project with SonarQube Command
 *
 * VS Code command for analyzing entire project using SonarQube.
 */

import * as vscode from 'vscode';
import {
  ProjectAnalysisService,
  type ProjectAnalysisOptions,
  type ProjectAnalysisResult,
} from '../git-analyzer/index.js';
import { SonarQubeConfigService } from '../services/sonarqube-config-service.js';

/**
 * Get quality status emoji based on status string
 */
function getQualityStatusEmoji(status: string): string {
  if (status === 'OK') return '✓';
  if (status === 'ERROR') return '✗';
  return '⚠';
}

/**
 * Display analysis header in output channel
 */
function displayAnalysisHeader(
  outputChannel: vscode.OutputChannel,
  result: ProjectAnalysisResult
): void {
  outputChannel.appendLine('\n' + '='.repeat(60));
  outputChannel.appendLine('ANALYSIS COMPLETE');
  outputChannel.appendLine('='.repeat(60));
  outputChannel.appendLine(`\nProject: ${result.projectKey}`);
  outputChannel.appendLine(`Analysis Date: ${result.analysisDate}`);
  outputChannel.appendLine(`Execution Time: ${result.scanResult.executionTime}ms`);

  if (result.dashboardUrl) {
    outputChannel.appendLine(`\nDashboard: ${result.dashboardUrl}`);
  }

  if (result.qualityStatus) {
    const statusEmoji = getQualityStatusEmoji(result.qualityStatus);
    outputChannel.appendLine(`\nQuality Gate: ${statusEmoji} ${result.qualityStatus}`);
  }
}

/**
 * Display analysis summary in output channel
 */
function displayAnalysisSummary(
  outputChannel: vscode.OutputChannel,
  result: ProjectAnalysisResult
): void {
  outputChannel.appendLine('\nSummary:');
  outputChannel.appendLine(`  Total Issues: ${result.summary.totalIssues}`);
  outputChannel.appendLine(`  Blocker: ${result.summary.blockerIssues}`);
  outputChannel.appendLine(`  Critical: ${result.summary.criticalIssues}`);
  outputChannel.appendLine(`  Bugs: ${result.summary.bugs}`);
  outputChannel.appendLine(`  Vulnerabilities: ${result.summary.vulnerabilities}`);
  outputChannel.appendLine(`  Code Smells: ${result.summary.codeSmells}`);
  outputChannel.appendLine(`  Security Hotspots: ${result.summary.securityHotspots}`);
}

/**
 * Display analysis metrics in output channel
 */
function displayAnalysisMetrics(
  outputChannel: vscode.OutputChannel,
  result: ProjectAnalysisResult
): void {
  if (!result.analysisResult) return;

  outputChannel.appendLine('\nMetrics:');
  outputChannel.appendLine(
    `  Lines of Code: ${result.analysisResult.metrics.linesOfCode || 'N/A'}`
  );
  outputChannel.appendLine(
    `  Coverage: ${result.analysisResult.metrics.coverage?.toFixed(1) || 'N/A'}%`
  );
  outputChannel.appendLine(
    `  Duplicated Lines: ${result.analysisResult.metrics.duplicatedLinesDensity?.toFixed(1) || 'N/A'}%`
  );
  outputChannel.appendLine(
    `  Technical Debt Ratio: ${result.analysisResult.metrics.technicalDebtRatio?.toFixed(1) || 'N/A'}%`
  );
}

/**
 * Display analysis results in output channel
 */
function displayAnalysisResults(
  outputChannel: vscode.OutputChannel,
  result: ProjectAnalysisResult
): void {
  displayAnalysisHeader(outputChannel, result);
  displayAnalysisSummary(outputChannel, result);
  displayAnalysisMetrics(outputChannel, result);
  outputChannel.appendLine('\n' + '='.repeat(60) + '\n');
}

/**
 * Show completion notification based on quality status
 */
function showCompletionNotification(result: ProjectAnalysisResult): void {
  const message = `Analysis complete! Found ${result.summary.totalIssues} issues (${result.summary.blockerIssues} blocker, ${result.summary.criticalIssues} critical)`;

  if (result.qualityStatus === 'ERROR') {
    vscode.window.showWarningMessage(message);
  } else {
    vscode.window.showInformationMessage(message);
  }
}

/**
 * Offer to open SonarQube dashboard
 */
async function offerDashboardOpen(dashboardUrl: string): Promise<void> {
  const openDashboard = 'Open Dashboard';
  const action = await vscode.window.showInformationMessage(
    'View results in SonarQube dashboard?',
    openDashboard
  );

  if (action === openDashboard) {
    await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
  }
}

/**
 * Test SonarQube connection
 */
async function testConnection(
  service: ProjectAnalysisService,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  outputChannel.appendLine('Testing connection to SonarQube server...');
  const connectionTest = await service.testConnection();

  if (!connectionTest.success) {
    throw new Error(`Connection failed: ${connectionTest.error}`);
  }

  outputChannel.appendLine(`✓ Connected successfully (${connectionTest.responseTime}ms)\n`);
}

/**
 * Execute project analysis
 */
async function executeAnalysis(
  service: ProjectAnalysisService,
  workingDirectory: string,
  progress: vscode.Progress<{ message?: string }>,
  outputChannel: vscode.OutputChannel
): Promise<{ result: ProjectAnalysisResult; exportPath: string }> {
  const options: ProjectAnalysisOptions = {
    workingDirectory,
    waitForCompletion: true,
    timeout: 300000, // 5 minutes
    includeQualityGate: true,
    includeMetrics: true,
    includeIssues: true,
  };

  progress.report({ message: 'Running scanner...' });
  outputChannel.appendLine('Executing SonarQube scanner...');

  return await service.analyzeAndExport(options);
}

/**
 * Run SonarQube analysis workflow
 */
async function runAnalysis(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  outputChannel.appendLine('Starting SonarQube project analysis...\n');

  // Get workspace folder
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const workingDirectory = workspaceFolder.uri.fsPath;
  outputChannel.appendLine(`Working directory: ${workingDirectory}`);

  // Get SonarQube configuration
  const configService = new SonarQubeConfigService(context);
  const sonarQubeConfig = await configService.getSonarQubeConfig();

  if (!sonarQubeConfig) {
    const setupAction = 'Setup SonarQube';
    const result = await vscode.window.showErrorMessage(
      'SonarQube is not configured. Please add a connection and bind a project.',
      setupAction
    );

    if (result === setupAction) {
      await vscode.commands.executeCommand('gooseCodeReview.addSonarQubeConnection');
    }
    return;
  }

  outputChannel.appendLine(`Project Key: ${sonarQubeConfig.projectKey}`);
  outputChannel.appendLine(`Server URL: ${sonarQubeConfig.serverUrl}\n`);

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing project with SonarQube',
      cancellable: false,
    },
    async (progress) => {
      // Initialize service
      progress.report({ message: 'Initializing...' });
      const projectAnalysisService = new ProjectAnalysisService(sonarQubeConfig);

      // Test connection
      progress.report({ message: 'Testing connection...' });
      await testConnection(projectAnalysisService, outputChannel);

      // Execute analysis and export to temp file
      const { result, exportPath } = await executeAnalysis(
        projectAnalysisService,
        workingDirectory,
        progress,
        outputChannel
      );

      // Display results
      progress.report({ message: 'Generating report...' });
      displayAnalysisResults(outputChannel, result);

      // Display export path
      outputChannel.appendLine(`\nExported to: ${exportPath}\n`);

      // Show completion message
      showCompletionNotification(result);

      // Offer to open dashboard
      if (result.dashboardUrl) {
        await offerDashboardOpen(result.dashboardUrl);
      }
    }
  );
}

/**
 * Register analyze-project-sonarqube command
 */
export function registerAnalyzeProjectSonarQubeCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand('gooseCodeReview.analyzeProjectSonarQube', async () => {
    const outputChannel = vscode.window.createOutputChannel('Goose: SonarQube Project Analysis');
    outputChannel.show();

    try {
      await runAnalysis(context, outputChannel);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during analysis';
      outputChannel.appendLine(`\n✗ Error: ${errorMessage}\n`);
      vscode.window.showErrorMessage(`SonarQube analysis failed: ${errorMessage}`);
    }
  });
}
