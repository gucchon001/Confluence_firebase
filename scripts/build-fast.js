#!/usr/bin/env node
/**
 * 高速ビルド（データダウンロードをスキップ）
 */

const { execSync } = require('child_process');

console.log('🚀 Fast build mode (skipping data download)...\n');

process.env.SKIP_DATA_DOWNLOAD = 'true';

try {
  execSync('npm run build', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, SKIP_DATA_DOWNLOAD: 'true' }
  });
} catch (error) {
  process.exit(error.status || 1);
}

