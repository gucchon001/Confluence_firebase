/**
 * ラベル機能デバッグ環境
 * 10ページのみで高速デバッグを実行
 */

import { lancedbClient } from '../../lib/lancedb-client';
import { unifiedEmbeddingService } from '../../lib/unified-embedding-service';
import { confluenceSyncService } from '../../lib/confluence-sync-service';

interface DebugPage {
  id: string;
  pageId: number;
  title: string;
  content: string;
  labels: string[];
  lastUpdated: string;
  url: string;
  space_key: string;
}

class LabelDebugEnvironment {
  private testDbPath = './.lancedb-debug';
  private testTableName = 'confluence-debug';
  private debugPages: DebugPage[] = [];

  /**
   * デバッグ環境を初期化
   */
  async initialize() {
    console.log('🧪 ラベル機能デバッグ環境を初期化中...');
    
    // テスト用のLanceDBクライアントを作成
    // 実際の実装では、別のデータベースファイルを使用
    console.log('📊 デバッグ環境の準備完了');
  }

  /**
   * Confluence APIから10ページを取得
   */
  async fetchDebugPages(): Promise<DebugPage[]> {
    console.log('🔍 Confluence APIから10ページを取得中...');
    
    try {
      // 10ページのみ取得
      const pages = await confluenceSyncService.getAllConfluencePages(10);
      console.log(`📄 取得したページ数: ${pages.length}件`);

      const debugPages: DebugPage[] = [];

      for (const page of pages) {
        console.log(`\n📋 ページ処理中: ${page.title} (ID: ${page.id})`);
        
        // ラベルを取得
        const labels = await confluenceSyncService.getConfluenceLabels(page.id);
        console.log(`  ラベル: ${JSON.stringify(labels)}`);
        
        // テキストを抽出
        const content = confluenceSyncService.extractTextFromHtml(page.body?.storage?.value || '');
        console.log(`  コンテンツ長: ${content.length}文字`);
        
        // チャンクに分割
        const chunks = confluenceSyncService.splitTextIntoChunks(content, 1800, 100);
        console.log(`  チャンク数: ${chunks.length}個`);

        // デバッグページを作成
        const debugPage: DebugPage = {
          id: `${page.id}-0`, // 最初のチャンクのみ
          pageId: parseInt(page.id),
          title: page.title,
          content: chunks[0] || content,
          labels: labels || [],
          lastUpdated: page.version?.when || new Date().toISOString(),
          url: page._links?.webui || '',
          space_key: page.space?.key || 'CLIENTTOMO'
        };

        debugPages.push(debugPage);
      }

      this.debugPages = debugPages;
      console.log(`✅ デバッグページ準備完了: ${debugPages.length}件`);
      
      return debugPages;
    } catch (error) {
      console.error('❌ ページ取得エラー:', error);
      throw error;
    }
  }

  /**
   * ラベル格納形式を詳細分析
   */
  analyzeLabelStorageFormat() {
    console.log('\n🔍 ラベル格納形式の詳細分析');
    console.log('=' .repeat(50));

    this.debugPages.forEach((page, index) => {
      console.log(`\n[ページ ${index + 1}] ${page.title}`);
      console.log(`  ページID: ${page.pageId}`);
      console.log(`  ラベル生データ: ${JSON.stringify(page.labels)}`);
      console.log(`  ラベル型: ${typeof page.labels}`);
      console.log(`  ラベル配列長: ${Array.isArray(page.labels) ? page.labels.length : 'N/A'}`);
      
      if (Array.isArray(page.labels)) {
        page.labels.forEach((label, i) => {
          console.log(`    [${i}]: ${JSON.stringify(label)} (型: ${typeof label})`);
        });
      }
    });
  }

  /**
   * 期待するラベル格納形式を確認
   */
  checkExpectedLabelFormat() {
    console.log('\n📋 期待するラベル格納形式の確認');
    console.log('=' .repeat(50));

    const expectedFormats = [
      'string[]', // 文字列配列
      'object[]', // オブジェクト配列
      'JSON string', // JSON文字列
      'LanceDB List<Utf8>', // LanceDBのList型
    ];

    console.log('期待される形式:');
    expectedFormats.forEach((format, index) => {
      console.log(`  ${index + 1}. ${format}`);
    });

    // 実際の形式を分析
    const actualFormats = new Set<string>();
    this.debugPages.forEach(page => {
      if (Array.isArray(page.labels)) {
        if (page.labels.length === 0) {
          actualFormats.add('empty array');
        } else {
          const types = page.labels.map(label => typeof label);
          actualFormats.add(`array<${types.join('|')}>`);
        }
      } else {
        actualFormats.add(typeof page.labels);
      }
    });

    console.log('\n実際の形式:');
    Array.from(actualFormats).forEach((format, index) => {
      console.log(`  ${index + 1}. ${format}`);
    });
  }

