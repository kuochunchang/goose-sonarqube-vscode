/**
 * ProjectAnalysisService
 *
 * Service for orchestrating complete SonarQube project analysis.
 * Handles scanning, result retrieval, and summary generation for entire projects.
 */

import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type {
  ProjectAnalysisOptions,
  ProjectAnalysisResult,
  QualityGateStatus,
  SonarQubeConfig,
  SonarQubeSeverity,
} from "../types/sonarqube.types.js";
import { SonarQubeService } from "./SonarQubeService.js";

/**
 * Service for analyzing complete projects with SonarQube
 */
export class ProjectAnalysisService {
  private sonarQubeService: SonarQubeService;
  private config: SonarQubeConfig;

  constructor(config: SonarQubeConfig) {
    this.config = config;
    this.sonarQubeService = new SonarQubeService(config);
  }

  /**
   * Analyze entire project with SonarQube
   * @param options Analysis options
   * @returns Complete project analysis result
   */
  async analyzeProject(options: ProjectAnalysisOptions): Promise<ProjectAnalysisResult> {
    console.log("[ProjectAnalysisService] Starting project analysis for:", this.config.projectKey);

    const analysisDate = new Date().toISOString();

    // Test connection first
    const connectionTest = await this.sonarQubeService.testConnection();
    if (!connectionTest.success) {
      throw new Error(`SonarQube connection failed: ${connectionTest.error}`);
    }

    console.log("[ProjectAnalysisService] Connection successful. Starting scan...");

    // Execute scanner
    const scanResult = await this.sonarQubeService.executeScan({
      workingDirectory: options.workingDirectory,
      waitForAnalysis: options.waitForCompletion ?? true,
      analysisTimeout: options.timeout ?? 300000,
    });

    if (!scanResult.success) {
      throw new Error(`Scanner execution failed: ${scanResult.error}`);
    }

    console.log("[ProjectAnalysisService] Scan completed successfully.");

    // Wait for analysis to complete if taskId is available and waitForCompletion is true
    if (scanResult.taskId && (options.waitForCompletion ?? true)) {
      console.log("[ProjectAnalysisService] Waiting for server-side analysis...");
      const analysisCompleted = await this.sonarQubeService.waitForAnalysis(
        scanResult.taskId,
        options.timeout ?? 300000
      );

      if (!analysisCompleted) {
        throw new Error("Analysis did not complete within the specified timeout");
      }
      console.log("[ProjectAnalysisService] Server-side analysis completed.");
    }

    // Retrieve analysis results from server
    let analysisResult;
    let qualityStatus: QualityGateStatus | undefined;

    try {
      console.log("[ProjectAnalysisService] Retrieving analysis results...");
      analysisResult = await this.sonarQubeService.getAnalysisResult(this.config.projectKey);
      qualityStatus = analysisResult.qualityGate.status;
      console.log("[ProjectAnalysisService] Quality Gate Status:", qualityStatus);
    } catch (error) {
      console.warn("[ProjectAnalysisService] Failed to retrieve analysis results:", error);
      // Continue without analysis results if retrieval fails
    }

    // Generate summary
    const summary = this.generateSummary(analysisResult);

    const result: ProjectAnalysisResult = {
      projectKey: this.config.projectKey,
      analysisDate,
      scanResult,
      analysisResult,
      dashboardUrl: scanResult.dashboardUrl,
      qualityStatus,
      summary,
    };

    console.log("[ProjectAnalysisService] Analysis complete.");
    console.log("[ProjectAnalysisService] Summary:", summary);

    return result;
  }

  /**
   * Generate summary statistics from analysis result
   * @param analysisResult Analysis result from server
   * @returns Summary statistics
   */
  private generateSummary(analysisResult?: {
    issuesBySeverity: Record<SonarQubeSeverity, number>;
    metrics: {
      bugs: number;
      vulnerabilities: number;
      codeSmells: number;
      securityHotspots: number;
    };
    issues: unknown[];
  }): ProjectAnalysisResult["summary"] {
    if (!analysisResult) {
      return {
        totalIssues: 0,
        blockerIssues: 0,
        criticalIssues: 0,
        bugs: 0,
        vulnerabilities: 0,
        codeSmells: 0,
        securityHotspots: 0,
      };
    }

    return {
      totalIssues: analysisResult.issues.length,
      blockerIssues: analysisResult.issuesBySeverity.BLOCKER || 0,
      criticalIssues: analysisResult.issuesBySeverity.CRITICAL || 0,
      bugs: analysisResult.metrics.bugs,
      vulnerabilities: analysisResult.metrics.vulnerabilities,
      codeSmells: analysisResult.metrics.codeSmells,
      securityHotspots: analysisResult.metrics.securityHotspots,
    };
  }

  /**
   * Get SonarQube service instance
   * @returns SonarQube service
   */
  getSonarQubeService(): SonarQubeService {
    return this.sonarQubeService;
  }

  /**
   * Test connection to SonarQube server
   * @returns Connection test result
   */
  async testConnection() {
    return this.sonarQubeService.testConnection();
  }

  /**
   * Export analysis result to JSON file in system temp directory
   * @param result Analysis result to export
   * @returns Absolute path to the exported JSON file
   */
  exportResultToTempFile(result: ProjectAnalysisResult): string {
    const tempDir = tmpdir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `sonarqube-analysis-${result.projectKey}-${timestamp}.json`;
    const filePath = join(tempDir, fileName);

    console.log("[ProjectAnalysisService] Exporting analysis result to:", filePath);

    const jsonContent = JSON.stringify(result, null, 2);
    writeFileSync(filePath, jsonContent, "utf-8");

    console.log("[ProjectAnalysisService] Export completed successfully");

    return filePath;
  }

  /**
   * Analyze project and export result to temp file
   * @param options Analysis options
   * @returns Object containing analysis result and exported file path
   */
  async analyzeAndExport(options: ProjectAnalysisOptions): Promise<{
    result: ProjectAnalysisResult;
    exportPath: string;
  }> {
    const result = await this.analyzeProject(options);
    const exportPath = this.exportResultToTempFile(result);

    return {
      result,
      exportPath,
    };
  }
}
