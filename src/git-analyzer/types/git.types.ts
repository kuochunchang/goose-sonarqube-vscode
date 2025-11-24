/**
 * Git-related type definitions
 */

/**
 * Types of Git changes that can be analyzed
 */
export type GitChangeType = 'working-directory' | 'branch-comparison' | 'pull-request';

/**
 * Git file change status
 */
export type GitFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked';

/**
 * Represents a single file change
 */
export interface GitFileChange {
  /** File path relative to repository root */
  path: string;
  /** Change status */
  status: GitFileStatus;
  /** Old path (for renamed files) */
  oldPath?: string;
  /** Lines added in this file */
  linesAdded: number;
  /** Lines deleted in this file */
  linesDeleted: number;
}

/**
 * Summary of changes
 */
export interface GitChangeSummary {
  /** Total files changed */
  filesChanged: number;
  /** Total insertions across all files */
  insertions: number;
  /** Total deletions across all files */
  deletions: number;
}

/**
 * Git commit information
 */
export interface GitCommit {
  /** Commit SHA */
  sha: string;
  /** Commit message */
  message: string;
  /** Author name */
  author: string;
  /** Author email */
  email: string;
  /** Commit date */
  date: string;
}

/**
 * A diff hunk (continuous block of changes)
 */
export interface DiffHunk {
  /** Starting line in old file */
  oldStart: number;
  /** Number of lines in old file */
  oldLines: number;
  /** Starting line in new file */
  newStart: number;
  /** Number of lines in new file */
  newLines: number;
  /** Hunk header */
  header: string;
  /** Changed lines (with +/- prefix) */
  lines: string[];
}

/**
 * Diff for a single file
 */
export interface FileDiff {
  /** File path */
  path: string;
  /** Old file path (for renames) */
  oldPath?: string;
  /** Change status */
  status: GitFileStatus;
  /** Old file content */
  oldContent: string;
  /** New file content */
  newContent: string;
  /** Diff hunks */
  hunks: DiffHunk[];
  /** Is binary file */
  isBinary: boolean;
}

/**
 * Base interface for Git changes
 */
export interface GitChangesBase {
  /** Type of change */
  type: GitChangeType;
  /** Changed files */
  files: GitFileChange[];
  /** Full diff text */
  diff: string;
  /** Change summary */
  summary: GitChangeSummary;
}

/**
 * Working directory changes (unstaged + staged)
 */
export interface WorkingDirectoryChanges extends GitChangesBase {
  type: 'working-directory';
}

/**
 * Branch comparison changes
 */
export interface BranchComparisonChanges extends GitChangesBase {
  type: 'branch-comparison';
  /** Base branch name */
  baseBranch: string;
  /** Compare branch name */
  compareBranch: string;
  /** Commits in compare branch (not in base) */
  commits: GitCommit[];
}

/**
 * Pull request changes
 */
export interface PullRequestChanges extends GitChangesBase {
  type: 'pull-request';
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR description */
  description: string;
  /** PR author */
  author: string;
  /** Base branch */
  baseBranch: string;
  /** Head branch */
  headBranch: string;
  /** Commits in this PR */
  commits: GitCommit[];
}

/**
 * Union type of all Git changes
 */
export type GitChanges = WorkingDirectoryChanges | BranchComparisonChanges | PullRequestChanges;
