/**
 * ReportExporter - Export analysis reports in various formats
 *
 * Supports:
 * - Markdown format (human-readable)
 * - HTML format (with charts and styling)
 * - JSON format (CI/CD integration)
 */

import type { MergedAnalysisResult, CodeIssue, IssueSeverity } from "../types/analysis.types.js";

/**
 * Export format
 */
export type ExportFormat = "markdown" | "html" | "json";

/**
 * Export options
 */
export interface ExportOptions {
  /** Include summary section */
  includeSummary?: boolean;
  /** Include issue details */
  includeIssues?: boolean;
  /** Include statistics */
  includeStatistics?: boolean;
  /** Include impact analysis */
  includeImpact?: boolean;
  /** Include deduplication info */
  includeDeduplication?: boolean;
  /** Group issues by file */
  groupByFile?: boolean;
  /** Group issues by severity */
  groupBySeverity?: boolean;
  /** Maximum issues to show (0 = all) */
  maxIssues?: number;
  /** Panel header information */
  panelHeader?: {
    title?: string;
    subtitle?: string;
    changeSource?: string;
    sourceBranch?: string;
    targetBranch?: string;
    pullRequestNumber?: number;
    pullRequestTitle?: string;
    repository?: { owner: string; repo: string };
  };
}

/**
 * Default export options
 */
const DEFAULT_OPTIONS: Required<Omit<ExportOptions, "panelHeader">> &
  Pick<ExportOptions, "panelHeader"> = {
  includeSummary: true,
  includeIssues: true,
  includeStatistics: true,
  includeImpact: true,
  includeDeduplication: true,
  groupByFile: true,
  groupBySeverity: false,
  maxIssues: 0,
};

/**
 * ReportExporter - Generate reports in various formats
 */
