/**
 * Phase 0A-4: Cloud Run Gen2 インメモリファイルシステム対応
 * 
 * GCSからLanceDBファイルとドメイン知識データをダウンロードし、
 * /dev/shm (インメモリファイルシステム) にコピーする
 * 
 * メリット:
 * - enrichWithAllChunks の処理時間: 31秒 → 1秒未満
 * - ディスクI/OからメモリI/Oへの変更による爆発的な速度改善
 * 
 * デメリット:
 * - メモリ消費: LanceDBファイルサイズ分（約50MB）
 * - コールドスタート: 初回起動時にGCSからダウンロード（5-10秒）
 */

const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const { execSync } = require('child_process');

// GCS設定
const BUCKET_NAME = process.env.STORAGE_BUCKET || 'confluence-firebase-c3a86.firebasestorage.app';
const GCS_LANCEDB_PATH = 'production-data/.lancedb';
const GCS_DOMAIN_KNOWLEDGE_PATH = 'production-data/data';

// インメモリファイルシステムのパス
const INMEMORY_ROOT = '/dev/shm';
const INMEMORY_LANCEDB_PATH = path.join(INMEMORY_ROOT, '.lancedb');
const INMEMORY_DATA_PATH = path.join(INMEMORY_ROOT, 'data');

/**
 * GCSからファイルをダウンロードしてインメモリファイルシステムにコピー
 */
async function loadDataToMemory() {
  const startTime = Date.now();
  console.log('🔥 [InMemoryLoader] データのメモリロード開始...');
  
  try {
    // Cloud Storage クライアント初期化
    const storage = new Storage();
    const bucket = storage.bucket(BUCKET_NAME);
    
    // 1. LanceDBファイルのダウンロード
    console.log(`📦 [InMemoryLoader] LanceDBファイルをダウンロード中...`);
    const lancedbDownloadStart = Date.now();
    
    // /dev/shm/.lancedb ディレクトリを作成
    if (!fs.existsSync(INMEMORY_LANCEDB_PATH)) {
      fs.mkdirSync(INMEMORY_LANCEDB_PATH, { recursive: true });
    }
    
    // GCSから .lancedb ディレクトリの全ファイルをダウンロード
    const [lancedbFiles] = await bucket.getFiles({ prefix: GCS_LANCEDB_PATH });
    
    let totalSize = 0;
    for (const file of lancedbFiles) {
      const fileName = file.name.replace(`${GCS_LANCEDB_PATH}/`, '');
      if (!fileName) continue; // ディレクトリ自体はスキップ
      
      const destPath = path.join(INMEMORY_LANCEDB_PATH, fileName);
      const destDir = path.dirname(destPath);
      
      // サブディレクトリを作成
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      // ファイルをダウンロード
      await file.download({ destination: destPath });
      
      const fileSize = fs.statSync(destPath).size;
      totalSize += fileSize;
      console.log(`   ✅ ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    }
    
    const lancedbDownloadDuration = Date.now() - lancedbDownloadStart;
    console.log(`✅ [InMemoryLoader] LanceDBダウンロード完了: ${lancedbDownloadDuration}ms, 総サイズ: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // 2. ドメイン知識データのダウンロード
    console.log(`📦 [InMemoryLoader] ドメイン知識データをダウンロード中...`);
    const dataDownloadStart = Date.now();
    
    // /dev/shm/data ディレクトリを作成
    if (!fs.existsSync(INMEMORY_DATA_PATH)) {
      fs.mkdirSync(INMEMORY_DATA_PATH, { recursive: true });
    }
    
    // GCSから data ディレクトリの全ファイルをダウンロード
    const [dataFiles] = await bucket.getFiles({ prefix: GCS_DOMAIN_KNOWLEDGE_PATH });
    
    let dataTotalSize = 0;
    for (const file of dataFiles) {
      const fileName = file.name.replace(`${GCS_DOMAIN_KNOWLEDGE_PATH}/`, '');
      if (!fileName) continue;
      
      const destPath = path.join(INMEMORY_DATA_PATH, fileName);
      const destDir = path.dirname(destPath);
      
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      await file.download({ destination: destPath });
      
      const fileSize = fs.statSync(destPath).size;
      dataTotalSize += fileSize;
      console.log(`   ✅ ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    }
    
    const dataDownloadDuration = Date.now() - dataDownloadStart;
    console.log(`✅ [InMemoryLoader] ドメイン知識ダウンロード完了: ${dataDownloadDuration}ms, 総サイズ: ${(dataTotalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // 3. メモリ使用状況の確認
    try {
      const memInfo = execSync('free -m').toString();
      console.log('📊 [InMemoryLoader] メモリ使用状況:');
      console.log(memInfo);
    } catch (error) {
      console.warn('⚠️  [InMemoryLoader] メモリ情報取得失敗（free コマンドなし）');
    }
    
    const totalDuration = Date.now() - startTime;
    const totalDataSize = (totalSize + dataTotalSize) / 1024 / 1024;
    console.log(`🎉 [InMemoryLoader] 全データのメモリロード完了: ${totalDuration}ms, 総データサイズ: ${totalDataSize.toFixed(2)} MB`);
    console.log(`   - LanceDB: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Domain Knowledge: ${(dataTotalSize / 1024 / 1024).toFixed(2)} MB`);
    
    return {
      success: true,
      duration: totalDuration,
      lancedbSize: totalSize,
      dataSize: dataTotalSize,
      totalSize: totalSize + dataTotalSize
    };
    
  } catch (error) {
    console.error('❌ [InMemoryLoader] メモリロード失敗:', error);
    throw error;
  }
}

/**
 * インメモリファイルシステムのパスを取得
 */
function getInMemoryPath(originalPath) {
  const useInMemoryFS = process.env.USE_INMEMORY_FS === 'true' && process.env.K_SERVICE !== undefined;
  
  if (!useInMemoryFS) {
    return originalPath;
  }
  
  // .lancedb パスの変換
  if (originalPath.includes('.lancedb')) {
    return originalPath.replace(/^.*\.lancedb/, INMEMORY_LANCEDB_PATH);
  }
  
  // data パスの変換
  if (originalPath.includes('/data/')) {
    return originalPath.replace(/^.*\/data/, INMEMORY_DATA_PATH);
  }
  
  return originalPath;
}

module.exports = {
  loadDataToMemory,
  getInMemoryPath,
  INMEMORY_LANCEDB_PATH,
  INMEMORY_DATA_PATH
};

