import 'dotenv/config';
import axios from 'axios';

async function getConfluenceLabels(pageId: string): Promise<string[]> {
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  const username = process.env.CONFLUENCE_USER_EMAIL;
  const apiToken = process.env.CONFLUENCE_API_TOKEN;
  if (!baseUrl || !username || !apiToken) {
    throw new Error('Confluence API credentials not configured');
  }

  const endpoint = `${baseUrl}/wiki/rest/api/content/${pageId}/label`;
  const labels: string[] = [];
  let start = 0;
  const limit = 200;

  // リトライ設定
  const maxRetries = 3;
  const initialDelayMs = 500;

  async function fetchPage(startParam: number, attempt: number): Promise<any> {
    try {
      const res = await axios.get(endpoint, {
        params: { start: startParam, limit },
        auth: { username, password: apiToken }
      });
      return res;
    } catch (err: any) {
      const isAxios = axios.isAxiosError(err);
      const status = isAxios ? err.response?.status : undefined;
      const shouldRetry = status === 401 || status === 403 || (status !== undefined && status >= 500);
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[getConfluenceLabels] pageId=${pageId} start=${startParam} attempt=${attempt} failed: ${err?.message || err}. status=${status}. willRetry=${shouldRetry}`);
      if (shouldRetry && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delay));
        return fetchPage(startParam, attempt + 1);
      }
      throw err;
    }
  }

  while (true) {
    const res = await fetchPage(start, 1);
    const results = res?.data?.results || [];
    for (const r of results) {
      if (typeof r?.name === 'string' && r.name.trim().length > 0) {
        labels.push(r.name.trim());
      }
    }
    const size = res?.data?.size ?? results.length;
    if (results.length < limit || size === 0) break;
    start += limit;
  }
  const unique = Array.from(new Set(labels));
  console.log(`[getConfluenceLabels] pageId=${pageId} labels=${JSON.stringify(unique)}`);
  return unique;
}

async function main() {
  // テスト対象のページID（既知のページから数件）
  const testPageIds = [
    '960561281', // 【統合のためクローズ】アカウント契約情報
    '666927294', // ■クライアント企業向け管理画面
    '816742401', // 【FIX】クライアント企業管理者アカウントロック通知メール
  ];

  console.log('=== ラベル取得テスト ===\n');

  for (const pageId of testPageIds) {
    try {
      console.log(`Testing pageId: ${pageId}`);
      const labels = await getConfluenceLabels(pageId);
      console.log(`Result: ${labels.length} labels found`);
      console.log(`Labels: ${JSON.stringify(labels)}`);
      console.log('---\n');
    } catch (error: any) {
      console.error(`Error for pageId ${pageId}: ${error.message}`);
      console.log('---\n');
    }
  }
}

main().catch(console.error);
