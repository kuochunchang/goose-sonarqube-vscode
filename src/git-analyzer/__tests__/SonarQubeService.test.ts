import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SonarQubeService } from '../services/SonarQubeService.js';
import {
  type SonarQubeConfig,
} from '../types/sonarqube.types.js';

// Mock sonarqube-scanner
vi.mock('sonarqube-scanner', () => ({
  default: vi.fn((config, callback, errorCallback) => {
    // Simulate async scanner execution
    setTimeout(() => {
      if (mockScannerShouldFail) {
        errorCallback(new Error('Scanner execution failed'));
      } else {
        callback({
          ceTaskId: 'mock-task-id',
          ceTaskUrl: 'http://localhost:9000/api/ce/task?id=mock-task-id',
          dashboardUrl: 'http://localhost:9000/dashboard?id=test-project',
        });
      }
    }, 10);
  }),
}));

// Global mock variables
let mockScannerShouldFail = false;
const mockFetchResponses: Map<string, any> = new Map();

// Mock fetch globally
const mockFetch = vi.fn((url: string | URL) => {
  const urlStr = url.toString();
  const response = mockFetchResponses.get(urlStr);

  if (!response) {
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('Not Found'),
    } as Response);
  }

  return Promise.resolve({
    ok: response.ok,
    status: response.status || 200,
    statusText: response.statusText || 'OK',
    json: () => Promise.resolve(response.data),
    text: () => Promise.resolve(JSON.stringify(response.data)),
  } as Response);
});

vi.stubGlobal('fetch', mockFetch);

