/**
 * SonarQube Configuration Service
 * Manages SonarQube connections, project bindings, and secure token storage
 */

import * as vscode from "vscode";
import type { SonarQubeConfig } from "../git-analyzer/index.js";

/**
 * SonarQube connection configuration
 */
export interface SonarQubeConnection {
  connectionId: string;
  serverUrl: string;
  organizationKey?: string;
  disableTelemetry?: boolean;
}

/**
 * SonarQube project binding
 */
export interface SonarQubeProjectBinding {
  connectionId: string;
  projectKey: string;
  projectName?: string;
}

/**
 * Service for managing SonarQube configuration
 */
export class SonarQubeConfigService {
  private static readonly SECRET_STORAGE_KEY_PREFIX = "sonarqube.token.";

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Get all configured connections
   */
  getConnections(): SonarQubeConnection[] {
    const config = vscode.workspace.getConfiguration("gooseSonarQube");
    return config.get<SonarQubeConnection[]>("connections", []);
  }

  /**
   * Get project binding for current workspace
   */
  getProjectBinding(): SonarQubeProjectBinding | null {
    const config = vscode.workspace.getConfiguration("gooseSonarQube");
    return config.get<SonarQubeProjectBinding | null>("projectBinding", null);
  }

  /**
   * Get token for a connection (from Secret Storage)
   */
  async getToken(connectionId: string): Promise<string | undefined> {
    const secretKey = `${SonarQubeConfigService.SECRET_STORAGE_KEY_PREFIX}${connectionId}`;
    return await this.context.secrets.get(secretKey);
  }

  /**
   * Store token securely (in Secret Storage)
   */
  async storeToken(connectionId: string, token: string): Promise<void> {
    const secretKey = `${SonarQubeConfigService.SECRET_STORAGE_KEY_PREFIX}${connectionId}`;
    await this.context.secrets.store(secretKey, token);
  }

  /**
   * Delete stored token
   */
  async deleteToken(connectionId: string): Promise<void> {
    const secretKey = `${SonarQubeConfigService.SECRET_STORAGE_KEY_PREFIX}${connectionId}`;
    await this.context.secrets.delete(secretKey);
  }

  /**
   * Add a new connection
   */
  async addConnection(connection: SonarQubeConnection, token: string): Promise<void> {
    const connections = this.getConnections();

    // Check if connectionId already exists
    if (connections.some((c) => c.connectionId === connection.connectionId)) {
      throw new Error(`Connection with ID "${connection.connectionId}" already exists`);
    }

    // Add connection
    connections.push(connection);
    await vscode.workspace
      .getConfiguration("gooseSonarQube")
      .update("connections", connections, vscode.ConfigurationTarget.Global);

    // Store token securely
    await this.storeToken(connection.connectionId, token);
  }

  /**
   * Remove a connection
   */
  async removeConnection(connectionId: string): Promise<void> {
    const connections = this.getConnections().filter((c) => c.connectionId !== connectionId);
    await vscode.workspace
      .getConfiguration("gooseSonarQube")
      .update("connections", connections, vscode.ConfigurationTarget.Global);

    // Delete stored token
    await this.deleteToken(connectionId);

    // Clear project binding if it uses this connection
    const binding = this.getProjectBinding();
    if (binding?.connectionId === connectionId) {
      await this.clearProjectBinding();
    }
  }

  /**
   * Update project binding
   */
  async setProjectBinding(binding: SonarQubeProjectBinding): Promise<void> {
    // Verify connection exists
    const connections = this.getConnections();
    if (!connections.some((c) => c.connectionId === binding.connectionId)) {
      throw new Error(`Connection "${binding.connectionId}" not found`);
    }

    await vscode.workspace
      .getConfiguration("gooseSonarQube")
      .update("projectBinding", binding, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Clear project binding
   */
  async clearProjectBinding(): Promise<void> {
    await vscode.workspace
      .getConfiguration("gooseSonarQube")
      .update("projectBinding", null, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Get complete SonarQube configuration for git-analyzer
   */
  async getSonarQubeConfig(): Promise<SonarQubeConfig | null> {
    console.log("[SonarQube Config] Getting SonarQube config...");

    const binding = this.getProjectBinding();
    if (!binding) {
      console.log("[SonarQube Config] No project binding found");
      return null;
    }
    console.log("[SonarQube Config] Project binding:", JSON.stringify(binding));

    const connections = this.getConnections();
    console.log(
      "[SonarQube Config] Available connections:",
      connections.map((c) => c.connectionId)
    );

    const connection = connections.find((c) => c.connectionId === binding.connectionId);
    if (!connection) {
      console.log("[SonarQube Config] Connection not found for ID:", binding.connectionId);
      return null;
    }
    console.log("[SonarQube Config] Found connection:", connection.serverUrl);

    const token = await this.getToken(connection.connectionId);
    if (!token) {
      console.log("[SonarQube Config] Token not found for connection:", connection.connectionId);
      return null;
    }
    console.log("[SonarQube Config] Token found (length:", token.length, ")");

    const timeout = vscode.workspace
      .getConfiguration("gooseSonarQube")
      .get<number>("timeout", 3000);

    console.log("[SonarQube Config] Config ready - projectKey:", binding.projectKey);
    return {
      serverUrl: connection.serverUrl,
      token,
      projectKey: binding.projectKey,
      projectName: binding.projectName || binding.projectKey,
      timeout,
      skipCertVerification: false,
    };
  }

  /**
   * Check if SonarQube is enabled
   */
  isEnabled(): boolean {
    return vscode.workspace.getConfiguration("gooseSonarQube").get<boolean>("enabled", true);
  }

  /**
   * Get analysis mode preference (always returns 'sonarqube-only')
   */
  getAnalysisMode(): "sonarqube-only" {
    return "sonarqube-only";
  }

  /**
   * Check if SonarQube configuration is complete
   * Returns an object with status and missing configuration details
   */
  async checkConfiguration(): Promise<{
    isComplete: boolean;
    missingSteps: string[];
    hasConnection: boolean;
    hasBinding: boolean;
    hasToken: boolean;
  }> {
    const missingSteps: string[] = [];
    const connections = this.getConnections();
    const binding = this.getProjectBinding();

    const hasConnection = connections.length > 0;
    const hasBinding = binding !== null;
    let hasToken = false;

    if (!hasConnection) {
      missingSteps.push("No SonarQube connection configured");
    }

    if (!hasBinding) {
      missingSteps.push("No project binding configured");
    } else {
      // Check if the connection exists and has a token
      const connection = connections.find((c) => c.connectionId === binding.connectionId);
      if (!connection) {
        missingSteps.push("Project binding references a non-existent connection");
      } else {
        const token = await this.getToken(binding.connectionId);
        hasToken = !!token;
        if (!token) {
          missingSteps.push("No authentication token found for the connection");
        }
      }
    }

    return {
      isComplete: missingSteps.length === 0,
      missingSteps,
      hasConnection,
      hasBinding,
      hasToken,
    };
  }
}
