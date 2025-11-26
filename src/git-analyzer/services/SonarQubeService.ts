/**
 * SonarQubeService
 *
 * Service for integrating with SonarQube server for static code analysis.
 * Provides scanning, issue retrieval, quality gate checks, and metrics collection.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import scanner from 'sonarqube-scanner';
import {
  SonarQubeIssueType,
  SonarQubeMode,
  SonarQubeSeverity,
  type QualityGateResult,
  type QualityGateStatus,
  type ScannerExecutionOptions,
  type ScannerExecutionResult,
  type SonarQubeAnalysisResult,
  type SonarQubeConfig,
  type SonarQubeConnectionTest,
  type SonarQubeIssue,
  type SonarQubeMetrics,
} from '../types/sonarqube.types.js';

/**
 * Service for SonarQube integration
 */
export class SonarQubeService {
  private config: SonarQubeConfig;
  private mode: SonarQubeMode;

  constructor(config: SonarQubeConfig) {
    this.config = config;
    this.mode = SonarQubeMode.DISABLED; // Default to disabled until connection is verified
    console.log('[SonarQubeService] Created instance. Mode:', this.mode);
  }

  /**
   * Test connection to SonarQube server
   * @returns Connection test result
   */
  async testConnection(): Promise<SonarQubeConnectionTest> {
    const startTime = Date.now();
    console.log('[SonarQubeService] Testing connection to:', this.config.serverUrl);

    try {
      const response = await fetch(`${this.config.serverUrl}/api/system/status`, {
        method: 'GET',
        headers: {
          Authorization: this.config.token
            ? `Basic ${Buffer.from(this.config.token + ':').toString('base64')}`
            : '',
        },
        signal: AbortSignal.timeout(this.config.timeout || 3000),
      });

      const responseTime = this.getElapsedTime(startTime);

      if (!response.ok) {
        console.log('[SonarQubeService] Connection failed with status:', response.status);
        return {
          success: false,
          error: `Server returned status ${response.status}: ${response.statusText}`,
          responseTime,
        };
      }

      const data = (await response.json()) as { status: string; version?: string };

      if (data.status === 'UP') {
        this.mode = SonarQubeMode.SERVER;
        console.log('[SonarQubeService] Connection successful. Mode set to SERVER.');
        return {
          success: true,
          version: data.version,
          responseTime,
        };
      }

      return {
        success: false,
        error: `Server status is ${data.status}`,
        responseTime,
      };
    } catch (error) {
      const responseTime = this.getElapsedTime(startTime);
      console.log('[SonarQubeService] Connection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
      };
    }
  }

  /**
   * Get current operation mode
   * @returns Current SonarQube mode
   */
  getMode(): SonarQubeMode {
    return this.mode;
  }

  /**
   * Check if SonarQube is available
   * @returns True if server mode is active
   */
  isAvailable(): boolean {
    return this.mode === SonarQubeMode.SERVER;
  }

  /**
   * Execute SonarQube scanner
   * @param _options Scanner execution options
   * @returns Scanner execution result
   */
  async executeScan(options: ScannerExecutionOptions): Promise<ScannerExecutionResult> {
    console.log('[SonarQubeService] executeScan called. Current mode:', this.mode);
    if (!this.isAvailable()) {
      console.error(
        '[SonarQubeService] executeScan failed: Server not available. Mode:',
        this.mode
      );
      return {
        success: false,
        error: 'SonarQube server is not available',
        executionTime: 0,
      };
    }

    const startTime = Date.now();

    try {
      const scannerConfig = {
        serverUrl: this.config.serverUrl,
        token: this.config.token || '',
        options: {
          'sonar.projectKey': this.config.projectKey,
          'sonar.projectName': this.config.projectName || this.config.projectKey,
          'sonar.projectVersion': this.config.projectVersion || '1.0',
          'sonar.sources': this.config.sources || '.',
          'sonar.exclusions':
            this.config.exclusions ||
            'node_modules/**,dist/**,build/**,coverage/**,.scannerwork/**,.git/**',
          'sonar.sourceEncoding': this.config.sourceEncoding || 'UTF-8',
          'sonar.projectBaseDir': options.workingDirectory,
          'sonar.login': this.config.token || '', // Explicitly pass token as sonar.login
          'sonar.java.binaries': '.', // Default to current directory for Java binaries to avoid AnalysisException
          ...this.config.additionalProperties,
        },
      };

      const logMessage = (msg: string) => {
        console.log(msg);
        // Try to log to VS Code output channel if available
        const outputChannel = (global as any).gooseOutputChannel;
        if (outputChannel && typeof outputChannel.appendLine === 'function') {
          outputChannel.appendLine(msg);
        }
      };

      logMessage('[SonarQube] Starting scan with config:');
      logMessage(`  Server URL: ${scannerConfig.serverUrl}`);
      logMessage(`  Project Key: ${scannerConfig.options['sonar.projectKey']}`);
      logMessage(`  Sources: ${scannerConfig.options['sonar.sources']}`);
      logMessage(`  Base Dir: ${scannerConfig.options['sonar.projectBaseDir']}`);

      return await new Promise<ScannerExecutionResult>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          const timeoutMsg = '[SonarQube] Scanner timed out after 60s';
          console.error(timeoutMsg);
          logMessage(timeoutMsg);
          resolve({
            success: false,
            error: 'Scanner timed out',
            executionTime: this.getElapsedTime(startTime),
          });
        }, 60000);

