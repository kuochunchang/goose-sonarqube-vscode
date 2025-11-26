/**
 * GitHubService - GitHub Pull Request integration service
 *
 * Provides:
 * - PR metadata retrieval
 * - PR file changes analysis
 * - Automated comment posting
 * - Comment collapsing (hiding previous bot comments)
 */

// @ts-ignore
import { Octokit } from '@octokit/rest';
import type {
  GitHubConfig,
  GitHubPullRequest,
  GitHubPRFile,
  GitHubRepository,
  PRCommentOptions,
} from '../types/github.types.js';

export class GitHubService {
  private readonly octokit: Octokit;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({
      auth: config.token,
      baseUrl: config.baseUrl || 'https://api.github.com',
    });
  }

  /**
   * Get Pull Request metadata
   */
  async getPullRequest(repository: GitHubRepository, prNumber: number): Promise<GitHubPullRequest> {
    try {
      const { data } = await this.octokit.pulls.get({
        owner: repository.owner,
        repo: repository.repo,
        pull_number: prNumber,
      });

      return {
        number: data.number,
        title: data.title,
        body: data.body,
        head: {
          ref: data.head.ref,
          sha: data.head.sha,
        },
        base: {
          ref: data.base.ref,
          sha: data.base.sha,
        },
        state: data.state as 'open' | 'closed',
        user: {
          login: data.user?.login || 'unknown',
        },
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch PR #${prNumber}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get list of files changed in a Pull Request
   */
  async getPullRequestFiles(
    repository: GitHubRepository,
    prNumber: number
  ): Promise<GitHubPRFile[]> {
    try {
      const files: GitHubPRFile[] = [];
      let page = 1;
      const perPage = 100;

      // Paginate through all files (GitHub limits to 100 per page)

      while (true) {
        const { data } = await this.octokit.pulls.listFiles({
          owner: repository.owner,
          repo: repository.repo,
          pull_number: prNumber,
          per_page: perPage,
          page,
        });

        if (data.length === 0) {
          break;
        }

        files.push(
          ...data.map((file) => ({
            filename: file.filename,
            status: file.status as 'added' | 'removed' | 'modified' | 'renamed',
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch,
            previous_filename: file.previous_filename,
          }))
        );

        if (data.length < perPage) {
          break;
        }

        page++;
      }

      return files;
    } catch (error) {
      throw new Error(
        `Failed to fetch PR #${prNumber} files: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get PR diff (unified diff format)
   */
  async getPullRequestDiff(repository: GitHubRepository, prNumber: number): Promise<string> {
    try {
      const { data } = await this.octokit.pulls.get({
        owner: repository.owner,
        repo: repository.repo,
        pull_number: prNumber,
        mediaType: {
          format: 'diff',
        },
      });

      return data as unknown as string;
    } catch (error) {
      throw new Error(
        `Failed to fetch PR #${prNumber} diff: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Post a comment on a Pull Request
   */
  async postComment(options: PRCommentOptions): Promise<{ id: number; url: string }> {
    try {
      // Collapse previous bot comments if requested
      if (options.collapsePrevious) {
        await this.collapsePreviousBotComments(options.repository, options.prNumber);
      }

      const { data } = await this.octokit.issues.createComment({
        owner: options.repository.owner,
        repo: options.repository.repo,
        issue_number: options.prNumber,
        body: options.body,
      });

      return {
        id: data.id,
        url: data.html_url,
      };
    } catch (error) {
      throw new Error(
        `Failed to post comment on PR #${options.prNumber}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update an existing comment
   */
  async updateComment(
    repository: GitHubRepository,
    commentId: number,
    body: string
  ): Promise<void> {
    try {
      await this.octokit.issues.updateComment({
        owner: repository.owner,
        repo: repository.repo,
        comment_id: commentId,
        body,
      });
    } catch (error) {
      throw new Error(
        `Failed to update comment #${commentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Collapse previous bot comments by adding a summary and hiding details
   */
  private async collapsePreviousBotComments(
    repository: GitHubRepository,
    prNumber: number
  ): Promise<void> {
    try {
      // Get current authenticated user
      const { data: user } = await this.octokit.users.getAuthenticated();
      const botLogin = user.login;

      // Get all comments on the PR
      const { data: comments } = await this.octokit.issues.listComments({
        owner: repository.owner,
        repo: repository.repo,
        issue_number: prNumber,
      });

      // Filter bot's comments that contain analysis results
      const botComments = comments.filter(
        (comment) =>
          comment.user?.login === botLogin &&
          comment.body?.includes('# 🔍 Code Review Analysis') &&
          !comment.body?.includes('<!-- collapsed -->')
      );

      // Collapse each previous comment
      for (const comment of botComments) {
        if (!comment.body) continue;

        const collapsedBody = this.createCollapsedComment(comment.body);
        await this.updateComment(repository, comment.id, collapsedBody);
      }
    } catch (error) {
      // Non-critical error, just log and continue
      console.warn('Failed to collapse previous comments:', error);
    }
  }

  /**
   * Create a collapsed version of a comment
   */
  private createCollapsedComment(originalBody: string): string {
    // Extract summary info from original comment
    const lines = originalBody.split('\n');
    const summaryLines = lines.slice(0, 5); // First 5 lines (title + summary)

    return `${summaryLines.join('\n')}

<!-- collapsed -->

<details>
<summary>📜 View full analysis (outdated)</summary>

${originalBody}

</details>

> ⚠️ This analysis has been superseded by a newer version below.
`;
  }

  /**
   * Check if user has write access to repository (for comment posting)
   */
  async hasWriteAccess(repository: GitHubRepository): Promise<boolean> {
    try {
      const { data: user } = await this.octokit.users.getAuthenticated();
      const { data: permission } = await this.octokit.repos.getCollaboratorPermissionLevel({
        owner: repository.owner,
        repo: repository.repo,
        username: user.login,
      });

      return ['admin', 'write'].includes(permission.permission);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate GitHub token and connectivity
   */
  async validateConnection(): Promise<{ valid: boolean; user?: string; error?: string }> {
    try {
      const { data: user } = await this.octokit.users.getAuthenticated();
      return {
        valid: true,
        user: user.login,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
