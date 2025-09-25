/**
 * LanceDBデータベース分析スクリプト
 * データベースの状態、ページ数、チャンク数、ラベル分布などを詳細に分析
 */

import { LanceDBClient } from './src/lib/lancedb-client';

interface DatabaseAnalysis {
  totalChunks: number;
  uniquePages: number;
  averageChunksPerPage: number;
  labelDistribution: Record<string, number>;
  spaceDistribution: Record<string, number>;
  topPages: Array<{
    pageId: number;
    title: string;
    chunkCount: number;
    labels: string[];
    lastUpdated: string;
  }>;
  classroomPages: Array<{
    pageId: number;
    title: string;
    chunkCount: number;
    labels: string[];
    lastUpdated: string;
  }>;
  missingClassroomPages: string[];
  dataQuality: {
    emptyLabels: number;
    emptyContent: number;
    invalidDates: number;
  };
}

async function analyzeLanceDBDatabase(): Promise<DatabaseAnalysis> {
  console.log('🔍 LanceDBデータベース分析を開始...');
  
  const lancedbClient = LanceDBClient.getInstance();
  await lancedbClient.connect();
  const table = await lancedbClient.getTable();
  
  // 全データを取得
  const dummyVector = new Array(768).fill(0);
  const allData = await table.search(dummyVector).limit(50000).toArray();
  
  console.log(`📊 総チャンク数: ${allData.length}`);
  
  // 基本統計
  const uniquePageIds = new Set<number>();
  const labelCounts: Record<string, number> = {};
  const spaceCounts: Record<string, number> = {};
  const pageStats: Record<number, {
    title: string;
    chunkCount: number;
    labels: string[];
    lastUpdated: string;
  }> = {};
  
  let emptyLabels = 0;
  let emptyContent = 0;
  let invalidDates = 0;
  
  // データ分析
  allData.forEach((row: any) => {
    uniquePageIds.add(row.pageId);
    
    // ページ統計の集計
    if (!pageStats[row.pageId]) {
      pageStats[row.pageId] = {
        title: row.title || 'No Title',
        chunkCount: 0,
        labels: row.labels || [],
        lastUpdated: row.lastUpdated || 'Unknown'
      };
    }
    pageStats[row.pageId].chunkCount++;
    
    // ラベル分布
    if (row.labels && Array.isArray(row.labels) && row.labels.length > 0) {
      row.labels.forEach((label: string) => {
        labelCounts[label] = (labelCounts[label] || 0) + 1;
      });
    } else {
      emptyLabels++;
    }
    
    // スペース分布
    if (row.space_key) {
      spaceCounts[row.space_key] = (spaceCounts[row.space_key] || 0) + 1;
    }
    
    // データ品質チェック
    if (!row.content || row.content.trim().length === 0) {
      emptyContent++;
    }
    
    if (!row.lastUpdated || row.lastUpdated === 'Unknown') {
      invalidDates++;
    }
  });
  
  const uniquePages = uniquePageIds.size;
  const averageChunksPerPage = allData.length / uniquePages;
  
  // ページ統計を配列に変換してソート
  const topPages = Object.entries(pageStats)
    .map(([pageId, stats]) => ({
      pageId: parseInt(pageId),
      ...stats
    }))
    .sort((a, b) => b.chunkCount - a.chunkCount)
    .slice(0, 20);
  
  // 教室管理関連ページの検索
  const classroomKeywords = [
    '教室管理', '教室一覧', '教室登録', '教室編集', '教室削除', '教室コピー',
    '教室掲載', '教室公開', '教室グループ', '教室詳細', '教室基本情報'
  ];
  
  const classroomPages = Object.entries(pageStats)
    .map(([pageId, stats]) => ({
      pageId: parseInt(pageId),
      ...stats
    }))
    .filter(page => 
      classroomKeywords.some(keyword => 
        page.title.includes(keyword) || 
        page.labels.some(label => label.includes(keyword))
      )
    )
    .sort((a, b) => b.chunkCount - a.chunkCount);
  
  // 期待される教室管理ページのリスト
  const expectedClassroomPages = [
    '160_【FIX】教室管理機能',
    '161_【FIX】教室一覧閲覧機能',
    '162_【FIX】教室新規登録機能',
    '163_【FIX】教室情報編集機能',
    '168_【FIX】教室コピー機能',
    '169-1_【FIX】教室掲載フラグ切り替え機能',
    '169-2_【FIX】教室公開フラグ切り替え機能',
    '164_【FIX】教室削除機能',
    '511_【FIX】教室管理-求人一覧閲覧機能',
    '512_【FIX】教室管理-求人情報新規登録機能',
    '513_【FIX】教室管理-求人情報編集機能',
    '514_【レビュー中】教室管理-求人削除機能',
    '515_【作成中】教室管理-教室コピー機能',
    '516_【FIX】教室管理-一括更新機能'
  ];
  
  const foundPageTitles = classroomPages.map(p => p.title);
  const missingClassroomPages = expectedClassroomPages.filter(
    expectedPage => !foundPageTitles.some(foundTitle => foundTitle.includes(expectedPage))
  );
  
  const analysis: DatabaseAnalysis = {
    totalChunks: allData.length,
    uniquePages,
    averageChunksPerPage: Math.round(averageChunksPerPage * 100) / 100,
    labelDistribution: labelCounts,
    spaceDistribution: spaceCounts,
    topPages,
    classroomPages,
    missingClassroomPages,
    dataQuality: {
      emptyLabels,
      emptyContent,
      invalidDates
    }
  };
  
  return analysis;
}

