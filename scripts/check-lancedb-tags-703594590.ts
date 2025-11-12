/**
 * LanceDBからpageId=703594590のstructured_tagsを直接確認するスクリプト
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as lancedb from '@lancedb/lancedb';
import { getLabelsAsArray } from '../src/lib/label-utils';

async function main() {
  console.log('🔍 LanceDBからpageId=703594590のstructured_tagsを確認\n');
  console.log('='.repeat(80));
  
  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    
    // 全データを取得してpageId=703594590を探す
    console.log('📥 LanceDBから全データを取得中...\n');
    const dummyVector = new Array(768).fill(0);
    const allResults = await table.search(dummyVector).limit(10000).toArray();
    
    console.log(`📊 全データ件数: ${allResults.length}件\n`);
    
    // pageId=703594590を探す
    const targetPageId = 703594590;
    const targetResults = allResults.filter((row: any) => {
      const rowPageId = row.page_id || row.pageId;
      const rowPageIdNum = typeof rowPageId === 'bigint' ? Number(rowPageId) : Number(rowPageId);
      return rowPageIdNum === targetPageId;
    });
    
    console.log(`🔍 pageId=${targetPageId} の結果: ${targetResults.length}件\n`);
    
    if (targetResults.length === 0) {
      console.log('❌ pageId=703594590が見つかりませんでした\n');
      return;
    }
    
    // 最初の結果を詳細表示
    const result = targetResults[0];
    console.log('📋 レコード詳細:\n');
    console.log(`  title: ${result.title || 'N/A'}`);
    console.log(`  page_id: ${result.page_id || result.pageId || 'N/A'}`);
    console.log(`  page_id (type): ${typeof (result.page_id || result.pageId)}`);
    console.log('');
    
    // structured_tagsの生データを確認
    console.log('🏷️ structured_tags の生データ:\n');
    console.log(`  structured_tags (raw):`, result.structured_tags);
    console.log(`  structured_tags (type): ${typeof result.structured_tags}`);
    console.log(`  structured_tags (isArray): ${Array.isArray(result.structured_tags)}`);
    console.log(`  structured_tags (constructor): ${result.structured_tags?.constructor?.name || 'N/A'}`);
    console.log('');
    
    // getLabelsAsArrayで変換
    console.log('🔄 getLabelsAsArrayで変換:\n');
    const tagsArray = getLabelsAsArray(result.structured_tags);
    console.log(`  tagsArray:`, tagsArray);
    console.log(`  tagsArray.length: ${tagsArray.length}`);
    console.log(`  tagsArray (type): ${typeof tagsArray}`);
    console.log(`  tagsArray (isArray): ${Array.isArray(tagsArray)}`);
    console.log('');
    
    // 各タグを表示
    if (tagsArray.length > 0) {
      console.log('📋 タグ一覧:\n');
      tagsArray.forEach((tag, index) => {
        console.log(`  ${index + 1}. "${tag}" (type: ${typeof tag})`);
      });
      console.log('');
    } else {
      console.log('⚠️ タグが空です\n');
    }
    
    // 他のstructured_*フィールドも確認
    console.log('📋 その他のStructuredLabelフィールド:\n');
    console.log(`  structured_category: ${result.structured_category || 'N/A'}`);
    console.log(`  structured_domain: ${result.structured_domain || 'N/A'}`);
    console.log(`  structured_feature: ${result.structured_feature || 'N/A'}`);
    console.log(`  structured_status: ${result.structured_status || 'N/A'}`);
    console.log('');
    
    // 検索結果でどう表示されるか確認
    console.log('🔍 検索結果として取得した場合の確認:\n');
    const { searchLanceDB } = await import('../src/lib/lancedb-search-client');
    const searchResults = await searchLanceDB({
      query: '退会した会員が同じアドレス使ったらどんな表示がでますか',
      topK: 60,
      useLunrIndex: true,
      labelFilters: {
        includeMeetingNotes: false
      }
    });
    
    const searchResult = searchResults.find((r: any) => {
      const pageId = r.page_id ?? r.pageId;
      return String(pageId) === String(targetPageId);
    });
    
    if (searchResult) {
      const rank = searchResults.findIndex((r: any) => {
        const pageId = r.page_id ?? r.pageId;
        return String(pageId) === String(targetPageId);
      }) + 1;
      
      console.log(`  ✅ 検索結果に見つかりました (RANK ${rank})\n`);
      console.log(`  title: ${searchResult.title || 'N/A'}`);
      console.log(`  page_id: ${searchResult.page_id ?? searchResult.pageId ?? 'N/A'}`);
      console.log(`  structured_tags (raw):`, searchResult.structured_tags);
      console.log(`  structured_tags (isArray): ${Array.isArray(searchResult.structured_tags)}`);
      
      const searchTagsArray = getLabelsAsArray(searchResult.structured_tags);
      console.log(`  structured_tags (converted):`, searchTagsArray);
      console.log(`  structured_tags (length): ${searchTagsArray.length}`);
      
      if (Array.isArray(searchResult.structured_tags)) {
        console.log(`  structured_tags (direct array):`, searchResult.structured_tags);
      }
    } else {
      console.log(`  ❌ 検索結果に見つかりませんでした\n`);
    }
    
    console.log('\n✅ 確認完了\n');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    if (error instanceof Error) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ スクリプト実行エラー:', error);
  process.exit(1);
});

