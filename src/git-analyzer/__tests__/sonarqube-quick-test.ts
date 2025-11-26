/**
 * SonarQube 快速測試
 *
 * 這是一個簡化版的測試腳本，用於快速測試 SonarQube 連線和基本功能
 *
 * 使用方式：
 * npx tsx packages/git-analyzer/src/__tests__/sonarqube-quick-test.ts <token> [projectKey]
 *
 * 範例：
 * npx tsx packages/git-analyzer/src/__tests__/sonarqube-quick-test.ts squ_abc123def456 my-project
 */

import { SonarQubeService } from '../services/SonarQubeService.js';
import type { SonarQubeConfig } from '../types/sonarqube.types.js';

// 從命令列參數獲取配置
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║       SonarQube 快速測試工具                              ║
╚═══════════════════════════════════════════════════════════╝

使用方式：
  npx tsx src/__tests__/sonarqube-quick-test.ts <token> [projectKey] [serverUrl]

參數：
  token       - SonarQube 認證 token (必填)
  projectKey  - 專案金鑰 (選填，預設: quick-test)
  serverUrl   - SonarQube 伺服器 URL (選填，預設: http://localhost:9000)

範例：
  # 只測試連線
  npx tsx src/__tests__/sonarqube-quick-test.ts squ_abc123def456
  
  # 測試連線並掃描特定專案
  npx tsx src/__tests__/sonarqube-quick-test.ts squ_abc123def456 my-project
  
  # 使用自訂伺服器 URL
  npx tsx src/__tests__/sonarqube-quick-test.ts squ_abc123def456 my-project https://sonarcloud.io

如何獲取 token：
  1. 登入 SonarQube (http://localhost:9000)
  2. 進入 My Account > Security
  3. 點擊 Generate Token
  4. 複製生成的 token

提示：
  - 首次執行建議只測試連線（不指定 projectKey）
  - 確保 SonarQube 伺服器正在運行
  - Token 會以安全方式處理（不會顯示在日誌中）
`);
  process.exit(0);
}

const token = args[0];
const projectKey = args[1] || 'quick-test';
const serverUrl = args[2] || 'http://localhost:9000';

// 基本驗證
if (!token || token.length < 10) {
  console.error('❌ 錯誤: Token 格式不正確');
  console.log('請提供有效的 SonarQube token');
  console.log('執行 --help 查看使用說明');
  process.exit(1);
}

async function quickTest() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  SonarQube 快速測試');
  console.log('═'.repeat(60));
  console.log('');
  console.log(`伺服器: ${serverUrl}`);
  console.log(`專案金鑰: ${projectKey}`);
  console.log(`Token: ${token.substring(0, 10)}...（已隱藏）`);
  console.log('');

  const config: SonarQubeConfig = {
    serverUrl,
    token,
    projectKey,
    projectName: `Quick Test - ${projectKey}`,
    sources: 'src',
    exclusions: 'node_modules/**,dist/**,coverage/**,**/*.test.ts',
    timeout: 5000,
  };

  const service = new SonarQubeService(config);

  try {
    // 測試 1: 連線測試
    console.log('⏳ 測試 1: 檢查伺服器連線...');
    const connectionTest = await service.testConnection();

    if (!connectionTest.success) {
      console.error('❌ 連線失敗:', connectionTest.error);
      console.log('');
      console.log('請檢查：');
      console.log('  1. SonarQube 伺服器是否正在運行');
      console.log('  2. 伺服器 URL 是否正確');
      console.log('  3. Token 是否有效');
      process.exit(1);
    }

    console.log('✅ 連線成功');
    console.log(`   版本: ${connectionTest.version || 'Unknown'}`);
    console.log(`   延遲: ${connectionTest.responseTime}ms`);
    console.log('');

    // 測試 2: 嘗試獲取專案資訊（如果專案已存在）
    console.log('⏳ 測試 2: 檢查專案是否存在...');

    try {
      const analysisResult = await service.getAnalysisResult(projectKey);

      console.log('✅ 專案已存在，成功獲取分析結果');
      console.log(`   總問題數: ${analysisResult.issues.length}`);
      console.log(`   品質閘門: ${analysisResult.qualityGate.status}`);
      console.log(`   Bug: ${analysisResult.metrics.bugs}`);
      console.log(`   漏洞: ${analysisResult.metrics.vulnerabilities}`);
      console.log(`   程式碼異味: ${analysisResult.metrics.codeSmells}`);
      console.log('');
      console.log(`📊 查看報告: ${serverUrl}/dashboard?id=${projectKey}`);
    } catch (error) {
      console.log('ℹ️  專案尚未掃描或不存在');
      console.log('');
      console.log('下一步：');
      console.log('  如需執行完整掃描，請使用完整測試程式：');
      console.log('  npm run test:sonarqube');
      console.log('');
      console.log('  或手動執行掃描：');
      console.log(
        `  sonar-scanner -Dsonar.projectKey=${projectKey} -Dsonar.host.url=${serverUrl} -Dsonar.token=${token.substring(0, 10)}...`
      );
    }

    console.log('');
    console.log('═'.repeat(60));
    console.log('  ✅ 測試完成');
    console.log('═'.repeat(60));
    console.log('');
    console.log('SonarQube 連線正常，可以開始使用！');
    console.log('');
  } catch (error) {
    console.log('');
    console.error('❌ 測試失敗:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.log('');
      console.log('詳細錯誤：');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// 執行測試
quickTest().catch((error) => {
  console.error('\n執行錯誤:', error);
  process.exit(1);
});
