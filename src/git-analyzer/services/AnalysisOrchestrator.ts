/**
 * AnalysisOrchestrator
 *
 * Orchestrates the analysis workflow with automatic mode detection,
 * graceful degradation, and hybrid analysis (SonarQube + AI).
 */

import type { SonarQubeService } from './SonarQubeService.js';
import type { SonarQubeMode } from '../types/sonarqube.types.js';
import { ConfigLoader } from '../utils/ConfigLoader.js';

/**
 * Analysis mode after detection
 */
export enum AnalysisMode {
  /**
   * Hybrid mode: SonarQube + AI analysis
   */
  HYBRID = 'HYBRID',

  /**
   * AI-only mode: No SonarQube available
   */
  AI_ONLY = 'AI_ONLY',

  /**
   * SonarQube-only mode: No AI provider configured
   */
  SONARQUBE_ONLY = 'SONARQUBE_ONLY',
}

/**
 * Mode detection result
 */
export interface ModeDetectionResult {
  /**
   * Detected analysis mode
   */
  mode: AnalysisMode;

  /**
   * SonarQube availability
   */
  sonarQubeAvailable: boolean;

  /**
   * SonarQube mode (if available)
   */
  sonarQubeMode?: SonarQubeMode;

  /**
   * AI provider availability
   */
  aiProviderAvailable: boolean;

  /**
   * Detection messages
   */
  messages: string[];

  /**
   * SonarQube server version (if available)
   */
  sonarQubeVersion?: string;
}

/**
 * Orchestrator for managing analysis workflow
 */
export class AnalysisOrchestrator {
  private sonarQubeService?: SonarQubeService;
  private aiProviderAvailable: boolean;
  private detectionResult?: ModeDetectionResult;

  /**
   * Create an analysis orchestrator
   * @param sonarQubeService Optional SonarQube service instance
   * @param aiProviderAvailable Whether AI provider is configured
   */
  constructor(sonarQubeService?: SonarQubeService, aiProviderAvailable: boolean = false) {
    this.sonarQubeService = sonarQubeService;
    this.aiProviderAvailable = aiProviderAvailable;
  }

  /**
   * Detect and configure optimal analysis mode
   * @returns Mode detection result with configuration
   */
  async detectMode(): Promise<ModeDetectionResult> {
    const messages: string[] = [];
    let sonarQubeAvailable = false;
    let sonarQubeMode: SonarQubeMode | undefined;
    let sonarQubeVersion: string | undefined;

    // Test SonarQube availability
    if (this.sonarQubeService) {
      messages.push('Testing SonarQube server connection...');

      const connectionTest = await this.sonarQubeService.testConnection();

      if (connectionTest.success) {
        sonarQubeAvailable = true;
        sonarQubeMode = this.sonarQubeService.getMode();
        sonarQubeVersion = connectionTest.version;
        messages.push(
          `✓ SonarQube server connected (v${sonarQubeVersion}, ${connectionTest.responseTime}ms)`,
        );
      } else {
        messages.push(`✗ SonarQube server unavailable: ${connectionTest.error}`);
        messages.push('  Falling back to AI-only analysis');
      }
    } else {
      messages.push('SonarQube service not configured');
    }

    // Determine analysis mode
    let mode: AnalysisMode;

    if (sonarQubeAvailable && this.aiProviderAvailable) {
      mode = AnalysisMode.HYBRID;
      messages.push('✓ Analysis mode: HYBRID (SonarQube + AI)');
    } else if (sonarQubeAvailable) {
      mode = AnalysisMode.SONARQUBE_ONLY;
      messages.push('✓ Analysis mode: SONARQUBE_ONLY (no AI provider configured)');
    } else if (this.aiProviderAvailable) {
      mode = AnalysisMode.AI_ONLY;
      messages.push('✓ Analysis mode: AI_ONLY (SonarQube unavailable)');
    } else {
      throw new Error(
        'No analysis provider available. Configure either SonarQube server or AI provider.',
      );
    }

    this.detectionResult = {
      mode,
      sonarQubeAvailable,
      sonarQubeMode,
      aiProviderAvailable: this.aiProviderAvailable,
      messages,
      sonarQubeVersion,
    };

    return this.detectionResult;
  }

  /**
   * Get current detection result (must call detectMode first)
   * @returns Detection result
   */
  getDetectionResult(): ModeDetectionResult | undefined {
    return this.detectionResult;
  }

  /**
   * Get current analysis mode
   * @returns Current mode or undefined if not detected yet
   */
  getMode(): AnalysisMode | undefined {
    return this.detectionResult?.mode;
  }

  /**
   * Check if SonarQube is available
   * @returns True if SonarQube is available
   */
  isSonarQubeAvailable(): boolean {
    return this.detectionResult?.sonarQubeAvailable ?? false;
  }

  /**
   * Check if AI provider is available
   * @returns True if AI provider is available
   */
  isAIProviderAvailable(): boolean {
    return this.aiProviderAvailable;
  }

  /**
   * Create an orchestrator with automatic configuration loading
   * @param configPath Optional path to configuration file
   * @param aiProviderAvailable Whether AI provider is configured
   * @returns Configured orchestrator instance
   */
  static async createWithConfig(
    configPath?: string,
    aiProviderAvailable: boolean = false,
  ): Promise<AnalysisOrchestrator> {
    let sonarQubeService: SonarQubeService | undefined;

    // Try to load SonarQube configuration
    const sonarQubeConfig = await ConfigLoader.loadSonarQubeConfig(configPath);

    if (sonarQubeConfig) {
      // Dynamically import SonarQubeService to avoid circular dependency
      const { SonarQubeService: SQService } = await import('./SonarQubeService.js');
      sonarQubeService = new SQService(sonarQubeConfig);
    }

    return new AnalysisOrchestrator(sonarQubeService, aiProviderAvailable);
  }

  /**
   * Get a summary message of the current configuration
   * @returns Summary string
   */
  getSummary(): string {
    if (!this.detectionResult) {
      return 'Analysis mode not detected yet. Call detectMode() first.';
    }

    const lines: string[] = [
      '─────────────────────────────────────────',
      '  Analysis Configuration Summary',
      '─────────────────────────────────────────',
      `  Mode: ${this.detectionResult.mode}`,
      `  SonarQube: ${this.detectionResult.sonarQubeAvailable ? '✓ Available' : '✗ Unavailable'}`,
    ];

    if (this.detectionResult.sonarQubeVersion) {
      lines.push(`  SonarQube Version: ${this.detectionResult.sonarQubeVersion}`);
    }

    lines.push(`  AI Provider: ${this.detectionResult.aiProviderAvailable ? '✓ Available' : '✗ Unavailable'}`);
    lines.push('─────────────────────────────────────────');

    return lines.join('\n');
  }
}
