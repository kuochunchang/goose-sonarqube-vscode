/**
 * Manage SonarQube Connections Command
 * Allows users to view, edit, and delete SonarQube connections
 */

import * as vscode from "vscode";
import {
  SonarQubeConfigService,
  type SonarQubeConnection,
} from "../services/sonarqube-config-service.js";

interface ConnectionAction {
  label: string;
  description?: string;
  action: "add" | "view" | "edit" | "delete" | "test";
  connection?: SonarQubeConnection;
}

/**
 * Manage SonarQube connections
 */
export async function manageSonarQubeConnections(context: vscode.ExtensionContext): Promise<void> {
  const configService = new SonarQubeConfigService(context);

  try {
    const connections = configService.getConnections();
    const actions: ConnectionAction[] = [];

    // Add "Add New Connection" option
    actions.push({
      label: "$(add) Add New Connection",
      description: "Configure a new SonarQube or SonarCloud connection",
      action: "add",
    });

    // Add existing connections
    if (connections.length > 0) {
      actions.push({
        label: "",
        description: "─────── Existing Connections ───────",
        action: "view",
      });

      for (const conn of connections) {
        actions.push({
          label: `$(plug) ${conn.connectionId}`,
          description: conn.serverUrl,
          action: "view",
          connection: conn,
        });
      }
    } else {
      actions.push({
        label: "$(info) No connections configured",
        description: "Add a connection to get started",
        action: "view",
      });
    }

    const selected = await vscode.window.showQuickPick(actions, {
      placeHolder: "Manage SonarQube Connections",
      matchOnDescription: true,
    });

    if (!selected) {
      return;
    }

    switch (selected.action) {
      case "add":
        await addConnection(context);
        // Reopen menu to show new connection
        await manageSonarQubeConnections(context);
        break;

      case "view":
        if (selected.connection) {
          await showConnectionMenu(context, selected.connection);
        }
        break;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to manage connections: ${errorMessage}`);
  }
}

/**
 * Show menu for a specific connection
 */
async function showConnectionMenu(
  context: vscode.ExtensionContext,
  connection: SonarQubeConnection
): Promise<void> {
  const actions = [
    {
      label: "$(check) Test Connection",
      description: "Verify connection is working",
      action: "test" as const,
    },
    {
      label: "$(edit) Edit Connection",
      description: "Update server URL or organization key",
      action: "edit" as const,
    },
    {
      label: "$(key) Update Token",
      description: "Change authentication token",
      action: "update-token" as const,
    },
    {
      label: "$(trash) Delete Connection",
      description: "Remove this connection",
      action: "delete" as const,
    },
    {
      label: "$(arrow-left) Back",
      description: "Return to connections list",
      action: "back" as const,
    },
  ];

  const selected = await vscode.window.showQuickPick(actions, {
    placeHolder: `Manage "${connection.connectionId}" (${connection.serverUrl})`,
  });

  if (!selected) {
    return;
  }

  switch (selected.action) {
    case "test":
      await testConnection(context, connection.connectionId);
      await showConnectionMenu(context, connection);
      break;

    case "edit":
      await editConnection(context, connection);
      await manageSonarQubeConnections(context);
      break;

    case "update-token":
      await updateToken(context, connection.connectionId);
      await showConnectionMenu(context, connection);
      break;

    case "delete": {
      const confirmed = await confirmDelete(connection.connectionId);
      if (confirmed) {
        await deleteConnection(context, connection.connectionId);
        await manageSonarQubeConnections(context);
      } else {
        await showConnectionMenu(context, connection);
      }
      break;
    }

    case "back":
      await manageSonarQubeConnections(context);
      break;
  }
}

/**
 * Add a new connection
 */
async function addConnection(context: vscode.ExtensionContext): Promise<void> {
  const { addSonarQubeConnection } = await import("./add-sonarqube-connection.js");
  await addSonarQubeConnection(context);
}

/**
 * Edit an existing connection
 */
async function editConnection(
  context: vscode.ExtensionContext,
  connection: SonarQubeConnection
): Promise<void> {
  const configService = new SonarQubeConfigService(context);

  // Edit server URL
  const newServerUrl = await vscode.window.showInputBox({
    prompt: "Enter new SonarQube server URL",
    value: connection.serverUrl,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Server URL is required";
      }
      try {
        new URL(value.trim());
        return null;
      } catch {
        return "Invalid URL format";
      }
    },
  });

  if (!newServerUrl) {
    return;
  }

  // Check if SonarCloud (ask for organization key)
  const isSonarCloud = newServerUrl.includes("sonarcloud.io");
  let organizationKey = connection.organizationKey;

  if (isSonarCloud) {
    const orgKey = await vscode.window.showInputBox({
      prompt: "Enter SonarCloud organization key",
      value: connection.organizationKey || "",
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Organization key is required for SonarCloud";
        }
        return null;
      },
    });

    if (!orgKey) {
      return;
    }
    organizationKey = orgKey.trim();
  }

  // Update connection
  const connections = configService.getConnections();
  const index = connections.findIndex((c) => c.connectionId === connection.connectionId);

  if (index !== -1) {
    connections[index] = {
      ...connection,
      serverUrl: newServerUrl.trim(),
      organizationKey,
    };

    await vscode.workspace
      .getConfiguration("gooseSonarQube")
      .update("connections", connections, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(
      `Connection "${connection.connectionId}" updated successfully!`
    );
  }
}

/**
 * Update token for a connection
 */
async function updateToken(context: vscode.ExtensionContext, connectionId: string): Promise<void> {
  const configService = new SonarQubeConfigService(context);

  const newToken = await vscode.window.showInputBox({
    prompt: "Enter new authentication token",
    password: true,
    placeHolder: "Your token (will be stored securely)",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Token is required";
      }
      return null;
    },
  });

  if (!newToken) {
    return;
  }

  await configService.storeToken(connectionId, newToken.trim());
  vscode.window.showInformationMessage(`Token for "${connectionId}" updated successfully!`);
}

/**
 * Test a SonarQube connection
 */
async function testConnection(
  context: vscode.ExtensionContext,
  connectionId: string
): Promise<void> {
  const configService = new SonarQubeConfigService(context);
  const connections = configService.getConnections();
  const connection = connections.find((c) => c.connectionId === connectionId);

  if (!connection) {
    vscode.window.showErrorMessage(`Connection "${connectionId}" not found`);
    return;
  }

  const token = await configService.getToken(connectionId);
  if (!token) {
    vscode.window.showErrorMessage(`Token not found for connection "${connectionId}"`);
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Testing connection to ${connection.serverUrl}...`,
        cancellable: false,
      },
      async () => {
        const timeout = vscode.workspace
          .getConfiguration("gooseSonarQube")
          .get<number>("timeout", 3000);

        const { SonarQubeService } = await import("../git-analyzer/index.js");
        const sqService = new SonarQubeService({
          serverUrl: connection.serverUrl,
          token,
          projectKey: "test", // Dummy project key for connection test
          timeout,
        });

        const testResult = await sqService.testConnection();

        if (testResult.success) {
          vscode.window.showInformationMessage(
            `✓ Connection successful! SonarQube ${testResult.version} (${testResult.responseTime}ms)`
          );
        } else {
          vscode.window.showErrorMessage(`✗ Connection failed: ${testResult.error}`);
        }
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Connection test failed: ${errorMessage}`);
  }
}

/**
 * Confirm deletion of a connection
 */
async function confirmDelete(connectionId: string): Promise<boolean> {
  const answer = await vscode.window.showWarningMessage(
    `Are you sure you want to delete connection "${connectionId}"?`,
    { modal: true },
    "Delete",
    "Cancel"
  );

  return answer === "Delete";
}

/**
 * Delete a connection
 */
async function deleteConnection(
  context: vscode.ExtensionContext,
  connectionId: string
): Promise<void> {
  const configService = new SonarQubeConfigService(context);
  await configService.removeConnection(connectionId);
  vscode.window.showInformationMessage(`Connection "${connectionId}" deleted successfully!`);
}
