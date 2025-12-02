/**
 * Confluenceデータの完全再構築スクリプト
 * 
 * このスクリプトは以下の処理を順番に実行します：
 * 1. Confluenceデータ同期（Firestore + LanceDB、完全同期）
 * 2. StructuredLabel同期（Firestore → LanceDB）
 * 3. Lunrインデックスの再構築
 * 4. LanceDBインデックスの作成
 * 5. GCSへのアップロード（オプション）
 * 
 * 使用方法:
 *   npx tsx scripts/sync-confluence-full-rebuild.ts
 * 
 * 環境変数:
 *   SYNC_TYPE: 同期タイプ（'differential' または 'batch'、デフォルト: 'batch'）
 *   SKIP_STRUCTURED_LABELS: StructuredLabel同期をスキップ（trueでスキップ）
 *   SKIP_GCS_UPLOAD: GCSアップロードをスキップ（trueでスキップ）
 */

import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { lunrInitializer } from '../src/lib/lunr-initializer';

const execAsync = promisify(exec);

async function step1SyncConfluence(syncType: 'differential' | 'batch') {
  console.log('='.repeat(80));
  console.log('📋 Step 1: Confluenceデータ同期（Firestore + LanceDB）');
  console.log('='.repeat(80));
  console.log('');

  try {
    const command = syncType === 'differential' 
      ? 'npm run sync:confluence:differential'
      : 'npm run sync:confluence:batch';
    
    console.log(`🚀 Confluence ${syncType === 'differential' ? '差分' : '完全'}同期を開始します...\n`);
    
    // ★★★ maxBufferを拡大（大量のログ出力に対応） ★★★
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024 // 10MB（デフォルトは200KB）
    });
    
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }

    console.log(`\n✅ Confluence ${syncType === 'differential' ? '差分' : '完全'}同期が完了しました\n`);

    return true;
  } catch (error: any) {
    if (error.stdout) {
      console.log(error.stdout);
    }
    if (error.stderr) {
      console.error(error.stderr);
    }
    console.error(`❌ Confluence同期中にエラーが発生しました: ${error.message}`);
    throw error;
  }
}

