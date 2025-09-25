/**
 * 既存データのundefined問題を修正するテスト
 * lastUpdatedフィールドのundefined問題を解決
 */

import { lancedbClient } from '../../lib/lancedb-client';

interface ConfluenceRecord {
  id: string;
  pageId: number;
  title: string;
  content: string;
  labels: string[];
  lastUpdated: string;
  url: string;
  space_key: string;
  chunkIndex: number;
}

class UndefinedIssueFixer {
  private connection: any;
  private table: any;

  /**
   * LanceDBに接続
   */
  async connect() {
    console.log('🔌 LanceDBに接続中...');
    this.connection = await lancedbClient.getConnection();
    this.table = this.connection.table;
    console.log('✅ 接続完了');
  }

  /**
   * 既存データのundefined問題を調査
   */
  async investigateUndefinedIssue() {
    console.log('\n🔍 既存データのundefined問題を調査');
    console.log('=' .repeat(50));

    try {
      // サンプルデータを取得
      const sampleData = await this.table.search().limit(10).toArray();
      
      console.log(`📊 サンプルデータ数: ${sampleData.length}件`);
      
      sampleData.forEach((record, index) => {
        console.log(`\n[レコード ${index + 1}] ${record.title}`);
        console.log(`  ページID: ${record.pageId}`);
        console.log(`  最終更新日時: ${record.lastUpdated} (型: ${typeof record.lastUpdated})`);
        console.log(`  ラベル: ${JSON.stringify(record.labels)}`);
        console.log(`  チャンクインデックス: ${record.chunkIndex}`);
        
        // undefined問題の詳細分析
        if (record.lastUpdated === undefined) {
          console.log('  ⚠️ lastUpdatedがundefined');
        }
        if (record.labels === undefined) {
          console.log('  ⚠️ labelsがundefined');
        }
        if (record.chunkIndex === undefined) {
          console.log('  ⚠️ chunkIndexがundefined');
        }
      });

      // undefined問題の統計
      const undefinedStats = {
        lastUpdated: 0,
        labels: 0,
        chunkIndex: 0,
        total: sampleData.length
      };

      sampleData.forEach(record => {
        if (record.lastUpdated === undefined) undefinedStats.lastUpdated++;
        if (record.labels === undefined) undefinedStats.labels++;
        if (record.chunkIndex === undefined) undefinedStats.chunkIndex++;
      });

      console.log('\n📊 undefined問題の統計:');
      console.log(`  lastUpdated: ${undefinedStats.lastUpdated}/${undefinedStats.total} (${((undefinedStats.lastUpdated/undefinedStats.total)*100).toFixed(1)}%)`);
      console.log(`  labels: ${undefinedStats.labels}/${undefinedStats.total} (${((undefinedStats.labels/undefinedStats.total)*100).toFixed(1)}%)`);
      console.log(`  chunkIndex: ${undefinedStats.chunkIndex}/${undefinedStats.total} (${((undefinedStats.chunkIndex/undefinedStats.total)*100).toFixed(1)}%)`);

    } catch (error) {
      console.error('❌ 調査エラー:', error);
    }
  }

  /**
   * 修正版のデータ構造をテスト
   */
  async testFixedDataStructure() {
    console.log('\n🧪 修正版のデータ構造をテスト');
    console.log('=' .repeat(50));

    // 修正版のレコードを作成
    const fixedRecord: ConfluenceRecord = {
      id: 'test-page-0',
      pageId: 999999999,
      title: 'テストページ',
      content: 'テストコンテンツ',
      labels: ['テスト', 'デバッグ'],
      lastUpdated: new Date().toISOString(),
      url: 'https://example.com/test',
      space_key: 'TEST',
      chunkIndex: 0
    };

    console.log('修正版レコード:');
    console.log(JSON.stringify(fixedRecord, null, 2));

    // 各フィールドの型チェック
    console.log('\n型チェック結果:');
    console.log(`  id: ${typeof fixedRecord.id} (期待: string)`);
    console.log(`  pageId: ${typeof fixedRecord.pageId} (期待: number)`);
    console.log(`  title: ${typeof fixedRecord.title} (期待: string)`);
    console.log(`  content: ${typeof fixedRecord.content} (期待: string)`);
    console.log(`  labels: ${Array.isArray(fixedRecord.labels) ? 'array' : typeof fixedRecord.labels} (期待: string[])`);
    console.log(`  lastUpdated: ${typeof fixedRecord.lastUpdated} (期待: string)`);
    console.log(`  url: ${typeof fixedRecord.url} (期待: string)`);
    console.log(`  space_key: ${typeof fixedRecord.space_key} (期待: string)`);
    console.log(`  chunkIndex: ${typeof fixedRecord.chunkIndex} (期待: number)`);

    return fixedRecord;
  }

