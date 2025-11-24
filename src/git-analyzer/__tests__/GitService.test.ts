import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitService } from '../services/GitService.js';
import type { SimpleGit, StatusResult, LogResult } from 'simple-git';

// Mock simple-git
vi.mock('simple-git', () => ({
  default: vi.fn(() => mockGit),
}));

// Mock Git instance
const mockGit: Partial<SimpleGit> = {
  status: vi.fn(),
  diff: vi.fn(),
  diffSummary: vi.fn(),
  log: vi.fn(),
  show: vi.fn(),
  revparse: vi.fn(),
  branch: vi.fn(),
};

describe('GitService', () => {
  let gitService: GitService;

  beforeEach(() => {
    gitService = new GitService('/test/repo');
    vi.clearAllMocks();
  });

  describe('getWorkingDirectoryChanges', () => {
    it('should return working directory changes', async () => {
      // Mock status
      (mockGit.status as any).mockResolvedValue({
        files: [
          { path: 'src/file1.ts', index: 'M', working_dir: ' ' },
          { path: 'src/file2.ts', index: 'A', working_dir: ' ' },
        ],
        isClean: () => false,
      } as StatusResult);

      // Mock diff
      (mockGit.diff as any)
        .mockResolvedValueOnce('diff for staged')
        .mockResolvedValueOnce('diff for unstaged');

      // Mock diffSummary
      (mockGit.diffSummary as any).mockResolvedValue({
        changed: 2,
        insertions: 10,
        deletions: 5,
        files: [
          { file: 'src/file1.ts', changes: 8, insertions: 5, deletions: 3, binary: false },
          { file: 'src/file2.ts', changes: 7, insertions: 5, deletions: 2, binary: false },
        ],
      });

      const result = await gitService.getWorkingDirectoryChanges();

      expect(result.type).toBe('working-directory');
      expect(result.files).toHaveLength(2);
      expect(result.files[0].path).toBe('src/file1.ts');
      expect(result.files[0].status).toBe('modified');
      expect(result.files[0].linesAdded).toBe(5);
      expect(result.files[0].linesDeleted).toBe(3);
      expect(result.summary.filesChanged).toBe(2);
      expect(result.summary.insertions).toBe(10);
      expect(result.summary.deletions).toBe(5);
    });

    it('should handle empty working directory', async () => {
      (mockGit.status as any).mockResolvedValue({
        files: [],
        isClean: () => true,
      } as StatusResult);

      (mockGit.diff as any).mockResolvedValue('');

      (mockGit.diffSummary as any).mockResolvedValue({
        changed: 0,
        insertions: 0,
        deletions: 0,
        files: [],
      });

      const result = await gitService.getWorkingDirectoryChanges();

      expect(result.type).toBe('working-directory');
      expect(result.files).toHaveLength(0);
      expect(result.summary.filesChanged).toBe(0);
    });

    it('should handle binary files', async () => {
      (mockGit.status as any).mockResolvedValue({
        files: [{ path: 'image.png', index: 'M', working_dir: ' ' }],
        isClean: () => false,
      } as StatusResult);

      (mockGit.diff as any).mockResolvedValue('Binary files differ');

      (mockGit.diffSummary as any).mockResolvedValue({
        changed: 1,
        insertions: 0,
        deletions: 0,
        files: [{ file: 'image.png', changes: 0, binary: true }],
      });

      const result = await gitService.getWorkingDirectoryChanges();

      expect(result.files).toHaveLength(1);
      expect(result.files[0].linesAdded).toBe(0);
      expect(result.files[0].linesDeleted).toBe(0);
    });
  });

  describe('compareBranches', () => {
    it('should compare two branches successfully', async () => {
      // Mock branch list
      (mockGit.branch as any).mockResolvedValue({
        all: ['main', 'feature/test', 'origin/main'],
      });

      // Mock diff
      (mockGit.diff as any).mockResolvedValue('diff content here');

      // Mock diffSummary
      (mockGit.diffSummary as any).mockResolvedValue({
        changed: 3,
        insertions: 20,
        deletions: 10,
        files: [
          { file: 'src/feature.ts', changes: 15, insertions: 10, deletions: 5, binary: false },
          { file: 'src/utils.ts', changes: 10, insertions: 8, deletions: 2, binary: false },
          { file: 'README.md', changes: 5, insertions: 2, deletions: 3, binary: false },
        ],
      });

      // Mock log
      (mockGit.log as any).mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            message: 'feat: add feature',
            author_name: 'Test User',
            author_email: 'test@example.com',
            date: '2024-01-01',
          },
          {
            hash: 'def456',
            message: 'fix: bug fix',
            author_name: 'Test User',
            author_email: 'test@example.com',
            date: '2024-01-02',
          },
        ],
      } as LogResult);

      const result = await gitService.compareBranches('main', 'feature/test');

      expect(result.type).toBe('branch-comparison');
      expect(result.baseBranch).toBe('main');
      expect(result.compareBranch).toBe('feature/test');
      expect(result.files).toHaveLength(3);
      expect(result.commits).toHaveLength(2);
      expect(result.commits[0].sha).toBe('abc123');
      expect(result.commits[0].message).toBe('feat: add feature');
      expect(result.summary.filesChanged).toBe(3);
      expect(result.summary.insertions).toBe(20);
      expect(result.summary.deletions).toBe(10);
    });

    it('should throw error if base branch does not exist', async () => {
      (mockGit.branch as any).mockResolvedValue({
        all: ['main', 'feature/test'],
      });

      await expect(gitService.compareBranches('nonexistent', 'main')).rejects.toThrow(
        'Base branch "nonexistent" not found'
      );
    });

    it('should throw error if compare branch does not exist', async () => {
      (mockGit.branch as any).mockResolvedValue({
        all: ['main', 'feature/test'],
      });

      await expect(gitService.compareBranches('main', 'nonexistent')).rejects.toThrow(
        'Compare branch "nonexistent" not found'
      );
    });
  });

  describe('parseDiff', () => {
    it('should parse simple diff correctly', async () => {
      const diff = `diff --git a/src/file.ts b/src/file.ts
index abc123..def456 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,4 @@
+import { newImport } from 'lib';
 function hello() {
   console.log('hello');
-  return 'old';
+  return 'new';
 }`;

      const result = await gitService.parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/file.ts');
      expect(result[0].status).toBe('modified');
      expect(result[0].hunks).toHaveLength(1);
      expect(result[0].hunks[0].oldStart).toBe(1);
      expect(result[0].hunks[0].oldLines).toBe(3);
      expect(result[0].hunks[0].newStart).toBe(1);
      expect(result[0].hunks[0].newLines).toBe(4);
    });

    it('should detect new files', async () => {
      const diff = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,3 @@
+export function newFunc() {
+  return 'new';
+}`;

      const result = await gitService.parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/new.ts');
      expect(result[0].status).toBe('added');
    });

    it('should detect deleted files', async () => {
      const diff = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index abc123..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function oldFunc() {
-  return 'old';
-}`;

      const result = await gitService.parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/old.ts');
      expect(result[0].status).toBe('deleted');
    });

    it('should detect renamed files', async () => {
      const diff = `diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 100%
rename from src/old-name.ts
rename to src/new-name.ts`;

      const result = await gitService.parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/new-name.ts');
      expect(result[0].oldPath).toBe('src/old-name.ts');
      expect(result[0].status).toBe('renamed');
    });

    it('should detect binary files', async () => {
      const diff = `diff --git a/image.png b/image.png
index abc123..def456 100644
Binary files a/image.png and b/image.png differ`;

      const result = await gitService.parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('image.png');
      expect(result[0].isBinary).toBe(true);
    });

    it('should return empty array for empty diff', async () => {
      const result = await gitService.parseDiff('');
      expect(result).toHaveLength(0);
    });

    it('should parse multiple files', async () => {
      const diff = `diff --git a/src/file1.ts b/src/file1.ts
index abc123..def456 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,2 +1,2 @@
-old line
+new line
 unchanged

diff --git a/src/file2.ts b/src/file2.ts
index 111222..333444 100644
--- a/src/file2.ts
+++ b/src/file2.ts
@@ -5,3 +5,3 @@
 function test() {
-  return 'old';
+  return 'new';
 }`;

      const result = await gitService.parseDiff(diff);

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('src/file1.ts');
      expect(result[1].path).toBe('src/file2.ts');
    });
  });

  describe('getFileAtCommit', () => {
    it('should get file content at commit', async () => {
      (mockGit.show as any).mockResolvedValue('file content at commit abc123');

      const result = await gitService.getFileAtCommit('src/file.ts', 'abc123');

      expect(result).toBe('file content at commit abc123');
      expect(mockGit.show).toHaveBeenCalledWith(['abc123:src/file.ts']);
    });

    it('should return empty string if file does not exist at commit', async () => {
      (mockGit.show as any).mockRejectedValue(new Error('File not found'));

      const result = await gitService.getFileAtCommit('src/nonexistent.ts', 'abc123');

      expect(result).toBe('');
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      (mockGit.revparse as any).mockResolvedValue('feature/test\n');

      const result = await gitService.getCurrentBranch();

      expect(result).toBe('feature/test');
      expect(mockGit.revparse).toHaveBeenCalledWith(['--abbrev-ref', 'HEAD']);
    });
  });

  describe('isClean', () => {
    it('should return true for clean repository', async () => {
      (mockGit.status as any).mockResolvedValue({
        files: [],
        isClean: () => true,
      } as StatusResult);

      const result = await gitService.isClean();

      expect(result).toBe(true);
    });

    it('should return false for dirty repository', async () => {
      (mockGit.status as any).mockResolvedValue({
        files: [{ path: 'modified.ts', index: 'M', working_dir: ' ' }],
        isClean: () => false,
      } as StatusResult);

      const result = await gitService.isClean();

      expect(result).toBe(false);
    });
  });

  describe('getRepoRoot', () => {
    it('should return repository root path', async () => {
      (mockGit.revparse as any).mockResolvedValue('/test/repo\n');

      const result = await gitService.getRepoRoot();

      expect(result).toBe('/test/repo');
      expect(mockGit.revparse).toHaveBeenCalledWith(['--show-toplevel']);
    });
  });
});
