import 'dotenv/config';
import axios from 'axios';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import { getEmbeddings } from '../lib/embeddings';

async function syncSpecificPage(pageId: string) {
  try {
    console.log(`=== ページID ${pageId} の個別同期 ===`);
    
    // Confluence APIからページを取得
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const username = process.env.CONFLUENCE_USER_EMAIL;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    
    if (!baseUrl || !username || !apiToken) {
      throw new Error('Confluence API credentials not configured');
    }

    const endpoint = `${baseUrl}/wiki/rest/api/content/${pageId}`;
    const params = {
      expand: 'body.storage,version,space,metadata.labels'
    };
    
    console.log('Confluence APIからページを取得中...');
    const response = await axios.get(endpoint, {
      params,
      auth: { username, password: apiToken }
    });
    
    const page = response.data;
    console.log(`ページ取得成功: ${page.title}`);
    
    // ラベルを取得
    const labels = page.metadata?.labels?.results?.map((l: any) => l?.name).filter((x: any) => typeof x === 'string' && x.trim().length > 0) || [];
    console.log(`ラベル: ${JSON.stringify(labels)}`);
    
    // テキストを抽出してチャンクに分割
    const text = page.body?.storage?.value || '';
    const chunks = [];
    const CHUNK_SIZE = 1800;
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      const chunk = text.substring(i, i + CHUNK_SIZE).trim();
      if (chunk) {
        chunks.push(chunk);
      }
    }
    
    console.log(`チャンク数: ${chunks.length}`);
    
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const tableName = 'confluence';
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable(tableName);
    
    // 既存のレコードを削除
    console.log('既存のレコードを削除中...');
    await tbl.delete(`"pageId" = '${pageId}'`);
    
    // 新しいレコードを作成
    const records = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // 埋め込みベクトルを生成
      const title = String(page.title || '');
      const labelsText = Array.isArray(labels) ? labels.join(' ') : '';
      const content = String(chunk || '');
      const normalize = (t: string) => t.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
      const embeddingInput = normalize(`${title} ${labelsText} ${content}`);
      
      console.log(`チャンク ${i+1}/${chunks.length} の埋め込みを生成中...`);
      const embedding = await getEmbeddings(embeddingInput);
      
      const record = {
        id: `${pageId}-${i}`,
        vector: Array.from(embedding),
        title: String(page.title || ''),
        content: String(chunk || ''),
        space_key: String(page.space?.key || ''),
        labels: Array.isArray(labels) ? labels : [],
        pageId: String(pageId),
        chunkIndex: Number(i),
        url: `${baseUrl}/wiki/spaces/${page.space?.key}/pages/${pageId}`,
        lastUpdated: String(page.version?.when || '')
      };
      
      records.push(record);
    }
    
    // LanceDBに保存
    console.log(`${records.length}件のレコードをLanceDBに保存中...`);
    try {
      await tbl.add(records);
      console.log('✅ 同期完了');
    } catch (error: any) {
      console.error(`LanceDBへの保存中にエラーが発生しました: ${error.message}`);
      console.error('エラーの詳細:', error);
      return;
    }
    
    // 確認
    const verifyResults = await tbl.query()
      .where(`"pageId" = '${pageId}'`)
      .toArray();
    
    console.log(`確認: ${verifyResults.length}件のレコードが保存されました`);
    verifyResults.forEach((r, i) => {
      console.log(`  ${i+1}. タイトル: ${r.title}`);
      console.log(`     ラベル: ${JSON.stringify(r.labels)}`);
      console.log(`     埋め込みベクトル長: ${r.vector?.length || 0}`);
    });
    
  } catch (error) {
    console.error('エラー:', error.message);
  }
}

async function main() {
  const pageId = '703889475';
  await syncSpecificPage(pageId);
}

main().catch(console.error);
