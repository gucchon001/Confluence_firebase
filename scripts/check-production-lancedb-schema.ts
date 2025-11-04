/**
 * 本番環境のLanceDBスキーマ確認スクリプト
 * 
 * 目的: 本番環境（Cloud Storage）からダウンロードしたデータのスキーマを確認
 * - structured_*フィールドが存在するか確認
 * - サンプルデータでStructuredLabelが統合されているか確認
 */

import * as lancedb from '@lancedb/lancedb';
import * as fs from 'fs';
import * as path from 'path';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye'
});

const bucketName = process.env.STORAGE_BUCKET || 'confluence-copilot-data';
const bucket = storage.bucket(bucketName);

async function downloadProductionData(skipDownload: boolean = false): Promise<string> {
  const localBasePath = '.lancedb-production-check';
  const localLancePath = path.join(localBasePath, '.lancedb', 'confluence.lance');
  const remotePath = 'lancedb/confluence.lance';
  
  // 既存のダウンロードファイルがあるか確認
  if (fs.existsSync(localLancePath)) {
    const existingFiles: string[] = [];
    try {
      const files = fs.readdirSync(localLancePath, { recursive: true });
      existingFiles.push(...files);
    } catch (error) {
      // ディレクトリが存在しない、または空の場合
    }
    
    if (existingFiles.length > 0) {
      console.log(`📋 既存のダウンロードファイルを使用: ${existingFiles.length}ファイル\n`);
      return path.join(localBasePath, '.lancedb');
    }
  }
  
  console.log('📥 本番環境のデータをダウンロード中...\n');
  
  // ローカルディレクトリをクリーンアップ
  if (fs.existsSync(localBasePath)) {
    fs.rmSync(localBasePath, { recursive: true, force: true });
  }
  fs.mkdirSync(localLancePath, { recursive: true });
  
  try {
    // Cloud Storageからファイルをダウンロード
    const [files] = await bucket.getFiles({ prefix: remotePath + '/' });
    
    console.log(`📊 見つかったファイル数: ${files.length}\n`);
    
    let downloadedCount = 0;
    for (const file of files) {
      // リモートパスから相対パスを取得
      const relativePath = file.name.replace(remotePath + '/', '');
      if (!relativePath) continue; // ディレクトリ自体はスキップ
      
      const localFilePath = path.join(localLancePath, relativePath);
      
      // ディレクトリを作成
      const dir = path.dirname(localFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // ファイルをダウンロード
      await file.download({ destination: localFilePath });
      downloadedCount++;
      
      if (downloadedCount % 10 === 0) {
        console.log(`   📥 ${downloadedCount}/${files.length}ファイルをダウンロードしました...`);
      }
    }
    
    console.log(`✅ ダウンロード完了: ${downloadedCount}ファイル\n`);
    
    // LanceDBのベースパスを返す（.lancedbディレクトリ）
    return path.join(localBasePath, '.lancedb');
  } catch (error: any) {
    console.error('❌ ダウンロードエラー:', error.message);
    throw error;
  }
}

async function checkSchema(lancedbPath: string): Promise<void> {
  console.log('🔍 LanceDBスキーマを確認中...\n');
  
  try {
    console.log(`📂 LanceDBパス: ${lancedbPath}\n`);
    
    const db = await lancedb.connect(lancedbPath);
    
    // テーブル名をリストアップ
    const tableNames = await db.tableNames();
    console.log(`📋 利用可能なテーブル: ${tableNames.length > 0 ? tableNames.join(', ') : 'なし'}\n`);
    
    if (tableNames.length === 0) {
      console.error('❌ テーブルが見つかりませんでした');
      console.error('   → ダウンロードしたデータが正しくない可能性があります');
      
      // ディレクトリ構造を確認
      console.log('\n📂 ダウンロードしたディレクトリ構造:');
      if (fs.existsSync(lancedbPath)) {
        const files = fs.readdirSync(lancedbPath, { recursive: true });
        console.log(`   - ファイル数: ${files.length}`);
        if (files.length > 0) {
          console.log(`   - 最初の5ファイル:`);
          files.slice(0, 5).forEach((file: string) => {
            console.log(`     ${file}`);
          });
        }
      }
      return;
    }
    
    const tableName = 'confluence'; // テーブル名は固定
    console.log(`📋 テーブルを開く: ${tableName}\n`);
    
    const table = await db.openTable(tableName);
    
    // スキーマを取得
    const schema = table.schema;
    
    console.log('📋 現在のテーブルスキーマ:');
    console.log('');
    
    if (schema && schema.fields) {
      schema.fields.forEach((field: any, index: number) => {
        console.log(`  ${index + 1}. ${field.name}: ${field.type} (nullable: ${field.nullable})`);
      });
    } else {
      console.log('  ⚠️ スキーマ情報が取得できませんでした');
    }
    
    console.log('');
    
    // structured_*フィールドの存在確認
    const structuredFields = [
      'structured_category',
      'structured_domain',
      'structured_feature',
      'structured_priority',
      'structured_status',
      'structured_version',
      'structured_tags',
      'structured_confidence',
      'structured_content_length',
      'structured_is_valid'
    ];
    
    console.log('🔍 StructuredLabelフィールドの存在確認:');
    console.log('');
    
    const hasStructuredFields = structuredFields.filter(field => {
      if (schema && schema.fields) {
        return schema.fields.some((f: any) => f.name === field);
      }
      return false;
    });
    
    if (hasStructuredFields.length > 0) {
      console.log(`  ✅ StructuredLabelフィールドが存在します: ${hasStructuredFields.length}件`);
      hasStructuredFields.forEach(field => {
        console.log(`    - ${field}`);
      });
    } else {
      console.log('  ❌ StructuredLabelフィールドが存在しません');
      console.log('  ⚠️ 拡張スキーマが適用されていない可能性があります');
    }
    
    console.log('');
    
    // データ件数を確認
    const count = await table.countRows();
    console.log(`📊 データ件数: ${count}件`);
    console.log('');
    
    // サンプルデータでStructuredLabelが統合されているか確認
    console.log('🔍 サンプルデータでStructuredLabelを確認中...\n');
    
    const sampleData = await table.search(new Array(768).fill(0)).limit(10).toArray();
    
    let hasStructuredLabelCount = 0;
    let hasStructuredFeatureCount = 0;
    
    sampleData.forEach((row: any, index: number) => {
      const hasStructuredFields = structuredFields.some(field => {
        const value = row[field];
        return value !== undefined && value !== null && value !== '' && value !== 0 && value !== false;
      });
      
      if (hasStructuredFields) {
        hasStructuredLabelCount++;
      }
      
      if (row.structured_feature && row.structured_feature !== '') {
        hasStructuredFeatureCount++;
      }
    });
    
    console.log(`📊 サンプルデータ分析結果:`);
    console.log(`  - 総サンプル数: ${sampleData.length}件`);
    console.log(`  - StructuredLabelが統合されている: ${hasStructuredLabelCount}件`);
    console.log(`  - structured_featureが設定されている: ${hasStructuredFeatureCount}件`);
    console.log('');
    
    if (hasStructuredLabelCount > 0) {
      console.log('✅ サンプルデータにStructuredLabelが統合されています\n');
      
      // 具体例を表示
      const example = sampleData.find((row: any) => {
        return row.structured_feature && row.structured_feature !== '';
      });
      
      if (example) {
        console.log('📋 具体例:');
        console.log(`   id: ${example.id}`);
        console.log(`   page_id: ${example.page_id}`);
        console.log(`   title: ${example.title?.substring(0, 50)}...`);
        console.log(`   structured_feature: ${example.structured_feature || '空'}`);
        console.log(`   structured_domain: ${example.structured_domain || '空'}`);
        console.log(`   structured_category: ${example.structured_category || '空'}`);
        console.log('');
      }
    } else {
      console.log('⚠️ サンプルデータにStructuredLabelが統合されていません');
      console.log('   → 通常の同期処理を実行するか、マイグレーションスクリプトを実行してください\n');
    }
    
    // 特定のページID（教室削除機能）を確認
    console.log('🔍 特定のページID（718373062: 教室削除機能）を確認中...\n');
    
    try {
      const targetPageId = 718373062;
      const targetData = await table.query().where(`page_id = ${targetPageId}`).toArray();
      
      if (targetData.length > 0) {
        const firstChunk = targetData[0];
        console.log(`✅ ページID ${targetPageId} が見つかりました（${targetData.length}チャンク）`);
        console.log(`   title: ${firstChunk.title}`);
        console.log(`   structured_feature: ${firstChunk.structured_feature || '空'}`);
        console.log(`   structured_domain: ${firstChunk.structured_domain || '空'}`);
        console.log(`   structured_category: ${firstChunk.structured_category || '空'}`);
        console.log('');
        
        if (firstChunk.structured_feature && firstChunk.structured_feature !== '') {
          console.log('✅ このページにはStructuredLabelが統合されています\n');
        } else {
          console.log('⚠️ このページにはStructuredLabelが統合されていません\n');
        }
      } else {
        console.log(`⚠️ ページID ${targetPageId} が見つかりませんでした\n`);
      }
    } catch (queryError: any) {
      console.warn(`⚠️ ページID検索エラー: ${queryError.message}`);
      console.warn('   → スカラーインデックスが存在しない可能性があります\n');
    }
    
    console.log('✅ 確認完了\n');
    
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    throw error;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   本番環境LanceDBスキーマ確認スクリプト                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  const tempDir = '.lancedb-production-check';
  
  try {
    // ステップ1: 本番環境のデータをダウンロード
    const lancedbPath = await downloadProductionData();
    
    // ステップ2: スキーマを確認
    await checkSchema(lancedbPath);
    
    // クリーンアップ
    console.log('🧹 一時ファイルをクリーンアップ中...');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    console.log('✅ クリーンアップ完了\n');
    
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error('   スタック:', error.stack);
    
    // エラー時もクリーンアップ
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ スクリプト完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ スクリプトエラー:', error);
      process.exit(1);
    });
}

export { checkSchema, downloadProductionData };

