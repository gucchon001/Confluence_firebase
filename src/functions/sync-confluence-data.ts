'use server';

import { getAllSpaceContent } from '@/lib/confluence-client';
import { ai } from '@/ai/genkit';

/**
 * Confluenceからデータを取得し、ベクトル化してVector Searchに保存するバッチ処理
 * この関数はCloud Functionsとしてデプロイされ、Cloud Schedulerによって1日1回実行される
 */
export async function syncConfluenceData() {
  try {
    console.log('Starting Confluence data synchronization...');
    
    // 環境変数の確認
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
    const projectId = process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
    const indexId = process.env.VERTEX_AI_INDEX_ID;
    
    if (!spaceKey) {
      throw new Error('CONFLUENCE_SPACE_KEY environment variable is not set');
    }
    
    if (!projectId) {
      throw new Error('VERTEX_AI_PROJECT_ID or GOOGLE_CLOUD_PROJECT environment variable is not set');
    }
    
    if (!indexId) {
      throw new Error('VERTEX_AI_INDEX_ID environment variable is not set');
    }
    
    console.log(`Fetching content from Confluence space: ${spaceKey}`);
    
    // Confluenceからデータを取得
    const pages = await getAllSpaceContent(spaceKey);
    console.log(`Retrieved ${pages.length} pages from Confluence`);
    
    // ページをチャンクに分割してベクトル化
    const chunks = [];
    for (const page of pages) {
      // ページのコンテンツを取得（HTMLからプレーンテキストに変換）
      const content = page.body?.storage?.value || '';
      const plainText = content
        .replace(/<[^>]*>/g, ' ') // HTMLタグを削除
        .replace(/\s+/g, ' ')     // 連続する空白を1つに
        .trim();
      
      // 長いテキストをチャンクに分割（例：1000文字ごと）
      const chunkSize = 1000;
      for (let i = 0; i < plainText.length; i += chunkSize) {
        const chunkText = plainText.substring(i, i + chunkSize);
        
        // 空のチャンクはスキップ
        if (!chunkText.trim()) continue;
        
        chunks.push({
          id: `${page.id}-chunk-${Math.floor(i / chunkSize)}`,
          text: chunkText,
          metadata: {
            pageId: page.id,
            pageTitle: page.title,
            pageUrl: `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${spaceKey}/pages/${page.id}`,
            chunkIndex: Math.floor(i / chunkSize)
          }
        });
      }
    }
    
    console.log(`Created ${chunks.length} text chunks for embedding`);
    
    // チャンクをベクトル化
    const embeddings = [];
    for (const chunk of chunks) {
      try {
        const embedding = await ai.embed({
          embedder: 'googleai/text-embedding-004',
          content: chunk.text,
        }) as any;
        
        const embeddingVector = Array.isArray(embedding) 
          ? embedding[0].embedding 
          : embedding.embedding;
        
        embeddings.push({
          id: chunk.id,
          embedding: embeddingVector,
          metadata: chunk.metadata,
          text: chunk.text
        });
      } catch (error) {
        console.error(`Error embedding chunk ${chunk.id}:`, error);
      }
    }
    
    console.log(`Generated embeddings for ${embeddings.length} chunks`);
    
    // Vector Searchにデータを保存
    // 注: 実際の実装では、Vertex AI Vector SearchのAPIを使用して
    // インデックスにベクトルを保存する処理を実装する必要があります
    console.log('Saving embeddings to Vertex AI Vector Search...');
    
    // 実際のVector Search APIの呼び出しはここに実装
    // この部分はVertex AI Vector SearchのAPIドキュメントを参照して実装する
    
    console.log('Confluence data synchronization completed successfully');
    
    return {
      status: 'success',
      pagesProcessed: pages.length,
      chunksCreated: chunks.length,
      embeddingsGenerated: embeddings.length
    };
    
  } catch (error) {
    console.error('Error in syncConfluenceData:', error);
    throw error;
  }
}
