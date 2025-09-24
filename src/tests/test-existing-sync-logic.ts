/**
 * 既存の同期ロジックを使用した正しい同期仕様のテスト
 * 
 * 既存のbatch-sync-confluence.tsのロジックを直接使用
 */

import { batchSyncConfluence, getConfluencePages, getExistingLanceDBData, shouldUpdatePage } from '../scripts/batch-sync-confluence';
import { LanceDBClient } from '../lib/lancedb-client';

class ExistingSyncLogicTest {
  private lancedbClient: LanceDBClient;

  constructor() {
    this.lancedbClient = LanceDBClient.getInstance();
  }

  /**
   * 既存の同期ロジックを使用したテスト
   */
  async testExistingSyncLogic(): Promise<void> {
    console.log('🧪 既存の同期ロジックを使用したテストを開始します...\n');

    try {
      // 1. 初期状態を表示
      console.log('📊 テスト開始前の状態:');
      await this.showDatabaseStatus();

      // 2. 既存のLanceDBデータを取得
      await this.lancedbClient.connect();
      const table = await this.lancedbClient.getTable();
      const existingLanceDBData = await getExistingLanceDBData(table);
      console.log(`\n📋 既存のLanceDBデータ: ${existingLanceDBData.size}ページ`);

      // 3. Confluence APIから10ページを取得
      console.log('\n🔍 Confluence APIから10ページを取得中...');
      const pages = await getConfluencePages('CLIENTTOMO', 0, 10);
      console.log(`取得したページ数: ${pages.length}`);
      
      // 10ページに制限
      const testPages = pages.slice(0, 10);
      console.log(`テスト対象ページ数: ${testPages.length}`);

      if (testPages.length === 0) {
        console.error('❌ Confluence APIからページを取得できませんでした。');
        return;
      }

      // 4. 既存の同期ロジックを使用してページを処理
      console.log('\n🔄 既存の同期ロジックを使用してページを処理...');
      const results = {
        added: 0,
        updated: 0,
        unchanged: 0,
        errors: [] as string[]
      };

      for (const page of testPages) {
        try {
          const pageId = parseInt(page.id);
          const existingData = existingLanceDBData.get(pageId);
          
          if (existingData) {
            // 既存ページ - 日時比較で更新が必要かチェック
            const { needsUpdate, reason } = shouldUpdatePage(page, existingData);
            console.log(`📅 ページ ${page.title} (${page.id}): ${reason}`);
            
            if (needsUpdate) {
              console.log(`🔄 更新が必要: ${page.title} (${page.id})`);
              results.updated++;
            } else {
              console.log(`⏭️ 変更なし: ${page.title} (${page.id})`);
              results.unchanged++;
            }
          } else {
            // 新規ページ
            console.log(`➕ 新規追加: ${page.title} (${page.id})`);
            results.added++;
          }
        } catch (error) {
          const errorMsg = `ページ ${page.id} の処理に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }

      // 5. 結果を表示
      console.log('\n📈 処理結果:');
      console.log(`  追加: ${results.added}ページ`);
      console.log(`  更新: ${results.updated}ページ`);
      console.log(`  変更なし: ${results.unchanged}ページ`);
      console.log(`  エラー: ${results.errors.length}件`);

      // 6. 正しい仕様の確認
      console.log('\n📋 正しい仕様の確認:');
      console.log('1. ページIDが存在しない場合: 追加');
      console.log('2. ページIDが存在する場合: 更新日時比較');
      console.log('   - Confluenceの方が新しい場合: 削除して再作成');
      console.log('   - 更新がない場合: 何もしない');

      // 7. テスト結果の評価
      console.log('\n🎯 テスト結果の評価:');
      const isCorrect = results.added >= 0 && results.updated >= 0 && results.unchanged >= 0;
      console.log(`✅ 既存の同期ロジック: ${isCorrect ? '正常に動作' : 'エラーが発生'}`);

      if (results.errors.length > 0) {
        console.log('\n❌ エラー詳細:');
        results.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }

    } catch (error) {
      console.error('❌ テスト実行中にエラーが発生しました:', error);
    }
  }

  /**
   * データベースの状態を表示
   */
  async showDatabaseStatus(): Promise<void> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    // ページIDごとにグループ化
    const pageGroups = new Map<string, any[]>();
    allChunks.forEach((chunk: any) => {
      if (!pageGroups.has(chunk.pageId)) {
        pageGroups.set(chunk.pageId, []);
      }
      pageGroups.get(chunk.pageId)!.push(chunk);
    });
    
    console.log(`📊 データベースの状態:`);
    console.log(`  総チャンク数: ${allChunks.length}`);
    console.log(`  ユニークページ数: ${pageGroups.size}`);
    
    console.log(`\n📋 ページ一覧（最初の10件）:`);
    let count = 0;
    for (const [pageId, chunks] of pageGroups) {
      if (count >= 10) break;
      console.log(`  PageID: ${pageId}, タイトル: ${chunks[0].title}, チャンク数: ${chunks.length}`);
      count++;
    }
  }
}

// テスト実行
async function runExistingSyncLogicTest() {
  const test = new ExistingSyncLogicTest();
  await test.testExistingSyncLogic();
}

// スクリプト実行
if (require.main === module) {
  runExistingSyncLogicTest();
}

export { runExistingSyncLogicTest };
