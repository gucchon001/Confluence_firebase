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

  const fieldUrl = new URL('/rest/api/3/field', baseUrl);
  const authHeader = Buffer.from(`${email}:${apiToken}`).toString('base64');

  console.log('📥 Jira フィールドメタ情報を取得します');
  console.log(` - Base URL: ${baseUrl}`);
  console.log(` - Endpoint : ${fieldUrl.toString()}`);

  const response = await fetch(fieldUrl.toString(), {
    headers: {
      Authorization: `Basic ${authHeader}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `フィールド一覧の取得に失敗しました (status: ${response.status} ${response.statusText})\nResponse: ${bodyText}`,
    );
  }

  const fields = (await response.json()) as Array<{
    id: string;
    key?: string;
    name: string;
    schema?: {
      type?: string;
      items?: string;
      custom?: string;
      customId?: number;
    };
    projectsCount?: number;
    isLocked?: boolean;
    isManaged?: boolean;
  }>;

  // プロジェクト固有フィールド（customfield_*）を抽出
  const customFields = fields.filter((field) => field.id.startsWith('customfield_'));

  customFields.sort((a, b) => a.id.localeCompare(b.id));

  console.log(`🔎 カスタムフィールド数: ${customFields.length}`);

  const targetIds = new Set([
    'customfield_10275',
    'customfield_10473',
    'customfield_10506',
    'customfield_10507',
    'customfield_10539',
    'customfield_10540',
    'customfield_10572',
    'customfield_10638',
    'customfield_10770',
  ]);

  const targetDetails: string[] = [];

  for (const field of customFields) {
    if (!targetIds.size || targetIds.has(field.id)) {
      const schema = field.schema ?? {};
      targetDetails.push(
        `${field.id} | ${field.name} | type=${schema.type ?? '-'} | items=${schema.items ?? '-'} | custom=${schema.custom ?? '-'} | customId=${
          schema.customId ?? '-'
        }`,
      );
    }
  }

  if (targetDetails.length > 0) {
    console.log('📘 注目フィールド:');
    for (const line of targetDetails) {
      console.log(` - ${line}`);
    }
  } else {
    console.log('⚠️ 注目フィールドが見つかりませんでした。フィルタ条件を確認してください。');
  }

  const summary = customFields.slice(0, 20).map((field) => `${field.id} (${field.name})`);
  console.log('📄 カスタムフィールド一覧（先頭20件）:');
  console.log(`   ${summary.join(', ')}`);
}

main().catch((error) => {
  console.error('❌ フィールド取得処理でエラーが発生しました');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
