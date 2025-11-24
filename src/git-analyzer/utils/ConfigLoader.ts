/**
 * ConfigLoader
 *
 * Utility for loading and validating .goose-review.yml configuration
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve } from "path";
import type { SonarQubeConfig } from "../types/sonarqube.types.js";

/**
 * Configuration file structure
 */
export interface GooseReviewConfig {
  sonarqube?: {
    serverUrl: string;
    token?: string;
    projectKey: string;
    projectName?: string;
    projectVersion?: string;
    sources?: string;
    exclusions?: string;
    timeout?: number;
    skipCertVerification?: boolean;
    additionalProperties?: Record<string, string>;
  };
  analysis?: {
    types?: {
      codeQuality?: boolean;
      security?: boolean;
      impact?: boolean;
      architecture?: boolean;
      testCoverage?: boolean;
      performance?: boolean;
    };
    ai?: {
      provider?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
    batch?: {
      maxFilesPerBatch?: number;
      maxTokensPerBatch?: number;
      parallelBatches?: number;
    };
  };
  cache?: {
    enabled?: boolean;
    ttl?: number;
    directory?: string;
  };
  git?: {
    ignorePatterns?: string[];
    maxFileSize?: number;
  };
  output?: {
    format?: "markdown" | "html" | "json";
    destination?: string;
    includeMetrics?: boolean;
    includeDashboardUrl?: boolean;
  };
}

/**
 * Load configuration from .goose-review.yml file
 */
export class ConfigLoader {
  /**
   * Load configuration from a file path
   * @param filePath Path to configuration file (defaults to .goose-review.yml in cwd)
   * @returns Parsed configuration
   */
  static async loadConfig(filePath?: string): Promise<GooseReviewConfig> {
    const configPath = filePath || resolve(process.cwd(), ".goose-review.yml");

    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    try {
      const content = await readFile(configPath, "utf-8");
      const config = this.parseYaml(content);
      this.validateConfig(config);
      return config;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load configuration: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load SonarQube configuration from config file
   * @param filePath Path to configuration file
   * @returns SonarQube configuration
   */
  static async loadSonarQubeConfig(filePath?: string): Promise<SonarQubeConfig | null> {
    try {
      const config = await this.loadConfig(filePath);

      if (!config.sonarqube) {
        return null;
      }

      const sqConfig = config.sonarqube;

      if (!sqConfig.serverUrl || !sqConfig.projectKey) {
        throw new Error("SonarQube configuration requires serverUrl and projectKey");
      }

      return {
        serverUrl: sqConfig.serverUrl,
        token: sqConfig.token,
        projectKey: sqConfig.projectKey,
        projectName: sqConfig.projectName,
        projectVersion: sqConfig.projectVersion,
        sources: sqConfig.sources,
        exclusions: sqConfig.exclusions,
        timeout: sqConfig.timeout,
        skipCertVerification: sqConfig.skipCertVerification,
        additionalProperties: sqConfig.additionalProperties,
      };
    } catch (error) {
      // If config file doesn't exist, return null (optional SonarQube)
      if (error instanceof Error && error.message.includes("not found")) {
        return null;
      }
      // Re-throw validation errors
      throw error;
    }
  }

  /**
   * Check if configuration file exists
   * @param filePath Path to configuration file
   * @returns True if file exists
   */
  static configExists(filePath?: string): boolean {
    const configPath = filePath || resolve(process.cwd(), ".goose-review.yml");
    return existsSync(configPath);
  }

  /**
   * Simple YAML parser (handles basic key-value and nested structures)
   * For production use, consider using a full YAML library like 'yaml' or 'js-yaml'
   * @param content YAML content
   * @returns Parsed configuration object
   */
  private static parseYaml(content: string): GooseReviewConfig {
    const lines = content.split("\n");
    const result: GooseReviewConfig = {};
    const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [
      { obj: result as Record<string, unknown>, indent: -1 },
    ];

    for (const line of lines) {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith("#")) {
        continue;
      }

      const indent = line.search(/\S/);
      const trimmedLine = line.trim();

      // Pop stack until we find the correct parent level
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }

      const currentParent = stack[stack.length - 1].obj;

      if (trimmedLine.includes(":")) {
        const colonIndex = trimmedLine.indexOf(":");
        const key = trimmedLine.substring(0, colonIndex).trim();
        const valueStr = trimmedLine.substring(colonIndex + 1).trim();

        if (valueStr === "") {
          // Nested object
          const newObj: Record<string, unknown> = {};
          currentParent[key] = newObj;
          stack.push({ obj: newObj, indent });
        } else if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
          // Array value
          const arrayContent = valueStr.slice(1, -1);
          currentParent[key] = arrayContent.split(",").map((v) => v.trim());
        } else {
          // Simple value
          currentParent[key] = this.parseValue(valueStr);
        }
      } else if (trimmedLine.startsWith("-")) {
        // Array item
        const value = trimmedLine.substring(1).trim();
        if (!Array.isArray(currentParent)) {
          // Convert parent to array if needed
          const lastKey = Object.keys(currentParent).pop();
          if (lastKey) {
            currentParent[lastKey] = [this.parseValue(value)];
          }
        }
      }
    }

    return result;
  }

  /**
   * Parse a YAML value to the appropriate JavaScript type
   * @param value String value from YAML
   * @returns Parsed value
   */
  private static parseValue(value: string): unknown {
    // Boolean
    if (value === "true") return true;
    if (value === "false") return false;

    // Null
    if (value === "null" || value === "~") return null;

    // Number
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

    // String (remove quotes if present)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    return value;
  }

  /**
   * Validate configuration structure
   * @param config Configuration to validate
   * @throws Error if configuration is invalid
   */
  private static validateConfig(config: GooseReviewConfig): void {
    if (config.sonarqube) {
      if (!config.sonarqube.serverUrl) {
        throw new Error("sonarqube.serverUrl is required");
      }
      if (!config.sonarqube.projectKey) {
        throw new Error("sonarqube.projectKey is required");
      }

      // Validate URL format
      try {
        new URL(config.sonarqube.serverUrl);
      } catch {
        throw new Error("sonarqube.serverUrl must be a valid URL");
      }
    }

    if (config.analysis?.batch) {
      const batch = config.analysis.batch;
      if (batch.maxFilesPerBatch !== undefined && batch.maxFilesPerBatch < 1) {
        throw new Error("analysis.batch.maxFilesPerBatch must be >= 1");
      }
      if (batch.maxTokensPerBatch !== undefined && batch.maxTokensPerBatch < 100) {
        throw new Error("analysis.batch.maxTokensPerBatch must be >= 100");
      }
      if (batch.parallelBatches !== undefined && batch.parallelBatches < 1) {
        throw new Error("analysis.batch.parallelBatches must be >= 1");
      }
    }

    if (config.cache?.ttl !== undefined && config.cache.ttl < 0) {
      throw new Error("cache.ttl must be >= 0");
    }

    if (config.output?.format && !["markdown", "html", "json"].includes(config.output.format)) {
      throw new Error("output.format must be one of: markdown, html, json");
    }
  }
}