        try {
          logMessage('[SonarQube] Invoking scanner...');
          scanner(scannerConfig, (error?: unknown) => {
            clearTimeout(timeoutId);
            const executionTime = this.getElapsedTime(startTime);

            if (error) {
              // Error callback
              const errorMsg = `[SonarQube] Scanner failed: ${error instanceof Error ? error.message : String(error)}`;
              console.error(errorMsg);
              logMessage(errorMsg);
              resolve({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                executionTime,
              });
            } else {
              // Success callback - read taskId and dashboardUrl from report-task.txt
              const successMsg = `[SonarQube] Scanner completed successfully in ${executionTime}ms`;
              console.log(successMsg);
              logMessage(successMsg);

              // Parse report-task.txt to get taskId and dashboardUrl
              const { taskId, dashboardUrl } = this.parseReportTask(options.workingDirectory);

              resolve({
                success: true,
                executionTime,
                taskId,
                dashboardUrl,
              });
            }
          });
        } catch (err) {
          clearTimeout(timeoutId);
          reject(err);
        }
      });
    } catch (error) {
      const executionTime = this.getElapsedTime(startTime);
      console.error('[SonarQube] Scanner execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during scan',
        executionTime,
      };
    }
  }

  /**
   * Calculate elapsed time ensuring a minimum of 1ms when an operation completes synchronously.
   */
  private getElapsedTime(startTime: number): number {
    const elapsed = Date.now() - startTime;
    return elapsed > 0 ? elapsed : 1;
  }

  /**
   * Parse report-task.txt to extract taskId and dashboardUrl
   * @param workingDirectory The directory where scanner was executed
   * @returns Object containing taskId and dashboardUrl if available
   */
  private parseReportTask(workingDirectory: string): { taskId?: string; dashboardUrl?: string } {
    const reportTaskPath = join(workingDirectory, '.scannerwork', 'report-task.txt');

    if (!existsSync(reportTaskPath)) {
      console.warn('[SonarQube] report-task.txt not found at:', reportTaskPath);
      return {};
    }

    try {
      const content = readFileSync(reportTaskPath, 'utf-8');
      const taskIdMatch = content.match(/ceTaskId=(.+)/);
      const dashboardUrlMatch = content.match(/dashboardUrl=(.+)/);

      const result = {
        taskId: taskIdMatch?.[1]?.trim(),
        dashboardUrl: dashboardUrlMatch?.[1]?.trim(),
      };

      if (result.taskId) {
        console.log('[SonarQube] Task ID:', result.taskId);
      }
      if (result.dashboardUrl) {
        console.log('[SonarQube] Dashboard URL:', result.dashboardUrl);
      }

      return result;
    } catch (error) {
      console.warn('[SonarQube] Failed to parse report-task.txt:', error);
      return {};
    }
  }

  /**
   * Get analysis results from SonarQube server
   * @param projectKey Project key to retrieve results for
   * @returns Analysis result with issues, metrics, and quality gate
   */
  async getAnalysisResult(projectKey: string): Promise<SonarQubeAnalysisResult> {
    if (!this.isAvailable()) {
      throw new Error('SonarQube server is not available');
    }

    // Fetch issues, metrics, and quality gate in parallel
    const [issues, metrics, qualityGate] = await Promise.all([
      this.getIssues(projectKey),
      this.getMetrics(projectKey),
      this.getQualityGate(projectKey),
    ]);

    // Aggregate issues by severity and type
    const issuesBySeverity = this.aggregateIssuesBySeverity(issues);
    const issuesByType = this.aggregateIssuesByType(issues);

    return {
      projectKey,
      analysisDate: new Date().toISOString(),
      issues,
      metrics,
      qualityGate,
      issuesBySeverity,
      issuesByType,
    };
  }

  /**
   * Get issues for a project
   * @param projectKey Project key
   * @returns Array of SonarQube issues
   */
  private async getIssues(projectKey: string): Promise<SonarQubeIssue[]> {
    const url = new URL(`${this.config.serverUrl}/api/issues/search`);
    url.searchParams.set('componentKeys', projectKey);
    url.searchParams.set('resolved', 'false');
    url.searchParams.set('ps', '500'); // Page size

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: this.config.token
          ? `Basic ${Buffer.from(this.config.token + ':').toString('base64')}`
          : '',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch issues: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { issues: SonarQubeIssue[] };
    return data.issues || [];
  }

  /**
   * Get metrics for a project
   * @param projectKey Project key
   * @returns Project metrics
   */
  private async getMetrics(projectKey: string): Promise<SonarQubeMetrics> {
    const metricKeys = [
      'bugs',
      'vulnerabilities',
      'code_smells',
      'security_hotspots',
      'sqale_debt_ratio',
      'coverage',
      'ncloc',
      'duplicated_lines_density',
    ];

    const url = new URL(`${this.config.serverUrl}/api/measures/component`);
    url.searchParams.set('component', projectKey);
    url.searchParams.set('metricKeys', metricKeys.join(','));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: this.config.token
          ? `Basic ${Buffer.from(this.config.token + ':').toString('base64')}`
          : '',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      component: {
        measures: Array<{ metric: string; value: string }>;
      };
    };

    const measures = data.component.measures || [];
    const getMetricValue = (key: string): number => {
      const measure = measures.find((m) => m.metric === key);
      return measure ? parseFloat(measure.value) : 0;
    };

    return {
      bugs: getMetricValue('bugs'),
      vulnerabilities: getMetricValue('vulnerabilities'),
      codeSmells: getMetricValue('code_smells'),
      securityHotspots: getMetricValue('security_hotspots'),
      technicalDebtRatio: getMetricValue('sqale_debt_ratio'),
      coverage: getMetricValue('coverage'),
      linesOfCode: getMetricValue('ncloc'),
      duplicatedLinesDensity: getMetricValue('duplicated_lines_density'),
    };
  }

  /**
   * Get quality gate status for a project
   * @param projectKey Project key
   * @returns Quality gate result
   */
  private async getQualityGate(projectKey: string): Promise<QualityGateResult> {
    const url = new URL(`${this.config.serverUrl}/api/qualitygates/project_status`);
    url.searchParams.set('projectKey', projectKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: this.config.token
          ? `Basic ${Buffer.from(this.config.token + ':').toString('base64')}`
          : '',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch quality gate: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      projectStatus: {
        status: string;
        conditions?: Array<{
          metricKey: string;
          comparator: string;
          actualValue: string;
          status: string;
          errorThreshold?: string;
        }>;
      };
    };

    const status = data.projectStatus.status.toUpperCase() as QualityGateStatus;
    const conditions = data.projectStatus.conditions?.map((c) => ({
      metric: c.metricKey,
      operator: c.comparator,
      value: c.actualValue,
      status: c.status.toUpperCase() as QualityGateStatus,
      errorThreshold: c.errorThreshold,
    }));

    return {
      status,
      conditions,
    };
  }

  /**
   * Aggregate issues by severity
   * @param issues Array of issues
   * @returns Count by severity
   */
  private aggregateIssuesBySeverity(issues: SonarQubeIssue[]): Record<SonarQubeSeverity, number> {
    const result: Record<SonarQubeSeverity, number> = {
      [SonarQubeSeverity.BLOCKER]: 0,
      [SonarQubeSeverity.CRITICAL]: 0,
      [SonarQubeSeverity.MAJOR]: 0,
      [SonarQubeSeverity.MINOR]: 0,
      [SonarQubeSeverity.INFO]: 0,
    };

    for (const issue of issues) {
      result[issue.severity]++;
    }

    return result;
  }

  /**
   * Aggregate issues by type
   * @param issues Array of issues
   * @returns Count by type
   */
  private aggregateIssuesByType(issues: SonarQubeIssue[]): Record<SonarQubeIssueType, number> {
    const result: Record<SonarQubeIssueType, number> = {
      [SonarQubeIssueType.BUG]: 0,
      [SonarQubeIssueType.VULNERABILITY]: 0,
      [SonarQubeIssueType.CODE_SMELL]: 0,
      [SonarQubeIssueType.SECURITY_HOTSPOT]: 0,
    };

    for (const issue of issues) {
      result[issue.type]++;
    }

    return result;
  }

  /**
   * Wait for analysis to complete on server
   * @param taskId Task ID from scanner execution
   * @param timeout Timeout in milliseconds
   * @returns True if analysis completed successfully
   */
  async waitForAnalysis(taskId: string, timeout: number = 300000): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('SonarQube server is not available');
    }

    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds

    while (Date.now() - startTime < timeout) {
      const url = new URL(`${this.config.serverUrl}/api/ce/task`);
      url.searchParams.set('id', taskId);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: this.config.token
            ? `Basic ${Buffer.from(this.config.token + ':').toString('base64')}`
            : '',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to check task status: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        task: {
          status: string;
          errorMessage?: string;
        };
      };

      if (data.task.status === 'SUCCESS') {
        return true;
      }

      if (data.task.status === 'FAILED' || data.task.status === 'CANCELED') {
        throw new Error(`Analysis failed: ${data.task.errorMessage || data.task.status}`);
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Analysis timeout: Task did not complete within the specified time');
  }
}
