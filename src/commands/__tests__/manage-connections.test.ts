/**
 * Tests for manage-connections command
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import * as vscode from "vscode";
import { manageSonarQubeConnections } from "../manage-connections.js";
import { SonarQubeConfigService } from "../../services/sonarqube-config-service.js";

// Mock vscode module
vi.mock("vscode", () => ({
  window: {
    showQuickPick: vi.fn(),
    showInputBox: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(),
  },
  ProgressLocation: {
    Notification: 15,
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
  },
}));

// Mock services
vi.mock("../../services/sonarqube-config-service.js", () => {
  const mockConfigService = {
    getConnections: vi.fn(),
    getProjectBinding: vi.fn(),
    getToken: vi.fn(),
    storeToken: vi.fn(),
    deleteToken: vi.fn(),
    addConnection: vi.fn(),
    removeConnection: vi.fn(),
    setProjectBinding: vi.fn(),
    clearProjectBinding: vi.fn(),
    getSonarQubeConfig: vi.fn(),
    isEnabled: vi.fn(),
    getAnalysisMode: vi.fn(),
  };

  return {
    SonarQubeConfigService: vi.fn(() => mockConfigService),
  };
});

// Mock git-analyzer
vi.mock("../../git-analyzer/index.js", () => ({
  SonarQubeService: vi.fn(() => ({
    testConnection: vi.fn().mockResolvedValue({
      success: true,
      version: "9.9",
      responseTime: 150,
    }),
  })),
}));

describe("manageSonarQubeConnections", () => {
  let mockContext: vscode.ExtensionContext;
  let mockConfigService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      secrets: {
        get: vi.fn(),
        store: vi.fn(),
        delete: vi.fn(),
      },
      subscriptions: [],
    } as any;

    // Get mock config service instance
    mockConfigService = new SonarQubeConfigService(mockContext);
  });

  it("should show add connection option when no connections exist", async () => {
    mockConfigService.getConnections.mockReturnValue([]);

    (vscode.window.showQuickPick as Mock).mockResolvedValueOnce(undefined);

    await manageSonarQubeConnections(mockContext);

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          label: "$(add) Add New Connection",
          action: "add",
        }),
        expect.objectContaining({
          label: "$(info) No connections configured",
          action: "view",
        }),
      ]),
      expect.any(Object)
    );
  });

  it("should display existing connections", async () => {
    const mockConnections = [
      {
        connectionId: "test-connection",
        serverUrl: "http://localhost:9000",
      },
      {
        connectionId: "sonarcloud",
        serverUrl: "https://sonarcloud.io",
        organizationKey: "my-org",
      },
    ];

    mockConfigService.getConnections.mockReturnValue(mockConnections);

    (vscode.window.showQuickPick as Mock).mockResolvedValueOnce(undefined);

    await manageSonarQubeConnections(mockContext);

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          label: "$(add) Add New Connection",
          action: "add",
        }),
        expect.objectContaining({
          label: "$(plug) test-connection",
          description: "http://localhost:9000",
          action: "view",
          connection: mockConnections[0],
        }),
        expect.objectContaining({
          label: "$(plug) sonarcloud",
          description: "https://sonarcloud.io",
          action: "view",
          connection: mockConnections[1],
        }),
      ]),
      expect.any(Object)
    );
  });

  it("should show connection menu when a connection is selected", async () => {
    const mockConnection = {
      connectionId: "test-connection",
      serverUrl: "http://localhost:9000",
    };

    mockConfigService.getConnections.mockReturnValue([mockConnection]);

    // First selection: select the connection
    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "view",
        connection: mockConnection,
      })
      // Second selection: cancel connection menu
      .mockResolvedValueOnce(undefined);

    await manageSonarQubeConnections(mockContext);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(2);
    expect(vscode.window.showQuickPick).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({ label: "$(check) Test Connection" }),
        expect.objectContaining({ label: "$(edit) Edit Connection" }),
        expect.objectContaining({ label: "$(key) Update Token" }),
        expect.objectContaining({ label: "$(trash) Delete Connection" }),
        expect.objectContaining({ label: "$(arrow-left) Back" }),
      ]),
      expect.any(Object)
    );
  });

  it("should handle errors gracefully", async () => {
    mockConfigService.getConnections.mockImplementation(() => {
      throw new Error("Test error");
    });

    await manageSonarQubeConnections(mockContext);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      "Failed to manage connections: Test error"
    );
  });

  it("should allow testing connection", async () => {
    const mockConnection = {
      connectionId: "test-connection",
      serverUrl: "http://localhost:9000",
    };

    mockConfigService.getConnections.mockReturnValue([mockConnection]);
    mockConfigService.getToken.mockResolvedValue("test-token");

    const mockConfig = {
      get: vi.fn().mockReturnValue(3000),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(mockConfig);

    // First: select connection
    // Second: select test action
    // Third: cancel after test
    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "view",
        connection: mockConnection,
      })
      .mockResolvedValueOnce({
        action: "test",
      })
      .mockResolvedValueOnce(undefined);

    (vscode.window.withProgress as Mock).mockImplementation(async (options, task) => {
      return await task();
    });

    await manageSonarQubeConnections(mockContext);

    expect(vscode.window.withProgress).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("Connection successful")
    );
  });

  it("should allow updating token", async () => {
    const mockConnection = {
      connectionId: "test-connection",
      serverUrl: "http://localhost:9000",
    };

    mockConfigService.getConnections.mockReturnValue([mockConnection]);

    // First: select connection
    // Second: select update token action
    // Third: cancel after update
    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "view",
        connection: mockConnection,
      })
      .mockResolvedValueOnce({
        action: "update-token",
      })
      .mockResolvedValueOnce(undefined);

    (vscode.window.showInputBox as Mock).mockResolvedValueOnce("new-token");

    await manageSonarQubeConnections(mockContext);

    expect(mockConfigService.storeToken).toHaveBeenCalledWith("test-connection", "new-token");
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Token for "test-connection" updated successfully!'
    );
  });

  it("should allow deleting connection", async () => {
    const mockConnection = {
      connectionId: "test-connection",
      serverUrl: "http://localhost:9000",
    };

    mockConfigService.getConnections.mockReturnValue([mockConnection]);

    // First: select connection
    // Second: select delete action
    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "view",
        connection: mockConnection,
      })
      .mockResolvedValueOnce({
        action: "delete",
      })
      // After deletion, show connections list again (empty)
      .mockResolvedValueOnce(undefined);

    (vscode.window.showWarningMessage as Mock).mockResolvedValueOnce("Delete");

    mockConfigService.getConnections.mockReturnValueOnce([mockConnection]).mockReturnValueOnce([]);

    await manageSonarQubeConnections(mockContext);

    expect(mockConfigService.removeConnection).toHaveBeenCalledWith("test-connection");
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Connection "test-connection" deleted successfully!'
    );
  });

  it("should cancel deletion if user cancels confirmation", async () => {
    const mockConnection = {
      connectionId: "test-connection",
      serverUrl: "http://localhost:9000",
    };

    mockConfigService.getConnections.mockReturnValue([mockConnection]);

    // First: select connection
    // Second: select delete action
    // Third: cancel after user cancels deletion
    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "view",
        connection: mockConnection,
      })
      .mockResolvedValueOnce({
        action: "delete",
      })
      .mockResolvedValueOnce(undefined);

    (vscode.window.showWarningMessage as Mock).mockResolvedValueOnce("Cancel");

    await manageSonarQubeConnections(mockContext);

    expect(mockConfigService.removeConnection).not.toHaveBeenCalled();
  });

  it("should allow editing connection", async () => {
    const mockConnection = {
      connectionId: "test-connection",
      serverUrl: "http://localhost:9000",
    };

    mockConfigService.getConnections.mockReturnValue([mockConnection]);

    const mockConfig = {
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(mockConfig);

    // First: select connection
    // Second: select edit action
    // Third: cancel after edit
    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "view",
        connection: mockConnection,
      })
      .mockResolvedValueOnce({
        action: "edit",
      })
      .mockResolvedValueOnce(undefined);

    (vscode.window.showInputBox as Mock).mockResolvedValueOnce("http://newurl:9000");

    await manageSonarQubeConnections(mockContext);

    expect(mockConfig.update).toHaveBeenCalledWith(
      "connections",
      expect.arrayContaining([
        expect.objectContaining({
          connectionId: "test-connection",
          serverUrl: "http://newurl:9000",
        }),
      ]),
      vscode.ConfigurationTarget.Global
    );
  });

  it("should prompt for organization key when editing SonarCloud connection", async () => {
    const mockConnection = {
      connectionId: "sonarcloud",
      serverUrl: "https://sonarcloud.io",
      organizationKey: "old-org",
    };

    mockConfigService.getConnections.mockReturnValue([mockConnection]);

    const mockConfig = {
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(mockConfig);

    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "view",
        connection: mockConnection,
      })
      .mockResolvedValueOnce({
        action: "edit",
      })
      .mockResolvedValueOnce(undefined);

    (vscode.window.showInputBox as Mock)
      .mockResolvedValueOnce("https://sonarcloud.io")
      .mockResolvedValueOnce("new-org");

    await manageSonarQubeConnections(mockContext);

    expect(vscode.window.showInputBox).toHaveBeenCalledTimes(2);
    expect(mockConfig.update).toHaveBeenCalledWith(
      "connections",
      expect.arrayContaining([
        expect.objectContaining({
          connectionId: "sonarcloud",
          serverUrl: "https://sonarcloud.io",
          organizationKey: "new-org",
        }),
      ]),
      vscode.ConfigurationTarget.Global
    );
  });
});
