/**
 * SonarQube Integration Types
 *
 * Type definitions for SonarQube server integration, scanner configuration,
 * and analysis results.
 */

/**
 * SonarQube server configuration
 */
export interface SonarQubeServerConfig {
  /**
   * SonarQube server URL (e.g., 'http://localhost:9000')
   */
  serverUrl: string;

  /**
   * Authentication token for SonarQube server
   */
  token?: string;

  /**
   * Connection timeout in milliseconds
   * @default 3000
   */
  timeout?: number;

  /**
   * Whether to skip SSL certificate verification (for self-signed certificates)
   * @default false
   */
  skipCertVerification?: boolean;
}

/**
 * SonarQube scanner configuration
 */
export interface SonarQubeScannerConfig {
  /**
   * Project key (unique identifier)
   */
  projectKey: string;

  /**
   * Project name for display
   */
  projectName?: string;

  /**
   * Project version
   */
  projectVersion?: string;

  /**
   * Source directories to scan (comma-separated)
   * @default '.'
   */
  sources?: string;

  /**
   * Directories to exclude from scan (comma-separated)
   * @example 'node_modules/**,dist/**,build/**'
   */
  exclusions?: string;

  /**
   * Source file encoding
   * @default 'UTF-8'
   */
  sourceEncoding?: string;

  /**
   * Additional SonarQube properties
   */
  additionalProperties?: Record<string, string>;
}

/**
 * Complete SonarQube configuration (server + scanner)
 */
export interface SonarQubeConfig extends SonarQubeServerConfig, SonarQubeScannerConfig {}

/**
 * SonarQube issue severity levels
 */
export enum SonarQubeSeverity {
  BLOCKER = 'BLOCKER',
  CRITICAL = 'CRITICAL',
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  INFO = 'INFO',
}

/**
 * SonarQube issue type
 */
export enum SonarQubeIssueType {
  BUG = 'BUG',
  VULNERABILITY = 'VULNERABILITY',
  CODE_SMELL = 'CODE_SMELL',
  SECURITY_HOTSPOT = 'SECURITY_HOTSPOT',
}

/**
 * SonarQube issue status
 */
export enum SonarQubeIssueStatus {
  OPEN = 'OPEN',
  CONFIRMED = 'CONFIRMED',
  REOPENED = 'REOPENED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

/**
 * Text range for an issue location
 */
export interface SonarQubeTextRange {
  startLine: number;
  endLine: number;
  startOffset?: number;
  endOffset?: number;
}

/**
 * Location information for an issue
 */
export interface SonarQubeLocation {
  component: string;
  textRange: SonarQubeTextRange;
  message?: string;
}

/**
 * A single SonarQube issue
 */
export interface SonarQubeIssue {
  /**
   * Issue unique key
   */
  key: string;

  /**
   * Rule identifier
   */
  rule: string;

  /**
   * Issue severity
   */
  severity: SonarQubeSeverity;

  /**
   * Issue type
   */
  type: SonarQubeIssueType;

  /**
   * Component key (file path)
   */
  component: string;

  /**
   * Project key
   */
  project: string;

  /**
   * Issue message
   */
  message: string;

  /**
   * Primary location
   */
  textRange?: SonarQubeTextRange;

  /**
   * Additional flows (for multi-location issues)
   */
  flows?: Array<{ locations: SonarQubeLocation[] }>;

  /**
   * Issue status
   */
  status: SonarQubeIssueStatus;

  /**
   * Creation date
   */
  creationDate: string;

  /**
   * Update date
   */
  updateDate: string;

  /**
   * Effort to fix (in minutes)
   */
  effort?: string;

  /**
   * Debt (technical debt in minutes)
   */
  debt?: string;

  /**
   * Assigned user
   */
  assignee?: string;

  /**
   * Tags
   */
  tags?: string[];
}

/**
 * SonarQube metrics data
 */
export interface SonarQubeMetrics {
  /**
   * Number of bugs
   */
  bugs: number;

  /**
   * Number of vulnerabilities
   */
  vulnerabilities: number;

  /**
   * Number of code smells
   */
  codeSmells: number;

  /**
   * Number of security hotspots
   */
  securityHotspots: number;

  /**
   * Technical debt ratio (percentage)
   */
  technicalDebtRatio?: number;

  /**
   * Coverage percentage
   */
  coverage?: number;

  /**
   * Lines of code
   */
  linesOfCode?: number;

