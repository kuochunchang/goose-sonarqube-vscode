/**
 * Add SonarQube Connection Command
 * Allows users to add a new SonarQube/SonarCloud connection
 */

import * as vscode from 'vscode';
import { SonarQubeConfigService, type SonarQubeConnection } from '../services/sonarqube-config-service.js';

/**
 * Add a new SonarQube connection
 */
export async function addSonarQubeConnection(
  context: vscode.ExtensionContext
): Promise<void> {
  const configService = new SonarQubeConfigService(context);

  try {
    // Step 1: Get connection ID
    const connectionId = await vscode.window.showInputBox({
      prompt: 'Enter a unique connection identifier (e.g., local-sonarqube, sonarcloud)',
      placeHolder: 'local-sonarqube',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Connection ID is required';
        }
        const existing = configService.getConnections();
        if (existing.some(c => c.connectionId === value.trim())) {
          return `Connection ID "${value.trim()}" already exists`;
        }
        return null;
      },
    });

    if (!connectionId) {
      return;
    }

    // Step 2: Get server URL
    const serverUrl = await vscode.window.showInputBox({
      prompt: 'Enter SonarQube server URL (e.g., http://localhost:9000 or https://sonarcloud.io)',
      placeHolder: 'http://localhost:9000',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Server URL is required';
        }
        try {
          new URL(value.trim());
          return null;
        } catch {
          return 'Invalid URL format';
        }
      },
    });

    if (!serverUrl) {
      return;
    }

    // Step 3: Check if SonarCloud (ask for organization key)
    const isSonarCloud = serverUrl.includes('sonarcloud.io');
    let organizationKey: string | undefined;
    if (isSonarCloud) {
      const orgKey = await vscode.window.showInputBox({
        prompt: 'Enter SonarCloud organization key',
        placeHolder: 'my-org',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Organization key is required for SonarCloud';
          }
          return null;
        },
      });
      if (!orgKey) {
        return;
      }
      organizationKey = orgKey.trim();
    }

    // Step 4: Get token (store securely)
    const token = await vscode.window.showInputBox({
      prompt: 'Enter SonarQube authentication token',
      password: true,
      placeHolder: 'Your token (will be stored securely)',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Token is required';
        }
        return null;
      },
    });

    if (!token) {
      return;
    }

    // Step 5: Create connection
    const connection: SonarQubeConnection = {
      connectionId: connectionId.trim(),
      serverUrl: serverUrl.trim(),
      organizationKey,
      disableTelemetry: false,
    };

    await configService.addConnection(connection, token.trim());

    vscode.window.showInformationMessage(
      `SonarQube connection "${connectionId}" added successfully!`
    );

    // Optionally test the connection
    const testNow = await vscode.window.showQuickPick(['Yes', 'No'], {
      placeHolder: 'Would you like to test the connection now?',
    });

    if (testNow === 'Yes') {
      await testConnection(context, connectionId.trim());
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to add SonarQube connection: ${errorMessage}`);
  }
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
  const connection = connections.find(c => c.connectionId === connectionId);

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
    vscode.window.showInformationMessage(`Testing connection to ${connection.serverUrl}...`);

    const timeout = vscode.workspace
      .getConfiguration('gooseSonarQube')
      .get<number>('timeout', 3000);

    const { SonarQubeService } = await import('../git-analyzer/index.js');
    const sqService = new SonarQubeService({
      serverUrl: connection.serverUrl,
      token,
      projectKey: 'test', // Dummy project key for connection test
      timeout,
    });

    const testResult = await sqService.testConnection();

    if (testResult.success) {
      vscode.window.showInformationMessage(
        `✓ Connection successful! SonarQube ${testResult.version} (${testResult.responseTime}ms)`
      );
    } else {
      vscode.window.showErrorMessage(
        `✗ Connection failed: ${testResult.error}`
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Connection test failed: ${errorMessage}`);
  }
}

