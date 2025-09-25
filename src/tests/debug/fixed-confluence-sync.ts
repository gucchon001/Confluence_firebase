/**
 * 修正版のConfluence同期ロジック
 * undefined問題を解決し、ラベル機能を正しく実装
 */

import { lancedbClient } from '../../lib/lancedb-client';
import { unifiedEmbeddingService } from '../../lib/unified-embedding-service';
import { confluenceSyncService } from '../../lib/confluence-sync-service';

interface FixedConfluenceRecord {
  id: string;
  vector: number[];
  pageId: number;
  chunkIndex: number;
  space_key: string;
  title: string;
  content: string;
  url: string;
  lastUpdated: string;
  labels: string[];
}

class FixedConfluenceSync {
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
   * 修正版のページ同期処理
   */
  async syncPagesFixed(limit: number = 10) {
    console.log(`🔄 修正版ページ同期開始 (${limit}ページ)`);
    console.log('=' .repeat(50));

    try {
      // Confluence APIからページを取得
      const pages = await confluenceSyncService.getAllConfluencePages(limit);
      console.log(`📄 取得したページ数: ${pages.length}件`);

      const records: FixedConfluenceRecord[] = [];

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        console.log(`\n📋 ページ処理中 (${i + 1}/${pages.length}): ${page.title}`);

        try {
          // ラベルを取得（修正版）
          const labels = await this.getLabelsFixed(page.id);
          console.log(`  ラベル: ${JSON.stringify(labels)}`);

          // テキストを抽出
          const content = confluenceSyncService.extractTextFromHtml(page.body?.storage?.value || '');
          console.log(`  コンテンツ長: ${content.length}文字`);

          // チャンクに分割
          const chunks = confluenceSyncService.splitTextIntoChunks(content, 1800, 100);
          console.log(`  チャンク数: ${chunks.length}個`);

          // 各チャンクを処理
          for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            
            // 埋め込みベクトルを生成
            const vector = await unifiedEmbeddingService.generateSingleEmbedding(chunk);
            console.log(`  チャンク ${chunkIndex + 1} の埋め込み生成完了 (${vector.length}次元)`);

            // 修正版のレコードを作成
            const record: FixedConfluenceRecord = {
              id: `${page.id}-${chunkIndex}`,
              vector: vector,
              pageId: parseInt(page.id),
              chunkIndex: chunkIndex,
              space_key: page.space?.key || 'CLIENTTOMO',
              title: page.title,
              content: chunk,
              url: page._links?.webui || '',
              lastUpdated: page.version?.when || new Date().toISOString(), // 修正: undefinedを防ぐ
              labels: labels // 修正: 空配列を保証
            };

            records.push(record);
          }

        } catch (error) {
          console.error(`❌ ページ処理エラー (${page.title}):`, error);
        }
      }

