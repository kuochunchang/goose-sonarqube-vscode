import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigLoader } from '../utils/ConfigLoader.js';
import { writeFile, rm, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('ConfigLoader', () => {
  const testConfigDir = '.test-config';
  const testConfigPath = resolve(process.cwd(), testConfigDir, '.goose-review.yml');

  beforeEach(async () => {
    // Create test config directory
    await mkdir(testConfigDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test config directory
    if (existsSync(testConfigDir)) {
      await rm(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('loadConfig', () => {
    it('should load valid configuration file', async () => {
      const configContent = `
sonarqube:
  serverUrl: http://localhost:9000
  token: test-token
  projectKey: test-project
  projectName: Test Project
  sources: src
  exclusions: node_modules/**,dist/**

analysis:
  types:
    codeQuality: true
    security: true
  ai:
    provider: openai
    model: gpt-4

cache:
  enabled: true
  ttl: 86400
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      const config = await ConfigLoader.loadConfig(testConfigPath);

      expect(config.sonarqube?.serverUrl).toBe('http://localhost:9000');
      expect(config.sonarqube?.token).toBe('test-token');
      expect(config.sonarqube?.projectKey).toBe('test-project');
      expect(config.analysis?.types?.codeQuality).toBe(true);
      expect(config.analysis?.ai?.provider).toBe('openai');
      expect(config.cache?.enabled).toBe(true);
    });

    it('should throw error if file does not exist', async () => {
      await expect(ConfigLoader.loadConfig('/non/existent/path')).rejects.toThrow(
        'not found',
      );
    });

    it('should parse boolean values correctly', async () => {
      const configContent = `
sonarqube:
  serverUrl: http://localhost:9000
  projectKey: test-project
  skipCertVerification: true

analysis:
  types:
    codeQuality: true
    security: false
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      const config = await ConfigLoader.loadConfig(testConfigPath);

      expect(config.sonarqube?.skipCertVerification).toBe(true);
      expect(config.analysis?.types?.codeQuality).toBe(true);
      expect(config.analysis?.types?.security).toBe(false);
    });

    it('should parse numeric values correctly', async () => {
      const configContent = `
sonarqube:
  serverUrl: http://localhost:9000
  projectKey: test-project
  timeout: 5000

cache:
  ttl: 3600

analysis:
  batch:
    maxFilesPerBatch: 10
    maxTokensPerBatch: 8000
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      const config = await ConfigLoader.loadConfig(testConfigPath);

      expect(config.sonarqube?.timeout).toBe(5000);
      expect(config.cache?.ttl).toBe(3600);
      expect(config.analysis?.batch?.maxFilesPerBatch).toBe(10);
      expect(config.analysis?.batch?.maxTokensPerBatch).toBe(8000);
    });

    it('should skip comments and empty lines', async () => {
      const configContent = `
# This is a comment
sonarqube:
  # Another comment
  serverUrl: http://localhost:9000

  projectKey: test-project

# Comment at the end
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      const config = await ConfigLoader.loadConfig(testConfigPath);

      expect(config.sonarqube?.serverUrl).toBe('http://localhost:9000');
      expect(config.sonarqube?.projectKey).toBe('test-project');
    });
  });

  describe('loadSonarQubeConfig', () => {
    it('should load SonarQube configuration', async () => {
      const configContent = `
sonarqube:
  serverUrl: http://localhost:9000
  token: test-token
  projectKey: test-project
  projectName: Test Project
  projectVersion: 1.0.0
  sources: src
  exclusions: node_modules/**
  timeout: 5000
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      const config = await ConfigLoader.loadSonarQubeConfig(testConfigPath);

      expect(config).not.toBeNull();
      expect(config?.serverUrl).toBe('http://localhost:9000');
      expect(config?.token).toBe('test-token');
      expect(config?.projectKey).toBe('test-project');
      expect(config?.projectName).toBe('Test Project');
      expect(config?.projectVersion).toBe('1.0.0');
      expect(config?.sources).toBe('src');
      expect(config?.exclusions).toBe('node_modules/**');
      expect(config?.timeout).toBe(5000);
    });

    it('should return null if no SonarQube config section', async () => {
      const configContent = `
analysis:
  types:
    codeQuality: true
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      const config = await ConfigLoader.loadSonarQubeConfig(testConfigPath);

      expect(config).toBeNull();
    });

    it('should return null if config file does not exist', async () => {
      const config = await ConfigLoader.loadSonarQubeConfig('/non/existent/path');

      expect(config).toBeNull();
    });

    it('should throw error if serverUrl is missing', async () => {
      const configContent = `
sonarqube:
  projectKey: test-project
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      await expect(ConfigLoader.loadSonarQubeConfig(testConfigPath)).rejects.toThrow(
        'serverUrl',
      );
    });

    it('should throw error if projectKey is missing', async () => {
      const configContent = `
sonarqube:
  serverUrl: http://localhost:9000
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      await expect(ConfigLoader.loadSonarQubeConfig(testConfigPath)).rejects.toThrow(
        'projectKey',
      );
    });
  });

  describe('configExists', () => {
    it('should return true if file exists', async () => {
      await writeFile(testConfigPath, 'test: value', 'utf-8');

      const exists = ConfigLoader.configExists(testConfigPath);

      expect(exists).toBe(true);
    });

    it('should return false if file does not exist', () => {
      const exists = ConfigLoader.configExists('/non/existent/path');

      expect(exists).toBe(false);
    });
  });

  describe('validation', () => {
    it('should validate serverUrl as valid URL', async () => {
      const configContent = `
sonarqube:
  serverUrl: invalid-url
  projectKey: test-project
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      await expect(ConfigLoader.loadConfig(testConfigPath)).rejects.toThrow(
        'valid URL',
      );
    });

    it('should validate batch settings', async () => {
      const configContent = `
sonarqube:
  serverUrl: http://localhost:9000
  projectKey: test-project

analysis:
  batch:
    maxFilesPerBatch: 0
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      await expect(ConfigLoader.loadConfig(testConfigPath)).rejects.toThrow(
        'maxFilesPerBatch',
      );
    });

    it('should validate cache TTL', async () => {
      const configContent = `
sonarqube:
  serverUrl: http://localhost:9000
  projectKey: test-project

cache:
  ttl: -1
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      await expect(ConfigLoader.loadConfig(testConfigPath)).rejects.toThrow(
        'ttl',
      );
    });

    it('should validate output format', async () => {
      const configContent = `
sonarqube:
  serverUrl: http://localhost:9000
  projectKey: test-project

output:
  format: invalid-format
`;

      await writeFile(testConfigPath, configContent, 'utf-8');

      await expect(ConfigLoader.loadConfig(testConfigPath)).rejects.toThrow(
        'format',
      );
    });

    it('should accept valid output formats', async () => {
      const formats = ['markdown', 'html', 'json'];

      for (const format of formats) {
        const configContent = `
sonarqube:
  serverUrl: http://localhost:9000
  projectKey: test-project

output:
  format: ${format}
`;

        await writeFile(testConfigPath, configContent, 'utf-8');

        const config = await ConfigLoader.loadConfig(testConfigPath);
        expect(config.output?.format).toBe(format);
      }
    });
  });
});
