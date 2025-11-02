/**
 * pageId → page_id マイグレーションスクリプト
 * 
 * 目的: 
 * - 既存のLanceDBデータをpageIdフィールドからpage_idフィールドに移行
 * - スカラーインデックスを作成してパフォーマンスを向上
 * 
 * 使用方法:
 * ```bash
 * npm run migrate:pageid-to-page-id
 * ```
 * 
 * 注意事項:
 * - このスクリプトは既存データを変更します。実行前にバックアップを推奨します
 * - マイグレーションには時間がかかる場合があります（データ量に応じて）
 */

import * as lancedb from '@lancedb/lancedb';
import * as arrow from 'apache-arrow';
import * as path from 'path';
import * as fs from 'fs';

const DB_PATH = path.resolve(process.cwd(), '.lancedb');
const TABLE_NAME = 'confluence';
const BACKUP_SUFFIX = `.backup-${Date.now()}`;

/**
 * 新しいスキーマ定義（page_idフィールドを使用）
 */
const NEW_SCHEMA = new arrow.Schema([
  new arrow.Field('id', new arrow.Utf8(), false),
  new arrow.Field('page_id', new arrow.Int64(), false),  // pageId → page_id
  new arrow.Field('title', new arrow.Utf8(), false),
  new arrow.Field('content', new arrow.Utf8(), false),
  new arrow.Field(
    'vector',
    new arrow.FixedSizeList(768, new arrow.Field('item', new arrow.Float32())),
    false
  ),
  new arrow.Field('chunkIndex', new arrow.Int32(), false),
  new arrow.Field('space_key', new arrow.Utf8(), false),
  new arrow.Field('url', new arrow.Utf8(), false),
  new arrow.Field('lastUpdated', new arrow.Utf8(), false),
  new arrow.Field('labels', new arrow.List(new arrow.Field('item', new arrow.Utf8())), false),
]);

interface MigrationStats {
  totalRows: number;
  migratedRows: number;
  failedRows: number;
  startTime: number;
  endTime?: number;
}

