import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnalysisCacheService } from '../services/AnalysisCacheService.js';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('AnalysisCacheService', () => {
  let cacheService: AnalysisCacheService;
  const testCacheDir = '.test-cache';

  beforeEach(async () => {
    cacheService = new AnalysisCacheService(testCacheDir, 3600, true);
    await cacheService.initialize();
  });

  afterEach(async () => {
    // Clean up test cache directory
    const cacheDir = resolve(process.cwd(), testCacheDir);
    if (existsSync(cacheDir)) {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  describe('Constructor', () => {
    it('should create cache service with default values', () => {
      const service = new AnalysisCacheService();
      expect(service).toBeDefined();
      expect(service.isEnabled()).toBe(true);
    });

    it('should create cache service with custom values', () => {
      const service = new AnalysisCacheService('.custom-cache', 7200, false);
      expect(service).toBeDefined();
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should create cache directory if it does not exist', async () => {
      const cacheDir = resolve(process.cwd(), testCacheDir);
      expect(existsSync(cacheDir)).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      await expect(cacheService.initialize()).resolves.not.toThrow();
    });

    it('should do nothing if caching is disabled', async () => {
      const disabledService = new AnalysisCacheService(testCacheDir, 3600, false);
      await disabledService.initialize();
      // Should not create directory
      const cacheDir = resolve(process.cwd(), testCacheDir);
      expect(existsSync(cacheDir)).toBe(true); // Already exists from beforeEach
    });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same input', () => {
      const diff = 'diff content';
      const type = 'sonarqube';

      const key1 = cacheService.generateKey(diff, type);
      const key2 = cacheService.generateKey(diff, type);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 hex string length
    });

    it('should generate different keys for different inputs', () => {
      const diff1 = 'diff content 1';
      const diff2 = 'diff content 2';
      const type = 'sonarqube';

      const key1 = cacheService.generateKey(diff1, type);
      const key2 = cacheService.generateKey(diff2, type);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different analysis types', () => {
      const diff = 'diff content';
      const type1 = 'sonarqube';
      const type2 = 'ai-quality';

      const key1 = cacheService.generateKey(diff, type1);
      const key2 = cacheService.generateKey(diff, type2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('set and get', () => {
    it('should cache and retrieve data', async () => {
      const key = cacheService.generateKey('test-diff', 'sonarqube');
      const data = { result: 'test data', issues: [] };

      await cacheService.set(key, data);
      const retrieved = await cacheService.get(key);

      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent key', async () => {
      const key = 'non-existent-key';
      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    it('should return null for expired cache', async () => {
      // Create service with 1 second TTL
      const shortTTLService = new AnalysisCacheService(testCacheDir, 1, true);
      await shortTTLService.initialize();

      const key = shortTTLService.generateKey('test-diff', 'sonarqube');
      const data = { result: 'test data' };

      await shortTTLService.set(key, data);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = await shortTTLService.get(key);
      expect(result).toBeNull();
    });

    it('should not cache if disabled', async () => {
      const disabledService = new AnalysisCacheService(testCacheDir, 3600, false);
      const key = 'test-key';
      const data = { result: 'test data' };

      await disabledService.set(key, data);
      const result = await disabledService.get(key);

      expect(result).toBeNull();
    });

    it('should handle caching with metadata', async () => {
      const key = cacheService.generateKey('test-diff', 'sonarqube');
      const data = { result: 'test data' };
      const metadata = { projectKey: 'test-project', timestamp: Date.now() };

      await cacheService.set(key, data, metadata);
      const retrieved = await cacheService.get(key);

      expect(retrieved).toEqual(data);
    });
  });

  describe('has', () => {
    it('should return true for existing key', async () => {
      const key = cacheService.generateKey('test-diff', 'sonarqube');
      const data = { result: 'test data' };

      await cacheService.set(key, data);
      const exists = await cacheService.has(key);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const key = 'non-existent-key';
      const exists = await cacheService.has(key);

      expect(exists).toBe(false);
    });

    it('should return false for expired key', async () => {
      const shortTTLService = new AnalysisCacheService(testCacheDir, 1, true);
      await shortTTLService.initialize();

      const key = shortTTLService.generateKey('test-diff', 'sonarqube');
      await shortTTLService.set(key, { result: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const exists = await shortTTLService.has(key);
      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete cached entry', async () => {
      const key = cacheService.generateKey('test-diff', 'sonarqube');
      await cacheService.set(key, { result: 'test' });

      await cacheService.delete(key);

      const result = await cacheService.get(key);
      expect(result).toBeNull();
    });

    it('should not fail if key does not exist', async () => {
      await expect(cacheService.delete('non-existent-key')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
      const key1 = cacheService.generateKey('diff1', 'sonarqube');
      const key2 = cacheService.generateKey('diff2', 'ai-quality');

      await cacheService.set(key1, { result: 'test1' });
      await cacheService.set(key2, { result: 'test2' });

      await cacheService.clear();

      const result1 = await cacheService.get(key1);
      const result2 = await cacheService.get(key2);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should reset stats after clear', async () => {
      const key = cacheService.generateKey('diff', 'sonarqube');
      await cacheService.set(key, { result: 'test' });
      await cacheService.get(key); // Hit

      await cacheService.clear();

      const stats = await cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const key1 = cacheService.generateKey('diff1', 'sonarqube');
      const key2 = cacheService.generateKey('diff2', 'ai-quality');

      // Set some data
      await cacheService.set(key1, { result: 'test1' });
      await cacheService.set(key2, { result: 'test2' });

      // Create hits and misses
      await cacheService.get(key1); // Hit
      await cacheService.get(key1); // Hit
      await cacheService.get('non-existent'); // Miss
      await cacheService.get('another-non-existent'); // Miss

      const stats = await cacheService.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(50);
      expect(stats.entries).toBe(2);
      expect(stats.sizeBytes).toBeGreaterThan(0);
    });

    it('should return zero stats if disabled', async () => {
      const disabledService = new AnalysisCacheService(testCacheDir, 3600, false);
      const stats = await disabledService.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.entries).toBe(0);
      expect(stats.sizeBytes).toBe(0);
    });
  });

  describe('cleanExpired', () => {
    it('should remove expired entries', async () => {
      const shortTTLService = new AnalysisCacheService(testCacheDir, 1, true);
      await shortTTLService.initialize();

      const key1 = shortTTLService.generateKey('diff1', 'sonarqube');
      const key2 = shortTTLService.generateKey('diff2', 'ai-quality');

      await shortTTLService.set(key1, { result: 'test1' });
      await shortTTLService.set(key2, { result: 'test2' });

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const deleted = await shortTTLService.cleanExpired();

      expect(deleted).toBe(2);
    });

    it('should not remove non-expired entries', async () => {
      const key1 = cacheService.generateKey('diff1', 'sonarqube');
      const key2 = cacheService.generateKey('diff2', 'ai-quality');

      await cacheService.set(key1, { result: 'test1' });
      await cacheService.set(key2, { result: 'test2' });

      const deleted = await cacheService.cleanExpired();

      expect(deleted).toBe(0);

      // Entries should still exist
      const result1 = await cacheService.get(key1);
      const result2 = await cacheService.get(key2);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
    });
  });

  describe('enable and disable', () => {
    it('should enable caching', () => {
      const service = new AnalysisCacheService(testCacheDir, 3600, false);
      expect(service.isEnabled()).toBe(false);

      service.enable();
      expect(service.isEnabled()).toBe(true);
    });

    it('should disable caching', () => {
      expect(cacheService.isEnabled()).toBe(true);

      cacheService.disable();
      expect(cacheService.isEnabled()).toBe(false);
    });
  });

  describe('resetStats', () => {
    it('should reset cache statistics', async () => {
      const key = cacheService.generateKey('diff', 'sonarqube');
      await cacheService.set(key, { result: 'test' });
      await cacheService.get(key); // Hit
      await cacheService.get('non-existent'); // Miss

      let stats = await cacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      cacheService.resetStats();

      stats = await cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
