/**
 * 正しい期待ページを特定
 */

import * as lancedb from '@lancedb/lancedb';

interface TestCase {
  name: string;
  query: string;
  wrongExpectedTitle: string;
  keywords: string[];
}

const TEST_CASES: TestCase[] = [
  {
    name: '事例1: 退会後の再登録',
    query: '退会した会員が再度登録することは可能ですか',
    wrongExpectedTitle: '046_【FIX】退会機能',
    keywords: ['退会', '会員', '登録', '再登録']
  },
  {
    name: '事例4: 応募制限',
    query: '塾講師が同時に何件まで応募できるか教えてください',
    wrongExpectedTitle: '014_【FIX】応募機能',
    keywords: ['応募', '塾講師', '同時', '制限']
  },
  {
    name: '事例5: 重複応募期間',
    query: '重複応募不可期間はいつからいつまでですか',
    wrongExpectedTitle: '014_【FIX】応募機能',
    keywords: ['重複', '応募', '期間', '不可']
  },
  {
    name: '事例6: 学年・職業更新',
    query: '塾講師プロフィールの学年・職業を更新する方法を教えてください',
    wrongExpectedTitle: '721_【FIX】塾講師-学年・職業更新機能',
    keywords: ['学年', '職業', '更新', 'プロフィール', '塾講師']
  },
];

async function main() {
  console.log('🔍 正しい期待ページを特定\n');
  
  const db = await lancedb.connect('.lancedb');
  const table = await db.openTable('confluence');
  const all = await table.query().limit(10000).toArray();
  
  console.log(`📊 総レコード数: ${all.length}件\n`);
  console.log('='  .repeat(80));
  
  for (const testCase of TEST_CASES) {
    console.log(`\n${testCase.name}`);
    console.log(`クエリ: "${testCase.query}"`);
    console.log(`誤った期待ページ: "${testCase.wrongExpectedTitle}"`);
    console.log(`キーワード: [${testCase.keywords.join(', ')}]\n`);
    
    // キーワードベースで候補ページを検索
    const candidates = all
      .map((r: any) => {
        const title = String(r.title || '').toLowerCase();
        const content = String(r.content || '').toLowerCase();
        
        // タイトルマッチ数
        const titleMatches = testCase.keywords.filter(kw => 
          title.includes(kw.toLowerCase())
        );
        
        // コンテンツマッチ数
        const contentMatches = testCase.keywords.filter(kw => 
          content.includes(kw.toLowerCase())
        );
        
        return {
          title: r.title,
          pageId: r.pageId,
          titleMatchCount: titleMatches.length,
          contentMatchCount: contentMatches.length,
          titleMatches: titleMatches,
          contentMatches: contentMatches,
          totalScore: titleMatches.length * 3 + contentMatches.length
        };
      })
      .filter(r => r.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10);
    
    console.log(`📄 候補ページ（Top 10）:\n`);
    candidates.forEach((c, idx) => {
      console.log(`${idx + 1}. ${c.title}`);
      console.log(`   タイトルマッチ: [${c.titleMatches.join(', ')}] (${c.titleMatchCount}件)`);
      console.log(`   コンテンツマッチ: ${c.contentMatchCount}件`);
      console.log(`   スコア: ${c.totalScore}\n`);
    });
    
    if (candidates.length > 0) {
      console.log(`💡 推奨: "${candidates[0].title}"`);
    }
    
    console.log('='  .repeat(80));
  }
}

main().catch(console.error);

