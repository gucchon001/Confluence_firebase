/**
 * 複数のコメントを持つJira課題を検索
 * 
 * 目的: 複数のコメントを持つ課題を見つけて、全コメント取得のテストに使用
 * 
 * 実行方法:
 *   npx tsx scripts/find-jira-issues-with-multiple-comments.ts
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { appConfig } from '../src/config/app-config';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('複数のコメントを持つJira課題を検索');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const baseUrl = appConfig.jira.baseUrl;
  const email = appConfig.jira.userEmail;
  const apiToken = appConfig.jira.apiToken;
  const projectKey = appConfig.jira.projectKey;

  if (!baseUrl || !email || !apiToken || !projectKey) {
    console.error('❌ Jira設定が不足しています');
    process.exit(1);
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const fields = 'summary,description,status,priority,assignee,reporter,created,updated,labels,issuetype,project,customfield_10276,customfield_10277,customfield_10278,customfield_10279,customfield_10280,customfield_10281,customfield_10282,customfield_10283,customfield_10284,customfield_10291,customfield_10292,comment';

  try {
    // より多くの課題を取得して、複数のコメントを持つ課題を探す
    console.log('📋 課題を取得中（最大100件）...\n');
    const url = `${baseUrl}/rest/api/3/search/jql?jql=project=${projectKey}&fields=${fields}&maxResults=100`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    if (!data.issues || data.issues.length === 0) {
      console.error('❌ 課題が見つかりませんでした');
      process.exit(1);
    }

    console.log(`✅ ${data.issues.length}件の課題を取得しました\n`);

    // 複数のコメントを持つ課題を探す
    const issuesWithMultipleComments: Array<{
      key: string;
      summary: string;
      commentCount: number;
      comments: any[];
    }> = [];

    for (const issue of data.issues) {
      const comments = issue.fields?.comment?.comments || [];
      if (comments.length > 1) {
        issuesWithMultipleComments.push({
          key: issue.key,
          summary: issue.fields.summary || '',
          commentCount: comments.length,
          comments: comments
        });
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 結果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`複数のコメントを持つ課題: ${issuesWithMultipleComments.length}件\n`);

    if (issuesWithMultipleComments.length > 0) {
      // コメント数でソート（多い順）
      issuesWithMultipleComments.sort((a, b) => b.commentCount - a.commentCount);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 複数のコメントを持つ課題一覧（コメント数順）');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // 上位10件を表示
      for (let i = 0; i < Math.min(10, issuesWithMultipleComments.length); i++) {
        const issue = issuesWithMultipleComments[i];
        console.log(`${i + 1}. ${issue.key} - ${issue.summary.substring(0, 60)}...`);
        console.log(`   コメント数: ${issue.commentCount}件`);
        
        // コメントの投稿日時を表示
        const commentDates = issue.comments
          .map(c => c.created || '')
          .filter(Boolean)
          .sort();
        if (commentDates.length > 0) {
          console.log(`   最初のコメント: ${commentDates[0]}`);
          console.log(`   最後のコメント: ${commentDates[commentDates.length - 1]}`);
        }
        console.log('');
      }

      // テスト用に最初の課題を推奨
      const testIssue = issuesWithMultipleComments[0];
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 テスト推奨課題');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`課題キー: ${testIssue.key}`);
      console.log(`タイトル: ${testIssue.summary}`);
      console.log(`コメント数: ${testIssue.commentCount}件`);
      console.log(`\nこの課題でテストを実行するには、以下のコマンドを実行してください:`);
      console.log(`JIRA_TEST_ISSUE_KEY=${testIssue.key} npx tsx scripts/test-jira-comments-all.ts`);
    } else {
      console.log('⚠️  複数のコメントを持つ課題が見つかりませんでした');
      console.log('   より多くの課題を取得するか、別の検索条件を試してください');
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    if (error instanceof Error) {
      console.error('   エラー詳細:', error.message);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

