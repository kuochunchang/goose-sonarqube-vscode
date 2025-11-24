/**
 * PRAnalysisService - Pull Request analysis orchestrator
 *
 * Integrates:
 * - GitHubService (PR metadata & file changes)
 * - ChangeAnalyzer (AI analysis)
 * - SonarQubeService (static analysis) - optional
 * - MergeService (result merging)
 * - ReportExporter (report generation)
 *
 * Workflow:
 * 1. Fetch PR metadata and files from GitHub
 * 2. Analyze changes using AI + SonarQube (if available)
 * 3. Merge and deduplicate results
 * 4. Generate markdown report
 * 5. Post comment to PR (if requested)
 */

import { GitHubService } from "./GitHubService.js";
import { ChangeAnalyzer, type IAIProvider } from "./ChangeAnalyzer.js";
import { MergeService } from "./MergeService.js";
import { ReportExporter } from "./ReportExporter.js";
import { SonarQubeService } from "./SonarQubeService.js";
import type { GitHubConfig, PRAnalysisRequest, PRAnalysisResult } from "../types/github.types.js";
import type { AnalysisOptions, MergedAnalysisResult } from "../types/analysis.types.js";
import type {
  SonarQubeConfig,
  SonarQubeAnalysisResult,
  SonarQubeConnectionTest,
} from "../types/sonarqube.types.js";

export interface PRAnalysisServiceConfig {
  /** GitHub configuration */
  github: GitHubConfig;
  /** AI provider for semantic analysis */
  aiProvider: IAIProvider;
  /** SonarQube configuration (optional) */
  sonarqube?: SonarQubeConfig;
  /** Working directory (for analysis) */
  workingDir?: string;
}

export class PRAnalysisService {
  private readonly githubService: GitHubService;
  private readonly changeAnalyzer: ChangeAnalyzer;
  private readonly mergeService: MergeService;
  private readonly reportExporter: ReportExporter;
  private readonly sonarqubeService?: SonarQubeService;

  constructor(private readonly config: PRAnalysisServiceConfig) {
    this.githubService = new GitHubService(config.github);
    this.changeAnalyzer = new ChangeAnalyzer({
      aiProvider: config.aiProvider,
      repoPath: config.workingDir || process.cwd(),
    });
    this.mergeService = new MergeService();
    this.reportExporter = new ReportExporter();

    if (config.sonarqube) {
      this.sonarqubeService = new SonarQubeService(config.sonarqube);
    }
  }

