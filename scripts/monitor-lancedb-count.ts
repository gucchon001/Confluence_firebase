/**
 * LanceDBデータベース件数監視スクリプト
 * データベース作成中の件数を定期的にチェックして、終了を検知
 */

import * as lancedb from '@lancedb/lancedb';

async function checkCount(): Promise<number> {
  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    const count = await table.countRows();
    return count;
  } catch (error) {
    console.error('❌ エラー:', error);
    return -1;
  }
}

async function monitor(countInterval: number = 5000, maxStableCount: number = 3) {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   LanceDBデータベース件数監視スクリプト                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📊 監視設定:`);
  console.log(`   - チェック間隔: ${countInterval / 1000}秒`);
  console.log(`   - 安定回数: ${maxStableCount}回（連続して同じ件数なら終了判定）\n`);
  
  let previousCount = -1;
  let stableCount = 0;
  let checkNumber = 0;
  
  while (true) {
    checkNumber++;
    const currentCount = await checkCount();
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    
    if (currentCount === -1) {
      console.log(`[${timestamp}] ❌ データベースにアクセスできません`);
      await new Promise(resolve => setTimeout(resolve, countInterval));
      continue;
    }
    
    if (previousCount === -1) {
      console.log(`[${timestamp}] 📊 初期件数: ${currentCount.toLocaleString()}件`);
      previousCount = currentCount;
    } else if (currentCount === previousCount) {
      stableCount++;
      console.log(`[${timestamp}] ✅ 件数: ${currentCount.toLocaleString()}件 (変化なし ${stableCount}/${maxStableCount})`);
      
      if (stableCount >= maxStableCount) {
        console.log('\n═══════════════════════════════════════════════════════════════\n');
        console.log('✅ データベース作成が完了したと判断されます');
        console.log(`📊 最終件数: ${currentCount.toLocaleString()}件`);
        console.log(`🔄 チェック回数: ${checkNumber}回\n`);
        break;
      }
    } else {
      stableCount = 0;
      const diff = currentCount - previousCount;
      const diffStr = diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString();
      console.log(`[${timestamp}] 📈 件数: ${currentCount.toLocaleString()}件 (${diffStr})`);
      previousCount = currentCount;
    }
    
    await new Promise(resolve => setTimeout(resolve, countInterval));
  }
}

async function main() {
  const interval = parseInt(process.argv[2] || '5000', 10);
  const stableCount = parseInt(process.argv[3] || '3', 10);
  
  await monitor(interval, stableCount);
}

if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  });
}

