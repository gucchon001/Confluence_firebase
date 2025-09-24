/**
 * 最初の10ページを取得して内容確認
 * 
 * Confluenceから最初の10ページを取得し、ラベルやその他の内容を確認する
 */

import 'dotenv/config';
import axios from 'axios';
import { getEmbeddings } from '../lib/embeddings';

interface ConfluencePage {
  id: string;
  title: string;
  body?: { storage?: { value: string; }; };
  space?: { key: string; name: string; };
  version?: { when: string; };
  metadata?: { labels?: { results: Array<{ name: string; }>; }; };
}

/**
 * HTMLからテキストを抽出する
 */
function extractTextFromHtml(html: string): string {
  if (!html) return '';
  
  // HTML特殊文字をデコード
  const htmlEntities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&apos;': "'"
  };
  
  let text = html;
  for (const [entity, char] of Object.entries(htmlEntities)) {
    text = text.replace(new RegExp(entity, 'g'), char);
  }
  
  // HTMLタグを除去
  text = text.replace(/<[^>]*>/g, '');
  
  // 連続する空白を単一の空白に
  text = text.replace(/\s+/g, ' ');
  
  return text.trim();
}

/**
 * ページIDからラベル一覧を取得
 */
async function getConfluenceLabels(pageId: string): Promise<string[]> {
  try {
    const endpoint = `${process.env.CONFLUENCE_BASE_URL}/wiki/rest/api/content/${pageId}/label`;
    let allLabels: string[] = [];
    let start = 0;
    const limit = 50;

    while (true) {
      const response = await axios.get(endpoint, {
        params: { start, limit },
        auth: { 
          username: process.env.CONFLUENCE_USER_EMAIL, 
          password: process.env.CONFLUENCE_API_TOKEN 
        }
      });

      if (!response.data || !response.data.results) break;
      
      const labels = response.data.results.map((label: any) => label.name);
      allLabels = allLabels.concat(labels);
      
      if (response.data.results.length < limit) break;
      start += limit;
    }

    console.log(`[getConfluenceLabels] pageId=${pageId} labels=[${allLabels.join(',')}]`);
    return allLabels;
  } catch (error: any) {
    console.error(`Error fetching labels for page ${pageId}:`, error.message);
    return [];
  }
}

/**
 * Confluenceから最初の10ページを取得
 */
async function fetchFirst10Pages(): Promise<ConfluencePage[]> {
  try {
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
    if (!spaceKey) throw new Error('CONFLUENCE_SPACE_KEY not set');

    const endpoint = `${process.env.CONFLUENCE_BASE_URL}/wiki/rest/api/content`;
    const response = await axios.get(endpoint, {
      params: {
        spaceKey: spaceKey,
        expand: 'body.storage,space,version,metadata.labels',
        limit: 10,
        start: 0
      },
      auth: { 
        username: process.env.CONFLUENCE_USER_EMAIL, 
        password: process.env.CONFLUENCE_API_TOKEN 
      }
    });

    if (!response.data || !response.data.results) return [];
    console.log(`Retrieved ${response.data.results.length} pages`);
    return response.data.results;
  } catch (error: any) {
    console.error('Error fetching Confluence pages:', error.message);
    if (axios.isAxiosError(error) && error.response) {
      console.error('API response:', error.response.status, error.response.statusText);
    }
    throw error;
  }
}

/**
 * 最初の10ページの内容を確認
 */