  /**
   * Duplicated lines percentage
   */
  duplicatedLinesDensity?: number;
}

/**
 * Quality gate status
 */
export enum QualityGateStatus {
  OK = 'OK',
  WARN = 'WARN',
  ERROR = 'ERROR',
  NONE = 'NONE',
}

/**
 * Quality gate result
 */
export interface QualityGateResult {
  /**
   * Quality gate status
   */
  status: QualityGateStatus;

  /**
   * Conditions that failed
   */
  conditions?: Array<{
    metric: string;
    operator: string;
    value: string;
    status: QualityGateStatus;
    errorThreshold?: string;
  }>;
}

/**
 * SonarQube analysis result
 */
export interface SonarQubeAnalysisResult {
  /**
   * Project key
   */
  projectKey: string;

  /**
   * Analysis timestamp
   */
  analysisDate: string;

  /**
   * List of issues found
   */
  issues: SonarQubeIssue[];

  /**
   * Aggregated metrics
   */
  metrics: SonarQubeMetrics;

  /**
   * Quality gate result
   */
  qualityGate: QualityGateResult;

  /**
   * Number of issues by severity
   */
  issuesBySeverity: Record<SonarQubeSeverity, number>;

  /**
   * Number of issues by type
   */
  issuesByType: Record<SonarQubeIssueType, number>;
}

/**
 * SonarQube service operation mode
 */
export enum SonarQubeMode {
  /**
   * SonarQube server is available and configured
   */
  SERVER = 'SERVER',

  /**
   * SonarQube is disabled or unavailable (AI-only mode)
   */
  DISABLED = 'DISABLED',
}

/**
 * SonarQube connection test result
 */
export interface SonarQubeConnectionTest {
  /**
   * Whether connection was successful
   */
  success: boolean;

  /**
   * SonarQube server version (if available)
   */
  version?: string;

  /**
   * Error message (if failed)
   */
  error?: string;

  /**
   * Response time in milliseconds
   */
  responseTime?: number;
}

/**
 * Scanner execution options
 */
export interface ScannerExecutionOptions {
  /**
   * Working directory for scanning
   */
  workingDirectory: string;

  /**
   * Whether to wait for analysis to complete on server
   * @default true
   */
  waitForAnalysis?: boolean;

  /**
   * Timeout for waiting for analysis completion (in milliseconds)
   * @default 300000 (5 minutes)
   */
  analysisTimeout?: number;

  /**
   * Whether to fail on quality gate error
   * @default false
   */
  failOnQualityGateError?: boolean;
}

/**
 * Scanner execution result
 */
export interface ScannerExecutionResult {
  /**
   * Whether scan was successful
   */
  success: boolean;

  /**
   * Task ID for server-side analysis
   */
  taskId?: string;

  /**
   * Dashboard URL
   */
  dashboardUrl?: string;

  /**
   * Error message (if failed)
   */
  error?: string;

  /**
   * Execution time in milliseconds
   */
  executionTime: number;
}

/**
 * Project analysis options
 */
export interface ProjectAnalysisOptions {
  /**
   * Working directory containing the project
   */
  workingDirectory: string;

  /**
   * Whether to wait for server-side analysis completion
   * @default true
   */
  waitForCompletion?: boolean;

  /**
   * Timeout for waiting for analysis completion (in milliseconds)
   * @default 300000 (5 minutes)
   */
  timeout?: number;

  /**
   * Whether to include quality gate information
   * @default true
   */
  includeQualityGate?: boolean;

  /**
   * Whether to include metrics
   * @default true
   */
  includeMetrics?: boolean;

  /**
   * Whether to include issues
   * @default true
   */
  includeIssues?: boolean;
}

/**
 * Complete project analysis result
 */
export interface ProjectAnalysisResult {
  /**
   * Project key
   */
  projectKey: string;

  /**
   * Analysis timestamp
   */
  analysisDate: string;

  /**
   * Scanner execution result
   */
  scanResult: ScannerExecutionResult;

  /**
   * Analysis result from server (if available)
   */
  analysisResult?: SonarQubeAnalysisResult;

  /**
   * Dashboard URL for viewing results
   */
  dashboardUrl?: string;

  /**
   * Overall quality status
   */
  qualityStatus?: QualityGateStatus;

  /**
   * Summary statistics
   */
  summary: {
    totalIssues: number;
    blockerIssues: number;
    criticalIssues: number;
    bugs: number;
    vulnerabilities: number;
    codeSmells: number;
    securityHotspots: number;
  };
}
