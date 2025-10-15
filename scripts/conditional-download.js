#!/usr/bin/env node
/**
 * 条件付きデータダウンロードスクリプト
 * SKIP_DATA_DOWNLOAD=true の場合はスキップ
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 環境変数をチェック
const skipDownload = process.env.SKIP_DATA_DOWNLOAD === 'true';

console.log('🔧 Conditional data download check...');
console.log(`📦 SKIP_DATA_DOWNLOAD: ${process.env.SKIP_DATA_DOWNLOAD || 'not set'}`);

// ローカルキャッシュが存在するかチェック
const lancedbPath = path.join(process.cwd(), '.lancedb');
const hasLocalCache = fs.existsSync(lancedbPath);

// スキップ条件: 1) 明示的にスキップ指定 または 2) ローカルキャッシュが存在
const shouldSkip = skipDownload || hasLocalCache;

if (shouldSkip) {
  if (skipDownload) {
    console.log('⏩ Skipping data download (SKIP_DATA_DOWNLOAD=true)');
  } else if (hasLocalCache) {
    console.log('⏩ Skipping data download (local cache found)');
  }
  console.log('ℹ️  Data will be loaded at runtime from Cloud Storage or local cache');
  
  if (hasLocalCache) {
    console.log('✅ Local .lancedb cache found - will use existing data');
  } else {
    console.log('⚠️  No local .lancedb cache found - ensure data is available at runtime');
  }
  
  process.exit(0);
}

// データをダウンロード
console.log('📥 Downloading production data...');
try {
  execSync('npx tsx scripts/download-production-data.ts', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Data download completed');
} catch (error) {
  console.error('❌ Data download failed:', error.message);
  process.exit(1);
}