async function step2SyncStructuredLabels() {
  const skipLabels = process.env.SKIP_STRUCTURED_LABELS === 'true';
  
  if (skipLabels) {
    console.log('='.repeat(80));
    console.log('📋 Step 2: StructuredLabel同期（スキップ）');
    console.log('='.repeat(80));
    console.log('');
    console.log('ℹ️ StructuredLabel同期はスキップされました（SKIP_STRUCTURED_LABELS=true）');
    console.log('');
    return;
  }

  console.log('='.repeat(80));
  console.log('📋 Step 2: StructuredLabel同期（Firestore → LanceDB）');
  console.log('='.repeat(80));
  console.log('');

  try {
    console.log('🚀 StructuredLabel同期を開始します...\n');
    
    // ★★★ maxBufferを拡大（大量のログ出力に対応） ★★★
    const { stdout, stderr } = await execAsync('npx tsx scripts/sync-firestore-labels-to-lancedb.ts', {
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }

    console.log('\n✅ StructuredLabel同期が完了しました\n');

    return true;
  } catch (error: any) {
    if (error.stdout) {
      console.log(error.stdout);
    }
    if (error.stderr) {
      console.error(error.stderr);
    }
    console.warn('⚠️ StructuredLabel同期中にエラーが発生しました（処理は継続します）:', error.message);
    console.warn('   これは既に同期済みの場合や、StructuredLabelが存在しない場合に発生することがあります\n');
    // StructuredLabel同期は失敗しても処理を継続
    return false;
  }
}

async function step3RebuildLunrIndex() {
  console.log('='.repeat(80));
  console.log('📋 Step 3: Lunrインデックスの再構築');
  console.log('='.repeat(80));
  console.log('');

  try {
    console.log('🚀 Confluence Lunrインデックスの再構築を開始します...\n');
    
    // Confluence用のLunrインデックスを初期化（直接呼び出し）
    await lunrInitializer.initializeAsync('confluence');
    
    console.log('\n✅ Confluence Lunrインデックスの再構築が完了しました');
    
    // 状態を確認
    const status = lunrInitializer.getStatus();
    console.log(`📊 インデックス状態:`);
    console.log(`   - 初期化済み: ${status.isInitialized ? '✅' : '❌'}`);
    console.log(`   - ドキュメント数: ${status.documentCount}`);
    console.log(`   - 最終更新: ${status.lastUpdated?.toLocaleString() || 'N/A'}`);
    console.log('');

    return true;
  } catch (error: any) {
    console.error('❌ Lunrインデックス再構築中にエラーが発生しました:', error);
    throw error;
  }
}

async function step4CreateLanceDBIndexes() {
  console.log('='.repeat(80));
  console.log('📋 Step 4: LanceDBインデックスの作成');
  console.log('='.repeat(80));
  console.log('');

  try {
    console.log('🚀 LanceDBインデックスの作成を開始します...\n');
    
    // ★★★ maxBufferを拡大（大量のログ出力に対応） ★★★
    const { stdout, stderr } = await execAsync('npx tsx scripts/create-lancedb-indexes.ts', {
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }

    console.log('\n✅ LanceDBインデックスの作成が完了しました\n');

    return true;
  } catch (error: any) {
    if (error.stdout) {
      console.log(error.stdout);
    }
    if (error.stderr) {
      console.error(error.stderr);
    }
    console.error('❌ LanceDBインデックス作成中にエラーが発生しました:', error.message);
    throw error;
  }
}

async function step5UploadToGCS() {
  const skipUpload = process.env.SKIP_GCS_UPLOAD === 'true';
  
  if (skipUpload) {
    console.log('='.repeat(80));
    console.log('📋 Step 5: GCSアップロード（スキップ）');
    console.log('='.repeat(80));
    console.log('');
    console.log('ℹ️ GCSアップロードはスキップされました（SKIP_GCS_UPLOAD=true）');
    console.log('');
    return;
  }

  console.log('='.repeat(80));
  console.log('📋 Step 5: GCSへのアップロード');
  console.log('='.repeat(80));
  console.log('');

  try {
    console.log('🚀 データをGCSにアップロード中...\n');
    
    // Confluenceテーブルのみをアップロード（UPLOAD_TABLE_FILTERを使用）
    // ★★★ maxBufferを拡大（大量のログ出力に対応） ★★★
    const { stdout, stderr } = await execAsync('npx tsx scripts/upload-production-data.ts', {
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: {
        ...process.env,
        UPLOAD_TABLE_FILTER: 'confluence'
      }
    });
    
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }

    console.log('\n✅ GCSアップロードが完了しました\n');

    return true;
  } catch (error: any) {
    if (error.stdout) {
      console.log(error.stdout);
    }
    if (error.stderr) {
      console.error(error.stderr);
    }
    console.warn('⚠️ GCSアップロード中にエラーが発生しました（処理は継続します）:', error.message);
    console.warn('   本番環境以外では正常な動作です\n');
    // GCSアップロードは失敗しても処理を継続
    return false;
  }
}

async function main() {
  console.log('');
  console.log('🚀 Confluenceデータの完全再構築を開始します');
  console.log('');
  console.log('📌 注意事項:');
  console.log('   - このスクリプトは既存のLanceDBテーブルを再構築します');
  console.log('   - StructuredLabelの同期が含まれます（Firestore → LanceDB）');
  console.log('   - 処理には時間がかかる場合があります');
  console.log('');
  console.log('処理フロー:');
  console.log('  1. Confluenceデータ同期（Firestore + LanceDB）');
  console.log('  2. StructuredLabel同期（Firestore → LanceDB）');
  console.log('  3. Lunrインデックスの再構築');
  console.log('  4. LanceDBインデックスの作成');
  console.log('  5. GCSへのアップロード（オプション）');
  console.log('');

  // 同期タイプを環境変数から取得（デフォルト: 'batch'）
  const syncType = (process.env.SYNC_TYPE === 'differential' ? 'differential' : 'batch') as 'differential' | 'batch';

  const startTime = Date.now();

  try {
    // Step 1: Confluenceデータ同期
    await step1SyncConfluence(syncType);

    // Step 2: StructuredLabel同期
    await step2SyncStructuredLabels();

    // Step 3: Lunrインデックスの再構築
    await step3RebuildLunrIndex();

    // Step 4: LanceDBインデックスの作成
    await step4CreateLanceDBIndexes();

    // Step 5: GCSへのアップロード（オプション）
    await step5UploadToGCS();

    const duration = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    console.log('='.repeat(80));
    console.log('✅ 完全再構築が完了しました！');
    console.log('='.repeat(80));
    console.log('');
    console.log(`⏱️  総処理時間: ${minutes}分${seconds}秒`);
    console.log('');
    console.log('📊 完了した処理:');
    console.log('  ✅ Confluenceデータ同期（Firestore + LanceDB）');
    if (process.env.SKIP_STRUCTURED_LABELS !== 'true') {
      console.log('  ✅ StructuredLabel同期（Firestore → LanceDB）');
    }
    console.log('  ✅ Lunrインデックスの再構築');
    console.log('  ✅ LanceDBインデックスの作成');
    if (process.env.SKIP_GCS_UPLOAD !== 'true') {
      console.log('  ✅ GCSへのアップロード');
    }
    console.log('');

  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    console.log('');
    console.log('='.repeat(80));
    console.error('❌ 再構築中にエラーが発生しました');
    console.log('='.repeat(80));
    console.log('');
    console.log(`⏱️  処理時間: ${minutes}分${seconds}秒`);
    console.log('');
    console.error('エラー詳細:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