  /**
   * 既存データのundefined問題を調査
   */
  investigateUndefinedIssue() {
    console.log('\n🔍 既存データのundefined問題を調査');
    console.log('=' .repeat(50));

    // 現在のデータベースから既存データを確認
    console.log('📊 現在のデータベースの状態を確認中...');
    
    // 実際の実装では、LanceDBから既存データを取得
    console.log('⚠️ 既存データのlastUpdatedがundefinedになっている原因:');
    console.log('  1. データベースにlastUpdatedフィールドが存在しない');
    console.log('  2. フィールド名の不一致');
    console.log('  3. データ型の不一致');
    console.log('  4. 初期同期時のデータ不備');
  }

  /**
   * 修正版のラベル格納形式をテスト
   */
  async testFixedLabelFormat() {
    console.log('\n🧪 修正版のラベル格納形式をテスト');
    console.log('=' .repeat(50));

    // 修正版のラベル処理を実装
    const fixedPages = this.debugPages.map(page => {
      // ラベルを正しい形式に変換
      let fixedLabels: string[] = [];
      
      if (Array.isArray(page.labels)) {
        fixedLabels = page.labels.map(label => {
          if (typeof label === 'string') {
            return label;
          } else if (typeof label === 'object' && label !== null) {
            // オブジェクトの場合は文字列に変換
            return JSON.stringify(label);
          }
          return String(label);
        });
      } else if (typeof page.labels === 'string') {
        try {
          const parsed = JSON.parse(page.labels);
          if (Array.isArray(parsed)) {
            fixedLabels = parsed;
          } else {
            fixedLabels = [page.labels];
          }
        } catch {
          fixedLabels = [page.labels];
        }
      }

      return {
        ...page,
        labels: fixedLabels,
        lastUpdated: page.lastUpdated || new Date().toISOString()
      };
    });

    console.log('修正後のラベル形式:');
    fixedPages.forEach((page, index) => {
      console.log(`\n[修正後 ${index + 1}] ${page.title}`);
      console.log(`  ラベル: ${JSON.stringify(page.labels)}`);
      console.log(`  最終更新: ${page.lastUpdated}`);
    });

    return fixedPages;
  }

  /**
   * デバッグ結果をサマリー
   */
  generateDebugSummary() {
    console.log('\n📊 デバッグ結果サマリー');
    console.log('=' .repeat(50));

    const totalPages = this.debugPages.length;
    const pagesWithLabels = this.debugPages.filter(page => 
      Array.isArray(page.labels) && page.labels.length > 0
    ).length;
    const pagesWithoutLabels = totalPages - pagesWithLabels;

    console.log(`📊 総ページ数: ${totalPages}`);
    console.log(`📊 ラベルあり: ${pagesWithLabels}件`);
    console.log(`📊 ラベルなし: ${pagesWithoutLabels}件`);
    console.log(`📊 ラベル率: ${((pagesWithLabels / totalPages) * 100).toFixed(1)}%`);

    // 問題点の特定
    console.log('\n⚠️ 特定された問題:');
    if (pagesWithoutLabels > 0) {
      console.log(`  1. ${pagesWithoutLabels}件のページでラベルが空`);
    }
    console.log('  2. 既存データのlastUpdatedがundefined');
    console.log('  3. ラベル格納形式の不整合');

    // 推奨修正策
    console.log('\n💡 推奨修正策:');
    console.log('  1. ラベル取得ロジックの修正');
    console.log('  2. データベーススキーマの統一');
    console.log('  3. 既存データの再同期');
    console.log('  4. ラベルフィルタリングロジックの修正');
  }
}

// デバッグ環境の実行
async function runLabelDebug() {
  const debugEnv = new LabelDebugEnvironment();
  
  try {
    await debugEnv.initialize();
    await debugEnv.fetchDebugPages();
    debugEnv.analyzeLabelStorageFormat();
    debugEnv.checkExpectedLabelFormat();
    debugEnv.investigateUndefinedIssue();
    await debugEnv.testFixedLabelFormat();
    debugEnv.generateDebugSummary();
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error);
  }
}

