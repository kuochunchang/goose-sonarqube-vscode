/**
 * Change analyzer service - integrates Git changes with AI analysis
 * Provides batch processing and token-aware analysis
 */

import type { GitChanges } from '../types/git.types.js';
import type {
  AnalysisOptions,
  ChangeAnalysisResult,
  FileAnalysis,
  ImpactAnalysis,
  AIAnalysisResult,
} from '../types/analysis.types.js';
import { GitService } from './GitService.js';
import { DiffParser, type ParsedFileChange } from '../utils/DiffParser.js';
import { TokenCounter } from '../utils/TokenCounter.js';
import {
  buildQualityAnalysisPrompt,
  buildSecurityAnalysisPrompt,
  buildImpactAnalysisPrompt,
  buildArchitectureReviewPrompt,
} from './AIPrompts.js';

/**
 * AI provider interface (minimal definition for git-analyzer package)
 */
export interface IAIProvider {
  analyzeCode(code: string, options?: any): Promise<any>;
}

/**
 * Change analyzer configuration
 */
export interface ChangeAnalyzerConfig {
  /** AI provider instance (optional - only required for AI-based analysis) */
  aiProvider?: IAIProvider;
  /** Maximum tokens per AI request (default: 6000) */
  maxTokensPerBatch?: number;
  /** Safety margin for token counting (default: 0.9) */
  tokenSafetyMargin?: number;
  /** Maximum parallel AI requests (default: 3) */
  maxParallelRequests?: number;
  /** Repository root path */
  repoPath?: string;
}

/**
 * Analysis type enum
 */
export type AnalysisType = 'quality' | 'security' | 'impact' | 'architecture';

/**
 * Change analyzer service
 * Orchestrates AI analysis of Git changes with intelligent batching
 */
export class ChangeAnalyzer {
  private readonly gitService: GitService;
  private readonly diffParser: DiffParser;
  private readonly tokenCounter: TokenCounter;
  private readonly aiProvider: IAIProvider | undefined;
  private readonly maxParallelRequests: number;

  constructor(config: ChangeAnalyzerConfig) {
    this.aiProvider = config.aiProvider;
    this.maxParallelRequests = config.maxParallelRequests ?? 3;

    this.gitService = new GitService(config.repoPath || process.cwd());
    this.diffParser = new DiffParser();
    this.tokenCounter = new TokenCounter({
      maxTokensPerBatch: config.maxTokensPerBatch ?? 6000,
      safetyMargin: config.tokenSafetyMargin,
    });
  }

