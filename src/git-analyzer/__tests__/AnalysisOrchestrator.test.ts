import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalysisOrchestrator, AnalysisMode } from "../services/AnalysisOrchestrator.js";
import { SonarQubeService } from "../services/SonarQubeService.js";
import type { SonarQubeConfig, SonarQubeConnectionTest } from "../types/sonarqube.types.js";

// Mock SonarQubeService
vi.mock("../services/SonarQubeService.js", () => ({
  SonarQubeService: vi.fn(() => mockSonarQubeService),
}));

// Mock ConfigLoader
vi.mock("../utils/ConfigLoader.js", () => ({
  ConfigLoader: {
    loadSonarQubeConfig: vi.fn(),
  },
}));

// Mock SonarQube service instance
const mockSonarQubeService = {
  testConnection: vi.fn(),
  getMode: vi.fn(),
  isAvailable: vi.fn(),
};

describe("AnalysisOrchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should create orchestrator without SonarQube", () => {
      const orchestrator = new AnalysisOrchestrator(undefined, false);
      expect(orchestrator).toBeDefined();
    });

    it("should create orchestrator with SonarQube", () => {
      const config: SonarQubeConfig = {
        serverUrl: "http://localhost:9000",
        projectKey: "test-project",
      };
      const service = new SonarQubeService(config);
      const orchestrator = new AnalysisOrchestrator(service, false);
      expect(orchestrator).toBeDefined();
    });

    it("should create orchestrator with AI provider", () => {
      const orchestrator = new AnalysisOrchestrator(undefined, true);
      expect(orchestrator).toBeDefined();
    });
  });

  describe("detectMode", () => {
    it("should detect HYBRID mode when both providers available", async () => {
      const config: SonarQubeConfig = {
        serverUrl: "http://localhost:9000",
        projectKey: "test-project",
      };
      const service = new SonarQubeService(config);

      mockSonarQubeService.testConnection.mockResolvedValue({
        success: true,
        version: "9.9.0",
        responseTime: 50,
      } as SonarQubeConnectionTest);

      mockSonarQubeService.getMode.mockReturnValue("SERVER");

      const orchestrator = new AnalysisOrchestrator(service, true);
      const result = await orchestrator.detectMode();

      expect(result.mode).toBe(AnalysisMode.HYBRID);
      expect(result.sonarQubeAvailable).toBe(true);
      expect(result.aiProviderAvailable).toBe(true);
      expect(result.sonarQubeVersion).toBe("9.9.0");
      expect(result.messages.join(" ")).toContain("HYBRID");
    });

    it("should detect AI_ONLY mode when SonarQube unavailable", async () => {
      const config: SonarQubeConfig = {
        serverUrl: "http://localhost:9000",
        projectKey: "test-project",
      };
      const service = new SonarQubeService(config);

      mockSonarQubeService.testConnection.mockResolvedValue({
        success: false,
        error: "Connection refused",
        responseTime: 100,
      } as SonarQubeConnectionTest);

      const orchestrator = new AnalysisOrchestrator(service, true);
      const result = await orchestrator.detectMode();

      expect(result.mode).toBe(AnalysisMode.AI_ONLY);
      expect(result.sonarQubeAvailable).toBe(false);
      expect(result.aiProviderAvailable).toBe(true);
      const messagesStr = result.messages.join(" ");
      expect(messagesStr).toContain("AI_ONLY");
      expect(messagesStr).toContain("unavailable");
    });

    it("should detect SONARQUBE_ONLY mode when AI unavailable", async () => {
      const config: SonarQubeConfig = {
        serverUrl: "http://localhost:9000",
        projectKey: "test-project",
      };
      const service = new SonarQubeService(config);

      mockSonarQubeService.testConnection.mockResolvedValue({
        success: true,
        version: "9.9.0",
        responseTime: 50,
      } as SonarQubeConnectionTest);

      mockSonarQubeService.getMode.mockReturnValue("SERVER");

      const orchestrator = new AnalysisOrchestrator(service, false);
      const result = await orchestrator.detectMode();

      expect(result.mode).toBe(AnalysisMode.SONARQUBE_ONLY);
      expect(result.sonarQubeAvailable).toBe(true);
      expect(result.aiProviderAvailable).toBe(false);
      expect(result.messages.join(" ")).toContain("SONARQUBE_ONLY");
    });

    it("should throw error when no provider available", async () => {
      const orchestrator = new AnalysisOrchestrator(undefined, false);

      await expect(orchestrator.detectMode()).rejects.toThrow("No analysis provider available");
    });

    it("should detect AI_ONLY when SonarQube not configured", async () => {
      const orchestrator = new AnalysisOrchestrator(undefined, true);
      const result = await orchestrator.detectMode();

      expect(result.mode).toBe(AnalysisMode.AI_ONLY);
      expect(result.sonarQubeAvailable).toBe(false);
      expect(result.aiProviderAvailable).toBe(true);
      expect(result.messages.join(" ")).toContain("not configured");
    });
  });

  describe("getDetectionResult", () => {
    it("should return undefined before detection", () => {
      const orchestrator = new AnalysisOrchestrator(undefined, true);
      const result = orchestrator.getDetectionResult();

      expect(result).toBeUndefined();
    });

    it("should return detection result after detection", async () => {
      const orchestrator = new AnalysisOrchestrator(undefined, true);
      await orchestrator.detectMode();

      const result = orchestrator.getDetectionResult();

      expect(result).toBeDefined();
      expect(result?.mode).toBe(AnalysisMode.AI_ONLY);
    });
  });

  describe("getMode", () => {
    it("should return undefined before detection", () => {
      const orchestrator = new AnalysisOrchestrator(undefined, true);
      const mode = orchestrator.getMode();

      expect(mode).toBeUndefined();
    });

    it("should return mode after detection", async () => {
      const orchestrator = new AnalysisOrchestrator(undefined, true);
      await orchestrator.detectMode();

      const mode = orchestrator.getMode();

      expect(mode).toBe(AnalysisMode.AI_ONLY);
    });
  });

  describe("isSonarQubeAvailable", () => {
    it("should return false before detection", () => {
      const config: SonarQubeConfig = {
        serverUrl: "http://localhost:9000",
        projectKey: "test-project",
      };
      const service = new SonarQubeService(config);
      const orchestrator = new AnalysisOrchestrator(service, true);

      expect(orchestrator.isSonarQubeAvailable()).toBe(false);
    });

    it("should return true after successful detection", async () => {
      const config: SonarQubeConfig = {
        serverUrl: "http://localhost:9000",
        projectKey: "test-project",
      };
      const service = new SonarQubeService(config);

      mockSonarQubeService.testConnection.mockResolvedValue({
        success: true,
        version: "9.9.0",
        responseTime: 50,
      } as SonarQubeConnectionTest);

      mockSonarQubeService.getMode.mockReturnValue("SERVER");

      const orchestrator = new AnalysisOrchestrator(service, true);
      await orchestrator.detectMode();

      expect(orchestrator.isSonarQubeAvailable()).toBe(true);
    });
  });

  describe("isAIProviderAvailable", () => {
    it("should return false when not configured", () => {
      const orchestrator = new AnalysisOrchestrator(undefined, false);
      expect(orchestrator.isAIProviderAvailable()).toBe(false);
    });

    it("should return true when configured", () => {
      const orchestrator = new AnalysisOrchestrator(undefined, true);
      expect(orchestrator.isAIProviderAvailable()).toBe(true);
    });
  });

  describe("getSummary", () => {
    it("should return message when not detected", () => {
      const orchestrator = new AnalysisOrchestrator(undefined, true);
      const summary = orchestrator.getSummary();

      expect(summary).toContain("not detected");
    });

    it("should return summary after detection", async () => {
      const orchestrator = new AnalysisOrchestrator(undefined, true);
      await orchestrator.detectMode();

      const summary = orchestrator.getSummary();

      expect(summary).toContain("AI_ONLY");
      expect(summary).toContain("SonarQube");
      expect(summary).toContain("AI Provider");
    });

    it("should include SonarQube version if available", async () => {
      const config: SonarQubeConfig = {
        serverUrl: "http://localhost:9000",
        projectKey: "test-project",
      };
      const service = new SonarQubeService(config);

      mockSonarQubeService.testConnection.mockResolvedValue({
        success: true,
        version: "9.9.0",
        responseTime: 50,
      } as SonarQubeConnectionTest);

      mockSonarQubeService.getMode.mockReturnValue("SERVER");

      const orchestrator = new AnalysisOrchestrator(service, true);
      await orchestrator.detectMode();

      const summary = orchestrator.getSummary();

      expect(summary).toContain("9.9.0");
    });
  });

  describe("Graceful degradation", () => {
    it("should gracefully degrade from HYBRID to AI_ONLY on connection failure", async () => {
      const config: SonarQubeConfig = {
        serverUrl: "http://localhost:9000",
        projectKey: "test-project",
      };
      const service = new SonarQubeService(config);

      // Simulate connection failure
      mockSonarQubeService.testConnection.mockResolvedValue({
        success: false,
        error: "Connection timeout",
        responseTime: 3000,
      } as SonarQubeConnectionTest);

      const orchestrator = new AnalysisOrchestrator(service, true);
      const result = await orchestrator.detectMode();

      expect(result.mode).toBe(AnalysisMode.AI_ONLY);
      expect(result.messages.join(" ")).toContain("Falling back");
    });

    it("should include error message in detection result", async () => {
      const config: SonarQubeConfig = {
        serverUrl: "http://localhost:9000",
        projectKey: "test-project",
      };
      const service = new SonarQubeService(config);

      mockSonarQubeService.testConnection.mockResolvedValue({
        success: false,
        error: "Connection refused: ECONNREFUSED",
        responseTime: 100,
      } as SonarQubeConnectionTest);

      const orchestrator = new AnalysisOrchestrator(service, true);
      const result = await orchestrator.detectMode();

      expect(result.messages.join(" ")).toContain("ECONNREFUSED");
    });
  });
});
