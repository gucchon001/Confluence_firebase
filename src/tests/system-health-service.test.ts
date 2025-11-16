/**
 * システムヘルスサービスのテスト
 * 
 * 実行方法:
 *   npx tsx src/tests/system-health-service.test.ts
 */

// テスト用の環境変数を事前に読み込む（app-configのインポート前に）
import { loadTestEnv } from './test-helpers/env-loader';

// loadTestEnv()を即座に実行して環境変数を設定
loadTestEnv();

// 型定義のみインポート（実行時インポートは不要）
import type { SystemHealth } from '@/types';

// テスト結果の型
interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

// テスト結果を表示
function printTestResult(result: TestResult): void {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.name}`);
  if (!result.passed || result.details) {
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   詳細:`, JSON.stringify(result.details, null, 2));
    }
  }
}

// テスト1: システムステータス取得
async function testGetSystemStatus(): Promise<TestResult> {
  console.log('\n📊 テスト1: システムステータス取得');
  
  try {
    // 動的インポートでサービスを読み込む（環境変数設定後に確実に実行される）
    const { systemHealthService } = await import('@/lib/system-health-service');
    const health = await systemHealthService.getSystemStatus();

    if (!health) {
      return {
        name: 'システムステータス取得',
        passed: false,
        message: 'システムステータスが取得できませんでした',
      };
    }

    if (!health.id) {
      return {
        name: 'システムステータス取得',
        passed: false,
        message: 'システムステータスIDが設定されていません',
        details: { health }
      };
    }

    if (!health.timestamp) {
      return {
        name: 'システムステータス取得',
        passed: false,
        message: 'タイムスタンプが設定されていません',
        details: { health }
      };
    }

    if (!['healthy', 'warning', 'critical'].includes(health.status)) {
      return {
        name: 'システムステータス取得',
        passed: false,
        message: `無効なステータス値: ${health.status}`,
        details: { health }
      };
    }

    return {
      name: 'システムステータス取得',
      passed: true,
      message: `システムステータスが正常に取得されました: ${health.status}`,
      details: {
        status: health.status,
        services: Object.keys(health.services),
        metrics: health.metrics,
      }
    };
  } catch (error) {
    return {
      name: 'システムステータス取得',
      passed: false,
      message: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      details: { error }
    };
  }
}

// テスト2: サービスステータスの確認
async function testServiceStatuses(): Promise<TestResult> {
  console.log('\n📊 テスト2: サービスステータス確認');
  
  try {
    const { systemHealthService } = await import('@/lib/system-health-service');
    const health = await systemHealthService.getSystemStatus();

    const requiredServices: Array<keyof SystemHealth['services']> = [
      'lancedb',
      'firestore',
      'gemini',
      'authentication',
    ];

    for (const serviceKey of requiredServices) {
      const service = health.services[serviceKey];
      if (!service) {
        return {
          name: 'サービスステータス確認',
          passed: false,
          message: `${serviceKey}サービスのステータスが取得できませんでした`,
          details: { health }
        };
      }

      if (!['healthy', 'warning', 'critical'].includes(service.status)) {
        return {
          name: 'サービスステータス確認',
          passed: false,
          message: `${serviceKey}サービスのステータスが無効です: ${service.status}`,
          details: { service }
        };
      }

      if (!service.message) {
        return {
          name: 'サービスステータス確認',
          passed: false,
          message: `${serviceKey}サービスのメッセージが設定されていません`,
          details: { service }
        };
      }

      if (!service.lastChecked) {
        return {
          name: 'サービスステータス確認',
          passed: false,
          message: `${serviceKey}サービスの最終確認日時が設定されていません`,
          details: { service }
        };
      }
    }

    return {
      name: 'サービスステータス確認',
      passed: true,
      message: 'すべてのサービスステータスが正常に取得されました',
      details: {
        services: Object.entries(health.services).map(([key, service]) => ({
          name: key,
          status: service.status,
          message: service.message,
        }))
      }
    };
  } catch (error) {
    return {
      name: 'サービスステータス確認',
      passed: false,
      message: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      details: { error }
    };
  }
}

