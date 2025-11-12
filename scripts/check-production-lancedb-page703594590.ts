/**
 * 本番環境のLanceDBからpageId=703594590のstructured_tagsを確認するスクリプト
 */

import * as lancedb from '@lancedb/lancedb';
import * as fs from 'fs';
import * as path from 'path';
import { Storage } from '@google-cloud/storage';
import { getLabelsAsArray } from '../src/lib/label-utils';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye';
const BUCKET_NAME = process.env.STORAGE_BUCKET || 'confluence-copilot-data';
const TARGET_PAGE_ID = 703594590;

async function downloadProductionLanceDB(): Promise<string> {
  const tempDir = path.join(process.cwd(), '.temp-production-check');
  const localLancePath = path.join(tempDir, '.lancedb', 'confluence.lance');
  const remotePath = 'lancedb/confluence.lance';
  
  // 既存のダウンロードファイルがあるか確認
  if (fs.existsSync(localLancePath)) {
    try {
      const files = fs.readdirSync(localLancePath, { recursive: true });
      if (files.length > 0) {
        console.log(`📋 既存のダウンロードファイルを使用: ${files.length}ファイル\n`);
        return path.join(tempDir, '.lancedb');
      }
    } catch (error) {
      // ディレクトリが存在しない、または空の場合
    }
  }
  
  console.log('📥 本番環境のLanceDBデータをダウンロード中...\n');
  console.log(`   Bucket: ${BUCKET_NAME}`);
  console.log(`   Project: ${PROJECT_ID}\n`);
  
  // ローカルディレクトリをクリーンアップ
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(localLancePath, { recursive: true });
  
  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);
  
  try {
    // Cloud Storageからファイルをダウンロード
    const [files] = await bucket.getFiles({ prefix: remotePath + '/' });
    
    console.log(`📊 見つかったファイル数: ${files.length}\n`);
    
    if (files.length === 0) {
      throw new Error(`No files found at ${remotePath}`);
    }
    
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
    
    return path.join(tempDir, '.lancedb');
  } catch (error: any) {
    console.error('❌ ダウンロードエラー:', error.message);
    throw error;
  }
}

