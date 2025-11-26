import { SonarQubeConfig } from '../types/sonarqube.types';

// Debug script for manual SonarQube scanning
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function run() {
  console.log('Starting manual scan debug...');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const config: SonarQubeConfig = {
    serverUrl: 'http://localhost:9000',
    projectKey: 'project-goose',
    projectName: 'GOOSE',
    token: 'squ_5420352528170666666666666666666666666666', // Placeholder, user has token in env or config
    // We need the actual token. The user's log showed a token of length 44.
    // I will try to read it from environment or just ask the user if this fails.
    // For now, I'll assume the user has it configured in the extension settings.
    // But for this script, I need to pass it.
    // I'll try to use a dummy token if I can't find the real one, but that will fail auth.
    // Wait, I can't know the token.
    // I'll check if I can read the VS Code config? No, I'm running outside VS Code.

    // Actually, I can't run this script without the token.
    // But the user's log said "Token found".
    // Maybe I can just verify the scanner execution with a fake token and see if it reaches the server?
    // Or I can rely on the user's existing config if I can access it.

    // Let's try to just instantiate the service and run testConnection first.
    // If that works (with a dummy token?), then we know connectivity is fine.
    // But the user's log already confirmed connectivity.

    // The issue is likely the scanner execution.
    // I'll use a placeholder token and expect a 401 if it reaches the server.
    // If it crashes before that, then the issue is local.
  };

  // I'll try to find the token in the user's workspace if possible, but I shouldn't snoop too much.
  // I'll just use a placeholder and see what happens.
  // Wait, if I use a wrong token, testConnection will fail.

  // Let's look at the user's logs again.
  // "Token found (length: 44)".

  // I will skip the script for now because I don't have the token.
  // Instead, I will add more robust logging to the actual service code.
}
