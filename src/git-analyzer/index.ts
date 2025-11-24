/**
 * @code-review-goose/git-analyzer
 * Git change analysis with SonarQube and AI integration
 */

// Export types
export * from './types/index.js';

// Export services
export { GitService } from './services/GitService.js';
export { SonarQubeService } from './services/SonarQubeService.js';
export { ProjectAnalysisService } from './services/ProjectAnalysisService.js';
export { AnalysisOrchestrator, AnalysisMode } from './services/AnalysisOrchestrator.js';
export { AnalysisCacheService } from './services/AnalysisCacheService.js';
export type { CacheStats } from './services/AnalysisCacheService.js';
export { ChangeAnalyzer } from './services/ChangeAnalyzer.js';
export type { ChangeAnalyzerConfig, IAIProvider, AnalysisType } from './services/ChangeAnalyzer.js';
export { MergeService } from './services/MergeService.js';
export type { MergeConfig, DeduplicationStrategy } from './services/MergeService.js';
export { ReportExporter } from './services/ReportExporter.js';
export type { ExportFormat, ExportOptions } from './services/ReportExporter.js';
export { GitHubService } from './services/GitHubService.js';
export { PRAnalysisService } from './services/PRAnalysisService.js';
export type { PRAnalysisServiceConfig } from './services/PRAnalysisService.js';

// Export utilities
export { ConfigLoader } from './utils/ConfigLoader.js';
export type { GooseReviewConfig } from './utils/ConfigLoader.js';
export { TokenCounter } from './utils/TokenCounter.js';
export type { TokenCounterConfig, ContentBatch } from './utils/TokenCounter.js';
export { DiffParser } from './utils/DiffParser.js';
export type { ParsedFileChange, DiffFormatOptions } from './utils/DiffParser.js';

// Export AI prompt builders
export {
  buildQualityAnalysisPrompt,
  buildSecurityAnalysisPrompt,
  buildImpactAnalysisPrompt,
  buildArchitectureReviewPrompt,
} from './services/AIPrompts.js';
