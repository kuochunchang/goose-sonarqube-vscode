/**
 * GitHubService unit tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubService } from "../services/GitHubService.js";
import type { GitHubConfig, GitHubRepository } from "../types/github.types.js";

// Mock @octokit/rest
vi.mock("@octokit/rest", () => {
  return {
    Octokit: vi.fn().mockImplementation(() => ({
      pulls: {
        get: vi.fn(),
        listFiles: vi.fn(),
      },
      issues: {
        createComment: vi.fn(),
        updateComment: vi.fn(),
        listComments: vi.fn(),
      },
      users: {
        getAuthenticated: vi.fn(),
      },
      repos: {
        getCollaboratorPermissionLevel: vi.fn(),
      },
    })),
  };
});

describe("GitHubService", () => {
  let service: GitHubService;
  let mockOctokit: any;
  const config: GitHubConfig = {
    token: "test-token",
    baseUrl: "https://api.github.com",
  };
  const repository: GitHubRepository = {
    owner: "test-owner",
    repo: "test-repo",
  };

  beforeEach(() => {
    service = new GitHubService(config);
    mockOctokit = (service as any).octokit;
  });

  describe("getPullRequest", () => {
    it("should fetch PR metadata successfully", async () => {
      const mockPR = {
        number: 123,
        title: "Test PR",
        body: "Test description",
        head: { ref: "feature", sha: "abc123" },
        base: { ref: "main", sha: "def456" },
        state: "open",
        user: { login: "testuser" },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-02T00:00:00Z",
      };

      mockOctokit.pulls.get.mockResolvedValue({ data: mockPR });

      const result = await service.getPullRequest(repository, 123);

      expect(result).toEqual({
        number: 123,
        title: "Test PR",
        body: "Test description",
        head: { ref: "feature", sha: "abc123" },
        base: { ref: "main", sha: "def456" },
        state: "open",
        user: { login: "testuser" },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-02T00:00:00Z",
      });

      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        pull_number: 123,
      });
    });

    it("should handle PR not found error", async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error("Not found"));

      await expect(service.getPullRequest(repository, 999)).rejects.toThrow(
        "Failed to fetch PR #999"
      );
    });
  });

  describe("getPullRequestFiles", () => {
    it("should fetch PR files successfully", async () => {
      const mockFiles = [
        {
          filename: "src/file1.ts",
          status: "modified",
          additions: 10,
          deletions: 5,
          changes: 15,
          patch: "@@ -1,5 +1,10 @@",
        },
        {
          filename: "src/file2.ts",
          status: "added",
          additions: 20,
          deletions: 0,
          changes: 20,
          patch: "@@ -0,0 +1,20 @@",
        },
      ];

      mockOctokit.pulls.listFiles.mockResolvedValue({ data: mockFiles });

      const result = await service.getPullRequestFiles(repository, 123);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        filename: "src/file1.ts",
        status: "modified",
        additions: 10,
        deletions: 5,
        changes: 15,
        patch: "@@ -1,5 +1,10 @@",
        previous_filename: undefined,
      });
    });

    it("should handle pagination correctly", async () => {
      const page1 = Array(100)
        .fill(null)
        .map((_, i) => ({
          filename: `file${i}.ts`,
          status: "modified",
          additions: 1,
          deletions: 1,
          changes: 2,
        }));

      const page2 = [
        {
          filename: "file100.ts",
          status: "added",
          additions: 10,
          deletions: 0,
          changes: 10,
        },
      ];

      mockOctokit.pulls.listFiles
        .mockResolvedValueOnce({ data: page1 })
        .mockResolvedValueOnce({ data: page2 });

      const result = await service.getPullRequestFiles(repository, 123);

      expect(result).toHaveLength(101);
      expect(mockOctokit.pulls.listFiles).toHaveBeenCalledTimes(2);
    });
  });

  describe("getPullRequestDiff", () => {
    it("should fetch PR diff successfully", async () => {
      const mockDiff = `diff --git a/file.ts b/file.ts
index 123..456 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,5 @@
+// New line
 const x = 1;
+const y = 2;`;

      mockOctokit.pulls.get.mockResolvedValue({ data: mockDiff });

      const result = await service.getPullRequestDiff(repository, 123);

      expect(result).toBe(mockDiff);
      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        pull_number: 123,
        mediaType: { format: "diff" },
      });
    });
  });

  describe("postComment", () => {
    it("should post comment successfully", async () => {
      const mockComment = {
        id: 456,
        html_url: "https://github.com/test-owner/test-repo/pull/123#issuecomment-456",
      };

      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: "bot-user" },
      });

      mockOctokit.issues.listComments.mockResolvedValue({ data: [] });

      mockOctokit.issues.createComment.mockResolvedValue({ data: mockComment });

      const result = await service.postComment({
        repository,
        prNumber: 123,
        body: "Test comment",
        collapsePrevious: false,
      });

      expect(result).toEqual({
        id: 456,
        url: "https://github.com/test-owner/test-repo/pull/123#issuecomment-456",
      });

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        issue_number: 123,
        body: "Test comment",
      });
    });

    it("should collapse previous bot comments when requested", async () => {
      const oldComment = {
        id: 111,
        user: { login: "bot-user" },
        body: "# 🔍 Code Review Analysis\n\nOld analysis...",
      };

      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: "bot-user" },
      });

      mockOctokit.issues.listComments.mockResolvedValue({ data: [oldComment] });
      mockOctokit.issues.updateComment.mockResolvedValue({ data: {} });
      mockOctokit.issues.createComment.mockResolvedValue({
        data: { id: 456, html_url: "https://github.com/..." },
      });

      await service.postComment({
        repository,
        prNumber: 123,
        body: "New comment",
        collapsePrevious: true,
      });

      expect(mockOctokit.issues.updateComment).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "test-owner",
          repo: "test-repo",
          comment_id: 111,
        })
      );
    });
  });

  describe("updateComment", () => {
    it("should update comment successfully", async () => {
      mockOctokit.issues.updateComment.mockResolvedValue({ data: {} });

      await service.updateComment(repository, 456, "Updated comment");

      expect(mockOctokit.issues.updateComment).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        comment_id: 456,
        body: "Updated comment",
      });
    });
  });

  describe("hasWriteAccess", () => {
    it("should return true for admin permission", async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: "test-user" },
      });

      mockOctokit.repos.getCollaboratorPermissionLevel.mockResolvedValue({
        data: { permission: "admin" },
      });

      const result = await service.hasWriteAccess(repository);

      expect(result).toBe(true);
    });

    it("should return true for write permission", async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: "test-user" },
      });

      mockOctokit.repos.getCollaboratorPermissionLevel.mockResolvedValue({
        data: { permission: "write" },
      });

      const result = await service.hasWriteAccess(repository);

      expect(result).toBe(true);
    });

    it("should return false for read permission", async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: "test-user" },
      });

      mockOctokit.repos.getCollaboratorPermissionLevel.mockResolvedValue({
        data: { permission: "read" },
      });

      const result = await service.hasWriteAccess(repository);

      expect(result).toBe(false);
    });

    it("should return false on error", async () => {
      mockOctokit.users.getAuthenticated.mockRejectedValue(new Error("Unauthorized"));

      const result = await service.hasWriteAccess(repository);

      expect(result).toBe(false);
    });
  });

  describe("validateConnection", () => {
    it("should validate connection successfully", async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: "test-user" },
      });

      const result = await service.validateConnection();

      expect(result).toEqual({
        valid: true,
        user: "test-user",
      });
    });

    it("should handle invalid token", async () => {
      mockOctokit.users.getAuthenticated.mockRejectedValue(new Error("Bad credentials"));

      const result = await service.validateConnection();

      expect(result).toEqual({
        valid: false,
        error: "Bad credentials",
      });
    });
  });
});
