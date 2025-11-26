/**
 * Manage Project Binding Command
 * Allows users to view and clear current project binding
 */

import * as vscode from 'vscode';
import { SonarQubeConfigService } from '../services/sonarqube-config-service.js';

/**
 * Manage current workspace's SonarQube project binding
 */
export async function manageProjectBinding(
  context: vscode.ExtensionContext
): Promise<void> {
  const configService = new SonarQubeConfigService(context);

  const binding = configService.getProjectBinding();

  if (!binding) {
    const action = await vscode.window.showInformationMessage(
      'No SonarQube project binding configured for this workspace.',
      'Bind Project',
      'Close'
    );

    if (action === 'Bind Project') {
      const { bindSonarQubeProject } = await import('./bind-sonarqube-project.js');
      await bindSonarQubeProject(context);
    }
    return;
  }

  // Show current binding
  const connections = configService.getConnections();
  const connection = connections.find((c) => c.connectionId === binding.connectionId);

  const details = [
    `**Project Key:** ${binding.projectKey}`,
    binding.projectName ? `**Project Name:** ${binding.projectName}` : '',
    `**Connection ID:** ${binding.connectionId}`,
    connection ? `**Server URL:** ${connection.serverUrl}` : '⚠️ Connection not found',
  ]
    .filter(Boolean)
    .join('\n\n');

  const action = await vscode.window.showInformationMessage(
    `Current Project Binding:\n\n${details}`,
    { modal: true },
    'Test Connection',
    'Change Binding',
    'Clear Binding',
    'Close'
  );

  switch (action) {
    case 'Test Connection':
      if (connection) {
        const { testConnectionById } = await import('./test-sonarqube-connection.js');
        await testConnectionById(context, binding.connectionId, binding.projectKey);
      } else {
        vscode.window.showErrorMessage(
          `Connection "${binding.connectionId}" not found. Please clear the binding and create a new one.`
        );
      }
      break;

    case 'Change Binding':
      const { bindSonarQubeProject } = await import('./bind-sonarqube-project.js');
      await bindSonarQubeProject(context);
      break;

    case 'Clear Binding':
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to clear the project binding for "${binding.projectKey}"?`,
        { modal: true },
        'Clear',
        'Cancel'
      );

      if (confirm === 'Clear') {
        try {
          await configService.clearProjectBinding();
          vscode.window.showInformationMessage('Project binding cleared successfully.');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to clear project binding: ${errorMessage}`);
        }
      }
      break;
  }
}