// テスト3: サービス名取得
async function testGetServiceName(): Promise<TestResult> {
  console.log('\n📊 テスト3: サービス名取得');
  
  const { systemHealthService } = await import('@/lib/system-health-service');
  const serviceNames = {
    lancedb: systemHealthService.getServiceName('lancedb'),
    firestore: systemHealthService.getServiceName('firestore'),
    gemini: systemHealthService.getServiceName('gemini'),
    authentication: systemHealthService.getServiceName('authentication'),
    cache: systemHealthService.getServiceName('cache'),
  };

  if (serviceNames.lancedb !== 'LanceDB') {
    return {
      name: 'サービス名取得',
      passed: false,
      message: `LanceDBのサービス名が正しくありません: ${serviceNames.lancedb}`,
      details: { serviceNames }
    };
  }

  if (serviceNames.firestore !== 'Firestore') {
    return {
      name: 'サービス名取得',
      passed: false,
      message: `Firestoreのサービス名が正しくありません: ${serviceNames.firestore}`,
      details: { serviceNames }
    };
  }

  return {
    name: 'サービス名取得',
    passed: true,
    message: 'すべてのサービス名が正しく返されました',
    details: { serviceNames }
  };
}

// テスト4: ステータス色取得
async function testGetStatusColor(): Promise<TestResult> {
  console.log('\n📊 テスト4: ステータス色取得');
  
  const { systemHealthService } = await import('@/lib/system-health-service');
  const colors = {
    healthy: systemHealthService.getStatusColor('healthy'),
    warning: systemHealthService.getStatusColor('warning'),
    critical: systemHealthService.getStatusColor('critical'),
  };

  if (!colors.healthy.includes('green')) {
    return {
      name: 'ステータス色取得',
      passed: false,
      message: `正常ステータスの色が正しくありません: ${colors.healthy}`,
      details: { colors }
    };
  }

  if (!colors.warning.includes('yellow')) {
    return {
      name: 'ステータス色取得',
      passed: false,
      message: `警告ステータスの色が正しくありません: ${colors.warning}`,
      details: { colors }
    };
  }

  if (!colors.critical.includes('red')) {
    return {
      name: 'ステータス色取得',
      passed: false,
      message: `緊急ステータスの色が正しくありません: ${colors.critical}`,
      details: { colors }
    };
  }

  return {
    name: 'ステータス色取得',
    passed: true,
    message: 'すべてのステータス色が正しく返されました',
    details: { colors }
  };
}

// テスト5: ステータス名取得
async function testGetStatusName(): Promise<TestResult> {
  console.log('\n📊 テスト5: ステータス名取得');
  
  const { systemHealthService } = await import('@/lib/system-health-service');
  const names = {
    healthy: systemHealthService.getStatusName('healthy'),
    warning: systemHealthService.getStatusName('warning'),
    critical: systemHealthService.getStatusName('critical'),
  };

  if (names.healthy !== '正常') {
    return {
      name: 'ステータス名取得',
      passed: false,
      message: `正常ステータスの名前が正しくありません: ${names.healthy}`,
      details: { names }
    };
  }

  if (names.warning !== '警告') {
    return {
      name: 'ステータス名取得',
      passed: false,
      message: `警告ステータスの名前が正しくありません: ${names.warning}`,
      details: { names }
    };
  }

  if (names.critical !== '緊急') {
    return {
      name: 'ステータス名取得',
      passed: false,
      message: `緊急ステータスの名前が正しくありません: ${names.critical}`,
      details: { names }
    };
  }

  return {
    name: 'ステータス名取得',
    passed: true,
    message: 'すべてのステータス名が正しく返されました',
    details: { names }
  };
}