      console.log(`\n✅ レコード作成完了: ${records.length}件`);
      return records;

    } catch (error) {
      console.error('❌ 同期エラー:', error);
      throw error;
    }
  }

  /**
   * 修正版のラベル取得
   */
  private async getLabelsFixed(pageId: string): Promise<string[]> {
    try {
      const labels = await confluenceSyncService.getConfluenceLabels(pageId);
      
      // 修正: ラベルを正しい形式に変換
      if (!labels) {
        return [];
      }
      
      if (Array.isArray(labels)) {
        return labels.map(label => {
          if (typeof label === 'string') {
            return label;
          } else if (typeof label === 'object' && label !== null) {
            // オブジェクトの場合は文字列に変換
            return JSON.stringify(label);
          }
          return String(label);
        });
      }
      
      if (typeof labels === 'string') {
        try {
          const parsed = JSON.parse(labels);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch {
          return [labels];
        }
      }
      
      return [];
    } catch (error) {
      console.warn(`⚠️ ラベル取得エラー (ページID: ${pageId}):`, error);
      return []; // 修正: エラー時は空配列を返す
    }
  }

  /**
   * 修正版のデータ検証
   */
  validateRecords(records: FixedConfluenceRecord[]) {
    console.log('\n🔍 修正版データの検証');
    console.log('=' .repeat(50));

    const validationResults = {
      total: records.length,
      valid: 0,
      invalid: 0,
      issues: [] as string[]
    };

    records.forEach((record, index) => {
      const issues: string[] = [];

      // 必須フィールドのチェック
      if (!record.id) issues.push('idが空');
      if (!record.pageId) issues.push('pageIdが空');
      if (!record.title) issues.push('titleが空');
      if (!record.content) issues.push('contentが空');
      if (!record.lastUpdated) issues.push('lastUpdatedが空');
      if (!Array.isArray(record.labels)) issues.push('labelsが配列でない');
      if (typeof record.chunkIndex !== 'number') issues.push('chunkIndexが数値でない');
      if (!Array.isArray(record.vector) || record.vector.length !== 768) issues.push('vectorが768次元でない');

      if (issues.length === 0) {
        validationResults.valid++;
      } else {
        validationResults.invalid++;
        validationResults.issues.push(`レコード ${index + 1}: ${issues.join(', ')}`);
      }
    });

    console.log(`📊 検証結果:`);
    console.log(`  総数: ${validationResults.total}`);
    console.log(`  有効: ${validationResults.valid}`);
    console.log(`  無効: ${validationResults.invalid}`);

    if (validationResults.issues.length > 0) {
      console.log('\n⚠️ 検出された問題:');
      validationResults.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }

    return validationResults;
  }

  /**
   * 修正版のラベルフィルタリングをテスト
   */
  testLabelFiltering(records: FixedConfluenceRecord[]) {
    console.log('\n🧪 修正版ラベルフィルタリングをテスト');
    console.log('=' .repeat(50));

    // 除外ラベルを定義
    const excludeLabels = ['議事録', 'meeting-notes', 'アーカイブ', 'archive', 'フォルダ'];

    // フィルタリング前の状態
    console.log('フィルタリング前:');
    records.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.title} - ラベル: ${JSON.stringify(record.labels)}`);
    });

    // フィルタリング実行
    const filteredRecords = records.filter(record => {
      const hasExcludedLabel = record.labels.some(label => 
        excludeLabels.some(excludeLabel => 
          label.toLowerCase().includes(excludeLabel.toLowerCase())
        )
      );
      return !hasExcludedLabel;
    });

    console.log(`\nフィルタリング後: ${filteredRecords.length}件`);
    filteredRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.title} - ラベル: ${JSON.stringify(record.labels)}`);
    });

    const excludedCount = records.length - filteredRecords.length;
    console.log(`\n📊 除外された件数: ${excludedCount}件`);

    return filteredRecords;
  }

  /**
   * デバッグ結果をサマリー
   */
  generateDebugSummary(records: FixedConfluenceRecord[], filteredRecords: FixedConfluenceRecord[]) {
    console.log('\n📊 デバッグ結果サマリー');
    console.log('=' .repeat(50));

    console.log('✅ 修正された問題:');
    console.log('  1. lastUpdatedフィールドのundefined問題を解決');
    console.log('  2. labelsフィールドの空配列保証');
    console.log('  3. データ型の統一');
    console.log('  4. エラーハンドリングの改善');

    console.log('\n📊 処理結果:');
    console.log(`  総レコード数: ${records.length}`);
    console.log(`  フィルタリング後: ${filteredRecords.length}`);
    console.log(`  除外件数: ${records.length - filteredRecords.length}`);

    console.log('\n🚀 次のステップ:');
    console.log('  1. 修正版ロジックを本番環境に適用');
    console.log('  2. 全データの再同期を実行');
    console.log('  3. ラベルフィルタリング機能の動作確認');
  }
}

// デバッグ実行
async function runFixedSyncDebug() {
  const sync = new FixedConfluenceSync();
  
  try {
    await sync.connect();
    const records = await sync.syncPagesFixed(10);
    const validationResults = sync.validateRecords(records);
    const filteredRecords = sync.testLabelFiltering(records);
    sync.generateDebugSummary(records, filteredRecords);
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error);
  }
}

