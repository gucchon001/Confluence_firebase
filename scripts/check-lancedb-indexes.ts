/**
 * LanceDBインデックスの有無を確認するスクリプト
 * 
 * 目的: ベクトル検索のパフォーマンス問題の原因切り分け
 * - インデックスが存在するか確認
 * - インデックスの種類とパラメータを表示
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function checkLanceDBIndexes() {
  console.log('🔍 LanceDBインデックス確認開始...\n');
  
  try {
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`📂 LanceDB接続中: ${dbPath}`);
    
    if (!require('fs').existsSync(dbPath)) {
      console.error(`❌ LanceDBディレクトリが見つかりません: ${dbPath}`);
      process.exit(1);
    }
    
    const db = await lancedb.connect(dbPath);
    console.log('✅ LanceDB接続成功\n');
    
    // テーブルを開く
    const tableName = 'confluence';
    console.log(`📋 テーブルを開く: ${tableName}`);
    
    let table;
    try {
      table = await db.openTable(tableName);
      console.log('✅ テーブルオープン成功\n');
    } catch (error: any) {
      console.error(`❌ テーブル '${tableName}' が存在しません`);
      console.error(`   エラー: ${error.message}`);
      process.exit(1);
    }
    
    // テーブル統計情報
    const rowCount = await table.countRows();
    console.log(`📊 テーブル統計:`);
    console.log(`   - 総行数: ${rowCount.toLocaleString()}行\n`);
    
    // インデックス情報の取得
    // 注意: LanceDBのAPIでは、直接インデックス情報を取得する方法が限定的
    // スキーマから推測するか、インデックス作成を試みてエラーから判断する
    
    console.log('🔍 インデックス確認中...\n');
    
    // 方法1: インデックス作成を試みる（既に存在する場合はエラーになる）
    console.log('   方法1: ベクトルインデックスの存在確認...');
    let vectorIndexExists = false;
    try {
      // 小さなパラメータでインデックス作成を試みる
      // 既に存在する場合はエラーが返される
      await table.createIndex('vector', {
        config: lancedb.Index.ivfPq({
          numPartitions: 16, // 最小値で試行
          numSubVectors: 96
        })
      });
      // エラーなく完了した場合、インデックスが作成された
      console.log('   ⚠️  ベクトルインデックスが存在しませんでした → 作成しました（小規模テスト用）');
      vectorIndexExists = false;
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('already exists') || 
          errorMessage.includes('既に存在') ||
          errorMessage.includes('duplicate')) {
        console.log('   ✅ ベクトルインデックスが既に存在します');
        vectorIndexExists = true;
      } else {
        // その他のエラーの場合は詳細を表示
        console.log(`   ⚠️  確認中にエラー: ${errorMessage}`);
        console.log('   → インデックスの状態が不明です。詳細な調査が必要です。');
        vectorIndexExists = false;
      }
    }
    
    // 方法2: スカラーインデックスの確認
    console.log('\n   方法2: スカラーインデックスの確認...');
    let pageIdIndexExists = false;
    let idIndexExists = false;
    
    try {
      await table.createIndex('pageId');
      console.log('   ⚠️  pageIdインデックスが存在しませんでした → 作成しました');
      pageIdIndexExists = false;
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('already exists') || 
          errorMessage.includes('既に存在') ||
          errorMessage.includes('duplicate')) {
        console.log('   ✅ pageIdインデックスが既に存在します');
        pageIdIndexExists = true;
      } else {
        console.log(`   ⚠️  pageIdインデックス確認エラー: ${errorMessage}`);
      }
    }
    
    try {
      await table.createIndex('id');
      console.log('   ⚠️  idインデックスが存在しませんでした → 作成しました');
      idIndexExists = false;
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('already exists') || 
          errorMessage.includes('既に存在') ||
          errorMessage.includes('duplicate')) {
        console.log('   ✅ idインデックスが既に存在します');
        idIndexExists = true;
      } else {
        console.log(`   ⚠️  idインデックス確認エラー: ${errorMessage}`);
      }
    }
    
    // 結果サマリー
    console.log('\n' + '━'.repeat(60));
    console.log('📊 インデックス確認結果サマリー');
    console.log('━'.repeat(60));
    console.log(`ベクトルインデックス (vector):  ${vectorIndexExists ? '✅ 存在' : '❌ 不在'}`);
    console.log(`スカラーインデックス (pageId):   ${pageIdIndexExists ? '✅ 存在' : '⚠️  不在'}`);
    console.log(`スカラーインデックス (id):      ${idIndexExists ? '✅ 存在' : '⚠️  不在'}`);
    console.log('━'.repeat(60));
    
    // 推奨アクション
    console.log('\n💡 推奨アクション:');
    
    if (!vectorIndexExists) {
      console.log('\n   🚨 **重要**: ベクトルインデックスが存在しません！');
      console.log('      これがパフォーマンス問題（5.8秒）の原因である可能性が非常に高いです。');
      console.log('\n   次のステップ:');
      console.log('   1. インデックスを作成: npm run lancedb:create-indexes');
      console.log('   2. または、scripts/create-lancedb-indexes.ts を直接実行');
      console.log('   3. インデックス作成後、パフォーマンスを再テスト');
    } else {
      console.log('\n   ✅ ベクトルインデックスは存在します。');
      console.log('      パフォーマンス問題の原因は別の可能性があります：');
      console.log('      - コールドスタートの影響');
      console.log('      - リソース不足');
      console.log('      - インデックスパラメータの最適化が必要');
    }
    
    console.log('\n✅ インデックス確認完了\n');
    
  } catch (error: any) {
    console.error('❌ インデックス確認エラー:', error);
    console.error('   詳細:', error.stack);
    process.exit(1);
  }
}

// メイン処理
async function main() {
  await checkLanceDBIndexes();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  });
}

export { checkLanceDBIndexes };

