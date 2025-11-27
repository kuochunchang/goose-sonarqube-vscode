/**
 * MergeService - Merges SonarQube and AI analysis results
 *
 * Responsibilities:
 * - Issue deduplication (SonarQube + AI)
 * - Severity mapping (SonarQube severity → unified severity)
 * - Priority sorting and risk calculation
 * - Comprehensive report generation
 */

import type {
  CodeIssue,
  FileAnalysis,
  ImpactAnalysis,
  IssueSeverity,
  IssueType,
  AIAnalysisResult,
  MergedAnalysisResult,
  ChangeAnalysisResult,
} from "../types/analysis.types.js";
import type {
  SonarQubeAnalysisResult,
  SonarQubeIssue,
  SonarQubeSeverity,
  SonarQubeIssueType,
} from "../types/sonarqube.types.js";

/**
 * Deduplication strategy
 */
export type DeduplicationStrategy = "exact" | "fuzzy" | "location";

/**
 * Merge configuration
 */
export interface MergeConfig {
  /**
   * Deduplication strategy
   * - 'exact': Exact match (file + line + message)
   * - 'fuzzy': Fuzzy match (file + line + similar message)
   * - 'location': Location-based (file + line only)
   * @default 'fuzzy'
   */
  deduplicationStrategy?: DeduplicationStrategy;

  /**
   * Fuzzy match threshold (0-1)
   * @default 0.8
   */
  fuzzyMatchThreshold?: number;

  /**
   * Prefer SonarQube issues over AI issues when duplicates found
   * @default true
   */
  preferSonarQube?: boolean;

  /**
   * Include raw results in merged output
   * @default false
   */
  includeRawResults?: boolean;

  /**
   * SonarQube server URL for building issue links
   */
  sonarQubeServerUrl?: string;

  /**
   * SonarQube project key for building issue links
   */
  sonarQubeProjectKey?: string;
}

/**
 * MergeService - Combines SonarQube and AI analysis results
 */
export class MergeService {
  private readonly config: Required<MergeConfig>;

  constructor(config: MergeConfig = {}) {
    this.config = {
      deduplicationStrategy: config.deduplicationStrategy ?? "fuzzy",
      fuzzyMatchThreshold: config.fuzzyMatchThreshold ?? 0.8,
      preferSonarQube: config.preferSonarQube ?? true,
      includeRawResults: config.includeRawResults ?? false,
      sonarQubeServerUrl: config.sonarQubeServerUrl,
      sonarQubeProjectKey: config.sonarQubeProjectKey,
    };
  }

  /**
   * Merge SonarQube and AI analysis results
   * @param aiResult - AI analysis result
   * @param sonarResult - SonarQube analysis result (optional)
   * @param baseResult - Base change analysis result
   * @returns Merged analysis result
   */
  merge(
    aiResult: AIAnalysisResult,
    sonarResult: SonarQubeAnalysisResult | undefined,
    baseResult: ChangeAnalysisResult
  ): MergedAnalysisResult {
    // Convert SonarQube issues to CodeIssue format
    const sonarIssues = sonarResult ? this.convertSonarQubeIssues(sonarResult) : [];

    // Extract AI issues from file analyses
    const aiIssues = this.extractAIIssues(aiResult.fileAnalyses);

    // Deduplicate issues
    const { uniqueIssues, deduplicationInfo } = this.deduplicateIssues(aiIssues, sonarIssues);

    // Sort issues by priority
    const sortedIssues = this.sortByPriority(uniqueIssues);

    // Group issues by file
    const fileAnalyses = this.groupIssuesByFile(sortedIssues, aiResult.fileAnalyses);

    // Calculate overall impact
    const impactAnalysis = this.calculateImpact(sortedIssues, aiResult.impactAnalysis, sonarResult);

    // Build merged result
    const mergedResult: MergedAnalysisResult = {
      ...baseResult,
      fileAnalyses,
      impactAnalysis,
      deduplicationInfo,
    };

    // Optionally include raw results
    if (this.config.includeRawResults) {
      mergedResult.sonarQubeResults = sonarResult;
      mergedResult.aiResults = aiResult;
    }

    return mergedResult;
  }

  /**
   * Convert SonarQube issues to unified CodeIssue format
   */
  private convertSonarQubeIssues(result: SonarQubeAnalysisResult): CodeIssue[] {
    return result.issues.map((issue) => this.convertSonarQubeIssue(issue));
  }

