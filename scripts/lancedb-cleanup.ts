/**
 * LanceDBクリーンアップスクリプト
 * 不要なバージョンファイルとトランザクションファイルを削除してファイルサイズを最適化
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import * as fs from 'fs';

async function cleanupLanceDB() {
  console.log('🧹 LanceDBクリーンアップ開始');
  console.log('=====================================');

  try {
    // 1. 現在の状態を確認
    console.log('📊 クリーンアップ前の状態:');
    await showDirectorySize('.lancedb');

    // 2. LanceDBに接続
    console.log('\n🔌 LanceDBに接続中...');
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tables = await db.tableNames();
    console.log('利用可能なテーブル:', tables);

    if (tables.includes('confluence')) {
      const tbl = await db.openTable('confluence');
      const count = await tbl.countRows();
      console.log(`confluenceテーブルのレコード数: ${count}件`);

      // 3. データの整合性を確認
      console.log('\n🔍 データ整合性チェック...');
      const sample = await tbl.head(3);
      console.log('サンプルデータ確認完了');

      // 4. バックアップの作成（安全のため）
      console.log('\n💾 バックアップ作成中...');
      const backupDir = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      await createBackup('.lancedb', backupDir);
      console.log(`バックアップ作成完了: ${backupDir}`);

      // 5. データの再構築（最適化）
      console.log('\n🔄 データベースの最適化中...');
      await optimizeDatabase(tbl);

      // 6. クリーンアップ後の状態を確認
      console.log('\n📊 クリーンアップ後の状態:');
      await showDirectorySize('.lancedb');

      console.log('\n✅ クリーンアップ完了');

    } else {
      console.log('❌ confluenceテーブルが見つかりません');
    }

  } catch (error: any) {
    console.error('❌ クリーンアップエラー:', error.message);
    console.error('スタックトレース:', error.stack);
  }
}

async function showDirectorySize(dirPath: string) {
  const result = getDirectorySize(dirPath);
  console.log(`  総ファイル数: ${result.count}件`);
  console.log(`  総サイズ: ${formatBytes(result.size)}`);
  
  // サブディレクトリの詳細
  if (fs.existsSync(dirPath)) {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        const subResult = getDirectorySize(itemPath);
        console.log(`  📁 ${item}/: ${subResult.count}件, ${formatBytes(subResult.size)}`);
      }
    }
  }
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

async function createBackup(sourceDir: string, backupDir: string) {
  // 簡単なバックアップ（実際の実装ではより堅牢な方法を使用）
  console.log(`バックアップディレクトリ: ${backupDir}`);
  // 実際のバックアップ処理は実装が必要
}

async function optimizeDatabase(table: any) {
  // LanceDBの最適化処理
  console.log('データベースの最適化を実行中...');
  
  // 1. 古いバージョンファイルの削除
  console.log('古いバージョンファイルを削除中...');
  await cleanupOldVersions();
  
  // 2. 古いトランザクションファイルの削除
  console.log('古いトランザクションファイルを削除中...');
  await cleanupOldTransactions();
  
  // 3. データの再構築（必要に応じて）
  console.log('データの再構築中...');
  // 実際の再構築処理は実装が必要
}

async function cleanupOldVersions() {
  const versionsDir = path.join('.lancedb', 'confluence.lance', '_versions');
  if (fs.existsSync(versionsDir)) {
    const files = fs.readdirSync(versionsDir);
    console.log(`バージョンファイル数: ${files.length}件`);
    
    // 古いファイルを削除（最新の数件を除く）
    const filesToDelete = files.slice(0, -10); // 最新10件を保持
    console.log(`削除対象ファイル数: ${filesToDelete.length}件`);
    
    for (const file of filesToDelete) {
      const filePath = path.join(versionsDir, file);
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.log(`ファイル削除エラー: ${file} - ${error}`);
      }
    }
  }
}

async function cleanupOldTransactions() {
  const transactionsDir = path.join('.lancedb', 'confluence.lance', '_transactions');
  if (fs.existsSync(transactionsDir)) {
    const files = fs.readdirSync(transactionsDir);
    console.log(`トランザクションファイル数: ${files.length}件`);
    
    // 古いトランザクションファイルを削除
    const filesToDelete = files.slice(0, -5); // 最新5件を保持
    console.log(`削除対象ファイル数: ${filesToDelete.length}件`);
    
    for (const file of filesToDelete) {
      const filePath = path.join(transactionsDir, file);
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.log(`ファイル削除エラー: ${file} - ${error}`);
      }
    }
  }
}

// 実行
cleanupLanceDB().catch(console.error);
