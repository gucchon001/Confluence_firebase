/**
 * Phase 0A-4 vs 現在のベクトル比較
 * 同じページのベクトルが実際に変わっているのか確認
 */

import * as lancedb from '@lancedb/lancedb';
import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { config } from 'dotenv';

config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       ベクトル比較: Phase 0A-4 vs 現在                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  const testPages = [
    '046_【FIX】会員退会機能',
    '168_【FIX】教室コピー機能',
    '721_【作成中】学年自動更新バッチ'
  ];

  try {
    // 現在のLanceDB
    const dbCurrent = await lancedb.connect('.lancedb');
    const tableCurrent = await dbCurrent.openTable('confluence');
    
    // Phase 0A-4のLanceDB
    const dbBefore = await lancedb.connect('.lancedb.backup.label-sync.1760528975460');
    const tableBefore = await dbBefore.openTable('confluence');
    
    for (const pageTitle of testPages) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📄 ${pageTitle}\n`);
      
      // 現在のレコード取得
      const currentRecords = await tableCurrent
        .query()
        .where(`title = '${pageTitle}'`)
        .toArray();
      
      // Phase 0A-4のレコード取得
      const beforeRecords = await tableBefore
        .query()
        .where(`title = '${pageTitle}'`)
        .toArray();
      
      if (currentRecords.length === 0 && beforeRecords.length === 0) {
        console.log('❌ 両方に存在しません\n');
        continue;
      }
      
      if (currentRecords.length === 0) {
        console.log('❌ 現在のLanceDBに存在しません');
        console.log(`✅ Phase 0A-4には${beforeRecords.length}件存在\n`);
        continue;
      }
      
      if (beforeRecords.length === 0) {
        console.log('✅ 現在のLanceDBに${currentRecords.length}件存在');
        console.log('❌ Phase 0A-4に存在しません\n');
        continue;
      }
      
      console.log(`現在: ${currentRecords.length}件`);
      console.log(`Phase 0A-4: ${beforeRecords.length}件\n`);
      
      // 最初のチャンクを比較
      const current = currentRecords[0];
      const before = beforeRecords[0];
      
      console.log('📊 基本情報:');
      console.log(`  現在のPageId: ${current.pageId}`);
      console.log(`  Phase 0A-4のPageId: ${before.pageId}`);
      console.log(`  PageId一致: ${current.pageId === before.pageId ? '✅' : '❌'}\n`);
      
      console.log('📊 コンテンツ:');
      const currentContent = String(current.content || '').substring(0, 100);
      const beforeContent = String(before.content || '').substring(0, 100);
      console.log(`  現在: ${currentContent}...`);
      console.log(`  Phase 0A-4: ${beforeContent}...`);
      console.log(`  コンテンツ一致: ${current.content === before.content ? '✅ 完全一致' : '❌ 異なる'}\n`);
      
      // ベクトル比較（最初の5次元のみ表示）
      if (current.vector && before.vector) {
        const currentVec = Array.isArray(current.vector) ? current.vector : [];
        const beforeVec = Array.isArray(before.vector) ? before.vector : [];
        
        console.log('📊 ベクトル（最初の5次元）:');
        console.log(`  現在:      [${currentVec.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}...]`);
        console.log(`  Phase 0A-4: [${beforeVec.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}...]`);
        
        // ベクトルが同じかチェック
        const vectorsMatch = currentVec.length === beforeVec.length &&
          currentVec.every((v: number, i: number) => Math.abs(v - beforeVec[i]) < 0.0001);
        
        console.log(`  ベクトル一致: ${vectorsMatch ? '✅ 完全一致' : '❌ 異なる'}`);
        
        if (!vectorsMatch && currentVec.length === beforeVec.length) {
          // 差分を計算
          let maxDiff = 0;
          let avgDiff = 0;
          for (let i = 0; i < currentVec.length; i++) {
            const diff = Math.abs(currentVec[i] - beforeVec[i]);
            maxDiff = Math.max(maxDiff, diff);
            avgDiff += diff;
          }
          avgDiff /= currentVec.length;
          
          console.log(`  最大差分: ${maxDiff.toFixed(6)}`);
          console.log(`  平均差分: ${avgDiff.toFixed(6)}`);
        }
      } else {
        console.log('⚠️  ベクトルが取得できませんでした');
      }
      
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 結論:\n');
    console.log('もしベクトルが完全一致している場合:');
    console.log('  → ベクトル埋め込みは他のページの有無に影響されない');
    console.log('  → 順位劣化の原因は別にある（検索アルゴリズム、パラメータ、スキーマなど）');
    console.log('\nもしベクトルが異なる場合:');
    console.log('  → 再構築時に埋め込みを再生成した');
    console.log('  → Gemini埋め込みのランダム性、またはコンテンツ変更が原因');

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


