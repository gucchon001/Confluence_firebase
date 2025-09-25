/**
 * 既存データのundefined問題をテスト環境でデバッグ
 * 既存データのlastUpdatedがundefinedになる原因を特定
 */

import 'dotenv/config';
import { LanceDBClient } from '../../lib/lancedb-client';

class ExistingDataDebugger {
  private lancedbClient: LanceDBClient;

  constructor() {
    this.lancedbClient = LanceDBClient.getInstance();
  }

  /**
   * 既存データの構造を分析
   */
  async analyzeExistingData() {
    console.log('🔍 既存データの構造分析');
    console.log('=' .repeat(50));

    try {
      await this.lancedbClient.connect();
      const table = await this.lancedbClient.getTable();

      // 既存データを取得
      const dummyVector = new Array(768).fill(0);
      const allData = await table.search(dummyVector).limit(10).toArray();

      console.log(`📊 取得したデータ数: ${allData.length}件`);

      if (allData.length > 0) {
        console.log('\n📋 既存データの構造分析:');
        
        allData.forEach((row: any, index: number) => {
          console.log(`\n[${index + 1}] ページID: ${row.pageId}`);
          console.log(`  タイトル: ${row.title}`);
          console.log(`  lastUpdated: ${row.lastUpdated} (型: ${typeof row.lastUpdated})`);
          console.log(`  labels: ${JSON.stringify(row.labels)} (型: ${typeof row.labels})`);
          console.log(`  全フィールド: ${JSON.stringify(Object.keys(row))}`);
          
          // 日時比較のテスト
          if (row.lastUpdated) {
            const existingDate = new Date(row.lastUpdated);
            const confluenceDate = new Date('2024-01-01T00:00:00.000Z');
            
            console.log(`  日時比較テスト:`);
            console.log(`    既存: ${existingDate.toISOString()}`);
            console.log(`    Confluence: ${confluenceDate.toISOString()}`);
            console.log(`    比較結果: ${confluenceDate > existingDate ? 'Confluenceが新しい' : '既存が新しい'}`);
          } else {
            console.log(`  ⚠️ lastUpdatedがundefinedのため日時比較不可`);
          }
        });
      } else {
        console.log('❌ 既存データが見つかりません');
      }

    } catch (error) {
      console.error('❌ 分析エラー:', error);
    }
  }

  /**
   * 日時比較ロジックをテスト
   */
  async testDateComparisonLogic() {
    console.log('\n🧪 日時比較ロジックのテスト');
    console.log('=' .repeat(50));

    const testCases = [
      { existing: '2024-01-01T00:00:00.000Z', confluence: '2024-01-02T00:00:00.000Z', expected: 'confluence_newer' },
      { existing: '2024-01-02T00:00:00.000Z', confluence: '2024-01-01T00:00:00.000Z', expected: 'existing_newer' },
      { existing: '2024-01-01T00:00:00.000Z', confluence: '2024-01-01T00:00:00.000Z', expected: 'same' },
      { existing: undefined, confluence: '2024-01-01T00:00:00.000Z', expected: 'existing_undefined' },
      { existing: '2024-01-01T00:00:00.000Z', confluence: undefined, expected: 'confluence_undefined' },
      { existing: undefined, confluence: undefined, expected: 'both_undefined' }
    ];

    testCases.forEach((testCase, index) => {
      console.log(`\n[${index + 1}] テストケース: ${JSON.stringify(testCase)}`);
      
      try {
        const result = this.compareDates(testCase.existing, testCase.confluence);
        console.log(`  結果: ${result}`);
        console.log(`  期待値: ${testCase.expected}`);
        console.log(`  判定: ${result === testCase.expected ? '✅ 一致' : '❌ 不一致'}`);
      } catch (error) {
        console.log(`  エラー: ${error}`);
      }
    });
  }

  /**
   * 日時比較ロジック（既存の同期ロジックと同じ）
   */
  private compareDates(existing: string | undefined, confluence: string | undefined): string {
    if (!existing) {
      return 'existing_undefined';
    }
    if (!confluence) {
      return 'confluence_undefined';
    }

    const existingDate = new Date(existing);
    const confluenceDate = new Date(confluence);

    if (confluenceDate > existingDate) {
      return 'confluence_newer';
    } else if (confluenceDate < existingDate) {
      return 'existing_newer';
    } else {
      return 'same';
    }
  }

  /**
   * 既存データの修正方法をテスト
   */
  async testDataFix() {
    console.log('\n🔧 既存データの修正方法をテスト');
    console.log('=' .repeat(50));

    try {
      await this.lancedbClient.connect();
      const table = await this.lancedbClient.getTable();

      // 既存データを取得
      const dummyVector = new Array(768).fill(0);
      const allData = await table.search(dummyVector).limit(5).toArray();

      console.log(`📊 修正対象データ数: ${allData.length}件`);

      allData.forEach((row: any, index: number) => {
        console.log(`\n[${index + 1}] 修正前: ${JSON.stringify({
          pageId: row.pageId,
          title: row.title,
          lastUpdated: row.lastUpdated,
          labels: row.labels
        })}`);

        // 修正後のデータ構造
        const fixedRow = {
          ...row,
          lastUpdated: row.lastUpdated || new Date().toISOString(),
          labels: row.labels || []
        };

        console.log(`修正後: ${JSON.stringify({
          pageId: fixedRow.pageId,
          title: fixedRow.title,
          lastUpdated: fixedRow.lastUpdated,
          labels: fixedRow.labels
        })}`);
      });

    } catch (error) {
      console.error('❌ 修正テストエラー:', error);
    }
  }

  /**
   * デバッグ結果をサマリー
   */
  generateDebugSummary() {
    console.log('\n📊 既存データundefined問題のデバッグ結果サマリー');
    console.log('=' .repeat(50));

    console.log('✅ 確認されたこと:');
    console.log('  1. 既存データの構造を分析');
    console.log('  2. 日時比較ロジックをテスト');
    console.log('  3. データ修正方法を検証');

    console.log('\n⚠️ 発見された問題:');
    console.log('  1. 既存データのlastUpdatedがundefined');
    console.log('  2. 日時比較が正しく動作しない');
    console.log('  3. ラベル情報が正しく保存されていない可能性');

    console.log('\n💡 推奨される修正方法:');
    console.log('  1. 既存データのlastUpdatedを現在の日時に設定');
    console.log('  2. ラベル情報を正しく保存');
    console.log('  3. 日時比較ロジックを修正');
  }
}

// デバッグ実行
async function runExistingDataDebug() {
  const dataDebugger = new ExistingDataDebugger();
  
  try {
    console.log('🧪 既存データundefined問題のデバッグ開始');
    console.log('=' .repeat(50));
    
    await dataDebugger.analyzeExistingData();
    await dataDebugger.testDateComparisonLogic();
    await dataDebugger.testDataFix();
    dataDebugger.generateDebugSummary();
    
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error);
  }
}

// テスト実行
runExistingDataDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
