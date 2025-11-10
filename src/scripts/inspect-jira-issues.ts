import 'dotenv/config';

import fetch from 'node-fetch';

type Nullable<T> = T | null | undefined;

type JiraUser = {
  displayName?: string;
  emailAddress?: string;
};

type JiraStatus = {
  name?: string;
  statusCategory?: { key?: string; name?: string };
};

type JiraOption = {
  value?: string;
};

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

function formatDate(value: Nullable<string>): string {
  if (!value) return '(unknown)';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function formatOption(option: Nullable<JiraOption | JiraOption[]>): string {
  if (!option) return '(none)';
  if (Array.isArray(option)) {
    return option.map((item) => item?.value ?? JSON.stringify(item)).join(', ');
  }
  return option.value ?? JSON.stringify(option);
}

async function fetchIssue(issueKey: string) {
  const baseUrl = getEnv('JIRA_BASE_URL', process.env.CONFLUENCE_BASE_URL);
  const email = getEnv('JIRA_USER_EMAIL', process.env.CONFLUENCE_USER_EMAIL);
  const apiToken = getEnv('JIRA_API_TOKEN', process.env.CONFLUENCE_API_TOKEN);

  const issueUrl = new URL(`/rest/api/3/issue/${issueKey}`, baseUrl);
  issueUrl.searchParams.set('fields', '*all');

  const authHeader = Buffer.from(`${email}:${apiToken}`).toString('base64');

  const response = await fetch(issueUrl.toString(), {
    headers: {
      Authorization: `Basic ${authHeader}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `課題 ${issueKey} の取得に失敗しました (status: ${response.status} ${response.statusText})\nResponse: ${bodyText}`,
    );
  }

  const data = (await response.json()) as any;
  return data;
}

function logIssue(issue: any) {
  const fields = issue.fields ?? {};
  const status: JiraStatus = fields.status ?? {};

  const custom = (name: string) => fields[name];

  console.log('──────────────────────────────────────────────');
  console.log(`Key        : ${issue.key}`);
  console.log(`Summary    : ${fields.summary ?? '(no summary)'}`);
  console.log(`Status     : ${status?.name ?? '(no status)'} (${status?.statusCategory?.name ?? 'no category'})`);
  console.log(`Priority   : ${fields.priority?.name ?? '(no priority)'}`);
  console.log(`Assignee   : ${fields.assignee?.displayName ?? '(unassigned)'}`);
  console.log(`Reporter   : ${fields.reporter?.displayName ?? '(unknown)'}`);
  console.log(`Created    : ${formatDate(fields.created)}`);
  console.log(`Updated    : ${formatDate(fields.updated)}`);
  console.log(`Due Date   : ${formatDate(fields.duedate)}`);
  console.log(`Issue Type : ${fields.issuetype?.name ?? '(no type)'}`);

  const dateFields = [
    ['customfield_10281', 'リリース予定日'],
    ['customfield_10282', '完了日'],
    ['customfield_10283', '希望リリース日'],
    ['customfield_10284', '限界リリース日'],
  ] as const;

  for (const [fieldId, label] of dateFields) {
    console.log(` - ${label}: ${formatDate(custom(fieldId))}`);
  }

  const optionFields = [
    ['customfield_10276', '月'],
    ['customfield_10277', '担当'],
    ['customfield_10278', 'GIG状況'],
    ['customfield_10279', 'dev検証'],
    ['customfield_10280', '本番検証'],
    ['customfield_10291', '影響業務'],
    ['customfield_10292', '業務影響度'],
  ] as const;

  for (const [fieldId, label] of optionFields) {
    console.log(` - ${label}: ${formatOption(custom(fieldId))}`);
  }

  console.log(`Labels     : ${fields.labels?.join(', ') || '(none)'}`);
  console.log(`Components : ${fields.components?.map((c: any) => c?.name).join(', ') || '(none)'}`);
  console.log(`Attachments: ${fields.attachment?.length ?? 0}`);

  const fieldKeys = Object.keys(fields);
  console.log(`Field Count: ${fieldKeys.length}`);
  console.log('Sample field keys:');
  console.log(`  ${fieldKeys.slice(0, 20).join(', ')}`);
  console.log(`  ... total ${fieldKeys.length}`);
}

async function main() {
  const defaultKeys = [
    'CTJ-2635',
    'CTJ-3042',
    'CTJ-3184',
    'CTJ-3191',
    'CTJ-3622',
    'CTJ-3868',
    'CTJ-3893',
    'CTJ-3925',
  ];

  const keys = (process.env.JIRA_SAMPLE_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const issueKeys = keys.length > 0 ? keys : defaultKeys;

  console.log('📋 調査対象の課題キー:', issueKeys.join(', '));

  for (const key of issueKeys) {
    try {
      const issue = await fetchIssue(key);
      logIssue(issue);
    } catch (error) {
      console.error(`❌ ${key} の取得でエラーが発生しました`);
      console.error(error instanceof Error ? error.message : error);
    }
  }
}

main().catch((error) => {
  console.error('❌ 全体処理でエラーが発生しました');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
