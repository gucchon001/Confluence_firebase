/**
 * 実際に存在するページIDでテスト
 * Confluence APIから直接ページ一覧を取得してテスト
 */

import 'dotenv/config';

interface ConfluencePage {
  id: string;
  title: string;
  body?: {
    storage?: {
      value?: string;
    };
  };
  version?: {
    when?: string;
  };
  space?: {
    key?: string;
  };
  _links?: {
    webui?: string;
  };
  metadata?: {
    labels?: {
      results?: Array<{
        name?: string;
      }>;
    };
  };
}

class ExistingPagesTest {
  private baseUrl: string;
  private username: string;
  private apiToken: string;

  constructor() {
    this.baseUrl = process.env.CONFLUENCE_BASE_URL || '';
    this.username = process.env.CONFLUENCE_USER_EMAIL || '';
    this.apiToken = process.env.CONFLUENCE_API_TOKEN || '';
  }

  /**
   * Confluence APIからページ一覧を取得
   */
  async getConfluencePages(limit: number = 10): Promise<ConfluencePage[]> {
    try {
      const url = `${this.baseUrl}/rest/api/content?spaceKey=CLIENTTOMO&expand=body.storage,space,version,metadata.labels&limit=${limit}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`❌ API呼び出しエラー: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error(`❌ ページ一覧取得エラー:`, error);
      return [];
    }
  }

  /**
   * 個別ページのラベル情報を取得
   */
  async getPageLabels(pageId: string): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/rest/api/content/${pageId}?expand=metadata.labels`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`❌ ラベル取得エラー (${pageId}): ${response.status} ${response.statusText}`);
        return [];
      }

      const page = await response.json();
      const labels = page.metadata?.labels?.results?.map((l: any) => l.name) || [];
      return labels;
    } catch (error) {
      console.error(`❌ ラベル取得エラー (${pageId}):`, error);
      return [];
    }
  }

  /**
   * ページのラベル情報を詳細分析
   */
  analyzePageLabels(page: ConfluencePage) {
    console.log(`\n📋 ページ分析: ${page.title}`);
    console.log(`  ページID: ${page.id}`);
    console.log(`  最終更新: ${page.version?.when || 'N/A'}`);
    console.log(`  スペース: ${page.space?.key || 'N/A'}`);
    
    // メタデータの詳細分析
    if (page.metadata?.labels) {
      console.log(`\n📊 ラベル情報:`);
      console.log(`  metadata.labels: ${JSON.stringify(page.metadata.labels, null, 2)}`);
      
      if (page.metadata.labels.results) {
        console.log(`  ラベル数: ${page.metadata.labels.results.length}`);
        page.metadata.labels.results.forEach((label, index) => {
          console.log(`    [${index}] ${JSON.stringify(label)}`);
        });
      } else {
        console.log(`  results プロパティが存在しません`);
      }
    } else {
      console.log(`  metadata.labels が存在しません`);
    }
  }

  /**
   * 議事録ページを特定
   */
  identifyMeetingPages(pages: ConfluencePage[]) {
    const meetingPages = pages.filter(page => 
      page.title.includes('議事録') || 
      page.title.includes('ミーティング') ||
      page.title.includes('meeting')
    );

    console.log(`\n📋 議事録関連ページ: ${meetingPages.length}件`);
    meetingPages.forEach((page, index) => {
      console.log(`\n[${index + 1}] ${page.title}`);
      console.log(`  ページID: ${page.id}`);
      console.log(`  最終更新: ${page.version?.when || 'N/A'}`);
      
      // ラベル情報を取得
      this.getPageLabels(page.id).then(labels => {
        console.log(`  ラベル: ${JSON.stringify(labels)}`);
      });
    });

    return meetingPages;
  }

  /**
   * ラベル機能の動作テスト
   */
  async testLabelFunctionality() {
    console.log('🧪 ラベル機能の動作テスト');
    console.log('=' .repeat(50));

    // ページ一覧を取得
    const pages = await this.getConfluencePages(20);
    console.log(`📄 取得したページ数: ${pages.length}件`);

    if (pages.length === 0) {
      console.log('❌ ページを取得できませんでした');
      return;
    }

    // 各ページのラベル情報を分析
    const labelAnalysis = [];
    for (const page of pages) {
      console.log(`\n🔍 ページ分析: ${page.title}`);
      this.analyzePageLabels(page);
      
      const labels = await this.getPageLabels(page.id);
      labelAnalysis.push({
        pageId: page.id,
        title: page.title,
        hasLabels: labels.length > 0,
        labelCount: labels.length,
        labels: labels
      });
    }

    // 議事録ページを特定
    const meetingPages = this.identifyMeetingPages(pages);

    // 結果をサマリー
    this.generateLabelSummary(labelAnalysis, meetingPages);
  }

  /**
   * ラベル機能の結果をサマリー
   */
  generateLabelSummary(labelAnalysis: any[], meetingPages: ConfluencePage[]) {
    console.log('\n📊 ラベル機能テスト結果サマリー');
    console.log('=' .repeat(50));

    const totalPages = labelAnalysis.length;
    const pagesWithLabels = labelAnalysis.filter(p => p.hasLabels).length;
    const pagesWithoutLabels = totalPages - pagesWithLabels;

    console.log(`📊 総ページ数: ${totalPages}`);
    console.log(`📊 ラベルあり: ${pagesWithLabels}件`);
    console.log(`📊 ラベルなし: ${pagesWithoutLabels}件`);
    console.log(`📊 ラベル率: ${((pagesWithLabels / totalPages) * 100).toFixed(1)}%`);

    console.log(`\n📋 議事録関連ページ: ${meetingPages.length}件`);
    meetingPages.forEach((page, index) => {
      const analysis = labelAnalysis.find(a => a.pageId === page.id);
      console.log(`  [${index + 1}] ${page.title}`);
      console.log(`    ラベル数: ${analysis?.labelCount || 0}`);
      console.log(`    ラベル: ${JSON.stringify(analysis?.labels || [])}`);
    });

    // 問題の特定
    console.log('\n⚠️ 特定された問題:');
    if (pagesWithoutLabels > 0) {
      console.log(`  1. ${pagesWithoutLabels}件のページでラベルが取得できていない`);
    }
    
    const meetingPagesWithLabels = meetingPages.filter(page => {
      const analysis = labelAnalysis.find(a => a.pageId === page.id);
      return analysis?.hasLabels;
    });
    
    console.log(`  2. 議事録ページのラベル状況: ${meetingPagesWithLabels.length}/${meetingPages.length}件にラベルあり`);

    // 推奨修正策
    console.log('\n💡 推奨修正策:');
    if (pagesWithoutLabels > 0) {
      console.log('  1. Confluence APIのラベル取得方法を確認');
      console.log('  2. metadata.labels.expand パラメータの確認');
      console.log('  3. ラベル取得失敗時のフォールバック処理');
    }
    
    if (meetingPagesWithLabels.length === 0) {
      console.log('  4. 議事録ページにラベルを設定する必要がある');
      console.log('  5. ラベルベースの除外が機能しないため、タイトルベースの除外を検討');
    }
  }
}

// デバッグ実行
async function runExistingPagesTest() {
  const test = new ExistingPagesTest();
  
  try {
    console.log('🧪 実際に存在するページIDでテスト開始');
    console.log('=' .repeat(50));
    
    await test.testLabelFunctionality();
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

// テスト実行
runExistingPagesTest().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});