  /**
   * Convert a single SonarQube issue to CodeIssue
   */
  private convertSonarQubeIssue(issue: SonarQubeIssue): CodeIssue {
    // Build issue URL if we have the necessary configuration
    let issueUrl: string | undefined;
    if (this.config.sonarQubeServerUrl && this.config.sonarQubeProjectKey && issue.key) {
      issueUrl = `${this.config.sonarQubeServerUrl}/project/issues?id=${this.config.sonarQubeProjectKey}&open=${issue.key}`;
    }

    return {
      source: "sonarqube",
      severity: this.mapSonarQubeSeverity(issue.severity),
      type: this.mapSonarQubeType(issue.type),
      file: this.extractFilePath(issue.component),
      line: issue.textRange?.startLine ?? 0,
      message: issue.message,
      description: this.buildSonarDescription(issue),
      rule: issue.rule,
      effort: issue.effort ? this.parseEffort(issue.effort) : undefined,
      status: issue.status,
      tags: issue.tags,
      creationDate: issue.creationDate,
      updateDate: issue.updateDate,
      debt: issue.debt,
      assignee: issue.assignee,
      issueKey: issue.key,
      issueUrl,
    };
  }

  /**
   * Map SonarQube severity to unified severity
   */
  private mapSonarQubeSeverity(severity: SonarQubeSeverity): IssueSeverity {
    const mapping: Record<SonarQubeSeverity, IssueSeverity> = {
      BLOCKER: "critical",
      CRITICAL: "critical",
      MAJOR: "high",
      MINOR: "medium",
      INFO: "info",
    };
    return mapping[severity] ?? "medium";
  }

  /**
   * Map SonarQube issue type to unified type
   */
  private mapSonarQubeType(type: SonarQubeIssueType): IssueType {
    const mapping: Record<SonarQubeIssueType, IssueType> = {
      BUG: "bug",
      VULNERABILITY: "vulnerability",
      CODE_SMELL: "code-smell",
      SECURITY_HOTSPOT: "security-hotspot",
    };
    return mapping[type] ?? "code-smell";
  }

  /**
   * Extract file path from SonarQube component
   * Component format: "project:path/to/file.ts"
   */
  private extractFilePath(component: string): string {
    const parts = component.split(":");
    return parts.length > 1 ? parts[1] : component;
  }

  /**
   * Build detailed description for SonarQube issue
   */
  private buildSonarDescription(issue: SonarQubeIssue): string {
    const parts: string[] = [issue.message];

    if (issue.debt) {
      parts.push(`Technical debt: ${issue.debt}`);
    }

    if (issue.tags && issue.tags.length > 0) {
      parts.push(`Tags: ${issue.tags.join(", ")}`);
    }

    return parts.join("\n");
  }