describe('SonarQubeService', () => {
  let service: SonarQubeService;
  let config: SonarQubeConfig;

  beforeEach(() => {
    // Reset mocks
    mockScannerShouldFail = false;
    mockFetchResponses.clear();
    vi.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;

    // Default configuration
    config = {
      serverUrl: 'http://localhost:9000',
      token: 'test-token',
      projectKey: 'test-project',
      projectName: 'Test Project',
      projectVersion: '1.0.0',
      sources: 'src',
      exclusions: 'node_modules/**,dist/**',
      timeout: 3000,
    };

    service = new SonarQubeService(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with config', () => {
      expect(service).toBeDefined();
      expect(service.getMode()).toBe('DISABLED'); // Default mode before connection test
    });

    it('should accept minimal config', () => {
      const minimalConfig: SonarQubeConfig = {
        serverUrl: 'http://localhost:9000',
        projectKey: 'test-project',
      };
      const minimalService = new SonarQubeService(minimalConfig);
      expect(minimalService).toBeDefined();
    });
  });

  describe('testConnection', () => {
    it('should successfully test connection to SonarQube server', async () => {
      mockFetchResponses.set('http://localhost:9000/api/system/status', {
        ok: true,
        data: { status: 'UP', version: '9.9.0' },
      });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.version).toBe('9.9.0');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(service.getMode()).toBe('SERVER');
    });

    it('should handle connection failure', async () => {
      mockFetchResponses.set('http://localhost:9000/api/system/status', {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(service.getMode()).toBe('DISABLED');
    });

    it('should handle server DOWN status', async () => {
      mockFetchResponses.set('http://localhost:9000/api/system/status', {
        ok: true,
        data: { status: 'DOWN' },
      });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('DOWN');
      expect(service.getMode()).toBe('DISABLED');
    });

    it('should handle network errors', async () => {
      // Override fetch to throw an error
      global.fetch = vi.fn(() => {
        return Promise.reject(new Error('Network error'));
      }) as any;

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should respect timeout configuration', async () => {
      const slowConfig = { ...config, timeout: 100 };
      const slowService = new SonarQubeService(slowConfig);

      // Mock slow server
      global.fetch = vi.fn(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true } as Response), 200);
        });
      }) as any;

      const result = await slowService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getMode and isAvailable', () => {
    it('should return DISABLED mode before connection test', () => {
      expect(service.getMode()).toBe('DISABLED');
      expect(service.isAvailable()).toBe(false);
    });

    it('should return SERVER mode after successful connection', async () => {
      mockFetchResponses.set('http://localhost:9000/api/system/status', {
        ok: true,
        data: { status: 'UP', version: '9.9.0' },
      });

      await service.testConnection();

      expect(service.getMode()).toBe('SERVER');
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('executeScan', () => {
    it('should fail if server is not available', async () => {
      const result = await service.executeScan({
        workingDirectory: '/test/project',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
      expect(result.executionTime).toBe(0);
    });

    it('should execute scan successfully', async () => {
      // Set service to available mode
      mockFetchResponses.set('http://localhost:9000/api/system/status', {
        ok: true,
        data: { status: 'UP', version: '9.9.0' },
      });
      await service.testConnection();

      const result = await service.executeScan({
        workingDirectory: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('mock-task-id');
      expect(result.dashboardUrl).toContain('dashboard');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle scanner errors', async () => {
      // Set service to available mode
      mockFetchResponses.set('http://localhost:9000/api/system/status', {
        ok: true,
        data: { status: 'UP', version: '9.9.0' },
      });
      await service.testConnection();

      mockScannerShouldFail = true;

      const result = await service.executeScan({
        workingDirectory: '/test/project',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Scanner execution failed');
    });
  });

  describe('getAnalysisResult', () => {
    beforeEach(async () => {
      // Set service to available mode
      mockFetchResponses.set('http://localhost:9000/api/system/status', {
        ok: true,
        data: { status: 'UP', version: '9.9.0' },
      });
      await service.testConnection();
    });

    it('should throw error if server is not available', async () => {
      const unavailableService = new SonarQubeService(config);

      await expect(unavailableService.getAnalysisResult('test-project')).rejects.toThrow(
        'not available',
      );
    });

    it('should fetch complete analysis result', async () => {
      // Mock issues API
      const issuesUrl = new URL('http://localhost:9000/api/issues/search');
      issuesUrl.searchParams.set('componentKeys', 'test-project');
      issuesUrl.searchParams.set('resolved', 'false');
      issuesUrl.searchParams.set('ps', '500');
      mockFetchResponses.set(issuesUrl.toString(), {
        ok: true,
        data: {
          issues: [
            {
              key: 'issue-1',
              rule: 'javascript:S1234',
              severity: 'CRITICAL',
              type: 'BUG',
              component: 'test-project:src/file.ts',
              project: 'test-project',
              message: 'Critical bug found',
              status: 'OPEN',
              creationDate: '2025-01-20T00:00:00Z',
              updateDate: '2025-01-20T00:00:00Z',
            },
            {
              key: 'issue-2',
              rule: 'javascript:S5678',
              severity: 'MAJOR',
              type: 'CODE_SMELL',
              component: 'test-project:src/other.ts',
              project: 'test-project',
              message: 'Code smell detected',
              status: 'OPEN',
              creationDate: '2025-01-20T00:00:00Z',
              updateDate: '2025-01-20T00:00:00Z',
            },
          ],
        },
      });

      // Mock metrics API
      const metricsUrl = new URL('http://localhost:9000/api/measures/component');
      metricsUrl.searchParams.set('component', 'test-project');
      metricsUrl.searchParams.set(
        'metricKeys',
        'bugs,vulnerabilities,code_smells,security_hotspots,sqale_debt_ratio,coverage,ncloc,duplicated_lines_density',
      );
      mockFetchResponses.set(metricsUrl.toString(), {
        ok: true,
        data: {
          component: {
            measures: [
              { metric: 'bugs', value: '5' },
              { metric: 'vulnerabilities', value: '2' },
              { metric: 'code_smells', value: '15' },
              { metric: 'security_hotspots', value: '1' },
              { metric: 'sqale_debt_ratio', value: '8.5' },
              { metric: 'coverage', value: '75.3' },
              { metric: 'ncloc', value: '1234' },
              { metric: 'duplicated_lines_density', value: '3.2' },
            ],
          },
        },
      });

      // Mock quality gate API
      const qgUrl = new URL('http://localhost:9000/api/qualitygates/project_status');
      qgUrl.searchParams.set('projectKey', 'test-project');
      mockFetchResponses.set(qgUrl.toString(), {
        ok: true,
        data: {
          projectStatus: {
            status: 'OK',
            conditions: [
              {
                metricKey: 'coverage',
                comparator: 'LT',
                actualValue: '75.3',
                status: 'OK',
                errorThreshold: '70',
              },
            ],
          },
        },
      });

      const result = await service.getAnalysisResult('test-project');

      expect(result.projectKey).toBe('test-project');
      expect(result.issues).toHaveLength(2);
      expect(result.metrics.bugs).toBe(5);
      expect(result.metrics.vulnerabilities).toBe(2);
      expect(result.metrics.codeSmells).toBe(15);
      expect(result.metrics.coverage).toBe(75.3);
      expect(result.qualityGate.status).toBe('OK');
      expect(result.issuesBySeverity.CRITICAL).toBe(1);
      expect(result.issuesBySeverity.MAJOR).toBe(1);
      expect(result.issuesByType.BUG).toBe(1);
      expect(result.issuesByType.CODE_SMELL).toBe(1);
    });

    it('should handle API errors gracefully', async () => {
      // Mock failed API response
      const issuesUrl = 'http://localhost:9000/api/issues/search?componentKeys=test-project&resolved=false&ps=500';
      mockFetchResponses.set(issuesUrl, {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(service.getAnalysisResult('test-project')).rejects.toThrow(
        'Failed to fetch issues',
      );
    });
  });

  describe('waitForAnalysis', () => {
    beforeEach(async () => {
      // Set service to available mode
      mockFetchResponses.set('http://localhost:9000/api/system/status', {
        ok: true,
        data: { status: 'UP', version: '9.9.0' },
      });
      const result = await service.testConnection();
      if (!result.success) {
        console.error('testConnection failed in beforeEach:', result.error);
        throw new Error(`testConnection failed: ${result.error}`);
      }
    });

    it('should throw error if server is not available', async () => {
      const unavailableService = new SonarQubeService(config);

      await expect(unavailableService.waitForAnalysis('task-123')).rejects.toThrow(
        'not available',
      );
    });

    it('should return true when analysis completes successfully', async () => {
      const taskUrl = 'http://localhost:9000/api/ce/task?id=task-123';
      mockFetchResponses.set(taskUrl, {
        ok: true,
        data: {
          task: {
            status: 'SUCCESS',
          },
        },
      });

      const result = await service.waitForAnalysis('task-123', 5000);

      expect(result).toBe(true);
    });

    it('should throw error when analysis fails', async () => {
      const taskUrl = 'http://localhost:9000/api/ce/task?id=task-123';
      mockFetchResponses.set(taskUrl, {
        ok: true,
        data: {
          task: {
            status: 'FAILED',
            errorMessage: 'Analysis failed due to error',
          },
        },
      });

      await expect(service.waitForAnalysis('task-123', 5000)).rejects.toThrow('Analysis failed');
    });

    it('should throw error when analysis is canceled', async () => {
      const taskUrl = 'http://localhost:9000/api/ce/task?id=task-123';
      mockFetchResponses.set(taskUrl, {
        ok: true,
        data: {
          task: {
            status: 'CANCELED',
          },
        },
      });

      await expect(service.waitForAnalysis('task-123', 5000)).rejects.toThrow('CANCELED');
    });

    it('should timeout if analysis takes too long', async () => {
      const taskUrl = 'http://localhost:9000/api/ce/task?id=task-123';
      mockFetchResponses.set(taskUrl, {
        ok: true,
        data: {
          task: {
            status: 'PENDING', // Always pending
          },
        },
      });

      await expect(service.waitForAnalysis('task-123', 100)).rejects.toThrow('timeout');
    }, 10000);

    it('should handle API errors', async () => {
      const taskUrl = 'http://localhost:9000/api/ce/task?id=task-123';
      mockFetchResponses.set(taskUrl, {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(service.waitForAnalysis('task-123', 5000)).rejects.toThrow(
        'Failed to check task status',
      );
    });
  });
});
