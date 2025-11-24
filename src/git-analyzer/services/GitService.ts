/**
 * GitService - Git operations wrapper using simple-git
 */

import simpleGit, { LogResult, SimpleGit, StatusResult } from 'simple-git';
import type {
  BranchComparisonChanges,
  DiffHunk,
  FileDiff,
  GitChangeSummary,
  GitCommit,
  GitFileChange,
  GitFileStatus,
  WorkingDirectoryChanges,
} from '../types/index.js';

export class GitService {
  private git: SimpleGit;

  constructor(private repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  /**
   * Get the root directory of the git repository
   */
  async getGitRoot(): Promise<string> {
    const root = await this.git.revparse(['--show-toplevel']);
    return root.trim();
  }

  /**
   * Get working directory changes (unstaged + staged)
   */
  async getWorkingDirectoryChanges(): Promise<WorkingDirectoryChanges> {
    // Get status
    const status: StatusResult = await this.git.status();

    // Get diff (unstaged changes)
    const unstagedDiff = await this.git.diff();

    // Get diff (staged changes)
    const stagedDiff = await this.git.diff(['--cached']);

    // Combine diffs
    const fullDiff = [stagedDiff, unstagedDiff].filter(Boolean).join('\n\n');

    // Get diff summary
    const diffSummary = await this.git.diffSummary();

    // Parse files
    const files: GitFileChange[] = status.files.map(file => ({
      path: file.path,
      status: this.mapFileStatus(file.index || file.working_dir),
      linesAdded: 0, // Will be calculated from diffSummary
      linesDeleted: 0,
    }));

    // Enhance file info with diff statistics
    diffSummary.files.forEach(diffFile => {
      const fileChange = files.find(f => f.path === diffFile.file);
      if (fileChange && 'insertions' in diffFile && 'deletions' in diffFile) {
        fileChange.linesAdded = diffFile.insertions;
        fileChange.linesDeleted = diffFile.deletions;
      }
    });

    const summary: GitChangeSummary = {
      filesChanged: diffSummary.changed,
      insertions: diffSummary.insertions,
      deletions: diffSummary.deletions,
    };

    return {
      type: 'working-directory',
      files,
      diff: fullDiff,
      summary,
    };
  }

  /**
   * Compare two branches
   */
  async compareBranches(
    baseBranch: string,
    compareBranch: string
  ): Promise<BranchComparisonChanges> {
    // Ensure branches exist
    const branches = await this.git.branch();
    if (!branches.all.includes(baseBranch)) {
      throw new Error(`Base branch "${baseBranch}" not found`);
    }
    if (!branches.all.includes(compareBranch)) {
      throw new Error(`Compare branch "${compareBranch}" not found`);
    }

    // Get diff between branches (three-dot syntax shows changes in compareBranch since it diverged from baseBranch)
    const diff = await this.git.diff([`${baseBranch}...${compareBranch}`]);

    // Get diff summary
    const diffSummary = await this.git.diffSummary([`${baseBranch}...${compareBranch}`]);

    // Get commits in compareBranch (not in baseBranch)
    const log: LogResult = await this.git.log({
      from: baseBranch,
      to: compareBranch,
    });

    // Parse files
    const files: GitFileChange[] = diffSummary.files.map(file => ({
      path: file.file,
      status: this.inferFileStatus('binary' in file ? file.binary : false),
      linesAdded: 'insertions' in file ? file.insertions : 0,
      linesDeleted: 'deletions' in file ? file.deletions : 0,
    }));

    // Parse commits
    const commits: GitCommit[] = log.all.map(commit => ({
      sha: commit.hash,
      message: commit.message,
      author: commit.author_name,
      email: commit.author_email,
      date: commit.date,
    }));

    const summary: GitChangeSummary = {
      filesChanged: diffSummary.changed,
      insertions: diffSummary.insertions,
      deletions: diffSummary.deletions,
    };

    return {
      type: 'branch-comparison',
      baseBranch,
      compareBranch,
      files,
      diff,
      commits,
      summary,
    };
  }

  /**
   * Parse diff text into structured FileDiff objects
   */
  async parseDiff(diff: string): Promise<FileDiff[]> {
    if (!diff || diff.trim().length === 0) {
      return [];
    }

    const lines = diff.split('\n');
    const fileDiffs: FileDiff[] = [];
    let currentFile: FileDiff | null = null;
    let currentHunk: DiffHunk | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Start of new file diff
      if (line.startsWith('diff --git')) {
        // Save previous file if exists
        if (currentFile && currentHunk) {
          currentFile.hunks.push(currentHunk);
          currentHunk = null;
        }
        if (currentFile) {
          fileDiffs.push(currentFile);
        }

        // Parse file paths: diff --git a/path/to/file.ts b/path/to/file.ts
        const match = line.match(/diff --git a\/(.*?) b\/(.*)/);
        if (match) {
          const oldPath = match[1];
          const newPath = match[2];

          currentFile = {
            path: newPath,
            oldPath: oldPath !== newPath ? oldPath : undefined,
            status: oldPath !== newPath ? 'renamed' : 'modified',
            oldContent: '',
            newContent: '',
            hunks: [],
            isBinary: false,
          };
        }
      }

      // Binary file detection
      if (line.includes('Binary files') && currentFile) {
        currentFile.isBinary = true;
      }

      // New file
      if (line.startsWith('new file mode') && currentFile) {
        currentFile.status = 'added';
      }

      // Deleted file
      if (line.startsWith('deleted file mode') && currentFile) {
        currentFile.status = 'deleted';
      }

      // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@ context
      if (line.startsWith('@@') && currentFile) {
        // Save previous hunk
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
        }

        const hunkMatch = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@(.*)/);
        if (hunkMatch) {
          currentHunk = {
            oldStart: parseInt(hunkMatch[1], 10),
            oldLines: parseInt(hunkMatch[2] || '1', 10),
            newStart: parseInt(hunkMatch[3], 10),
            newLines: parseInt(hunkMatch[4] || '1', 10),
            header: hunkMatch[5]?.trim() || '',
            lines: [],
          };
        }
      }

