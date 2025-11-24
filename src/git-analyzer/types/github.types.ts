/**
 * GitHub-related type definitions for Pull Request analysis
 */

/**
 * GitHub Pull Request information
 */
export interface GitHubPullRequest {
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR description/body */
  body: string | null;
  /** Source branch (head) */
  head: {
    ref: string;
    sha: string;
  };
  /** Target branch (base) */
  base: {
    ref: string;
    sha: string;
  };
  /** PR state */
  state: "open" | "closed";
  /** PR author */
  user: {
    login: string;
  };
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * GitHub PR file change information
 */
export interface GitHubPRFile {
  /** File path */
  filename: string;
  /** Change status */
  status: "added" | "removed" | "modified" | "renamed";
  /** Number of additions */
  additions: number;
  /** Number of deletions */
  deletions: number;
  /** Number of changes */
  changes: number;
  /** Raw patch/diff */
  patch?: string;
  /** Previous filename (for renames) */
  previous_filename?: string;
}

/**
 * GitHub repository information
 */
export interface GitHubRepository {
  /** Owner/organization name */
  owner: string;
  /** Repository name */
  repo: string;
}

/**
 * GitHub API authentication configuration
 */
export interface GitHubConfig {
  /** GitHub personal access token */
  token: string;
  /** GitHub Enterprise base URL (optional, defaults to github.com) */
  baseUrl?: string;
}

/**
 * GitHub PR analysis request
 */
export interface PRAnalysisRequest {
  /** Repository information */
  repository: GitHubRepository;
  /** PR number */
  prNumber: number;
  /** Analysis types to perform */
  analysisTypes?: Array<"quality" | "security" | "impact" | "architecture">;
  /** Whether to post result as comment */
  postComment?: boolean;
  /** Comment format */
  commentFormat?: "markdown" | "html";
}

/**
 * GitHub PR comment options
 */
export interface PRCommentOptions {
  /** Repository information */
  repository: GitHubRepository;
  /** PR number */
  prNumber: number;
  /** Comment body (markdown) */
  body: string;
  /** Whether to collapse previous bot comments */
  collapsePrevious?: boolean;
}

/**
 * GitHub PR analysis result with metadata
 */
export interface PRAnalysisResult {
  /** PR metadata */
  pullRequest: GitHubPullRequest;
  /** Analysis result */
  analysis: {
    /** Total issues found */
    totalIssues: number;
    /** Files analyzed */
    filesAnalyzed: number;
    /** Quality score (0-100) */
    qualityScore: number;
    /** Risk level */
    riskLevel: "critical" | "high" | "medium" | "low";
    /** Detailed issues */
    issues: Array<{
      file: string;
      line: number;
      severity: "critical" | "high" | "medium" | "low";
      type: string;
      message: string;
      source: "sonarqube" | "ai";
    }>;
  };
  /** Comment ID (if posted) */
  commentId?: number;
  /** Comment URL (if posted) */
  commentUrl?: string;
}