async function checkPage703594590(lancedbPath: string): Promise<void> {
  console.log('🔍 pageId=703594590のデータを確認中...\n');
  
  try {
    const db = await lancedb.connect(lancedbPath);
    const table = await db.openTable('confluence');
    
    // 全データを取得してpageId=703594590を探す
    console.log('📥 LanceDBから全データを取得中...\n');
    const dummyVector = new Array(768).fill(0);
    const allResults = await table.search(dummyVector).limit(10000).toArray();
    
    console.log(`📊 全データ件数: ${allResults.length}件\n`);
    
    // pageId=703594590を探す
    const targetResults = allResults.filter((row: any) => {
      const rowPageId = row.page_id || row.pageId;
      const rowPageIdNum = typeof rowPageId === 'bigint' ? Number(rowPageId) : Number(rowPageId);
      return rowPageIdNum === TARGET_PAGE_ID;
    });
    
    console.log(`🔍 pageId=${TARGET_PAGE_ID} の結果: ${targetResults.length}件\n`);
    
    if (targetResults.length === 0) {
      console.log('❌ pageId=703594590が見つかりませんでした\n');
      return;
    }
    
    // 最初の結果を詳細表示
    const result = targetResults[0];
    console.log('📋 レコード詳細:\n');
    console.log(`  title: ${result.title || 'N/A'}`);
    console.log(`  page_id: ${result.page_id || result.pageId || 'N/A'}`);
    console.log(`  page_id (type): ${typeof (result.page_id || result.pageId)}`);
    console.log('');
    
    // structured_tagsの生データを確認
    console.log('🏷️ structured_tags の生データ:\n');
    console.log(`  structured_tags (raw):`, result.structured_tags);
    console.log(`  structured_tags (type): ${typeof result.structured_tags}`);
    console.log(`  structured_tags (isArray): ${Array.isArray(result.structured_tags)}`);
    console.log(`  structured_tags (constructor): ${result.structured_tags?.constructor?.name || 'N/A'}`);
    console.log('');
    
    // getLabelsAsArrayで変換
    console.log('🔄 getLabelsAsArrayで変換:\n');
    const tagsArray = getLabelsAsArray(result.structured_tags);
    console.log(`  tagsArray:`, tagsArray);
    console.log(`  tagsArray.length: ${tagsArray.length}`);
    console.log(`  tagsArray (type): ${typeof tagsArray}`);
    console.log(`  tagsArray (isArray): ${Array.isArray(tagsArray)}`);
    console.log('');
    
    // 各タグを表示
    if (tagsArray.length > 0) {
      console.log('📋 タグ一覧:\n');
      tagsArray.forEach((tag, index) => {
        console.log(`  ${index + 1}. "${tag}" (type: ${typeof tag})`);
      });
      console.log('');
      
      // 退会関連のタグをチェック
      const withdrawalTags = tagsArray.filter((tag: string) => 
        tag.toLowerCase().includes('退会') || 
        tag.toLowerCase().includes('再登録') ||
        tag.toLowerCase().includes('メールアドレス') ||
        tag.toLowerCase().includes('パスワード再設定')
      );
      if (withdrawalTags.length > 0) {
        console.log(`✅ 退会関連タグ: ${withdrawalTags.join(', ')}\n`);
      } else {
        console.log(`⚠️ 退会関連タグが見つかりませんでした\n`);
      }
    } else {
      console.log('❌ タグが空です\n');
    }
    
    // 他のstructured_*フィールドも確認
    console.log('📋 その他のStructuredLabelフィールド:\n');
    console.log(`  structured_category: ${result.structured_category || 'N/A'}`);
    console.log(`  structured_domain: ${result.structured_domain || 'N/A'}`);
    console.log(`  structured_feature: ${result.structured_feature || 'N/A'}`);
    console.log(`  structured_status: ${result.structured_status || 'N/A'}`);
    console.log('');
    
    // ローカル環境と比較
    console.log('🔄 ローカル環境との比較:\n');
    try {
      const localDb = await lancedb.connect('.lancedb');
      const localTable = await localDb.openTable('confluence');
      const localDummyVector = new Array(768).fill(0);
      const localAllResults = await localTable.search(localDummyVector).limit(10000).toArray();
      const localTargetResults = localAllResults.filter((row: any) => {
        const rowPageId = row.page_id || row.pageId;
        const rowPageIdNum = typeof rowPageId === 'bigint' ? Number(rowPageId) : Number(rowPageId);
        return rowPageIdNum === TARGET_PAGE_ID;
      });
      
      if (localTargetResults.length > 0) {
        const localResult = localTargetResults[0];
        const localTagsArray = getLabelsAsArray(localResult.structured_tags);
        console.log(`  ローカル環境のタグ: ${localTagsArray.join(', ') || 'N/A'}`);
        console.log(`  本番環境のタグ: ${tagsArray.join(', ') || 'N/A'}`);
        console.log('');
        
        if (localTagsArray.length === tagsArray.length && 
            localTagsArray.every((tag, i) => tag === tagsArray[i])) {
          console.log('✅ ローカル環境と本番環境のタグは一致しています\n');
        } else {
          console.log('⚠️ ローカル環境と本番環境のタグが異なります\n');
          console.log('   差異:');
          const localSet = new Set(localTagsArray);
          const prodSet = new Set(tagsArray);
          const onlyLocal = localTagsArray.filter(t => !prodSet.has(t));
          const onlyProd = tagsArray.filter(t => !localSet.has(t));
          if (onlyLocal.length > 0) {
            console.log(`     ローカルのみ: ${onlyLocal.join(', ')}`);
          }
          if (onlyProd.length > 0) {
            console.log(`     本番のみ: ${onlyProd.join(', ')}`);
          }
          console.log('');
        }
      } else {
        console.log('⚠️ ローカル環境でpageId=703594590が見つかりませんでした\n');
      }
    } catch (error) {
      console.log('⚠️ ローカル環境との比較をスキップしました\n');
    }
    
    console.log('✅ 確認完了\n');
    
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    throw error;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   本番環境 LanceDB pageId=703594590 確認スクリプト              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  try {
    // 本番環境のLanceDBデータをダウンロード
    const lancedbPath = await downloadProductionLanceDB();
    
    // pageId=703594590のデータを確認
    await checkPage703594590(lancedbPath);
    
    // 一時ディレクトリをクリーンアップ（オプション）
    // const tempDir = path.join(process.cwd(), '.temp-production-check');
    // if (fs.existsSync(tempDir)) {
    //   fs.rmSync(tempDir, { recursive: true, force: true });
    //   console.log('🧹 一時ディレクトリをクリーンアップしました\n');
    // }
    
  } catch (error: any) {
    console.error('❌ スクリプト実行エラー:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
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