async function migratePageIdToPageId() {
  const stats: MigrationStats = {
    totalRows: 0,
    migratedRows: 0,
    failedRows: 0,
    startTime: Date.now(),
  };

  console.log('🚀 pageId → page_id マイグレーション開始...\n');
  console.log(`📂 データベースパス: ${DB_PATH}`);
  console.log(`📋 テーブル名: ${TABLE_NAME}\n`);

  try {
    // 1. データベース接続確認
    if (!fs.existsSync(DB_PATH)) {
      console.error(`❌ データベースディレクトリが見つかりません: ${DB_PATH}`);
      process.exit(1);
    }

    console.log('📂 データベースに接続中...');
    const db = await lancedb.connect(DB_PATH);
    console.log('✅ データベース接続成功\n');

    // 2. 既存テーブルを開く
    console.log(`📋 既存テーブル '${TABLE_NAME}' を開く...`);
    let oldTable;
    try {
      oldTable = await db.openTable(TABLE_NAME);
      console.log('✅ テーブルオープン成功\n');
    } catch (error: any) {
      console.error(`❌ テーブル '${TABLE_NAME}' が存在しません`);
      console.error(`   エラー: ${error.message}`);
      process.exit(1);
    }

    // 3. データ統計情報を取得
    stats.totalRows = await oldTable.countRows();
    console.log(`📊 テーブル統計:`);
    console.log(`   - 総行数: ${stats.totalRows.toLocaleString()}行\n`);

    if (stats.totalRows === 0) {
      console.log('⚠️ テーブルにデータがありません。マイグレーションをスキップします。');
      return;
    }

    // 4. バックアップ（オプション）
    console.log('💾 バックアップ作成中...');
    const backupPath = `${DB_PATH}${BACKUP_SUFFIX}`;
    try {
      fs.cpSync(DB_PATH, backupPath, { recursive: true });
      console.log(`✅ バックアップ作成完了: ${backupPath}\n`);
    } catch (error: any) {
      console.warn(`⚠️ バックアップ作成に失敗しました: ${error.message}`);
      console.warn(`   続行しますが、リスクがあります...\n`);
    }

    // 5. 既存データを読み込む（バッチ処理）
    console.log('📥 既存データを読み込み中...');
    const readStartTime = Date.now();
    
    // 全データを読み込む（大きなデータセットの場合はバッチ処理が必要）
    const allData = await oldTable.query().limit(stats.totalRows).toArray();
    const readDuration = Date.now() - readStartTime;
    console.log(`✅ データ読み込み完了: ${allData.length}行 (${(readDuration / 1000).toFixed(2)}秒)\n`);

    // 6. データを変換（pageId → page_id）
    console.log('🔄 データ変換中 (pageId → page_id)...');
    const transformStartTime = Date.now();
    
    const transformedData = allData.map((row: any, index: number) => {
      try {
        // pageIdからpage_idに変換
        const pageId = row.pageId ?? row.page_id ?? null;
        
        if (pageId === null || pageId === undefined) {
          console.warn(`⚠️ 行${index}: pageId/page_idが見つかりません`);
          stats.failedRows++;
          return null;
        }

        // 新しいデータ構造を作成
        const newRow: any = {
          id: String(row.id ?? ''),
          page_id: typeof pageId === 'bigint' ? pageId : BigInt(Number(pageId)),  // page_idに変換
          title: String(row.title ?? ''),
          content: String(row.content ?? ''),
          vector: Array.isArray(row.vector) 
            ? row.vector.map((v: any) => Number(v)) 
            : new Array(768).fill(0.0),
          chunkIndex: Number(row.chunkIndex ?? 0),
          space_key: String(row.space_key ?? ''),
          url: String(row.url ?? ''),
          lastUpdated: String(row.lastUpdated ?? new Date().toISOString()),
          labels: Array.isArray(row.labels) 
            ? row.labels.map((l: any) => String(l)) 
            : [],
        };

        stats.migratedRows++;
        return newRow;
      } catch (error: any) {
        console.warn(`⚠️ 行${index}の変換に失敗: ${error.message}`);
        stats.failedRows++;
        return null;
      }
    }).filter((row: any) => row !== null);

    const transformDuration = Date.now() - transformStartTime;
    console.log(`✅ データ変換完了: ${transformedData.length}行 (${(transformDuration / 1000).toFixed(2)}秒)`);
    console.log(`   - 成功: ${stats.migratedRows}行`);
    console.log(`   - 失敗: ${stats.failedRows}行\n`);

    if (transformedData.length === 0) {
      console.error('❌ 変換可能なデータがありません。マイグレーションを中止します。');
      process.exit(1);
    }

    // 7. 古いテーブルを削除（またはリネーム）
    console.log(`🗑️ 古いテーブル '${TABLE_NAME}' を削除中...`);
    try {
      await db.dropTable(TABLE_NAME);
      console.log('✅ 古いテーブル削除完了\n');
    } catch (error: any) {
      console.warn(`⚠️ テーブル削除に失敗しました: ${error.message}`);
      console.warn(`   続行しますが、エラーが発生する可能性があります...\n`);
    }

    // 8. 新しいテーブルを作成
    console.log(`✨ 新しいテーブル '${TABLE_NAME}' を作成中...`);
    const createStartTime = Date.now();
    
    const newTable = await db.createTable(TABLE_NAME, transformedData, { schema: NEW_SCHEMA });
    const createDuration = Date.now() - createStartTime;
    console.log(`✅ 新しいテーブル作成完了 (${(createDuration / 1000).toFixed(2)}秒)\n`);

    // 9. 検証: データ数とスキーマを確認
    console.log('🔍 マイグレーション検証中...');
    const verifyRowCount = await newTable.countRows();
    const sampleData = await newTable.query().limit(1).toArray();
    
    if (sampleData.length > 0) {
      const fields = Object.keys(sampleData[0]);
      const hasPageId = fields.includes('page_id');
      const hasOldPageId = fields.includes('pageId');
      
      console.log(`   - 総行数: ${verifyRowCount.toLocaleString()}行`);
      console.log(`   - フィールド: ${fields.join(', ')}`);
      console.log(`   - page_idフィールド: ${hasPageId ? '✅' : '❌'}`);
      console.log(`   - pageIdフィールド: ${hasOldPageId ? '⚠️ 残存（要確認）' : '✅ なし'}\n`);
    }

    // 10. スカラーインデックスを作成
    console.log('🔧 スカラーインデックス作成中...');
    const indexStartTime = Date.now();
    
    try {
      await newTable.createIndex('page_id');
      console.log('   ✅ page_idスカラーインデックス作成完了');
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('already exists') || errorMessage.includes('既に存在')) {
        console.log('   ✅ page_idスカラーインデックスは既に存在します');
      } else {
        console.warn(`   ⚠️ page_idスカラーインデックス作成失敗: ${errorMessage.substring(0, 150)}`);
      }
    }

    // idインデックスも作成
    try {
      await newTable.createIndex('id');
      console.log('   ✅ idスカラーインデックス作成完了');
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('already exists') || errorMessage.includes('既に存在')) {
        console.log('   ✅ idスカラーインデックスは既に存在します');
      } else {
        console.warn(`   ⚠️ idスカラーインデックス作成失敗: ${errorMessage.substring(0, 150)}`);
      }
    }

    const indexDuration = Date.now() - indexStartTime;
    console.log(`   ⏱️ スカラーインデックス作成時間: ${(indexDuration / 1000).toFixed(2)}秒\n`);

    // 11. パフォーマンステスト
    console.log('🧪 パフォーマンステスト実行中...');
    if (sampleData.length > 0) {
      const testPageId = Number(sampleData[0].page_id);
      if (!isNaN(testPageId)) {
        const perfStartTime = Date.now();
        const testResults = await newTable
          .query()
          .where(`\`page_id\` = ${testPageId}`)
          .limit(1000)
          .toArray();
        const perfDuration = Date.now() - perfStartTime;
        
        console.log(`   ✅ クエリテスト完了: ${testResults.length}結果を${perfDuration}msで取得`);
        if (perfDuration < 100) {
          console.log('   🎉 素晴らしい！クエリが高速です（< 100ms）');
        } else if (perfDuration < 1000) {
          console.log('   ✅ 良好です（< 1秒）');
        } else {
          console.warn(`   ⚠️ やや遅いです（${perfDuration}ms）。インデックスを確認してください`);
        }
      }
    }
    console.log();

    // 12. 完了
    stats.endTime = Date.now();
    const totalDuration = (stats.endTime - stats.startTime) / 1000;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ マイグレーション完了！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 マイグレーション統計:');
    console.log(`   - 総行数: ${stats.totalRows.toLocaleString()}行`);
    console.log(`   - 移行成功: ${stats.migratedRows.toLocaleString()}行`);
    console.log(`   - 移行失敗: ${stats.failedRows.toLocaleString()}行`);
    console.log(`   - 総時間: ${totalDuration.toFixed(2)}秒`);
    console.log(`   - バックアップ: ${backupPath}\n`);

    if (stats.failedRows > 0) {
      console.warn(`⚠️ 警告: ${stats.failedRows}行の移行に失敗しました。バックアップを確認してください。`);
    }

    console.log('💡 次のステップ:');
    console.log('   1. アプリケーションを再起動して、新しいスキーマを確認');
    console.log('   2. パフォーマンステストを実行（npm run test:get-all-chunks-page-id）');
    console.log('   3. 問題がなければ、バックアップを削除できます');
    console.log();

  } catch (error: any) {
    console.error('❌ マイグレーションエラー:', error);
    console.error('   スタック:', error.stack);
    console.error('\n💡 バックアップから復元する場合は、以下を実行してください:');
    console.error(`   - バックアップパス: ${DB_PATH}${BACKUP_SUFFIX}`);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  migratePageIdToPageId()
    .then(() => {
      console.log('✅ スクリプト完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ スクリプトエラー:', error);
      process.exit(1);
    });
}

export { migratePageIdToPageId };

