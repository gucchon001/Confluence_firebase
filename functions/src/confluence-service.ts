/**
 * Confluence API連携サービス
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as config from './config';

/**
 * Confluenceからスペース内のすべてのコンテンツを取得する
 */
export async function getAllSpaceContent(spaceKey: string): Promise<any[]> {
  try {
    console.log(`[getAllSpaceContent] Fetching content for space ${spaceKey}`);
    
    // Confluence API設定
    const baseUrl = process.env.CONFLUENCE_BASE_URL || config.confluence?.base_url;
    const username = process.env.CONFLUENCE_USER_EMAIL || config.confluence?.user_email;
    const apiToken = process.env.CONFLUENCE_API_TOKEN || config.confluence?.api_token;
    
    if (!baseUrl || !username || !apiToken) {
      throw new Error("Confluence API credentials not configured");
    }
    
    // ページの一覧を取得するエンドポイント
    const endpoint = `${baseUrl}/wiki/rest/api/content`;
    
    // 全ページを格納する配列
    let allPages: any[] = [];
    let start = 0;
    const limit = 100;
    let hasMore = true;
    
    // ページネーションでスペース内の全ページを取得
    while (hasMore) {
      console.log(`[getAllSpaceContent] Fetching pages ${start} to ${start + limit}`);
      
      // APIリクエストを送信
      const response = await axios.get(endpoint, {
        params: {
          spaceKey,
          expand: 'body.storage,version,space,metadata.labels',
          start,
          limit
        },
        auth: {
          username,
          password: apiToken
        }
      });
      
      // レスポンスを処理
      if (response.data && response.data.results) {
        console.log(`[getAllSpaceContent] Found ${response.data.results.length} pages`);
        allPages = allPages.concat(response.data.results);
        
        // 次のページがあるかチェック
        if (response.data.results.length < limit) {
          hasMore = false;
        } else {
          start += limit;
        }
      } else {
        hasMore = false;
      }
    }
    
    console.log(`[getAllSpaceContent] Total pages found: ${allPages.length}`);
    return allPages;
  } catch (error: any) {
    console.error('[getAllSpaceContent] Error fetching content from Confluence API:', error);
    
    // エラーの詳細情報を出力
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error('[getAllSpaceContent] API response error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        console.error('[getAllSpaceContent] No response received:', error.request);
      } else {
        console.error('[getAllSpaceContent] Request error:', error.message);
      }
    }
    
    throw new Error(`Failed to fetch Confluence content: ${error.message}`);
  }
}

/**
 * HTMLからテキストを抽出する
 */
export function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);
  
  // 不要な要素を削除
  try {
    $('ac\\:structured-macro').remove();
  } catch (error: any) {
    console.log(`[extractTextFromHtml] Warning: Error removing ac:structured-macro: ${error.message}`);
    // エラーが発生しても処理を続行
  }
  
  $('script').remove();
  $('style').remove();
  
  // テキストを取得
  return $.text().trim();
}

/**
 * テキストをチャンクに分割する
 */
export function splitTextIntoChunks(text: string): string[] {
  const CHUNK_SIZE = 1000;
  const CHUNK_OVERLAP = 100;
  const chunks: string[] = [];
  let currentChunk = "";
  
  // 段落ごとに分割
  const paragraphs = text.split('\n\n');
  
  for (const paragraph of paragraphs) {
    // 段落が長すぎる場合はさらに分割
    if (paragraph.length > CHUNK_SIZE) {
      const sentences = paragraph.split(/(?<=\. )|(?<=。)/);
      
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length <= CHUNK_SIZE) {
          currentChunk += sentence;
        } else {
          if (currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = sentence;
        }
      }
    } else {
      // 段落が短い場合は現在のチャンクに追加
      if (currentChunk.length + paragraph.length + 2 <= CHUNK_SIZE) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = paragraph;
      }
    }
  }
  
  // 最後のチャンクを追加
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Confluenceページからレコードを生成する
 * @param page Confluenceページデータ
 * @returns 処理されたレコードの配列
 */
export function processConfluencePage(page: any): any[] {
  try {
    console.log(`[processConfluencePage] Processing page: ${page.title} (ID: ${page.id})`);
    
    // HTMLからテキストを抽出
    const html = page.body?.storage?.value || "";
    const text = extractTextFromHtml(html);
    
    // テキストをチャンクに分割
    const chunks = splitTextIntoChunks(text);
    console.log(`[processConfluencePage] Split into ${chunks.length} chunks`);
    
    // ラベル情報を抽出
    const labels = page.metadata?.labels?.results?.map((label: any) => label.name) || [];
    console.log(`[processConfluencePage] Labels: ${labels.join(', ') || 'none'}`);
    
    // Confluence API設定
    const baseUrl = process.env.CONFLUENCE_BASE_URL || config.confluence?.base_url;
    
    // 各チャンクに対してレコードを生成
    const records = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // レコードを生成
      const record = {
        pageId: page.id,
        title: page.title,
        spaceKey: page.space?.key || "",
        spaceName: page.space?.name || "",
        url: `${baseUrl}/wiki/spaces/${page.space?.key}/pages/${page.id}`,
        lastUpdated: page.version?.when || "",
        chunkIndex: i,
        content: chunk,
        labels
      };
      
      records.push(record);
    }
    
    return records;
  } catch (error: any) {
    console.error(`[processConfluencePage] Error processing page ${page.id}: ${error.message}`);
    throw new Error(`Failed to process page ${page.id}: ${error.message}`);
  }
}
