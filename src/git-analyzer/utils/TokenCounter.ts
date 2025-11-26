/**
 * Token counter utility for managing AI token limits
 * Uses approximation for token counting (4 chars ≈ 1 token for GPT models)
 */

/**
 * Token counting configuration
 */
export interface TokenCounterConfig {
  /** Maximum tokens allowed per batch */
  maxTokensPerBatch: number;
  /** Safety margin to prevent exceeding limits (default: 0.9 = 90%) */
  safetyMargin?: number;
}

/**
 * Batch of content items within token limit
 */
export interface ContentBatch {
  /** Items in this batch */
  items: string[];
  /** Total tokens in this batch */
  totalTokens: number;
  /** Batch index */
  batchIndex: number;
}

/**
 * Token counter service for managing AI context windows
 */
export class TokenCounter {
  private readonly maxTokensPerBatch: number;
  private readonly safetyMargin: number;

  constructor(config: TokenCounterConfig) {
    this.maxTokensPerBatch = config.maxTokensPerBatch;
    this.safetyMargin = config.safetyMargin ?? 0.9;

    if (this.maxTokensPerBatch <= 0) {
      throw new Error("maxTokensPerBatch must be greater than 0");
    }
    if (this.safetyMargin <= 0 || this.safetyMargin > 1) {
      throw new Error("safetyMargin must be between 0 and 1");
    }
  }

