/**
 * 同期実行中のラベル確認テスト
 * バックグラウンドで実行中の同期処理でラベルが正しく保存されているか確認
 */

import 'dotenv/config';
import { LanceDBClient } from '../../lib/lancedb-client';

class LabelVerifier {
  private lancedbClient: LanceDBClient;

  constructor() {
    this.lancedbClient = LanceDBClient.getInstance();
  }

  /**
   * ラベルが含まれているページを検索
   */
  async findPagesWithLabels() {
    console.log('🔍 ラベルが含まれているページを検索中...');
    
    try {
      await this.lancedbClient.connect();
      const table = await this.lancedbClient.getTable();

      // 全データを取得
      const dummyVector = new Array(768).fill(0);
      const allData = await table.search(dummyVector).limit(100).toArray();

      console.log(`📊 取得したデータ数: ${allData.length}件`);

      // ラベルが含まれているページをフィルタリング
      const pagesWithLabels = allData.filter((row: any) => 
        row.labels && Array.isArray(row.labels) && row.labels.length > 0
      );

      console.log(`\n✅ ラベルが含まれているページ数: ${pagesWithLabels.length}件`);

      if (pagesWithLabels.length > 0) {
        console.log('\n📋 ラベルが含まれているページの詳細:');
        pagesWithLabels.slice(0, 10).forEach((row: any, index: number) => {
          console.log(`  ${index + 1}. PageID: ${row.pageId}`);
          console.log(`     タイトル: ${row.title}`);
          console.log(`     ラベル: [${row.labels.join(', ')}]`);
          console.log(`     更新日時: ${row.lastUpdated}`);
          console.log('');
        });
      } else {
        console.log('❌ ラベルが含まれているページが見つかりませんでした');
      }

      // ラベル別の統計
      const labelStats = new Map<string, number>();
      pagesWithLabels.forEach((row: any) => {
        row.labels.forEach((label: string) => {
          labelStats.set(label, (labelStats.get(label) || 0) + 1);
        });
      });

      if (labelStats.size > 0) {
        console.log('\n📊 ラベル別の統計:');
        Array.from(labelStats.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([label, count]) => {
            console.log(`  ${label}: ${count}件`);
          });
      }

      return pagesWithLabels;

    } catch (error) {
      console.error('❌ ラベル確認エラー:', error);
      return [];
    }
  }

  /**
   * 特定のページIDのラベルを確認
   */
  async checkSpecificPageLabels(pageIds: number[]) {
    console.log(`\n🔍 特定のページIDのラベルを確認中...`);
    
    try {
      await this.lancedbClient.connect();
      const table = await this.lancedbClient.getTable();

      for (const pageId of pageIds) {
        console.log(`\n📄 PageID ${pageId} の確認:`);
        
        // 特定のページIDのデータを検索
        const dummyVector = new Array(768).fill(0);
        const pageData = await table.search(dummyVector)
          .where(`"pageId" = ${pageId}`)
          .limit(10)
          .toArray();

        if (pageData.length > 0) {
          const firstRow = pageData[0];
          console.log(`  タイトル: ${firstRow.title}`);
          console.log(`  ラベル: [${firstRow.labels ? firstRow.labels.join(', ') : 'なし'}]`);
          console.log(`  更新日時: ${firstRow.lastUpdated}`);
          console.log(`  チャンク数: ${pageData.length}`);
        } else {
          console.log(`  ❌ PageID ${pageId} のデータが見つかりませんでした`);
        }
      }

    } catch (error) {
      console.error('❌ 特定ページ確認エラー:', error);
    }
  }

  /**
   * 議事録とフォルダのラベルを特別に確認
   */
  async checkMeetingAndFolderLabels() {
    console.log('\n🔍 議事録とフォルダのラベルを特別確認中...');
    
    try {
      await this.lancedbClient.connect();
      const table = await this.lancedbClient.getTable();

      // 全データを取得
      const dummyVector = new Array(768).fill(0);
      const allData = await table.search(dummyVector).limit(200).toArray();

      // 議事録関連のページを検索
      const meetingPages = allData.filter((row: any) => 
        row.title && (
          row.title.includes('議事録') || 
          row.title.includes('ミーティング') ||
          row.title.includes('確認会')
        )
      );

      console.log(`\n📋 議事録関連ページ数: ${meetingPages.length}件`);

      if (meetingPages.length > 0) {
        console.log('\n📄 議事録関連ページのラベル状況:');
        meetingPages.slice(0, 5).forEach((row: any, index: number) => {
          console.log(`  ${index + 1}. ${row.title}`);
          console.log(`     ラベル: [${row.labels && Array.isArray(row.labels) ? row.labels.join(', ') : 'なし'}]`);
          console.log(`     更新日時: ${row.lastUpdated}`);
          console.log('');
        });
      }

      // フォルダ関連のページを検索
      const folderPages = allData.filter((row: any) => 
        row.title && (
          row.title.includes('フォルダ') || 
          row.title.includes('■') ||
          row.title.includes('ワード・ディフィニション')
        )
      );

      console.log(`\n📁 フォルダ関連ページ数: ${folderPages.length}件`);

      if (folderPages.length > 0) {
        console.log('\n📄 フォルダ関連ページのラベル状況:');
        folderPages.slice(0, 5).forEach((row: any, index: number) => {
          console.log(`  ${index + 1}. ${row.title}`);
          console.log(`     ラベル: [${row.labels && Array.isArray(row.labels) ? row.labels.join(', ') : 'なし'}]`);
          console.log(`     更新日時: ${row.lastUpdated}`);
          console.log('');
        });
      }

    } catch (error) {
      console.error('❌ 議事録・フォルダ確認エラー:', error);
    }
  }

