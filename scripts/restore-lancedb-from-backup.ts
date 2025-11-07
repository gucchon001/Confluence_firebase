/**
 * バックアップからLanceDBテーブルを復元するスクリプト
 * 
 * 前提条件:
 * - バックアップファイルが存在する
 * - テーブルが既に削除されている、または空の状態
 */

import * as lancedb from '@lancedb/lancedb';
import * as arrow from 'apache-arrow';
import * as fs from 'fs';
import * as path from 'path';
import { EXTENDED_LANCEDB_SCHEMA } from '../src/lib/lancedb-schema-extended';

const BACKUP_DIR = 'backups/lancedb';
const BACKUP_FILE = path.join(BACKUP_DIR, 'confluence-backup.json');

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   LanceDBテーブルバックアップ復元スクリプト                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  try {
    // バックアップファイルの存在確認
    if (!fs.existsSync(BACKUP_FILE)) {
      console.error(`❌ バックアップファイルが見つかりません: ${BACKUP_FILE}`);
      process.exit(1);
    }
    
    console.log(`📥 バックアップファイルを読み込み中: ${BACKUP_FILE}\n`);
    
    const db = await lancedb.connect('.lancedb');
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 1: 既存のテーブルを確認・削除
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔍 Step 1: 既存のテーブルを確認中...\n');
    
    const tableNames = await db.tableNames();
    
    if (tableNames.includes('confluence')) {
      console.log('🗑️ 既存のテーブルを削除中...\n');
      try {
        await db.dropTable('confluence');
        console.log('✅ テーブル削除完了\n');
      } catch (error) {
        console.log(`⚠️ テーブル削除エラー: ${error}\n`);
      }
    } else {
      console.log('✅ テーブルは存在しません（新規作成）\n');
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 2: 新しいスキーマでテーブルを再作成
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔄 Step 2: 新しいスキーマでテーブルを再作成中...\n');
    
    // 空のデータでテーブルを作成（新しいスキーマ）
    // 注意: LanceDBはnull値からスキーマを推論できないため、空文字列や0を使用
    // 注意: 既存のコード（lancedb-client.ts）と同じ方法で作成
    const emptyData = [{
      id: 'dummy',
      vector: new Array(768).fill(0.0),
      space_key: 'dummy',  // テーブル作成時はspace_keyを使用
      title: 'dummy',
      labels: ['dummy'],
      content: 'dummy',
      page_id: 0,
      chunkIndex: 0,
      url: 'dummy',  // urlフィールドも必要
      lastUpdated: new Date().toISOString(),
      isChunked: true,
      totalChunks: 1,
      // StructuredLabelフィールド（nullではなく空文字列や0を使用）
      structured_category: '',
      structured_domain: '',
      structured_feature: '',
      structured_priority: '',
      structured_status: '',
      structured_version: '',
      structured_tags: ['dummy'],  // 空配列ではなく、少なくとも1つの要素を含む
      structured_confidence: 0.0,
      structured_content_length: 0,
      structured_is_valid: false
    }];
    
    // 通常の方法でテーブルを作成（LanceDBが自動的にスキーマを推論）
    const newTable = await db.createTable('confluence', emptyData);
    console.log('✅ 新しいテーブル作成完了\n');
    
    // ダミーデータを削除
    await newTable.delete('id = "dummy"');
    console.log('✅ ダミーデータ削除完了\n');
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 3: バックアップしたデータを復元
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('📤 Step 3: バックアップしたデータを復元中...\n');
    
    // バックアップファイルを読み込む
    const backupContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
    const restoredData = JSON.parse(backupContent);
    
    console.log(`📊 復元データ: ${restoredData.length}件\n`);
    
    // バッチ処理でデータを追加（100件ずつ）
    const batchSize = 100;
    for (let i = 0; i < restoredData.length; i += batchSize) {
      const batch = restoredData.slice(i, i + batchSize);
      
      // データを正しい形式に変換
      const formattedBatch = batch.map((row: any) => ({
        id: String(row.id),
        page_id: Number(row.page_id),
        title: String(row.title),
        content: String(row.content),
        chunkIndex: Number(row.chunkIndex),
        lastUpdated: String(row.lastUpdated),
        space_key: String(row.space_key || row.spaceKey || 'N/A'),  // テーブルではspace_keyを使用
        url: String(row.url || ''),
        labels: Array.isArray(row.labels) ? row.labels.map(String) : [],
        vector: Array.isArray(row.vector) ? row.vector.map(Number) : new Array(768).fill(0.0),
        isChunked: Boolean(row.isChunked),
        totalChunks: Number(row.totalChunks),
        // structured_*フィールド（nullの場合は空文字列や0を使用）
        structured_category: row.structured_category || '',
        structured_domain: row.structured_domain || '',
        structured_feature: row.structured_feature || '',
        structured_priority: row.structured_priority || '',
        structured_status: row.structured_status || '',
        structured_version: row.structured_version || '',
        structured_tags: Array.isArray(row.structured_tags) && row.structured_tags.length > 0 ? row.structured_tags.map(String) : ['dummy'],  // 空配列の場合はダミー要素を含む
        structured_confidence: row.structured_confidence !== undefined && row.structured_confidence !== null ? Number(row.structured_confidence) : 0.0,
        structured_content_length: row.structured_content_length !== undefined && row.structured_content_length !== null ? Number(row.structured_content_length) : 0,
        structured_is_valid: row.structured_is_valid !== undefined && row.structured_is_valid !== null ? Boolean(row.structured_is_valid) : false
      }));
      
      await newTable.add(formattedBatch);
      
      if ((i + batchSize) % 500 === 0 || i + batchSize >= restoredData.length) {
        console.log(`  ✅ ${Math.min(i + batchSize, restoredData.length)}/${restoredData.length}件を復元しました`);
      }
    }
    
    console.log('');
    console.log('✅ データ復元完了\n');
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 4: 検証
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔍 Step 4: データ検証中...\n');
    
    const finalCount = await newTable.countRows();
    console.log(`📊 最終データ件数: ${finalCount}件\n`);
    
    if (finalCount === restoredData.length) {
      console.log('✅ データ件数が一致しました（検証成功）\n');
    } else {
      console.log(`⚠️ データ件数が一致しません: 期待=${restoredData.length}, 実際=${finalCount}\n`);
    }
    
    // サンプルデータを確認
    const sampleData = await newTable.search(new Array(768).fill(0)).limit(1).toArray();
    if (sampleData.length > 0) {
      const sample = sampleData[0];
      console.log('📋 サンプルデータ:');
      console.log(`   id: ${sample.id}`);
      console.log(`   page_id: ${sample.page_id}`);
      console.log(`   title: ${sample.title?.substring(0, 50)}...`);
      console.log(`   structured_feature: ${sample.structured_feature || '空'}`);
      console.log(`   structured_domain: ${sample.structured_domain || '空'}`);
      console.log('');
    }
    
    console.log('✅ 復元完了\n');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().then(() => {
    console.log('✅ スクリプト実行完了');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  });
}

