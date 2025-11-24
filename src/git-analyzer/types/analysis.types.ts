/**
 * Analysis-related type definitions
 */

import type { GitChanges } from './git.types.js';
import type { SonarQubeAnalysisResult } from './sonarqube.types.js';

/**
 * Analysis options
 */
export interface AnalysisOptions {
  /** Enable code quality analysis */
  checkQuality?: boolean;
  /** Enable security analysis */
  checkSecurity?: boolean;
  /** Enable performance analysis */
  checkPerformance?: boolean;
  /** Enable architecture review */
  checkArchitecture?: boolean;
  /** Enable test coverage suggestions */
  checkTesting?: boolean;
  /** Custom analysis focus areas */
  customFocus?: string[];
}

/**
 * Issue severity levels
 */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Issue types
 */
export type IssueType =
  | 'bug'
  | 'vulnerability'
  | 'code-smell'
  | 'security-hotspot'
  | 'breaking-change'
  | 'performance'
  | 'architecture'
  | 'testing';

/**
 * Source of the issue
 */
export type IssueSource = 'sonarqube' | 'ai' | 'merged';

/**
 * Individual code issue
 */
export interface CodeIssue {
  /** Issue source */
  source: IssueSource;
  /** Severity level */
  severity: IssueSeverity;
  /** Issue type */
  type: IssueType;
  /** File path */
  file: string;
  /** Line number (0 for file-level issues) */
  line: number;
  /** Issue message */
  message: string;
  /** Detailed description */
  description?: string;
  /** Rule ID (for SonarQube issues) */
  rule?: string;
  /** Effort to fix (in minutes) */
  effort?: number;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Analysis result for a single file
 */
export interface FileAnalysis {
  /** File path */
  file: string;
  /** Change type classification */
  changeType: 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'config' | 'unknown';
  /** Issues found in this file */
  issues: CodeIssue[];
  /** Summary text */
  summary: string;
  /** Lines changed */
  linesChanged: number;
  /** Quality score (0-100) */
  qualityScore?: number;
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysis {
  /** Overall risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Affected modules/components */
  affectedModules: string[];
  /** Breaking changes detected */
  breakingChanges: string[];
  /** Testing recommendations */
  testingRecommendations: string[];
  /** Deployment risks */
  deploymentRisks: string[];
  /** Overall quality score (0-100) */
  qualityScore: number;
}

/**
 * Complete change analysis result
 */
export interface ChangeAnalysisResult {
  /** Type of change analyzed */
  changeType: GitChanges['type'];
  /** Change summary */
  summary: GitChanges['summary'];
  /** Per-file analysis results */
  fileAnalyses: FileAnalysis[];
  /** Overall impact analysis */
  impactAnalysis: ImpactAnalysis;
  /** Analysis timestamp */
  timestamp: string;
  /** Analysis duration (ms) */
  duration?: number;
}

/**
 * SonarQube issue (raw format)
 */
export interface SonarIssue {
  /** Issue key */
  key: string;
  /** Rule key (e.g., "squid:S1135") */
  rule: string;
  /** Severity */
  severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
  /** Issue type */
  type: 'BUG' | 'VULNERABILITY' | 'CODE_SMELL' | 'SECURITY_HOTSPOT';
  /** Component (file path) */
  component: string;
  /** Line number */
  line?: number;
  /** Issue message */
  message: string;
  /** Effort (in minutes) */
  effort?: string;
  /** Creation date */
  creationDate: string;
}

/**
 * AI analysis result
 */
export interface AIAnalysisResult {
  /** File analyses */
  fileAnalyses: FileAnalysis[];
  /** Impact analysis */
  impactAnalysis: ImpactAnalysis;
  /** Architecture review notes */
  architectureReview?: string;
  /** Testing strategy suggestions */
  testingStrategy?: string;
  /** Documentation needs */
  documentationNeeds?: string[];
}

/**
 * Merged analysis result (SonarQube + AI)
 */
export interface MergedAnalysisResult extends ChangeAnalysisResult {
  /** SonarQube results (raw) */
  sonarQubeResults?: SonarQubeAnalysisResult;
  /** AI results (raw) */
  aiResults?: AIAnalysisResult;
  /** Deduplication info */
  deduplicationInfo?: {
    totalIssues: number;
    duplicatesRemoved: number;
    uniqueIssues: number;
  };
}
