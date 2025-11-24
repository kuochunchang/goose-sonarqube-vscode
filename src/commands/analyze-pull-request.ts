/**
 * Analyze Pull Request Command
 * Analyzes GitHub pull requests with AI and SonarQube
 */

import * as vscode from 'vscode';
import type { GitAnalysisService } from '../services/git-analysis-service.js';
import {
    executeAnalysisWithProgress,
    getWorkspaceFolder,
    handleAnalysisError,
    selectAnalysisTypes,
    showAnalyzingPanel,
    showCompletionMessage,
    updatePanelWithResults,
} from '../utils/git-analysis-helpers.js';

/**
 * GitHub Pull Request (minimal type for PR list)
 */
interface GitHubPullRequest {
    number: number;
    title: string;
    head: { ref: string };
    base: { ref: string };
    user: { login: string };
}

/**
 * Analyze Pull Request
 */
export async function analyzePullRequest(
    context: vscode.ExtensionContext,
    gitAnalysisService: GitAnalysisService
): Promise<void> {
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        return;
    }

    const workingDirectory = workspaceFolder.uri.fsPath;

    try {
        // Step 1: Try to auto-detect GitHub repository
        let repository = await gitAnalysisService.getGitHubRepository(workingDirectory);

        // Step 2: Prompt for repository if not detected
        if (!repository) {
            const repoInput = await vscode.window.showInputBox({
                prompt: 'Enter GitHub repository (format: owner/repo)',
                placeHolder: 'e.g., microsoft/vscode',
                validateInput: (value) => {
                    if (!value || !value.match(/^[\w-]+\/[\w-]+$/)) {
                        return 'Invalid format. Please use: owner/repo';
                    }
                    return null;
                },
            });

            if (!repoInput) {
                return; // User cancelled
            }

            const [owner, repo] = repoInput.split('/');
            repository = { owner, repo };
        } else {
            // Let user confirm or override detected repository
            const confirm = await vscode.window.showQuickPick(
                [
                    {
                        label: `$(check) Use detected repository: ${repository.owner}/${repository.repo}`,
                        value: 'use',
                    },
                    {
                        label: '$(edit) Enter different repository',
                        value: 'change',
                    },
                ],
                {
                    placeHolder: 'Confirm GitHub repository',
                }
            );

            if (!confirm) {
                return; // User cancelled
            }

            if (confirm.value === 'change') {
                const repoInput = await vscode.window.showInputBox({
                    prompt: 'Enter GitHub repository (format: owner/repo)',
                    placeHolder: 'e.g., microsoft/vscode',
                    value: `${repository.owner}/${repository.repo}`,
                    validateInput: (value) => {
                        if (!value || !value.match(/^[\w-]+\/[\w-]+$/)) {
                            return 'Invalid format. Please use: owner/repo';
                        }
                        return null;
                    },
                });

                if (!repoInput) {
                    return; // User cancelled
                }

                const [owner, repo] = repoInput.split('/');
                repository = { owner, repo };
            }
        }

        // Step 3: Get GitHub token first (needed for API calls)
        let githubToken = await context.secrets.get('gooseCodeReview.githubToken');

        if (!githubToken) {
            // Try to get token from gh CLI
            const ghTokenResult = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Checking GitHub authentication...',
                },
                async () => {
                    try {
                        const { execFile } = await import('child_process');
                        const { promisify } = await import('util');
                        const execFilePromise = promisify(execFile);
                        const { stdout } = await execFilePromise('gh', ['auth', 'token']);
                        return stdout.trim();
                    } catch (error) {
                        return null;
                    }
                }
            );

            if (ghTokenResult) {
                await context.secrets.store('gooseCodeReview.githubToken', ghTokenResult);
                githubToken = ghTokenResult;
            } else {
                // Prompt user to enter GitHub token
                const tokenInput = await vscode.window.showInputBox({
                    prompt: 'Enter your GitHub Personal Access Token (按 \'Enter\' 鍵確認或按 \'Esc\' 鍵取消)',
                    placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                    password: true,
                    ignoreFocusOut: true,
                    validateInput: (value) => {
                        if (!value || value.length < 10) {
                            return 'Please enter a valid GitHub token';
                        }
                        return null;
                    },
                });

                if (!tokenInput) {
                    vscode.window.showErrorMessage(
                        'GitHub token is required for PR analysis. Please try again.'
                    );
                    return;
                }

                await context.secrets.store('gooseCodeReview.githubToken', tokenInput);
                githubToken = tokenInput;
            }
        }

        // Step 4: Fetch pull requests and let user select
        const prSelection = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Fetching pull requests...',
            },
            async () => {
                try {
                    // Fetch open PRs from GitHub API
                    const response = await fetch(
                        `https://api.github.com/repos/${repository.owner}/${repository.repo}/pulls?state=open&per_page=100`,
                        {
                            headers: {
                                Authorization: `Bearer ${githubToken}`,
                                Accept: 'application/vnd.github.v3+json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`GitHub API error: ${response.statusText}`);
                    }

                    const prs = await response.json();

                    if (!Array.isArray(prs) || prs.length === 0) {
                        vscode.window.showInformationMessage(
                            `No open pull requests found in ${repository.owner}/${repository.repo}`
                        );
                        return null;
                    }

                    // Try to detect current branch
                    let currentBranch: string | null = null;
                    try {
                        const { execFile } = await import('child_process');
                        const { promisify } = await import('util');
                        const execFilePromise = promisify(execFile);
                        const { stdout } = await execFilePromise('git', ['branch', '--show-current'], {
                            cwd: workingDirectory,
                        });
                        currentBranch = stdout.trim();
                    } catch (error) {
                        // Ignore error, continue without current branch detection
                    }

                    // Create quick pick items
                    const items = (prs as GitHubPullRequest[]).map((pr) => {
                        const isCurrentBranch = currentBranch && pr.head.ref === currentBranch;
                        return {
                            label: `${isCurrentBranch ? '$(git-branch) ' : ''}#${pr.number}: ${pr.title}`,
                            description: `by @${pr.user.login}`,
                            detail: `${pr.head.ref} → ${pr.base.ref}${isCurrentBranch ? ' (current branch)' : ''}`,
                            prNumber: pr.number,
                            prTitle: pr.title,
                            isCurrentBranch,
                        };
                    });

                    // Sort: current branch first, then by PR number descending
                    items.sort((a, b) => {
                        if (a.isCurrentBranch && !b.isCurrentBranch) return -1;
                        if (!a.isCurrentBranch && b.isCurrentBranch) return 1;
                        return b.prNumber - a.prNumber;
                    });

                    return items;
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to fetch pull requests: ${error instanceof Error ? error.message : String(error)}`
                    );
                    return null;
                }
            }
        );

        if (!prSelection || prSelection.length === 0) {
            return;
        }

        const selectedPR = await vscode.window.showQuickPick(prSelection, {
            placeHolder: 'Select a pull request to analyze',
            matchOnDescription: true,
            matchOnDetail: true,
        });

        if (!selectedPR) {
            return; // User cancelled
        }

        const prNumber = selectedPR.prNumber;
        const prTitle = selectedPR.prTitle;

        // Step 5: Select analysis types
        const analysisTypes = await selectAnalysisTypes(context);
        if (!analysisTypes) {
            return; // User cancelled
        }

        // Step 6: Show panel immediately
        showAnalyzingPanel(context.extensionUri, {
            changeSource: 'pull-request',
            workingDirectory,
            pullRequestNumber: prNumber,
            pullRequestTitle: prTitle,
            repository,
        });

        // Step 7: Execute PR analysis
        const result = await executeAnalysisWithProgress(
            `Pull Request #${prNumber} Analysis`,
            async (progressCallback) => {
                return gitAnalysisService.analyzePullRequest(
                    {
                        workingDirectory,
                        repository,
                        prNumber,
                        analysisTypes,
                        githubToken,
                    },
                    progressCallback
                );
            }
        );

        // Step 8: Update panel with results
        updatePanelWithResults(context.extensionUri, result, {
            changeSource: 'pull-request',
            workingDirectory,
            pullRequestNumber: prNumber,
            pullRequestTitle: prTitle,
            repository,
        });

        showCompletionMessage(result);
    } catch (error) {
        handleAnalysisError(
            error,
            'Pull request analysis failed',
            {
                changeSource: 'pull-request',
                workingDirectory,
            }
        );
    }
}
