/**
 * ラベル分布の詳細分析
 */

import { searchLanceDB } from './src/lib/lancedb-search-client';

async function checkLabelDistribution() {
  console.log('🏷️ ラベル分布の詳細分析...');
  
  try {
    // 全データを取得してラベル分布を分析
    const results = await searchLanceDB({
      query: '機能要件',
      topK: 100,
      tableName: 'confluence',
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    });
    
    console.log(`📊 取得したページ数: ${results.length}件`);
    
    // ラベル分布の集計
    const labelCounts: Record<string, number> = {};
    const pageCounts: Record<string, Set<string>> = {};
    
    results.forEach(result => {
      if (result.labels && Array.isArray(result.labels)) {
        result.labels.forEach((label: string) => {
          labelCounts[label] = (labelCounts[label] || 0) + 1;
          
          if (!pageCounts[label]) {
            pageCounts[label] = new Set();
          }
          pageCounts[label].add(result.title);
        });
      }
    });
    
    console.log('\n🏷️ ラベル分布（チャンク数ベース）:');
    const sortedLabels = Object.entries(labelCounts)
      .sort(([,a], [,b]) => b - a);
    
    sortedLabels.forEach(([label, count], index) => {
      const pageCount = pageCounts[label]?.size || 0;
      console.log(`  ${index + 1}. ${label}: ${count}チャンク (${pageCount}ページ)`);
    });
    
    // 教室管理関連のラベル分析
    console.log('\n🏫 教室管理関連ラベル分析:');
    const classroomLabels = Object.keys(labelCounts).filter(label => 
      label.includes('教室') || label.includes('管理') || label.includes('機能')
    );
    
    if (classroomLabels.length > 0) {
      classroomLabels.forEach(label => {
        const count = labelCounts[label];
        const pageCount = pageCounts[label]?.size || 0;
        console.log(`  ${label}: ${count}チャンク (${pageCount}ページ)`);
      });
    } else {
      console.log('  教室管理関連のラベルが見つかりませんでした');
    }
    
    console.log('\n✅ ラベル分布分析完了');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkLabelDistribution();