  /**
   * Parse effort string (e.g., "30min") to minutes
   */
  private parseEffort(effort: string): number {
    const match = effort.match(/(\d+)(min|h|d)/);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "min":
        return value;
      case "h":
        return value * 60;
      case "d":
        return value * 60 * 8; // 8 hours per day
      default:
        return 0;
    }
  }

  /**
   * Extract all issues from AI file analyses
   */
  private extractAIIssues(fileAnalyses: FileAnalysis[]): CodeIssue[] {
    return fileAnalyses.flatMap((analysis) => analysis.issues);
  }

  /**
   * Deduplicate issues from AI and SonarQube
   * @returns Unique issues and deduplication statistics
   */
  private deduplicateIssues(
    aiIssues: CodeIssue[],
    sonarIssues: CodeIssue[]
  ): {
    uniqueIssues: CodeIssue[];
    deduplicationInfo: {
      totalIssues: number;
      duplicatesRemoved: number;
      uniqueIssues: number;
    };
  } {
    const totalIssues = aiIssues.length + sonarIssues.length;
    const allIssues = [...aiIssues, ...sonarIssues];

    if (allIssues.length === 0) {
      return {
        uniqueIssues: [],
        deduplicationInfo: {
          totalIssues: 0,
          duplicatesRemoved: 0,
          uniqueIssues: 0,
        },
      };
    }

    // Apply deduplication strategy
    let uniqueIssues: CodeIssue[];
    switch (this.config.deduplicationStrategy) {
      case "exact":
        uniqueIssues = this.deduplicateExact(aiIssues, sonarIssues);
        break;
      case "fuzzy":
        uniqueIssues = this.deduplicateFuzzy(aiIssues, sonarIssues);
        break;
      case "location":
        uniqueIssues = this.deduplicateByLocation(aiIssues, sonarIssues);
        break;
      default:
        uniqueIssues = allIssues;
    }

    return {
      uniqueIssues,
      deduplicationInfo: {
        totalIssues,
        duplicatesRemoved: totalIssues - uniqueIssues.length,
        uniqueIssues: uniqueIssues.length,
      },
    };
  }

  /**
   * Exact match deduplication (file + line + message)
   */
  private deduplicateExact(aiIssues: CodeIssue[], sonarIssues: CodeIssue[]): CodeIssue[] {
    const uniqueMap = new Map<string, CodeIssue>();

    // Add SonarQube issues first (if preferred)
    const firstSet = this.config.preferSonarQube ? sonarIssues : aiIssues;
    const secondSet = this.config.preferSonarQube ? aiIssues : sonarIssues;

    for (const issue of firstSet) {
      const key = this.getExactMatchKey(issue);
      uniqueMap.set(key, issue);
    }

    for (const issue of secondSet) {
      const key = this.getExactMatchKey(issue);
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, issue);
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Fuzzy match deduplication (similar messages)
   */
  private deduplicateFuzzy(aiIssues: CodeIssue[], sonarIssues: CodeIssue[]): CodeIssue[] {
    const uniqueIssues: CodeIssue[] = [];
    const firstSet = this.config.preferSonarQube ? sonarIssues : aiIssues;
    const secondSet = this.config.preferSonarQube ? aiIssues : sonarIssues;

    // Add first set as-is
    uniqueIssues.push(...firstSet);

    // Check second set for duplicates
    for (const issue of secondSet) {
      const isDuplicate = uniqueIssues.some((existing) => {
        return this.isFuzzyMatch(issue, existing);
      });

      if (!isDuplicate) {
        uniqueIssues.push(issue);
      }
    }

    return uniqueIssues;
  }

  /**
   * Location-based deduplication (file + line only)
   */
  private deduplicateByLocation(aiIssues: CodeIssue[], sonarIssues: CodeIssue[]): CodeIssue[] {
    const uniqueMap = new Map<string, CodeIssue>();
    const firstSet = this.config.preferSonarQube ? sonarIssues : aiIssues;
    const secondSet = this.config.preferSonarQube ? aiIssues : sonarIssues;

    for (const issue of firstSet) {
      const key = this.getLocationKey(issue);
      uniqueMap.set(key, issue);
    }

    for (const issue of secondSet) {
      const key = this.getLocationKey(issue);
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, issue);
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Generate exact match key
   */
  private getExactMatchKey(issue: CodeIssue): string {
    return `${issue.file}:${issue.line}:${issue.message.toLowerCase().trim()}`;
  }

  /**
   * Generate location key
   */
  private getLocationKey(issue: CodeIssue): string {
    return `${issue.file}:${issue.line}`;
  }

  /**
   * Check if two issues are fuzzy matches
   */
  private isFuzzyMatch(issue1: CodeIssue, issue2: CodeIssue): boolean {
    // Must be same file and line
    if (issue1.file !== issue2.file || issue1.line !== issue2.line) {
      return false;
    }

    // Calculate message similarity
    const similarity = this.calculateStringSimilarity(issue1.message, issue2.message);
    return similarity >= this.config.fuzzyMatchThreshold;
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   * Returns a score between 0 and 1
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Sort issues by priority (severity + type)
   */
  private sortByPriority(issues: CodeIssue[]): CodeIssue[] {
    return [...issues].sort((a, b) => {
      // Sort by severity first
      const severityOrder: Record<IssueSeverity, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        info: 4,
      };

      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by type
      const typeOrder: Record<IssueType, number> = {
        vulnerability: 0,
        bug: 1,
        "security-hotspot": 2,
        "breaking-change": 3,
        performance: 4,
        "code-smell": 5,
        architecture: 6,
        testing: 7,
      };

      const typeDiff = typeOrder[a.type] - typeOrder[b.type];
      if (typeDiff !== 0) return typeDiff;

      // Finally by file and line
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.line - b.line;
    });
  }

  /**
   * Group issues by file and merge with existing file analyses
   */
  private groupIssuesByFile(issues: CodeIssue[], existingAnalyses: FileAnalysis[]): FileAnalysis[] {
    // Create a map of existing analyses
    const analysisMap = new Map<string, FileAnalysis>();
    for (const analysis of existingAnalyses) {
      analysisMap.set(analysis.file, analysis);
    }

    // Group issues by file
    const issuesByFile = new Map<string, CodeIssue[]>();
    for (const issue of issues) {
      const fileIssues = issuesByFile.get(issue.file) || [];
      fileIssues.push(issue);
      issuesByFile.set(issue.file, fileIssues);
    }

    // Merge issues with existing analyses
    const mergedAnalyses: FileAnalysis[] = [];
    for (const [file, fileIssues] of issuesByFile) {
      const existing = analysisMap.get(file);
      if (existing) {
        mergedAnalyses.push({
          ...existing,
          issues: fileIssues,
        });
      } else {
        // Create new analysis for files not in AI results
        mergedAnalyses.push({
          file,
          changeType: "unknown",
          issues: fileIssues,
          summary: `${fileIssues.length} issue(s) found`,
          linesChanged: 0,
        });
      }
    }

    // Add analyses without issues
    for (const analysis of existingAnalyses) {
      if (!issuesByFile.has(analysis.file)) {
        mergedAnalyses.push({
          ...analysis,
          issues: [],
        });
      }
    }

    return mergedAnalyses;
  }

  /**
   * Calculate overall impact based on merged issues
   */
  private calculateImpact(
    issues: CodeIssue[],
    aiImpact: ImpactAnalysis,
    sonarResult?: SonarQubeAnalysisResult
  ): ImpactAnalysis {
    // Calculate risk level based on issue severity
    const criticalCount = issues.filter((i) => i.severity === "critical").length;
    const highCount = issues.filter((i) => i.severity === "high").length;

    let riskLevel: ImpactAnalysis["riskLevel"];
    if (criticalCount > 0) {
      riskLevel = "critical";
    } else if (highCount >= 4) {
      riskLevel = "high";
    } else if (highCount > 0 || issues.length > 10) {
      riskLevel = "medium";
    } else {
      riskLevel = "low";
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(issues, sonarResult);

    // Merge with AI impact analysis
    return {
      ...aiImpact,
      riskLevel,
      qualityScore,
    };
  }

  /**
   * Calculate quality score (0-100) based on issues
   */
  private calculateQualityScore(
    issues: CodeIssue[],
    sonarResult?: SonarQubeAnalysisResult
  ): number {
    // Start with base score
    let score = 100;

    // Deduct points based on issue severity
    const severityPenalty: Record<IssueSeverity, number> = {
      critical: 15,
      high: 10,
      medium: 5,
      low: 2,
      info: 1,
    };

    for (const issue of issues) {
      score -= severityPenalty[issue.severity];
    }

    // Consider SonarQube metrics if available
    if (sonarResult?.metrics) {
      const { bugs, vulnerabilities, codeSmells } = sonarResult.metrics;
      score -= bugs * 5;
      score -= vulnerabilities * 10;
      score -= Math.min(codeSmells * 0.5, 20); // Cap code smell penalty
    }

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate statistics summary
   */
  getStatistics(result: MergedAnalysisResult): {
    totalIssues: number;
    issuesBySeverity: Record<IssueSeverity, number>;
    issuesByType: Record<IssueType, number>;
    issuesBySource: Record<"sonarqube" | "ai", number>;
    filesAnalyzed: number;
    qualityScore: number;
    riskLevel: string;
  } {
    const allIssues = result.fileAnalyses.flatMap((f) => f.issues);

    const issuesBySeverity: Record<IssueSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    const issuesByType: Record<IssueType, number> = {
      bug: 0,
      vulnerability: 0,
      "code-smell": 0,
      "security-hotspot": 0,
      "breaking-change": 0,
      performance: 0,
      architecture: 0,
      testing: 0,
    };

    const issuesBySource: Record<"sonarqube" | "ai", number> = {
      sonarqube: 0,
      ai: 0,
    };

    for (const issue of allIssues) {
      issuesBySeverity[issue.severity]++;
      issuesByType[issue.type]++;
      if (issue.source === "sonarqube" || issue.source === "ai") {
        issuesBySource[issue.source]++;
      }
    }

    return {
      totalIssues: allIssues.length,
      issuesBySeverity,
      issuesByType,
      issuesBySource,
      filesAnalyzed: result.fileAnalyses.length,
      qualityScore: result.impactAnalysis.qualityScore,
      riskLevel: result.impactAnalysis.riskLevel,
    };
  }
}
