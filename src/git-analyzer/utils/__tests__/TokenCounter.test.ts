/**
 * TokenCounter Tests
 */

import { describe, expect, it, vi } from "vitest";
import { TokenCounter } from "../TokenCounter.js";

// Mock gpt-3-encoder
vi.mock("gpt-3-encoder", () => ({
  encode: vi.fn((text: string) => {
    // Simple mock: approximate 1 token per 4 characters
    return Array(Math.ceil(text.length / 4));
  }),
}));

describe("TokenCounter", () => {
  describe("constructor", () => {
    it("should initialize with valid config", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      expect(counter).toBeDefined();
    });

    it("should use default safety margin of 0.9", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      expect(counter.getEffectiveMaxTokens()).toBe(900);
    });

    it("should use custom safety margin", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 1000,
        safetyMargin: 0.8,
      });
      expect(counter.getEffectiveMaxTokens()).toBe(800);
    });

    it("should throw error for invalid maxTokensPerBatch", () => {
      expect(() => {
        new TokenCounter({ maxTokensPerBatch: 0 });
      }).toThrow("maxTokensPerBatch must be greater than 0");

      expect(() => {
        new TokenCounter({ maxTokensPerBatch: -1 });
      }).toThrow("maxTokensPerBatch must be greater than 0");
    });

    it("should throw error for invalid safety margin", () => {
      expect(() => {
        new TokenCounter({ maxTokensPerBatch: 1000, safetyMargin: 0 });
      }).toThrow("safetyMargin must be between 0 and 1");

      expect(() => {
        new TokenCounter({ maxTokensPerBatch: 1000, safetyMargin: 1.5 });
      }).toThrow("safetyMargin must be between 0 and 1");
    });
  });

  describe("countTokens", () => {
    it("should count tokens in text", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      const tokens = counter.countTokens("Hello world");
      expect(tokens).toBeGreaterThan(0);
    });

    it("should return 0 for empty text", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      expect(counter.countTokens("")).toBe(0);
    });

    it("should return 0 for null/undefined text", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      expect(counter.countTokens(null as any)).toBe(0);
    });

    it("should handle encoding errors gracefully", async () => {
      const { encode } = await import("gpt-3-encoder");
      vi.mocked(encode).mockImplementationOnce(() => {
        throw new Error("Encoding failed");
      });

      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      const tokens = counter.countTokens("test");
      // Should fall back to approximate count
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe("getEffectiveMaxTokens", () => {
    it("should return effective max tokens with safety margin", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 1000,
        safetyMargin: 0.9,
      });
      expect(counter.getEffectiveMaxTokens()).toBe(900);
    });

    it("should floor the result", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 1001,
        safetyMargin: 0.9,
      });
      expect(counter.getEffectiveMaxTokens()).toBe(900);
    });
  });

  describe("exceedsLimit", () => {
    it("should return true when text exceeds limit", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 100,
        safetyMargin: 1.0,
      });
      // Create text that definitely exceeds 100 tokens
      const longText = "word ".repeat(200);
      expect(counter.exceedsLimit(longText)).toBe(true);
    });

    it("should return false when text is within limit", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 10000,
        safetyMargin: 1.0,
      });
      const shortText = "Hello world";
      expect(counter.exceedsLimit(shortText)).toBe(false);
    });
  });

  describe("splitIntoChunks", () => {
    it("should return single chunk if text fits within limit", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 10000,
        safetyMargin: 1.0,
      });
      const text = "Short text";
      const chunks = counter.splitIntoChunks(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it("should split text into multiple chunks when exceeding limit", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 100,
        safetyMargin: 1.0,
      });
      // Create text that exceeds limit
      const longText = "line\n".repeat(200);
      const chunks = counter.splitIntoChunks(longText);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should use custom separator", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 100,
        safetyMargin: 1.0,
      });
      const text = "word1|word2|word3|word4";
      const chunks = counter.splitIntoChunks(text, "|");
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle empty text", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      const chunks = counter.splitIntoChunks("");
      // Empty text returns [''], which is filtered to [] in the final step
      // But if countTokens returns 0, it returns [text] directly without filtering
      // So we check that it returns an array (could be [] or [''])
      expect(Array.isArray(chunks)).toBe(true);
      // After filtering, empty strings should be removed
      const filtered = chunks.filter((chunk) => chunk.length > 0);
      expect(filtered.length).toBe(0);
    });

    it("should handle very long single line", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 100,
        safetyMargin: 1.0,
      });
      const longLine = "word ".repeat(500);
      const chunks = counter.splitIntoChunks(longLine);
      expect(chunks.length).toBeGreaterThan(1);
      // All chunks should be non-empty
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeGreaterThan(0);
      });
    });
  });

  describe("createBatches", () => {
    it("should create single batch for small items", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 10000,
        safetyMargin: 1.0,
      });
      const items = ["item1", "item2", "item3"];
      const batches = counter.createBatches(items);
      expect(batches).toHaveLength(1);
      expect(batches[0].items).toEqual(items);
    });

    it("should create multiple batches when items exceed limit", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 100,
        safetyMargin: 1.0,
      });
      const items = Array(10).fill("word ".repeat(50));
      const batches = counter.createBatches(items);
      expect(batches.length).toBeGreaterThan(1);
    });

    it("should handle empty array", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      const batches = counter.createBatches([]);
      expect(batches).toEqual([]);
    });

    it("should handle single large item", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 100,
        safetyMargin: 1.0,
      });
      const largeItem = "word ".repeat(500);
      const batches = counter.createBatches([largeItem]);
      expect(batches.length).toBeGreaterThan(1);
      batches.forEach((batch) => {
        expect(batch.items.length).toBeGreaterThan(0);
        expect(batch.totalTokens).toBeGreaterThan(0);
      });
    });

    it("should assign correct batch indices", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 100,
        safetyMargin: 1.0,
      });
      const items = Array(5).fill("word ".repeat(50));
      const batches = counter.createBatches(items);
      batches.forEach((batch, index) => {
        expect(batch.batchIndex).toBe(index);
      });
    });

    it("should calculate total tokens correctly", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 10000,
        safetyMargin: 1.0,
      });
      const items = ["item1", "item2"];
      const batches = counter.createBatches(items);
      const totalTokens = batches.reduce((sum, batch) => sum + batch.totalTokens, 0);
      expect(totalTokens).toBeGreaterThan(0);
    });
  });

  describe("estimateCost", () => {
    it("should calculate cost correctly", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      const cost = counter.estimateCost(1000, 0.002);
      expect(cost).toBe(0.002);
    });

    it("should use default cost per 1k tokens", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      const cost = counter.estimateCost(1000);
      expect(cost).toBe(0.002);
    });

    it("should handle zero tokens", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      const cost = counter.estimateCost(0);
      expect(cost).toBe(0);
    });

    it("should handle custom cost per 1k tokens", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      const cost = counter.estimateCost(1000, 0.001);
      expect(cost).toBe(0.001);
    });
  });

  describe("getStatistics", () => {
    it("should return correct statistics for empty batches", () => {
      const counter = new TokenCounter({ maxTokensPerBatch: 1000 });
      const stats = counter.getStatistics([]);
      expect(stats.totalBatches).toBe(0);
      expect(stats.totalItems).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.averageTokensPerBatch).toBe(0);
      expect(stats.maxTokensInBatch).toBe(0);
      expect(stats.minTokensInBatch).toBe(0);
      expect(stats.estimatedCost).toBe(0);
    });

    it("should return correct statistics for batches", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 10000,
        safetyMargin: 1.0,
      });
      const items = ["item1", "item2", "item3"];
      const batches = counter.createBatches(items);
      const stats = counter.getStatistics(batches);

      expect(stats.totalBatches).toBe(batches.length);
      expect(stats.totalItems).toBeGreaterThanOrEqual(items.length);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.averageTokensPerBatch).toBeGreaterThan(0);
      expect(stats.maxTokensInBatch).toBeGreaterThan(0);
      expect(stats.minTokensInBatch).toBeGreaterThan(0);
      expect(stats.estimatedCost).toBeGreaterThanOrEqual(0);
    });

    it("should calculate average correctly", () => {
      const counter = new TokenCounter({
        maxTokensPerBatch: 10000,
        safetyMargin: 1.0,
      });
      const items = ["item1", "item2"];
      const batches = counter.createBatches(items);
      const stats = counter.getStatistics(batches);

      if (stats.totalBatches > 0) {
        const expectedAverage = Math.floor(stats.totalTokens / stats.totalBatches);
        expect(stats.averageTokensPerBatch).toBe(expectedAverage);
      }
    });
  });
});
