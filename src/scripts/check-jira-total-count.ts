import 'dotenv/config';
import fetch from 'node-fetch';

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

async function main() {
  const baseUrl = getEnv('JIRA_BASE_URL', process.env.CONFLUENCE_BASE_URL);
  const email = getEnv('JIRA_USER_EMAIL', process.env.CONFLUENCE_USER_EMAIL);
  const apiToken = getEnv('JIRA_API_TOKEN', process.env.CONFLUENCE_API_TOKEN);
  const projectKey = getEnv('JIRA_PROJECT_KEY');

  const jql = `project = "${projectKey}" ORDER BY updated DESC`;
  const encodedJql = encodeURIComponent(jql);
  
  const searchUrl = new URL(
    `/rest/api/3/search/jql?jql=${encodedJql}&fields=key&startAt=0&maxResults=1`,
    baseUrl,
  );

  const authHeader = Buffer.from(`${email}:${apiToken}`).toString('base64');

  console.log('🔍 Jiraの総件数を確認します\n');
  console.log(`Endpoint: ${searchUrl.toString()}\n`);

  const response = await fetch(searchUrl.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Basic ${authHeader}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `Jira APIリクエストが失敗しました (status: ${response.status} ${response.statusText})\nResponse: ${bodyText}`,
    );
  }

  const data = (await response.json()) as any;

  console.log(`📊 レスポンス構造:`);
  console.log(JSON.stringify(data, null, 2).substring(0, 1000));
  console.log(`\n📊 取得件数: ${data.issues?.length || 0}件`);
  console.log(`📊 isLast: ${data.isLast || false}`);
  console.log(`📊 nextPageToken: ${data.nextPageToken ? 'あり' : 'なし'}`);
  
  // 新しいAPIではtotalが返されないため、isLastがtrueになるまでページネーションが必要
  if (data.isLast === false) {
    console.log(`\n⚠️ 新しいJira API (/rest/api/3/search/jql) では総件数が返されません。`);
    console.log(`   isLastがtrueになるまでページネーションで全件取得します。`);
    console.log(`\n✅ 全件取得するには、以下のコマンドを実行してください:`);
    console.log(`   $env:JIRA_MAX_ISSUES="0"; npm run sync:jira`);
  } else {
    console.log(`\n✅ 全件取得するには、以下のコマンドを実行してください:`);
    console.log(`   $env:JIRA_MAX_ISSUES="0"; npm run sync:jira`);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

