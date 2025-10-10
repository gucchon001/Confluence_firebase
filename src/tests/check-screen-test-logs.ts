/**
 * 画面テストログ確認スクリプト
 * 画面テストで生成されたログファイルを確認し、テストスクリプトの結果と比較
 */

import * as fs from 'fs';
import * as path from 'path';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: 'search' | 'ai' | 'performance' | 'general';
  message: string;
  data?: any;
}

interface PerformanceSummary {
  totalLogs: number;
  categories: { [key: string]: number };
  performance: {
    searchTimes: number[];
    aiTimes: number[];
    totalTimes: number[];
  };
  errors: string[];
  searchStats: {
    count: number;
    average: number;
    min: number;
    max: number;
  };
  aiStats: {
    count: number;
    average: number;
    min: number;
    max: number;
  };
}

function findLatestScreenTestLog(): string | null {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    return null;
  }

  const files = fs.readdirSync(logsDir)
    .filter(file => file.startsWith('screen-test-') && file.endsWith('.json'))
    .sort()
    .reverse();

  return files.length > 0 ? path.join(logsDir, files[0]) : null;
}

function parseLogFile(filePath: string): LogEntry[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  
  return lines
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line) as LogEntry;
      } catch (error) {
        console.warn(`Failed to parse log line: ${line}`);
        return null;
      }
    })
    .filter((entry): entry is LogEntry => entry !== null);
}

function generateSummary(logs: LogEntry[]): PerformanceSummary {
  const summary: PerformanceSummary = {
    totalLogs: logs.length,
    categories: {},
    performance: {
      searchTimes: [],
      aiTimes: [],
      totalTimes: []
    },
    errors: [],
    searchStats: { count: 0, average: 0, min: 0, max: 0 },
    aiStats: { count: 0, average: 0, min: 0, max: 0 }
  };

  logs.forEach(log => {
    // カテゴリ別集計
    if (!summary.categories[log.category]) {
      summary.categories[log.category] = 0;
    }
    summary.categories[log.category]++;

    // エラー集計
    if (log.level === 'error') {
      summary.errors.push(log.message);
    }

    // パフォーマンスデータ抽出
    if (log.data) {
      if (log.data.searchTime) {
        const time = parseFloat(log.data.searchTime.replace('ms', ''));
        if (!isNaN(time)) summary.performance.searchTimes.push(time);
      }
      if (log.data.aiTime) {
        const time = parseFloat(log.data.aiTime.replace('ms', ''));
        if (!isNaN(time)) summary.performance.aiTimes.push(time);
      }
      if (log.data.totalTime) {
        const time = parseFloat(log.data.totalTime.replace('ms', ''));
        if (!isNaN(time)) summary.performance.totalTimes.push(time);
      }
    }
  });

  // 統計計算
  const calculateStats = (times: number[]) => ({
    count: times.length,
    average: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
    min: times.length > 0 ? Math.min(...times) : 0,
    max: times.length > 0 ? Math.max(...times) : 0
  });

  summary.searchStats = calculateStats(summary.performance.searchTimes);
  summary.aiStats = calculateStats(summary.performance.aiTimes);

  return summary;
}