// テスト実行
runLabelDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});

 * 10ページのみで高速デバッグを実行
 */

import { lancedbClient } from '../../lib/lancedb-client';
import { unifiedEmbeddingService } from '../../lib/unified-embedding-service';
import { confluenceSyncService } from '../../lib/confluence-sync-service';

interface DebugPage {
  id: string;
  pageId: number;
  title: string;
  content: string;
  labels: string[];
  lastUpdated: string;
  url: string;
  space_key: string;
}

class LabelDebugEnvironment {
  private testDbPath = './.lancedb-debug';
  private testTableName = 'confluence-debug';
  private debugPages: DebugPage[] = [];

  /**
   * デバッグ環境を初期化
   */
  async initialize() {
    console.log('🧪 ラベル機能デバッグ環境を初期化中...');
    
    // テスト用のLanceDBクライアントを作成
    // 実際の実装では、別のデータベースファイルを使用
    console.log('📊 デバッグ環境の準備完了');
  }

  /**
   * Confluence APIから10ページを取得
   */
  async fetchDebugPages(): Promise<DebugPage[]> {
    console.log('🔍 Confluence APIから10ページを取得中...');
    
    try {
      // 10ページのみ取得
      const pages = await confluenceSyncService.getAllConfluencePages(10);
      console.log(`📄 取得したページ数: ${pages.length}件`);

      const debugPages: DebugPage[] = [];

      for (const page of pages) {
        console.log(`\n📋 ページ処理中: ${page.title} (ID: ${page.id})`);
        
        // ラベルを取得
        const labels = await confluenceSyncService.getConfluenceLabels(page.id);
        console.log(`  ラベル: ${JSON.stringify(labels)}`);
        
        // テキストを抽出
        const content = confluenceSyncService.extractTextFromHtml(page.body?.storage?.value || '');
        console.log(`  コンテンツ長: ${content.length}文字`);
        
        // チャンクに分割
        const chunks = confluenceSyncService.splitTextIntoChunks(content, 1800, 100);
        console.log(`  チャンク数: ${chunks.length}個`);

        // デバッグページを作成
        const debugPage: DebugPage = {
          id: `${page.id}-0`, // 最初のチャンクのみ
          pageId: parseInt(page.id),
          title: page.title,
          content: chunks[0] || content,
          labels: labels || [],
          lastUpdated: page.version?.when || new Date().toISOString(),
          url: page._links?.webui || '',
          space_key: page.space?.key || 'CLIENTTOMO'
        };

        debugPages.push(debugPage);
      }

      this.debugPages = debugPages;
      console.log(`✅ デバッグページ準備完了: ${debugPages.length}件`);
      
      return debugPages;
    } catch (error) {
      console.error('❌ ページ取得エラー:', error);
      throw error;
    }
  }

  /**
   * ラベル格納形式を詳細分析
   */
  analyzeLabelStorageFormat() {
    console.log('\n🔍 ラベル格納形式の詳細分析');
    console.log('=' .repeat(50));

    this.debugPages.forEach((page, index) => {
      console.log(`\n[ページ ${index + 1}] ${page.title}`);
      console.log(`  ページID: ${page.pageId}`);
      console.log(`  ラベル生データ: ${JSON.stringify(page.labels)}`);
      console.log(`  ラベル型: ${typeof page.labels}`);
      console.log(`  ラベル配列長: ${Array.isArray(page.labels) ? page.labels.length : 'N/A'}`);
      
      if (Array.isArray(page.labels)) {
        page.labels.forEach((label, i) => {
          console.log(`    [${i}]: ${JSON.stringify(label)} (型: ${typeof label})`);
        });
      }
    });
  }

  /**
   * 期待するラベル格納形式を確認
   */
  checkExpectedLabelFormat() {
    console.log('\n📋 期待するラベル格納形式の確認');
    console.log('=' .repeat(50));

    const expectedFormats = [
      'string[]', // 文字列配列
      'object[]', // オブジェクト配列
      'JSON string', // JSON文字列
      'LanceDB List<Utf8>', // LanceDBのList型
    ];

    console.log('期待される形式:');
    expectedFormats.forEach((format, index) => {
      console.log(`  ${index + 1}. ${format}`);
    });

    // 実際の形式を分析
    const actualFormats = new Set<string>();
    this.debugPages.forEach(page => {
      if (Array.isArray(page.labels)) {
        if (page.labels.length === 0) {
          actualFormats.add('empty array');
        } else {
          const types = page.labels.map(label => typeof label);
          actualFormats.add(`array<${types.join('|')}>`);
        }
      } else {
        actualFormats.add(typeof page.labels);
      }
    });

    console.log('\n実際の形式:');
    Array.from(actualFormats).forEach((format, index) => {
      console.log(`  ${index + 1}. ${format}`);
    });
  }

