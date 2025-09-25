/**
 * 不足している教室管理ページの確認スクリプト
 */

import 'dotenv/config';
import { confluenceSyncService } from '../lib/confluence-sync-service';

async function checkMissingPages() {
  console.log('🔍 不足している教室管理ページの確認');
  console.log('=' .repeat(60));

  try {
    const pages = await confluenceSyncService.getAllConfluencePages();
    console.log(`📄 総ページ数: ${pages.length}件`);

    const missingPages = [
      '161_【FIX】教室一覧閲覧機能',
      '162_【FIX】教室新規登録機能', 
      '163_【FIX】教室情報編集機能'
    ];

    console.log('\n🎯 不足しているページの確認:');
    missingPages.forEach(title => {
      const found = pages.find(p => p.title === title);
      if (found) {
        console.log(`  ✅ ${title} - 存在 (ID: ${found.id})`);
        console.log(`     ラベル: ${JSON.stringify(found.metadata?.labels?.results?.map(l => l.name) || [])}`);
      } else {
        console.log(`  ❌ ${title} - 存在しない`);
      }
    });

    // 類似タイトルの検索
    console.log('\n🔍 類似タイトルの検索:');
    const similarTitles = pages.filter(p => 
      p.title && (
        p.title.includes('161_') ||
        p.title.includes('162_') ||
        p.title.includes('163_')
      )
    );

    if (similarTitles.length > 0) {
      console.log('類似の番号付きページ:');
      similarTitles.forEach(page => {
        console.log(`  - ${page.title} (ID: ${page.id})`);
      });
    } else {
      console.log('類似の番号付きページは見つかりませんでした');
    }

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkMissingPages().catch(console.error);