function compareWithTestScript(screenTestSummary: PerformanceSummary): void {
  console.log('\n📊 **画面テスト vs テストスクリプト比較**\n');

  // テストスクリプトの結果（前回実行結果から）
  const testScriptResults = {
    searchTime: 62.50, // ms
    aiTime: 20563.55, // ms
    totalTime: 20648.59, // ms
    searchPrecision: 15.0, // %
    aiPrecision: 90.0 // %
  };

  console.log('### **1. パフォーマンス比較**');
  console.log('| 項目 | 画面テスト | テストスクリプト | 差異 |');
  console.log('|------|------------|------------------|------|');

  if (screenTestSummary.searchStats.count > 0) {
    const searchDiff = screenTestSummary.searchStats.average - testScriptResults.searchTime;
    console.log(`| 検索時間 | ${screenTestSummary.searchStats.average.toFixed(2)}ms | ${testScriptResults.searchTime}ms | ${searchDiff > 0 ? '+' : ''}${searchDiff.toFixed(2)}ms |`);
  }

  if (screenTestSummary.aiStats.count > 0) {
    const aiDiff = screenTestSummary.aiStats.average - testScriptResults.aiTime;
    console.log(`| AI生成時間 | ${screenTestSummary.aiStats.average.toFixed(2)}ms | ${testScriptResults.aiTime}ms | ${aiDiff > 0 ? '+' : ''}${aiDiff.toFixed(2)}ms |`);
  }

  console.log('\n### **2. ログ統計**');
  console.log(`- **総ログ数**: ${screenTestSummary.totalLogs}`);
  console.log(`- **検索ログ**: ${screenTestSummary.categories.search || 0}件`);
  console.log(`- **AIログ**: ${screenTestSummary.categories.ai || 0}件`);
  console.log(`- **エラー数**: ${screenTestSummary.errors.length}`);

  if (screenTestSummary.errors.length > 0) {
    console.log('\n### **3. エラー詳細**');
    screenTestSummary.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  console.log('\n### **4. 改善効果確認**');
  if (screenTestSummary.searchStats.count > 0) {
    const searchImprovement = testScriptResults.searchTime - screenTestSummary.searchStats.average;
    if (searchImprovement > 0) {
      console.log(`✅ 検索時間が${searchImprovement.toFixed(2)}ms改善されました`);
    } else {
      console.log(`⚠️ 検索時間が${Math.abs(searchImprovement).toFixed(2)}ms増加しました`);
    }
  }

  if (screenTestSummary.aiStats.count > 0) {
    const aiImprovement = testScriptResults.aiTime - screenTestSummary.aiStats.average;
    if (aiImprovement > 0) {
      console.log(`✅ AI生成時間が${aiImprovement.toFixed(2)}ms改善されました`);
    } else {
      console.log(`⚠️ AI生成時間が${Math.abs(aiImprovement).toFixed(2)}ms増加しました`);
    }
  }
}

async function main(): Promise<void> {
  console.log('🔍 画面テストログ確認スクリプト\n');

  const logFile = findLatestScreenTestLog();
  if (!logFile) {
    console.log('❌ 画面テストログファイルが見つかりません');
    console.log('画面テストを実行してから再度確認してください');
    return;
  }

  console.log(`📁 ログファイル: ${path.basename(logFile)}`);
  console.log(`📅 ファイルパス: ${logFile}\n`);

  try {
    const logs = parseLogFile(logFile);
    const summary = generateSummary(logs);

    console.log('### **画面テストログサマリー**');
    console.log(`- **総ログ数**: ${summary.totalLogs}`);
    console.log(`- **カテゴリ別**:`, summary.categories);
    console.log(`- **検索実行回数**: ${summary.searchStats.count}`);
    console.log(`- **AI生成回数**: ${summary.aiStats.count}`);

    if (summary.searchStats.count > 0) {
      console.log(`\n### **検索パフォーマンス**`);
      console.log(`- **平均時間**: ${summary.searchStats.average.toFixed(2)}ms`);
      console.log(`- **最短時間**: ${summary.searchStats.min.toFixed(2)}ms`);
      console.log(`- **最長時間**: ${summary.searchStats.max.toFixed(2)}ms`);
    }

    if (summary.aiStats.count > 0) {
      console.log(`\n### **AI生成パフォーマンス**`);
      console.log(`- **平均時間**: ${summary.aiStats.average.toFixed(2)}ms`);
      console.log(`- **最短時間**: ${summary.aiStats.min.toFixed(2)}ms`);
      console.log(`- **最長時間**: ${summary.aiStats.max.toFixed(2)}ms`);
    }

    compareWithTestScript(summary);

  } catch (error) {
    console.error('❌ ログファイルの解析に失敗しました:', error);
  }
}

// スクリプト実行
if (require.main === module) {
  main().catch(console.error);
}

export { main as checkScreenTestLogs };
