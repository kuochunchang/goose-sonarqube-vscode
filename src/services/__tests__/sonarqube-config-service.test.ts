/**
 * SonarQubeConfigService Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import type { SonarQubeConnection, SonarQubeProjectBinding } from "../sonarqube-config-service.js";
import { SonarQubeConfigService } from "../sonarqube-config-service.js";

// Mock VS Code API
vi.mock("vscode", () => {
  const mockSecrets = new Map<string, string>();
  const mockConfig = new Map<string, any>();

  return {
    workspace: {
      getConfiguration: vi.fn((section?: string) => ({
        get: vi.fn((key: string, defaultValue?: any) => {
          const fullKey = section ? `${section}.${key}` : key;
          return mockConfig.get(fullKey) ?? defaultValue;
        }),
        update: vi.fn(async (key: string, value: any, _target?: any) => {
          const fullKey = section ? `${section}.${key}` : key;
          mockConfig.set(fullKey, value);
        }),
      })),
    },
    ConfigurationTarget: {
      Global: 1,
      Workspace: 2,
    },
    ExtensionContext: class {
      secrets = {
        get: vi.fn(async (key: string) => mockSecrets.get(key)),
        store: vi.fn(async (key: string, value: string) => {
          mockSecrets.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
          mockSecrets.delete(key);
        }),
      };
    },
  };
});

describe("SonarQubeConfigService", () => {
  let service: SonarQubeConfigService;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // Create mock context
    mockContext = {
      secrets: {
        get: vi.fn(),
        store: vi.fn(),
        delete: vi.fn(),
      },
    } as any;

    // Reset mocks
    vi.clearAllMocks();
    (vscode.workspace.getConfiguration as any).mockReturnValue({
      get: vi.fn((key: string, defaultValue?: any) => {
        // Default mock values
        if (key === "connections") return [];
        if (key === "projectBinding") return null;
        if (key === "timeout") return 3000;
        if (key === "enabled") return true;
        return defaultValue;
      }),
      update: vi.fn(),
    });

    service = new SonarQubeConfigService(mockContext);
  });

  describe("constructor", () => {
    it("should initialize with extension context", () => {
      expect(service).toBeDefined();
    });
  });

  describe("getConnections", () => {
    it("should return empty array when no connections configured", () => {
      const connections = service.getConnections();
      expect(connections).toEqual([]);
    });

    it("should return configured connections", () => {
      const mockConnections: SonarQubeConnection[] = [
        {
          connectionId: "conn1",
          serverUrl: "http://localhost:9000",
        },
        {
          connectionId: "conn2",
          serverUrl: "https://sonarcloud.io",
          organizationKey: "org-key",
        },
      ];

      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "connections") return mockConnections;
          return [];
        }),
        update: vi.fn(),
      });

      const connections = service.getConnections();
      expect(connections).toEqual(mockConnections);
    });
  });

  describe("getProjectBinding", () => {
    it("should return null when no binding configured", () => {
      const binding = service.getProjectBinding();
      expect(binding).toBeNull();
    });

    it("should return project binding when configured", () => {
      const mockBinding: SonarQubeProjectBinding = {
        connectionId: "conn1",
        projectKey: "test-project",
        projectName: "Test Project",
      };

      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "projectBinding") return mockBinding;
          return null;
        }),
        update: vi.fn(),
      });

      const binding = service.getProjectBinding();
      expect(binding).toEqual(mockBinding);
    });
  });

  describe("getToken", () => {
    it("should retrieve token from secret storage", async () => {
      const testToken = "test-token-123";
      vi.mocked(mockContext.secrets.get).mockResolvedValue(testToken);

      const token = await service.getToken("conn1");
      expect(token).toBe(testToken);
      expect(mockContext.secrets.get).toHaveBeenCalledWith("sonarqube.token.conn1");
    });

    it("should return undefined when token not found", async () => {
      vi.mocked(mockContext.secrets.get).mockResolvedValue(undefined);

      const token = await service.getToken("conn1");
      expect(token).toBeUndefined();
    });
  });

  describe("storeToken", () => {
    it("should store token in secret storage", async () => {
      const testToken = "test-token-123";
      await service.storeToken("conn1", testToken);

      expect(mockContext.secrets.store).toHaveBeenCalledWith("sonarqube.token.conn1", testToken);
    });
  });

  describe("deleteToken", () => {
    it("should delete token from secret storage", async () => {
      await service.deleteToken("conn1");

      expect(mockContext.secrets.delete).toHaveBeenCalledWith("sonarqube.token.conn1");
    });
  });

  describe("addConnection", () => {
    it("should add new connection and store token", async () => {
      const connection: SonarQubeConnection = {
        connectionId: "conn1",
        serverUrl: "http://localhost:9000",
      };
      const token = "test-token";

      const mockUpdate = vi.fn();
      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "connections") return [];
          return [];
        }),
        update: mockUpdate,
      });

      await service.addConnection(connection, token);

      expect(mockUpdate).toHaveBeenCalledWith(
        "connections",
        [connection],
        vscode.ConfigurationTarget.Global
      );
      expect(mockContext.secrets.store).toHaveBeenCalledWith("sonarqube.token.conn1", token);
    });

    it("should throw error when connection ID already exists", async () => {
      const existingConnection: SonarQubeConnection = {
        connectionId: "conn1",
        serverUrl: "http://localhost:9000",
      };
      const newConnection: SonarQubeConnection = {
        connectionId: "conn1",
        serverUrl: "http://other:9000",
      };

      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "connections") return [existingConnection];
          return [];
        }),
        update: vi.fn(),
      });

      await expect(service.addConnection(newConnection, "token")).rejects.toThrow(
        'Connection with ID "conn1" already exists'
      );
    });
  });

  describe("removeConnection", () => {
    it("should remove connection and delete token", async () => {
      const connection: SonarQubeConnection = {
        connectionId: "conn1",
        serverUrl: "http://localhost:9000",
      };

      const mockUpdate = vi.fn();
      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "connections") return [connection];
          if (key === "projectBinding") return null;
          return [];
        }),
        update: mockUpdate,
      });

      await service.removeConnection("conn1");

      expect(mockUpdate).toHaveBeenCalledWith("connections", [], vscode.ConfigurationTarget.Global);
      expect(mockContext.secrets.delete).toHaveBeenCalledWith("sonarqube.token.conn1");
    });

    it("should clear project binding when removed connection is bound", async () => {
      const connection: SonarQubeConnection = {
        connectionId: "conn1",
        serverUrl: "http://localhost:9000",
      };
      const binding: SonarQubeProjectBinding = {
        connectionId: "conn1",
        projectKey: "test-project",
      };

      const mockUpdate = vi.fn();
      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "connections") return [connection];
          if (key === "projectBinding") return binding;
          return [];
        }),
        update: mockUpdate,
      });

      await service.removeConnection("conn1");

      // Should clear project binding
      expect(mockUpdate).toHaveBeenCalledWith(
        "projectBinding",
        null,
        vscode.ConfigurationTarget.Workspace
      );
    });
  });

  describe("setProjectBinding", () => {
    it("should set project binding", async () => {
      const connection: SonarQubeConnection = {
        connectionId: "conn1",
        serverUrl: "http://localhost:9000",
      };
      const binding: SonarQubeProjectBinding = {
        connectionId: "conn1",
        projectKey: "test-project",
        projectName: "Test Project",
      };

      const mockUpdate = vi.fn();
      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "connections") return [connection];
          return [];
        }),
        update: mockUpdate,
      });

      await service.setProjectBinding(binding);

      expect(mockUpdate).toHaveBeenCalledWith(
        "projectBinding",
        binding,
        vscode.ConfigurationTarget.Workspace
      );
    });

    it("should throw error when connection not found", async () => {
      const binding: SonarQubeProjectBinding = {
        connectionId: "conn1",
        projectKey: "test-project",
      };

      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "connections") return [];
          return [];
        }),
        update: vi.fn(),
      });

      await expect(service.setProjectBinding(binding)).rejects.toThrow(
        'Connection "conn1" not found'
      );
    });
  });

  describe("clearProjectBinding", () => {
    it("should clear project binding", async () => {
      const mockUpdate = vi.fn();
      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn(),
        update: mockUpdate,
      });

      await service.clearProjectBinding();

      expect(mockUpdate).toHaveBeenCalledWith(
        "projectBinding",
        null,
        vscode.ConfigurationTarget.Workspace
      );
    });
  });

  describe("getSonarQubeConfig", () => {
    it("should return null when no project binding", async () => {
      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "projectBinding") return null;
          return [];
        }),
        update: vi.fn(),
      });

      const config = await service.getSonarQubeConfig();
      expect(config).toBeNull();
    });

    it("should return null when connection not found", async () => {
      const binding: SonarQubeProjectBinding = {
        connectionId: "conn1",
        projectKey: "test-project",
      };

      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "projectBinding") return binding;
          if (key === "connections") return [];
          return [];
        }),
        update: vi.fn(),
      });

      const config = await service.getSonarQubeConfig();
      expect(config).toBeNull();
    });

    it("should return null when token not found", async () => {
      const connection: SonarQubeConnection = {
        connectionId: "conn1",
        serverUrl: "http://localhost:9000",
      };
      const binding: SonarQubeProjectBinding = {
        connectionId: "conn1",
        projectKey: "test-project",
      };

      vi.mocked(mockContext.secrets.get).mockResolvedValue(undefined);

      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "projectBinding") return binding;
          if (key === "connections") return [connection];
          if (key === "timeout") return 3000;
          return [];
        }),
        update: vi.fn(),
      });

      const config = await service.getSonarQubeConfig();
      expect(config).toBeNull();
    });

    it("should return complete config when all data available", async () => {
      const connection: SonarQubeConnection = {
        connectionId: "conn1",
        serverUrl: "http://localhost:9000",
      };
      const binding: SonarQubeProjectBinding = {
        connectionId: "conn1",
        projectKey: "test-project",
        projectName: "Test Project",
      };
      const token = "test-token-123";

      vi.mocked(mockContext.secrets.get).mockResolvedValue(token);

      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "projectBinding") return binding;
          if (key === "connections") return [connection];
          if (key === "timeout") return 5000;
          return [];
        }),
        update: vi.fn(),
      });

      const config = await service.getSonarQubeConfig();

      expect(config).toEqual({
        serverUrl: "http://localhost:9000",
        token: "test-token-123",
        projectKey: "test-project",
        projectName: "Test Project",
        timeout: 5000,
        skipCertVerification: false,
      });
    });

    it("should use projectKey as projectName when not provided", async () => {
      const connection: SonarQubeConnection = {
        connectionId: "conn1",
        serverUrl: "http://localhost:9000",
      };
      const binding: SonarQubeProjectBinding = {
        connectionId: "conn1",
        projectKey: "test-project",
        // projectName not provided
      };
      const token = "test-token-123";

      vi.mocked(mockContext.secrets.get).mockResolvedValue(token);

      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "projectBinding") return binding;
          if (key === "connections") return [connection];
          if (key === "timeout") return 3000;
          return [];
        }),
        update: vi.fn(),
      });

      const config = await service.getSonarQubeConfig();

      expect(config?.projectName).toBe("test-project");
    });
  });

  describe("isEnabled", () => {
    it("should return true by default", () => {
      const enabled = service.isEnabled();
      expect(enabled).toBe(true);
    });

    it("should return configured value", () => {
      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === "enabled") return false;
          return true;
        }),
        update: vi.fn(),
      });

      const enabled = service.isEnabled();
      expect(enabled).toBe(false);
    });
  });

  describe("getAnalysisMode", () => {
    it("should always return sonarqube-only", () => {
      const mode = service.getAnalysisMode();
      expect(mode).toBe("sonarqube-only");
    });
  });
});
