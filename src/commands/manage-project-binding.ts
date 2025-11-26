/**
 * Manage SonarQube Project Binding Command
 * Allows users to view, edit, and delete project binding
 */

import * as vscode from "vscode";
import {
  SonarQubeConfigService,
  type SonarQubeProjectBinding,
} from "../services/sonarqube-config-service.js";

/**
 * Manage SonarQube project binding
 */
export async function manageSonarQubeProjectBinding(
  context: vscode.ExtensionContext
): Promise<void> {
  const configService = new SonarQubeConfigService(context);

  try {
    const binding = configService.getProjectBinding();

    if (!binding) {
      const actions = [
        {
          label: "$(link) Bind to SonarQube Project",
          description: "Connect this workspace to a SonarQube project",
          action: "bind" as const,
        },
        {
          label: "$(info) No Project Binding",
          description: "This workspace is not bound to any SonarQube project",
          action: "none" as const,
        },
      ];

      const selected = await vscode.window.showQuickPick(actions, {
        placeHolder: "Manage Project Binding",
      });

      if (!selected) {
        return;
      }

      if (selected.action === "bind") {
        const { bindSonarQubeProject } = await import("./bind-sonarqube-project.js");
        await bindSonarQubeProject(context);
      }
      return;
    }

    // Show binding details and actions
    const connections = configService.getConnections();
    const connection = connections.find((c) => c.connectionId === binding.connectionId);
    const serverUrl = connection?.serverUrl || "Unknown";

    const actions = [
      {
        label: "$(info) Current Binding",
        description: `${binding.projectKey} @ ${serverUrl}`,
        action: "info" as const,
      },
      {
        label: "$(edit) Edit Binding",
        description: "Change connection or project key",
        action: "edit" as const,
      },
      {
        label: "$(refresh) Rebind Project",
        description: "Select a different SonarQube project",
        action: "rebind" as const,
      },
      {
        label: "$(trash) Remove Binding",
        description: "Unbind this workspace from SonarQube",
        action: "remove" as const,
      },
    ];

    const selected = await vscode.window.showQuickPick(actions, {
      placeHolder: `Project Binding: ${binding.projectName || binding.projectKey}`,
    });

    if (!selected) {
      return;
    }

    switch (selected.action) {
      case "info":
        await showBindingDetails(context, binding);
        break;

      case "edit":
        await editBinding(context, binding);
        break;

      case "rebind":
        await rebindProject(context);
        break;

      case "remove":
        await removeBinding(context, binding);
        break;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to manage project binding: ${errorMessage}`);
  }
}

/**
 * Show detailed information about current binding
 */
async function showBindingDetails(
  context: vscode.ExtensionContext,
  binding: SonarQubeProjectBinding
): Promise<void> {
  const configService = new SonarQubeConfigService(context);
  const connections = configService.getConnections();
  const connection = connections.find((c) => c.connectionId === binding.connectionId);

  const details = [
    `**Project Key**: ${binding.projectKey}`,
    binding.projectName ? `**Project Name**: ${binding.projectName}` : "",
    `**Connection**: ${binding.connectionId}`,
    connection
      ? `**Server URL**: ${connection.serverUrl}`
      : "**Server URL**: Unknown (connection not found)",
    connection?.organizationKey ? `**Organization**: ${connection.organizationKey}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const actions = ["$(edit) Edit Binding", "$(trash) Remove Binding", "$(arrow-left) Back"];

  const selected = await vscode.window.showQuickPick(actions, {
    placeHolder: "Project Binding Details",
    title: details,
  });

  if (!selected) {
    return;
  }

  if (selected.includes("Edit")) {
    await editBinding(context, binding);
  } else if (selected.includes("Remove")) {
    await removeBinding(context, binding);
  } else if (selected.includes("Back")) {
    await manageSonarQubeProjectBinding(context);
  }
}

/**
 * Edit existing binding
 */
async function editBinding(
  context: vscode.ExtensionContext,
  binding: SonarQubeProjectBinding
): Promise<void> {
  const configService = new SonarQubeConfigService(context);

  // Select connection (allow changing)
  const connections = configService.getConnections();
  if (connections.length === 0) {
    vscode.window.showErrorMessage("No connections available. Please add a connection first.");
    return;
  }

  const connectionItems = connections.map((conn) => ({
    label: conn.connectionId,
    description: conn.serverUrl,
    picked: conn.connectionId === binding.connectionId,
    connectionId: conn.connectionId,
  }));

  const selectedConnection = await vscode.window.showQuickPick(connectionItems, {
    placeHolder: "Select SonarQube connection",
  });

  if (!selectedConnection) {
    return;
  }

  // Edit project key
  const newProjectKey = await vscode.window.showInputBox({
    prompt: "Enter SonarQube project key",
    value: binding.projectKey,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Project key is required";
      }
      return null;
    },
  });

  if (!newProjectKey) {
    return;
  }

  // Edit project name
  const newProjectName = await vscode.window.showInputBox({
    prompt: "Enter project display name (optional)",
    value: binding.projectName || "",
  });

  // Update binding
  const newBinding: SonarQubeProjectBinding = {
    connectionId: selectedConnection.connectionId,
    projectKey: newProjectKey.trim(),
    projectName: newProjectName?.trim() || undefined,
  };

  await configService.setProjectBinding(newBinding);
  vscode.window.showInformationMessage(
    `Project binding updated to "${newProjectKey}" successfully!`
  );

  // Reopen menu
  await manageSonarQubeProjectBinding(context);
}

/**
 * Rebind to a different project (simplified flow)
 */
async function rebindProject(context: vscode.ExtensionContext): Promise<void> {
  const { bindSonarQubeProject } = await import("./bind-sonarqube-project.js");
  await bindSonarQubeProject(context);
  await manageSonarQubeProjectBinding(context);
}

/**
 * Remove project binding
 */
async function removeBinding(
  context: vscode.ExtensionContext,
  binding: SonarQubeProjectBinding
): Promise<void> {
  const answer = await vscode.window.showWarningMessage(
    `Are you sure you want to remove the binding to "${binding.projectKey}"?`,
    { modal: true },
    "Remove",
    "Cancel"
  );

  if (answer !== "Remove") {
    await manageSonarQubeProjectBinding(context);
    return;
  }

  const configService = new SonarQubeConfigService(context);
  await configService.clearProjectBinding();
  vscode.window.showInformationMessage("Project binding removed successfully!");
}
