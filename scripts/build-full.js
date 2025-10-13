#!/usr/bin/env node
/**
 * フルビルド（データダウンロードを実行）
 */

const { execSync } = require('child_process');

console.log('🏗️  Full build mode (downloading data)...\n');

process.env.SKIP_DATA_DOWNLOAD = 'false';

try {
  execSync('npm run build', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, SKIP_DATA_DOWNLOAD: 'false' }
  });
} catch (error) {
  process.exit(error.status || 1);
}

