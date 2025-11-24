/**
 * Test SonarQube Connection Command
 * Tests the configured SonarQube connection
 */

import * as vscode from "vscode";
import { SonarQubeConfigService } from "../services/sonarqube-config-service.js";

/**
 * Test SonarQube connection
 */
export async function testSonarQubeConnection(context: vscode.ExtensionContext): Promise<void> {
  const configService = new SonarQubeConfigService(context);

  try {
    const binding = configService.getProjectBinding();
    if (!binding) {
      const bindProject = await vscode.window.showWarningMessage(
        "No SonarQube project binding found. Would you like to bind a project?",
        "Bind Project",
        "Cancel"
      );

      if (bindProject === "Bind Project") {
        const { bindSonarQubeProject } = await import("./bind-sonarqube-project.js");
        await bindSonarQubeProject(context);
      }
      return;
    }

    const connections = configService.getConnections();
    const connection = connections.find((c) => c.connectionId === binding.connectionId);

    if (!connection) {
      vscode.window.showErrorMessage(
        `Connection "${binding.connectionId}" not found. Please check your configuration.`
      );
      return;
    }

    const token = await configService.getToken(binding.connectionId);
    if (!token) {
      vscode.window.showErrorMessage(
        `Token not found for connection "${binding.connectionId}". Please reconfigure the connection.`
      );
      return;
    }

    vscode.window.showInformationMessage(`Testing connection to ${connection.serverUrl}...`);

    const { SonarQubeService } = await import("../git-analyzer/index.js");
    const sqService = new SonarQubeService({
      serverUrl: connection.serverUrl,
      token,
      projectKey: binding.projectKey,
      projectName: binding.projectName || binding.projectKey,
      timeout: 3000,
    });

    const testResult = await sqService.testConnection();

    if (testResult.success) {
      vscode.window.showInformationMessage(
        `✓ Connection successful!\n` +
          `  SonarQube: ${testResult.version}\n` +
          `  Response time: ${testResult.responseTime}ms\n` +
          `  Project: ${binding.projectKey}`
      );
    } else {
      vscode.window.showErrorMessage(
        `✗ Connection failed: ${testResult.error}\n` +
          `  Server: ${connection.serverUrl}\n` +
          `  Project: ${binding.projectKey}`
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Connection test failed: ${errorMessage}`);
  }
}
