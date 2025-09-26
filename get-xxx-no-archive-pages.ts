/**
 * タイトルに「xxx_」があり、かつラベルに「アーカイブ」が含まれていないページを抽出
 */

import 'dotenv/config';
import axios from 'axios';

interface ConfluencePage {
  id: string;
  title: string;
  space: {
    key: string;
    name: string;
  };
  version: {
    when: string;
  };
  metadata: {
    labels: {
      results: Array<{
        name: string;
      }>;
    };
  };
  _links: {
    webui: string;
  };
}

interface XxxNoArchivePagesResult {
  totalPages: number;
  pages: Array<{
    id: string;
    title: string;
    spaceKey: string;
    spaceName: string;
    lastModified: string;
    labels: string[];
    url: string;
  }>;
  searchQuery: string;
  timestamp: string;
}

async function getXxxNoArchivePages(): Promise<XxxNoArchivePagesResult> {
  try {
    console.log('🔍 タイトルに「xxx_」があり、かつラベルに「アーカイブ」が含まれていないページを検索中...');
    
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const username = process.env.CONFLUENCE_USER_EMAIL;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;

    if (!baseUrl || !username || !apiToken) {
      throw new Error('Confluence APIの設定が不完全です。環境変数を確認してください。');
    }

    console.log(`📡 API URL: ${baseUrl}`);
    console.log(`👤 ユーザー: ${username}`);
    console.log(`📁 スペース: ${spaceKey || '全スペース'}`);

    // CQLクエリで「xxx_」を含むタイトルを検索（アーカイブラベルは除外）
    const cqlQuery = spaceKey 
      ? `space = "${spaceKey}" AND title ~ "xxx_" AND NOT label = "アーカイブ"`
      : `title ~ "xxx_" AND NOT label = "アーカイブ"`;

    console.log(`🔎 検索クエリ: ${cqlQuery}`);

    const response = await axios.get(`${baseUrl}/wiki/rest/api/content/search`, {
      params: {
        cql: cqlQuery,
        expand: 'space,version,metadata.labels',
        limit: 500 // 最大500ページまで取得
      },
      auth: { 
        username, 
        password: apiToken 
      },
      timeout: 30000 // 30秒タイムアウト
    });

    console.log(`📊 APIレスポンス: ${response.status} ${response.statusText}`);
    console.log(`📄 取得したページ数: ${response.data.results?.length || 0}`);

    if (!response.data.results || response.data.results.length === 0) {
      console.log('⚠️ 条件に合致するページが見つかりませんでした。');
      return {
        totalPages: 0,
        pages: [],
        searchQuery: cqlQuery,
        timestamp: new Date().toISOString()
      };
    }

    // 結果を整形
    const pages = response.data.results.map((page: ConfluencePage) => {
      const labels = page.metadata?.labels?.results?.map(label => label.name) || [];
      
      return {
        id: page.id,
        title: page.title,
        spaceKey: page.space?.key || '',
        spaceName: page.space?.name || '',
        lastModified: page.version?.when || '',
        labels: labels,
        url: `${baseUrl}/wiki/spaces/${page.space?.key}/pages/${page.id}`
      };
    });

    console.log('\n📋 検索結果:');
    console.log('=' * 80);
    
    pages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.title}`);
      console.log(`   ID: ${page.id}`);
      console.log(`   スペース: ${page.spaceName} (${page.spaceKey})`);
      console.log(`   最終更新: ${new Date(page.lastModified).toLocaleString('ja-JP')}`);
      console.log(`   ラベル: ${page.labels.join(', ')}`);
      console.log(`   URL: ${page.url}`);
      console.log('');
    });

    const result: XxxNoArchivePagesResult = {
      totalPages: pages.length,
      pages: pages,
      searchQuery: cqlQuery,
      timestamp: new Date().toISOString()
    };

    // 結果をJSONファイルに保存
    const filename = `xxx-no-archive-pages-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const fs = require('fs');
    fs.writeFileSync(filename, JSON.stringify(result, null, 2));
    console.log(`💾 結果を保存しました: ${filename}`);

    // 統計情報を表示
    console.log('\n📊 統計情報:');
    console.log('=' * 50);
    console.log(`総ページ数: ${result.totalPages}件`);
    
    // ラベル別統計
    const labelCounts: { [key: string]: number } = {};
    pages.forEach(page => {
      page.labels.forEach(label => {
        labelCounts[label] = (labelCounts[label] || 0) + 1;
      });
    });

    console.log('\n🏷️ ラベル別統計:');
    const sortedLabels = Object.entries(labelCounts)
      .sort(([,a], [,b]) => b - a);
    
    if (sortedLabels.length > 0) {
      sortedLabels.forEach(([label, count]) => {
        console.log(`   ${label}: ${count}件`);
      });
    } else {
      console.log('   ラベルはありません');
    }

    // タイトルパターン分析
    console.log('\n📝 タイトルパターン分析:');
    const titlePatterns: { [key: string]: number } = {};
    pages.forEach(page => {
      // 「xxx_」の後の部分を抽出
      const match = page.title.match(/xxx_(.+)/);
      if (match) {
        const pattern = match[1].split('_')[0]; // 最初のアンダースコアまでの部分
        titlePatterns[pattern] = (titlePatterns[pattern] || 0) + 1;
      }
    });

    const sortedPatterns = Object.entries(titlePatterns)
      .sort(([,a], [,b]) => b - a);
    
    if (sortedPatterns.length > 0) {
      sortedPatterns.forEach(([pattern, count]) => {
        console.log(`   xxx_${pattern}: ${count}件`);
      });
    }

    return result;

  } catch (error: any) {
    console.error('❌ エラーが発生しました:');
    if (error.response) {
      console.error(`HTTP Status: ${error.response.status}`);
      console.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      console.error('APIリクエストが失敗しました:', error.message);
    } else {
      console.error('予期しないエラー:', error.message);
    }
    throw error;
  }
}

// メイン実行
async function main() {
  try {
    const result = await getXxxNoArchivePages();
    console.log(`\n✅ 完了: ${result.totalPages}件の「xxx_」タイトル（アーカイブ除外）ページを取得しました`);
  } catch (error) {
    console.error('❌ スクリプト実行に失敗しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain()を呼び出し
if (require.main === module) {
  main();
}

export { getXxxNoArchivePages };
