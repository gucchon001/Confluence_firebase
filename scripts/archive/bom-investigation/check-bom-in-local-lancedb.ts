/**
 * ローカルのLanceDBデータにBOMが含まれているか確認するスクリプト
 * 
 * 目的: ローカルのLanceDBデータにBOM（\uFEFF）が含まれているか確認
 * 注意: ローカルのデータが本番環境と同じかどうかは確認が必要
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

/**
 * BOM文字（U+FEFF）を検出する
 */
function detectBOM(text: string): { hasBOM: boolean; position: number; charCode: number } {
  if (!text || typeof text !== 'string') {
    return { hasBOM: false, position: -1, charCode: 0 };
  }
  
  // 文字列全体からBOMを検索
  const bomIndex = text.indexOf('\uFEFF');
  if (bomIndex !== -1) {
    return { hasBOM: true, position: bomIndex, charCode: 0xFEFF };
  }
  
  // 先頭文字をチェック
  if (text.length > 0 && text.charCodeAt(0) === 0xFEFF) {
    return { hasBOM: true, position: 0, charCode: 0xFEFF };
  }
  
  return { hasBOM: false, position: -1, charCode: 0 };
}

/**
 * LanceDBデータからBOMをチェック
 */
async function checkBOMInLanceDB(dbPath: string): Promise<void> {
  console.log('🔍 LanceDBデータからBOMをチェック中...\n');
  console.log(`📂 データベースパス: ${dbPath}\n`);
  
  try {
    const db = await lancedb.connect(dbPath);
    const tableNames = await db.tableNames();
    
    if (tableNames.length === 0) {
      console.log('⚠️  テーブルが見つかりませんでした');
      return;
    }
    
    console.log(`📊 テーブル数: ${tableNames.length}`);
    console.log(`📋 テーブル名: ${tableNames.join(', ')}\n`);
    
    const bomResults: Array<{
      tableName: string;
      recordId: string;
      field: string;
      hasBOM: boolean;
      position: number;
      preview: string;
      charCode: number;
    }> = [];
    
    for (const tableName of tableNames) {
      console.log(`\n🔍 テーブル "${tableName}" をチェック中...`);
      
      const table = await db.openTable(tableName);
      
      // 全レコードを取得（サンプルではなく全件チェック）
      console.log('  📊 全レコードを取得中...');
      const data = await table.query().toArray();
      
      console.log(`  📊 レコード数: ${data.length}`);
      
      let bomCount = 0;
      let checkedCount = 0;
      
      for (let i = 0; i < data.length; i++) {
        const record = data[i] as any;
        
        // contentフィールドをチェック
        if (record.content && typeof record.content === 'string') {
          checkedCount++;
          const bomCheck = detectBOM(record.content);
          if (bomCheck.hasBOM) {
            bomCount++;
            bomResults.push({
              tableName,
              recordId: String(record.page_id || record.id || i),
              field: 'content',
              hasBOM: true,
              position: bomCheck.position,
              preview: record.content.substring(0, 100).replace(/\uFEFF/g, '[BOM]'),
              charCode: bomCheck.charCode
            });
          }
        }
        
        // titleフィールドをチェック
        if (record.title && typeof record.title === 'string') {
          checkedCount++;
          const bomCheck = detectBOM(record.title);
          if (bomCheck.hasBOM) {
            bomCount++;
            bomResults.push({
              tableName,
              recordId: String(record.page_id || record.id || i),
              field: 'title',
              hasBOM: true,
              position: bomCheck.position,
              preview: record.title.substring(0, 100).replace(/\uFEFF/g, '[BOM]'),
              charCode: bomCheck.charCode
            });
          }
        }
        
        // 進捗表示（1000件ごと）
        if ((i + 1) % 1000 === 0) {
          console.log(`  ⏳ チェック中: ${i + 1}/${data.length} (BOM検出: ${bomCount}件)`);
        }
      }
      
      console.log(`  ${bomCount > 0 ? '❌' : '✅'} BOM検出: ${bomCount}件 / ${checkedCount}フィールド`);
    }
    
    // 結果サマリー
    console.log('\n' + '='.repeat(80));
    console.log('📊 BOM検出結果サマリー');
    console.log('='.repeat(80));
    
    if (bomResults.length === 0) {
      console.log('✅ BOMは検出されませんでした');
      console.log('   ローカルのLanceDBデータにはBOMが含まれていません');
    } else {
      console.log(`❌ BOMが検出されました: ${bomResults.length}件\n`);
      console.log('詳細:');
      bomResults.slice(0, 30).forEach((result, index) => {
        console.log(`\n${index + 1}. テーブル: ${result.tableName}`);
        console.log(`   レコードID: ${result.recordId}`);
        console.log(`   フィールド: ${result.field}`);
        console.log(`   位置: ${result.position}`);
        console.log(`   文字コード: ${result.charCode} (0x${result.charCode.toString(16)})`);
        console.log(`   プレビュー: ${result.preview}`);
      });
      
      if (bomResults.length > 30) {
        console.log(`\n... 他 ${bomResults.length - 30}件`);
      }
      
      // フィールド別の集計
      const contentBOM = bomResults.filter(r => r.field === 'content').length;
      const titleBOM = bomResults.filter(r => r.field === 'title').length;
      console.log(`\n📊 フィールド別集計:`);
      console.log(`   content: ${contentBOM}件`);
      console.log(`   title: ${titleBOM}件`);
    }
    
    // 結果をJSONファイルに保存
    const resultPath = path.join(process.cwd(), 'bom-check-results.json');
    const fs = await import('fs');
    fs.writeFileSync(resultPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      dbPath,
      totalBOMCount: bomResults.length,
      results: bomResults
    }, null, 2));
    console.log(`\n💾 結果を保存しました: ${resultPath}`);
    
  } catch (error) {
    console.error('❌ チェックエラー:', error);
    throw error;
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 ローカルのLanceDBデータでBOMチェックを開始...\n');
  
  // ローカルのLanceDBパス
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  
  console.log(`📂 データベースパス: ${dbPath}\n`);
  
  // データベースの存在確認
  const fs = await import('fs');
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ データベースが見つかりません: ${dbPath}`);
    console.log('\n💡 ヒント: ローカルのLanceDBデータを確認するか、本番環境からダウンロードしてください');
    process.exit(1);
  }
  
  try {
    // BOMをチェック
    await checkBOMInLanceDB(dbPath);
    
    console.log('\n✅ チェック完了');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

