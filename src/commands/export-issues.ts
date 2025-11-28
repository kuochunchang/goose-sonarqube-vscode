/**
 * Export SonarQube Issues Command
 *
 * VS Code command for exporting all SonarQube issues to various formats.
 */

import * as vscode from "vscode";
import { SonarQubeConfigService } from "../services/sonarqube-config-service.js";
import { SonarQubeService } from "../git-analyzer/services/SonarQubeService.js";
import {
  ReportExporter,
  type ExportFormat,
  type ExportOptions,
} from "../git-analyzer/services/ReportExporter.js";
import type {
  MergedAnalysisResult,
  CodeIssue,
  FileAnalysis,
  IssueSeverity,
  IssueType,
} from "../git-analyzer/types/analysis.types.js";
import type {
  SonarQubeIssue,
  SonarQubeSeverity,
  SonarQubeIssueType,
} from "../git-analyzer/types/sonarqube.types.js";

/**
 * Convert SonarQube severity to internal severity
 * Supports both legacy severity and new Clean Code impacts
 */
function convertSeverity(severity: SonarQubeSeverity): IssueSeverity {
  switch (severity) {
    case "BLOCKER":
    case "CRITICAL":
      return "critical";
    case "MAJOR":
      return "high";
    case "MINOR":
      return "medium";
    case "INFO":
      return "info";
    default:
      return "medium";
  }
}

/**
 * Convert Clean Code impacts severity to internal severity
 */
function convertImpactsSeverity(impactsSeverity: string): IssueSeverity {
  switch (impactsSeverity) {
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    case "LOW":
      return "low";
    default:
      return "medium";
  }
}

/**
 * Convert SonarQube issue type to internal type
 */
function convertIssueType(type: SonarQubeIssueType): IssueType {
  switch (type) {
    case "BUG":
      return "bug";
    case "VULNERABILITY":
      return "vulnerability";
    case "CODE_SMELL":
      return "code-smell";
    case "SECURITY_HOTSPOT":
      return "security-hotspot";
    default:
      return "code-smell";
  }
}

/**
 * Extract file path from SonarQube component
 */
function extractFilePath(component: string, projectKey: string): string {
  // Component format: "projectKey:path/to/file.ts"
  const prefix = `${projectKey}:`;
  if (component.startsWith(prefix)) {
    return component.substring(prefix.length);
  }
  return component;
}

/**
 * Fetch all issues from SonarQube with pagination
 */
