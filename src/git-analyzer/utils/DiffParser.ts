/**
 * Diff parser utility for extracting and formatting Git diffs
 */

import type { GitFileChange, GitChanges } from '../types/git.types.js';

/**
 * Parsed file change with context
 */
export interface ParsedFileChange {
  /** File path */
  file: string;
  /** Change type */
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  /** Old file path (for renames) */
  oldPath?: string;
  /** Formatted diff content for this file */
  diff: string;
  /** Number of additions */
  additions: number;
  /** Number of deletions */
  deletions: number;
  /** File extension */
  extension: string;
  /** Estimated complexity (lines changed) */
  complexity: number;
}

/**
 * Diff formatting options
 */
export interface DiffFormatOptions {
  /** Include context lines (default: true) */
  includeContext?: boolean;
  /** Maximum context lines to include (default: 3) */
  maxContextLines?: number;
  /** Include file metadata (default: true) */
  includeMetadata?: boolean;
}

/**
 * Diff parser for processing Git diffs
 */
export class DiffParser {
  /**
   * Parse Git changes into structured format
   * @param changes - Git changes from GitService
   * @returns Array of parsed file changes
   */
  parseGitChanges(changes: GitChanges): ParsedFileChange[] {
    const fileDiffs = this.extractFileDiffs(changes.diff);

    return changes.files.map((fileChange) => {
      const fileDiff = fileDiffs.get(fileChange.path) || '';
      return this.parseFileChange(fileChange, fileDiff);
    });
  }

  /**
   * Extract individual file diffs from full diff text
   * @param fullDiff - Full diff text
   * @returns Map of file path to diff content
   */
  private extractFileDiffs(fullDiff: string): Map<string, string> {
    const fileDiffs = new Map<string, string>();

    if (!fullDiff || fullDiff.trim().length === 0) {
      return fileDiffs;
    }

    const lines = fullDiff.split('\n');
    let currentFile: string | null = null;
    let currentDiff: string[] = [];

    for (const line of lines) {
      // Match diff --git a/path b/path
      const diffMatch = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
      if (diffMatch) {
        // Save previous file's diff
        if (currentFile && currentDiff.length > 0) {
          fileDiffs.set(currentFile, currentDiff.join('\n'));
        }

        currentFile = diffMatch[2]; // Use the new path
        currentDiff = [line];
        continue;
      }

      // Match rename detection
      const renameMatch = line.match(/^rename from (.+)$/);
      if (renameMatch && currentFile) {
        currentDiff.push(line);
        continue;
      }

      if (currentFile) {
        currentDiff.push(line);
      }
    }

    // Save last file's diff
    if (currentFile && currentDiff.length > 0) {
      fileDiffs.set(currentFile, currentDiff.join('\n'));
    }

    return fileDiffs;
  }

  /**
   * Parse a single file change
   * @param fileChange - Git file change
   * @param fileDiff - Diff content for this file
   * @returns Parsed file change
   */
  private parseFileChange(fileChange: GitFileChange, fileDiff: string): ParsedFileChange {
    const changeType = this.detectChangeType(fileChange);
    const extension = this.extractExtension(fileChange.path);
    const complexity = fileChange.linesAdded + fileChange.linesDeleted;

    return {
      file: fileChange.path,
      changeType,
      oldPath: fileChange.oldPath,
      diff: fileDiff,
      additions: fileChange.linesAdded,
      deletions: fileChange.linesDeleted,
      extension,
      complexity,
    };
  }

  /**
   * Detect change type from file change
   * @param fileChange - Git file change
   * @returns Change type
   */
  private detectChangeType(
    fileChange: GitFileChange
  ): 'added' | 'modified' | 'deleted' | 'renamed' {
    if (fileChange.status === 'renamed') {
      return 'renamed';
    }
    if (fileChange.status === 'added' || fileChange.status === 'untracked') {
      return 'added';
    }
    if (fileChange.status === 'deleted') {
      return 'deleted';
    }
    return 'modified';
  }

  /**
   * Extract file extension
   * @param filePath - File path
   * @returns File extension (without dot)
   */
  private extractExtension(filePath: string): string {
    const match = filePath.match(/\.([^.]+)$/);
    return match ? match[1] : '';
  }

  /**
   * Format diff for AI analysis
   * @param parsedChange - Parsed file change
   * @param options - Formatting options
   * @returns Formatted diff string
   */
  formatDiffForAnalysis(parsedChange: ParsedFileChange, options: DiffFormatOptions = {}): string {
    const { includeContext = true, maxContextLines = 3, includeMetadata = true } = options;

    const parts: string[] = [];

    if (includeMetadata) {
      parts.push(`File: ${parsedChange.file}`);
      parts.push(`Change Type: ${parsedChange.changeType}`);
      if (parsedChange.oldPath) {
        parts.push(`Old Path: ${parsedChange.oldPath}`);
      }
      parts.push(`Language: ${this.getLanguageFromExtension(parsedChange.extension)}`);
      parts.push(`Changes: +${parsedChange.additions} -${parsedChange.deletions}`);
      parts.push('');
    }

    let diff = parsedChange.diff;

    if (!includeContext && diff) {
      diff = this.removeContextLines(diff, maxContextLines);
    }

    parts.push(diff);

    return parts.join('\n');
  }