async function testFirst10Pages(): Promise<void> {
  console.log('🔍 最初の10ページの内容確認');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  try {
    // 1. Confluenceから最初の10ページを取得
    console.log('\n=== 1. Confluenceページの取得 ===');
    const pages = await fetchFirst10Pages();
    console.log(`✅ ${pages.length}ページを取得しました`);
    
    // 2. 各ページの内容を確認
    console.log('\n=== 2. 各ページの内容確認 ===');
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`\n--- ページ ${i + 1}: ${page.title} ---`);
      console.log(`ID: ${page.id}`);
      console.log(`タイトル: ${page.title}`);
      console.log(`スペース: ${page.space?.key} (${page.space?.name})`);
      console.log(`最終更新: ${page.version?.when}`);
      
      // ラベルの確認
      console.log('\n--- ラベルの確認 ---');
      
      // metadataからラベルを取得
      const metaLabels = page.metadata?.labels?.results?.map((l: any) => l?.name).filter((x: any) => typeof x === 'string' && x.trim().length > 0) || [];
      console.log(`metadataラベル: [${metaLabels.join(', ')}] (${metaLabels.length}個)`);
      
      // APIからラベルを取得
      const apiLabels = await getConfluenceLabels(page.id);
      console.log(`APIラベル: [${apiLabels.join(', ')}] (${apiLabels.length}個)`);
      
      // 最終的なラベル
      const finalLabels = metaLabels.length > 0 ? metaLabels : apiLabels;
      console.log(`最終ラベル: [${finalLabels.join(', ')}] (${finalLabels.length}個)`);
      
      // コンテンツの確認
      console.log('\n--- コンテンツの確認 ---');
      const htmlContent = page.body?.storage?.value || '';
      const textContent = extractTextFromHtml(htmlContent);
      console.log(`HTML長: ${htmlContent.length}文字`);
      console.log(`テキスト長: ${textContent.length}文字`);
      console.log(`テキスト先頭100文字: ${textContent.substring(0, 100)}...`);
      
      // 埋め込みのテスト
      console.log('\n--- 埋め込みのテスト ---');
      try {
        const embedding = await getEmbeddings(textContent.substring(0, 500)); // 最初の500文字でテスト
        console.log(`✅ 埋め込み生成成功: ${embedding.length}次元`);
        console.log(`埋め込み範囲: ${Math.min(...embedding).toFixed(4)} ～ ${Math.max(...embedding).toFixed(4)}`);
      } catch (error) {
        console.error(`❌ 埋め込み生成エラー:`, error);
      }
    }
    
    // 3. 全体の統計
    console.log('\n=== 3. 全体の統計 ===');
    const totalLabels = pages.reduce((sum, page) => {
      const metaLabels = page.metadata?.labels?.results?.map((l: any) => l?.name).filter((x: any) => typeof x === 'string' && x.trim().length > 0) || [];
      return sum + metaLabels.length;
    }, 0);
    
    const pagesWithLabels = pages.filter(page => {
      const metaLabels = page.metadata?.labels?.results?.map((l: any) => l?.name).filter((x: any) => typeof x === 'string' && x.trim().length > 0) || [];
      return metaLabels.length > 0;
    }).length;
    
    console.log(`総ページ数: ${pages.length}`);
    console.log(`ラベル付きページ数: ${pagesWithLabels}`);
    console.log(`総ラベル数: ${totalLabels}`);
    console.log(`平均ラベル数: ${(totalLabels / pages.length).toFixed(2)}`);
    
    // 4. 問題の特定
    console.log('\n=== 4. 問題の特定 ===');
    const pagesWithoutLabels = pages.filter(page => {
      const metaLabels = page.metadata?.labels?.results?.map((l: any) => l?.name).filter((x: any) => typeof x === 'string' && x.trim().length > 0) || [];
      return metaLabels.length === 0;
    });
    
    if (pagesWithoutLabels.length > 0) {
      console.log(`⚠️ ラベルなしページ: ${pagesWithoutLabels.length}ページ`);
      pagesWithoutLabels.forEach(page => {
        console.log(`   - ${page.title} (ID: ${page.id})`);
      });
    } else {
      console.log(`✅ すべてのページにラベルが付いています`);
    }
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 最初の10ページの内容確認完了');
}

// テスト実行
if (require.main === module) {
  testFirst10Pages();
}

export { testFirst10Pages };
