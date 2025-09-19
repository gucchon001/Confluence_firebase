import 'dotenv/config';
import axios from 'axios';

async function fetchAllLabelsForPage(pageId: string): Promise<string[]> {
  const baseUrl = process.env.CONFLUENCE_BASE_URL as string;
  const username = process.env.CONFLUENCE_USER_EMAIL as string;
  const apiToken = process.env.CONFLUENCE_API_TOKEN as string;
  const endpoint = `${baseUrl}/wiki/rest/api/content/${pageId}/label`;
  const labels: string[] = [];
  let start = 0;
  const limit = 200;
  while (true) {
    const res = await axios.get(endpoint, {
      params: { start, limit },
      auth: { username, password: apiToken }
    });
    const results = res?.data?.results || [];
    for (const r of results) {
      if (typeof r?.name === 'string' && r.name.trim().length > 0) {
        labels.push(r.name.trim());
      }
    }
    if (results.length < limit) break;
    start += limit;
  }
  return Array.from(new Set(labels));
}

async function listPages(spaceKey: string, start: number, limit: number) {
  const baseUrl = process.env.CONFLUENCE_BASE_URL as string;
  const username = process.env.CONFLUENCE_USER_EMAIL as string;
  const apiToken = process.env.CONFLUENCE_API_TOKEN as string;
  const endpoint = `${baseUrl}/wiki/rest/api/content`;
  const res = await axios.get(endpoint, {
    params: { spaceKey, expand: 'version,space,metadata.labels', start, limit },
    auth: { username, password: apiToken }
  });
  return res?.data?.results || [];
}

async function main() {
  const spaceKey = process.env.CONFLUENCE_SPACE_KEY as string;
  if (!spaceKey) throw new Error('CONFLUENCE_SPACE_KEY not set');

  const labelCount: Record<string, number> = {};
  let start = 0;
  const limit = 100;
  let total = 0;

  while (true) {
    const pages = await listPages(spaceKey, start, limit);
    if (!pages.length) break;
    for (const p of pages) {
      const pageId = String(p.id);
      const metaLabels = (p.metadata?.labels?.results || [])
        .map((x: any) => x?.name)
        .filter((x: any) => typeof x === 'string' && x.trim().length > 0);
      const apiLabels = await fetchAllLabelsForPage(pageId);
      const labels = Array.from(new Set<string>([...metaLabels, ...apiLabels]));
      for (const l of labels) {
        labelCount[l] = (labelCount[l] || 0) + 1;
      }
      total++;
    }
    start += limit;
  }

  const sorted = Object.entries(labelCount).sort((a, b) => b[1] - a[1]);
  console.log(JSON.stringify({ totalPagesScanned: total, uniqueLabels: sorted.length, labels: sorted }, null, 2));
}

main().catch((e) => {
  console.error('Label listing failed:', e?.message || String(e));
  process.exit(1);
});


