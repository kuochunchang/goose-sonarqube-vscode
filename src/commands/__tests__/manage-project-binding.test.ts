/**
 * Tests for manage-project-binding command
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import * as vscode from "vscode";
import { manageSonarQubeProjectBinding } from "../manage-project-binding.js";
import { SonarQubeConfigService } from "../../services/sonarqube-config-service.js";

// Mock vscode module
vi.mock("vscode", () => ({
  window: {
    showQuickPick: vi.fn(),
    showInputBox: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(),
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

// Mock bind command
vi.mock("../bind-sonarqube-project.js", () => ({
  bindSonarQubeProject: vi.fn().mockResolvedValue(undefined),
}));

describe("manageSonarQubeProjectBinding", () => {
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

  it("should show bind option when no project binding exists", async () => {
    mockConfigService.getProjectBinding.mockReturnValue(null);

    (vscode.window.showQuickPick as Mock).mockResolvedValueOnce(undefined);

    await manageSonarQubeProjectBinding(mockContext);

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          label: "$(link) Bind to SonarQube Project",
          action: "bind",
        }),
        expect.objectContaining({
          label: "$(info) No Project Binding",
          action: "none",
        }),
      ]),
      expect.any(Object)
    );
  });

  it("should trigger bind command when bind option is selected", async () => {
    mockConfigService.getProjectBinding.mockReturnValue(null);

    (vscode.window.showQuickPick as Mock).mockResolvedValueOnce({
      action: "bind",
    });

    const { bindSonarQubeProject } = await import("../bind-sonarqube-project.js");

    await manageSonarQubeProjectBinding(mockContext);

    expect(bindSonarQubeProject).toHaveBeenCalledWith(mockContext);
  });

  it("should display current binding and action options", async () => {
    const mockBinding = {
      connectionId: "test-connection",
      projectKey: "my-project",
      projectName: "My Project",
    };

    const mockConnections = [
      {
        connectionId: "test-connection",
        serverUrl: "http://localhost:9000",
      },
    ];

    mockConfigService.getProjectBinding.mockReturnValue(mockBinding);
    mockConfigService.getConnections.mockReturnValue(mockConnections);

    (vscode.window.showQuickPick as Mock).mockResolvedValueOnce(undefined);

    await manageSonarQubeProjectBinding(mockContext);

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          label: "$(info) Current Binding",
          description: "my-project @ http://localhost:9000",
          action: "info",
        }),
        expect.objectContaining({
          label: "$(edit) Edit Binding",
          action: "edit",
        }),
        expect.objectContaining({
          label: "$(refresh) Rebind Project",
          action: "rebind",
        }),
        expect.objectContaining({
          label: "$(trash) Remove Binding",
          action: "remove",
        }),
      ]),
      expect.objectContaining({
        placeHolder: "Project Binding: My Project",
      })
    );
  });

  it("should show binding details when info action is selected", async () => {
    const mockBinding = {
      connectionId: "test-connection",
      projectKey: "my-project",
      projectName: "My Project",
    };

    const mockConnections = [
      {
        connectionId: "test-connection",
        serverUrl: "http://localhost:9000",
        organizationKey: "my-org",
      },
    ];

    mockConfigService.getProjectBinding.mockReturnValue(mockBinding);
    mockConfigService.getConnections.mockReturnValue(mockConnections);

    // First: select info action
    // Second: cancel details menu
    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "info",
      })
      .mockResolvedValueOnce(undefined);

    await manageSonarQubeProjectBinding(mockContext);

    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(2);
  });

  it("should allow editing binding", async () => {
    const mockBinding = {
      connectionId: "test-connection",
      projectKey: "my-project",
      projectName: "My Project",
    };

    const mockConnections = [
      {
        connectionId: "test-connection",
        serverUrl: "http://localhost:9000",
      },
      {
        connectionId: "other-connection",
        serverUrl: "http://other:9000",
      },
    ];

    mockConfigService.getProjectBinding.mockReturnValue(mockBinding);
    mockConfigService.getConnections.mockReturnValue(mockConnections);

    // First: select edit action
    // Second: cancel after showing main menu again
    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "edit",
      })
      .mockResolvedValueOnce({
        connectionId: "other-connection",
      })
      .mockResolvedValueOnce(undefined);

    (vscode.window.showInputBox as Mock)
      .mockResolvedValueOnce("new-project-key")
      .mockResolvedValueOnce("New Project Name");

    await manageSonarQubeProjectBinding(mockContext);

    expect(mockConfigService.setProjectBinding).toHaveBeenCalledWith({
      connectionId: "other-connection",
      projectKey: "new-project-key",
      projectName: "New Project Name",
    });
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Project binding updated to "new-project-key" successfully!'
    );
  });

  it("should handle no connections available when editing", async () => {
    const mockBinding = {
      connectionId: "test-connection",
      projectKey: "my-project",
    };

    mockConfigService.getProjectBinding.mockReturnValue(mockBinding);
    mockConfigService.getConnections.mockReturnValue([]);

    (vscode.window.showQuickPick as Mock).mockResolvedValueOnce({
      action: "edit",
    });

    await manageSonarQubeProjectBinding(mockContext);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      "No connections available. Please add a connection first."
    );
  });

  it("should allow rebinding project", async () => {
    const mockBinding = {
      connectionId: "test-connection",
      projectKey: "my-project",
    };

    const mockConnections = [
      {
        connectionId: "test-connection",
        serverUrl: "http://localhost:9000",
      },
    ];

    mockConfigService.getProjectBinding.mockReturnValue(mockBinding);
    mockConfigService.getConnections.mockReturnValue(mockConnections);

    // First: select rebind action
    // Second: cancel after rebind completes
    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "rebind",
      })
      .mockResolvedValueOnce(undefined);

    const { bindSonarQubeProject } = await import("../bind-sonarqube-project.js");

    await manageSonarQubeProjectBinding(mockContext);

    expect(bindSonarQubeProject).toHaveBeenCalledWith(mockContext);
  });

  it("should allow removing binding", async () => {
    const mockBinding = {
      connectionId: "test-connection",
      projectKey: "my-project",
      projectName: "My Project",
    };

    const mockConnections = [
      {
        connectionId: "test-connection",
        serverUrl: "http://localhost:9000",
      },
    ];

    mockConfigService.getProjectBinding.mockReturnValue(mockBinding);
    mockConfigService.getConnections.mockReturnValue(mockConnections);

    (vscode.window.showQuickPick as Mock).mockResolvedValueOnce({
      action: "remove",
    });

    (vscode.window.showWarningMessage as Mock).mockResolvedValueOnce("Remove");

    await manageSonarQubeProjectBinding(mockContext);

    expect(mockConfigService.clearProjectBinding).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "Project binding removed successfully!"
    );
  });

  it("should cancel removal if user cancels confirmation", async () => {
    const mockBinding = {
      connectionId: "test-connection",
      projectKey: "my-project",
    };

    const mockConnections = [
      {
        connectionId: "test-connection",
        serverUrl: "http://localhost:9000",
      },
    ];

    mockConfigService.getProjectBinding.mockReturnValue(mockBinding);
    mockConfigService.getConnections.mockReturnValue(mockConnections);

    // First: select remove action
    // Second: cancel after user cancels removal
    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "remove",
      })
      .mockResolvedValueOnce(undefined);

    (vscode.window.showWarningMessage as Mock).mockResolvedValueOnce("Cancel");

    await manageSonarQubeProjectBinding(mockContext);

    expect(mockConfigService.clearProjectBinding).not.toHaveBeenCalled();
  });

  it("should handle errors gracefully", async () => {
    mockConfigService.getProjectBinding.mockImplementation(() => {
      throw new Error("Test error");
    });

    await manageSonarQubeProjectBinding(mockContext);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      "Failed to manage project binding: Test error"
    );
  });

  it("should handle connection not found in binding details", async () => {
    const mockBinding = {
      connectionId: "non-existent",
      projectKey: "my-project",
    };

    mockConfigService.getProjectBinding.mockReturnValue(mockBinding);
    mockConfigService.getConnections.mockReturnValue([]);

    (vscode.window.showQuickPick as Mock).mockResolvedValueOnce(undefined);

    await manageSonarQubeProjectBinding(mockContext);

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          description: "my-project @ Unknown",
        }),
      ]),
      expect.any(Object)
    );
  });

  it("should cancel edit when connection selection is cancelled", async () => {
    const mockBinding = {
      connectionId: "test-connection",
      projectKey: "my-project",
    };

    const mockConnections = [
      {
        connectionId: "test-connection",
        serverUrl: "http://localhost:9000",
      },
    ];

    mockConfigService.getProjectBinding.mockReturnValue(mockBinding);
    mockConfigService.getConnections.mockReturnValue(mockConnections);

    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "edit",
      })
      .mockResolvedValueOnce(undefined); // Cancel connection selection

    await manageSonarQubeProjectBinding(mockContext);

    expect(mockConfigService.setProjectBinding).not.toHaveBeenCalled();
  });

  it("should cancel edit when project key input is cancelled", async () => {
    const mockBinding = {
      connectionId: "test-connection",
      projectKey: "my-project",
    };

    const mockConnections = [
      {
        connectionId: "test-connection",
        serverUrl: "http://localhost:9000",
      },
    ];

    mockConfigService.getProjectBinding.mockReturnValue(mockBinding);
    mockConfigService.getConnections.mockReturnValue(mockConnections);

    (vscode.window.showQuickPick as Mock)
      .mockResolvedValueOnce({
        action: "edit",
      })
      .mockResolvedValueOnce({
        connectionId: "test-connection",
      });

    (vscode.window.showInputBox as Mock).mockResolvedValueOnce(undefined); // Cancel project key input

    await manageSonarQubeProjectBinding(mockContext);

    expect(mockConfigService.setProjectBinding).not.toHaveBeenCalled();
  });
});
