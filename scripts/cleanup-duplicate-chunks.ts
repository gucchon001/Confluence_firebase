/**
 * 重複チャンククリーニングスクリプト
 * 同じpage_idとchunkIndexの組み合わせが重複している場合、古い方を削除
 */

import * as lancedb from '@lancedb/lancedb';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   重複チャンククリーニングスクリプト                                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    
    // データ件数を確認
    const count = await table.countRows();
    console.log(`📊 現在のデータ件数: ${count}件\n`);
    
    if (count === 0) {
      console.log('⚠️ データが存在しません\n');
      return;
    }
    
    // 全データを取得
    console.log('🔍 データを分析中...\n');
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(100000).toArray();
    
    // 重複を検出（同じpage_idとchunkIndexの組み合わせ）
    const duplicateMap = new Map<string, any[]>();
    
    allData.forEach((record: any) => {
      const pageId = Number(record.page_id);
      const chunkIndex = Number(record.chunkIndex || 0);
      const key = `${pageId}-${chunkIndex}`;
      
      if (!duplicateMap.has(key)) {
        duplicateMap.set(key, []);
      }
      duplicateMap.get(key)!.push(record);
    });
    
    // 重複があるものだけを抽出
    const duplicates = Array.from(duplicateMap.entries())
      .filter(([_, records]) => records.length > 1)
      .map(([key, records]) => ({
        key,
        records: records.sort((a, b) => {
          // lastUpdatedでソート（新しい方を優先）
          const dateA = new Date(a.lastUpdated || 0).getTime();
          const dateB = new Date(b.lastUpdated || 0).getTime();
          return dateB - dateA; // 降順（新しい順）
        })
      }));
    
    console.log(`📊 重複検出結果:`);
    console.log(`  - 重複キー数: ${duplicates.length}件`);
    console.log(`  - 削除対象チャンク数: ${duplicates.reduce((sum, d) => sum + d.records.length - 1, 0)}件\n`);
    
    if (duplicates.length === 0) {
      console.log('✅ 重複データはありません\n');
      return;
    }
    
    // 削除対象を収集（各キーで最新以外を削除）
    // 同じpage_idとchunkIndexの組み合わせで、最新以外を削除
    const deleteTargets: Array<{ pageId: number; chunkIndex: number; ids: string[] }> = [];
    let keptCount = 0;
    let deletedCount = 0;
    
    duplicates.forEach(({ key, records }) => {
      const [pageIdStr, chunkIndexStr] = key.split('-');
      const pageId = Number(pageIdStr);
      const chunkIndex = Number(chunkIndexStr);
      
      const latest = records[0]; // 最新（lastUpdatedが新しい）
      const older = records.slice(1); // 古い（削除対象）
      
      console.log(`  📋 ${key}: 総数=${records.length}件, 保持=${latest.id}, 削除=${older.length}件`);
      
      keptCount++;
      const ids = older.map(r => String(r.id));
      deleteTargets.push({ pageId, chunkIndex, ids });
      deletedCount += older.length;
    });
    
    console.log(`\n📊 削除計画:`);
    console.log(`  - 保持するチャンク: ${keptCount}件`);
    console.log(`  - 削除するチャンク: ${deletedCount}件\n`);
    
    // テストモード: 環境変数 TEST_MODE=true の場合、10件のみ削除
    const testMode = process.env.TEST_MODE === 'true';
    const testLimit = 10;
    
    if (testMode) {
      console.log(`🧪 テストモード: 最初の${testLimit}件のみ削除します\n`);
      deleteTargets.splice(testLimit);
      console.log(`📊 削除対象: ${deleteTargets.reduce((sum, t) => sum + t.ids.length, 0)}件（テスト用）\n`);
    }
    
    // 削除実行（page_idとchunkIndexの組み合わせで削除）
    if (deleteTargets.length > 0) {
      console.log('🗑️ 重複チャンクを削除中...\n');
      
      let deleted = 0;
      
      for (const target of deleteTargets) {
        try {
          // page_idとchunkIndexの組み合わせで削除
          // ただし、同じIDが複数存在する場合は、個別に削除を試みる
          const deleteCondition = `\`page_id\` = ${target.pageId} AND \`chunkIndex\` = ${target.chunkIndex}`;
          
          // まず、該当するレコードを取得
          const dummyVector = new Array(768).fill(0);
          const candidates = await table.search(dummyVector).limit(10000).toArray();
          const matchingRecords = candidates.filter((r: any) => 
            Number(r.page_id) === target.pageId && Number(r.chunkIndex) === target.chunkIndex
          );
          
          // 最新以外を削除
          const recordsToDelete = matchingRecords
            .sort((a, b) => {
              const dateA = new Date(a.lastUpdated || 0).getTime();
              const dateB = new Date(b.lastUpdated || 0).getTime();
              return dateB - dateA; // 降順（新しい順）
            })
            .slice(1); // 最新以外
          
          // 個別に削除
          for (const record of recordsToDelete) {
            try {
              // idで削除を試みる
              await table.delete(`"id" = '${record.id}'`);
              deleted++;
            } catch (error: any) {
              // idでの削除が失敗した場合、page_idとchunkIndexの組み合わせで削除
              // ただし、これは最新以外のすべてを削除してしまう可能性がある
              console.warn(`  ⚠️ id削除失敗: id=${record.id}, page_id=${target.pageId}, chunkIndex=${target.chunkIndex}`);
              // この場合は、該当するすべてのレコードを取得して、最新以外を個別に削除する必要がある
              // しかし、同じIDが複数存在する場合は、別の方法が必要
            }
          }
          
          if (deleted % 50 === 0) {
            console.log(`  📊 削除進行状況: ${deleted}/${deletedCount}件`);
          }
        } catch (error: any) {
          console.warn(`  ⚠️ 削除失敗: page_id=${target.pageId}, chunkIndex=${target.chunkIndex}, error=${error.message}`);
        }
      }
      
      console.log(`\n✅ 削除完了: ${deleted}/${deletedCount}件\n`);
      
      if (testMode) {
        console.log(`🧪 テストモード: ${testLimit}件のみ削除しました`);
        console.log(`   残りの削除対象: ${deletedCount - deleted}件\n`);
      }
    }
    
    // 削除後のデータ件数を確認
    const finalCount = await table.countRows();
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 クリーニング結果:');
    console.log(`  - 削除前: ${count}件`);
    console.log(`  - 削除後: ${finalCount}件`);
    console.log(`  - 削除数: ${count - finalCount}件\n`);
    
    // 重複が残っていないか再確認
    const finalData = await table.search(dummyVector).limit(100000).toArray();
    const finalDuplicateMap = new Map<string, any[]>();
    
    finalData.forEach((record: any) => {
      const pageId = Number(record.page_id);
      const chunkIndex = Number(record.chunkIndex || 0);
      const key = `${pageId}-${chunkIndex}`;
      
      if (!finalDuplicateMap.has(key)) {
        finalDuplicateMap.set(key, []);
      }
      finalDuplicateMap.get(key)!.push(record);
    });
    
    const remainingDuplicates = Array.from(finalDuplicateMap.entries())
      .filter(([_, records]) => records.length > 1);
    
    if (remainingDuplicates.length === 0) {
      console.log('✅ 重複データのクリーニングが完了しました\n');
    } else {
      console.log(`⚠️ まだ ${remainingDuplicates.length} 件の重複が残っています\n`);
    }
    
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error('   スタック:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  });
}

