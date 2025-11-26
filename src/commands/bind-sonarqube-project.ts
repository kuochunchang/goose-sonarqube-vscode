/**
 * Bind SonarQube Project Command
 * Allows users to bind workspace to a SonarQube project
 */

import * as vscode from 'vscode';
import {
  SonarQubeConfigService,
  type SonarQubeProjectBinding,
} from '../services/sonarqube-config-service.js';

/**
 * Bind workspace to a SonarQube project
 */
export async function bindSonarQubeProject(context: vscode.ExtensionContext): Promise<void> {
  const configService = new SonarQubeConfigService(context);

  try {
    const connections = configService.getConnections();
    if (connections.length === 0) {
      const addConnection = await vscode.window.showWarningMessage(
        'No SonarQube connections found. Would you like to add one?',
        'Add Connection',
        'Cancel'
      );

      if (addConnection === 'Add Connection') {
        const { addSonarQubeConnection } = await import('./add-sonarqube-connection.js');
        await addSonarQubeConnection(context);
        // Retry after adding connection
        return bindSonarQubeProject(context);
      }
      return;
    }

    // Step 1: Select connection
    const connectionItems = connections.map((conn) => ({
      label: conn.connectionId,
      description: conn.serverUrl,
      connectionId: conn.connectionId,
    }));

    const selectedConnection = await vscode.window.showQuickPick(connectionItems, {
      placeHolder: 'Select a SonarQube connection',
    });

    if (!selectedConnection) {
      return;
    }

    // Step 2: Get project key
    const projectKey = await vscode.window.showInputBox({
      prompt: 'Enter SonarQube project key',
      placeHolder: 'my-project-key',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Project key is required';
        }
        return null;
      },
    });

    if (!projectKey) {
      return;
    }

    // Step 3: Get project name (optional)
    const projectName = await vscode.window.showInputBox({
      prompt: 'Enter project display name (optional)',
      placeHolder: 'My Project',
    });

    // Step 4: Create binding
    const binding: SonarQubeProjectBinding = {
      connectionId: selectedConnection.connectionId,
      projectKey: projectKey.trim(),
      projectName: projectName?.trim(),
    };

    await configService.setProjectBinding(binding);

    vscode.window.showInformationMessage(
      `Workspace bound to SonarQube project "${projectKey}" successfully!`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to bind SonarQube project: ${errorMessage}`);
  }
}
