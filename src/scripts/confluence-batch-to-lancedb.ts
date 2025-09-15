import 'dotenv/config';
import path from 'path';
import * as lancedb from '@lancedb/lancedb';
import { getEmbeddings } from '../lib/embeddings';
import { getSpaceContent, getContentById } from '../lib/confluence-client';

function htmlToText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  const tableName = process.argv[2] || 'confluence_768';
  const limit = Number(process.argv[3] || 10);
  const chunkSize = Number(process.argv[4] || 800);
  const spaceKey = process.env.CONFLUENCE_SPACE_KEY || 'CLIENTTOMO';

  // 1) 先頭limit件のページID取得
  const list: any = await getSpaceContent(spaceKey, 'page', limit, 0);
  const ids: string[] = (list?.results || []).map((x: any) => x.id);
  console.log('Target IDs:', ids.join(','));

  // 2) LanceDBテーブル準備（明示スキーマ）
  const db = await lancedb.connect(path.resolve('.lancedb'));
  const names = await db.tableNames();
  let tbl: any;
  const schema = {
    id: 'string',
    vector: 'vector[768]',
    space_key: 'string',
    title: 'string',
    labels: 'list<string>',
    content: 'string',
    pageId: 'string',
    chunkIndex: 'int',
    url: 'string',
    lastUpdated: 'string',
  } as const;

  if (!names.includes(tableName)) {
    console.log(`Create table '${tableName}' with explicit schema`);
    tbl = await db.createTable(tableName, [], { schema: schema as any });
  } else {
    tbl = await db.openTable(tableName);
  }

  // 3) 各IDを取得→サニタイズ→埋め込み→upsert
  let inserted = 0;
  for (const id of ids) {
    try {
      const doc: any = await getContentById(id);
      const title: string = doc?.title || 'untitled';
      const space: string = doc?._expandable?.space?.split('/')?.pop() || spaceKey;
      const html: string = doc?.body?.storage?.value || '';
      const text = htmlToText(html);
      if (!text) {
        console.log(`Skip ${id}: empty body`);
        continue;
      }
      const chunk = text.substring(0, chunkSize);
      const vec = await getEmbeddings(chunk);
      const recId = `${id}-0`;
      const url = doc?._links?.base && doc?._links?.webui ? `${doc._links.base}${doc._links.webui}` : `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${space}/pages/${id}`;
      const lastUpdated: string = doc?.version?.when || new Date().toISOString();
      const labels: string[] = doc?.metadata?.labels?.results?.map((l: any) => l.name) || [];

      await tbl.mergeInsert([
        {
          id: recId,
          vector: vec,
          space_key: space,
          title,
          labels,
          content: chunk,
          pageId: id,
          chunkIndex: 0,
          url,
          lastUpdated,
        },
      ], ['id']);
      inserted++;

      // Firestoreメタ保存は不要になったため削除
    } catch (e: any) {
      console.warn(`Skip ${id}:`, e?.message || e);
    }
  }

  const rows = await tbl.countRows();
  console.log(`Inserted ${inserted}. Row count: ${rows}`);
}

main().catch((e) => {
  console.error('Error:', e?.message || e);
  process.exit(1);
});
