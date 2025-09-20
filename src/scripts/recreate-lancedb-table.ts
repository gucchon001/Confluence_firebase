/**
 * LanceDBテーブルを削除して完全なスキーマで再作成するスクリプト
 */
import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import * as lancedb from '@lancedb/lancedb';
import { createConfluenceSampleData } from '../lib/lancedb-schema';

async function recreateLanceDBTable() {
  try {
    console.log('LanceDBテーブルを削除して完全なスキーマで再作成します...');
    
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`LanceDB接続先: ${dbPath}`);
    
    const db = await lancedb.connect(dbPath);
    
    // テーブル存在確認
    const tableNames = await db.tableNames();
    console.log('既存のテーブル:', tableNames);
    
    const tableName = 'confluence';
    
    // テーブルが存在する場合は削除
    if (tableNames.includes(tableName)) {
      console.log(`テーブル '${tableName}' を削除します...`);
      await db.dropTable(tableName);
      console.log(`テーブル '${tableName}' を削除しました`);
    }
    
    // 完全なスキーマでテーブルを再作成（pageId は Int64）
    console.log(`完全なスキーマでテーブル '${tableName}' を作成します...`);
    const sampleData = [createConfluenceSampleData()] as unknown as Record<string, unknown>[];
    const tbl = await db.createTable(tableName, sampleData);
    
    // サンプルデータを削除
    await tbl.delete("id = 'sample-1'");
    
    console.log(`テーブル '${tableName}' を完全なスキーマで再作成しました`);
    
    // 最後の同期時刻を削除して完全同期を強制する
    const syncFilePath = path.resolve(process.cwd(), '.last_sync_time.json');
    if (fs.existsSync(syncFilePath)) {
      fs.unlinkSync(syncFilePath);
      console.log('最後の同期時刻ファイルを削除しました。次回の同期は完全同期になります。');
    }
    
    console.log('完了しました。次のコマンドを実行して完全同期を行ってください:');
    console.log('npm run sync-confluence -- --all');
    
  } catch (error: any) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
  }
}

recreateLanceDBTable();