  /**
   * Get language name from file extension
   * @param extension - File extension
   * @returns Language name
   */
  private getLanguageFromExtension(extension: string): string {
    const extensionMap: Record<string, string> = {
      ts: 'TypeScript',
      js: 'JavaScript',
      tsx: 'TypeScript React',
      jsx: 'JavaScript React',
      py: 'Python',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      cs: 'C#',
      go: 'Go',
      rs: 'Rust',
      rb: 'Ruby',
      php: 'PHP',
      swift: 'Swift',
      kt: 'Kotlin',
      scala: 'Scala',
      sh: 'Shell',
      bash: 'Bash',
      sql: 'SQL',
      json: 'JSON',
      yaml: 'YAML',
      yml: 'YAML',
      xml: 'XML',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      md: 'Markdown',
    };

    return extensionMap[extension.toLowerCase()] || 'Unknown';
  }

  /**
   * Remove excessive context lines from diff
   * @param diff - Original diff
   * @param maxContextLines - Maximum context lines to keep
   * @returns Diff with limited context
   */
  private removeContextLines(diff: string, maxContextLines: number): string {
    const lines = diff.split('\n');
    const result: string[] = [];
    let contextCount = 0;

    for (const line of lines) {
      if (line.startsWith('@@') || line.startsWith('+++') || line.startsWith('---')) {
        result.push(line);
        contextCount = 0;
        continue;
      }

      if (line.startsWith('+') || line.startsWith('-')) {
        result.push(line);
        contextCount = 0;
        continue;
      }

      if (contextCount < maxContextLines) {
        result.push(line);
        contextCount++;
      } else if (contextCount === maxContextLines) {
        result.push('... (context truncated)');
        contextCount++;
      }
    }

    return result.join('\n');
  }

  /**
   * Group files by type/extension for batch processing
   * @param parsedChanges - Array of parsed file changes
   * @returns Map of extension to file changes
   */
  groupByExtension(parsedChanges: ParsedFileChange[]): Map<string, ParsedFileChange[]> {
    const groups = new Map<string, ParsedFileChange[]>();

    for (const change of parsedChanges) {
      const ext = change.extension || 'unknown';
      const group = groups.get(ext) || [];
      group.push(change);
      groups.set(ext, group);
    }

    return groups;
  }

  /**
   * Sort files by complexity (most complex first)
   * @param parsedChanges - Array of parsed file changes
   * @returns Sorted array
   */
  sortByComplexity(parsedChanges: ParsedFileChange[]): ParsedFileChange[] {
    return [...parsedChanges].sort((a, b) => b.complexity - a.complexity);
  }

  /**
   * Filter files by change type
   * @param parsedChanges - Array of parsed file changes
   * @param changeTypes - Change types to include
   * @returns Filtered array
   */
  filterByChangeType(
    parsedChanges: ParsedFileChange[],
    changeTypes: Array<'added' | 'modified' | 'deleted' | 'renamed'>
  ): ParsedFileChange[] {
    return parsedChanges.filter((change) => changeTypes.includes(change.changeType));
  }

  /**
   * Filter files by extension
   * @param parsedChanges - Array of parsed file changes
   * @param extensions - Extensions to include
   * @returns Filtered array
   */
  filterByExtension(parsedChanges: ParsedFileChange[], extensions: string[]): ParsedFileChange[] {
    const normalizedExtensions = extensions.map((ext) => ext.toLowerCase());
    return parsedChanges.filter((change) =>
      normalizedExtensions.includes(change.extension.toLowerCase())
    );
  }

  /**
   * Create summary of changes
   * @param parsedChanges - Array of parsed file changes
   * @returns Summary statistics
   */
  createSummary(parsedChanges: ParsedFileChange[]): {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
    byChangeType: Record<string, number>;
    byExtension: Record<string, number>;
    mostComplexFile: ParsedFileChange | null;
  } {
    const byChangeType: Record<string, number> = {
      added: 0,
      modified: 0,
      deleted: 0,
      renamed: 0,
    };
    const byExtension: Record<string, number> = {};

    let totalAdditions = 0;
    let totalDeletions = 0;
    let mostComplexFile: ParsedFileChange | null = null;

    for (const change of parsedChanges) {
      totalAdditions += change.additions;
      totalDeletions += change.deletions;

      byChangeType[change.changeType]++;

      const ext = change.extension || 'unknown';
      byExtension[ext] = (byExtension[ext] || 0) + 1;

      if (!mostComplexFile || change.complexity > mostComplexFile.complexity) {
        mostComplexFile = change;
      }
    }

    return {
      totalFiles: parsedChanges.length,
      totalAdditions,
      totalDeletions,
      byChangeType,
      byExtension,
      mostComplexFile,
    };
  }
}
