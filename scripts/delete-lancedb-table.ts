/**
 * LanceDBテーブル削除スクリプト
 */

import * as lancedb from '@lancedb/lancedb';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   LanceDBテーブル削除スクリプト                                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  try {
    const db = await lancedb.connect('.lancedb');
    
    // テーブル名を確認
    const tableNames = await db.tableNames();
    console.log(`📋 利用可能なテーブル: ${tableNames.length > 0 ? tableNames.join(', ') : 'なし'}\n`);
    
    if (tableNames.includes('confluence')) {
      console.log('🗑️ テーブル「confluence」を削除中...\n');
      await db.dropTable('confluence');
      console.log('✅ テーブル削除完了\n');
    } else {
      console.log('⚠️ テーブル「confluence」が見つかりませんでした\n');
    }
    
    // データベースディレクトリをクリーンアップ（オプション）
    const lancedbPath = path.resolve(process.cwd(), '.lancedb');
    if (fs.existsSync(lancedbPath)) {
      const files = fs.readdirSync(lancedbPath);
      if (files.length === 0) {
        console.log('📂 データベースディレクトリが空になりました\n');
      } else {
        console.log(`📂 データベースディレクトリに${files.length}件のファイルが残っています\n`);
      }
    }
    
    console.log('✅ 削除処理完了\n');
    
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    if (error.message?.includes('Table') || error.message?.includes('not found')) {
      console.log('   → テーブルは既に削除されているか、存在しません\n');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  });
}

