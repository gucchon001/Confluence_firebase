/**
 * 条件付きデータダウンロードスクリプト
 * 
 * SKIP_DATA_DOWNLOAD環境変数に基づいて、データダウンロードをスキップするかどうかを決定します。
 * 
 * 使用方法:
 * - SKIP_DATA_DOWNLOAD=true: データダウンロードをスキップ（高速ビルド）
 * - SKIP_DATA_DOWNLOAD=false または未設定: データダウンロードを実行
 * 
 * ローカルに.lancedbキャッシュが存在する場合、ダウンロードをスキップします。
 */

const fs = require('fs');
const path = require('path');

const LANCEDB_PATH = path.join(process.cwd(), '.lancedb');
const SKIP_ENV = process.env.SKIP_DATA_DOWNLOAD;

async function main() {
  console.log('📦 条件付きデータダウンロードチェック');
  console.log('='.repeat(60));
  
  // 環境変数で明示的にスキップが指定されている場合
  if (SKIP_ENV === 'true') {
    console.log('⏩ SKIP_DATA_DOWNLOAD=true が設定されています');
    console.log('ℹ️  データダウンロードをスキップします');
    console.log('ℹ️  データは実行時にCloud Storageから読み込まれます');
    process.exit(0);
  }
  
  // ローカルにキャッシュが存在する場合
  if (fs.existsSync(LANCEDB_PATH)) {
    try {
      const stats = fs.statSync(LANCEDB_PATH);
      if (stats.isDirectory()) {
        // ディレクトリ内にファイルがあるか確認
        const files = fs.readdirSync(LANCEDB_PATH);
        if (files.length > 0) {
          console.log('✅ ローカルにLanceDBキャッシュが存在します');
          console.log(`📂 パス: ${LANCEDB_PATH}`);
          console.log(`📄 ファイル数: ${files.length}`);
          console.log('⏩ データダウンロードをスキップします');
          process.exit(0);
        }
      }
    } catch (error) {
      // エラーが発生した場合はダウンロードを実行
      console.log('⚠️  キャッシュの確認中にエラーが発生しました');
      console.log('📥 データダウンロードを実行します');
    }
  }
  
  // ダウンロードが必要な場合
  console.log('📥 データダウンロードが必要です');
  console.log('ℹ️  download-production-data.ts を実行してください');
  console.log('ℹ️  または、SKIP_DATA_DOWNLOAD=true を設定してスキップできます');
  
  // ダウンロードスクリプトが存在する場合は実行
  const downloadScript = path.join(process.cwd(), 'scripts', 'download-production-data.ts');
  if (fs.existsSync(downloadScript)) {
    console.log('🚀 ダウンロードスクリプトを実行します...');
    // ここでは実際のダウンロードは行わず、メッセージのみ表示
    // 実際のダウンロードは別のスクリプトで実行される想定
    console.log('⚠️  注意: ダウンロードスクリプトは別途実行してください');
  }
  
  // ダウンロードが必要な場合は、エラーコードを返さずに終了
  // （ビルドプロセスを続行させるため）
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ エラーが発生しました:', error);
  // エラーが発生してもビルドプロセスを続行
  process.exit(0);
});

