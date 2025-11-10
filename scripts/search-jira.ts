import 'dotenv/config';

import fetch from 'node-fetch';

async function main() {
  const jql = process.argv.slice(2).join(' ');
  if (!jql) {
    console.error('Usage: tsx scripts/search-jira.ts "project=CTJ"');
    process.exit(1);
  }

  const baseUrl = process.env.JIRA_BASE_URL || process.env.CONFLUENCE_BASE_URL;
  const email = process.env.JIRA_USER_EMAIL || process.env.CONFLUENCE_USER_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN || process.env.CONFLUENCE_API_TOKEN;

  if (!baseUrl || !email || !apiToken) {
    throw new Error('Jira環境変数(JIRA_BASE_URL, JIRA_USER_EMAIL, JIRA_API_TOKEN)が不足しています。');
  }

  const searchUrl = new URL('/rest/api/3/search/jql', baseUrl);
  searchUrl.searchParams.set('jql', jql);
  searchUrl.searchParams.set('maxResults', '50');
  searchUrl.searchParams.set('fields', 'summary,status,assignee,priority,updated');

  const authHeader = Buffer.from(`${email}:${apiToken}`).toString('base64');

  const response = await fetch(searchUrl.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Basic ${authHeader}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jira search failed: ${response.status} ${response.statusText}\n${body}`);
  }

  const data = (await response.json()) as any;
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
