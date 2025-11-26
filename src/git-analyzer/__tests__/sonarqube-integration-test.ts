/**
 * SonarQube 整合測試
 *
 * 這個測試程式會：
 * 1. 連接到 SonarQube 伺服器
 * 2. 執行程式碼掃描
 * 3. 獲取分析結果
 * 4. 顯示問題和品質指標
 *
 * 使用方式：
 * 1. 確保 SonarQube 伺服器正在運行 (預設: http://localhost:9000)
 * 2. 更新下面的配置（serverUrl, token, projectKey）
 * 3. 執行: npx tsx packages/git-analyzer/src/__tests__/sonarqube-integration-test.ts
 */

import { SonarQubeService } from '../services/SonarQubeService.js';
import type { SonarQubeConfig } from '../types/sonarqube.types.js';
import * as path from 'path';

// ============================================
// 配置區域 - 請根據您的環境修改
// ============================================
// Note: TEST_CONFIG is defined here for reference but should be configured via environment
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TEST_CONFIG: SonarQubeConfig = {
  // SonarQube 伺服器 URL
  serverUrl: 'http://localhost:9001',

  // 認證 Token (從 SonarQube 介面生成: My Account > Security > Generate Tokens)
  token: 'sqa_2831130cded5ddd88814e6f903bfa09cbeb49d79',

  // 專案唯一識別碼
  projectKey: 'code-review-goose-git-analyzer',

  // 專案名稱（顯示用）
  projectName: 'Git Analyzer Package',

  // 專案版本
  projectVersion: '1.0.0',

  // 要掃描的原始碼目錄
  sources: 'src',

  // 排除的目錄或檔案
  exclusions: 'node_modules/**,dist/**,build/**,coverage/**,**/*.test.ts,**/*.spec.ts',

  // 連線逾時時間（毫秒）
  timeout: 5000,
};

// 測試選項
const TEST_OPTIONS = {
  // 是否跳過掃描（只測試連線和獲取結果）
  skipScan: false,

  // 是否在掃描後等待一段時間（讓 SonarQube 處理結果）
  waitAfterScan: true,

  // 等待時間（毫秒）
  waitTime: 3000,

  // 是否顯示詳細的問題列表
  showDetailedIssues: true,

  // 最多顯示幾個問題
  maxIssuesToShow: 10,
};

// ============================================
// 輔助函數
// ============================================

/**
 * 格式化時間（毫秒轉秒）
 */
function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2);
}

/**
 * 顯示進度訊息
 */
function logStep(step: number, message: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`步驟 ${step}: ${message}`);
  console.log('='.repeat(60));
}

/**
 * 顯示成功訊息
 */
function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

/**
 * 顯示錯誤訊息
 */
function logError(message: string) {
  console.error(`❌ ${message}`);
}

/**
 * 顯示警告訊息
 */
function logWarning(message: string) {
  console.warn(`⚠️  ${message}`);
}

/**
 * 顯示資訊
 */
function logInfo(message: string) {
  console.log(`ℹ️  ${message}`);
}

/**
 * 等待指定時間
 */
async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// 主測試函數
// ============================================

/**
 * 執行 SonarQube 整合測試
 */