export class ReportExporter {
  /**
   * Export report in specified format
   */
  export(result: MergedAnalysisResult, format: ExportFormat, options: ExportOptions = {}): string {
    const opts: Required<Omit<ExportOptions, "panelHeader">> & Pick<ExportOptions, "panelHeader"> =
      {
        ...DEFAULT_OPTIONS,
        ...options,
      };

    switch (format) {
      case "markdown":
        return this.exportMarkdown(result, opts);
      case "html":
        return this.exportHTML(result, opts);
      case "json":
        return this.exportJSON(result, opts);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export as Markdown
   */
  private exportMarkdown(
    result: MergedAnalysisResult,
    options: Required<Omit<ExportOptions, "panelHeader">> & Pick<ExportOptions, "panelHeader">
  ): string {
    const sections: string[] = [];

    // Title - use panel header if available
    const title = options.panelHeader?.title || "Code Review Analysis Report";
    sections.push(`# ${title}\n`);

    // Subtitle - use panel header subtitle if available
    if (options.panelHeader?.subtitle) {
      sections.push(`**${options.panelHeader.subtitle}**\n`);
    }

    sections.push(`**Generated**: ${new Date(result.timestamp).toLocaleString()}\n`);

    if (result.duration) {
      sections.push(`**Analysis Duration**: ${(result.duration / 1000).toFixed(2)}s\n`);
    }

    // Summary
    if (options.includeSummary) {
      sections.push(this.generateMarkdownSummary(result));
    }

    // Statistics
    if (options.includeStatistics) {
      sections.push(this.generateMarkdownStatistics(result));
    }

    // Impact Analysis
    if (options.includeImpact) {
      sections.push(this.generateMarkdownImpact(result));
    }

    // Deduplication Info
    if (options.includeDeduplication && result.deduplicationInfo) {
      sections.push(this.generateMarkdownDeduplication(result));
    }

    // Issues
    if (options.includeIssues) {
      sections.push(this.generateMarkdownIssues(result, options));
    }

    return sections.join("\n");
  }

  /**
   * Generate Markdown summary section
   */
  private generateMarkdownSummary(result: MergedAnalysisResult): string {
    const lines: string[] = ["\n## Summary\n"];
    const allIssues = result.fileAnalyses.flatMap((f) => f.issues);

    lines.push(`**Change Type**: ${result.changeType}`);
    lines.push(`**Total Issues**: ${allIssues.length}`);
    lines.push(`**Files Changed**: ${result.summary.filesChanged}`);
    lines.push(`**Lines Added**: +${result.summary.insertions}`);
    lines.push(`**Lines Deleted**: -${result.summary.deletions}`);
    lines.push(`**Quality Score**: ${result.impactAnalysis.qualityScore}/100`);
    lines.push(`**Risk Level**: ${this.formatRiskLevel(result.impactAnalysis.riskLevel)}\n`);

    return lines.join("\n");
  }

  /**
   * Generate Markdown statistics section
   */
  private generateMarkdownStatistics(result: MergedAnalysisResult): string {
    const lines: string[] = ["\n## Statistics\n"];
    const allIssues = result.fileAnalyses.flatMap((f) => f.issues);

    // Issues by severity
    lines.push("### Issues by Severity\n");
    const bySeverity = this.groupBySeverity(allIssues);
    for (const [severity, issues] of Object.entries(bySeverity)) {
      if (issues.length > 0) {
        lines.push(`- **${this.formatSeverity(severity as IssueSeverity)}**: ${issues.length}`);
      }
    }

    // Issues by type
    lines.push("\n### Issues by Type\n");
    const byType = this.groupByType(allIssues);
    for (const [type, issues] of Object.entries(byType)) {
      if (issues.length > 0) {
        lines.push(`- **${this.formatType(type)}**: ${issues.length}`);
      }
    }

    // Issues by source
    lines.push("\n### Issues by Source\n");
    const sonarCount = allIssues.filter((i) => i.source === "sonarqube").length;
    const aiCount = allIssues.filter((i) => i.source === "ai").length;
    lines.push(`- **SonarQube**: ${sonarCount}`);
    lines.push(`- **AI Analysis**: ${aiCount}\n`);

    return lines.join("\n");
  }

  /**
   * Generate Markdown impact section
   */
  private generateMarkdownImpact(result: MergedAnalysisResult): string {
    const lines: string[] = ["\n## Impact Analysis\n"];
    const impact = result.impactAnalysis;

    if (impact.affectedModules.length > 0) {
      lines.push("### Affected Modules\n");
      for (const module of impact.affectedModules) {
        lines.push(`- ${module}`);
      }
      lines.push("");
    }

    if (impact.breakingChanges.length > 0) {
      lines.push("### ⚠️ Breaking Changes\n");
      for (const change of impact.breakingChanges) {
        lines.push(`- ${change}`);
      }
      lines.push("");
    }

    if (impact.deploymentRisks.length > 0) {
      lines.push("### Deployment Risks\n");
      for (const risk of impact.deploymentRisks) {
        lines.push(`- ${risk}`);
      }
      lines.push("");
    }

    if (impact.testingRecommendations.length > 0) {
      lines.push("### Testing Recommendations\n");
      for (const rec of impact.testingRecommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Generate Markdown deduplication section
   */
  private generateMarkdownDeduplication(result: MergedAnalysisResult): string {
    const lines: string[] = ["\n## Deduplication\n"];
    const info = result.deduplicationInfo!;

    lines.push(`- **Total Issues Found**: ${info.totalIssues}`);
    lines.push(`- **Duplicates Removed**: ${info.duplicatesRemoved}`);
    lines.push(`- **Unique Issues**: ${info.uniqueIssues}`);

    if (info.totalIssues > 0) {
      const dedupeRate = ((info.duplicatesRemoved / info.totalIssues) * 100).toFixed(1);
      lines.push(`- **Deduplication Rate**: ${dedupeRate}%\n`);
    }

    return lines.join("\n");
  }

  /**
   * Generate Markdown issues section
   */
  private generateMarkdownIssues(
    result: MergedAnalysisResult,
    options: Required<Omit<ExportOptions, "panelHeader">> & Pick<ExportOptions, "panelHeader">
  ): string {
    const lines: string[] = ["\n## Issues\n"];
    const allIssues = result.fileAnalyses.flatMap((f) => f.issues);

    if (allIssues.length === 0) {
      lines.push("✅ No issues found!\n");
      return lines.join("\n");
    }

    const issuesToShow = options.maxIssues > 0 ? allIssues.slice(0, options.maxIssues) : allIssues;

    if (options.groupByFile) {
      lines.push(this.generateMarkdownIssuesByFile(result, issuesToShow));
    } else if (options.groupBySeverity) {
      lines.push(this.generateMarkdownIssuesBySeverity(issuesToShow));
    } else {
      lines.push(this.generateMarkdownIssuesList(issuesToShow));
    }

    if (options.maxIssues > 0 && allIssues.length > options.maxIssues) {
      lines.push(
        `\n_Showing ${options.maxIssues} of ${allIssues.length} issues. Use \`maxIssues: 0\` to show all._\n`
      );
    }

    return lines.join("\n");
  }

  /**
   * Generate issues grouped by file
   */
  private generateMarkdownIssuesByFile(result: MergedAnalysisResult, issues: CodeIssue[]): string {
    const lines: string[] = [];
    const issuesByFile = new Map<string, CodeIssue[]>();

    for (const issue of issues) {
      const fileIssues = issuesByFile.get(issue.file) || [];
      fileIssues.push(issue);
      issuesByFile.set(issue.file, fileIssues);
    }

    for (const [file, fileIssues] of issuesByFile) {
      lines.push(`### 📄 ${file}\n`);
      for (const issue of fileIssues) {
        lines.push(this.formatMarkdownIssue(issue));
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Generate issues grouped by severity
   */
  private generateMarkdownIssuesBySeverity(issues: CodeIssue[]): string {
    const lines: string[] = [];
    const bySeverity = this.groupBySeverity(issues);

    const severityOrder: IssueSeverity[] = ["critical", "high", "medium", "low", "info"];

    for (const severity of severityOrder) {
      const severityIssues = bySeverity[severity];
      if (severityIssues && severityIssues.length > 0) {
        lines.push(`### ${this.formatSeverity(severity)} (${severityIssues.length})\n`);
        for (const issue of severityIssues) {
          lines.push(this.formatMarkdownIssue(issue));
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate flat issues list
   */
  private generateMarkdownIssuesList(issues: CodeIssue[]): string {
    const lines: string[] = [];
    for (const issue of issues) {
      lines.push(this.formatMarkdownIssue(issue));
    }
    return lines.join("\n");
  }

  /**
   * Format a single issue in Markdown
   */
  private formatMarkdownIssue(issue: CodeIssue): string {
    const icon = this.getSeverityIcon(issue.severity);
    const location = issue.line > 0 ? `Line ${issue.line}` : "File-level";
    const source = issue.source === "sonarqube" ? "🔍 SonarQube" : "🤖 AI";

    let text = `${icon} **[${this.formatSeverity(issue.severity)}]** ${issue.message}\n`;
    text += `  - **Location**: ${issue.file}:${location}\n`;
    text += `  - **Type**: ${this.formatType(issue.type)}\n`;
    text += `  - **Source**: ${source}\n`;

    if (issue.rule) {
      text += `  - **Rule**: ${issue.rule}\n`;
    }

    if (issue.issueKey) {
      text += `  - **Issue Key**: ${issue.issueKey}\n`;
    }

    if (issue.status) {
      text += `  - **Status**: ${issue.status}\n`;
    }

    if (issue.effort) {
      text += `  - **Effort**: ${issue.effort} min\n`;
    }

    if (issue.debt) {
      text += `  - **Technical Debt**: ${issue.debt}\n`;
    }

    if (issue.assignee) {
      text += `  - **Assigned to**: ${issue.assignee}\n`;
    }

    if (issue.creationDate) {
      text += `  - **Created**: ${this.formatDate(issue.creationDate)}\n`;
    }

    if (issue.updateDate) {
      text += `  - **Updated**: ${this.formatDate(issue.updateDate)}\n`;
    }

    if (issue.tags && issue.tags.length > 0) {
      text += `  - **Tags**: ${issue.tags.join(", ")}\n`;
    }

    if (issue.description) {
      text += `\n  **Description**:\n  ${issue.description}\n`;
    }

    if (issue.whyIsThisAnIssue) {
      text += `\n  **Why is this an issue?**\n  ${this.stripHtml(issue.whyIsThisAnIssue)}\n`;
    }

    if (issue.howToFixIt) {
      text += `\n  **How to fix it**\n  ${this.stripHtml(issue.howToFixIt)}\n`;
    }

    if (issue.suggestion) {
      text += `\n  **Suggestion**:\n  \`\`\`\n  ${issue.suggestion}\n  \`\`\`\n`;
    }

    if (issue.issueUrl) {
      text += `\n  **View in SonarQube**: ${issue.issueUrl}\n`;
    }

    return text;
  }

  /**
   * Export as HTML
   */
  private exportHTML(
    result: MergedAnalysisResult,
    options: Required<Omit<ExportOptions, "panelHeader">> & Pick<ExportOptions, "panelHeader">
  ): string {
    const markdown = this.exportMarkdown(result, options);

    // Simple HTML wrapper (in production, use a proper markdown-to-html library)
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Review Analysis Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; }
    h3 { color: #7f8c8d; }
    .severity-critical { color: #e74c3c; font-weight: bold; }
    .severity-high { color: #e67e22; font-weight: bold; }
    .severity-medium { color: #f39c12; font-weight: bold; }
    .severity-low { color: #3498db; }
    .severity-info { color: #95a5a6; }
    .risk-critical { background: #e74c3c; color: white; padding: 4px 8px; border-radius: 4px; }
    .risk-high { background: #e67e22; color: white; padding: 4px 8px; border-radius: 4px; }
    .risk-medium { background: #f39c12; color: white; padding: 4px 8px; border-radius: 4px; }
    .risk-low { background: #27ae60; color: white; padding: 4px 8px; border-radius: 4px; }
    pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
    code { background: #f8f9fa; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: #ecf0f1; padding: 15px; border-radius: 6px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #2c3e50; }
    .stat-label { color: #7f8c8d; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <pre>${this.escapeHtml(markdown)}</pre>
  </div>
</body>
</html>
    `.trim();

    return html;
  }

  /**
   * Export as JSON
   */
  private exportJSON(
    result: MergedAnalysisResult,
    options: Required<Omit<ExportOptions, "panelHeader">> & Pick<ExportOptions, "panelHeader">
  ): string {
    const allIssues = result.fileAnalyses.flatMap((f) => f.issues);

    const output: any = {
      metadata: {
        timestamp: result.timestamp,
        duration: result.duration,
        changeType: result.changeType,
      },
    };

    // Include panel header information if available
    if (options.panelHeader) {
      output.panelHeader = {
        title: options.panelHeader.title || "Code Review Analysis Report",
        subtitle: options.panelHeader.subtitle,
        changeSource: options.panelHeader.changeSource,
        sourceBranch: options.panelHeader.sourceBranch,
        targetBranch: options.panelHeader.targetBranch,
        pullRequestNumber: options.panelHeader.pullRequestNumber,
        pullRequestTitle: options.panelHeader.pullRequestTitle,
        repository: options.panelHeader.repository,
      };
    }

    if (options.includeSummary) {
      output.summary = result.summary;
    }

    if (options.includeStatistics) {
      output.statistics = {
        totalIssues: allIssues.length,
        bySeverity: this.countBySeverity(allIssues),
        byType: this.countByType(allIssues),
        bySource: {
          sonarqube: allIssues.filter((i) => i.source === "sonarqube").length,
          ai: allIssues.filter((i) => i.source === "ai").length,
        },
      };
    }

    if (options.includeImpact) {
      output.impact = result.impactAnalysis;
    }

    if (options.includeDeduplication && result.deduplicationInfo) {
      output.deduplication = result.deduplicationInfo;
    }

    if (options.includeIssues) {
      const issuesToShow =
        options.maxIssues > 0 ? allIssues.slice(0, options.maxIssues) : allIssues;
      output.issues = issuesToShow;
    }

    output.fileAnalyses = result.fileAnalyses;

    return JSON.stringify(output, null, 2);
  }

  // Helper methods

  private groupBySeverity(issues: CodeIssue[]): Record<IssueSeverity, CodeIssue[]> {
    const groups: Record<IssueSeverity, CodeIssue[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };

    for (const issue of issues) {
      groups[issue.severity].push(issue);
    }

    return groups;
  }

  private groupByType(issues: CodeIssue[]): Record<string, CodeIssue[]> {
    const groups: Record<string, CodeIssue[]> = {};
    for (const issue of issues) {
      if (!groups[issue.type]) {
        groups[issue.type] = [];
      }
      groups[issue.type].push(issue);
    }
    return groups;
  }

  private countBySeverity(issues: CodeIssue[]): Record<IssueSeverity, number> {
    const counts: Record<IssueSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const issue of issues) {
      counts[issue.severity]++;
    }

    return counts;
  }

  private countByType(issues: CodeIssue[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const issue of issues) {
      counts[issue.type] = (counts[issue.type] || 0) + 1;
    }
    return counts;
  }

  private formatSeverity(severity: IssueSeverity): string {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  }

  private formatType(type: string): string {
    return type
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private formatRiskLevel(level: string): string {
    const emoji: Record<string, string> = {
      critical: "🔴 Critical",
      high: "🟠 High",
      medium: "🟡 Medium",
      low: "🟢 Low",
    };
    return emoji[level] || level;
  }

  private getSeverityIcon(severity: IssueSeverity): string {
    const icons: Record<IssueSeverity, string> = {
      critical: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🔵",
      info: "ℹ️",
    };
    return icons[severity];
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Strip HTML tags and convert to plain text
   */
  private stripHtml(html: string): string {
    // Remove HTML tags
    let text = html.replace(/<[^>]*>/g, "");
    // Decode HTML entities
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, " ");
    // Clean up whitespace
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  /**
   * Format date for display
   */
  private formatDate(isoDate: string): string {
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoDate;
    }
  }
}
