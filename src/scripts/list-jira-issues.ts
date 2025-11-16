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
  
  const authHeader = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const pageSize = 100;
  
  console.log('🔍 Jiraチケット一覧を取得します\n');
  
  const issues: Array<{ key: string; title: string }> = [];
  const uniqueKeys = new Set<string>(); // 重複チェック用
  let startAt = 0;
  let isLast = false;
  let duplicateCount = 0;
  
  while (!isLast) {
    const searchUrl = new URL(
      `/rest/api/3/search/jql?jql=${encodedJql}&fields=key,summary&startAt=${startAt}&maxResults=${pageSize}`,
      baseUrl,
    );

    console.log(`📥 取得中: ${startAt}件目から...`);

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
    const batchIssues = data.issues || [];
    
    for (const issue of batchIssues) {
      const key = issue.key || '';
      if (uniqueKeys.has(key)) {
        duplicateCount++;
        console.warn(`⚠️ 重複検出: ${key} (${duplicateCount}件目の重複)`);
      } else {
        uniqueKeys.add(key);
        issues.push({
          key: key,
          title: issue.fields?.summary || '(タイトルなし)'
        });
      }
    }
    
    console.log(`✅ ${issues.length}件取得済み (重複: ${duplicateCount}件)`);
    
    isLast = data.isLast === true || batchIssues.length < pageSize;
    startAt += batchIssues.length;
    
    // APIレート制限対策
    if (!isLast) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`\n📊 総件数: ${issues.length}件 (重複: ${duplicateCount}件, ユニーク: ${uniqueKeys.size}件)\n`);
  
  // 重複がある場合は警告
  if (duplicateCount > 0) {
    console.warn(`⚠️ 警告: ${duplicateCount}件の重複チケットが検出されました`);
  }
  
  // ファイルに出力
  const fs = await import('fs');
  const path = await import('path');
  const outputPath = path.resolve(process.cwd(), 'jira-issues-list.txt');
  
  const lines: string[] = [];
  lines.push(`Jiraチケット一覧 (${issues.length}件)`);
  lines.push(`取得日時: ${new Date().toISOString()}`);
  lines.push('─'.repeat(80));
  lines.push('');
  
  // 最初の10件と最後の10件を表示
  console.log('📝 チケット一覧（最初の10件）:');
  console.log('─'.repeat(80));
  issues.slice(0, 10).forEach((issue, index) => {
    const line = `${index + 1}. ${issue.key}\t${issue.title}`;
    console.log(line);
  });
  
  if (issues.length > 20) {
    console.log(`\n... (${issues.length - 20}件省略) ...\n`);
    console.log('📝 チケット一覧（最後の10件）:');
    console.log('─'.repeat(80));
    issues.slice(-10).forEach((issue, index) => {
      const line = `${issues.length - 10 + index + 1}. ${issue.key}\t${issue.title}`;
      console.log(line);
    });
  }
  
  // 全件をファイルに保存
  issues.forEach((issue, index) => {
    const line = `${index + 1}. ${issue.key}\t${issue.title}`;
    lines.push(line);
  });
  
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
  console.log(`\n✅ 一覧をファイルに保存しました: ${outputPath}`);
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

