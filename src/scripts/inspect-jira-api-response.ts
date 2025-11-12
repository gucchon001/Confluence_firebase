import 'dotenv/config';

import fetch from 'node-fetch';

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
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
    `/rest/api/3/search/jql?jql=${encodedJql}&fields=summary,description,status,priority,assignee,reporter,created,updated,labels,issuetype,project,customfield_10291,customfield_10292,customfield_10279,customfield_10280,comment&startAt=0&maxResults=3`,
    baseUrl,
  );

  const authHeader = Buffer.from(`${email}:${apiToken}`).toString('base64');

  console.log('🔍 Jira APIレスポンスを確認します\n');
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

  console.log(`取得件数: ${data.issues?.length || 0}件\n`);

  if (data.issues && data.issues.length > 0) {
    data.issues.forEach((issue: any, index: number) => {
      console.log(`=== Issue ${index + 1}: ${issue.key} ===\n`);
      
      const fields = issue.fields;
      
      // 基本フィールド
      console.log('【基本フィールド】');
      console.log(`  summary: ${fields.summary || '(no summary)'}`);
      console.log(`  status: ${fields.status?.name || '(no status)'}`);
      console.log(`  priority: ${fields.priority?.name || '(no priority)'}`);
      console.log(`  assignee: ${fields.assignee?.displayName || '(unassigned)'}`);
      console.log(`  reporter: ${fields.reporter?.displayName || '(unknown)'}`);
      console.log(`  issueType: ${fields.issuetype?.name || '(no type)'}`);
      console.log('');
      
      // カスタムフィールドの詳細確認
      console.log('【カスタムフィールド（生データ）】');
      console.log(`  customfield_10291 (影響業務):`);
      console.log(`    type: ${typeof fields.customfield_10291}`);
      console.log(`    value: ${JSON.stringify(fields.customfield_10291, null, 2)}`);
      
      console.log(`  customfield_10292 (業務影響度):`);
      console.log(`    type: ${typeof fields.customfield_10292}`);
      console.log(`    value: ${JSON.stringify(fields.customfield_10292, null, 2)}`);
      
      console.log(`  customfield_10279 (開発検証):`);
      console.log(`    type: ${typeof fields.customfield_10279}`);
      console.log(`    value: ${JSON.stringify(fields.customfield_10279, null, 2)}`);
      
      console.log(`  customfield_10280 (本番検証):`);
      console.log(`    type: ${typeof fields.customfield_10280}`);
      console.log(`    value: ${JSON.stringify(fields.customfield_10280, null, 2)}`);
      console.log('');
      
      // カスタムフィールドの値抽出確認
      console.log('【カスタムフィールド（値抽出）】');
      console.log(`  impactDomain: ${fields.customfield_10291?.value || '(null/undefined)'}`);
      console.log(`  impactLevel: ${fields.customfield_10292?.value || '(null/undefined)'}`);
      console.log(`  devValidation: ${fields.customfield_10279?.value || '(null/undefined)'}`);
      console.log(`  prodValidation: ${fields.customfield_10280?.value || '(null/undefined)'}`);
      console.log('');
      
      // その他のカスタムフィールドも確認
      console.log('【その他のカスタムフィールド（存在確認）】');
      const customFieldKeys = Object.keys(fields).filter(key => key.startsWith('customfield_'));
      console.log(`  カスタムフィールド数: ${customFieldKeys.length}`);
      if (customFieldKeys.length > 0) {
        customFieldKeys.slice(0, 10).forEach((key: string) => {
          const value = fields[key];
          if (value !== null && value !== undefined) {
            console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : value}`);
          }
        });
      }
      console.log('');
    });
  }
}

main().catch((error) => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});

