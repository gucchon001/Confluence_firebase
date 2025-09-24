/**
 * テストロジックのデバッグ
 */

async function debugTestLogic() {
  console.log('🔍 テストロジックデバッグ開始');
  console.log('=' .repeat(60));

  const query = '教室コピー機能でコピー可能な項目は？';
  console.log(`🔍 テストクエリ: "${query}"`);
  console.log('');

  try {
    // 動的インポートを使用
    const { extractKeywordsConfigured } = await import('../lib/keyword-extractor-wrapper');
    
    const result = await extractKeywordsConfigured(query);
    
    console.log('🔑 実際の抽出キーワード:');
    result.keywords.forEach((keyword, index) => {
      console.log(`  ${index + 1}. "${keyword}"`);
    });
    
    console.log('');
    console.log('🔧 項目分類テストのデバッグ:');
    
    // 1. 教室情報項目
    const classroomInfoKeywords = result.keywords.filter(k => 
      k.includes('基本情報') || k.includes('応募情報') || k.includes('塾チャート') || 
      k.includes('ロゴ') || k.includes('スライド画像') || k.includes('教室名') ||
      k.includes('ホームページ') || k.includes('アクセス方法') || k.includes('管理メモ')
    );
    console.log(`- 教室情報項目キーワード: [${classroomInfoKeywords.join(', ')}] (${classroomInfoKeywords.length}個)`);
    
    // 各キーワードの詳細チェック
    console.log('');
    console.log('📋 各キーワードの詳細チェック:');
    result.keywords.forEach((keyword, index) => {
      const isClassroomInfo = keyword.includes('基本情報') || keyword.includes('応募情報') || keyword.includes('塾チャート') || 
                             keyword.includes('ロゴ') || keyword.includes('スライド画像') || keyword.includes('教室名') ||
                             keyword.includes('ホームページ') || keyword.includes('アクセス方法') || keyword.includes('管理メモ');
      
      const isJobInfo = keyword.includes('求人情報') || keyword.includes('勤務条件') || keyword.includes('指導科目') ||
                       keyword.includes('応募条件') || keyword.includes('研修情報') || keyword.includes('PR情報');
      
      const isCopyLimit = keyword.includes('制限') || keyword.includes('制約') || keyword.includes('上限') || 
                         keyword.includes('非同期') || keyword.includes('件数');
      
      const isCopyProcess = keyword.includes('処理') || keyword.includes('挙動') || keyword.includes('上書き') || 
                           keyword.includes('新規作成') || keyword.includes('プラン設定');
      
      console.log(`  ${index + 1}. "${keyword}"`);
      console.log(`     - 教室情報項目: ${isClassroomInfo ? '✅' : '❌'}`);
      console.log(`     - 求人情報項目: ${isJobInfo ? '✅' : '❌'}`);
      console.log(`     - コピー制限・制約: ${isCopyLimit ? '✅' : '❌'}`);
      console.log(`     - コピー処理挙動: ${isCopyProcess ? '✅' : '❌'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ デバッグテスト実行エラー:', error);
  }

  console.log('');
  console.log('=' .repeat(60));
  console.log('✅ テストロジックデバッグ完了');
}

// テスト実行
debugTestLogic();
