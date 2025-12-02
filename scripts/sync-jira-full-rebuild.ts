/**
 * Jiraデータの完全再構築スクリプト
 * 
 * このスクリプトは以下の処理を順番に実行します：
 * 1. Jiraデータ同期（Firestore + LanceDB、テーブル再構築含む）
 * 2. StructuredLabel同期（Firestore → LanceDB）
 * 3. Lunrインデックスの初期化
 * 4. LanceDBインデックスの作成
 * 5. GCSへのアップロード（オプション）
 * 
 * 使用方法:
 *   npx tsx scripts/sync-jira-full-rebuild.ts
 * 
 * 環境変数:
 *   JIRA_MAX_ISSUES: 最大取得件数（デフォルト: 1000、0で全件取得）
 *   SKIP_STRUCTURED_LABELS: StructuredLabel同期をスキップ（trueでスキップ）
 *   SKIP_GCS_UPLOAD: GCSアップロードをスキップ（trueでスキップ）
 */

import 'dotenv/config';
import { JiraSyncService } from '../src/lib/jira-sync-service';
import { lunrInitializer } from '../src/lib/lunr-initializer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function step1SyncJira(maxIssues: number) {
  console.log('='.repeat(80));
  console.log('📋 Step 1: Jiraデータ同期（Firestore + LanceDB）');
  console.log('='.repeat(80));
  console.log('');

  if (maxIssues === 0) {
    console.log(`🚀 Jira 同期を開始します（全件取得モード）`);
  } else {
    console.log(`🚀 Jira 同期を開始します（最大${maxIssues}件）`);
  }
  console.log('');

  const jiraSyncService = new JiraSyncService(maxIssues);

  try {
    const result = await jiraSyncService.syncAllIssues();

    console.log('');
    console.log('✅ Jira同期が完了しました');
    console.log(`  取得件数: ${result.totalIssues}`);
    console.log(`  保存件数: ${result.storedIssues}`);
    console.log(`  スキップ件数: ${result.skippedIssues}`);
    console.log(`  LanceDBレコード: ${result.lanceDbRecords}`);
    console.log(`  追加: ${result.added}件, 更新: ${result.updated}件, 変更なし: ${result.unchanged}件`);
    console.log('');

    return result;
  } catch (error) {
    console.error('❌ Jira同期中にエラーが発生しました:', error);
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
    
    const { stdout, stderr } = await execAsync('npx tsx scripts/sync-firestore-jira-labels-to-lancedb.ts');
    
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

async function step3InitializeLunrIndex() {
    console.log('='.repeat(80));
    console.log('📋 Step 3: Lunrインデックスの初期化');
    console.log('='.repeat(80));
  console.log('');

  try {
    console.log('🚀 Jira Lunrインデックスの初期化を開始します...\n');
    
    // Jira用のLunrインデックスを初期化
    await lunrInitializer.initializeAsync('jira_issues');
    
    console.log('\n✅ Jira Lunrインデックスの初期化が完了しました');
    
    // 状態を確認
    const status = lunrInitializer.getStatus();
    console.log(`📊 インデックス状態:`);
    console.log(`   - 初期化済み: ${status.isInitialized ? '✅' : '❌'}`);
    console.log(`   - ドキュメント数: ${status.documentCount}`);
    console.log(`   - 最終更新: ${status.lastUpdated?.toLocaleString() || 'N/A'}`);
    console.log('');

    return true;
  } catch (error) {
    console.error('❌ Jira Lunrインデックスの初期化中にエラーが発生しました:', error);
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
    
    // create-lancedb-indexes.tsを実行
    const { stdout, stderr } = await execAsync('npx tsx scripts/create-lancedb-indexes.ts');
    
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }

    console.log('\n✅ LanceDBインデックスの作成が完了しました\n');

    return true;
  } catch (error: any) {
    // execAsyncはエラー時にもstdout/stderrを含む場合がある
    if (error.stdout) {
      console.log(error.stdout);
    }
    if (error.stderr) {
      console.error(error.stderr);
    }
    console.error('❌ LanceDBインデックスの作成中にエラーが発生しました:', error.message);
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
    
    // Jiraテーブルのみをアップロード（UPLOAD_TABLE_FILTERを使用）
    const { stdout, stderr } = await execAsync('npx tsx scripts/upload-production-data.ts', {
      env: {
        ...process.env,
        UPLOAD_TABLE_FILTER: 'jira_issues'
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
    // execAsyncはエラー時にもstdout/stderrを含む場合がある
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
  console.log('🚀 Jiraデータの完全再構築を開始します');
  console.log('');
  console.log('📌 注意事項:');
  console.log('   - このスクリプトは既存のLanceDBテーブルを再構築します');
  console.log('   - チャンク分割機能が適用されます（3000文字以上のIssueは自動的にチャンク分割）');
  console.log('   - 処理には時間がかかる場合があります');
  console.log('');
  console.log('処理フロー:');
  console.log('  1. Jiraデータ同期（Firestore + LanceDB）');
  console.log('  2. StructuredLabel同期（Firestore → LanceDB）');
  console.log('  3. Lunrインデックスの初期化');
  console.log('  4. LanceDBインデックスの作成');
  console.log('  5. GCSへのアップロード（オプション）');
  console.log('');

  // 最大取得件数を環境変数またはデフォルト1000件に設定
  const maxIssues = process.env.JIRA_MAX_ISSUES !== undefined
    ? parseInt(process.env.JIRA_MAX_ISSUES, 10)
    : 1000;

  const startTime = Date.now();

  try {
    // Step 1: Jiraデータ同期
    await step1SyncJira(maxIssues);

    // Step 2: StructuredLabel同期
    await step2SyncStructuredLabels();

    // Step 3: Lunrインデックスの初期化
    await step3InitializeLunrIndex();

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
    console.log('  ✅ Jiraデータ同期（Firestore + LanceDB）');
    if (process.env.SKIP_STRUCTURED_LABELS !== 'true') {
      console.log('  ✅ StructuredLabel同期（Firestore → LanceDB）');
    }
    console.log('  ✅ Lunrインデックスの初期化');
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