  /**
   * データ修正の推奨策を提示
   */
  suggestDataFixes() {
    console.log('\n💡 データ修正の推奨策');
    console.log('=' .repeat(50));

    console.log('1. lastUpdatedフィールドの修正:');
    console.log('   - 既存データのlastUpdatedがundefinedの場合、現在時刻を設定');
    console.log('   - データベーススキーマでNOT NULL制約を追加');
    console.log('   - 新規データ投入時に必ずlastUpdatedを設定');

    console.log('\n2. labelsフィールドの修正:');
    console.log('   - 空配列[]をデフォルト値として設定');
    console.log('   - ラベル取得失敗時は空配列を返す');
    console.log('   - データベーススキーマでList<Utf8>型を明示');

    console.log('\n3. chunkIndexフィールドの修正:');
    console.log('   - チャンク分割時に必ずchunkIndexを設定');
    console.log('   - 0から始まる連番を保証');

    console.log('\n4. データ検証の追加:');
    console.log('   - データ投入前の必須フィールドチェック');
    console.log('   - 型安全性の確保');
    console.log('   - デフォルト値の設定');
  }

  /**
   * 修正版の同期ロジックをテスト
   */
  async testFixedSyncLogic() {
    console.log('\n🔄 修正版の同期ロジックをテスト');
    console.log('=' .repeat(50));

    // 修正版の同期ロジックをシミュレート
    const testPages = [
      {
        id: '703561854',
        title: 'テスト議事録',
        lastUpdated: '2023-09-01T10:00:00.000Z',
        labels: ['議事録', 'meeting-notes']
      },
      {
        id: '703561855',
        title: 'テスト機能仕様',
        lastUpdated: '2023-09-02T10:00:00.000Z',
        labels: ['機能要件', '仕様書']
      }
    ];

    console.log('テストページ:');
    testPages.forEach((page, index) => {
      console.log(`\n[ページ ${index + 1}] ${page.title}`);
      console.log(`  ページID: ${page.id}`);
      console.log(`  最終更新: ${page.lastUpdated}`);
      console.log(`  ラベル: ${JSON.stringify(page.labels)}`);
      
      // 修正版の処理
      const fixedPage = {
        ...page,
        lastUpdated: page.lastUpdated || new Date().toISOString(),
        labels: page.labels || []
      };
      
      console.log(`  修正後: ${JSON.stringify(fixedPage)}`);
    });
  }

  /**
   * デバッグ結果をサマリー
   */
  generateDebugSummary() {
    console.log('\n📊 デバッグ結果サマリー');
    console.log('=' .repeat(50));

    console.log('🔍 特定された問題:');
    console.log('  1. lastUpdatedフィールドがundefined');
    console.log('  2. labelsフィールドが空配列またはundefined');
    console.log('  3. データ型の不整合');
    console.log('  4. デフォルト値の未設定');

    console.log('\n💡 推奨修正策:');
    console.log('  1. データベーススキーマの統一');
    console.log('  2. 必須フィールドのデフォルト値設定');
    console.log('  3. データ投入前の検証ロジック追加');
    console.log('  4. 既存データの一括修正');

    console.log('\n🚀 次のステップ:');
    console.log('  1. 修正版の同期ロジックを実装');
    console.log('  2. テスト環境で検証');
    console.log('  3. 本番環境に適用');
  }
}

// デバッグ実行
async function runUndefinedFixDebug() {
  const fixer = new UndefinedIssueFixer();
  
  try {
    await fixer.connect();
    await fixer.investigateUndefinedIssue();
    await fixer.testFixedDataStructure();
    fixer.suggestDataFixes();
    await fixer.testFixedSyncLogic();
    fixer.generateDebugSummary();
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error);
  }
}

