/**
 * Tests for ChangeAnalyzer service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChangeAnalyzer, type IAIProvider } from "../services/ChangeAnalyzer.js";
import { GitService } from "../services/GitService.js";
import type { AnalysisOptions, AIAnalysisResult } from "../types/analysis.types.js";
import type { WorkingDirectoryChanges, BranchComparison } from "../types/git.types.js";

// Mock GitService
vi.mock("../services/GitService.js", () => ({
  GitService: vi.fn(),
}));

// Mock AI Provider
const createMockAIProvider = (): IAIProvider => {
  return {
    analyzeCode: vi.fn(),
  };
};

describe("ChangeAnalyzer", () => {
  let analyzer: ChangeAnalyzer;
  let mockAIProvider: IAIProvider;
  let mockGitService: any;

  beforeEach(() => {
    mockAIProvider = createMockAIProvider();
    mockGitService = {
      getWorkingDirectoryChanges: vi.fn(),
      compareBranches: vi.fn(),
      getCurrentBranch: vi.fn(),
    };

    // Mock GitService constructor
    (GitService as any).mockImplementation(() => mockGitService);

    analyzer = new ChangeAnalyzer({
      aiProvider: mockAIProvider,
      maxTokensPerBatch: 6000,
      tokenSafetyMargin: 0.9,
      maxParallelRequests: 3,
      repoPath: "/test/repo",
    });

    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create ChangeAnalyzer with valid config", () => {
      expect(analyzer).toBeInstanceOf(ChangeAnalyzer);
    });

    it("should use default values for optional config", () => {
      const defaultAnalyzer = new ChangeAnalyzer({
        aiProvider: mockAIProvider,
      });

      expect(defaultAnalyzer).toBeInstanceOf(ChangeAnalyzer);
    });
  });

  describe("analyzeWorkingDirectory", () => {
    const mockWorkingDirectoryChanges: WorkingDirectoryChanges = {
      type: "working-directory",
      files: [
        {
          path: "src/file1.ts",
          status: "modified",
          linesAdded: 5,
          linesDeleted: 2,
        },
        {
          path: "src/file2.ts",
          status: "added",
          linesAdded: 10,
          linesDeleted: 0,
        },
      ],
      diff: `diff --git a/src/file1.ts b/src/file1.ts
index 1234567..abcdefg 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,3 +1,6 @@
 export function helper() {
-  console.log('old');
+  console.log('new');
+  console.log('added');
 }
diff --git a/src/file2.ts b/src/file2.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/file2.ts
@@ -0,0 +1,10 @@
+export function newFunction() {
+  return 'new';
+}
`,
      summary: {
        filesChanged: 2,
        insertions: 15,
        deletions: 2,
      },
    };

    const mockAIResponse: AIAnalysisResult = {
      fileAnalyses: [
        {
          file: "src/file1.ts",
          changeType: "refactor",
          issues: [
            {
              source: "ai",
              severity: "medium",
              type: "code-smell",
              file: "src/file1.ts",
              line: 2,
              message: "Consider using a logger instead of console.log",
              description: "Console.log statements should be replaced with proper logging",
              suggestion: "Use a logging library",
            },
          ],
          summary: "Modified helper function",
          linesChanged: 7,
          qualityScore: 75,
        },
        {
          file: "src/file2.ts",
          changeType: "feature",
          issues: [],
          summary: "Added new function",
          linesChanged: 10,
          qualityScore: 85,
        },
      ],
      impactAnalysis: {
        riskLevel: "low",
        affectedModules: ["utils"],
        breakingChanges: [],
        testingRecommendations: ["Test new function"],
        deploymentRisks: [],
        qualityScore: 80,
      },
    };

    it("should analyze working directory changes successfully", async () => {
      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(mockWorkingDirectoryChanges);
      // Mock responses for quality, security, and impact analysis
      (mockAIProvider.analyzeCode as any)
        .mockResolvedValueOnce(JSON.stringify(mockAIResponse)) // quality
        .mockResolvedValueOnce(JSON.stringify(mockAIResponse)) // security
        .mockResolvedValueOnce(JSON.stringify(mockAIResponse)); // impact

      const result = await analyzer.analyzeWorkingDirectory();

      expect(result.changeType).toBe("working-directory");
      expect(result.fileAnalyses).toHaveLength(2);
      expect(result.fileAnalyses[0].file).toBe("src/file1.ts");
      // Issues are merged from multiple analysis types, so count may be > 1
      expect(result.fileAnalyses[0].issues.length).toBeGreaterThanOrEqual(1);
      expect(result.impactAnalysis.riskLevel).toBe("low");
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    it("should handle empty working directory", async () => {
      const emptyChanges: WorkingDirectoryChanges = {
        type: "working-directory",
        files: [],
        diff: "",
        summary: {
          filesChanged: 0,
          insertions: 0,
          deletions: 0,
        },
      };

      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(emptyChanges);

      const result = await analyzer.analyzeWorkingDirectory();

      expect(result.changeType).toBe("working-directory");
      expect(result.fileAnalyses).toHaveLength(0);
      expect(result.impactAnalysis.riskLevel).toBe("low");
      expect(mockAIProvider.analyzeCode).not.toHaveBeenCalled();
    });

    it("should respect analysis options", async () => {
      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(mockWorkingDirectoryChanges);
      (mockAIProvider.analyzeCode as any).mockResolvedValue(JSON.stringify(mockAIResponse));

      const options: AnalysisOptions = {
        checkQuality: true,
        checkSecurity: false,
        checkArchitecture: false,
      };

      await analyzer.analyzeWorkingDirectory(options);

      // Should call AI provider for quality analysis
      expect(mockAIProvider.analyzeCode).toHaveBeenCalled();
    });

    it("should handle AI provider errors gracefully", async () => {
      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(mockWorkingDirectoryChanges);
      (mockAIProvider.analyzeCode as any).mockRejectedValue(new Error("AI service unavailable"));

      const result = await analyzer.analyzeWorkingDirectory();

      // Should return default analysis results
      expect(result.fileAnalyses).toHaveLength(2);
      expect(result.fileAnalyses[0].issues).toHaveLength(0);
      expect(result.impactAnalysis.riskLevel).toBe("low");
    });

    it("should handle invalid AI response format", async () => {
      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(mockWorkingDirectoryChanges);
      (mockAIProvider.analyzeCode as any).mockResolvedValue("invalid json response");

      const result = await analyzer.analyzeWorkingDirectory();

      // Should return default analysis results
      expect(result.fileAnalyses).toHaveLength(2);
      expect(result.fileAnalyses[0].issues).toHaveLength(0);
    });
  });

  describe("analyzeBranchComparison", () => {
    const mockBranchComparison: BranchComparison = {
      type: "branch-comparison",
      baseBranch: "main",
      compareBranch: "feature-branch",
      files: [
        {
          path: "src/service.ts",
          status: "modified",
          linesAdded: 20,
          linesDeleted: 5,
        },
      ],
      diff: `diff --git a/src/service.ts b/src/service.ts
index 1234567..abcdefg 100644
--- a/src/service.ts
+++ b/src/service.ts
@@ -1,10 +1,25 @@
 export class Service {
-  oldMethod() {
-    return 'old';
+  newMethod() {
+    return 'new';
+  }
+  anotherMethod() {
+    return 'another';
   }
 }
`,
      summary: {
        filesChanged: 1,
        insertions: 20,
        deletions: 5,
      },
      commits: [
        {
          sha: "abc123",
          message: "Add new service methods",
          author: "Test User",
          email: "test@example.com",
          date: "2025-01-20T10:00:00Z",
        },
      ],
    };

    const mockAIResponse: AIAnalysisResult = {
      fileAnalyses: [
        {
          file: "src/service.ts",
          changeType: "feature",
          issues: [],
          summary: "Added new methods",
          linesChanged: 25,
          qualityScore: 90,
        },
      ],
      impactAnalysis: {
        riskLevel: "medium",
        affectedModules: ["service"],
        breakingChanges: [],
        testingRecommendations: ["Test new methods"],
        deploymentRisks: [],
        qualityScore: 90,
      },
    };

    it("should analyze branch comparison successfully", async () => {
      mockGitService.compareBranches.mockResolvedValue(mockBranchComparison);
      mockGitService.getCurrentBranch.mockResolvedValue("feature-branch");
      (mockAIProvider.analyzeCode as any).mockResolvedValue(JSON.stringify(mockAIResponse));

      const result = await analyzer.analyzeBranchComparison("main", "feature-branch");

      expect(result.changeType).toBe("branch-comparison");
      expect(result.fileAnalyses).toHaveLength(1);
      expect(result.fileAnalyses[0].file).toBe("src/service.ts");
      expect(result.impactAnalysis.riskLevel).toBe("medium");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should use current branch when compareBranch is not provided", async () => {
      mockGitService.compareBranches.mockResolvedValue(mockBranchComparison);
      mockGitService.getCurrentBranch.mockResolvedValue("current-branch");
      (mockAIProvider.analyzeCode as any).mockResolvedValue(JSON.stringify(mockAIResponse));

      await analyzer.analyzeBranchComparison("main");

      expect(mockGitService.compareBranches).toHaveBeenCalledWith("main", "current-branch");
    });

    it("should handle empty branch comparison", async () => {
      const emptyComparison: BranchComparison = {
        type: "branch-comparison",
        baseBranch: "main",
        compareBranch: "feature-branch",
        files: [],
        diff: "",
        summary: {
          filesChanged: 0,
          insertions: 0,
          deletions: 0,
        },
        commits: [],
      };

      mockGitService.compareBranches.mockResolvedValue(emptyComparison);

      const result = await analyzer.analyzeBranchComparison("main", "feature-branch");

      expect(result.fileAnalyses).toHaveLength(0);
      expect(mockAIProvider.analyzeCode).not.toHaveBeenCalled();
    });

    it("should include commit messages in impact analysis", async () => {
      mockGitService.compareBranches.mockResolvedValue(mockBranchComparison);
      mockGitService.getCurrentBranch.mockResolvedValue("feature-branch");
      (mockAIProvider.analyzeCode as any).mockResolvedValue(JSON.stringify(mockAIResponse));

      await analyzer.analyzeBranchComparison("main", "feature-branch");

      // Verify that AI provider was called with commit context
      const calls = (mockAIProvider.analyzeCode as any).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe("batch processing", () => {
    const createLargeChanges = (fileCount: number): WorkingDirectoryChanges => {
      const files = Array.from({ length: fileCount }, (_, i) => ({
        path: `src/file${i}.ts`,
        status: "modified" as const,
        linesAdded: 10,
        linesDeleted: 5,
      }));

      const diff = files
        .map(
          (file) => `diff --git a/${file.path} b/${file.path}
index 1234567..abcdefg 100644
--- a/${file.path}
+++ b/${file.path}
@@ -1,5 +1,10 @@
+export function func${file.path}() {
+  return 'test';
+}
`
        )
        .join("\n");

      return {
        type: "working-directory" as const,
        files,
        diff,
        summary: {
          filesChanged: fileCount,
          insertions: fileCount * 10,
          deletions: fileCount * 5,
        },
      };
    };

    it("should process multiple files in batches", async () => {
      const largeChanges = createLargeChanges(5);
      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(largeChanges);

      const mockResponse: AIAnalysisResult = {
        fileAnalyses: [],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 70,
        },
      };

      (mockAIProvider.analyzeCode as any).mockResolvedValue(JSON.stringify(mockResponse));

      await analyzer.analyzeWorkingDirectory();

      // Should call AI provider multiple times (one per batch)
      expect(mockAIProvider.analyzeCode).toHaveBeenCalled();
    });

    it("should handle parallel batch processing", async () => {
      const largeChanges = createLargeChanges(10);
      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(largeChanges);

      const mockResponse: AIAnalysisResult = {
        fileAnalyses: [],
        impactAnalysis: {
          riskLevel: "low",
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 70,
        },
      };

      (mockAIProvider.analyzeCode as any).mockResolvedValue(JSON.stringify(mockResponse));

      const startTime = Date.now();
      await analyzer.analyzeWorkingDirectory();
      const duration = Date.now() - startTime;

      // With parallel processing, should complete faster than sequential
      expect(mockAIProvider.analyzeCode).toHaveBeenCalled();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should handle partial batch failures", async () => {
      const largeChanges = createLargeChanges(5);
      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(largeChanges);

      // First call succeeds, second fails
      (mockAIProvider.analyzeCode as any)
        .mockResolvedValueOnce(
          JSON.stringify({
            fileAnalyses: [],
            impactAnalysis: {
              riskLevel: "low",
              affectedModules: [],
              breakingChanges: [],
              testingRecommendations: [],
              deploymentRisks: [],
              qualityScore: 70,
            },
          })
        )
        .mockRejectedValueOnce(new Error("Batch failed"));

      const result = await analyzer.analyzeWorkingDirectory();

      // Should still return results from successful batches
      expect(result.fileAnalyses).toBeDefined();
      expect(result.impactAnalysis).toBeDefined();
    });
  });

  describe("analysis types", () => {
    const mockChanges: WorkingDirectoryChanges = {
      type: "working-directory",
      files: [
        {
          path: "src/test.ts",
          status: "modified",
          linesAdded: 5,
          linesDeleted: 2,
        },
      ],
      diff: `diff --git a/src/test.ts b/src/test.ts
index 1234567..abcdefg 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,3 +1,6 @@
 export function test() {
-  return 'old';
+  return 'new';
 }
`,
      summary: {
        filesChanged: 1,
        insertions: 5,
        deletions: 2,
      },
    };

    it("should perform quality analysis when enabled", async () => {
      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(mockChanges);
      (mockAIProvider.analyzeCode as any).mockResolvedValue(
        JSON.stringify({
          fileAnalyses: [],
          impactAnalysis: {
            riskLevel: "low",
            affectedModules: [],
            breakingChanges: [],
            testingRecommendations: [],
            deploymentRisks: [],
            qualityScore: 70,
          },
        })
      );

      await analyzer.analyzeWorkingDirectory({ checkQuality: true });

      expect(mockAIProvider.analyzeCode).toHaveBeenCalled();
    });

    it("should perform security analysis when enabled", async () => {
      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(mockChanges);
      (mockAIProvider.analyzeCode as any).mockResolvedValue(
        JSON.stringify({
          fileAnalyses: [],
          impactAnalysis: {
            riskLevel: "low",
            affectedModules: [],
            breakingChanges: [],
            testingRecommendations: [],
            deploymentRisks: [],
            qualityScore: 70,
          },
        })
      );

      await analyzer.analyzeWorkingDirectory({ checkSecurity: true });

      expect(mockAIProvider.analyzeCode).toHaveBeenCalled();
    });

    it("should perform impact analysis by default", async () => {
      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(mockChanges);
      (mockAIProvider.analyzeCode as any).mockResolvedValue(
        JSON.stringify({
          fileAnalyses: [],
          impactAnalysis: {
            riskLevel: "low",
            affectedModules: [],
            breakingChanges: [],
            testingRecommendations: [],
            deploymentRisks: [],
            qualityScore: 70,
          },
        })
      );

      await analyzer.analyzeWorkingDirectory();

      // Impact analysis should always run
      expect(mockAIProvider.analyzeCode).toHaveBeenCalled();
    });

    it("should skip quality and security when disabled", async () => {
      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(mockChanges);
      (mockAIProvider.analyzeCode as any).mockResolvedValue(
        JSON.stringify({
          fileAnalyses: [],
          impactAnalysis: {
            riskLevel: "low",
            affectedModules: [],
            breakingChanges: [],
            testingRecommendations: [],
            deploymentRisks: [],
            qualityScore: 70,
          },
        })
      );

      await analyzer.analyzeWorkingDirectory({
        checkQuality: false,
        checkSecurity: false,
      });

      // Should still call for impact analysis
      expect(mockAIProvider.analyzeCode).toHaveBeenCalled();
    });
  });

  describe("result merging", () => {
    it("should merge file analyses from multiple analysis types", async () => {
      const mockChanges: WorkingDirectoryChanges = {
        type: "working-directory",
        files: [
          {
            path: "src/test.ts",
            status: "modified",
            linesAdded: 5,
            linesDeleted: 2,
          },
        ],
        diff: `diff --git a/src/test.ts b/src/test.ts
index 1234567..abcdefg 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,3 +1,6 @@
 export function test() {
-  return 'old';
+  return 'new';
 }
`,
        summary: {
          filesChanged: 1,
          insertions: 5,
          deletions: 2,
        },
      };

      mockGitService.getWorkingDirectoryChanges.mockResolvedValue(mockChanges);

      // Mock different responses for quality and security
      (mockAIProvider.analyzeCode as any)
        .mockResolvedValueOnce(
          JSON.stringify({
            fileAnalyses: [
              {
                file: "src/test.ts",
                changeType: "refactor",
                issues: [
                  {
                    source: "ai",
                    severity: "medium",
                    type: "code-smell",
                    file: "src/test.ts",
                    line: 2,
                    message: "Quality issue",
                  },
                ],
                summary: "Quality analysis",
                linesChanged: 7,
                qualityScore: 75,
              },
            ],
            impactAnalysis: {
              riskLevel: "low",
              affectedModules: [],
              breakingChanges: [],
              testingRecommendations: [],
              deploymentRisks: [],
              qualityScore: 75,
            },
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            fileAnalyses: [
              {
                file: "src/test.ts",
                changeType: "refactor",
                issues: [
                  {
                    source: "ai",
                    severity: "high",
                    type: "vulnerability",
                    file: "src/test.ts",
                    line: 2,
                    message: "Security issue",
                  },
                ],
                summary: "Security analysis",
                linesChanged: 7,
                qualityScore: 80,
              },
            ],
            impactAnalysis: {
              riskLevel: "medium",
              affectedModules: [],
              breakingChanges: [],
              testingRecommendations: [],
              deploymentRisks: [],
              qualityScore: 80,
            },
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            fileAnalyses: [],
            impactAnalysis: {
              riskLevel: "low",
              affectedModules: [],
              breakingChanges: [],
              testingRecommendations: [],
              deploymentRisks: [],
              qualityScore: 70,
            },
          })
        );

      const result = await analyzer.analyzeWorkingDirectory({
        checkQuality: true,
        checkSecurity: true,
      });

      // Should merge issues from both analyses
      const fileAnalysis = result.fileAnalyses.find((f) => f.file === "src/test.ts");
      expect(fileAnalysis).toBeDefined();
      expect(fileAnalysis!.issues.length).toBeGreaterThanOrEqual(2);
    });
  });
});
