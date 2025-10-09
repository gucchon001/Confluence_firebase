/**
 * LanceDB再構築スクリプト
 * データをエクスポートして、クリーンなデータベースを再構築
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import * as fs from 'fs';

async function rebuildLanceDB() {
  console.log('🔄 LanceDB再構築開始');
  console.log('=====================================');

  try {
    // 1. 現在のデータをエクスポート
    console.log('📤 現在のデータをエクスポート中...');
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    const allData = await tbl.query().toArray();
    console.log(`エクスポート完了: ${allData.length}件のレコード`);
    
    // 2. データをJSONファイルに保存
    const exportFile = `confluence_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(exportFile, JSON.stringify(allData, null, 2));
    console.log(`データを保存: ${exportFile}`);

    // 3. 古いデータベースをバックアップ
    console.log('💾 古いデータベースをバックアップ中...');
    const backupDir = `lancedb_backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    await copyDirectory('.lancedb', backupDir);
    console.log(`バックアップ完了: ${backupDir}`);

    // 4. 古いデータベースを削除
    console.log('🗑️ 古いデータベースを削除中...');
    await deleteDirectory('.lancedb');
    console.log('古いデータベースを削除完了');

    // 5. 新しいデータベースを作成
    console.log('🆕 新しいデータベースを作成中...');
    const newDb = await lancedb.connect(path.resolve('.lancedb'));
    
    // スキーマを定義
    const schema = {
      id: 'utf8',
      vector: { 
        type: 'fixed_size_list', 
        listSize: 768, 
        field: { type: 'float32' } 
      },
      pageId: 'int64',
      chunkIndex: 'int32',
      space_key: 'utf8',
      title: 'utf8',
      content: 'utf8',
      url: 'utf8',
      lastUpdated: 'utf8',
      labels: { type: 'list', field: { type: 'utf8' } }
    };

    // データを準備（ベクトルを正しい形式に変換）
    const preparedData = allData.map((record: any) => ({
      id: record.id,
      vector: Array.isArray(record.vector) ? record.vector : [],
      pageId: record.pageId,
      chunkIndex: record.chunkIndex,
      space_key: record.space_key,
      title: record.title,
      content: record.content,
      url: record.url,
      lastUpdated: record.lastUpdated,
      labels: Array.isArray(record.labels) ? record.labels : []
    }));

    // テーブルを作成
    await newDb.createTable('confluence', preparedData, { schema });
    console.log('新しいデータベース作成完了');

    // 6. 検証
    console.log('🔍 データベース検証中...');
    const newTbl = await newDb.openTable('confluence');
    const newCount = await newTbl.countRows();
    console.log(`新しいデータベースのレコード数: ${newCount}件`);

    // 7. ファイルサイズを確認
    console.log('📊 再構築後のファイルサイズ:');
    await showDirectorySize('.lancedb');

    console.log('\n✅ 再構築完了');
    console.log(`📁 バックアップ: ${backupDir}`);
    console.log(`📄 エクスポートファイル: ${exportFile}`);

  } catch (error: any) {
    console.error('❌ 再構築エラー:', error.message);
    console.error('スタックトレース:', error.stack);
  }
}

async function copyDirectory(source: string, destination: string) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const items = fs.readdirSync(source);
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    const stats = fs.statSync(sourcePath);

    if (stats.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

async function deleteDirectory(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        await deleteDirectory(itemPath);
      } else {
        fs.unlinkSync(itemPath);
      }
    }
    fs.rmdirSync(dirPath);
  }
}

async function showDirectorySize(dirPath: string) {
  const result = getDirectorySize(dirPath);
  console.log(`  総ファイル数: ${result.count}件`);
  console.log(`  総サイズ: ${formatBytes(result.size)}`);
}

function getDirectorySize(dirPath: string): { size: number; count: number } {
  let totalSize = 0;
  let fileCount = 0;
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        const subResult = getDirectorySize(itemPath);
        totalSize += subResult.size;
        fileCount += subResult.count;
      } else {
        totalSize += stats.size;
        fileCount++;
      }
    }
  } catch (error) {
    console.log(`エラー: ${dirPath} - ${error}`);
  }
  
  return { size: totalSize, count: fileCount };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 実行
rebuildLanceDB().catch(console.error);