  /**
   * ラベルフィルタリングの動作確認
   */
  async testLabelFiltering() {
    console.log('\n🧪 ラベルフィルタリングの動作確認...');
    
    try {
      await this.lancedbClient.connect();
      const table = await this.lancedbClient.getTable();

      // 全データを取得
      const dummyVector = new Array(768).fill(0);
      const allData = await table.search(dummyVector).limit(100).toArray();

      console.log(`📊 総ページ数: ${allData.length}件`);

      // 除外すべきラベル
      const excludeLabels = ['議事録', 'フォルダ'];

      // ラベルフィルタリングをシミュレート
      const filteredData = allData.filter((row: any) => {
        if (!row.labels || !Array.isArray(row.labels)) {
          return true; // ラベルがない場合は除外しない
        }
        
        // 除外ラベルが含まれているかチェック
        const hasExcludeLabel = row.labels.some((label: string) => 
          excludeLabels.some(excludeLabel => 
            label.includes(excludeLabel) || excludeLabel.includes(label)
          )
        );
        
        return !hasExcludeLabel;
      });

      console.log(`✅ フィルタリング後: ${filteredData.length}件`);
      console.log(`❌ 除外されたページ数: ${allData.length - filteredData.length}件`);

      // 除外されたページの詳細
      const excludedPages = allData.filter((row: any) => {
        if (!row.labels || !Array.isArray(row.labels)) {
          return false;
        }
        
        const hasExcludeLabel = row.labels.some((label: string) => 
          excludeLabels.some(excludeLabel => 
            label.includes(excludeLabel) || excludeLabel.includes(label)
          )
        );
        
        return hasExcludeLabel;
      });

      if (excludedPages.length > 0) {
        console.log('\n🚫 除外されたページの詳細:');
        excludedPages.slice(0, 5).forEach((row: any, index: number) => {
          console.log(`  ${index + 1}. ${row.title}`);
          console.log(`     ラベル: [${row.labels.join(', ')}]`);
          console.log('');
        });
      }

    } catch (error) {
      console.error('❌ ラベルフィルタリング確認エラー:', error);
    }
  }

  /**
   * 総合レポートを生成
   */
  generateReport(pagesWithLabels: any[]) {
    console.log('\n📊 ラベル確認レポート');
    console.log('=' .repeat(50));
    console.log(`✅ ラベルが含まれているページ数: ${pagesWithLabels.length}件`);
    console.log(`📅 確認日時: ${new Date().toISOString()}`);
    
    if (pagesWithLabels.length > 0) {
      console.log('\n🎉 ラベル機能は正常に動作しています！');
    } else {
      console.log('\n⚠️ ラベルが含まれているページが見つかりませんでした');
      console.log('   同期処理が完了するまで待つか、同期処理を確認してください');
    }
  }
}

// メイン実行
async function runLabelVerification() {
  const verifier = new LabelVerifier();
  
  try {
    console.log('🚀 ラベル確認テストを開始します...');
    console.log('=' .repeat(50));
    
    // 1. ラベルが含まれているページを検索
    const pagesWithLabels = await verifier.findPagesWithLabels();
    
    // 2. 特定のページIDのラベルを確認
    await verifier.checkSpecificPageLabels([703561854, 996376596, 1028620335]);
    
    // 3. 議事録とフォルダのラベルを特別確認
    await verifier.checkMeetingAndFolderLabels();
    
    // 4. ラベルフィルタリングの動作確認
    await verifier.testLabelFiltering();
    
    // 5. 総合レポートを生成
    verifier.generateReport(pagesWithLabels);
    
  } catch (error) {
    console.error('❌ ラベル確認テストエラー:', error);
  }
}

runLabelVerification().catch(console.error);