async function fetchAllIssues(
  service: SonarQubeService,
  projectKey: string,
  outputChannel: vscode.OutputChannel
): Promise<SonarQubeIssue[]> {
  const allIssues: SonarQubeIssue[] = [];
  let pageIndex = 1;
  const pageSize = 500;
  let hasMore = true;

  outputChannel.appendLine(`Fetching issues for project: ${projectKey}`);

  // Create a method to fetch issues with pagination using the service's config
  const config = (service as any).config;

  while (hasMore) {
    const url = new URL(`${config.serverUrl}/api/issues/search`);
    url.searchParams.set("componentKeys", projectKey);
    url.searchParams.set("ps", pageSize.toString());
    url.searchParams.set("p", pageIndex.toString());

    outputChannel.appendLine(`Fetching page ${pageIndex}...`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: config.token
          ? `Basic ${Buffer.from(config.token + ":").toString("base64")}`
          : "",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch issues: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      issues: SonarQubeIssue[];
      total: number;
      p: number;
      ps: number;
    };

    allIssues.push(...data.issues);
    outputChannel.appendLine(
      `Fetched ${data.issues.length} issues (total: ${allIssues.length}/${data.total})`
    );

    hasMore = allIssues.length < data.total;
    pageIndex++;
  }

  outputChannel.appendLine(`✓ Fetched all ${allIssues.length} issues`);

  // Debug: Log severity distribution from SonarQube
  const severityCount = allIssues.reduce(
    (acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  outputChannel.appendLine(
    `Original SonarQube severity distribution: ${JSON.stringify(severityCount)}`
  );

  // Debug: Log first issue structure to see if there's an impacts field
  if (allIssues.length > 0) {
    outputChannel.appendLine(`Sample issue structure: ${JSON.stringify(allIssues[0], null, 2)}`);
  }

  return allIssues;
}

/**
 * Convert SonarQube issues to MergedAnalysisResult format
 */
async function convertToAnalysisResult(
  issues: SonarQubeIssue[],
  projectKey: string,
  service: SonarQubeService,
  outputChannel: vscode.OutputChannel
): Promise<MergedAnalysisResult> {
  outputChannel.appendLine("Converting issues to analysis result format...");

  // Fetch unique rule details
  const uniqueRules = [...new Set(issues.map((issue) => issue.rule))];
  const ruleDetailsMap = new Map<string, any>();

  outputChannel.appendLine(`Fetching details for ${uniqueRules.length} unique rules...`);
  for (const ruleKey of uniqueRules) {
    try {
      const details = await service.getRuleDetails(ruleKey);
      if (details) {
        ruleDetailsMap.set(ruleKey, details);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Warning: Failed to fetch rule details for ${ruleKey}: ${errorMsg}`);
    }
  }
  outputChannel.appendLine(`✓ Fetched ${ruleDetailsMap.size} rule details`);

  // Convert issues to CodeIssue format
  const codeIssues: CodeIssue[] = issues.map((issue) => {
    const ruleDetails = ruleDetailsMap.get(issue.rule);
    const filePath = extractFilePath(issue.component, projectKey);

    // Prefer Clean Code impacts severity over legacy severity (for SonarQube 25.x+)
    const issueData = issue as any;
    let severity: IssueSeverity;
    if (issueData.impacts && issueData.impacts.length > 0) {
      // Use new Clean Code impacts severity
      severity = convertImpactsSeverity(issueData.impacts[0].severity);
    } else {
      // Fall back to legacy severity
      severity = convertSeverity(issue.severity);
    }

    return {
      source: "sonarqube",
      severity,
      type: convertIssueType(issue.type),
      file: filePath,
      line: issue.textRange?.startLine || 0,
      message: issue.message,
      description: ruleDetails?.htmlDesc,
      rule: issue.rule,
      effort: issue.effort ? parseInt(issue.effort) : undefined,
      status: issue.status,
      tags: issue.tags,
      creationDate: issue.creationDate,
      updateDate: issue.updateDate,
      debt: issue.debt,
      assignee: issue.assignee,
      issueKey: issue.key,
      issueUrl: service.getIssueUrl(issue.key),
      ruleUrl: service.getRuleUrl(issue.rule),
      whyIsThisAnIssue: ruleDetails?.whyIsThisAnIssue,
      howToFixIt: ruleDetails?.howToFixIt,
      impacts: issueData.impacts, // Preserve impacts for filtering
    } as any;
  });

  // Group issues by file
  const fileIssuesMap = new Map<string, CodeIssue[]>();
  for (const issue of codeIssues) {
    const existing = fileIssuesMap.get(issue.file) || [];
    existing.push(issue);
    fileIssuesMap.set(issue.file, existing);
  }

  // Create file analyses
  const fileAnalyses: FileAnalysis[] = Array.from(fileIssuesMap.entries()).map(
    ([file, fileIssues]) => ({
      file,
      changeType: "unknown" as const,
      issues: fileIssues,
      summary: `${fileIssues.length} issue(s) found`,
      linesChanged: 0,
      qualityScore: undefined,
    })
  );

  // Calculate severity counts
  const severityCounts = {
    critical: codeIssues.filter((i) => i.severity === "critical").length,
    high: codeIssues.filter((i) => i.severity === "high").length,
    medium: codeIssues.filter((i) => i.severity === "medium").length,
    low: codeIssues.filter((i) => i.severity === "low").length,
    info: codeIssues.filter((i) => i.severity === "info").length,
  };

  // Determine risk level
  let riskLevel: "low" | "medium" | "high" | "critical";
  if (severityCounts.critical > 0) {
    riskLevel = "critical";
  } else if (severityCounts.high > 0) {
    riskLevel = "high";
  } else if (severityCounts.medium > 5) {
    riskLevel = "medium";
  } else {
    riskLevel = "low";
  }

  const result: MergedAnalysisResult = {
    changeType: "working-directory",
    summary: {
      filesChanged: fileAnalyses.length,
      insertions: 0,
      deletions: 0,
    },
    fileAnalyses,
    impactAnalysis: {
      riskLevel,
      affectedModules: [],
      breakingChanges: [],
      testingRecommendations: [],
      deploymentRisks: [],
      qualityScore: Math.max(0, 100 - severityCounts.critical * 20 - severityCounts.high * 5),
    },
    timestamp: new Date().toISOString(),
    deduplicationInfo: {
      totalIssues: codeIssues.length,
      duplicatesRemoved: 0,
      uniqueIssues: codeIssues.length,
    },
  };

  outputChannel.appendLine(`✓ Converted ${codeIssues.length} issues to analysis result`);
  return result;
}

/**
 * Export all SonarQube issues
 */
export async function exportIssues(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel: vscode.OutputChannel =
    (global as any).gooseOutputChannel || vscode.window.createOutputChannel("Goose SonarQube");

  try {
    outputChannel.show();
    outputChannel.appendLine("\n=== Export SonarQube Issues ===");

    // Get SonarQube configuration
    const configService = new SonarQubeConfigService(context);
    const config = await configService.getSonarQubeConfig();

    if (!config) {
      vscode.window.showErrorMessage(
        "No SonarQube project binding found. Please bind to a SonarQube project first."
      );
      return;
    }

    outputChannel.appendLine(`Project: ${config.projectKey}`);
    outputChannel.appendLine(`Server: ${config.serverUrl}`);

    // Create SonarQube service
    const service = new SonarQubeService(config);

    // Test connection
    outputChannel.appendLine("\nTesting connection...");
    const connectionTest = await service.testConnection();
    if (!connectionTest.success) {
      vscode.window.showErrorMessage(`Failed to connect to SonarQube: ${connectionTest.error}`);
      return;
    }
    outputChannel.appendLine(`✓ Connected to SonarQube ${connectionTest.version}`);

    // Fetch all issues
    let savedFilePath: vscode.Uri | undefined;
    let issueCount = 0;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Exporting SonarQube Issues",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Fetching issues..." });
        const issues = await fetchAllIssues(service, config.projectKey, outputChannel);

        if (issues.length === 0) {
          vscode.window.showInformationMessage("No issues found in the project.");
          outputChannel.appendLine("\nNo issues to export.");
          return;
        }

        issueCount = issues.length;

        progress.report({ message: "Converting issues..." });
        const analysisResult = await convertToAnalysisResult(
          issues,
          config.projectKey,
          service,
          outputChannel
        );

        // Prompt for Software Quality selection
        const qualityOptions = [
          { label: "Security", value: "SECURITY", picked: true },
          { label: "Reliability", value: "RELIABILITY", picked: true },
          { label: "Maintainability", value: "MAINTAINABILITY", picked: true },
        ];

        const selectedQualities = await vscode.window.showQuickPick(qualityOptions, {
          placeHolder: "Select Software Quality types to include",
          canPickMany: true,
          ignoreFocusOut: true,
        });

        if (!selectedQualities || selectedQualities.length === 0) {
          vscode.window.showWarningMessage("No Software Quality selected. Export cancelled.");
          return;
        }

        const selectedQualityValues = selectedQualities.map((q) => q.value);

        // Filter issues by selected Software Quality
        const filteredFileAnalyses = analysisResult.fileAnalyses
          .map((fileAnalysis) => ({
            ...fileAnalysis,
            issues: fileAnalysis.issues.filter((issue) => {
              // Check if issue has impacts with selected software quality
              const issueData = issue as any;
              if (!issueData.impacts || issueData.impacts.length === 0) {
                return true; // Include issues without impacts (backward compatibility)
              }
              return issueData.impacts.some((impact: any) =>
                selectedQualityValues.includes(impact.softwareQuality)
              );
            }),
          }))
          .filter((fileAnalysis) => fileAnalysis.issues.length > 0); // Remove files with no issues

        const filteredResult: MergedAnalysisResult = {
          ...analysisResult,
          fileAnalyses: filteredFileAnalyses,
        };

        const totalFilteredIssues = filteredFileAnalyses.reduce(
          (sum, fa) => sum + fa.issues.length,
          0
        );

        if (totalFilteredIssues === 0) {
          vscode.window.showInformationMessage(
            "No issues match the selected Software Quality types."
          );
          outputChannel.appendLine("\nNo matching issues to export.");
          return;
        }

        outputChannel.appendLine(
          `Filtered to ${totalFilteredIssues} issues matching: ${selectedQualities.map((q) => q.label).join(", ")}`
        );

        // Prompt for Severity selection
        const severityOptions = [
          { label: "🔴 Critical", value: "critical", picked: true },
          { label: "🟠 High", value: "high", picked: true },
          { label: "🟡 Medium", value: "medium", picked: true },
          { label: "🔵 Low", value: "low", picked: true },
          { label: "ℹ️ Info", value: "info", picked: true },
        ];

        const selectedSeverities = await vscode.window.showQuickPick(severityOptions, {
          placeHolder: "Select severity levels to include",
          canPickMany: true,
          ignoreFocusOut: true,
        });

        if (!selectedSeverities || selectedSeverities.length === 0) {
          vscode.window.showWarningMessage("No severity selected. Export cancelled.");
          return;
        }

        const selectedSeverityValues = selectedSeverities.map((s) => s.value);

        // Filter issues by selected severity
        const severityFilteredFileAnalyses = filteredResult.fileAnalyses
          .map((fileAnalysis) => ({
            ...fileAnalysis,
            issues: fileAnalysis.issues.filter((issue) =>
              selectedSeverityValues.includes(issue.severity)
            ),
          }))
          .filter((fileAnalysis) => fileAnalysis.issues.length > 0);

        const finalResult: MergedAnalysisResult = {
          ...filteredResult,
          fileAnalyses: severityFilteredFileAnalyses,
        };

        const totalFinalIssues = severityFilteredFileAnalyses.reduce(
          (sum, fa) => sum + fa.issues.length,
          0
        );

        if (totalFinalIssues === 0) {
          vscode.window.showInformationMessage("No issues match the selected criteria.");
          outputChannel.appendLine("\nNo matching issues to export.");
          return;
        }

        outputChannel.appendLine(
          `Further filtered to ${totalFinalIssues} issues with severity: ${selectedSeverities.map((s) => s.label).join(", ")}`
        );

        // Prompt for export format
        const formatChoice = await vscode.window.showQuickPick(
          [
            { label: "Markdown", value: "markdown" as ExportFormat },
            { label: "HTML", value: "html" as ExportFormat },
            { label: "JSON", value: "json" as ExportFormat },
          ],
          { placeHolder: "Select export format" }
        );

        if (!formatChoice) {
          return;
        }

        progress.report({ message: `Generating ${formatChoice.label} report...` });

        // Generate report
        const exporter = new ReportExporter();

        // Build filter description
        const qualityFilter = selectedQualities.map((q) => q.label).join(", ");
        const severityFilter = selectedSeverities.map((s) => s.label).join(", ");
        const filterDescription = `Filters: Quality=[${qualityFilter}], Severity=[${severityFilter}]`;

        const exportOptions: ExportOptions = {
          includeSummary: true,
          includeIssues: true,
          includeStatistics: true,
          includeImpact: true,
          includeDeduplication: true,
          groupByFile: true,
          panelHeader: {
            title: `SonarQube Issues - ${config.projectKey}`,
            subtitle: `Exported: ${new Date().toLocaleString()} | Total Issues: ${issues.length} | Filtered: ${totalFinalIssues}\n${filterDescription}`,
          },
        };

        const report = exporter.export(finalResult, formatChoice.value, exportOptions);

        // Prompt for save location
        const fileExtension = formatChoice.value === "markdown" ? "md" : formatChoice.value;
        const defaultFileName = `sonarqube-issues-${config.projectKey}.${fileExtension}`;

        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(defaultFileName),
          filters: {
            [formatChoice.label]: [fileExtension],
            "All Files": ["*"],
          },
        });

        if (!saveUri) {
          return;
        }

        // Write file
        progress.report({ message: "Saving report..." });
        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(report, "utf-8"));

        savedFilePath = saveUri;
        outputChannel.appendLine(`\n✓ Report saved to: ${saveUri.fsPath}`);
      }
    );

    // Offer to open the file (outside withProgress so notification disappears)
    if (savedFilePath) {
      vscode.window.showInformationMessage(
        `Exported ${issueCount} issues to ${savedFilePath.fsPath}`
      );

      const openChoice = await vscode.window.showInformationMessage(
        "Export complete. Open the file?",
        "Open",
        "Close"
      );

      if (openChoice === "Open") {
        await vscode.commands.executeCommand("vscode.open", savedFilePath);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`\n❌ Error: ${errorMessage}`);
    vscode.window.showErrorMessage(`Failed to export issues: ${errorMessage}`);
  }
}
