/**
 * 重複を除去したLanceDBテーブルを再構築するスクリプト
 */

import * as lancedb from '@lancedb/lancedb';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   重複除去テーブル再構築スクリプト                                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    
    // 現在のデータ件数を確認
    const beforeCount = await table.countRows();
    console.log(`📊 現在のデータ件数: ${beforeCount}件\n`);
    
    if (beforeCount === 0) {
      console.log('⚠️ データが存在しません\n');
      return;
    }
    
    // 全データを取得
    console.log('🔍 データを取得中...\n');
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(100000).toArray();
    
    // 重複を検出（page_idとchunkIndexの組み合わせ）
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
    
    // 重複を除去したデータを収集（各キーで最新のみを保持）
    const uniqueData: any[] = [];
    let duplicateCount = 0;
    let removedCount = 0;
    
    duplicateMap.forEach((records, key) => {
      if (records.length > 1) {
        // 重複がある場合、最新（lastUpdatedが新しい）のみを保持
        records.sort((a, b) => {
          const dateA = new Date(a.lastUpdated || 0).getTime();
          const dateB = new Date(b.lastUpdated || 0).getTime();
          return dateB - dateA; // 降順（新しい順）
        });
        
        uniqueData.push(records[0]); // 最新のみ
        duplicateCount++;
        removedCount += records.length - 1;
      } else {
        // 重複がない場合、そのまま追加
        uniqueData.push(records[0]);
      }
    });
    
    console.log('📊 重複分析結果:');
    console.log(`  - 総データ件数: ${allData.length}件`);
    console.log(`  - 重複キー数: ${duplicateCount}件`);
    console.log(`  - 削除対象チャンク数: ${removedCount}件`);
    console.log(`  - 重複除去後のデータ件数: ${uniqueData.length}件\n`);
    
    // バックアップを作成
    const backupDir = path.resolve(process.cwd(), 'backups/lancedb');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupPath = path.join(backupDir, `confluence-backup-${Date.now()}.json`);
    console.log(`💾 バックアップを作成中: ${backupPath}\n`);
    
    // BigIntをJSONに変換するためのreplacer
    const replacer = (key: string, value: any) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    };
    
    fs.writeFileSync(backupPath, JSON.stringify(allData, replacer, 2));
    console.log(`✅ バックアップ完了: ${allData.length}件\n`);
    
    // 既存テーブルをバックアップ名に変更
    const backupTableName = `confluence_backup_${Date.now()}`;
    console.log(`📋 既存テーブルをバックアップ名に変更: ${backupTableName}\n`);
    
    try {
      // テーブル名を変更（LanceDBでは直接的な名前変更がないため、データをコピー）
      const oldTable = await db.openTable('confluence');
      const oldData = await oldTable.search(dummyVector).limit(100000).toArray();
      await db.createTable(backupTableName, oldData);
      console.log(`✅ バックアップテーブル作成完了: ${oldData.length}件\n`);
    } catch (error: any) {
      console.warn(`⚠️ バックアップテーブル作成失敗（続行）: ${error.message}\n`);
    }
    
    // 既存テーブルを削除
    console.log('🗑️ 既存テーブルを削除中...\n');
    try {
      await db.dropTable('confluence');
      console.log('✅ 既存テーブル削除完了\n');
    } catch (error: any) {
      console.warn(`⚠️ テーブル削除失敗（続行）: ${error.message}\n`);
      // 削除に失敗した場合、テーブルディレクトリを手動で削除
      const tablePath = path.resolve(process.cwd(), '.lancedb', 'confluence');
      if (fs.existsSync(tablePath)) {
        console.log(`📂 テーブルディレクトリを手動削除中: ${tablePath}\n`);
        try {
          fs.rmSync(tablePath, { recursive: true, force: true });
          console.log('✅ テーブルディレクトリ削除完了\n');
        } catch (dirError: any) {
          console.warn(`⚠️ ディレクトリ削除失敗: ${dirError.message}\n`);
          console.log('💡 手動でテーブルディレクトリを削除してください\n');
        }
      }
    }
    
    // 新しいテーブルを作成（重複を除去したデータで）
    console.log('🔨 新しいテーブルを作成中...\n');
    const newTable = await db.createTable('confluence', uniqueData);
    console.log(`✅ 新しいテーブル作成完了: ${uniqueData.length}件\n`);
    
    // データ件数を確認
    const afterCount = await newTable.countRows();
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 再構築結果:');
    console.log(`  - 再構築前: ${beforeCount}件`);
    console.log(`  - 再構築後: ${afterCount}件`);
    console.log(`  - 削除数: ${beforeCount - afterCount}件`);
    console.log(`  - 削除率: ${((beforeCount - afterCount) / beforeCount * 100).toFixed(1)}%\n`);
    
    // 重複が残っていないか確認
    const finalData = await newTable.search(dummyVector).limit(100000).toArray();
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
      console.log('✅ 重複データの除去が完了しました\n');
    } else {
      console.log(`⚠️ ${remainingDuplicates.length}件の重複がまだ残っています\n`);
    }
    
    // インデックス再作成の案内
    console.log('💡 次のステップ:');
    console.log('   1. インデックスを再作成: npm run lancedb:create-indexes');
    console.log('   2. 動作確認: npm run verify:extended-schema');
    console.log('   3. 本番環境にアップロード: npm run upload:production-data\n');
    
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

