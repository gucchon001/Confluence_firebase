import 'dotenv/config';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import axios from 'axios';
import { getConfluenceLabels } from './batch-sync-confluence';
import { getEmbeddings } from '../lib/embeddings';
import { createConfluenceRecord } from '../lib/lancedb-schema';

async function fetchPage(pageId: string) {
  const baseUrl = process.env.CONFLUENCE_BASE_URL as string;
  const username = process.env.CONFLUENCE_USER_EMAIL as string;
  const apiToken = process.env.CONFLUENCE_API_TOKEN as string;
  const url = `${baseUrl}/wiki/rest/api/content/${pageId}`;
  const res = await axios.get(url, {
    params: { expand: 'body.storage,version,space,metadata.labels' },
    auth: { username, password: apiToken }
  });
  return res.data;
}

function extractTextFromHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTextIntoChunks(text: string, chunkSize = 1800): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

async function main() {
  const pageIdsArg = process.argv.slice(2).filter(Boolean);
  const pageIds = pageIdsArg.length > 0 ? pageIdsArg : ['960561281','666927294','816742401'];
  console.log('[resync-specific-pages] Target pageIds:', pageIds);

  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const db = await lancedb.connect(dbPath);
  const tbl = await db.openTable('confluence');

  for (const pageId of pageIds) {
    console.log(`\n[resync-specific-pages] Processing ${pageId}`);
    // 1) 既存レコード削除
    await tbl.delete(`"pageId" = '${pageId}'`);
    console.log(' - Deleted existing records');

    // 2) ページ取得
    const page = await fetchPage(pageId);
    const title = page?.title || '';
    const spaceKey = page?.space?.key || '';
    const contentHtml = page?.body?.storage?.value || '';
    const contentText = extractTextFromHtml(contentHtml);
    const chunks = splitTextIntoChunks(contentText);
    const url = `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${spaceKey}/pages/${pageId}`;
    const lastUpdated = page?.version?.when || '';

    // 3) ラベル取得
    const metaLabels = (page?.metadata?.labels?.results || []).map((x: any) => x?.name).filter((x: any) => typeof x === 'string' && x.trim().length > 0);
    const apiLabels = await getConfluenceLabels(pageId);
    const labels = Array.from(new Set([...(metaLabels as string[]), ...apiLabels]));
    console.log(' - Labels:', labels);

    // 4) 埋め込み生成 + 保存
    for (let i = 0; i < chunks.length; i++) {
      const input = `${title} ${labels.join(' ')} ${chunks[i]}`.replace(/\s+/g, ' ').trim();
      const vector = await getEmbeddings(input);
      const record = createConfluenceRecord(
        `${pageId}-${i}`,
        vector,
        spaceKey,
        title,
        chunks[i],
        pageId,
        i,
        url,
        lastUpdated,
        labels
      );
      await tbl.add([record]);
    }
    console.log(` - Upserted ${chunks.length} chunks`);
  }

  console.log('\n[resync-specific-pages] Done');
}

main().catch((e) => { console.error(e); process.exit(1); });


