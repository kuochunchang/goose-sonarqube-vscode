/**
 * GitAnalysisService Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import type { AnalysisType, MergedAnalysisResult } from "../../git-analyzer/index.js";
import type { BranchComparisonConfig, GitAnalysisConfig } from "../git-analysis-service.js";
import { GitAnalysisService } from "../git-analysis-service.js";

// Mock VS Code API
vi.mock("vscode", () => {
  return {
    window: {
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
      })),
    },
  };
});

// Mock SonarQubeConfigService
vi.mock("../sonarqube-config-service.js", () => {
  return {
    SonarQubeConfigService: vi.fn().mockImplementation(() => ({
      isEnabled: vi.fn().mockReturnValue(true),
      getSonarQubeConfig: vi.fn().mockResolvedValue({
        serverUrl: "http://localhost:9000",
        token: "test-token",
        projectKey: "test-project",
        projectName: "Test Project",
        timeout: 3000,
      }),
    })),
  };
});

// Mock child_process
vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue("https://github.com/owner/repo.git"),
}));

// Mock git-analyzer modules
vi.mock("../../git-analyzer/index.js", async () => {
  const actual = await vi.importActual("../../git-analyzer/index.js");
  return {
    ...actual,
    GitService: vi.fn().mockImplementation(() => ({
      getGitRoot: vi.fn().mockResolvedValue("/test/repo"),
      getWorkingDirectoryChanges: vi.fn().mockResolvedValue({
        summary: {
          filesChanged: 2,
          insertions: 10,
          deletions: 5,
        },
        files: [
          {
            path: "src/file1.ts",
            status: "modified",
            linesAdded: 10,
            linesDeleted: 5,
          },
          {
            path: "src/file2.ts",
            status: "added",
            linesAdded: 5,
            linesDeleted: 0,
          },
        ],
        diff: "mock diff",
      }),
      compareBranches: vi.fn().mockResolvedValue({
        summary: {
          filesChanged: 1,
          insertions: 5,
          deletions: 2,
        },
        files: [
          {
            path: "src/file1.ts",
            status: "modified",
            linesAdded: 5,
            linesDeleted: 2,
          },
        ],
        diff: "mock diff",
      }),
      getCurrentBranch: vi.fn().mockResolvedValue("feature-branch"),
      isClean: vi.fn().mockResolvedValue(false),
      getRepoRoot: vi.fn().mockResolvedValue("/test/repo"),
      getBranches: vi.fn().mockResolvedValue({
        all: ["main", "feature-branch"],
      }),
    })),
    GitHubService: vi.fn().mockImplementation(() => ({
      getPullRequestFiles: vi.fn().mockResolvedValue([
        {
          filename: "src/file1.ts",
          status: "modified",
          additions: 10,
          deletions: 5,
          changes: 15,
        },
      ]),
    })),
    SonarQubeService: vi.fn().mockImplementation(() => ({
      testConnection: vi.fn().mockResolvedValue({
        success: true,
        version: "9.9.0",
        responseTime: 150,
      }),
      executeScan: vi.fn().mockResolvedValue({
        success: true,
        taskId: "task-123",
        dashboardUrl: "http://localhost:9000/dashboard?id=test-project",
        executionTime: 5000,
      }),
      waitForAnalysis: vi.fn().mockResolvedValue(true),
    })),
    AnalysisOrchestrator: vi.fn().mockImplementation(() => {
      const instance = {
        detectMode: vi.fn().mockResolvedValue({
          mode: "sonarqube-only",
          sonarQubeAvailable: true,
        }),
        isSonarQubeAvailable: vi.fn().mockReturnValue(true),
      };
      return instance;
    }),
    MergeService: vi.fn().mockImplementation(() => ({
      merge: vi.fn().mockImplementation((aiResult, sonarResult, baseResult) => ({
        ...baseResult,
        fileAnalyses: baseResult.fileAnalyses || [],
        impactAnalysis: aiResult.impactAnalysis,
      })),
    })),
    ReportExporter: vi.fn().mockImplementation(() => ({
      export: vi.fn().mockReturnValue("exported content"),
    })),
  };
});

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock fetch for SonarQube API calls
const mockFetchResponses = new Map<string, any>();

vi.stubGlobal("fetch", (url: string | URL) => {
  const urlString = url.toString();
  const response = mockFetchResponses.get(urlString) || {
    ok: true,
    json: async () => ({
      issues: [],
      component: {
        measures: [],
      },
      projectStatus: {
        status: "OK",
        conditions: [],
      },
    }),
  };
  return Promise.resolve(response);
});

describe("GitAnalysisService", () => {
  let service: GitAnalysisService;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchResponses.clear();

    // Setup mock context
    mockContext = {
      secrets: {
        get: vi.fn(),
        store: vi.fn(),
        delete: vi.fn(),
      },
      workspaceState: {
        get: vi.fn(),
        update: vi.fn(),
      },
    } as any;

    // Setup global output channel
    global.gooseOutputChannel = {
      appendLine: vi.fn(),
    } as any;

    service = new GitAnalysisService(mockContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (global as any).gooseOutputChannel;
  });

  describe("constructor", () => {
    it("should initialize with extension context", () => {
      expect(service).toBeDefined();
    });
  });

  describe("initialize", () => {
    it("should initialize SonarQube when enabled", async () => {
      const { SonarQubeConfigService } = await import("../sonarqube-config-service.js");
      const mockConfigService = new SonarQubeConfigService(mockContext);
      vi.mocked(mockConfigService.isEnabled).mockReturnValue(true);
      vi.mocked(mockConfigService.getSonarQubeConfig).mockResolvedValue({
        serverUrl: "http://localhost:9000",
        token: "test-token",
        projectKey: "test-project",
        projectName: "Test Project",
        timeout: 3000,
      });

      await service.initialize();

      // Service should be initialized
      expect(service).toBeDefined();
    });

    it("should skip initialization when SonarQube is disabled", async () => {
      const { SonarQubeConfigService } = await import("../sonarqube-config-service.js");
      const mockConfigService = new SonarQubeConfigService(mockContext);
      vi.mocked(mockConfigService.isEnabled).mockReturnValue(false);

      await service.initialize();

      // Service should still be initialized
      expect(service).toBeDefined();
    });

    it("should handle initialization errors", async () => {
      // Create a new service instance with a mock that throws
      const mockConfigService = {
        isEnabled: vi.fn().mockImplementation(() => {
          throw new Error("Config error");
        }),
        getSonarQubeConfig: vi.fn(),
      };

      // Replace the config service in the service instance
      (service as any).sonarQubeConfigService = mockConfigService;

      await expect(service.initialize()).rejects.toThrow(
        "Failed to initialize Git Analysis Service: Config error"
      );
    });
  });

  describe("analyzeWorkingDirectory", () => {
    it("should analyze working directory changes", async () => {
      // Initialize orchestrator first
      await service.initialize();

      const config: GitAnalysisConfig = {
        analysisTypes: ["quality"],
        workingDirectory: "/test/repo",
      };

      // Setup SonarQube API responses
      mockFetchResponses.set(
        "http://localhost:9000/api/issues/search?componentKeys=test-project:src/file1.ts,test-project:src/file2.ts&resolved=false&ps=500",
        {
          ok: true,
          json: async () => ({
            issues: [
              {
                key: "issue-1",
                rule: "typescript:S1234",
                severity: "MAJOR",
                type: "BUG",
                component: "test-project:src/file1.ts",
                message: "Test issue",
                textRange: { startLine: 10, endLine: 10 },
              },
            ],
          }),
        }
      );

      mockFetchResponses.set(
        "http://localhost:9000/api/measures/component?component=test-project&metricKeys=bugs,vulnerabilities,code_smells,security_hotspots,sqale_debt_ratio,coverage,ncloc,duplicated_lines_density",
        {
          ok: true,
          json: async () => ({
            component: {
              measures: [],
            },
          }),
        }
      );

      mockFetchResponses.set(
        "http://localhost:9000/api/qualitygates/project_status?projectKey=test-project",
        {
          ok: true,
          json: async () => ({
            projectStatus: {
              status: "OK",
              conditions: [],
            },
          }),
        }
      );

      const progressCallback = vi.fn();
      const result = await service.analyzeWorkingDirectory(config, progressCallback);

      expect(result).toBeDefined();
      expect(result.changeType).toBe("working-directory");
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should throw error when SonarQube is not available", async () => {
      // Create an orchestrator that returns false for isSonarQubeAvailable
      const mockOrchestrator = {
        isSonarQubeAvailable: vi.fn().mockReturnValue(false),
      };
      (service as any).orchestrator = mockOrchestrator;
      // Prevent re-initialization from changing the orchestrator so that the
      // method still behaves as if SonarQube is unavailable.
      (service as any).initializeSonarQube = vi.fn().mockResolvedValue(undefined);

      const config: GitAnalysisConfig = {
        analysisTypes: ["quality"],
        workingDirectory: "/test/repo",
      };

      await expect(service.analyzeWorkingDirectory(config)).rejects.toThrow(
        "SonarQube is not available"
      );
    });

    it("should handle scan execution failure", async () => {
      const { SonarQubeService } = await import("../../git-analyzer/index.js");
      vi.mocked(SonarQubeService).mockImplementation(
        () =>
          ({
            testConnection: vi.fn().mockResolvedValue({
              success: true,
              version: "9.9.0",
              responseTime: 150,
            }),
            executeScan: vi.fn().mockResolvedValue({
              success: false,
              error: "Scan failed",
            }),
          }) as any
      );

      const config: GitAnalysisConfig = {
        analysisTypes: ["quality"],
        workingDirectory: "/test/repo",
      };

      await expect(service.analyzeWorkingDirectory(config)).rejects.toThrow(
        "SonarQube scan failed"
      );
    });
  });

  describe("analyzeBranchComparison", () => {
    it("should analyze branch comparison", async () => {
      // Initialize orchestrator first
      await service.initialize();

      // Ensure SonarQubeService mock returns success
      const { SonarQubeService } = await import("../../git-analyzer/index.js");
      vi.mocked(SonarQubeService).mockImplementation(
        () =>
          ({
            testConnection: vi.fn().mockResolvedValue({
              success: true,
              version: "9.9.0",
              responseTime: 150,
            }),
            executeScan: vi.fn().mockResolvedValue({
              success: true,
              taskId: "task-123",
              dashboardUrl: "http://localhost:9000/dashboard?id=test-project",
              executionTime: 5000,
            }),
            waitForAnalysis: vi.fn().mockResolvedValue(true),
          }) as any
      );

      const config: BranchComparisonConfig = {
        analysisTypes: ["quality"],
        workingDirectory: "/test/repo",
        sourceBranch: "feature",
        targetBranch: "main",
      };

      // Setup SonarQube API responses
      mockFetchResponses.set(
        "http://localhost:9000/api/issues/search?componentKeys=test-project:src/file1.ts&resolved=false&ps=500",
        {
          ok: true,
          json: async () => ({
            issues: [],
          }),
        }
      );

      mockFetchResponses.set(
        "http://localhost:9000/api/measures/component?component=test-project&metricKeys=bugs,vulnerabilities,code_smells,security_hotspots,sqale_debt_ratio,coverage,ncloc,duplicated_lines_density",
        {
          ok: true,
          json: async () => ({
            component: {
              measures: [],
            },
          }),
        }
      );

      mockFetchResponses.set(
        "http://localhost:9000/api/qualitygates/project_status?projectKey=test-project",
        {
          ok: true,
          json: async () => ({
            projectStatus: {
              status: "OK",
              conditions: [],
            },
          }),
        }
      );

      const progressCallback = vi.fn();
      const result = await service.analyzeBranchComparison(config, progressCallback);

      expect(result).toBeDefined();
      expect(result.changeType).toBe("branch-comparison");
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should throw error when SonarQube is not available", async () => {
      // Create an orchestrator that returns false for isSonarQubeAvailable
      const mockOrchestrator = {
        isSonarQubeAvailable: vi.fn().mockReturnValue(false),
      };
      (service as any).orchestrator = mockOrchestrator;
      // Prevent re-initialization from changing the orchestrator so that the
      // method still behaves as if SonarQube is unavailable.
      (service as any).initializeSonarQube = vi.fn().mockResolvedValue(undefined);

      const config: BranchComparisonConfig = {
        analysisTypes: ["quality"],
        workingDirectory: "/test/repo",
        sourceBranch: "feature",
        targetBranch: "main",
      };

      await expect(service.analyzeBranchComparison(config)).rejects.toThrow(
        "SonarQube is not available"
      );
    });
  });

  describe("exportResult", () => {
    it("should export result to file", async () => {
      const result: MergedAnalysisResult = {
        changeType: "working-directory",
        summary: {
          filesChanged: 1,
          insertions: 10,
          deletions: 5,
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
        timestamp: "2025-01-01T00:00:00.000Z",
        duration: 1000,
      };

      const fs = await import("node:fs/promises");
      await service.exportResult(result, "markdown", "/test/output.md");

      expect(fs.writeFile).toHaveBeenCalledWith("/test/output.md", "exported content", "utf-8");
    });

    it("should handle export errors", async () => {
      const fs = await import("node:fs/promises");
      vi.mocked(fs.writeFile).mockRejectedValue(new Error("Write failed"));

      const result: MergedAnalysisResult = {
        changeType: "working-directory",
        summary: {
          filesChanged: 0,
          insertions: 0,
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
        timestamp: "2025-01-01T00:00:00.000Z",
        duration: 0,
      };

      await expect(service.exportResult(result, "markdown", "/test/output.md")).rejects.toThrow(
        "Failed to export report"
      );
    });
  });

  describe("getCurrentBranch", () => {
    it("should get current branch name", async () => {
      const branch = await service.getCurrentBranch("/test/repo");
      expect(branch).toBe("feature-branch");
    });
  });

  describe("isWorkingDirectoryClean", () => {
    it("should check if working directory is clean", async () => {
      const isClean = await service.isWorkingDirectoryClean("/test/repo");
      expect(isClean).toBe(false);
    });
  });

  describe("getRepoRoot", () => {
    it("should get repository root path", async () => {
      const root = await service.getRepoRoot("/test/repo");
      expect(root).toBe("/test/repo");
    });
  });

  describe("getBranches", () => {
    it("should get list of available branches", async () => {
      const branches = await service.getBranches("/test/repo");
      expect(branches).toEqual(["main", "feature-branch"]);
    });
  });

  describe("getGitHubRepository", () => {
    it("should get GitHub repository info from HTTPS URL", async () => {
      const { execSync } = await import("node:child_process");
      vi.mocked(execSync).mockReturnValueOnce("https://github.com/owner/repo.git" as any);

      const repo = await service.getGitHubRepository("/test/repo");
      expect(repo).toEqual({ owner: "owner", repo: "repo" });
    });

    it("should get GitHub repository info from SSH URL", async () => {
      const { execSync } = await import("node:child_process");
      vi.mocked(execSync).mockReturnValueOnce("git@github.com:owner/repo.git" as any);

      const repo = await service.getGitHubRepository("/test/repo");
      expect(repo).toEqual({ owner: "owner", repo: "repo" });
    });

    it("should return null for non-GitHub URLs", async () => {
      const { execSync } = await import("node:child_process");
      vi.mocked(execSync).mockReturnValueOnce("https://gitlab.com/owner/repo.git" as any);

      const repo = await service.getGitHubRepository("/test/repo");
      expect(repo).toBeNull();
    });

    it("should return null on error", async () => {
      const { execSync } = await import("node:child_process");
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error("Git error");
      });

      const repo = await service.getGitHubRepository("/test/repo");
      expect(repo).toBeNull();
    });
  });

  describe("analyzePullRequest", () => {
    it("should analyze pull request", async () => {
      // Initialize orchestrator first
      await service.initialize();

      // Ensure SonarQubeService mock returns success
      const { SonarQubeService } = await import("../../git-analyzer/index.js");
      vi.mocked(SonarQubeService).mockImplementation(
        () =>
          ({
            testConnection: vi.fn().mockResolvedValue({
              success: true,
              version: "9.9.0",
              responseTime: 150,
            }),
            executeScan: vi.fn().mockResolvedValue({
              success: true,
              taskId: "task-123",
              dashboardUrl: "http://localhost:9000/dashboard?id=test-project",
              executionTime: 5000,
            }),
            waitForAnalysis: vi.fn().mockResolvedValue(true),
          }) as any
      );

      // Setup SonarQube API responses
      mockFetchResponses.set(
        "http://localhost:9000/api/issues/search?componentKeys=test-project:src/file1.ts&resolved=false&ps=500",
        {
          ok: true,
          json: async () => ({
            issues: [],
          }),
        }
      );

      mockFetchResponses.set(
        "http://localhost:9000/api/measures/component?component=test-project&metricKeys=bugs,vulnerabilities,code_smells,security_hotspots,sqale_debt_ratio,coverage,ncloc,duplicated_lines_density",
        {
          ok: true,
          json: async () => ({
            component: {
              measures: [],
            },
          }),
        }
      );

      mockFetchResponses.set(
        "http://localhost:9000/api/qualitygates/project_status?projectKey=test-project",
        {
          ok: true,
          json: async () => ({
            projectStatus: {
              status: "OK",
              conditions: [],
            },
          }),
        }
      );

      const config = {
        workingDirectory: "/test/repo",
        repository: { owner: "test", repo: "repo" },
        prNumber: 123,
        analysisTypes: ["quality"] as AnalysisType[],
        githubToken: "test-token",
      };

      const progressCallback = vi.fn();
      const result = await service.analyzePullRequest(config, progressCallback);

      expect(result).toBeDefined();
      expect(result.changeType).toBe("pull-request");
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should throw error when GitHub token is missing", async () => {
      const config = {
        workingDirectory: "/test/repo",
        repository: { owner: "test", repo: "repo" },
        prNumber: 123,
        analysisTypes: ["quality"] as AnalysisType[],
        githubToken: "",
      };

      await expect(service.analyzePullRequest(config)).rejects.toThrow("GitHub token is required");
    });

    it("should throw error when SonarQube is not available", async () => {
      // Create an orchestrator that returns false for isSonarQubeAvailable
      const mockOrchestrator = {
        isSonarQubeAvailable: vi.fn().mockReturnValue(false),
      };
      (service as any).orchestrator = mockOrchestrator;

      const config = {
        workingDirectory: "/test/repo",
        repository: { owner: "test", repo: "repo" },
        prNumber: 123,
        analysisTypes: ["quality"] as AnalysisType[],
        githubToken: "test-token",
      };

      await expect(service.analyzePullRequest(config)).rejects.toThrow(
        "SonarQube is not available"
      );
    });
  });

  describe("dispose", () => {
    it("should dispose resources", () => {
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
