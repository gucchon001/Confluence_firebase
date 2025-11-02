/**
 * 本番環境への適用準備スクリプト
 * 
 * 目的: マイグレーション済みデータベースを本番環境に適用するための準備を整える
 * 
 * 実行内容:
 * 1. ローカルデータベースの状態確認
 * 2. マイグレーション済みであることの確認
 * 3. インデックスの確認
 * 4. パフォーマンステスト
 * 
 * 使用方法:
 * ```bash
 * npm run prepare:production
 * ```
 */

import * as lancedb from '@lancedb/lancedb';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.resolve(process.cwd(), '.lancedb');
const TABLE_NAME = 'confluence';

interface PreparationResult {
  success: boolean;
  databaseExists: boolean;
  tableExists: boolean;
  hasPageId: boolean;
  hasPageIdField: boolean;
  hasScalarIndex: boolean;
  hasVectorIndex: boolean;
  rowCount: number;
  errors: string[];
}

async function prepareProductionDeployment(): Promise<PreparationResult> {
  const result: PreparationResult = {
    success: false,
    databaseExists: false,
    tableExists: false,
    hasPageId: false,
    hasPageIdField: true,
    hasScalarIndex: false,
    hasVectorIndex: false,
    rowCount: 0,
    errors: []
  };

  console.log('🚀 本番環境への適用準備を開始...\n');
  console.log(`📂 データベースパス: ${DB_PATH}\n`);

  try {
    // 1. データベースディレクトリの存在確認
    if (!fs.existsSync(DB_PATH)) {
      result.errors.push(`データベースディレクトリが見つかりません: ${DB_PATH}`);
      console.error(`❌ ${result.errors[result.errors.length - 1]}`);
      return result;
    }
    result.databaseExists = true;
    console.log('✅ データベースディレクトリが存在します\n');

    // 2. データベース接続
    console.log('📂 データベースに接続中...');
    const db = await lancedb.connect(DB_PATH);
    console.log('✅ データベース接続成功\n');

    // 3. テーブルの存在確認
    console.log(`📋 テーブル '${TABLE_NAME}' の存在確認...`);
    try {
      const table = await db.openTable(TABLE_NAME);
      result.tableExists = true;
      console.log('✅ テーブルが存在します\n');

      // 4. データ統計
      result.rowCount = await table.countRows();
      console.log(`📊 テーブル統計:`);
      console.log(`   - 総行数: ${result.rowCount.toLocaleString()}行\n`);

      if (result.rowCount === 0) {
        result.errors.push('テーブルにデータがありません');
        console.error(`❌ ${result.errors[result.errors.length - 1]}\n`);
        return result;
      }

      // 5. スキーマ確認（サンプルデータから）
      console.log('🔍 スキーマ確認中...');
      const sampleData = await table.query().limit(1).toArray();
      
      if (sampleData.length > 0) {
        const sample = sampleData[0];
        const fields = Object.keys(sample);
        
        console.log(`   - フィールド数: ${fields.length}`);
        console.log(`   - フィールド: ${fields.join(', ')}\n`);

        // pageId vs page_id 確認
        if (fields.includes('pageId')) {
          result.hasPageId = true;
          result.errors.push('❌ 警告: pageIdフィールドがまだ存在します（マイグレーションが完了していない可能性）');
          console.warn(`   ⚠️ pageIdフィールドが存在します（古いスキーマ）`);
        } else {
          console.log('   ✅ pageIdフィールドは存在しません（正常）');
        }

        if (fields.includes('page_id')) {
          result.hasPageIdField = true;
          console.log('   ✅ page_idフィールドが存在します（正常）');
        } else {
          result.hasPageIdField = false;
          result.errors.push('❌ page_idフィールドが存在しません（マイグレーションが必要）');
          console.error(`   ❌ page_idフィールドが存在しません`);
        }
      } else {
        result.errors.push('サンプルデータが取得できませんでした');
        console.error(`❌ ${result.errors[result.errors.length - 1]}\n`);
        return result;
      }

      // 6. インデックス確認（推測による）
      console.log('\n🔧 インデックス確認中...');
      try {
        // スカラーインデックスの存在確認（page_id）
        // 注意: LanceDBのAPIでは直接インデックスの存在を確認できないため、
        // パフォーマンステストで確認します
        console.log('   💡 スカラーインデックスはパフォーマンステストで確認します');
      } catch (error: any) {
        result.errors.push(`インデックス確認エラー: ${error.message}`);
        console.error(`❌ ${result.errors[result.errors.length - 1]}`);
      }

      // 7. パフォーマンステスト
      console.log('\n⚡ パフォーマンステスト実行中...');
      if (sampleData.length > 0 && sampleData[0].page_id !== undefined) {
        const testPageId = sampleData[0].page_id;
        const testStart = Date.now();
        
        try {
          const testResults = await table
            .query()
            .where(`\`page_id\` = ${testPageId}`)
            .limit(1)
            .toArray();
          const testDuration = Date.now() - testStart;

          console.log(`   - クエリ時間: ${testDuration}ms`);
          
          if (testDuration < 100) {
            result.hasScalarIndex = true; // 高速ならインデックスが効いていると推測
            console.log(`   ✅ クエリが高速です（スカラーインデックスが効いている可能性が高い）`);
          } else {
            console.warn(`   ⚠️ クエリが遅いです（スカラーインデックスが効いていない可能性）`);
          }
        } catch (error: any) {
          result.errors.push(`パフォーマンステストエラー: ${error.message}`);
          console.error(`   ❌ ${result.errors[result.errors.length - 1]}`);
        }
      }

    } catch (error: any) {
      result.errors.push(`テーブルオープンエラー: ${error.message}`);
      console.error(`❌ ${result.errors[result.errors.length - 1]}\n`);
      return result;
    }

    // 結果評価
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 準備結果サマリー');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (result.errors.length > 0) {
      console.log('❌ エラーが検出されました:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      console.log('\n⚠️ エラーを修正してから、再度実行してください。\n');
      result.success = false;
    } else {
      console.log('✅ すべての確認が完了しました！');
      console.log('\n💡 次のステップ:');
      console.log('   1. マイグレーション済みデータベースをCloud Storageにアップロード');
      console.log('      → npm run upload:production-data');
      console.log('   2. アプリケーションをデプロイ');
      console.log('      → git push (Firebase App Hosting自動デプロイ)');
      console.log('\n');
      result.success = true;
    }

  } catch (error: any) {
    result.errors.push(`致命的エラー: ${error.message}`);
    console.error(`❌ ${result.errors[result.errors.length - 1]}`);
    console.error('   スタック:', error.stack);
    result.success = false;
  }

  return result;
}

// スクリプト実行
if (require.main === module) {
  prepareProductionDeployment()
    .then((result) => {
      if (result.success) {
        console.log('✅ スクリプト完了: 本番環境への適用準備が整いました');
        process.exit(0);
      } else {
        console.error('❌ スクリプト完了: エラーが検出されました');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ スクリプトエラー:', error);
      process.exit(1);
    });
}

export { prepareProductionDeployment };