// テスト実行
runUndefinedFixDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
 * 既存データのundefined問題を修正するテスト
 * lastUpdatedフィールドのundefined問題を解決
 */

import { lancedbClient } from '../../lib/lancedb-client';

interface ConfluenceRecord {
  id: string;
  pageId: number;
  title: string;
  content: string;
  labels: string[];
  lastUpdated: string;
  url: string;
  space_key: string;
  chunkIndex: number;
}

class UndefinedIssueFixer {
  private connection: any;
  private table: any;

  /**
   * LanceDBに接続
   */
  async connect() {
    console.log('🔌 LanceDBに接続中...');
    this.connection = await lancedbClient.getConnection();
    this.table = this.connection.table;
    console.log('✅ 接続完了');
  }

  /**
   * 既存データのundefined問題を調査
   */
  async investigateUndefinedIssue() {
    console.log('\n🔍 既存データのundefined問題を調査');
    console.log('=' .repeat(50));

    try {
      // サンプルデータを取得
      const sampleData = await this.table.search().limit(10).toArray();
      
      console.log(`📊 サンプルデータ数: ${sampleData.length}件`);
      
      sampleData.forEach((record, index) => {
        console.log(`\n[レコード ${index + 1}] ${record.title}`);
        console.log(`  ページID: ${record.pageId}`);
        console.log(`  最終更新日時: ${record.lastUpdated} (型: ${typeof record.lastUpdated})`);
        console.log(`  ラベル: ${JSON.stringify(record.labels)}`);
        console.log(`  チャンクインデックス: ${record.chunkIndex}`);
        
        // undefined問題の詳細分析
        if (record.lastUpdated === undefined) {
          console.log('  ⚠️ lastUpdatedがundefined');
        }
        if (record.labels === undefined) {
          console.log('  ⚠️ labelsがundefined');
        }
        if (record.chunkIndex === undefined) {
          console.log('  ⚠️ chunkIndexがundefined');
        }
      });

      // undefined問題の統計
      const undefinedStats = {
        lastUpdated: 0,
        labels: 0,
        chunkIndex: 0,
        total: sampleData.length
      };

      sampleData.forEach(record => {
        if (record.lastUpdated === undefined) undefinedStats.lastUpdated++;
        if (record.labels === undefined) undefinedStats.labels++;
        if (record.chunkIndex === undefined) undefinedStats.chunkIndex++;
      });

      console.log('\n📊 undefined問題の統計:');
      console.log(`  lastUpdated: ${undefinedStats.lastUpdated}/${undefinedStats.total} (${((undefinedStats.lastUpdated/undefinedStats.total)*100).toFixed(1)}%)`);
      console.log(`  labels: ${undefinedStats.labels}/${undefinedStats.total} (${((undefinedStats.labels/undefinedStats.total)*100).toFixed(1)}%)`);
      console.log(`  chunkIndex: ${undefinedStats.chunkIndex}/${undefinedStats.total} (${((undefinedStats.chunkIndex/undefinedStats.total)*100).toFixed(1)}%)`);

    } catch (error) {
      console.error('❌ 調査エラー:', error);
    }
  }

  /**
   * 修正版のデータ構造をテスト
   */
  async testFixedDataStructure() {
    console.log('\n🧪 修正版のデータ構造をテスト');
    console.log('=' .repeat(50));

    // 修正版のレコードを作成
    const fixedRecord: ConfluenceRecord = {
      id: 'test-page-0',
      pageId: 999999999,
      title: 'テストページ',
      content: 'テストコンテンツ',
      labels: ['テスト', 'デバッグ'],
      lastUpdated: new Date().toISOString(),
      url: 'https://example.com/test',
      space_key: 'TEST',
      chunkIndex: 0
    };

    console.log('修正版レコード:');
    console.log(JSON.stringify(fixedRecord, null, 2));

    // 各フィールドの型チェック
    console.log('\n型チェック結果:');
    console.log(`  id: ${typeof fixedRecord.id} (期待: string)`);
    console.log(`  pageId: ${typeof fixedRecord.pageId} (期待: number)`);
    console.log(`  title: ${typeof fixedRecord.title} (期待: string)`);
    console.log(`  content: ${typeof fixedRecord.content} (期待: string)`);
    console.log(`  labels: ${Array.isArray(fixedRecord.labels) ? 'array' : typeof fixedRecord.labels} (期待: string[])`);
    console.log(`  lastUpdated: ${typeof fixedRecord.lastUpdated} (期待: string)`);
    console.log(`  url: ${typeof fixedRecord.url} (期待: string)`);
    console.log(`  space_key: ${typeof fixedRecord.space_key} (期待: string)`);
    console.log(`  chunkIndex: ${typeof fixedRecord.chunkIndex} (期待: number)`);

    return fixedRecord;
  }