      // Hunk content lines (must start with +, -, or space)
      if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
        currentHunk.lines.push(line);
      }
    }

    // Save last hunk and file
    if (currentFile && currentHunk) {
      currentFile.hunks.push(currentHunk);
    }
    if (currentFile) {
      fileDiffs.push(currentFile);
    }

    return fileDiffs;
  }

  /**
   * Get file content at a specific commit
   */
  async getFileAtCommit(filePath: string, commit: string): Promise<string> {
    try {
      return await this.git.show([`${commit}:${filePath}`]);
    } catch (error) {
      // File might not exist at this commit
      return '';
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  }

  /**
   * Check if repository is clean (no changes)
   */
  async isClean(): Promise<boolean> {
    const status = await this.git.status();
    return status.isClean();
  }

  /**
   * Get repository root path
   */
  async getRepoRoot(): Promise<string> {
    const root = await this.git.revparse(['--show-toplevel']);
    return root.trim();
  }

  /**
   * Get list of all branches
   */
  async getBranches(): Promise<{ all: string[]; current: string; local: string[]; remote: string[] }> {
    const branchSummary = await this.git.branch(['-a']);
    const currentBranch = await this.getCurrentBranch();

    return {
      all: branchSummary.all,
      current: currentBranch,
      local: branchSummary.branches
        ? Object.keys(branchSummary.branches).filter(b => !b.startsWith('remotes/'))
        : [],
      remote: branchSummary.branches
        ? Object.keys(branchSummary.branches)
          .filter(b => b.startsWith('remotes/'))
          .map(b => b.replace(/^remotes\//, ''))
        : [],
    };
  }

  /**
   * Map git status character to GitFileStatus
   */
  private mapFileStatus(status: string): GitFileStatus {
    switch (status) {
      case 'A':
      case '?':
        return 'added';
      case 'M':
        return 'modified';
      case 'D':
        return 'deleted';
      case 'R':
        return 'renamed';
      case 'C':
        return 'copied';
      default:
        return 'modified';
    }
  }

  /**
   * Infer file status from diff summary
   */
  private inferFileStatus(_isBinary: boolean): GitFileStatus {
    // Simple inference - could be enhanced
    return 'modified';
  }
}