  /**
   * Analyze working directory changes
   * @param options - Analysis options
   * @returns Complete analysis result
   */
  async analyzeWorkingDirectory(options: AnalysisOptions = {}): Promise<ChangeAnalysisResult> {
    const startTime = Date.now();

    const changes = await this.gitService.getWorkingDirectoryChanges();

    if (changes.files.length === 0) {
      return this.createEmptyResult(changes, startTime);
    }

    const result = await this.performAnalysis(changes, options);

    return {
      ...result,
      changeType: changes.type,
      summary: changes.summary,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Analyze branch comparison
   * @param baseBranch - Base branch name
   * @param compareBranch - Compare branch name (default: current branch)
   * @param options - Analysis options
   * @returns Complete analysis result
   */
  async analyzeBranchComparison(
    baseBranch: string,
    compareBranch?: string,
    options: AnalysisOptions = {}
  ): Promise<ChangeAnalysisResult> {
    const startTime = Date.now();

    const changes = await this.gitService.compareBranches(
      baseBranch,
      compareBranch || (await this.gitService.getCurrentBranch())
    );

    if (changes.files.length === 0) {
      return this.createEmptyResult(changes, startTime);
    }

    const result = await this.performAnalysis(changes, options);

    return {
      ...result,
      changeType: changes.type,
      summary: changes.summary,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Perform analysis on Git changes
   * @param changes - Git changes to analyze
   * @param options - Analysis options
   * @returns Analysis result
   */
  private async performAnalysis(
    changes: GitChanges,
    options: AnalysisOptions
  ): Promise<Omit<ChangeAnalysisResult, 'changeType' | 'summary' | 'duration'>> {
    const parsedChanges = this.diffParser.parseGitChanges(changes);

    const fileAnalyses: FileAnalysis[] = [];
    let impactAnalysis: ImpactAnalysis = this.createDefaultImpactAnalysis();

    if (options.checkQuality !== false) {
      const qualityResults = await this.analyzeQuality(parsedChanges);
      this.mergeFileAnalyses(fileAnalyses, qualityResults.fileAnalyses);
    }

    if (options.checkSecurity !== false) {
      const securityResults = await this.analyzeSecurity(parsedChanges);
      this.mergeFileAnalyses(fileAnalyses, securityResults.fileAnalyses);
    }

    if (options.checkArchitecture) {
      const architectureReview = await this.analyzeArchitecture(parsedChanges);
      console.log('Architecture Review:', architectureReview);
    }

    const commitMessages = changes.type !== 'working-directory' ? changes.commits : undefined;
    const impactResults = await this.analyzeImpact(parsedChanges, commitMessages);
    impactAnalysis = impactResults.impactAnalysis;
    this.mergeFileAnalyses(fileAnalyses, impactResults.fileAnalyses);

    if (fileAnalyses.length === 0) {
      for (const change of parsedChanges) {
        fileAnalyses.push(this.createDefaultFileAnalysis(change));
      }
    }

    return {
      fileAnalyses,
      impactAnalysis,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Analyze code quality
   * @param parsedChanges - Parsed file changes
   * @returns AI analysis result
   */
  private async analyzeQuality(parsedChanges: ParsedFileChange[]): Promise<AIAnalysisResult> {
    const batches = this.createSmartBatches(parsedChanges);
    const results = await this.processBatchesInParallel(batches, 'quality');

    return this.combineResults(results);
  }

  /**
   * Analyze security
   * @param parsedChanges - Parsed file changes
   * @returns AI analysis result
   */
  private async analyzeSecurity(parsedChanges: ParsedFileChange[]): Promise<AIAnalysisResult> {
    const batches = this.createSmartBatches(parsedChanges);
    const results = await this.processBatchesInParallel(batches, 'security');

    return this.combineResults(results);
  }

  /**
   * Analyze impact
   * @param parsedChanges - Parsed file changes
   * @param commits - Optional commits with full info
   * @returns AI analysis result
   */
  private async analyzeImpact(
    parsedChanges: ParsedFileChange[],
    commits?: Array<{
      sha: string;
      message: string;
      author: string;
      email: string;
      date: string;
    }>
  ): Promise<AIAnalysisResult> {
    const batches = this.createSmartBatches(parsedChanges);
    const commitMessages = commits?.map((c) => c.message);
    const results = await this.processBatchesInParallel(batches, 'impact', commitMessages);

    return this.combineResults(results);
  }

  /**
   * Analyze architecture
   * @param parsedChanges - Parsed file changes
   * @returns Architecture review text
   */
  private async analyzeArchitecture(parsedChanges: ParsedFileChange[]): Promise<string> {
    const batches = this.createSmartBatches(parsedChanges);

    if (batches.length === 0) {
      return 'No changes to analyze.';
    }

    if (!this.aiProvider) {
      return 'AI provider not available for architecture analysis.';
    }

    const prompt = buildArchitectureReviewPrompt(batches[0]);

    try {
      const response = await this.aiProvider.analyzeCode(prompt);
      return response.summary || response.toString();
    } catch (error) {
      console.error('Architecture analysis failed:', error);
      return 'Architecture analysis unavailable.';
    }
  }

  /**
   * Create smart batches based on file size and token limits
   * @param parsedChanges - Parsed file changes
   * @returns Batches of parsed changes
   */
  private createSmartBatches(parsedChanges: ParsedFileChange[]): ParsedFileChange[][] {
    const sortedChanges = this.diffParser.sortByComplexity(parsedChanges);

    const batches: ParsedFileChange[][] = [];
    let currentBatch: ParsedFileChange[] = [];
    let currentTokens = 0;

    const effectiveMax = this.tokenCounter.getEffectiveMaxTokens();

    for (const change of sortedChanges) {
      const formattedDiff = this.diffParser.formatDiffForAnalysis(change);
      const tokens = this.tokenCounter.countTokens(formattedDiff);

      if (tokens > effectiveMax) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentTokens = 0;
        }

        batches.push([change]);
        continue;
      }

      if (currentTokens + tokens > effectiveMax) {
        batches.push(currentBatch);
        currentBatch = [change];
        currentTokens = tokens;
      } else {
        currentBatch.push(change);
        currentTokens += tokens;
      }
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Process batches in parallel with concurrency limit
   * @param batches - Batches to process
   * @param analysisType - Type of analysis
   * @param commitMessages - Optional commit messages for context
   * @returns Array of AI analysis results
   */
  private async processBatchesInParallel(
    batches: ParsedFileChange[][],
    analysisType: AnalysisType,
    commitMessages?: string[]
  ): Promise<AIAnalysisResult[]> {
    const results: AIAnalysisResult[] = [];

    for (let i = 0; i < batches.length; i += this.maxParallelRequests) {
      const batchSlice = batches.slice(i, i + this.maxParallelRequests);

      const promises = batchSlice.map((batch) =>
        this.analyzeBatch(batch, analysisType, commitMessages)
      );

      const batchResults = await Promise.allSettled(promises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Batch analysis failed:', result.reason);
        }
      }
    }

    return results;
  }

  /**
   * Analyze a single batch
   * @param batch - Batch of parsed changes
   * @param analysisType - Type of analysis
   * @param commitMessages - Optional commit messages
   * @returns AI analysis result
   */
  private async analyzeBatch(
    batch: ParsedFileChange[],
    analysisType: AnalysisType,
    commitMessages?: string[]
  ): Promise<AIAnalysisResult> {
    if (!this.aiProvider) {
      // Return default analysis when AI provider is not available
      return {
        fileAnalyses: batch.map((change) => this.createDefaultFileAnalysis(change)),
        impactAnalysis: this.createDefaultImpactAnalysis(),
      };
    }

    const prompt = this.buildPrompt(batch, analysisType, commitMessages);

    try {
      const response = await this.aiProvider.analyzeCode(prompt);

      return this.parseAIResponse(response, batch);
    } catch (error) {
      console.error(`${analysisType} analysis failed:`, error);

      return {
        fileAnalyses: batch.map((change) => this.createDefaultFileAnalysis(change)),
        impactAnalysis: this.createDefaultImpactAnalysis(),
      };
    }
  }

  /**
   * Build prompt based on analysis type
   * @param batch - Batch of parsed changes
   * @param analysisType - Type of analysis
   * @param commitMessages - Optional commit messages
   * @returns Prompt string
   */
  private buildPrompt(
    batch: ParsedFileChange[],
    analysisType: AnalysisType,
    commitMessages?: string[]
  ): string {
    switch (analysisType) {
      case 'quality':
        return buildQualityAnalysisPrompt(batch);
      case 'security':
        return buildSecurityAnalysisPrompt(batch);
      case 'impact':
        return buildImpactAnalysisPrompt(batch, commitMessages);
      case 'architecture':
        return buildArchitectureReviewPrompt(batch);
      default:
        throw new Error(`Unknown analysis type: ${analysisType}`);
    }
  }

  /**
   * Parse AI response into structured result
   * @param response - AI response
   * @param batch - Original batch (fallback)
   * @returns AI analysis result
   */
  private parseAIResponse(response: any, batch: ParsedFileChange[]): AIAnalysisResult {
    try {
      const parsed = typeof response === 'string' ? JSON.parse(response) : response;

      return {
        fileAnalyses: parsed.fileAnalyses || [],
        impactAnalysis: parsed.impactAnalysis || this.createDefaultImpactAnalysis(),
        architectureReview: parsed.architectureReview,
        testingStrategy: parsed.testingStrategy,
        documentationNeeds: parsed.documentationNeeds,
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);

      return {
        fileAnalyses: batch.map((change) => this.createDefaultFileAnalysis(change)),
        impactAnalysis: this.createDefaultImpactAnalysis(),
      };
    }
  }

  /**
   * Combine multiple AI results into one
   * @param results - Array of AI analysis results
   * @returns Combined result
   */
  private combineResults(results: AIAnalysisResult[]): AIAnalysisResult {
    const combinedFileAnalyses: FileAnalysis[] = [];
    const allAffectedModules: string[] = [];
    const allBreakingChanges: string[] = [];
    const allTestingRecommendations: string[] = [];
    const allDeploymentRisks: string[] = [];

    let maxRiskLevel: ImpactAnalysis['riskLevel'] = 'low';
    let totalQualityScore = 0;
    let qualityScoreCount = 0;

    for (const result of results) {
      combinedFileAnalyses.push(...result.fileAnalyses);

      if (result.impactAnalysis) {
        allAffectedModules.push(...result.impactAnalysis.affectedModules);
        allBreakingChanges.push(...result.impactAnalysis.breakingChanges);
        allTestingRecommendations.push(...result.impactAnalysis.testingRecommendations);
        allDeploymentRisks.push(...result.impactAnalysis.deploymentRisks);

        if (this.getRiskValue(result.impactAnalysis.riskLevel) > this.getRiskValue(maxRiskLevel)) {
          maxRiskLevel = result.impactAnalysis.riskLevel;
        }

        totalQualityScore += result.impactAnalysis.qualityScore;
        qualityScoreCount++;
      }
    }

    const averageQualityScore =
      qualityScoreCount > 0 ? Math.floor(totalQualityScore / qualityScoreCount) : 70;

    return {
      fileAnalyses: combinedFileAnalyses,
      impactAnalysis: {
        riskLevel: maxRiskLevel,
        affectedModules: [...new Set(allAffectedModules)],
        breakingChanges: [...new Set(allBreakingChanges)],
        testingRecommendations: [...new Set(allTestingRecommendations)],
        deploymentRisks: [...new Set(allDeploymentRisks)],
        qualityScore: averageQualityScore,
      },
    };
  }

  /**
   * Get numeric value for risk level
   * @param riskLevel - Risk level
   * @returns Numeric value
   */
  private getRiskValue(riskLevel: ImpactAnalysis['riskLevel']): number {
    const values = { low: 1, medium: 2, high: 3, critical: 4 };
    return values[riskLevel] || 0;
  }

  /**
   * Merge file analyses from different sources
   * @param target - Target array
   * @param source - Source array
   */
  private mergeFileAnalyses(target: FileAnalysis[], source: FileAnalysis[]): void {
    for (const sourceFile of source) {
      const existingFile = target.find((f) => f.file === sourceFile.file);

      if (existingFile) {
        existingFile.issues.push(...sourceFile.issues);

        if (sourceFile.qualityScore !== undefined) {
          existingFile.qualityScore =
            existingFile.qualityScore !== undefined
              ? Math.floor((existingFile.qualityScore + sourceFile.qualityScore) / 2)
              : sourceFile.qualityScore;
        }
      } else {
        target.push(sourceFile);
      }
    }
  }

  /**
   * Create default file analysis for a change
   * @param change - Parsed file change
   * @returns Default file analysis
   */
  private createDefaultFileAnalysis(change: ParsedFileChange): FileAnalysis {
    return {
      file: change.file,
      changeType: this.mapChangeType(change.changeType),
      issues: [],
      summary: `${change.changeType} file with ${change.additions} additions and ${change.deletions} deletions`,
      linesChanged: change.additions + change.deletions,
      qualityScore: 70,
    };
  }

  /**
   * Map ParsedFileChange changeType to FileAnalysis changeType
   * @param changeType - Parsed change type
   * @returns File analysis change type
   */
  private mapChangeType(
    changeType: 'added' | 'modified' | 'deleted' | 'renamed'
  ): FileAnalysis['changeType'] {
    if (changeType === 'added') return 'feature';
    if (changeType === 'deleted') return 'refactor';
    return 'unknown';
  }

  /**
   * Create default impact analysis
   * @returns Default impact analysis
   */
  private createDefaultImpactAnalysis(): ImpactAnalysis {
    return {
      riskLevel: 'low',
      affectedModules: [],
      breakingChanges: [],
      testingRecommendations: [],
      deploymentRisks: [],
      qualityScore: 70,
    };
  }

  /**
   * Create empty result for no changes
   * @param changes - Git changes
   * @param startTime - Start timestamp
   * @returns Empty analysis result
   */
  private createEmptyResult(changes: GitChanges, startTime: number): ChangeAnalysisResult {
    return {
      changeType: changes.type,
      summary: changes.summary,
      fileAnalyses: [],
      impactAnalysis: this.createDefaultImpactAnalysis(),
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };
  }
}
