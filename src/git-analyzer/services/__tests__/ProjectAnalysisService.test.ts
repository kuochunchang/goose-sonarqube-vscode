/**
 * ProjectAnalysisService Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { ProjectAnalysisService } from '../ProjectAnalysisService.js';
import { SonarQubeService } from '../SonarQubeService.js';
import {
  QualityGateStatus,
  SonarQubeIssueType,
  SonarQubeSeverity,
  type ProjectAnalysisOptions,
  type SonarQubeConfig,
} from '../../types/sonarqube.types.js';

// Mock SonarQubeService
vi.mock('../SonarQubeService.js');

describe('ProjectAnalysisService', () => {
  let service: ProjectAnalysisService;
  let mockConfig: SonarQubeConfig;
  let mockSonarQubeService: SonarQubeService;

  beforeEach(() => {
    // Setup mock configuration
    mockConfig = {
      serverUrl: 'http://localhost:9000',
      token: 'test-token',
      projectKey: 'test-project',
      projectName: 'Test Project',
      timeout: 5000,
    };

    // Create service instance
    service = new ProjectAnalysisService(mockConfig);
    mockSonarQubeService = service.getSonarQubeService();

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(service).toBeDefined();
      expect(service.getSonarQubeService()).toBeDefined();
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockConnectionTest = {
        success: true,
        version: '9.9.0',
        responseTime: 150,
      };

      vi.spyOn(mockSonarQubeService, 'testConnection').mockResolvedValue(mockConnectionTest);

      const result = await service.testConnection();

      expect(result).toEqual(mockConnectionTest);
      expect(mockSonarQubeService.testConnection).toHaveBeenCalledTimes(1);
    });

    it('should handle connection failure', async () => {
      const mockConnectionTest = {
        success: false,
        error: 'Connection timeout',
        responseTime: 5000,
      };

      vi.spyOn(mockSonarQubeService, 'testConnection').mockResolvedValue(mockConnectionTest);

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('analyzeProject', () => {
    it('should successfully analyze project with complete results', async () => {
      const mockOptions: ProjectAnalysisOptions = {
        workingDirectory: '/test/project',
        waitForCompletion: true,
        timeout: 300000,
        includeQualityGate: true,
        includeMetrics: true,
        includeIssues: true,
      };

      const mockConnectionTest = {
        success: true,
        version: '9.9.0',
        responseTime: 150,
      };

      const mockScanResult = {
        success: true,
        taskId: 'task-123',
        dashboardUrl: 'http://localhost:9000/dashboard?id=test-project',
        executionTime: 45000,
      };

      const mockAnalysisResult = {
        projectKey: 'test-project',
        analysisDate: new Date().toISOString(),
        issues: [
          {
            key: 'issue-1',
            rule: 'typescript:S1234',
            severity: SonarQubeSeverity.CRITICAL,
            type: SonarQubeIssueType.BUG,
            component: 'test-project:src/file.ts',
            project: 'test-project',
            message: 'Critical bug found',
            status: 'OPEN' as const,
            creationDate: '2025-01-01T00:00:00Z',
            updateDate: '2025-01-01T00:00:00Z',
          },
        ],
        metrics: {
          bugs: 5,
          vulnerabilities: 2,
          codeSmells: 15,
          securityHotspots: 1,
          coverage: 85.5,
          linesOfCode: 10000,
          duplicatedLinesDensity: 3.2,
          technicalDebtRatio: 5.1,
        },
        qualityGate: {
          status: QualityGateStatus.OK,
          conditions: [],
        },
        issuesBySeverity: {
          [SonarQubeSeverity.BLOCKER]: 0,
          [SonarQubeSeverity.CRITICAL]: 1,
          [SonarQubeSeverity.MAJOR]: 4,
          [SonarQubeSeverity.MINOR]: 10,
          [SonarQubeSeverity.INFO]: 8,
        },
        issuesByType: {
          [SonarQubeIssueType.BUG]: 5,
          [SonarQubeIssueType.VULNERABILITY]: 2,
          [SonarQubeIssueType.CODE_SMELL]: 15,
          [SonarQubeIssueType.SECURITY_HOTSPOT]: 1,
        },
      };

      vi.spyOn(mockSonarQubeService, 'testConnection').mockResolvedValue(mockConnectionTest);
      vi.spyOn(mockSonarQubeService, 'executeScan').mockResolvedValue(mockScanResult);
      vi.spyOn(mockSonarQubeService, 'waitForAnalysis').mockResolvedValue(true);
      vi.spyOn(mockSonarQubeService, 'getAnalysisResult').mockResolvedValue(mockAnalysisResult);

      const result = await service.analyzeProject(mockOptions);

      expect(result).toBeDefined();
      expect(result.projectKey).toBe('test-project');
      expect(result.scanResult.success).toBe(true);
      expect(result.analysisResult).toBeDefined();
      expect(result.qualityStatus).toBe(QualityGateStatus.OK);
      expect(result.dashboardUrl).toBe('http://localhost:9000/dashboard?id=test-project');
      expect(result.summary.totalIssues).toBe(1);
      expect(result.summary.bugs).toBe(5);
      expect(result.summary.vulnerabilities).toBe(2);
      expect(result.summary.codeSmells).toBe(15);
      expect(result.summary.criticalIssues).toBe(1);

      expect(mockSonarQubeService.testConnection).toHaveBeenCalledTimes(1);
      expect(mockSonarQubeService.executeScan).toHaveBeenCalledWith({
        workingDirectory: '/test/project',
        waitForAnalysis: true,
        analysisTimeout: 300000,
      });
      expect(mockSonarQubeService.waitForAnalysis).toHaveBeenCalledWith('task-123', 300000);
      expect(mockSonarQubeService.getAnalysisResult).toHaveBeenCalledWith('test-project');
    });

    it('should handle connection failure', async () => {
      const mockOptions: ProjectAnalysisOptions = {
        workingDirectory: '/test/project',
      };

      const mockConnectionTest = {
        success: false,
        error: 'Server not reachable',
        responseTime: 5000,
      };

      vi.spyOn(mockSonarQubeService, 'testConnection').mockResolvedValue(mockConnectionTest);

      await expect(service.analyzeProject(mockOptions)).rejects.toThrow(
        'SonarQube connection failed: Server not reachable'
      );
    });

    it('should handle scan execution failure', async () => {
      const mockOptions: ProjectAnalysisOptions = {
        workingDirectory: '/test/project',
      };

      const mockConnectionTest = {
        success: true,
        version: '9.9.0',
        responseTime: 150,
      };

      const mockScanResult = {
        success: false,
        error: 'Scanner execution failed',
        executionTime: 1000,
      };

      vi.spyOn(mockSonarQubeService, 'testConnection').mockResolvedValue(mockConnectionTest);
      vi.spyOn(mockSonarQubeService, 'executeScan').mockResolvedValue(mockScanResult);

      await expect(service.analyzeProject(mockOptions)).rejects.toThrow(
        'Scanner execution failed: Scanner execution failed'
      );
    });

    it('should handle analysis timeout', async () => {
      const mockOptions: ProjectAnalysisOptions = {
        workingDirectory: '/test/project',
        waitForCompletion: true,
        timeout: 10000,
      };

      const mockConnectionTest = {
        success: true,
        version: '9.9.0',
        responseTime: 150,
      };

      const mockScanResult = {
        success: true,
        taskId: 'task-123',
        executionTime: 5000,
      };

      vi.spyOn(mockSonarQubeService, 'testConnection').mockResolvedValue(mockConnectionTest);
      vi.spyOn(mockSonarQubeService, 'executeScan').mockResolvedValue(mockScanResult);
      vi.spyOn(mockSonarQubeService, 'waitForAnalysis').mockResolvedValue(false);

      await expect(service.analyzeProject(mockOptions)).rejects.toThrow(
        'Analysis did not complete within the specified timeout'
      );
    });

    it('should continue without analysis results if retrieval fails', async () => {
      const mockOptions: ProjectAnalysisOptions = {
        workingDirectory: '/test/project',
        waitForCompletion: true,
      };

      const mockConnectionTest = {
        success: true,
        version: '9.9.0',
        responseTime: 150,
      };

      const mockScanResult = {
        success: true,
        taskId: 'task-123',
        executionTime: 5000,
      };

      vi.spyOn(mockSonarQubeService, 'testConnection').mockResolvedValue(mockConnectionTest);
      vi.spyOn(mockSonarQubeService, 'executeScan').mockResolvedValue(mockScanResult);
      vi.spyOn(mockSonarQubeService, 'waitForAnalysis').mockResolvedValue(true);
      vi.spyOn(mockSonarQubeService, 'getAnalysisResult').mockRejectedValue(new Error('API error'));

      const result = await service.analyzeProject(mockOptions);

      expect(result).toBeDefined();
      expect(result.scanResult.success).toBe(true);
      expect(result.analysisResult).toBeUndefined();
      expect(result.qualityStatus).toBeUndefined();
      expect(result.summary.totalIssues).toBe(0);
    });

    it('should skip waiting if waitForCompletion is false', async () => {
      const mockOptions: ProjectAnalysisOptions = {
        workingDirectory: '/test/project',
        waitForCompletion: false,
      };

      const mockConnectionTest = {
        success: true,
        version: '9.9.0',
        responseTime: 150,
      };

      const mockScanResult = {
        success: true,
        taskId: 'task-123',
        executionTime: 5000,
      };

      vi.spyOn(mockSonarQubeService, 'testConnection').mockResolvedValue(mockConnectionTest);
      vi.spyOn(mockSonarQubeService, 'executeScan').mockResolvedValue(mockScanResult);
      vi.spyOn(mockSonarQubeService, 'waitForAnalysis').mockResolvedValue(true);
      vi.spyOn(mockSonarQubeService, 'getAnalysisResult').mockRejectedValue(
        new Error('Not ready yet')
      );

      const result = await service.analyzeProject(mockOptions);

      expect(result).toBeDefined();
      expect(mockSonarQubeService.waitForAnalysis).not.toHaveBeenCalled();
    });

    it('should use default options when not specified', async () => {
      const mockOptions: ProjectAnalysisOptions = {
        workingDirectory: '/test/project',
      };

      const mockConnectionTest = {
        success: true,
        version: '9.9.0',
        responseTime: 150,
      };

      const mockScanResult = {
        success: true,
        taskId: 'task-123',
        executionTime: 5000,
      };

      vi.spyOn(mockSonarQubeService, 'testConnection').mockResolvedValue(mockConnectionTest);
      vi.spyOn(mockSonarQubeService, 'executeScan').mockResolvedValue(mockScanResult);
      vi.spyOn(mockSonarQubeService, 'waitForAnalysis').mockResolvedValue(true);
      vi.spyOn(mockSonarQubeService, 'getAnalysisResult').mockRejectedValue(
        new Error('Not available')
      );

      await service.analyzeProject(mockOptions);

      expect(mockSonarQubeService.executeScan).toHaveBeenCalledWith({
        workingDirectory: '/test/project',
        waitForAnalysis: true,
        analysisTimeout: 300000,
      });
      expect(mockSonarQubeService.waitForAnalysis).toHaveBeenCalledWith('task-123', 300000);
    });
  });

  describe('getSonarQubeService', () => {
    it('should return SonarQube service instance', () => {
      const sonarQubeService = service.getSonarQubeService();
      expect(sonarQubeService).toBeDefined();
      expect(sonarQubeService).toBeInstanceOf(SonarQubeService);
    });
  });

  describe('exportResultToTempFile', () => {
    let exportedFilePath: string | null = null;

    afterEach(() => {
      // Clean up exported file
      if (exportedFilePath && existsSync(exportedFilePath)) {
        unlinkSync(exportedFilePath);
        exportedFilePath = null;
      }
    });

    it('should export analysis result to temp directory as JSON', () => {
      const mockResult = {
        projectKey: 'test-project',
        analysisDate: '2025-11-22T00:00:00.000Z',
        scanResult: {
          success: true,
          executionTime: 5000,
        },
        summary: {
          totalIssues: 10,
          blockerIssues: 1,
          criticalIssues: 2,
          bugs: 3,
          vulnerabilities: 1,
          codeSmells: 5,
          securityHotspots: 1,
        },
      };

      exportedFilePath = service.exportResultToTempFile(mockResult as any);

      // Verify file exists
      expect(existsSync(exportedFilePath)).toBe(true);

      // Verify file path contains project key
      expect(exportedFilePath).toContain('sonarqube-analysis-test-project');

      // Verify file extension
      expect(exportedFilePath).toMatch(/\.json$/);

      // Verify file content
      const fileContent = readFileSync(exportedFilePath, 'utf-8');
      const parsedContent = JSON.parse(fileContent);

      expect(parsedContent.projectKey).toBe('test-project');
      expect(parsedContent.summary.totalIssues).toBe(10);
      expect(parsedContent.summary.bugs).toBe(3);
    });

    it('should create unique file names for different timestamps', async () => {
      const mockResult = {
        projectKey: 'test-project',
        analysisDate: '2025-11-22T00:00:00.000Z',
        scanResult: {
          success: true,
          executionTime: 5000,
        },
        summary: {
          totalIssues: 5,
          blockerIssues: 0,
          criticalIssues: 0,
          bugs: 0,
          vulnerabilities: 0,
          codeSmells: 5,
          securityHotspots: 0,
        },
      };

      const filePath1 = service.exportResultToTempFile(mockResult as any);

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const filePath2 = service.exportResultToTempFile(mockResult as any);

      expect(filePath1).not.toBe(filePath2);

      // Clean up both files
      if (existsSync(filePath1)) unlinkSync(filePath1);
      if (existsSync(filePath2)) unlinkSync(filePath2);
    });
  });

  describe('analyzeAndExport', () => {
    let exportedFilePath: string | null = null;

    afterEach(() => {
      // Clean up exported file
      if (exportedFilePath && existsSync(exportedFilePath)) {
        unlinkSync(exportedFilePath);
        exportedFilePath = null;
      }
    });

    it('should analyze project and export result to temp file', async () => {
      const mockOptions: ProjectAnalysisOptions = {
        workingDirectory: '/test/project',
      };

      const mockConnectionTest = {
        success: true,
        version: '9.9.0',
        responseTime: 150,
      };

      const mockScanResult = {
        success: true,
        taskId: 'task-123',
        executionTime: 5000,
      };

      vi.spyOn(mockSonarQubeService, 'testConnection').mockResolvedValue(mockConnectionTest);
      vi.spyOn(mockSonarQubeService, 'executeScan').mockResolvedValue(mockScanResult);
      vi.spyOn(mockSonarQubeService, 'waitForAnalysis').mockResolvedValue(true);
      vi.spyOn(mockSonarQubeService, 'getAnalysisResult').mockRejectedValue(
        new Error('Not available')
      );

      const { result, exportPath } = await service.analyzeAndExport(mockOptions);

      exportedFilePath = exportPath;

      // Verify result
      expect(result).toBeDefined();
      expect(result.projectKey).toBe('test-project');

      // Verify export path
      expect(exportPath).toBeDefined();
      expect(existsSync(exportPath)).toBe(true);

      // Verify file content matches result
      const fileContent = readFileSync(exportPath, 'utf-8');
      const parsedContent = JSON.parse(fileContent);
      expect(parsedContent.projectKey).toBe(result.projectKey);
      expect(parsedContent.summary).toEqual(result.summary);
    });
  });
});