  /**
   * Analyze a Pull Request
   */
  async analyzePullRequest(request: PRAnalysisRequest): Promise<PRAnalysisResult> {
    try {
      // 1. Fetch PR metadata
      const pullRequest = await this.githubService.getPullRequest(
        request.repository,
        request.prNumber
      );

      // 2. Analyze using AI (working directory analysis)
      const analysisOptions: AnalysisOptions = {
        checkQuality: request.analysisTypes?.includes("quality") ?? true,
        checkSecurity: request.analysisTypes?.includes("security") ?? true,
        checkArchitecture: request.analysisTypes?.includes("architecture") ?? true,
      };

      // Run AI analysis on working directory changes
      const aiResult = await this.changeAnalyzer.analyzeWorkingDirectory(analysisOptions);

      // Run SonarQube analysis (if available) - simplified for now
      let sonarqubeResult: SonarQubeAnalysisResult | undefined;
      // TODO: Implement SonarQube PR analysis in future version
      // if (this.sonarqubeService && this.config.workingDir) {
      //   try {
      //     const sqResult = await this.sonarqubeService.analyzeChangedFiles(...);
      //     if (sqResult) {
      //       sonarqubeResult = sqResult;
      //     }
      //   } catch (error) {
      //     console.warn('SonarQube analysis failed, continuing with AI-only:', error);
      //   }
      // }

      // 3. For now, use the AI result directly as the merged result
      // TODO: Properly merge with SonarQube results when available
      const mergedResult: MergedAnalysisResult = {
        ...aiResult,
        sonarQubeResults: sonarqubeResult,
        aiResults: undefined, // Will be populated when we have separate AI results
      };

      // 4. Generate report
      const reportMarkdown = this.reportExporter.export(mergedResult, "markdown", {
        includeStatistics: true,
      });

      // 5. Format as PR comment
      const commentBody = this.formatPRComment(
        pullRequest.title,
        pullRequest.number,
        mergedResult,
        reportMarkdown
      );

      // 6. Post comment if requested
      let commentId: number | undefined;
      let commentUrl: string | undefined;

      if (request.postComment) {
        const comment = await this.githubService.postComment({
          repository: request.repository,
          prNumber: request.prNumber,
          body: commentBody,
          collapsePrevious: true, // Collapse previous bot comments
        });
        commentId = comment.id;
        commentUrl = comment.url;
      }

      // 7. Return result - Extract issues from fileAnalyses
      const allIssues = mergedResult.fileAnalyses.flatMap((fa) => fa.issues);

      return {
        pullRequest,
        analysis: {
          totalIssues: allIssues.length,
          filesAnalyzed: mergedResult.fileAnalyses.length,
          qualityScore: mergedResult.impactAnalysis.qualityScore,
          riskLevel: mergedResult.impactAnalysis.riskLevel,
          issues: allIssues
            .filter((issue) => issue.severity !== "info") // Filter out 'info' severity
            .map((issue) => ({
              file: issue.file,
              line: issue.line,
              severity: issue.severity as "critical" | "high" | "medium" | "low",
              type: String(issue.type),
              message: issue.message,
              source: issue.source as "sonarqube" | "ai",
            })),
        },
        commentId,
        commentUrl,
      };
    } catch (error) {
      throw new Error(
        `PR analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Format analysis result as PR comment
   */
  private formatPRComment(
    prTitle: string,
    prNumber: number,
    result: MergedAnalysisResult,
    reportMarkdown: string
  ): string {
    const timestamp = new Date().toISOString();
    const allIssues = result.fileAnalyses.flatMap((fa) => fa.issues);
    const filesAnalyzed = result.fileAnalyses.length;

    return `# 🔍 Code Review Analysis

**Pull Request**: #${prNumber} - ${prTitle}  
**Analyzed At**: ${timestamp}  
**Powered By**: Goose Code Review (AI + SonarQube)

---

## 📊 Summary

| Metric | Value |
|--------|-------|
| 🐛 Total Issues | **${allIssues.length}** |
| 📁 Files Analyzed | **${filesAnalyzed}** |
| ⭐ Quality Score | **${result.impactAnalysis.qualityScore}/100** |
| ⚠️ Risk Level | **${result.impactAnalysis.riskLevel.toUpperCase()}** |

### Severity Breakdown

${this.formatSeverityBreakdown(allIssues)}

---

${reportMarkdown}

---

<details>
<summary>📚 About This Analysis</summary>

This automated code review was performed by **Goose Code Review**, combining:
- 🤖 **AI Analysis**: Semantic understanding, design patterns, best practices
- 🔍 **SonarQube**: Static analysis, code quality metrics, security vulnerabilities

**Analysis Types**:
- ✅ Code Quality Review
- ✅ Security Analysis
- ✅ Impact Assessment
- ✅ Architecture Review

**How to respond**:
- ✏️ Address critical and high severity issues before merging
- 📖 Review medium/low severity issues for continuous improvement
- 💬 Reply to this comment if you have questions
- 🔄 Push new commits to trigger re-analysis

</details>

---

> 🤖 *Automated by [Goose Code Review](https://github.com/kuochunchang/code-review-goose)*
`;
  }

  /**
   * Format severity breakdown as markdown
   */
  private formatSeverityBreakdown(issues: Array<{ severity: string; [key: string]: any }>): string {
    const breakdown = {
      critical: issues.filter((i) => i.severity === "critical").length,
      high: issues.filter((i) => i.severity === "high").length,
      medium: issues.filter((i) => i.severity === "medium").length,
      low: issues.filter((i) => i.severity === "low").length,
    };

    const total = issues.length;

    const severities: Array<{
      key: keyof typeof breakdown;
      emoji: string;
      label: string;
    }> = [
      { key: "critical", emoji: "🔴", label: "Critical" },
      { key: "high", emoji: "🟠", label: "High" },
      { key: "medium", emoji: "🟡", label: "Medium" },
      { key: "low", emoji: "🟢", label: "Low" },
    ];

    return severities
      .map(({ key, emoji, label }) => {
        const count = breakdown[key];
        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
        const bar = this.createProgressBar(count, total);
        return `- ${emoji} **${label}**: ${count} (${percentage}%) ${bar}`;
      })
      .join("\n");
  }

  /**
   * Create a simple ASCII progress bar
   */
  private createProgressBar(value: number, max: number, width: number = 20): string {
    if (max === 0) return "░".repeat(width);

    const filled = Math.round((value / max) * width);
    const empty = width - filled;

    return "█".repeat(filled) + "░".repeat(empty);
  }

  /**
   * Validate configuration and connectivity
   */
  async validateConfiguration(): Promise<{
    github: { valid: boolean; user?: string; error?: string };
    sonarqube?: { available: boolean; error?: string };
  }> {
    const githubValidation = await this.githubService.validateConnection();

    let sonarqubeValidation: { available: boolean; error?: string } | undefined;
    if (this.sonarqubeService) {
      try {
        const connectionTest: SonarQubeConnectionTest =
          await this.sonarqubeService.testConnection();
        sonarqubeValidation = {
          available: connectionTest.success && connectionTest.version !== undefined,
          error: !connectionTest.success
            ? connectionTest.error || "Server connection failed"
            : undefined,
        };
      } catch (error) {
        sonarqubeValidation = {
          available: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return {
      github: githubValidation,
      sonarqube: sonarqubeValidation,
    };
  }
}
