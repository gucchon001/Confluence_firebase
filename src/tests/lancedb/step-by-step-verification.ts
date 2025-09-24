/**
 * 段階的検証テスト
 * 
 * 各ステップを段階的に検証し、期待値通りに改善されるかを確認する
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

/**
 * ステップ1: 埋め込みモデルの基本確認
 */
async function step1_verifyEmbeddingModel(): Promise<boolean> {
  console.log('\n=== ステップ1: 埋め込みモデルの基本確認 ===');
  
  try {
    const testText = 'テスト用のサンプルテキストです';
    const embedding = await getEmbeddings(testText);
    
    console.log(`✅ 埋め込み生成成功`);
    console.log(`   次元数: ${embedding.length}`);
    console.log(`   値の範囲: ${Math.min(...embedding).toFixed(4)} ～ ${Math.max(...embedding).toFixed(4)}`);
    
    // 期待値: 768次元
    const isCorrectDimensions = embedding.length === 768;
    console.log(`   次元数チェック: ${isCorrectDimensions ? '✅' : '❌'} (期待: 768, 実際: ${embedding.length})`);
    
    return isCorrectDimensions;
  } catch (error) {
    console.error('❌ 埋め込みモデル確認エラー:', error);
    return false;
  }
}

/**
 * ステップ2: LanceDBテーブルの確認
 */
async function step2_verifyLanceDBTable(): Promise<boolean> {
  console.log('\n=== ステップ2: LanceDBテーブルの確認 ===');
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tableNames = await db.tableNames();
    
    console.log(`✅ LanceDB接続成功`);
    console.log(`   利用可能なテーブル: ${tableNames.join(', ')}`);
    
    const hasConfluenceTable = tableNames.includes('confluence');
    console.log(`   テーブル存在チェック: ${hasConfluenceTable ? '✅' : '❌'} (confluenceテーブル)`);
    
    if (hasConfluenceTable) {
      const tbl = await db.openTable('confluence');
      const count = await tbl.countRows();
      console.log(`   レコード数: ${count}`);
      
      if (count > 0) {
        // サンプルレコードのベクトル次元数を確認
        const sample = await tbl.query().limit(1).toArray();
        if (sample.length > 0) {
          const vector = sample[0].vector?.toArray ? sample[0].vector.toArray() : sample[0].vector;
          const vectorDimensions = vector?.length || 0;
          console.log(`   ベクトル次元数: ${vectorDimensions}`);
          
          const isCorrectVectorDimensions = vectorDimensions === 768;
          console.log(`   ベクトル次元数チェック: ${isCorrectVectorDimensions ? '✅' : '❌'} (期待: 768, 実際: ${vectorDimensions})`);
          
          return isCorrectVectorDimensions;
        }
      }
    }
    
    return hasConfluenceTable;
  } catch (error) {
    console.error('❌ LanceDBテーブル確認エラー:', error);
    return false;
  }
}

/**
 * ステップ3: 検索品質の確認
 */
async function step3_verifySearchQuality(): Promise<{ passed: boolean; f1Score: number; details: string }> {
  console.log('\n=== ステップ3: 検索品質の確認 ===');
  
  try {
    const testQuery = '教室管理の詳細は';
    const expectedPages = [
      '160_【FIX】教室管理機能',
      '161_【FIX】教室一覧閲覧機能',
      '162_【FIX】教室新規登録機能',
      '163_【FIX】教室情報編集機能',
      '168_【FIX】教室コピー機能'
    ];
    
    console.log(`テストクエリ: "${testQuery}"`);
    console.log(`期待ページ: ${expectedPages.join(', ')}`);
    
    // 埋め込み生成
    const embedding = await getEmbeddings(testQuery);
    console.log(`✅ 埋め込み生成: ${embedding.length}次元`);
    
    // LanceDB検索
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    const results = await tbl.search(embedding).limit(20).toArray();
    
    console.log(`✅ 検索実行: ${results.length}件の結果`);
    
    if (results.length === 0) {
      return {
        passed: false,
        f1Score: 0,
        details: '検索結果が0件'
      };
    }
    
    // 距離の統計
    const distances = results.map(r => r._distance || 0);
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);
    
    console.log(`   平均距離: ${avgDistance.toFixed(4)}`);
    console.log(`   最小距離: ${minDistance.toFixed(4)}`);
    console.log(`   最大距離: ${maxDistance.toFixed(4)}`);
    
    // 品質評価
    const foundPages = results
      .map(r => r.title)
      .filter(title => expectedPages.some(expected => title?.includes(expected)));
    
    const precision = foundPages.length / results.length;
    const recall = foundPages.length / expectedPages.length;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    
    console.log(`   関連ページ数: ${foundPages.length}/${expectedPages.length}`);
    console.log(`   精度: ${precision.toFixed(3)}`);
    console.log(`   再現率: ${recall.toFixed(3)}`);
    console.log(`   F1スコア: ${f1Score.toFixed(3)}`);
    
    // 期待値との比較
    const expectedF1 = 0.2;
    const passed = f1Score >= expectedF1;
    
    console.log(`   期待F1スコア: ${expectedF1}`);
    console.log(`   品質チェック: ${passed ? '✅' : '❌'} (期待: ${expectedF1}, 実際: ${f1Score.toFixed(3)})`);
    
    return {
      passed,
      f1Score,
      details: `F1スコア: ${f1Score.toFixed(3)} (期待: ${expectedF1})`
    };
  } catch (error) {
    console.error('❌ 検索品質確認エラー:', error);
    return {
      passed: false,
      f1Score: 0,
      details: `エラー: ${error}`
    };
  }
}

/**
 * 段階的検証のメイン実行関数
 */
async function executeStepByStepVerification(): Promise<void> {
  console.log('🔍 段階的検証テスト');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  const results = {
    step1: false,
    step2: false,
    step3: { passed: false, f1Score: 0, details: '' }
  };
  
  // ステップ1: 埋め込みモデルの基本確認
  results.step1 = await step1_verifyEmbeddingModel();
  
  // ステップ2: LanceDBテーブルの確認
  results.step2 = await step2_verifyLanceDBTable();
  
  // ステップ3: 検索品質の確認
  results.step3 = await step3_verifySearchQuality();
  
  // 総合評価
  console.log('\n=== 総合評価 ===');
  console.log(`ステップ1 (埋め込みモデル): ${results.step1 ? '✅' : '❌'}`);
  console.log(`ステップ2 (LanceDBテーブル): ${results.step2 ? '✅' : '❌'}`);
  console.log(`ステップ3 (検索品質): ${results.step3.passed ? '✅' : '❌'} - ${results.step3.details}`);
  
  const allPassed = results.step1 && results.step2 && results.step3.passed;
  
  if (allPassed) {
    console.log('\n🎉 すべての検証が成功しました！');
    console.log('📋 推奨: ステップ4（クエリ前処理の改善）に進む');
  } else {
    console.log('\n⚠️ 一部の検証が失敗しました');
    console.log('📋 推奨: 失敗したステップを修正してから次のステップに進む');
    
    if (!results.step1) {
      console.log('   - 埋め込みモデルの問題を修正');
    }
    if (!results.step2) {
      console.log('   - LanceDBテーブルの問題を修正');
    }
    if (!results.step3.passed) {
      console.log('   - 検索品質の改善が必要');
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 段階的検証テスト完了');
}

// テスト実行
if (require.main === module) {
  executeStepByStepVerification();
}

export { executeStepByStepVerification };
