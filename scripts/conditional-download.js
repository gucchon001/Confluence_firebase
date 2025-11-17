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
const { execSync } = require('child_process');

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
  console.log('🚀 download-production-data.ts を自動実行します');

  const downloadScript = path.join(process.cwd(), 'scripts', 'download-production-data.ts');
  if (!fs.existsSync(downloadScript)) {
    console.error('❌ ダウンロードスクリプトが見つかりませんでした:', downloadScript);
    process.exit(1);
  }

  try {
    console.log('⏳ LanceDBデータをダウンロード中...');
    execSync('npx tsx scripts/download-production-data.ts', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ ダウンロードスクリプトの実行に失敗しました');
    console.error(error.message || error);
    process.exit(1);
  }

  // ダウンロード後にキャッシュが生成されたかを検証
  if (fs.existsSync(LANCEDB_PATH)) {
    const files = fs.readdirSync(LANCEDB_PATH);
    if (files.length > 0) {
      console.log('✅ LanceDBデータのダウンロードが完了しました');
      console.log(`📄 ダウンロード済みファイル数: ${files.length}`);
      process.exit(0);
    }
  }

  console.error('❌ LanceDBキャッシュが確認できませんでした。ダウンロードが失敗した可能性があります');
  process.exit(1);
}

main().catch((error) => {
  console.error('❌ エラーが発生しました:', error);
  // エラーが発生してもビルドプロセスを続行
  process.exit(0);
});