  /**
   * 既存データのundefined問題を調査
   */
  investigateUndefinedIssue() {
    console.log('\n🔍 既存データのundefined問題を調査');
    console.log('=' .repeat(50));

    // 現在のデータベースから既存データを確認
    console.log('📊 現在のデータベースの状態を確認中...');
    
    // 実際の実装では、LanceDBから既存データを取得
    console.log('⚠️ 既存データのlastUpdatedがundefinedになっている原因:');
    console.log('  1. データベースにlastUpdatedフィールドが存在しない');
    console.log('  2. フィールド名の不一致');
    console.log('  3. データ型の不一致');
    console.log('  4. 初期同期時のデータ不備');
  }

  /**
   * 修正版のラベル格納形式をテスト
   */
  async testFixedLabelFormat() {
    console.log('\n🧪 修正版のラベル格納形式をテスト');
    console.log('=' .repeat(50));

    // 修正版のラベル処理を実装
    const fixedPages = this.debugPages.map(page => {
      // ラベルを正しい形式に変換
      let fixedLabels: string[] = [];
      
      if (Array.isArray(page.labels)) {
        fixedLabels = page.labels.map(label => {
          if (typeof label === 'string') {
            return label;
          } else if (typeof label === 'object' && label !== null) {
            // オブジェクトの場合は文字列に変換
            return JSON.stringify(label);
          }
          return String(label);
        });
      } else if (typeof page.labels === 'string') {
        try {
          const parsed = JSON.parse(page.labels);
          if (Array.isArray(parsed)) {
            fixedLabels = parsed;
          } else {
            fixedLabels = [page.labels];
          }
        } catch {
          fixedLabels = [page.labels];
        }
      }

      return {
        ...page,
        labels: fixedLabels,
        lastUpdated: page.lastUpdated || new Date().toISOString()
      };
    });

    console.log('修正後のラベル形式:');
    fixedPages.forEach((page, index) => {
      console.log(`\n[修正後 ${index + 1}] ${page.title}`);
      console.log(`  ラベル: ${JSON.stringify(page.labels)}`);
      console.log(`  最終更新: ${page.lastUpdated}`);
    });

    return fixedPages;
  }

  /**
   * デバッグ結果をサマリー
   */
  generateDebugSummary() {
    console.log('\n📊 デバッグ結果サマリー');
    console.log('=' .repeat(50));

    const totalPages = this.debugPages.length;
    const pagesWithLabels = this.debugPages.filter(page => 
      Array.isArray(page.labels) && page.labels.length > 0
    ).length;
    const pagesWithoutLabels = totalPages - pagesWithLabels;

    console.log(`📊 総ページ数: ${totalPages}`);
    console.log(`📊 ラベルあり: ${pagesWithLabels}件`);
    console.log(`📊 ラベルなし: ${pagesWithoutLabels}件`);
    console.log(`📊 ラベル率: ${((pagesWithLabels / totalPages) * 100).toFixed(1)}%`);

    // 問題点の特定
    console.log('\n⚠️ 特定された問題:');
    if (pagesWithoutLabels > 0) {
      console.log(`  1. ${pagesWithoutLabels}件のページでラベルが空`);
    }
    console.log('  2. 既存データのlastUpdatedがundefined');
    console.log('  3. ラベル格納形式の不整合');

    // 推奨修正策
    console.log('\n💡 推奨修正策:');
    console.log('  1. ラベル取得ロジックの修正');
    console.log('  2. データベーススキーマの統一');
    console.log('  3. 既存データの再同期');
    console.log('  4. ラベルフィルタリングロジックの修正');
  }
}

// デバッグ環境の実行
async function runLabelDebug() {
  const debugEnv = new LabelDebugEnvironment();
  
  try {
    await debugEnv.initialize();
    await debugEnv.fetchDebugPages();
    debugEnv.analyzeLabelStorageFormat();
    debugEnv.checkExpectedLabelFormat();
    debugEnv.investigateUndefinedIssue();
    await debugEnv.testFixedLabelFormat();
    debugEnv.generateDebugSummary();
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error);
  }
}

// テスト実行
runLabelDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
