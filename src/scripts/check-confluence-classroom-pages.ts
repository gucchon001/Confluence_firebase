/**
 * Confluence APIから教室管理ページを確認するスクリプト
 */

import 'dotenv/config';
import { confluenceSyncService } from '../lib/confluence-sync-service';

async function checkConfluenceClassroomPages() {
  console.log('🔍 Confluence APIから教室管理ページを検索中...');
  console.log('=' .repeat(60));

  try {
    const pages = await confluenceSyncService.getAllConfluencePages();
    console.log(`📄 総ページ数: ${pages.length}件`);

    // 教室管理関連ページをフィルタリング
    const classroomPages = pages.filter(p => 
      p.title && (
        p.title.includes('教室管理') ||
        p.title.includes('教室一覧') ||
        p.title.includes('教室登録') ||
        p.title.includes('教室編集') ||
        p.title.includes('教室削除') ||
        p.title.includes('教室コピー')
      )
    );

    console.log(`\n🏫 教室管理関連ページ: ${classroomPages.length}件`);
    
    if (classroomPages.length > 0) {
      console.log('\n📋 教室管理関連ページ一覧:');
      classroomPages.forEach((page, index) => {
        console.log(`  ${index + 1}. ${page.title}`);
        console.log(`     ページID: ${page.id}`);
        console.log(`     ラベル: ${JSON.stringify(page.metadata?.labels?.results?.map(l => l.name) || [])}`);
        console.log('');
      });
    } else {
      console.log('❌ 教室管理関連ページが見つかりませんでした');
    }

    // 期待されるページの存在確認
    const expectedPages = [
      '160_【FIX】教室管理機能',
      '161_【FIX】教室一覧閲覧機能',
      '162_【FIX】教室新規登録機能',
      '163_【FIX】教室情報編集機能',
      '168_【FIX】教室コピー機能'
    ];

    console.log('\n🎯 期待されるページの存在確認:');
    expectedPages.forEach(expectedTitle => {
      const found = pages.find(p => p.title === expectedTitle);
      if (found) {
        console.log(`  ✅ ${expectedTitle} - 存在 (ID: ${found.id})`);
      } else {
        console.log(`  ❌ ${expectedTitle} - 存在しない`);
      }
    });

    // 類似タイトルの検索
    console.log('\n🔍 類似タイトルの検索:');
    const similarTitles = pages.filter(p => 
      p.title && (
        p.title.includes('160_') ||
        p.title.includes('161_') ||
        p.title.includes('162_') ||
        p.title.includes('163_') ||
        p.title.includes('168_')
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

checkConfluenceClassroomPages().catch(console.error);
