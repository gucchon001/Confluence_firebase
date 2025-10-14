/**
 * ハイブリッド検索診断スクリプト
 * 本番環境の検索機能が正しく動作しているかを確認
 */

import * as path from 'path';
import * as fs from 'fs';
import { searchLanceDB } from '../src/lib/lancedb-search-client';

async function diagnoseSearch() {
  console.log('🔍 ハイブリッド検索診断開始\n');
  
  // 1. LanceDBデータの存在確認
  console.log('=== 1. LanceDBデータの存在確認 ===');
  const lancedbPath = path.join(process.cwd(), '.lancedb');
  const exists = fs.existsSync(lancedbPath);
  console.log(`📁 .lancedb ディレクトリ: ${exists ? '✅ 存在' : '❌ 不在'}`);
  
  if (exists) {
    const files = fs.readdirSync(lancedbPath);
    console.log(`📦 ファイル数: ${files.length}`);
    console.log(`📝 ファイル一覧: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
    
    // テーブルディレクトリの確認
    const confluenceTable = path.join(lancedbPath, 'confluence.lance');
    const tableExists = fs.existsSync(confluenceTable);
    console.log(`📊 confluence.lance テーブル: ${tableExists ? '✅ 存在' : '❌ 不在'}`);
  }
  
  console.log('');
  
  // 2. 検索テスト
  console.log('=== 2. 検索テスト ===');
  const testQueries = [
    'ユーザーに応募制限はあるか',
    'ログイン機能',
    '求人詳細画面'
  ];
  
  for (const query of testQueries) {
    console.log(`\n🔍 クエリ: "${query}"`);
    try {
      const startTime = Date.now();
      const results = await searchLanceDB({
        query,
        topK: 5,
        useLunrIndex: true,
        labelFilters: { includeMeetingNotes: false }
      });
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  処理時間: ${duration}ms`);
      console.log(`📊 検索結果数: ${results.length}件`);
      
      if (results.length > 0) {
        console.log(`✅ Top 3 結果:`);
        results.slice(0, 3).forEach((r, idx) => {
          console.log(`  ${idx + 1}. ${r.title}`);
          console.log(`     ソース: ${r.source}, スコア: ${r.scoreText}`);
        });
      } else {
        console.log(`❌ 検索結果なし`);
      }
    } catch (error: any) {
      console.log(`❌ エラー: ${error.message}`);
      console.error(error);
    }
  }
  
  console.log('\n=== 診断完了 ===');
}

diagnoseSearch().catch(console.error);