  /**
   * Count tokens in text using approximation
   * GPT models typically use ~4 characters per token for English text
   * This is a conservative estimate that works well for code and mixed content
   * @param text - Text to count tokens for
   * @returns Approximate number of tokens
   */
  countTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Use approximation: ~4 characters per token
    // This is slightly conservative to avoid exceeding limits
    return Math.ceil(text.length / 4);
  }

  /**
   * Get effective maximum tokens per batch (with safety margin)
   * @returns Effective max tokens
   */
  getEffectiveMaxTokens(): number {
    return Math.floor(this.maxTokensPerBatch * this.safetyMargin);
  }

  /**
   * Check if text exceeds token limit
   * @param text - Text to check
   * @returns True if text exceeds limit
   */
  exceedsLimit(text: string): boolean {
    const tokens = this.countTokens(text);
    return tokens > this.getEffectiveMaxTokens();
  }

  /**
   * Split text into chunks that fit within token limit
   * @param text - Text to split
   * @param separator - Separator to split by (default: newline)
   * @returns Array of text chunks within token limit
   */
  splitIntoChunks(text: string, separator = "\n"): string[] {
    const effectiveMax = this.getEffectiveMaxTokens();
    const chunks: string[] = [];

    if (this.countTokens(text) <= effectiveMax) {
      return [text];
    }

    const lines = text.split(separator);
    let currentChunk = "";
    let currentTokens = 0;

    for (const line of lines) {
      const lineTokens = this.countTokens(line + separator);

      if (lineTokens > effectiveMax) {
        if (currentChunk) {
          chunks.push(currentChunk.trimEnd());
          currentChunk = "";
          currentTokens = 0;
        }

        const splitLine = this.splitLongLine(line, effectiveMax);
        chunks.push(...splitLine);
        continue;
      }

      if (currentTokens + lineTokens > effectiveMax) {
        chunks.push(currentChunk.trimEnd());
        currentChunk = line + separator;
        currentTokens = lineTokens;
      } else {
        currentChunk += line + separator;
        currentTokens += lineTokens;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trimEnd());
    }

    return chunks.filter((chunk) => chunk.length > 0);
  }

  /**
   * Split a single long line that exceeds token limit
   * @param line - Line to split
   * @param maxTokens - Maximum tokens per chunk
   * @returns Array of line chunks
   */
  private splitLongLine(line: string, maxTokens: number): string[] {
    const chunks: string[] = [];
    const words = line.split(" ");
    let currentChunk = "";
    let currentTokens = 0;

    for (const word of words) {
      const wordTokens = this.countTokens(word + " ");

      if (wordTokens > maxTokens) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
          currentTokens = 0;
        }

        const charChunks = this.splitByCharacters(word, maxTokens);
        chunks.push(...charChunks);
        continue;
      }

      if (currentTokens + wordTokens > maxTokens) {
        chunks.push(currentChunk.trim());
        currentChunk = word + " ";
        currentTokens = wordTokens;
      } else {
        currentChunk += word + " ";
        currentTokens += wordTokens;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter((chunk) => chunk.length > 0);
  }

  /**
   * Split by characters (last resort for very long words)
   * @param text - Text to split
   * @param maxTokens - Maximum tokens per chunk
   * @returns Array of character chunks
   */
  private splitByCharacters(text: string, maxTokens: number): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    for (const char of text) {
      const testChunk = currentChunk + char;
      const tokens = this.countTokens(testChunk);

      if (tokens > maxTokens) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = char;
      } else {
        currentChunk = testChunk;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Create batches from array of content items
   * @param items - Array of content items to batch
   * @returns Array of content batches
   */
  createBatches(items: string[]): ContentBatch[] {
    const effectiveMax = this.getEffectiveMaxTokens();
    const batches: ContentBatch[] = [];
    let currentBatch: string[] = [];
    let currentTokens = 0;
    let batchIndex = 0;

    for (const item of items) {
      const itemTokens = this.countTokens(item);

      if (itemTokens > effectiveMax) {
        if (currentBatch.length > 0) {
          batches.push({
            items: currentBatch,
            totalTokens: currentTokens,
            batchIndex: batchIndex++,
          });
          currentBatch = [];
          currentTokens = 0;
        }

        const chunks = this.splitIntoChunks(item);
        for (const chunk of chunks) {
          batches.push({
            items: [chunk],
            totalTokens: this.countTokens(chunk),
            batchIndex: batchIndex++,
          });
        }
        continue;
      }

      if (currentTokens + itemTokens > effectiveMax) {
        batches.push({
          items: currentBatch,
          totalTokens: currentTokens,
          batchIndex: batchIndex++,
        });
        currentBatch = [item];
        currentTokens = itemTokens;
      } else {
        currentBatch.push(item);
        currentTokens += itemTokens;
      }
    }

    if (currentBatch.length > 0) {
      batches.push({
        items: currentBatch,
        totalTokens: currentTokens,
        batchIndex: batchIndex++,
      });
    }

    return batches;
  }

  /**
   * Estimate cost for given token count
   * @param tokens - Number of tokens
   * @param costPer1kTokens - Cost per 1000 tokens (default: $0.002 for GPT-4)
   * @returns Estimated cost in USD
   */
  estimateCost(tokens: number, costPer1kTokens = 0.002): number {
    return (tokens / 1000) * costPer1kTokens;
  }

  /**
   * Get token usage statistics
   * @param batches - Array of content batches
   * @returns Token usage statistics
   */
  getStatistics(batches: ContentBatch[]): {
    totalBatches: number;
    totalItems: number;
    totalTokens: number;
    averageTokensPerBatch: number;
    maxTokensInBatch: number;
    minTokensInBatch: number;
    estimatedCost: number;
  } {
    if (batches.length === 0) {
      return {
        totalBatches: 0,
        totalItems: 0,
        totalTokens: 0,
        averageTokensPerBatch: 0,
        maxTokensInBatch: 0,
        minTokensInBatch: 0,
        estimatedCost: 0,
      };
    }

    const totalBatches = batches.length;
    const totalItems = batches.reduce((sum, batch) => sum + batch.items.length, 0);
    const totalTokens = batches.reduce((sum, batch) => sum + batch.totalTokens, 0);
    const averageTokensPerBatch = Math.floor(totalTokens / totalBatches);
    const maxTokensInBatch = Math.max(...batches.map((b) => b.totalTokens));
    const minTokensInBatch = Math.min(...batches.map((b) => b.totalTokens));
    const estimatedCost = this.estimateCost(totalTokens);

    return {
      totalBatches,
      totalItems,
      totalTokens,
      averageTokensPerBatch,
      maxTokensInBatch,
      minTokensInBatch,
      estimatedCost,
    };
  }
}
