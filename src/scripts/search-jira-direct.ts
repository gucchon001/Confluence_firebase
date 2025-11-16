import 'dotenv/config';
import { lancedbClient } from '../lib/lancedb-client';
import { buildJiraUrl } from '../lib/jira-url-utils';

async function searchJiraDirect() {
  const queries = ['応募移管機能', '応募移管', '移管'];
  const assigneeFilter = '池田';
  const excludeStatus = '完了';

  console.log('🔍 Jiraデータを直接検索します\n');
  console.log(`📝 クエリ: ${queries.map(q => `"${q}"`).join(', ')}`);
  console.log(`👤 担当者フィルタ: "${assigneeFilter}"を含む`);
  console.log(`❌ ステータス除外: "${excludeStatus}"以外\n`);

  try {
    const connection = await lancedbClient.getConnection();
    const table = await connection.db.openTable('jira_issues');

    // 全データを取得（検索は後でフィルタリング）
    console.log('📊 LanceDBからデータを取得中...\n');
    // 大量データのため、まずは検索で絞り込む
    const allData = await table.query().limit(10000).toArray();
    console.log(`✅ 取得件数: ${allData.length}件\n`);

    // クエリと担当者、ステータスでフィルタリング
    const filtered = allData.filter((row: any) => {
      const title = (row.title || '').toLowerCase();
      const content = (row.content || '').toLowerCase();
      const assignee = (row.assignee || '').toLowerCase();
      const status = (row.status || '').toLowerCase();
      
      // クエリマッチ: いずれかのクエリがタイトルまたはコンテンツに含まれる
      const matchesQuery = queries.some(q => 
        title.includes(q.toLowerCase()) || 
        content.includes(q.toLowerCase())
      );
      
      // 担当者フィルタ: 池田を含む
      const matchesAssignee = assignee.includes(assigneeFilter.toLowerCase());
      
      // ステータスフィルタ: 完了以外
      const matchesStatus = status !== excludeStatus.toLowerCase() && 
                           !status.includes(excludeStatus.toLowerCase());
      
      return matchesQuery && matchesAssignee && matchesStatus;
    });

    console.log(`📊 フィルタリング後: ${filtered.length}件\n`);

    if (filtered.length > 0) {
      console.log('検索結果（応募移管機能、池田担当、完了以外）:');
      console.log('─'.repeat(80));
      filtered.forEach((row: any, index: number) => {
        const issueKey = row.issue_key || row.id || 'N/A';
        const url = buildJiraUrl(issueKey, row.url);
        
        console.log(`\n${index + 1}. ${row.title || '(タイトルなし)'}`);
        console.log(`   Issue Key: ${issueKey}`);
        console.log(`   ステータス: ${row.status || 'N/A'}`);
        console.log(`   ステータスカテゴリ: ${row.status_category || 'N/A'}`);
        console.log(`   優先度: ${row.priority || 'N/A'}`);
        console.log(`   担当者: ${row.assignee || 'N/A'}`);
        console.log(`   種別: ${row.issue_type || 'N/A'}`);
        console.log(`   URL: ${url}`);
        if (row.content) {
          const contentPreview = row.content.substring(0, 200).replace(/\n/g, ' ');
          console.log(`   内容（抜粋）: ${contentPreview}...`);
        }
      });
    } else {
      console.log('⚠️ 条件に一致する結果が見つかりませんでした\n');
      
      // デバッグ: 応募移管関連を含むものを表示
      const queryMatches = allData.filter((row: any) => {
        const title = (row.title || '').toLowerCase();
        const content = (row.content || '').toLowerCase();
        return queries.some(q => 
          title.includes(q.toLowerCase()) || 
          content.includes(q.toLowerCase())
        );
      });
      
      console.log(`📊 "応募移管"関連を含むチケット: ${queryMatches.length}件\n`);
      if (queryMatches.length > 0) {
        console.log('すべての応募移管関連チケット:');
        queryMatches.forEach((row: any, index: number) => {
          const issueKey = row.issue_key || row.id || 'N/A';
          const url = buildJiraUrl(issueKey, row.url);
          console.log(`\n${index + 1}. ${row.title || '(タイトルなし)'}`);
          console.log(`   Issue Key: ${issueKey}`);
          console.log(`   担当者: ${row.assignee || 'N/A'}`);
          console.log(`   ステータス: ${row.status || 'N/A'}`);
          console.log(`   ステータスカテゴリ: ${row.status_category || 'N/A'}`);
          console.log(`   優先度: ${row.priority || 'N/A'}`);
          console.log(`   URL: ${url}`);
        });
      }
      
      // デバッグ: 池田を含む担当者を表示
      const ikedaMatches = allData.filter((row: any) => {
        const assignee = (row.assignee || '').toLowerCase();
        return assignee.includes('池田') || assignee.includes('ikeda');
      });
      
      console.log(`\n📊 "池田"を含む担当者のチケット: ${ikedaMatches.length}件\n`);
      if (ikedaMatches.length > 0) {
        console.log('最初の5件:');
        ikedaMatches.slice(0, 5).forEach((row: any, index: number) => {
          console.log(`\n${index + 1}. ${row.title || '(タイトルなし)'}`);
          console.log(`   担当者: ${row.assignee || 'N/A'}`);
          console.log(`   ステータス: ${row.status || 'N/A'}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ エラー:', error);
    if (error instanceof Error) {
      console.error(`   エラーメッセージ: ${error.message}`);
      if (error.stack) {
        console.error(`   スタックトレース: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
      }
    }
  }

  console.log('\n✅ 検索完了');
}

searchJiraDirect().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