// テスト6: ヘルスダッシュボードデータ取得
async function testGetHealthDashboardData(): Promise<TestResult> {
  console.log('\n📊 テスト6: ヘルスダッシュボードデータ取得');
  
  try {
    const { systemHealthService } = await import('@/lib/system-health-service');
    const dashboardData = await systemHealthService.getHealthDashboardData();

    if (!dashboardData) {
      return {
        name: 'ヘルスダッシュボードデータ取得',
        passed: false,
        message: 'ダッシュボードデータが取得できませんでした',
      };
    }

    if (!dashboardData.status) {
      return {
        name: 'ヘルスダッシュボードデータ取得',
        passed: false,
        message: 'ステータスが取得できませんでした',
        details: { dashboardData }
      };
    }

    if (!dashboardData.history) {
      return {
        name: 'ヘルスダッシュボードデータ取得',
        passed: false,
        message: '履歴が取得できませんでした',
        details: { dashboardData }
      };
    }

    if (!Array.isArray(dashboardData.history)) {
      return {
        name: 'ヘルスダッシュボードデータ取得',
        passed: false,
        message: '履歴が配列ではありません',
        details: { dashboardData }
      };
    }

    return {
      name: 'ヘルスダッシュボードデータ取得',
      passed: true,
      message: 'ダッシュボードデータが正常に取得されました',
      details: {
        status: dashboardData.status.status,
        historyCount: dashboardData.history.length,
      }
    };
  } catch (error) {
    return {
      name: 'ヘルスダッシュボードデータ取得',
      passed: false,
      message: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      details: { error }
    };
  }
}

// テスト7: 全体ステータス判定
async function testOverallStatusDetermination(): Promise<TestResult> {
  console.log('\n📊 テスト7: 全体ステータス判定');
  
  try {
    const { systemHealthService } = await import('@/lib/system-health-service');
    const health = await systemHealthService.getSystemStatus();

    // ステータスが適切に判定されているか確認
    const hasCriticalService = Object.values(health.services).some(
      s => s && s.status === 'critical'
    );
    const hasWarningService = Object.values(health.services).some(
      s => s && s.status === 'warning'
    );

    if (hasCriticalService && health.status !== 'critical') {
      return {
        name: '全体ステータス判定',
        passed: false,
        message: 'Criticalサービスがあるのに全体ステータスがcriticalではありません',
        details: { health }
      };
    }

    if (!hasCriticalService && hasWarningService && health.status === 'critical') {
      return {
        name: '全体ステータス判定',
        passed: false,
        message: 'Criticalサービスがないのに全体ステータスがcriticalです',
        details: { health }
      };
    }

    return {
      name: '全体ステータス判定',
      passed: true,
      message: '全体ステータスが適切に判定されました',
      details: {
        overallStatus: health.status,
        serviceStatuses: Object.entries(health.services).map(([key, service]) => ({
          name: key,
          status: service?.status,
        }))
      }
    };
  } catch (error) {
    return {
      name: '全体ステータス判定',
      passed: false,
      message: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      details: { error }
    };
  }
}

// メイン実行関数
async function runTests(): Promise<void> {
  console.log('🚀 システムヘルスサービスのテスト開始\n');
  console.log('='.repeat(60));

  const tests: Array<() => Promise<TestResult>> = [
    testGetSystemStatus,
    testServiceStatuses,
    testGetServiceName,
    testGetStatusColor,
    testGetStatusName,
    testGetHealthDashboardData,
    testOverallStatusDetermination,
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    try {
      const result = await test();
      results.push(result);
      printTestResult(result);
    } catch (error) {
      const errorResult: TestResult = {
        name: test.name,
        passed: false,
        message: `テスト実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        details: { error }
      };
      results.push(errorResult);
      printTestResult(errorResult);
    }
  }

  // サマリー
  console.log('\n' + '='.repeat(60));
  console.log('📊 テスト結果サマリー');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`総テスト数: ${total}`);
  console.log(`✅ 成功: ${passed}`);
  console.log(`❌ 失敗: ${failed}`);
  console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ 失敗したテスト:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ すべてのテストが成功しました！');
    process.exit(0);
  }
}

// テスト実行
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

export { runTests };