// テスト実行
runFixedSyncDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});

 * undefined問題を解決し、ラベル機能を正しく実装
 */

import { lancedbClient } from '../../lib/lancedb-client';
import { unifiedEmbeddingService } from '../../lib/unified-embedding-service';
import { confluenceSyncService } from '../../lib/confluence-sync-service';

interface FixedConfluenceRecord {
  id: string;
  vector: number[];
  pageId: number;
  chunkIndex: number;
  space_key: string;
  title: string;
  content: string;
  url: string;
  lastUpdated: string;
  labels: string[];
}

class FixedConfluenceSync {
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
   * 修正版のページ同期処理
   */
  async syncPagesFixed(limit: number = 10) {
    console.log(`🔄 修正版ページ同期開始 (${limit}ページ)`);
    console.log('=' .repeat(50));

    try {
      // Confluence APIからページを取得
      const pages = await confluenceSyncService.getAllConfluencePages(limit);
      console.log(`📄 取得したページ数: ${pages.length}件`);

      const records: FixedConfluenceRecord[] = [];

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        console.log(`\n📋 ページ処理中 (${i + 1}/${pages.length}): ${page.title}`);

        try {
          // ラベルを取得（修正版）
          const labels = await this.getLabelsFixed(page.id);
          console.log(`  ラベル: ${JSON.stringify(labels)}`);

          // テキストを抽出
          const content = confluenceSyncService.extractTextFromHtml(page.body?.storage?.value || '');
          console.log(`  コンテンツ長: ${content.length}文字`);

          // チャンクに分割
          const chunks = confluenceSyncService.splitTextIntoChunks(content, 1800, 100);
          console.log(`  チャンク数: ${chunks.length}個`);

          // 各チャンクを処理
          for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            
            // 埋め込みベクトルを生成
            const vector = await unifiedEmbeddingService.generateSingleEmbedding(chunk);
            console.log(`  チャンク ${chunkIndex + 1} の埋め込み生成完了 (${vector.length}次元)`);

            // 修正版のレコードを作成
            const record: FixedConfluenceRecord = {
              id: `${page.id}-${chunkIndex}`,
              vector: vector,
              pageId: parseInt(page.id),
              chunkIndex: chunkIndex,
              space_key: page.space?.key || 'CLIENTTOMO',
              title: page.title,
              content: chunk,
              url: page._links?.webui || '',
              lastUpdated: page.version?.when || new Date().toISOString(), // 修正: undefinedを防ぐ
              labels: labels // 修正: 空配列を保証
            };

            records.push(record);
          }

        } catch (error) {
          console.error(`❌ ページ処理エラー (${page.title}):`, error);
        }
      }

