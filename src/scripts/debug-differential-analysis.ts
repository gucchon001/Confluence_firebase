/**
 * 差分分析のデバッグスクリプト
 * 新規追加として扱われているページを詳細に分析
 */

import 'dotenv/config';
import axios from 'axios';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getConfluencePages } from './batch-sync-confluence';
import { 
  compareDates, 
  isNewerThan, 
  getDateComparisonDebugInfo,
  formatDateForDisplay,
  getRelativeTime
} from '../lib/date-comparison-utils';

interface ConfluencePage {
  id: string;
  title: string;
  version?: { when: string; };
  space?: { key: string; };
}

// getConfluencePages関数はbatch-sync-confluenceからインポート

/**
 * LanceDBから既存のページデータを取得
 */
async function getExistingLanceDBData(table: any): Promise<Map<string, { lastUpdated: string; title: string; }>> {
  try {
    const existingData = new Map<string, { lastUpdated: string; title: string; }>();
    
    const records = await table.query().select(['pageId', 'lastUpdated', 'title']).toArray();
    
    for (const record of records) {
      const pageId = String(record.pageId || '');
      if (pageId) {
        existingData.set(pageId, {
          lastUpdated: String(record.lastUpdated || ''),
          title: String(record.title || '')
        });
      }
    }
    
    return existingData;
  } catch (error) {
    console.error('LanceDB既存データ取得エラー:', error);
    return new Map();
  }
}

/**
 * ページの更新日時を比較して更新が必要かどうかを判定
 */
function shouldUpdatePage(confluencePage: ConfluencePage, lancedbData: { lastUpdated: string; title: string; }): {
  needsUpdate: boolean;
  debugInfo: any;
} {
  const confluenceLastModified = confluencePage.version?.when;
  const lancedbLastUpdated = lancedbData.lastUpdated;

  const debugInfo = getDateComparisonDebugInfo(
    confluenceLastModified,
    lancedbLastUpdated,
    'Confluence',
    'LanceDB'
  );

  // 日時が無効な場合は更新が必要と判定
  if (!confluenceLastModified || !lancedbLastUpdated) {
    return { needsUpdate: true, debugInfo };
  }

  const needsUpdate = isNewerThan(confluenceLastModified, lancedbLastUpdated);
  return { needsUpdate, debugInfo };
}

async function debugDifferentialAnalysis() {
  try {
    console.log('🔍 差分分析のデバッグを開始');
    console.log('='.repeat(60));

    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
    if (!spaceKey) throw new Error('CONFLUENCE_SPACE_KEY not set');

    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const table = await db.openTable('confluence');
    
    // 既存データを取得
    const existingLanceDBData = await getExistingLanceDBData(table);
    console.log(`📊 LanceDB既存データ: ${existingLanceDBData.size}ページ`);

    // Confluenceから最初の100ページを取得
    const confluencePages = await getConfluencePages(spaceKey, 0, 100);
    console.log(`📊 Confluenceページ: ${confluencePages.length}ページ`);

    // 分析結果
    const newPages: ConfluencePage[] = [];
    const updatePages: ConfluencePage[] = [];
    const skipPages: ConfluencePage[] = [];

    console.log('\n🔍 ページ分析結果:');
    console.log('-'.repeat(60));

    for (const page of confluencePages) {
      const pageId = page.id;
      const existingData = existingLanceDBData.get(pageId);
      
      if (existingData) {
        // 既存ページ - 日時比較で更新が必要かチェック
        const { needsUpdate, debugInfo } = shouldUpdatePage(page, existingData);
        if (needsUpdate) {
          updatePages.push(page);
          console.log(`📝 更新が必要: ${page.title}`);
          console.log(`   Confluence: ${debugInfo.date1.display}`);
          console.log(`   LanceDB: ${debugInfo.date2.display}`);
          console.log(`   差分: ${debugInfo.comparison.differenceMs}ms`);
        } else {
          skipPages.push(page);
          console.log(`✅ 更新不要: ${page.title}`);
        }
      } else {
        // 新規ページ
        newPages.push(page);
        console.log(`➕ 新規追加: ${page.title} (${pageId})`);
      }
    }

    console.log('\n📊 分析結果サマリー:');
    console.log(`   新規追加: ${newPages.length}ページ`);
    console.log(`   更新が必要: ${updatePages.length}ページ`);
    console.log(`   更新不要: ${skipPages.length}ページ`);

    // 新規追加ページの詳細を表示
    if (newPages.length > 0) {
      console.log('\n➕ 新規追加ページの詳細:');
      newPages.slice(0, 10).forEach((page, index) => {
        console.log(`   ${index + 1}. ${page.title} (${page.id})`);
        console.log(`      スペース: ${page.space?.key || 'N/A'}`);
        console.log(`      更新日時: ${page.version?.when || 'N/A'}`);
      });
      
      if (newPages.length > 10) {
        console.log(`   ... 他 ${newPages.length - 10} ページ`);
      }
    }

    // 更新が必要なページの詳細を表示
    if (updatePages.length > 0) {
      console.log('\n📝 更新が必要なページの詳細:');
      updatePages.forEach((page, index) => {
        const existingData = existingLanceDBData.get(page.id);
        console.log(`   ${index + 1}. ${page.title} (${page.id})`);
        console.log(`      Confluence更新日時: ${page.version?.when || 'N/A'}`);
        console.log(`      LanceDB更新日時: ${existingData?.lastUpdated || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('❌ デバッグ分析エラー:', error);
  }
}

// 実行
if (require.main === module) {
  debugDifferentialAnalysis();
}

export { debugDifferentialAnalysis };