async function runSonarQubeTest() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       SonarQube 整合測試程式                              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  // 驗證配置
  const TEST_CONFIG: SonarQubeConfig = {
    serverUrl: 'http://localhost:9001', // 使用 9001 端口
    token: 'sqa_2831130cded5ddd88814e6f903bfa09cbeb49d79',
    projectKey: 'code-review-goose-test',
    projectName: 'Code Review Goose - Test',
    sources: 'src',
    exclusions: 'node_modules/**,dist/**,coverage/**',
  };

  const workingDir = path.resolve(process.cwd());
  logInfo(`工作目錄: ${workingDir}`);
  logInfo(`專案金鑰: ${TEST_CONFIG.projectKey}`);
  logInfo(`掃描範圍: ${TEST_CONFIG.sources}`);
  logInfo(`排除項目: ${TEST_CONFIG.exclusions}`);

  // 初始化 SonarQube Service
  const service = new SonarQubeService(TEST_CONFIG);

  try {
    // ========================================
    // 步驟 1: 測試連線
    // ========================================
    logStep(1, '測試 SonarQube 伺服器連線');

    const connectionTest = await service.testConnection();

    if (!connectionTest.success) {
      logError(`連線失敗: ${connectionTest.error}`);
      logInfo('請確認：');
      logInfo('1. SonarQube 伺服器是否正在運行');
      logInfo('2. serverUrl 是否正確');
      logInfo('3. token 是否有效');
      process.exit(1);
    }

    logSuccess('連線成功！');
    console.log(`   版本: ${connectionTest.version || 'Unknown'}`);
    console.log(`   回應時間: ${connectionTest.responseTime}ms`);

    // ========================================
    // 步驟 2: 執行掃描
    // ========================================
    if (!TEST_OPTIONS.skipScan) {
      logStep(2, '執行程式碼掃描');

      logInfo('開始掃描... 這可能需要幾分鐘時間');
      logInfo('請注意: 大型專案可能需要更長時間');

      // Start time tracking (for future metrics)
      // const scanStartTime = Date.now();
      const scanResult = await service.executeScan({
        workingDirectory: workingDir,
        waitForAnalysis: false,
      });

      if (!scanResult.success) {
        logError(`掃描失敗: ${scanResult.error}`);
        logInfo('常見問題：');
        logInfo('1. sources 路徑是否正確');
        logInfo('2. 專案目錄是否有可讀取的檔案');
        logInfo('3. SonarQube Scanner 是否已正確安裝');
        process.exit(1);
      }

      logSuccess('掃描完成！');
      console.log(`   執行時間: ${formatTime(scanResult.executionTime)}秒`);

      if (scanResult.taskId) {
        console.log(`   任務 ID: ${scanResult.taskId}`);
      }

      if (scanResult.dashboardUrl) {
        console.log(`   查看報告: ${scanResult.dashboardUrl}`);
      }

      // 等待 SonarQube 伺服器處理結果
      if (TEST_OPTIONS.waitAfterScan) {
        logInfo(`等待 ${TEST_OPTIONS.waitTime / 1000} 秒讓 SonarQube 處理結果...`);
        await wait(TEST_OPTIONS.waitTime);
      }
    } else {
      logWarning('跳過掃描步驟');
    }

    // ========================================
    // 步驟 3: 獲取分析結果
    // ========================================
    logStep(3, '獲取分析結果');

    logInfo('從 SonarQube 獲取分析結果...');

    const analysisResult = await service.getAnalysisResult(TEST_CONFIG.projectKey);

    logSuccess('成功獲取分析結果！');

    // ========================================
    // 步驟 4: 顯示結果摘要
    // ========================================
    logStep(4, '分析結果摘要');

    console.log('\n📊 專案資訊');
    console.log(`   專案金鑰: ${analysisResult.projectKey}`);
    console.log(`   分析時間: ${new Date(analysisResult.analysisDate).toLocaleString('zh-TW')}`);

    console.log('\n🎯 品質閘門 (Quality Gate)');
    console.log(`   狀態: ${analysisResult.qualityGate.status}`);
    if (analysisResult.qualityGate.status === 'OK') {
      logSuccess('通過品質閘門檢查');
    } else if (analysisResult.qualityGate.status === 'ERROR') {
      logError('未通過品質閘門檢查');
    } else {
      logWarning(`品質閘門狀態: ${analysisResult.qualityGate.status}`);
    }

    if (analysisResult.qualityGate.conditions && analysisResult.qualityGate.conditions.length > 0) {
      console.log('\n   條件檢查:');
      for (const condition of analysisResult.qualityGate.conditions) {
        const statusIcon = condition.status === 'OK' ? '✓' : '✗';
        console.log(
          `   ${statusIcon} ${condition.metric}: ${condition.value} ${condition.operator} ${condition.errorThreshold || 'N/A'}`
        );
      }
    }

    console.log('\n📈 程式碼指標');
    console.log(`   程式碼行數: ${analysisResult.metrics.linesOfCode?.toLocaleString() || 'N/A'}`);
    console.log(`   測試覆蓋率: ${analysisResult.metrics.coverage?.toFixed(2) || 'N/A'}%`);
    console.log(
      `   技術債比率: ${analysisResult.metrics.technicalDebtRatio?.toFixed(2) || 'N/A'}%`
    );
    console.log(
      `   重複行密度: ${analysisResult.metrics.duplicatedLinesDensity?.toFixed(2) || 'N/A'}%`
    );

    console.log('\n🐛 問題統計');
    console.log(`   總問題數: ${analysisResult.issues.length}`);
    console.log(`   Bug: ${analysisResult.metrics.bugs}`);
    console.log(`   漏洞 (Vulnerabilities): ${analysisResult.metrics.vulnerabilities}`);
    console.log(`   程式碼異味 (Code Smells): ${analysisResult.metrics.codeSmells}`);
    console.log(`   安全熱點 (Security Hotspots): ${analysisResult.metrics.securityHotspots}`);

    console.log('\n⚠️  嚴重程度分佈');
    console.log(`   BLOCKER:  ${analysisResult.issuesBySeverity.BLOCKER}`);
    console.log(`   CRITICAL: ${analysisResult.issuesBySeverity.CRITICAL}`);
    console.log(`   MAJOR:    ${analysisResult.issuesBySeverity.MAJOR}`);
    console.log(`   MINOR:    ${analysisResult.issuesBySeverity.MINOR}`);
    console.log(`   INFO:     ${analysisResult.issuesBySeverity.INFO}`);

    console.log('\n🔍 問題類型分佈');
    console.log(`   BUG:              ${analysisResult.issuesByType.BUG}`);
    console.log(`   VULNERABILITY:    ${analysisResult.issuesByType.VULNERABILITY}`);
    console.log(`   CODE_SMELL:       ${analysisResult.issuesByType.CODE_SMELL}`);
    console.log(`   SECURITY_HOTSPOT: ${analysisResult.issuesByType.SECURITY_HOTSPOT}`);

    // ========================================
    // 步驟 5: 顯示詳細問題列表
    // ========================================
    if (TEST_OPTIONS.showDetailedIssues && analysisResult.issues.length > 0) {
      logStep(5, '詳細問題列表');

      const issuesToShow = analysisResult.issues.slice(0, TEST_OPTIONS.maxIssuesToShow);

      for (let i = 0; i < issuesToShow.length; i++) {
        const issue = issuesToShow[i];
        console.log(`\n問題 ${i + 1}/${issuesToShow.length}:`);
        console.log(`   嚴重程度: ${issue.severity}`);
        console.log(`   類型: ${issue.type}`);
        console.log(`   規則: ${issue.rule}`);
        console.log(`   訊息: ${issue.message}`);
        console.log(`   檔案: ${issue.component.replace(TEST_CONFIG.projectKey + ':', '')}`);

        if (issue.textRange) {
          console.log(`   位置: Line ${issue.textRange.startLine}`);
          if (issue.textRange.startLine !== issue.textRange.endLine) {
            console.log(`         to Line ${issue.textRange.endLine}`);
          }
        }

        if (issue.effort) {
          console.log(`   修復工時: ${issue.effort}`);
        }

        if (issue.tags && issue.tags.length > 0) {
          console.log(`   標籤: ${issue.tags.join(', ')}`);
        }
      }

      if (analysisResult.issues.length > TEST_OPTIONS.maxIssuesToShow) {
        console.log(
          `\n... 還有 ${analysisResult.issues.length - TEST_OPTIONS.maxIssuesToShow} 個問題未顯示`
        );
        console.log(
          `請前往 SonarQube 介面查看完整報告: ${TEST_CONFIG.serverUrl}/dashboard?id=${TEST_CONFIG.projectKey}`
        );
      }
    }

    // ========================================
    // 測試完成
    // ========================================
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       測試完成！                                          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');

    logSuccess('所有測試步驟已成功完成');

    if (analysisResult.issues.length > 0) {
      logWarning(`發現 ${analysisResult.issues.length} 個問題需要修復`);
    } else {
      logSuccess('未發現任何問題，程式碼品質良好！');
    }

    console.log(
      `\n📊 查看完整報告: ${TEST_CONFIG.serverUrl}/dashboard?id=${TEST_CONFIG.projectKey}`
    );
  } catch (error) {
    console.log('\n');
    logError('測試過程中發生錯誤');

    if (error instanceof Error) {
      console.error('\n錯誤訊息:', error.message);

      if (error.stack) {
        console.error('\n錯誤堆疊:');
        console.error(error.stack);
      }
    } else {
      console.error('\n錯誤:', error);
    }

    process.exit(1);
  }
}

// ============================================
// 執行測試
// ============================================

// 處理未捕獲的錯誤
process.on('unhandledRejection', (reason, _promise) => {
  console.error('\n未處理的 Promise 拒絕:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n未捕獲的異常:', error);
  process.exit(1);
});

// 執行測試
runSonarQubeTest()
  .then(() => {
    console.log('\n測試程式執行完畢');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n測試程式執行失敗:', error);
    process.exit(1);
  });