async function printAnalysisReport(analysis: DatabaseAnalysis): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('📊 LanceDBデータベース分析レポート');
  console.log('='.repeat(80));
  
  // 基本統計
  console.log('\n📈 基本統計:');
  console.log(`  総チャンク数: ${analysis.totalChunks.toLocaleString()}件`);
  console.log(`  ユニークページ数: ${analysis.uniquePages.toLocaleString()}ページ`);
  console.log(`  平均チャンク数/ページ: ${analysis.averageChunksPerPage}チャンク`);
  
  // ラベル分布
  console.log('\n🏷️ ラベル分布（上位20件）:');
  const sortedLabels = Object.entries(analysis.labelDistribution)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20);
  
  sortedLabels.forEach(([label, count], index) => {
    const percentage = ((count / analysis.totalChunks) * 100).toFixed(1);
    console.log(`  ${index + 1}. ${label}: ${count}件 (${percentage}%)`);
  });
  
  // スペース分布
  console.log('\n🌐 スペース分布:');
  const sortedSpaces = Object.entries(analysis.spaceDistribution)
    .sort(([,a], [,b]) => b - a);
  
  sortedSpaces.forEach(([space, count], index) => {
    const percentage = ((count / analysis.totalChunks) * 100).toFixed(1);
    console.log(`  ${index + 1}. ${space}: ${count}件 (${percentage}%)`);
  });
  
  // 教室管理関連ページ
  console.log('\n🏫 教室管理関連ページ:');
  if (analysis.classroomPages.length > 0) {
    analysis.classroomPages.forEach((page, index) => {
      console.log(`  ${index + 1}. ${page.title}`);
      console.log(`     ページID: ${page.pageId}, チャンク数: ${page.chunkCount}, ラベル: [${page.labels.join(', ')}]`);
    });
  } else {
    console.log('  ❌ 教室管理関連ページが見つかりませんでした');
  }
  
  // 不足している教室管理ページ
  console.log('\n❌ 不足している教室管理ページ:');
  if (analysis.missingClassroomPages.length > 0) {
    analysis.missingClassroomPages.forEach((page, index) => {
      console.log(`  ${index + 1}. ${page}`);
    });
  } else {
    console.log('  ✅ すべての期待される教室管理ページが存在します');
  }
  
  // データ品質
  console.log('\n🔍 データ品質:');
  console.log(`  空のラベル: ${analysis.dataQuality.emptyLabels}件`);
  console.log(`  空のコンテンツ: ${analysis.dataQuality.emptyContent}件`);
  console.log(`  無効な日付: ${analysis.dataQuality.invalidDates}件`);
  
  // チャンク数上位ページ
  console.log('\n📋 チャンク数上位ページ（上位10件）:');
  analysis.topPages.slice(0, 10).forEach((page, index) => {
    console.log(`  ${index + 1}. ${page.title}`);
    console.log(`     ページID: ${page.pageId}, チャンク数: ${page.chunkCount}, ラベル: [${page.labels.join(', ')}]`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ データベース分析完了');
  console.log('='.repeat(80));
}

// メイン実行
async function main(): Promise<void> {
  try {
    const analysis = await analyzeLanceDBDatabase();
    await printAnalysisReport(analysis);
  } catch (error) {
    console.error('❌ データベース分析エラー:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { analyzeLanceDBDatabase, DatabaseAnalysis };