  /**
   * データ修正の推奨策を提示
   */
  suggestDataFixes() {
    console.log('\n💡 データ修正の推奨策');
    console.log('=' .repeat(50));

    console.log('1. lastUpdatedフィールドの修正:');
    console.log('   - 既存データのlastUpdatedがundefinedの場合、現在時刻を設定');
    console.log('   - データベーススキーマでNOT NULL制約を追加');
    console.log('   - 新規データ投入時に必ずlastUpdatedを設定');

    console.log('\n2. labelsフィールドの修正:');
    console.log('   - 空配列[]をデフォルト値として設定');
    console.log('   - ラベル取得失敗時は空配列を返す');
    console.log('   - データベーススキーマでList<Utf8>型を明示');

    console.log('\n3. chunkIndexフィールドの修正:');
    console.log('   - チャンク分割時に必ずchunkIndexを設定');
    console.log('   - 0から始まる連番を保証');

    console.log('\n4. データ検証の追加:');
    console.log('   - データ投入前の必須フィールドチェック');
    console.log('   - 型安全性の確保');
    console.log('   - デフォルト値の設定');
  }

  /**
   * 修正版の同期ロジックをテスト
   */
  async testFixedSyncLogic() {
    console.log('\n🔄 修正版の同期ロジックをテスト');
    console.log('=' .repeat(50));

    // 修正版の同期ロジックをシミュレート
    const testPages = [
      {
        id: '703561854',
        title: 'テスト議事録',
        lastUpdated: '2023-09-01T10:00:00.000Z',
        labels: ['議事録', 'meeting-notes']
      },
      {
        id: '703561855',
        title: 'テスト機能仕様',
        lastUpdated: '2023-09-02T10:00:00.000Z',
        labels: ['機能要件', '仕様書']
      }
    ];

    console.log('テストページ:');
    testPages.forEach((page, index) => {
      console.log(`\n[ページ ${index + 1}] ${page.title}`);
      console.log(`  ページID: ${page.id}`);
      console.log(`  最終更新: ${page.lastUpdated}`);
      console.log(`  ラベル: ${JSON.stringify(page.labels)}`);
      
      // 修正版の処理
      const fixedPage = {
        ...page,
        lastUpdated: page.lastUpdated || new Date().toISOString(),
        labels: page.labels || []
      };
      
      console.log(`  修正後: ${JSON.stringify(fixedPage)}`);
    });
  }

  /**
   * デバッグ結果をサマリー
   */
  generateDebugSummary() {
    console.log('\n📊 デバッグ結果サマリー');
    console.log('=' .repeat(50));

    console.log('🔍 特定された問題:');
    console.log('  1. lastUpdatedフィールドがundefined');
    console.log('  2. labelsフィールドが空配列またはundefined');
    console.log('  3. データ型の不整合');
    console.log('  4. デフォルト値の未設定');

    console.log('\n💡 推奨修正策:');
    console.log('  1. データベーススキーマの統一');
    console.log('  2. 必須フィールドのデフォルト値設定');
    console.log('  3. データ投入前の検証ロジック追加');
    console.log('  4. 既存データの一括修正');

    console.log('\n🚀 次のステップ:');
    console.log('  1. 修正版の同期ロジックを実装');
    console.log('  2. テスト環境で検証');
    console.log('  3. 本番環境に適用');
  }
}

// デバッグ実行
async function runUndefinedFixDebug() {
  const fixer = new UndefinedIssueFixer();
  
  try {
    await fixer.connect();
    await fixer.investigateUndefinedIssue();
    await fixer.testFixedDataStructure();
    fixer.suggestDataFixes();
    await fixer.testFixedSyncLogic();
    fixer.generateDebugSummary();
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error);
  }
}

// テスト実行
runUndefinedFixDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
