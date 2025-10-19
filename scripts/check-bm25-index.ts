/**
 * BM25インデックス確認スクリプト
 */

import * as lancedb from '@lancedb/lancedb';
import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { config } from 'dotenv';

config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       BM25インデックス確認                                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    
    const expectedPageTitle = '721_【作成中】学年自動更新バッチ';
    const keywords = ['学年', '更新'];
    
    console.log(`期待ページ: ${expectedPageTitle}`);
    console.log(`キーワード: [${keywords.join(', ')}]\n`);
    
    // 期待ページを直接取得
    const results = await table
      .query()
      .where(`title = '${expectedPageTitle}'`)
      .toArray();
    
    if (results.length === 0) {
      console.log('❌ 期待ページが見つかりませんでした');
      return;
    }
    
    const page = results[0];
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 期待ページの内容:\n');
    console.log(`タイトル: ${page.title}`);
    console.log(`PageId: ${page.pageId}`);
    console.log('');
    console.log(`コンテンツ（最初の500文字）:`);
    console.log(`${String(page.content || '').substring(0, 500)}...`);
    console.log('');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 キーワードマッチング確認:\n');
    
    const title = String(page.title || '').toLowerCase();
    const content = String(page.content || '').toLowerCase();
    
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const titleMatch = title.includes(keywordLower);
      const contentMatch = content.includes(keywordLower);
      
      console.log(`キーワード "${keyword}":`);
      console.log(`  タイトル: ${titleMatch ? '✅ マッチ' : '❌ なし'}`);
      console.log(`  コンテンツ: ${contentMatch ? '✅ マッチ' : '❌ なし'}`);
      
      if (contentMatch) {
        // 出現箇所を表示
        const index = content.indexOf(keywordLower);
        const start = Math.max(0, index - 30);
        const end = Math.min(content.length, index + keywordLower.length + 30);
        const snippet = content.substring(start, end);
        console.log(`  出現箇所: ...${snippet}...`);
      }
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔎 BM25検索テスト:\n');
    
    // 各キーワードでLIKE検索を実行
    for (const keyword of keywords) {
      const esc = keyword.replace(/'/g, "''");
      const rows = await table.query().where(`title LIKE '%${esc}%'`).limit(10).toArray();
      
      console.log(`"${keyword}" でタイトル検索:`);
      console.log(`  ヒット数: ${rows.length}件`);
      
      if (rows.length > 0) {
        const found = rows.some((r: any) => r.title === expectedPageTitle);
        console.log(`  期待ページ: ${found ? '✅ 含まれる' : '❌ 含まれない'}`);
        
        if (!found && rows.length > 0) {
          console.log(`  ヒット例:`);
          rows.slice(0, 3).forEach((r: any, i: number) => {
            console.log(`    ${i + 1}. ${r.title}`);
          });
        }
      }
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 結論:\n');
    
    const titleIncludesKeywords = keywords.every(k => 
      title.includes(k.toLowerCase())
    );
    
    if (titleIncludesKeywords) {
      console.log('✅ タイトルにすべてのキーワードが含まれています');
      console.log('⚠️  しかし、BM25検索でヒットしていない可能性があります');
      console.log('\n考えられる原因:');
      console.log('  1. LunrインデックスにタイトルがCK登録されていない');
      console.log('  2. キーワード抽出ロジックに問題がある');
      console.log('  3. BM25検索のクエリ構築に問題がある');
    } else {
      console.log('❌ タイトルに一部のキーワードが含まれていません');
    }

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  } finally {
    const client = OptimizedLanceDBClient.getInstance();
    client.resetConnection();
    await client.disconnect();
  }
}

main();


