/**
 * LanceDBテーブルのインデックスを作成するスクリプト
 * 
 * 使用方法:
 * ```bash
 * npm run lancedb:create-indexes
 * ```
 * 
 * 機能:
 * - Confluenceテーブルのベクトルインデックス（IVF_PQ）作成
 * - Confluenceテーブルのスカラーインデックス（page_id）作成
 * - Jiraテーブルのベクトルインデックス（IVF_PQ）作成（存在する場合）
 * - Jiraテーブルのスカラーインデックス（issue_key）作成（存在する場合）
 */

import 'dotenv/config';
import { connect, Index } from '@lancedb/lancedb';
import * as path from 'path';
import * as fs from 'fs';

const LOCAL_LANCEDB_PATH = path.join(process.cwd(), '.lancedb');

/**
 * テーブルのインデックスを作成
 */
async function createIndexesForTable(
  db: any,
  tableName: string
): Promise<void> {
  console.log(`\n📊 テーブル '${tableName}' のインデックスを作成中...`);

  try {
    const table = await db.openTable(tableName);
    const rowCount = await table.countRows();
    console.log(`   📄 レコード数: ${rowCount.toLocaleString()}件`);

    // ベクトルインデックス（IVF_PQ）を作成
    console.log(`   🔧 ベクトルインデックス（IVF_PQ）を作成中...`);
    const vectorStart = Date.now();
    try {
      await table.createIndex('vector', {
        config: Index.ivfPq({
          numPartitions: 256,
          numSubVectors: 16
        })
      });
      const vectorDuration = ((Date.now() - vectorStart) / 1000).toFixed(2);
      console.log(`   ✅ ベクトルインデックス作成完了（${vectorDuration}秒）`);
    } catch (vectorError: any) {
      const errorMessage = vectorError?.message || String(vectorError);
      if (errorMessage.includes('already exists') || errorMessage.includes('既に存在')) {
        console.log(`   ✅ ベクトルインデックスは既に存在します`);
      } else {
        console.warn(`   ⚠️  ベクトルインデックス作成失敗: ${errorMessage.substring(0, 150)}`);
      }
    }

    // スカラーインデックスを作成（テーブルごとに異なるフィールド）
    let scalarField: string | null = null;
    if (tableName === 'confluence') {
      scalarField = 'page_id';
    } else if (tableName === 'jira_issues') {
      scalarField = 'issue_key';
    }

    if (scalarField) {
      console.log(`   🔧 スカラーインデックス（${scalarField}）を作成中...`);
      const scalarStart = Date.now();
      try {
        await table.createIndex(scalarField);
        const scalarDuration = ((Date.now() - scalarStart) / 1000).toFixed(2);
        console.log(`   ✅ スカラーインデックス作成完了（${scalarDuration}秒）`);
      } catch (scalarError: any) {
        const errorMessage = scalarError?.message || String(scalarError);
        if (errorMessage.includes('already exists') || errorMessage.includes('既に存在')) {
          console.log(`   ✅ スカラーインデックスは既に存在します`);
        } else {
          console.warn(`   ⚠️  スカラーインデックス作成失敗: ${errorMessage.substring(0, 150)}`);
        }
      }
    } else {
      console.log(`   ⚠️  スカラーインデックス対象フィールドが定義されていません（${tableName}）`);
    }

    console.log(`   ✅ テーブル '${tableName}' のインデックス作成完了`);

  } catch (error: any) {
    console.error(`   ❌ テーブル '${tableName}' のインデックス作成中にエラーが発生しました:`);
    console.error(`      ${error.message}`);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(80));
  console.log('🔧 LanceDBインデックス作成');
  console.log('='.repeat(80));
  console.log(`   Database: ${LOCAL_LANCEDB_PATH}\n`);

  try {
    // ローカルLanceDBディレクトリの存在確認
    if (!fs.existsSync(LOCAL_LANCEDB_PATH)) {
      throw new Error(`LanceDBディレクトリが存在しません: ${LOCAL_LANCEDB_PATH}`);
    }

    // LanceDBに接続
    console.log('📊 ローカルのLanceDBテーブルを検出中...\n');
    const db = await connect(LOCAL_LANCEDB_PATH);
    let tableNames: string[] = [];
    
    try {
      tableNames = await db.tableNames();
      console.log(`   ✅ ${tableNames.length}個のテーブルが見つかりました:`);
      tableNames.forEach(name => console.log(`      - ${name}`));
    } catch (error: any) {
      console.warn(`   ⚠️  LanceDBへの接続に失敗しました: ${error.message}`);
      console.warn(`   ⚠️  ディレクトリから直接テーブルを検出します...`);
      
      // ディレクトリから直接検出
      const dirs = fs.readdirSync(LOCAL_LANCEDB_PATH).filter(item => {
        const itemPath = path.join(LOCAL_LANCEDB_PATH, item);
        return fs.statSync(itemPath).isDirectory() && item.endsWith('.lance');
      });
      tableNames = dirs.map(dir => dir.replace('.lance', ''));
      console.log(`   ✅ ${tableNames.length}個のテーブルが見つかりました:`);
      tableNames.forEach(name => console.log(`      - ${name}`));
    }

    if (tableNames.length === 0) {
      throw new Error('インデックスを作成するテーブルが見つかりません');
    }

    // 各テーブルのインデックスを作成
    for (const tableName of tableNames) {
      await createIndexesForTable(db, tableName);
    }

    // サマリー
    console.log('\n' + '='.repeat(80));
    console.log('📊 Index Creation Summary');
    console.log('='.repeat(80));
    console.log(`   ✅ 処理したテーブル数: ${tableNames.length}`);
    tableNames.forEach(name => console.log(`      - ${name}`));
    console.log('='.repeat(80) + '\n');

    console.log('✅ LanceDBインデックス作成が完了しました!\n');

  } catch (error: any) {
    console.error('\n❌ Error creating indexes:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n   Stack trace:\n${error.stack}`);
    }
    throw error;
  }
}

// スクリプト実行
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { main as createLanceDBIndexes };

