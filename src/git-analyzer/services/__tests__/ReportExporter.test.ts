/**
 * ReportExporter Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ReportExporter } from "../ReportExporter.js";
import type { MergedAnalysisResult } from "../../types/analysis.types.js";

describe("ReportExporter", () => {
  let exporter: ReportExporter;

  beforeEach(() => {
    exporter = new ReportExporter();
  });

  describe("export", () => {
    const createMockResult = (): MergedAnalysisResult => ({
      changeType: "working-directory",
      summary: {
        filesChanged: 2,
        insertions: 20,
        deletions: 10,
      },
      fileAnalyses: [
        {
          file: "src/file1.ts",
          changeType: "feature",
          issues: [
            {
              source: "sonarqube",
              severity: "critical",
              type: "bug",
              file: "src/file1.ts",
              line: 10,
              message: "Critical bug found",
              rule: "typescript:S1234",
            },
            {
              source: "ai",
              severity: "high",
              type: "vulnerability",
              file: "src/file1.ts",
              line: 20,
              message: "Security vulnerability",
            },
          ],
          summary: "File has issues",
          linesChanged: 15,
        },
        {
          file: "src/file2.ts",
          changeType: "refactor",
          issues: [
            {
              source: "sonarqube",
              severity: "medium",
              type: "code-smell",
              file: "src/file2.ts",
              line: 5,
              message: "Code smell detected",
            },
          ],
          summary: "Minor issues",
          linesChanged: 5,
        },
      ],
      impactAnalysis: {
        riskLevel: "high",
        affectedModules: ["module1", "module2"],
        breakingChanges: ["API change"],
        testingRecommendations: ["Add unit tests"],
        deploymentRisks: ["Requires database migration"],
        qualityScore: 75,
      },
      timestamp: "2025-01-01T00:00:00.000Z",
      duration: 1000,
      deduplicationInfo: {
        totalIssues: 3,
        duplicatesRemoved: 0,
        uniqueIssues: 3,
      },
    });

    it("should export markdown format", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      expect(markdown).toContain("# Code Review Analysis Report");
      expect(markdown).toContain("Summary");
      expect(markdown).toContain("Statistics");
      expect(markdown).toContain("Issues");
    });

    it("should export HTML format", () => {
      const result = createMockResult();
      const html = exporter.export(result, "html");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("Code Review Analysis Report");
    });

    it("should export JSON format", () => {
      const result = createMockResult();
      const json = exporter.export(result, "json");
      const parsed = JSON.parse(json);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.changeType).toBe("working-directory");
      expect(parsed.summary).toBeDefined();
      expect(parsed.statistics).toBeDefined();
      expect(parsed.issues).toBeDefined();
    });

    it("should throw error for unsupported format", () => {
      const result = createMockResult();
      expect(() => {
        exporter.export(result, "xml" as any);
      }).toThrow("Unsupported export format");
    });

    it("should respect includeSummary option", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown", {
        includeSummary: false,
      });
      expect(markdown).not.toContain("## Summary");
    });

    it("should respect includeIssues option", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown", {
        includeIssues: false,
      });
      // When includeIssues is false, the Issues section should not contain actual issues
      // But the section header might still be there, so we check for issue content instead
      expect(markdown).not.toContain("Critical bug found");
    });

    it("should respect includeStatistics option", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown", {
        includeStatistics: false,
      });
      expect(markdown).not.toContain("## Statistics");
    });

    it("should respect includeImpact option", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown", {
        includeImpact: false,
      });
      expect(markdown).not.toContain("## Impact Analysis");
    });

    it("should respect includeDeduplication option", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown", {
        includeDeduplication: false,
      });
      expect(markdown).not.toContain("## Deduplication");
    });

    it("should respect maxIssues option", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown", {
        maxIssues: 1,
      });
      // Should show only 1 issue - count by issue messages
      const issueCount = (
        markdown.match(/Critical bug found|Security vulnerability|Code smell detected/g) || []
      ).length;
      expect(issueCount).toBeLessThanOrEqual(1);
    });

    it("should group issues by file when groupByFile is true", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown", {
        groupByFile: true,
      });
      expect(markdown).toContain("### 📄 src/file1.ts");
      expect(markdown).toContain("### 📄 src/file2.ts");
    });

    it("should group issues by severity when groupBySeverity is true", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown", {
        groupByFile: false,
        groupBySeverity: true,
      });
      expect(markdown).toContain("### Critical");
      expect(markdown).toContain("### High");
      expect(markdown).toContain("### Medium");
    });

    it("should handle empty issues", () => {
      const result: MergedAnalysisResult = {
        changeType: "working-directory",
        summary: {
          filesChanged: 1,
          insertions: 10,
          deletions: 0,
        },
        fileAnalyses: [
          {
            file: "src/file.ts",
            changeType: "feature",
            issues: [],
            summary: "No issues",
            linesChanged: 10,
          },
        ],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 100,
        },
        timestamp: "2025-01-01T00:00:00.000Z",
        duration: 1000,
      };

      const markdown = exporter.export(result, "markdown");
      expect(markdown).toContain("✅ No issues found!");
    });

    it("should include issue details in markdown", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      expect(markdown).toContain("Critical bug found");
      expect(markdown).toContain("Security vulnerability");
      expect(markdown).toContain("Code smell detected");
    });

    it("should include rule information when available", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      // Rule information is included in the issue details
      expect(markdown).toContain("typescript:S1234");
    });

    it("should format risk level correctly", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      expect(markdown).toContain("Risk Level");
      expect(markdown).toContain("High");
    });

    it("should include quality score", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      // Quality score format: **Quality Score**: 75/100
      expect(markdown).toContain("Quality Score");
      expect(markdown).toContain("75");
    });

    it("should include affected modules", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      expect(markdown).toContain("### Affected Modules");
      expect(markdown).toContain("module1");
      expect(markdown).toContain("module2");
    });

    it("should include breaking changes", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      expect(markdown).toContain("### ⚠️ Breaking Changes");
      expect(markdown).toContain("API change");
    });

    it("should include testing recommendations", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      expect(markdown).toContain("### Testing Recommendations");
      expect(markdown).toContain("Add unit tests");
    });

    it("should include deployment risks", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      expect(markdown).toContain("### Deployment Risks");
      expect(markdown).toContain("Requires database migration");
    });

    it("should include deduplication info", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      expect(markdown).toContain("## Deduplication");
      // Format: - **Total Issues Found**: 3
      expect(markdown).toContain("Total Issues Found");
      expect(markdown).toContain("Duplicates Removed");
      expect(markdown).toContain("Unique Issues");
    });

    it("should format JSON correctly", () => {
      const result = createMockResult();
      const json = exporter.export(result, "json");
      const parsed = JSON.parse(json);
      expect(parsed.metadata.timestamp).toBe("2025-01-01T00:00:00.000Z");
      expect(parsed.metadata.duration).toBe(1000);
      expect(parsed.metadata.changeType).toBe("working-directory");
      expect(parsed.summary.filesChanged).toBe(2);
      expect(parsed.statistics.totalIssues).toBe(3);
      expect(parsed.issues).toHaveLength(3);
      expect(parsed.fileAnalyses).toHaveLength(2);
    });

    it("should respect JSON export options", () => {
      const result = createMockResult();
      const json = exporter.export(result, "json", {
        includeSummary: false,
        includeIssues: false,
        includeStatistics: false,
      });
      const parsed = JSON.parse(json);
      expect(parsed.summary).toBeUndefined();
      expect(parsed.statistics).toBeUndefined();
      expect(parsed.issues).toBeUndefined();
    });

    it("should include issue source in markdown", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      expect(markdown).toContain("🔍 SonarQube");
      expect(markdown).toContain("🤖 AI");
    });

    it("should format severity icons correctly", () => {
      const result = createMockResult();
      const markdown = exporter.export(result, "markdown");
      // Should contain severity icons
      expect(markdown).toMatch(/🔴|🟠|🟡|🔵|ℹ️/);
    });

    it("should handle issues without line numbers", () => {
      const result: MergedAnalysisResult = {
        changeType: "working-directory",
        summary: {
          filesChanged: 1,
          insertions: 10,
          deletions: 0,
        },
        fileAnalyses: [
          {
            file: "src/file.ts",
            changeType: "feature",
            issues: [
              {
                source: "sonarqube",
                severity: "medium",
                type: "code-smell",
                file: "src/file.ts",
                line: 0,
                message: "File-level issue",
              },
            ],
            summary: "Has issues",
            linesChanged: 10,
          },
        ],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 90,
        },
        timestamp: "2025-01-01T00:00:00.000Z",
        duration: 1000,
      };

      const markdown = exporter.export(result, "markdown");
      expect(markdown).toContain("File-level");
    });
  });
});
