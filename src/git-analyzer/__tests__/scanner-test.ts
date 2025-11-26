/**
 * Manual test script to verify SonarQube scanner execution
 * Run with: npm run test:scanner
 */

import { SonarQubeService } from '../services/SonarQubeService.js';
import type { SonarQubeConfig } from '../types/index.js';

async function testScanner() {
  console.log('=== SonarQube Scanner Test ===\n');

  // Test configuration (update with your actual values)
  const config: SonarQubeConfig = {
    serverUrl: 'http://localhost:9000',
    token: 'your-token-here', // Replace with your actual token
    projectKey: 'test-project',
    projectName: 'Test Project',
    sources: '.',
    exclusions: 'node_modules/**,dist/**,build/**',
    timeout: 30000,
  };

  const service = new SonarQubeService(config);

  // Step 1: Test connection
  console.log('Step 1: Testing connection...');
  const connectionTest = await service.testConnection();
  console.log('Connection result:', connectionTest);

  if (!connectionTest.success) {
    console.error('❌ Connection failed. Please check your SonarQube server and token.');
    process.exit(1);
  }

  console.log('✅ Connection successful\n');

  // Step 2: Execute scan
  console.log('Step 2: Executing scanner...');
  const scanResult = await service.executeScan({
    workingDirectory: process.cwd(),
  });

  console.log('\n=== Scan Result ===');
  console.log('Success:', scanResult.success);
  console.log('Execution time:', scanResult.executionTime, 'ms');
  console.log('Task ID:', scanResult.taskId || 'N/A');
  console.log('Dashboard URL:', scanResult.dashboardUrl || 'N/A');
  if (scanResult.error) {
    console.log('Error:', scanResult.error);
  }

  if (!scanResult.success) {
    console.error('❌ Scanner execution failed');
    process.exit(1);
  }

  console.log('✅ Scanner completed successfully\n');

  // Step 3: Wait for analysis to complete on server
  if (scanResult.taskId) {
    console.log('Step 3: Waiting for server-side analysis to complete...');
    try {
      const analysisCompleted = await service.waitForAnalysis(scanResult.taskId, 300000);
      if (analysisCompleted) {
        console.log('✅ Server-side analysis completed\n');
      }
    } catch (error) {
      console.error('❌ Server-side analysis failed:', error);
      process.exit(1);
    }
  } else {
    console.log('⚠️ No task ID available, skipping wait for analysis\n');
  }

  // Step 4: Get analysis results
  console.log('Step 4: Fetching analysis results...');
  try {
    const analysisResult = await service.getAnalysisResult(config.projectKey);
    console.log('\n=== Analysis Result ===');
    console.log('Project:', analysisResult.projectKey);
    console.log('Analysis date:', analysisResult.analysisDate);
    console.log('Total issues:', analysisResult.issues.length);
    console.log('Quality gate:', analysisResult.qualityGate.status);
    console.log('Issues by severity:', analysisResult.issuesBySeverity);
    console.log('Issues by type:', analysisResult.issuesByType);
    console.log('\n✅ Analysis results retrieved successfully');
  } catch (error) {
    console.error('❌ Failed to fetch analysis results:', error);
    process.exit(1);
  }
}

// Run test
testScanner().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