      console.log(`\n✅ レコード作成完了: ${records.length}件`);
      return records;

    } catch (error) {
      console.error('❌ 同期エラー:', error);
      throw error;
    }
  }

  /**
   * 修正版のラベル取得
   */
  private async getLabelsFixed(pageId: string): Promise<string[]> {
    try {
      const labels = await confluenceSyncService.getConfluenceLabels(pageId);
      
      // 修正: ラベルを正しい形式に変換
      if (!labels) {
        return [];
      }
      
      if (Array.isArray(labels)) {
        return labels.map(label => {
          if (typeof label === 'string') {
            return label;
          } else if (typeof label === 'object' && label !== null) {
            // オブジェクトの場合は文字列に変換
            return JSON.stringify(label);
          }
          return String(label);
        });
      }
      
      if (typeof labels === 'string') {
        try {
          const parsed = JSON.parse(labels);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch {
          return [labels];
        }
      }
      
      return [];
    } catch (error) {
      console.warn(`⚠️ ラベル取得エラー (ページID: ${pageId}):`, error);
      return []; // 修正: エラー時は空配列を返す
    }
  }

  /**
   * 修正版のデータ検証
   */
  validateRecords(records: FixedConfluenceRecord[]) {
    console.log('\n🔍 修正版データの検証');
    console.log('=' .repeat(50));

    const validationResults = {
      total: records.length,
      valid: 0,
      invalid: 0,
      issues: [] as string[]
    };

    records.forEach((record, index) => {
      const issues: string[] = [];

      // 必須フィールドのチェック
      if (!record.id) issues.push('idが空');
      if (!record.pageId) issues.push('pageIdが空');
      if (!record.title) issues.push('titleが空');
      if (!record.content) issues.push('contentが空');
      if (!record.lastUpdated) issues.push('lastUpdatedが空');
      if (!Array.isArray(record.labels)) issues.push('labelsが配列でない');
      if (typeof record.chunkIndex !== 'number') issues.push('chunkIndexが数値でない');
      if (!Array.isArray(record.vector) || record.vector.length !== 768) issues.push('vectorが768次元でない');

      if (issues.length === 0) {
        validationResults.valid++;
      } else {
        validationResults.invalid++;
        validationResults.issues.push(`レコード ${index + 1}: ${issues.join(', ')}`);
      }
    });

    console.log(`📊 検証結果:`);
    console.log(`  総数: ${validationResults.total}`);
    console.log(`  有効: ${validationResults.valid}`);
    console.log(`  無効: ${validationResults.invalid}`);

    if (validationResults.issues.length > 0) {
      console.log('\n⚠️ 検出された問題:');
      validationResults.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }

    return validationResults;
  }

  /**
   * 修正版のラベルフィルタリングをテスト
   */
  testLabelFiltering(records: FixedConfluenceRecord[]) {
    console.log('\n🧪 修正版ラベルフィルタリングをテスト');
    console.log('=' .repeat(50));

    // 除外ラベルを定義
    const excludeLabels = ['議事録', 'meeting-notes', 'アーカイブ', 'archive', 'フォルダ'];

    // フィルタリング前の状態
    console.log('フィルタリング前:');
    records.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.title} - ラベル: ${JSON.stringify(record.labels)}`);
    });

    // フィルタリング実行
    const filteredRecords = records.filter(record => {
      const hasExcludedLabel = record.labels.some(label => 
        excludeLabels.some(excludeLabel => 
          label.toLowerCase().includes(excludeLabel.toLowerCase())
        )
      );
      return !hasExcludedLabel;
    });

    console.log(`\nフィルタリング後: ${filteredRecords.length}件`);
    filteredRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.title} - ラベル: ${JSON.stringify(record.labels)}`);
    });

    const excludedCount = records.length - filteredRecords.length;
    console.log(`\n📊 除外された件数: ${excludedCount}件`);

    return filteredRecords;
  }

  /**
   * デバッグ結果をサマリー
   */
  generateDebugSummary(records: FixedConfluenceRecord[], filteredRecords: FixedConfluenceRecord[]) {
    console.log('\n📊 デバッグ結果サマリー');
    console.log('=' .repeat(50));

    console.log('✅ 修正された問題:');
    console.log('  1. lastUpdatedフィールドのundefined問題を解決');
    console.log('  2. labelsフィールドの空配列保証');
    console.log('  3. データ型の統一');
    console.log('  4. エラーハンドリングの改善');

    console.log('\n📊 処理結果:');
    console.log(`  総レコード数: ${records.length}`);
    console.log(`  フィルタリング後: ${filteredRecords.length}`);
    console.log(`  除外件数: ${records.length - filteredRecords.length}`);

    console.log('\n🚀 次のステップ:');
    console.log('  1. 修正版ロジックを本番環境に適用');
    console.log('  2. 全データの再同期を実行');
    console.log('  3. ラベルフィルタリング機能の動作確認');
  }
}

// デバッグ実行
async function runFixedSyncDebug() {
  const sync = new FixedConfluenceSync();
  
  try {
    await sync.connect();
    const records = await sync.syncPagesFixed(10);
    const validationResults = sync.validateRecords(records);
    const filteredRecords = sync.testLabelFiltering(records);
    sync.generateDebugSummary(records, filteredRecords);
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error);
  }
}

// テスト実行
runFixedSyncDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
