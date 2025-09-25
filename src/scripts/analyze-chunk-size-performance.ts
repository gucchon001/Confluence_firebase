import 'dotenv/config';
import { LanceDBClient } from '../lib/lancedb-client';

async function analyzeChunkSizePerformance() {
  console.log('📊 チャンクサイズのパフォーマンス分析');
  
  const client = LanceDBClient.getInstance();
  await client.connect();
  const table = await client.getTable();
  
  // 全データを取得してチャンクサイズを分析
  const allData = await table.search(new Array(768).fill(0)).limit(10000).toArray();
  
  console.log(`📊 総チャンク数: ${allData.length}件`);
  
  // チャンクサイズの分布を分析
  const chunkSizes = allData.map((chunk: any) => chunk.content?.length || 0);
  const validSizes = chunkSizes.filter(size => size > 0);
  
  if (validSizes.length === 0) {
    console.log('❌ 有効なチャンクデータが見つかりません');
    return;
  }
  
  // 統計情報を計算
  const minSize = Math.min(...validSizes);
  const maxSize = Math.max(...validSizes);
  const avgSize = validSizes.reduce((sum, size) => sum + size, 0) / validSizes.length;
  const medianSize = validSizes.sort((a, b) => a - b)[Math.floor(validSizes.length / 2)];
  
  console.log('\n📏 チャンクサイズ統計:');
  console.log(`  最小サイズ: ${minSize}文字`);
  console.log(`  最大サイズ: ${maxSize}文字`);
  console.log(`  平均サイズ: ${avgSize.toFixed(1)}文字`);
  console.log(`  中央値: ${medianSize}文字`);
  
  // サイズ分布を分析
  const sizeRanges = [
    { min: 0, max: 500, label: '500文字未満' },
    { min: 500, max: 1000, label: '500-1000文字' },
    { min: 1000, max: 1500, label: '1000-1500文字' },
    { min: 1500, max: 2000, label: '1500-2000文字' },
    { min: 2000, max: 2500, label: '2000-2500文字' },
    { min: 2500, max: Infinity, label: '2500文字以上' }
  ];
  
  console.log('\n📊 サイズ分布:');
  sizeRanges.forEach(range => {
    const count = validSizes.filter(size => size >= range.min && size < range.max).length;
    const percentage = (count / validSizes.length * 100).toFixed(1);
    console.log(`  ${range.label}: ${count}件 (${percentage}%)`);
  });
  
  // 現在の設定（1800文字）の評価
  const currentChunkSize = 1800;
  const chunksAtTarget = validSizes.filter(size => Math.abs(size - currentChunkSize) <= 200).length;
  const percentageAtTarget = (chunksAtTarget / validSizes.length * 100).toFixed(1);
  
  console.log(`\n🎯 現在の設定評価 (${currentChunkSize}文字):`);
  console.log(`  目標サイズ±200文字以内: ${chunksAtTarget}件 (${percentageAtTarget}%)`);
  
  // パフォーマンス最適化の推奨事項
  console.log('\n💡 パフォーマンス最適化の推奨事項:');
  
  if (avgSize < 1000) {
    console.log('  ⚠️  平均チャンクサイズが小さいです。検索精度が低下する可能性があります。');
    console.log('  💡 推奨: チャンクサイズを1000-1500文字に増やすことを検討してください。');
  } else if (avgSize > 2500) {
    console.log('  ⚠️  平均チャンクサイズが大きすぎます。メモリ使用量と検索時間が増加します。');
    console.log('  💡 推奨: チャンクサイズを1500-2000文字に減らすことを検討してください。');
  } else {
    console.log('  ✅ 現在のチャンクサイズは適切な範囲内です。');
  }
  
  // 埋め込みベクトルの次元数との関係
  console.log('\n🔢 埋め込みベクトルとの関係:');
  console.log('  ベクトル次元数: 768次元');
  console.log('  推奨チャンクサイズ: 1000-2000文字');
  console.log('  現在の設定: 1800文字 ✅');
  
  // メモリ使用量の推定
  const estimatedMemoryPerChunk = 768 * 4 + currentChunkSize * 2; // ベクトル(4byte) + テキスト(2byte/char)
  const totalMemoryUsage = allData.length * estimatedMemoryPerChunk;
  
  console.log('\n💾 メモリ使用量推定:');
  console.log(`  チャンクあたり: ${(estimatedMemoryPerChunk / 1024).toFixed(1)}KB`);
  console.log(`  総使用量: ${(totalMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
  
  // 検索パフォーマンスの推定
  console.log('\n⚡ 検索パフォーマンス推定:');
  console.log('  ベクトル検索: 768次元の内積計算');
  console.log('  テキスト検索: 1800文字以内の文字列マッチング');
  console.log('  推奨: 現在の設定は検索パフォーマンスに適しています');
}

analyzeChunkSizePerformance().catch(console.error);
