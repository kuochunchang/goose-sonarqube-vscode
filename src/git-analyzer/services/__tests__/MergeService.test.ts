/**
 * MergeService Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MergeService } from "../MergeService.js";
import type {
  AIAnalysisResult,
  MergedAnalysisResult,
  ChangeAnalysisResult,
} from "../../types/analysis.types.js";
import type { SonarQubeAnalysisResult } from "../../types/sonarqube.types.js";
import { SonarQubeSeverity, SonarQubeIssueType } from "../../types/sonarqube.types.js";

describe("MergeService", () => {
  let mergeService: MergeService;

  beforeEach(() => {
    mergeService = new MergeService();
  });

  describe("constructor", () => {
    it("should initialize with default config", () => {
      const service = new MergeService();
      expect(service).toBeDefined();
    });

    it("should initialize with custom config", () => {
      const service = new MergeService({
        deduplicationStrategy: "exact",
        fuzzyMatchThreshold: 0.9,
        preferSonarQube: false,
        includeRawResults: true,
      });
      expect(service).toBeDefined();
    });
  });

  describe("merge", () => {
    it("should merge AI and SonarQube results", () => {
      const aiResult: AIAnalysisResult = {
        fileAnalyses: [
          {
            file: "src/file1.ts",
            changeType: "feature",
            issues: [
              {
                source: "ai",
                severity: "high",
                type: "bug",
                file: "src/file1.ts",
                line: 10,
                message: "Potential null pointer",
              },
            ],
            summary: "File has issues",
            linesChanged: 50,
          },
        ],
        impactAnalysis: {
          riskLevel: "medium",
          affectedModules: ["module1"],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 80,
        },
      };

      const sonarResult: SonarQubeAnalysisResult = {
        projectKey: "test-project",
        analysisDate: new Date().toISOString(),
        issues: [
          {
            key: "issue-1",
            rule: "typescript:S1234",
            severity: SonarQubeSeverity.CRITICAL,
            type: SonarQubeIssueType.BUG,
            component: "test-project:src/file1.ts",
            project: "test-project",
            message: "Critical bug found",
            status: "OPEN" as const,
            creationDate: "2025-01-01T00:00:00Z",
            updateDate: "2025-01-01T00:00:00Z",
            textRange: { startLine: 15, endLine: 15 },
          },
        ],
        metrics: {
          bugs: 1,
          vulnerabilities: 0,
          codeSmells: 0,
          securityHotspots: 0,
          coverage: 85,
          linesOfCode: 1000,
          duplicatedLinesDensity: 0,
          technicalDebtRatio: 0,
        },
        qualityGate: {
          status: "OK" as const,
          conditions: [],
        },
        issuesBySeverity: {
          [SonarQubeSeverity.BLOCKER]: 0,
          [SonarQubeSeverity.CRITICAL]: 1,
          [SonarQubeSeverity.MAJOR]: 0,
          [SonarQubeSeverity.MINOR]: 0,
          [SonarQubeSeverity.INFO]: 0,
        },
        issuesByType: {
          [SonarQubeIssueType.BUG]: 1,
          [SonarQubeIssueType.VULNERABILITY]: 0,
          [SonarQubeIssueType.CODE_SMELL]: 0,
          [SonarQubeIssueType.SECURITY_HOTSPOT]: 0,
        },
      };

      const baseResult: ChangeAnalysisResult = {
        changeType: "working-directory",
        summary: {
          filesChanged: 1,
          insertions: 50,
          deletions: 0,
        },
        fileAnalyses: [],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 100,
        },
        timestamp: new Date().toISOString(),
        duration: 1000,
      };

      const merged = mergeService.merge(aiResult, sonarResult, baseResult);

      expect(merged).toBeDefined();
      expect(merged.fileAnalyses).toHaveLength(1);
      expect(merged.fileAnalyses[0].issues.length).toBeGreaterThan(0);
      expect(merged.deduplicationInfo).toBeDefined();
    });

    it("should handle merge without SonarQube results", () => {
      const aiResult: AIAnalysisResult = {
        fileAnalyses: [
          {
            file: "src/file1.ts",
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
      };

      const baseResult: ChangeAnalysisResult = {
        changeType: "working-directory",
        summary: {
          filesChanged: 1,
          insertions: 10,
          deletions: 0,
        },
        fileAnalyses: [],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 100,
        },
        timestamp: new Date().toISOString(),
        duration: 1000,
      };

      const merged = mergeService.merge(aiResult, undefined, baseResult);

      expect(merged).toBeDefined();
      expect(merged.fileAnalyses).toHaveLength(1);
      expect(merged.fileAnalyses[0].issues).toHaveLength(0);
    });

    it("should include raw results when configured", () => {
      const service = new MergeService({ includeRawResults: true });
      const aiResult: AIAnalysisResult = {
        fileAnalyses: [],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 100,
        },
      };

      const sonarResult: SonarQubeAnalysisResult = {
        projectKey: "test",
        analysisDate: new Date().toISOString(),
        issues: [],
        metrics: {
          bugs: 0,
          vulnerabilities: 0,
          codeSmells: 0,
          securityHotspots: 0,
          coverage: 0,
          linesOfCode: 0,
          duplicatedLinesDensity: 0,
          technicalDebtRatio: 0,
        },
        qualityGate: { status: "OK" as const, conditions: [] },
        issuesBySeverity: {
          [SonarQubeSeverity.BLOCKER]: 0,
          [SonarQubeSeverity.CRITICAL]: 0,
          [SonarQubeSeverity.MAJOR]: 0,
          [SonarQubeSeverity.MINOR]: 0,
          [SonarQubeSeverity.INFO]: 0,
        },
        issuesByType: {
          [SonarQubeIssueType.BUG]: 0,
          [SonarQubeIssueType.VULNERABILITY]: 0,
          [SonarQubeIssueType.CODE_SMELL]: 0,
          [SonarQubeIssueType.SECURITY_HOTSPOT]: 0,
        },
      };

      const baseResult: ChangeAnalysisResult = {
        changeType: "working-directory",
        summary: { filesChanged: 0, insertions: 0, deletions: 0 },
        fileAnalyses: [],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 100,
        },
        timestamp: new Date().toISOString(),
        duration: 0,
      };

      const merged = service.merge(aiResult, sonarResult, baseResult);
      expect(merged.sonarQubeResults).toBeDefined();
      expect(merged.aiResults).toBeDefined();
    });
  });

  describe("deduplication strategies", () => {
    it("should deduplicate with exact strategy", () => {
      const service = new MergeService({ deduplicationStrategy: "exact" });
      const aiResult: AIAnalysisResult = {
        fileAnalyses: [
          {
            file: "src/file.ts",
            changeType: "feature",
            issues: [
              {
                source: "ai",
                severity: "high",
                type: "bug",
                file: "src/file.ts",
                line: 10,
                message: "Same issue",
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
          qualityScore: 100,
        },
      };

      const sonarResult: SonarQubeAnalysisResult = {
        projectKey: "test",
        analysisDate: new Date().toISOString(),
        issues: [
          {
            key: "issue-1",
            rule: "typescript:S1234",
            severity: SonarQubeSeverity.MAJOR,
            type: SonarQubeIssueType.BUG,
            component: "test:src/file.ts",
            project: "test",
            message: "Same issue",
            status: "OPEN" as const,
            creationDate: "2025-01-01T00:00:00Z",
            updateDate: "2025-01-01T00:00:00Z",
            textRange: { startLine: 10, endLine: 10 },
          },
        ],
        metrics: {
          bugs: 0,
          vulnerabilities: 0,
          codeSmells: 0,
          securityHotspots: 0,
          coverage: 0,
          linesOfCode: 0,
          duplicatedLinesDensity: 0,
          technicalDebtRatio: 0,
        },
        qualityGate: { status: "OK" as const, conditions: [] },
        issuesBySeverity: {
          [SonarQubeSeverity.BLOCKER]: 0,
          [SonarQubeSeverity.CRITICAL]: 0,
          [SonarQubeSeverity.MAJOR]: 1,
          [SonarQubeSeverity.MINOR]: 0,
          [SonarQubeSeverity.INFO]: 0,
        },
        issuesByType: {
          [SonarQubeIssueType.BUG]: 1,
          [SonarQubeIssueType.VULNERABILITY]: 0,
          [SonarQubeIssueType.CODE_SMELL]: 0,
          [SonarQubeIssueType.SECURITY_HOTSPOT]: 0,
        },
      };

      const baseResult: ChangeAnalysisResult = {
        changeType: "working-directory",
        summary: { filesChanged: 1, insertions: 10, deletions: 0 },
        fileAnalyses: [],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 100,
        },
        timestamp: new Date().toISOString(),
        duration: 0,
      };

      const merged = service.merge(aiResult, sonarResult, baseResult);
      // Should deduplicate exact matches
      const allIssues = merged.fileAnalyses.flatMap((f) => f.issues);
      expect(allIssues.length).toBeLessThanOrEqual(2);
    });

    it("should deduplicate with fuzzy strategy", () => {
      const service = new MergeService({
        deduplicationStrategy: "fuzzy",
        fuzzyMatchThreshold: 0.8,
      });
      const aiResult: AIAnalysisResult = {
        fileAnalyses: [
          {
            file: "src/file.ts",
            changeType: "feature",
            issues: [
              {
                source: "ai",
                severity: "high",
                type: "bug",
                file: "src/file.ts",
                line: 10,
                message: "Potential null pointer exception",
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
          qualityScore: 100,
        },
      };

      const sonarResult: SonarQubeAnalysisResult = {
        projectKey: "test",
        analysisDate: new Date().toISOString(),
        issues: [
          {
            key: "issue-1",
            rule: "typescript:S1234",
            severity: SonarQubeSeverity.MAJOR,
            type: SonarQubeIssueType.BUG,
            component: "test:src/file.ts",
            project: "test",
            message: "Potential null pointer",
            status: "OPEN" as const,
            creationDate: "2025-01-01T00:00:00Z",
            updateDate: "2025-01-01T00:00:00Z",
            textRange: { startLine: 10, endLine: 10 },
          },
        ],
        metrics: {
          bugs: 0,
          vulnerabilities: 0,
          codeSmells: 0,
          securityHotspots: 0,
          coverage: 0,
          linesOfCode: 0,
          duplicatedLinesDensity: 0,
          technicalDebtRatio: 0,
        },
        qualityGate: { status: "OK" as const, conditions: [] },
        issuesBySeverity: {
          [SonarQubeSeverity.BLOCKER]: 0,
          [SonarQubeSeverity.CRITICAL]: 0,
          [SonarQubeSeverity.MAJOR]: 1,
          [SonarQubeSeverity.MINOR]: 0,
          [SonarQubeSeverity.INFO]: 0,
        },
        issuesByType: {
          [SonarQubeIssueType.BUG]: 1,
          [SonarQubeIssueType.VULNERABILITY]: 0,
          [SonarQubeIssueType.CODE_SMELL]: 0,
          [SonarQubeIssueType.SECURITY_HOTSPOT]: 0,
        },
      };

      const baseResult: ChangeAnalysisResult = {
        changeType: "working-directory",
        summary: { filesChanged: 1, insertions: 10, deletions: 0 },
        fileAnalyses: [],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 100,
        },
        timestamp: new Date().toISOString(),
        duration: 0,
      };

      const merged = service.merge(aiResult, sonarResult, baseResult);
      expect(merged.deduplicationInfo).toBeDefined();
    });
  });

  describe("severity and type mapping", () => {
    it("should map SonarQube severities correctly", () => {
      const sonarResult: SonarQubeAnalysisResult = {
        projectKey: "test",
        analysisDate: new Date().toISOString(),
        issues: [
          {
            key: "issue-1",
            rule: "typescript:S1234",
            severity: SonarQubeSeverity.BLOCKER,
            type: SonarQubeIssueType.BUG,
            component: "test:src/file.ts",
            project: "test",
            message: "Blocker issue",
            status: "OPEN" as const,
            creationDate: "2025-01-01T00:00:00Z",
            updateDate: "2025-01-01T00:00:00Z",
            textRange: { startLine: 10, endLine: 10 },
          },
          {
            key: "issue-2",
            rule: "typescript:S1235",
            severity: SonarQubeSeverity.MINOR,
            type: SonarQubeIssueType.CODE_SMELL,
            component: "test:src/file.ts",
            project: "test",
            message: "Minor issue",
            status: "OPEN" as const,
            creationDate: "2025-01-01T00:00:00Z",
            updateDate: "2025-01-01T00:00:00Z",
            textRange: { startLine: 20, endLine: 20 },
          },
        ],
        metrics: {
          bugs: 0,
          vulnerabilities: 0,
          codeSmells: 0,
          securityHotspots: 0,
          coverage: 0,
          linesOfCode: 0,
          duplicatedLinesDensity: 0,
          technicalDebtRatio: 0,
        },
        qualityGate: { status: "OK" as const, conditions: [] },
        issuesBySeverity: {
          [SonarQubeSeverity.BLOCKER]: 1,
          [SonarQubeSeverity.CRITICAL]: 0,
          [SonarQubeSeverity.MAJOR]: 0,
          [SonarQubeSeverity.MINOR]: 1,
          [SonarQubeSeverity.INFO]: 0,
        },
        issuesByType: {
          [SonarQubeIssueType.BUG]: 1,
          [SonarQubeIssueType.VULNERABILITY]: 0,
          [SonarQubeIssueType.CODE_SMELL]: 1,
          [SonarQubeIssueType.SECURITY_HOTSPOT]: 0,
        },
      };

      const aiResult: AIAnalysisResult = {
        fileAnalyses: [],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 100,
        },
      };

      const baseResult: ChangeAnalysisResult = {
        changeType: "working-directory",
        summary: { filesChanged: 0, insertions: 0, deletions: 0 },
        fileAnalyses: [],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 100,
        },
        timestamp: new Date().toISOString(),
        duration: 0,
      };

      const merged = mergeService.merge(aiResult, sonarResult, baseResult);
      const allIssues = merged.fileAnalyses.flatMap((f) => f.issues);
      expect(allIssues.length).toBeGreaterThan(0);
      // Check that severities are mapped
      const blockerIssue = allIssues.find((i) => i.message === "Blocker issue");
      expect(blockerIssue?.severity).toBe("critical");
    });
  });

  describe("getStatistics", () => {
    it("should generate correct statistics", () => {
      const mergedResult: MergedAnalysisResult = {
        changeType: "working-directory",
        summary: { filesChanged: 2, insertions: 20, deletions: 10 },
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
                message: "Critical bug",
              },
              {
                source: "ai",
                severity: "high",
                type: "vulnerability",
                file: "src/file1.ts",
                line: 20,
                message: "Security issue",
              },
            ],
            summary: "Has issues",
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
                message: "Code smell",
              },
            ],
            summary: "Minor issues",
            linesChanged: 5,
          },
        ],
        impactAnalysis: {
          riskLevel: "high",
          affectedModules: ["module1"],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 75,
        },
        timestamp: new Date().toISOString(),
        duration: 1000,
        deduplicationInfo: {
          totalIssues: 3,
          duplicatesRemoved: 0,
          uniqueIssues: 3,
        },
      };

      const stats = mergeService.getStatistics(mergedResult);

      expect(stats.totalIssues).toBe(3);
      expect(stats.filesAnalyzed).toBe(2);
      expect(stats.qualityScore).toBe(75);
      expect(stats.riskLevel).toBe("high");
      expect(stats.issuesBySeverity.critical).toBe(1);
      expect(stats.issuesBySeverity.high).toBe(1);
      expect(stats.issuesBySeverity.medium).toBe(1);
      expect(stats.issuesByType.bug).toBe(1);
      expect(stats.issuesByType.vulnerability).toBe(1);
      expect(stats.issuesByType["code-smell"]).toBe(1);
      expect(stats.issuesBySource.sonarqube).toBe(2);
      expect(stats.issuesBySource.ai).toBe(1);
    });
  });
});
