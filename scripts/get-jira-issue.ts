import 'dotenv/config';

import fetch from 'node-fetch';

async function main() {
  const issueKey = process.argv[2];
  if (!issueKey) {
    console.error('Issue key is required. Usage: tsx scripts/get-jira-issue.ts CTJ-XXXX');
    process.exit(1);
  }

  const baseUrl = process.env.JIRA_BASE_URL || process.env.CONFLUENCE_BASE_URL;
  const email = process.env.JIRA_USER_EMAIL || process.env.CONFLUENCE_USER_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN || process.env.CONFLUENCE_API_TOKEN;

  if (!baseUrl || !email || !apiToken) {
    throw new Error('Jira環境変数(JIRA_BASE_URL, JIRA_USER_EMAIL, JIRA_API_TOKEN)が不足しています。');
  }

  const url = new URL(`/rest/api/3/issue/${issueKey}`, baseUrl);
  const authHeader = Buffer.from(`${email}:${apiToken}`).toString('base64');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${authHeader}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jira API failed: ${response.status} ${response.statusText}\n${body}`);
  }

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
