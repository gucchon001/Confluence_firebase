/**
 * 本番環境のLanceDBデータにBOMが含まれているか確認するスクリプト
 * 
 * 目的: 本番環境（Cloud Storage）からダウンロードしたデータにBOM（\uFEFF）が含まれているか確認
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
 * 本番環境のデータをダウンロード
 */
async function downloadProductionData(): Promise<string> {
  const localBasePath = '.lancedb-bom-check';
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
  
  // 既存のダウンロードファイルがない場合でも、エラー時に使用できるようにディレクトリを作成
  if (!fs.existsSync(localBasePath)) {
    fs.mkdirSync(localBasePath, { recursive: true });
  }
  
  console.log('📥 本番環境のデータをダウンロード中...\n');
  
  // 既存のファイルを保持して、不足しているファイルだけをダウンロード
  if (!fs.existsSync(localLancePath)) {
    fs.mkdirSync(localLancePath, { recursive: true });
  }
  
  try {
    // Cloud Storageからファイルをダウンロード
    const [files] = await bucket.getFiles({ prefix: remotePath + '/' });
    
    if (files.length === 0) {
      throw new Error(`No files found at ${remotePath}/`);
    }
    
    console.log(`📦 Found ${files.length} files to download\n`);
    
    // リトライ機能付きダウンロード
    const downloadWithRetry = async (file: any, maxRetries: number = 3): Promise<boolean> => {
      const relativePath = file.name.replace(remotePath + '/', '');
      const localFilePath = path.join(localLancePath, relativePath);
      
      // 既に存在する場合はスキップ
      if (fs.existsSync(localFilePath)) {
        return false; // ダウンロード不要
      }
      
      const localDir = path.dirname(localFilePath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await file.download({ destination: localFilePath });
          return true; // ダウンロード成功
        } catch (error: any) {
          if (attempt === maxRetries) {
            console.error(`  ❌ Failed to download after ${maxRetries} attempts: ${relativePath}`);
            return false; // ダウンロード失敗
          }
          if (attempt === 1) {
            console.log(`  ⚠️  Retry ${attempt}/${maxRetries} for ${relativePath}...`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 指数バックオフ
        }
      }
      return false;
    };
    
    let downloadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // バッチでダウンロード（並列数を制限して接続エラーを防ぐ）
    const BATCH_SIZE = 5;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(file => downloadWithRetry(file)));
      
      for (let j = 0; j < results.length; j++) {
        const relativePath = batch[j].name.replace(remotePath + '/', '');
        if (results[j]) {
          downloadedCount++;
          if (downloadedCount % 50 === 0) {
            console.log(`  📥 Downloaded: ${downloadedCount}/${files.length} files...`);
          }
        } else {
          // 既存ファイルかエラーか確認
          const localFilePath = path.join(localLancePath, relativePath);
          if (fs.existsSync(localFilePath)) {
            skippedCount++;
          } else {
            errorCount++;
          }
        }
      }
      
      // バッチ間で少し待機（接続負荷を軽減）
      if (i + BATCH_SIZE < files.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n✅ ダウンロード完了: ${downloadedCount}新規, ${skippedCount}既存, ${errorCount}エラー`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount}ファイルのダウンロードに失敗しましたが、既存のファイルでチェックを続行します`);
    }
    console.log('');
    
    // 一部のファイルがダウンロードできなくても、既存のファイルでチェックを続行
    return path.join(localBasePath, '.lancedb');
  } catch (error) {
    console.error('❌ ダウンロードエラー:', error);
    // 既存のファイルがあればそれを使用
    if (fs.existsSync(localLancePath)) {
      console.log('⚠️  既存のダウンロード済みファイルを使用してチェックを続行します\n');
      return path.join(localBasePath, '.lancedb');
    }
    throw error;
  }
}

/**
 * LanceDBデータからBOMをチェック
 */
async function checkBOMInLanceDB(dbPath: string): Promise<void> {
  console.log('🔍 LanceDBデータからBOMをチェック中...\n');
  
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
    }> = [];
    
    for (const tableName of tableNames) {
      console.log(`\n🔍 テーブル "${tableName}" をチェック中...`);
      
      const table = await db.openTable(tableName);
      // サンプルサイズを増やしてより多くのデータをチェック
      const data = await table.query().limit(5000).toArray();
      
      console.log(`  📊 レコード数: ${data.length}`);
      
      let bomCount = 0;
      
      for (let i = 0; i < data.length; i++) {
        const record = data[i] as any;
        
        // contentフィールドをチェック
        if (record.content && typeof record.content === 'string') {
          const bomCheck = detectBOM(record.content);
          if (bomCheck.hasBOM) {
            bomCount++;
            bomResults.push({
              tableName,
              recordId: String(record.page_id || record.id || i),
              field: 'content',
              hasBOM: true,
              position: bomCheck.position,
              preview: record.content.substring(0, 100).replace(/\uFEFF/g, '[BOM]')
            });
          }
        }
        
        // titleフィールドをチェック
        if (record.title && typeof record.title === 'string') {
          const bomCheck = detectBOM(record.title);
          if (bomCheck.hasBOM) {
            bomCount++;
            bomResults.push({
              tableName,
              recordId: String(record.page_id || record.id || i),
              field: 'title',
              hasBOM: true,
              position: bomCheck.position,
              preview: record.title.substring(0, 100).replace(/\uFEFF/g, '[BOM]')
            });
          }
        }
      }
      
      console.log(`  ${bomCount > 0 ? '❌' : '✅'} BOM検出: ${bomCount}件`);
    }
    
    // 結果サマリー
    console.log('\n' + '='.repeat(80));
    console.log('📊 BOM検出結果サマリー');
    console.log('='.repeat(80));
    
    if (bomResults.length === 0) {
      console.log('✅ BOMは検出されませんでした');
    } else {
      console.log(`❌ BOMが検出されました: ${bomResults.length}件\n`);
      console.log('詳細:');
      bomResults.slice(0, 20).forEach((result, index) => {
        console.log(`\n${index + 1}. テーブル: ${result.tableName}`);
        console.log(`   レコードID: ${result.recordId}`);
        console.log(`   フィールド: ${result.field}`);
        console.log(`   位置: ${result.position}`);
        console.log(`   プレビュー: ${result.preview}`);
      });
      
      if (bomResults.length > 20) {
        console.log(`\n... 他 ${bomResults.length - 20}件`);
      }
    }
    
    // 結果をJSONファイルに保存
    const resultPath = path.join(process.cwd(), 'bom-check-results.json');
    fs.writeFileSync(resultPath, JSON.stringify({
      timestamp: new Date().toISOString(),
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
  console.log('🚀 本番環境のLanceDBデータでBOMチェックを開始...\n');
  console.log(`📦 Bucket: ${bucketName}`);
  console.log(`🌍 Project: ${process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye'}\n`);
  
  try {
    // 本番環境のデータをダウンロード
    const dbPath = await downloadProductionData();
    
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

