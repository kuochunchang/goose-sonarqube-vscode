/**
 * AnalysisCacheService
 *
 * Caching service for analysis results to avoid redundant analysis
 * of unchanged code. Cache keys are based on diff hashes.
 */

import { createHash } from "crypto";
import { mkdir, readFile, writeFile, stat, rm } from "fs/promises";
import { existsSync } from "fs";
import { resolve, join } from "path";

/**
 * Cache entry metadata
 */
interface CacheEntry<T> {
  /**
   * Cache key
   */
  key: string;

  /**
   * Cached data
   */
  data: T;

  /**
   * Timestamp when cached
   */
  timestamp: number;

  /**
   * TTL in seconds
   */
  ttl: number;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /**
   * Total cache hits
   */
  hits: number;

  /**
   * Total cache misses
   */
  misses: number;

  /**
   * Hit rate percentage
   */
  hitRate: number;

  /**
   * Number of cached entries
   */
  entries: number;

  /**
   * Total cache size in bytes
   */
  sizeBytes: number;
}

/**
 * Analysis cache service
 */
export class AnalysisCacheService {
  private cacheDir: string;
  private ttl: number; // Time-to-live in seconds
  private enabled: boolean;
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Create a cache service
   * @param cacheDir Directory for cache storage
   * @param ttl Time-to-live in seconds (default: 24 hours)
   * @param enabled Whether caching is enabled
   */
  constructor(
    cacheDir: string = ".goose-review-cache",
    ttl: number = 86400,
    enabled: boolean = true
  ) {
    this.cacheDir = resolve(process.cwd(), cacheDir);
    this.ttl = ttl;
    this.enabled = enabled;
  }

  /**
   * Initialize cache directory
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (!existsSync(this.cacheDir)) {
      await mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Generate cache key from diff content
   * @param diff Git diff content
   * @param analysisType Type of analysis (e.g., 'sonarqube', 'ai-quality')
   * @returns Cache key (hash)
   */
  generateKey(diff: string, analysisType: string): string {
    const hash = createHash("sha256");
    hash.update(`${analysisType}:${diff}`);
    return hash.digest("hex");
  }

  /**
   * Get cached analysis result
   * @param key Cache key
   * @returns Cached data or null if not found/expired
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const filePath = this.getCacheFilePath(key);

      if (!existsSync(filePath)) {
        this.misses++;
        return null;
      }

      const content = await readFile(filePath, "utf-8");
      const entry: CacheEntry<T> = JSON.parse(content);

      // Check if expired
      const age = (Date.now() - entry.timestamp) / 1000; // Age in seconds
      if (age > entry.ttl) {
        // Expired, delete and return null
        await rm(filePath, { force: true });
        this.misses++;
        return null;
      }

      this.hits++;
      return entry.data;
    } catch {
      // On any error, treat as cache miss
      this.misses++;
      return null;
    }
  }

  /**
   * Store analysis result in cache
   * @param key Cache key
   * @param data Data to cache
   * @param metadata Optional metadata
   */
  async set<T>(key: string, data: T, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.initialize();

      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
        ttl: this.ttl,
        metadata,
      };

      const filePath = this.getCacheFilePath(key);
      await writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
    } catch (error) {
      // Silently fail on cache write errors
      console.warn(
        `Failed to write cache: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Check if a key exists in cache (and is not expired)
   * @param key Cache key
   * @returns True if key exists and is valid
   */
  async has(key: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Delete a cache entry
   * @param key Cache key
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const filePath = this.getCacheFilePath(key);
      await rm(filePath, { force: true });
    } catch {
      // Ignore errors
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await rm(this.cacheDir, { recursive: true, force: true });
      await this.initialize();
      this.hits = 0;
      this.misses = 0;
    } catch {
      // Ignore errors
    }
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!this.enabled) {
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        entries: 0,
        sizeBytes: 0,
      };
    }

    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    let entries = 0;
    let sizeBytes = 0;

    try {
      if (existsSync(this.cacheDir)) {
        const { readdir } = await import("fs/promises");
        const files = await readdir(this.cacheDir);

        entries = files.length;

        for (const file of files) {
          const filePath = join(this.cacheDir, file);
          const stats = await stat(filePath);
          sizeBytes += stats.size;
        }
      }
    } catch {
      // Ignore errors
    }

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      entries,
      sizeBytes,
    };
  }

  /**
   * Clean up expired cache entries
   * @returns Number of entries deleted
   */
  async cleanExpired(): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    let deleted = 0;

    try {
      if (!existsSync(this.cacheDir)) {
        return 0;
      }

      const { readdir } = await import("fs/promises");
      const files = await readdir(this.cacheDir);

      for (const file of files) {
        const filePath = join(this.cacheDir, file);

        try {
          const content = await readFile(filePath, "utf-8");
          const entry: CacheEntry<unknown> = JSON.parse(content);

          const age = (Date.now() - entry.timestamp) / 1000;
          if (age > entry.ttl) {
            await rm(filePath, { force: true });
            deleted++;
          }
        } catch {
          // If we can't read/parse the entry, delete it
          await rm(filePath, { force: true });
          deleted++;
        }
      }
    } catch {
      // Ignore errors
    }

    return deleted;
  }

  /**
   * Get cache file path for a key
   * @param key Cache key
   * @returns File path
   */
  private getCacheFilePath(key: string): string {
    return join(this.cacheDir, `${key}.json`);
  }

  /**
   * Enable caching
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable caching
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Check if caching is enabled
   * @returns True if enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}
