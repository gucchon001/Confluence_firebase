import 'dotenv/config';
import axios from 'axios';
import * as lancedb from '@lancedb/lancedb';
import { getEmbeddings } from '../lib/embeddings';
import { createConfluenceRecord } from '../lib/lancedb-schema';

async function debugSaveProcess() {
  try {
    // 1. Confluence APIから「210_■応募管理機能」を取得
    console.log('🔍 Confluence APIから「210_■応募管理機能」を取得中...');
    const response = await axios.get(`${process.env.CONFLUENCE_BASE_URL}/wiki/rest/api/content/search`, {
      params: {
        cql: 'title ~ "210_■応募管理機能"',
        expand: 'body.storage,version,space,metadata.labels'
      },
      auth: { 
        username: process.env.CONFLUENCE_USER_EMAIL, 
        password: process.env.CONFLUENCE_API_TOKEN 
      }
    });
    
    if (!response.data || !response.data.results || response.data.results.length === 0) {
      console.log('❌ ページが見つかりませんでした');
      return;
    }
    
    const page = response.data.results[0];
    console.log('✅ ページ取得成功:');
    console.log(`- pageId: ${page.id}`);
    console.log(`- title: ${page.title}`);
    console.log(`- lastUpdated: ${page.version?.when}`);
    console.log(`- labels: ${JSON.stringify(page.metadata?.labels?.results)}`);
    
    // 2. テキスト抽出
    console.log('\n🔍 テキスト抽出中...');
    const contentHtml = page.body?.storage?.value || '';
    console.log(`- HTML length: ${contentHtml.length}`);
    
    // HTMLからテキストを抽出
    const text = contentHtml
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    console.log(`- Text length: ${text.length}`);
    console.log(`- Text preview: ${text.substring(0, 100)}...`);
    
    // 3. チャンク分割
    console.log('\n🔍 チャンク分割中...');
    const chunkSize = 1800;
    let chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }
    
    // 空のコンテンツでも最小限のチャンクを作成
    if (chunks.length === 0) {
      chunks = [page.title || 'No content'];
    }
    
    console.log(`- Chunks: ${chunks.length}`);
    
    // 4. ラベル取得
    console.log('\n🔍 ラベル取得中...');
    const labels = page.metadata?.labels?.results?.map((l: any) => l?.name) || [];
    console.log(`- Labels: ${JSON.stringify(labels)}`);
    
    // 5. 埋め込み生成
    console.log('\n🔍 埋め込み生成中...');
    let vector: number[];
    try {
      const input = `${page.title} ${labels.join(' ')} ${chunks[0]}`.replace(/\s+/g, ' ').trim();
      console.log(`- Input length: ${input.length}`);
      console.log(`- Input preview: ${input.substring(0, 100)}...`);
      
      vector = await getEmbeddings(input);
      console.log(`- Vector length: ${vector.length}`);
      console.log('✅ 埋め込み生成成功');
    } catch (error: any) {
      console.error('❌ 埋め込み生成エラー:', error.message);
      return;
    }
    
    // 6. LanceDBに保存
    console.log('\n🔍 LanceDBに保存中...');
    try {
      const db = await lancedb.connect('.lancedb');
      const tbl = await db.openTable('confluence');
      
      const record = createConfluenceRecord(
        `${page.id}-0`,
        vector,
        page.space?.key || '',
        page.title,
        chunks[0],
        parseInt(page.id),
        0,
        `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${page.space?.key}/pages/${page.id}`,
        page.version?.when || '',
        labels
      );
      
      console.log(`- Record created: ${JSON.stringify(record, null, 2)}`);
      
      await tbl.add([record as any]);
      console.log('✅ LanceDB保存成功');
      
      // 7. 保存確認
      console.log('\n🔍 保存確認中...');
      const results = await tbl.query().where('"pageId" = ' + parseInt(page.id)).toArray();
      console.log(`- 保存されたレコード数: ${results.length}`);
      
      if (results.length > 0) {
        console.log('✅ 保存確認成功');
        const result = results[0];
        console.log(`- pageId: ${result.pageId}`);
        console.log(`- title: ${result.title}`);
        console.log(`- lastUpdated: ${result.lastUpdated}`);
      } else {
        console.log('❌ 保存確認失敗');
      }
      
    } catch (error: any) {
      console.error('❌ LanceDB保存エラー:', error.message);
      console.error('❌ エラーの詳細:', error);
      console.error('❌ スタックトレース:', error.stack);
    }
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }
}

debugSaveProcess();
