/**
 * 教室管理関連ページの確認スクリプト
 * データベース内の教室管理ページの存在確認
 */

import 'dotenv/config';
import { LanceDBClient } from '../lib/lancedb-client';

async function checkClassroomPages() {
  console.log('🔍 データベース内の教室管理関連ページを確認中...');
  console.log('=' .repeat(60));

  try {
    const client = LanceDBClient.getInstance();
    await client.connect();
    const table = await client.getTable();

    // 全データを取得（検索結果の制限を避けるため）
    console.log('📊 データベースから全データを取得中...');
    const allResults = await table.search(new Array(768).fill(0)).limit(1000).toArray();
    
    console.log(`📄 総データ数: ${allResults.length}件`);

    // 教室管理関連ページをフィルタリング
    const classroomPages = allResults.filter(r => 
      r.title && (
        r.title.includes('教室管理') ||
        r.title.includes('教室一覧') ||
        r.title.includes('教室登録') ||
        r.title.includes('教室編集') ||
        r.title.includes('教室削除') ||
        r.title.includes('教室コピー')
      )
    );

    console.log(`\n🏫 教室管理関連ページ: ${classroomPages.length}件`);
    
    if (classroomPages.length > 0) {
      console.log('\n📋 教室管理関連ページ一覧:');
      classroomPages.forEach((page, index) => {
        console.log(`  ${index + 1}. ${page.title}`);
        console.log(`     ラベル: ${JSON.stringify(page.labels || [])}`);
        console.log(`     ページID: ${page.pageId}`);
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
      const found = allResults.find(r => r.title === expectedTitle);
      if (found) {
        console.log(`  ✅ ${expectedTitle} - 存在`);
        console.log(`     ラベル: ${JSON.stringify(found.labels || [])}`);
      } else {
        console.log(`  ❌ ${expectedTitle} - 存在しない`);
      }
    });

    // フォルダラベルページの確認
    console.log('\n📁 フォルダラベルページの確認:');
    const folderPages = allResults.filter(r => 
      r.labels && Array.isArray(r.labels) && r.labels.includes('フォルダ')
    );
    
    console.log(`フォルダラベルページ: ${folderPages.length}件`);
    folderPages.slice(0, 10).forEach((page, index) => {
      console.log(`  ${index + 1}. ${page.title} - ラベル: ${JSON.stringify(page.labels)}`);
    });

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkClassroomPages().catch(console.error);
