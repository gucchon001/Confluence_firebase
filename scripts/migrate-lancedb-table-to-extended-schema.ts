/**
 * LanceDBテーブルを拡張スキーマ（StructuredLabel対応）に移行するスクリプト
 * 
 * 手順:
 * 1. 既存のテーブルデータをバックアップ
 * 2. テーブルを削除
 * 3. 新しいスキーマ（structured_*フィールドを含む）でテーブルを再作成
 * 4. バックアップしたデータを復元（structured_*フィールドはnull）
 */

import * as lancedb from '@lancedb/lancedb';
import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = '.lancedb-backup';
const BACKUP_FILE = path.join(BACKUP_DIR, 'confluence-backup.json');

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   LanceDBテーブル拡張スキーマ移行スクリプト                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  try {
    const db = await lancedb.connect('.lancedb');
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 1: 既存のテーブルデータをバックアップ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('📥 Step 1: 既存のテーブルデータをバックアップ中...\n');
    
    const table = await db.openTable('confluence');
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(100000).toArray();
    
    console.log(`✅ ${allData.length}件のデータを取得しました\n`);
    
    // バックアップディレクトリを作成
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    // データをJSON形式で保存
    const backupData = allData.map((row: any) => {
      // BigIntをNumberに変換するヘルパー関数
      const toNumber = (value: any): number => {
        if (typeof value === 'bigint') {
          return Number(value);
        }
        if (typeof value === 'number') {
          return value;
        }
        if (typeof value === 'string') {
          const parsed = parseInt(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };
      
      // structured_*フィールドがない場合はundefinedにする
      return {
        id: String(row.id),
        page_id: toNumber(row.page_id || row.pageId || String(row.id).split('-')[0]),
        title: String(row.title || ''),
        content: String(row.content || ''),
        chunkIndex: toNumber(row.chunkIndex || 0),
        lastUpdated: String(row.lastUpdated || new Date().toISOString()),
        space_key: String(row.space_key || row.spaceKey || 'N/A'),
        url: String(row.url || ''),
        labels: Array.isArray(row.labels) ? row.labels.map(String) : [],
        vector: Array.isArray(row.vector) ? row.vector.map((v: any) => toNumber(v)) : new Array(768).fill(0.0),
        isChunked: Boolean(row.isChunked !== undefined ? row.isChunked : true),
        totalChunks: toNumber(row.totalChunks || 1),
        // structured_*フィールドはnull（既存データには存在しない）
        structured_category: null,
        structured_domain: null,
        structured_feature: null,
        structured_priority: null,
        structured_status: null,
        structured_version: null,
        structured_tags: null,
        structured_confidence: null,
        structured_content_length: null,
        structured_is_valid: null
      };
    });
    
    // BigIntをNumberに変換するカスタムreplacer関数
    const replacer = (key: string, value: any) => {
      if (typeof value === 'bigint') {
        return Number(value);
      }
      return value;
    };
    
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, replacer, 2), 'utf-8');
    console.log(`✅ バックアップ完了: ${BACKUP_FILE} (${backupData.length}件)\n`);
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 2: 既存のテーブルを削除
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🗑️ Step 2: 既存のテーブルを削除中...\n');
    
    try {
      await db.dropTable('confluence');
      console.log('✅ テーブル削除完了\n');
    } catch (error) {
      console.log(`⚠️ テーブル削除エラー（既に存在しない可能性があります）: ${error}\n`);
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 3: 新しいスキーマでテーブルを再作成
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔄 Step 3: 新しいスキーマでテーブルを再作成中...\n');
    
    // 空のデータでテーブルを作成（新しいスキーマ）
    // 注意: LanceDBはnull値からスキーマを推論できないため、空文字列や0を使用
    const emptyData = [{
      id: 'dummy',
      vector: new Array(768).fill(0.0),
      space_key: 'dummy',
      title: 'dummy',
      labels: ['dummy'],
      content: 'dummy',
      page_id: 0,
      chunkIndex: 0,
      url: 'dummy',
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
      structured_tags: [],
      structured_confidence: 0.0,
      structured_content_length: 0,
      structured_is_valid: false
    }];
    
    const newTable = await db.createTable('confluence', emptyData);
    console.log('✅ 新しいテーブル作成完了\n');
    
    // ダミーデータを削除
    await newTable.delete('id = "dummy"');
    console.log('✅ ダミーデータ削除完了\n');
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 4: バックアップしたデータを復元
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('📤 Step 4: バックアップしたデータを復元中...\n');
    
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
        space_key: String(row.space_key),
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
        structured_tags: Array.isArray(row.structured_tags) && row.structured_tags.length > 0 ? row.structured_tags.map(String) : [],
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
    // Step 5: 検証
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔍 Step 5: データ検証中...\n');
    
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
      console.log(`   structured_feature: ${sample.structured_feature || 'null'}`);
      console.log(`   structured_domain: ${sample.structured_domain || 'null'}`);
      console.log('');
    }
    
    console.log('✅ 移行完了\n');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    console.error('');
    console.error('⚠️ バックアップファイルは以下の場所に保存されています:');
    console.error(`   ${BACKUP_FILE}`);
    console.error('');
    console.error('手動で復元する場合は、以下のコマンドを実行してください:');
    console.error('   npm run restore:lancedb-backup');
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

