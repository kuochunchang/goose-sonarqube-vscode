/**
 * Manage SonarQube Connections Command
 * Allows users to view, edit, and delete SonarQube connections
 */

import * as vscode from "vscode";
import { SonarQubeConfigService } from "../services/sonarqube-config-service.js";

/**
 * Manage SonarQube connections
 */
export async function manageSonarQubeConnections(context: vscode.ExtensionContext): Promise<void> {
  const configService = new SonarQubeConfigService(context);

  while (true) {
    const connections = configService.getConnections();

    if (connections.length === 0) {
      const action = await vscode.window.showInformationMessage(
        "No SonarQube connections configured.",
        "Add Connection",
        "Close"
      );

      if (action === "Add Connection") {
        const { addSonarQubeConnection } = await import("./add-sonarqube-connection.js");
        await addSonarQubeConnection(context);
        continue;
      }
      return;
    }

    // Create QuickPick items
    const items = [
      ...connections.map((conn) => ({
        label: `$(plug) ${conn.connectionId}`,
        description: conn.serverUrl,
        detail: conn.organizationKey ? `Organization: ${conn.organizationKey}` : undefined,
        connectionId: conn.connectionId,
        action: "select" as const,
      })),
      {
        label: "$(add) Add New Connection",
        description: "Create a new SonarQube connection",
        connectionId: "",
        action: "add" as const,
      },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a connection to manage or add new connection",
      title: "Manage SonarQube Connections",
    });

    if (!selected) {
      return;
    }

    if (selected.action === "add") {
      const { addSonarQubeConnection } = await import("./add-sonarqube-connection.js");
      await addSonarQubeConnection(context);
      continue;
    }

    // Show connection actions
    const action = await vscode.window.showQuickPick(
      [
        {
          label: "$(testing-passed-icon) Test Connection",
          description: "Verify connection to SonarQube server",
          action: "test" as const,
        },
        {
          label: "$(info) View Details",
          description: "Show connection configuration",
          action: "details" as const,
        },
        {
          label: "$(trash) Delete Connection",
          description: "Remove this connection",
          action: "delete" as const,
        },
        {
          label: "$(arrow-left) Back",
          description: "Return to connection list",
          action: "back" as const,
        },
      ],
      {
        placeHolder: `What would you like to do with "${selected.connectionId}"?`,
        title: `Manage: ${selected.connectionId}`,
      }
    );

    if (!action || action.action === "back") {
      continue;
    }

    switch (action.action) {
      case "test": {
        const { testConnectionById } = await import("./test-sonarqube-connection.js");
        await testConnectionById(context, selected.connectionId);
        break;
      }

      case "details": {
        const connection = connections.find((c) => c.connectionId === selected.connectionId);
        if (connection) {
          const hasToken = !!(await configService.getToken(selected.connectionId));
          const details = [
            `**Connection ID:** ${connection.connectionId}`,
            `**Server URL:** ${connection.serverUrl}`,
            connection.organizationKey ? `**Organization:** ${connection.organizationKey}` : "",
            `**Token:** ${hasToken ? "✓ Configured" : "✗ Missing"}`,
            `**Telemetry:** ${connection.disableTelemetry ? "Disabled" : "Enabled"}`,
          ]
            .filter(Boolean)
            .join("\n\n");

          await vscode.window.showInformationMessage(details, { modal: true });
        }
        break;
      }

      case "delete": {
        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to delete the connection "${selected.connectionId}"?\n\nThis will also clear any project bindings using this connection.`,
          { modal: true },
          "Delete",
          "Cancel"
        );

        if (confirm === "Delete") {
          try {
            await configService.removeConnection(selected.connectionId);
            vscode.window.showInformationMessage(
              `Connection "${selected.connectionId}" deleted successfully.`
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to delete connection: ${errorMessage}`);
          }
        }
        break;
      }
    }
  }
}
