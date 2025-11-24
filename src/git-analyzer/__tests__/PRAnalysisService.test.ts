/**
 * PRAnalysisService unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PRAnalysisService } from '../services/PRAnalysisService.js';
import type { PRAnalysisServiceConfig } from '../services/PRAnalysisService.js';
import type { IAIProvider } from '../services/ChangeAnalyzer.js';

// Mock dependencies
vi.mock('../services/GitHubService.js');
vi.mock('../services/ChangeAnalyzer.js');
vi.mock('../services/MergeService.js');
vi.mock('../services/ReportExporter.js');

describe('PRAnalysisService', () => {
  let service: PRAnalysisService;
  let mockAIProvider: IAIProvider;
  const config: PRAnalysisServiceConfig = {
    github: {
      token: 'test-token',
    },
    aiProvider: {} as IAIProvider,
    workingDir: '/test/dir',
  };

  beforeEach(() => {
    // Mock AI Provider
    mockAIProvider = {
      analyzeCode: vi.fn().mockResolvedValue({
        analysis: 'Mock analysis',
        issues: [],
      }),
    };

    config.aiProvider = mockAIProvider;

    // Create service instance
    service = new PRAnalysisService(config);
  });

  describe('constructor', () => {
    it('should initialize service with GitHub and AI provider', () => {
      expect(service).toBeDefined();
      expect((service as any).githubService).toBeDefined();
      expect((service as any).changeAnalyzer).toBeDefined();
      expect((service as any).mergeService).toBeDefined();
      expect((service as any).reportExporter).toBeDefined();
    });

    it('should initialize SonarQube service when config provided', () => {
      const configWithSQ: PRAnalysisServiceConfig = {
        ...config,
        sonarqube: {
          serverUrl: 'http://localhost:9000',
          token: 'sq-token',
          projectKey: 'test-project',
        },
      };

      const serviceWithSQ = new PRAnalysisService(configWithSQ);

      expect((serviceWithSQ as any).sonarqubeService).toBeDefined();
    });
  });

  describe('analyzePullRequest', () => {
    it('should analyze PR successfully', async () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        body: 'Test description',
        head: { ref: 'feature', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' },
        state: 'open' as const,
        user: { login: 'testuser' },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      const mockAnalysisResult = {
        changeType: 'feature' as const,
        summary: { totalFiles: 2, additions: 10, deletions: 5 },
        fileAnalyses: [
          {
            file: 'src/test.ts',
            changeType: 'feature' as const,
            issues: [
              {
                source: 'ai' as const,
                severity: 'medium' as const,
                type: 'code-smell' as const,
                file: 'src/test.ts',
                line: 10,
                message: 'Test issue',
              },
            ],
            summary: 'File changed',
            linesChanged: 15,
          },
        ],
        impactAnalysis: {
          riskLevel: 'medium' as const,
          affectedModules: ['test'],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 85,
        },
        timestamp: new Date().toISOString(),
      };

      // Mock GitHubService.getPullRequest
      (service as any).githubService.getPullRequest = vi.fn().mockResolvedValue(mockPR);

      // Mock ChangeAnalyzer.analyzeWorkingDirectory
      (service as any).changeAnalyzer.analyzeWorkingDirectory = vi
        .fn()
        .mockResolvedValue(mockAnalysisResult);

      // Mock ReportExporter.export
      (service as any).reportExporter.export = vi.fn().mockReturnValue('# Mock Report');

      const result = await service.analyzePullRequest({
        repository: { owner: 'test-owner', repo: 'test-repo' },
        prNumber: 123,
        analysisTypes: ['quality', 'security'],
        postComment: false,
      });

      expect(result.pullRequest).toEqual(mockPR);
      expect(result.analysis.totalIssues).toBe(1);
      expect(result.analysis.filesAnalyzed).toBe(1);
      expect(result.analysis.qualityScore).toBe(85);
      expect(result.analysis.riskLevel).toBe('medium');
      expect(result.commentId).toBeUndefined();
    });

    it('should post comment when requested', async () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        body: null,
        head: { ref: 'feature', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' },
        state: 'open' as const,
        user: { login: 'testuser' },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      const mockAnalysisResult = {
        changeType: 'feature' as const,
        summary: { totalFiles: 1, additions: 5, deletions: 2 },
        fileAnalyses: [],
        impactAnalysis: {
          riskLevel: 'low' as const,
          affectedModules: [],
          breakingChanges: [],
          testingRecommendations: [],
          deploymentRisks: [],
          qualityScore: 95,
        },
        timestamp: new Date().toISOString(),
      };

      (service as any).githubService.getPullRequest = vi.fn().mockResolvedValue(mockPR);
      (service as any).changeAnalyzer.analyzeWorkingDirectory = vi
        .fn()
        .mockResolvedValue(mockAnalysisResult);
      (service as any).reportExporter.export = vi.fn().mockReturnValue('# Report');
      (service as any).githubService.postComment = vi.fn().mockResolvedValue({
        id: 456,
        url: 'https://github.com/test/comment/456',
      });

      const result = await service.analyzePullRequest({
        repository: { owner: 'test-owner', repo: 'test-repo' },
        prNumber: 123,
        postComment: true,
      });

      expect(result.commentId).toBe(456);
      expect(result.commentUrl).toBe('https://github.com/test/comment/456');
      expect((service as any).githubService.postComment).toHaveBeenCalledWith(
        expect.objectContaining({
          prNumber: 123,
          collapsePrevious: true,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      (service as any).githubService.getPullRequest = vi
        .fn()
        .mockRejectedValue(new Error('API Error'));

      await expect(
        service.analyzePullRequest({
          repository: { owner: 'test-owner', repo: 'test-repo' },
          prNumber: 123,
        })
      ).rejects.toThrow('PR analysis failed');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate GitHub connection', async () => {
      (service as any).githubService.validateConnection = vi.fn().mockResolvedValue({
        valid: true,
        user: 'test-user',
      });

      const result = await service.validateConfiguration();

      expect(result.github).toEqual({
        valid: true,
        user: 'test-user',
      });
      expect(result.sonarqube).toBeUndefined();
    });

    it('should validate both GitHub and SonarQube when available', async () => {
      const configWithSQ: PRAnalysisServiceConfig = {
        ...config,
        sonarqube: {
          serverUrl: 'http://localhost:9000',
          token: 'sq-token',
          projectKey: 'test-project',
        },
      };

      const serviceWithSQ = new PRAnalysisService(configWithSQ);

      (serviceWithSQ as any).githubService.validateConnection = vi.fn().mockResolvedValue({
        valid: true,
        user: 'test-user',
      });

      (serviceWithSQ as any).sonarqubeService.testConnection = vi.fn().mockResolvedValue({
        success: true,
        version: '9.9.0',
      });

      const result = await serviceWithSQ.validateConfiguration();

      expect(result.github.valid).toBe(true);
      expect(result.sonarqube?.available).toBe(true);
    });

    it('should handle SonarQube connection failure', async () => {
      const configWithSQ: PRAnalysisServiceConfig = {
        ...config,
        sonarqube: {
          serverUrl: 'http://localhost:9000',
          token: 'sq-token',
          projectKey: 'test-project',
        },
      };

      const serviceWithSQ = new PRAnalysisService(configWithSQ);

      (serviceWithSQ as any).githubService.validateConnection = vi.fn().mockResolvedValue({
        valid: true,
        user: 'test-user',
      });

      (serviceWithSQ as any).sonarqubeService.testConnection = vi.fn().mockResolvedValue({
        success: false,
        error: 'Connection refused',
      });

      const result = await serviceWithSQ.validateConfiguration();

      expect(result.github.valid).toBe(true);
      expect(result.sonarqube?.available).toBe(false);
      expect(result.sonarqube?.error).toBeDefined();
    });
  });
});

