/**
 * 教室管理関連ページの存在確認
 */

import { searchLanceDB } from './src/lib/lancedb-search-client';

async function checkClassroomPages() {
  console.log('🔍 教室管理関連ページの存在確認...');
  
  // 期待される教室管理ページのリスト
  const expectedPages = [
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
  
  console.log(`📋 確認対象ページ数: ${expectedPages.length}件`);
  
  let foundPages = 0;
  let missingPages: string[] = [];
  
  for (const pageTitle of expectedPages) {
    try {
      const results = await searchLanceDB({
        query: pageTitle,
        topK: 5,
        tableName: 'confluence',
        labelFilters: {
          includeMeetingNotes: false,
          includeArchived: false
        }
      });
      
      // タイトルが完全一致または部分一致するかチェック
      const found = results.some(result => 
        result.title.includes(pageTitle) || pageTitle.includes(result.title)
      );
      
      if (found) {
        foundPages++;
        console.log(`✅ ${pageTitle}`);
      } else {
        missingPages.push(pageTitle);
        console.log(`❌ ${pageTitle}`);
      }
    } catch (error) {
      console.log(`⚠️ ${pageTitle} - 検索エラー: ${error}`);
      missingPages.push(pageTitle);
    }
  }
  
  console.log(`\n📊 結果サマリー:`);
  console.log(`  見つかったページ: ${foundPages}/${expectedPages.length}件`);
  console.log(`  不足しているページ: ${missingPages.length}件`);
  
  if (missingPages.length > 0) {
    console.log(`\n❌ 不足しているページ:`);
    missingPages.forEach((page, index) => {
      console.log(`  ${index + 1}. ${page}`);
    });
  }
  
  console.log('\n✅ 教室管理ページ確認完了');
}

checkClassroomPages();
