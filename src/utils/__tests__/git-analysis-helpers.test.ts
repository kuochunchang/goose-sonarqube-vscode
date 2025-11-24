/**
 * Git Analysis Helpers Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { GitChangePanel } from "../../views/git-change-panel.js";
import {
  createProgressReporter,
  executeAnalysisWithProgress,
  getWorkspaceFolder,
  handleAnalysisError,
  selectAnalysisTypes,
  showAnalyzingPanel,
  showCompletionMessage,
  updatePanelWithError,
  updatePanelWithResults,
} from "../git-analysis-helpers.js";

// Mock VS Code API
vi.mock("vscode", () => {
  return {
    workspace: {
      workspaceFolders: undefined,
    },
    window: {
      showErrorMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      showQuickPick: vi.fn(),
      withProgress: vi.fn(),
    },
    ProgressLocation: {
      Notification: 15,
    },
    Uri: {
      parse: vi.fn((path: string) => ({ path })),
      file: vi.fn((path: string) => ({ path })),
    },
  };
});

// Mock GitChangePanel
vi.mock("../../views/git-change-panel.js", () => {
  return {
    GitChangePanel: {
      currentPanel: undefined,
      createOrShow: vi.fn(),
    },
  };
});

describe("git-analysis-helpers", () => {
  let mockContext: vscode.ExtensionContext;
  let mockWorkspaceState: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceState = new Map();

    mockContext = {
      workspaceState: {
        get: vi.fn((key: string, defaultValue?: any) => {
          return mockWorkspaceState.get(key) ?? defaultValue;
        }),
        update: vi.fn(async (key: string, value: any) => {
          mockWorkspaceState.set(key, value);
        }),
      },
    } as any;
  });

  describe("getWorkspaceFolder", () => {
    it("should return workspace folder when available", () => {
      const mockFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file("/test/workspace"),
        name: "test-workspace",
        index: 0,
      };

      (vscode.workspace as any).workspaceFolders = [mockFolder];

      const folder = getWorkspaceFolder();
      expect(folder).toEqual(mockFolder);
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it("should return null and show error when no workspace folder", () => {
      (vscode.workspace as any).workspaceFolders = undefined;

      const folder = getWorkspaceFolder();
      expect(folder).toBeNull();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "No workspace folder found. Please open a folder first."
      );
    });

    it("should return null when workspace folders array is empty", () => {
      (vscode.workspace as any).workspaceFolders = [];

      const folder = getWorkspaceFolder();
      expect(folder).toBeNull();
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe("selectAnalysisTypes", () => {
    it("should return selected analysis types", async () => {
      const mockItems = [
        { label: "Quality", picked: true },
        { label: "Security", picked: false },
      ];

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(mockItems as any);

      const result = await selectAnalysisTypes(mockContext);

      expect(result).toEqual(["quality", "security"]);
      expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
        "git-analysis.lastSelectedTypes",
        ["quality", "security"]
      );
    });

    it("should return undefined when user cancels", async () => {
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      const result = await selectAnalysisTypes(mockContext);

      expect(result).toBeUndefined();
      expect(mockContext.workspaceState.update).not.toHaveBeenCalled();
    });

    it("should return undefined when no items selected", async () => {
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      const result = await selectAnalysisTypes(mockContext);

      expect(result).toBeUndefined();
    });

    it("should use last selected types as default", async () => {
      mockWorkspaceState.set("git-analysis.lastSelectedTypes", ["quality", "architecture"]);

      const mockItems = [
        { label: "Quality", picked: true },
        { label: "Architecture", picked: true },
      ];

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(mockItems as any);

      await selectAnalysisTypes(mockContext);

      expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: "Quality", picked: true }),
          expect.objectContaining({ label: "Architecture", picked: true }),
        ]),
        expect.any(Object)
      );
    });

    it("should convert labels to lowercase", async () => {
      const mockItems = [{ label: "Quality" }, { label: "Security" }, { label: "Architecture" }];

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(mockItems as any);

      const result = await selectAnalysisTypes(mockContext);

      expect(result).toEqual(["quality", "security", "architecture"]);
    });
  });

  describe("showAnalyzingPanel", () => {
    it("should create panel with analyzing state for working directory", () => {
      const extensionUri = vscode.Uri.file("/extension");
      const config = {
        changeSource: "working-directory" as const,
        workingDirectory: "/test/dir",
      };

      showAnalyzingPanel(extensionUri, config);

      expect(GitChangePanel.createOrShow).toHaveBeenCalledWith(extensionUri, {
        changeSource: "working-directory",
        workingDirectory: "/test/dir",
        status: "analyzing",
        progress: {
          message: "Initializing analysis...",
          percentage: 0,
        },
      });
    });

    it("should create panel with analyzing state for branch comparison", () => {
      const extensionUri = vscode.Uri.file("/extension");
      const config = {
        changeSource: "branch-comparison" as const,
        workingDirectory: "/test/dir",
        sourceBranch: "feature",
        targetBranch: "main",
      };

      showAnalyzingPanel(extensionUri, config);

      expect(GitChangePanel.createOrShow).toHaveBeenCalledWith(extensionUri, {
        changeSource: "branch-comparison",
        workingDirectory: "/test/dir",
        sourceBranch: "feature",
        targetBranch: "main",
        status: "analyzing",
        progress: {
          message: "Initializing branch comparison...",
          percentage: 0,
        },
      });
    });

    it("should create panel with analyzing state for pull request", () => {
      const extensionUri = vscode.Uri.file("/extension");
      const config = {
        changeSource: "pull-request" as const,
        workingDirectory: "/test/dir",
        pullRequestNumber: 123,
        repository: { owner: "test", repo: "repo" },
      };

      showAnalyzingPanel(extensionUri, config);

      expect(GitChangePanel.createOrShow).toHaveBeenCalledWith(extensionUri, {
        changeSource: "pull-request",
        workingDirectory: "/test/dir",
        pullRequestNumber: 123,
        repository: { owner: "test", repo: "repo" },
        status: "analyzing",
        progress: {
          message: "Analyzing PR #123...",
          percentage: 0,
        },
      });
    });
  });

  describe("updatePanelWithResults", () => {
    it("should update panel with completed results", () => {
      const extensionUri = vscode.Uri.file("/extension");
      const result: any = {
        changeType: "working-directory",
        fileAnalyses: [],
        summary: { filesChanged: 1 },
        impactAnalysis: { riskLevel: "low", qualityScore: 100 },
        timestamp: "2025-01-01",
        duration: 1000,
      };
      const config = {
        changeSource: "working-directory" as const,
        workingDirectory: "/test/dir",
      };

      updatePanelWithResults(extensionUri, result, config);

      expect(GitChangePanel.createOrShow).toHaveBeenCalledWith(extensionUri, {
        result,
        changeSource: "working-directory",
        workingDirectory: "/test/dir",
        status: "completed",
      });
    });
  });

  describe("updatePanelWithError", () => {
    it("should update panel with error state when panel exists", () => {
      const mockPanel = {
        update: vi.fn(),
      };
      (GitChangePanel as any).currentPanel = mockPanel;

      const config = {
        changeSource: "working-directory" as const,
        workingDirectory: "/test/dir",
      };

      updatePanelWithError(config);

      expect(mockPanel.update).toHaveBeenCalledWith({
        changeSource: "working-directory",
        workingDirectory: "/test/dir",
        status: "error",
      });
    });

    it("should not throw when panel does not exist", () => {
      (GitChangePanel as any).currentPanel = undefined;

      const config = {
        changeSource: "working-directory" as const,
        workingDirectory: "/test/dir",
      };

      expect(() => updatePanelWithError(config)).not.toThrow();
    });
  });

  describe("showCompletionMessage", () => {
    it("should show completion message with issue count", () => {
      const result: any = {
        fileAnalyses: [
          {
            file: "file1.ts",
            issues: [{ message: "Issue 1" }, { message: "Issue 2" }],
          },
          {
            file: "file2.ts",
            issues: [{ message: "Issue 3" }],
          },
        ],
      };

      showCompletionMessage(result);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Analysis complete! Found 3 issue(s) in 2 file(s)."
      );
    });

    it("should handle zero issues", () => {
      const result: any = {
        fileAnalyses: [
          {
            file: "file1.ts",
            issues: [],
          },
        ],
      };

      showCompletionMessage(result);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Analysis complete! Found 0 issue(s) in 1 file(s)."
      );
    });
  });

  describe("createProgressReporter", () => {
    it("should create progress reporter that updates both progress and panel", () => {
      const mockProgress = {
        report: vi.fn(),
      };
      const mockPanel = {
        updateProgress: vi.fn(),
      };
      (GitChangePanel as any).currentPanel = mockPanel;

      const reporter = createProgressReporter(mockProgress as any);
      reporter("Test message", 50);

      expect(mockProgress.report).toHaveBeenCalledWith({
        message: "Test message",
        increment: 50,
      });
      expect(mockPanel.updateProgress).toHaveBeenCalledWith("Test message", 50);
    });

    it("should not update panel when increment is undefined", () => {
      const mockProgress = {
        report: vi.fn(),
      };
      const mockPanel = {
        updateProgress: vi.fn(),
      };
      (GitChangePanel as any).currentPanel = mockPanel;

      const reporter = createProgressReporter(mockProgress as any);
      reporter("Test message");

      expect(mockProgress.report).toHaveBeenCalledWith({
        message: "Test message",
        increment: undefined,
      });
      expect(mockPanel.updateProgress).not.toHaveBeenCalled();
    });

    it("should not throw when panel does not exist", () => {
      const mockProgress = {
        report: vi.fn(),
      };
      (GitChangePanel as any).currentPanel = undefined;

      const reporter = createProgressReporter(mockProgress as any);
      expect(() => reporter("Test message", 50)).not.toThrow();
    });
  });

  describe("executeAnalysisWithProgress", () => {
    it("should execute analysis with progress tracking", async () => {
      const mockProgress = {
        report: vi.fn(),
      };
      const mockAnalysisFn = vi.fn().mockResolvedValue({ result: "test" });

      vi.mocked(vscode.window.withProgress).mockImplementation(async (options, callback) => {
        return callback(mockProgress as any, undefined as any);
      });

      const result = await executeAnalysisWithProgress("Test Analysis", mockAnalysisFn);

      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Test Analysis",
          cancellable: false,
        },
        expect.any(Function)
      );
      expect(mockAnalysisFn).toHaveBeenCalled();
      expect(result).toEqual({ result: "test" });
    });
  });

  describe("handleAnalysisError", () => {
    it("should handle Error objects", () => {
      const mockPanel = {
        update: vi.fn(),
      };
      (GitChangePanel as any).currentPanel = mockPanel;

      const error = new Error("Test error message");
      const config = {
        changeSource: "working-directory" as const,
        workingDirectory: "/test/dir",
      };

      handleAnalysisError(error, "Analysis failed", config);

      expect(mockPanel.update).toHaveBeenCalledWith({
        changeSource: "working-directory",
        workingDirectory: "/test/dir",
        status: "error",
      });
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Analysis failed: Test error message"
      );
    });

    it("should handle string errors", () => {
      const mockPanel = {
        update: vi.fn(),
      };
      (GitChangePanel as any).currentPanel = mockPanel;

      const error = "String error";
      const config = {
        changeSource: "working-directory" as const,
        workingDirectory: "/test/dir",
      };

      handleAnalysisError(error, "Analysis failed", config);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Analysis failed: String error");
    });

    it("should handle unknown error types", () => {
      const mockPanel = {
        update: vi.fn(),
      };
      (GitChangePanel as any).currentPanel = mockPanel;

      const error = { custom: "error" };
      const config = {
        changeSource: "working-directory" as const,
        workingDirectory: "/test/dir",
      };

      handleAnalysisError(error, "Analysis failed", config);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Analysis failed: [object Object]"
      );
    });

    it("should not throw when panel does not exist", () => {
      (GitChangePanel as any).currentPanel = undefined;

      const error = new Error("Test error");
      const config = {
        changeSource: "working-directory" as const,
        workingDirectory: "/test/dir",
      };

      expect(() => handleAnalysisError(error, "Analysis failed", config)).not.toThrow();
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });
});
