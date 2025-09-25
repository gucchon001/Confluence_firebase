/**
 * シンプルなラベルデバッグテスト
 * 基本的なConfluence API呼び出しでラベル問題を特定
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

class SimpleLabelDebug {
  private baseUrl: string;
  private username: string;
  private apiToken: string;

  constructor() {
    this.baseUrl = process.env.CONFLUENCE_BASE_URL || '';
    this.username = process.env.CONFLUENCE_USER_EMAIL || '';
    this.apiToken = process.env.CONFLUENCE_API_TOKEN || '';
  }

  /**
   * Confluence APIからページを取得（ラベル情報含む）
   */
  async getConfluencePageWithLabels(pageId: string): Promise<ConfluencePage | null> {
    try {
      const url = `${this.baseUrl}/rest/api/content/${pageId}?expand=body.storage,space,version,metadata.labels`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`❌ API呼び出しエラー: ${response.status} ${response.statusText}`);
        return null;
      }

      const page = await response.json();
      return page;
    } catch (error) {
      console.error(`❌ ページ取得エラー (${pageId}):`, error);
      return null;
    }
  }

  /**
   * ラベル情報を詳細分析
   */
  analyzeLabels(page: ConfluencePage) {
    console.log(`\n📋 ページ分析: ${page.title}`);
    console.log(`  ページID: ${page.id}`);
    console.log(`  最終更新: ${page.version?.when || 'N/A'}`);
    
    // メタデータの詳細分析
    console.log(`\n🔍 メタデータ分析:`);
    console.log(`  metadata: ${JSON.stringify(page.metadata, null, 2)}`);
    
    if (page.metadata?.labels) {
      console.log(`\n📊 ラベル情報:`);
      console.log(`  labels: ${JSON.stringify(page.metadata.labels, null, 2)}`);
      
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
   * 複数ページのラベル状況を調査
   */
  async investigateMultiplePages() {
    console.log('🔍 複数ページのラベル状況を調査');
    console.log('=' .repeat(50));

    // テスト用のページID（議事録を含む）
    const testPageIds = [
      '703561854', // ユーザー指定のページID
      '1696530433', // 2025-09-10 ミーティング議事録（月初）
      '1696759809', // 2025-09-24 ミーティング議事録
      '703627373', // 012_【FIX】求人詳細閲覧機能
      '704643213', // 163_【FIX】教室情報編集機能
    ];

    const results = [];

    for (const pageId of testPageIds) {
      console.log(`\n🔍 ページID ${pageId} を調査中...`);
      
      const page = await this.getConfluencePageWithLabels(pageId);
      if (page) {
        this.analyzeLabels(page);
        results.push({
          pageId,
          title: page.title,
          hasLabels: !!(page.metadata?.labels?.results?.length),
          labelCount: page.metadata?.labels?.results?.length || 0,
          labels: page.metadata?.labels?.results?.map(l => l.name) || []
        });
      } else {
        console.log(`❌ ページID ${pageId} を取得できませんでした`);
        results.push({
          pageId,
          title: 'N/A',
          hasLabels: false,
          labelCount: 0,
          labels: []
        });
      }
    }

    return results;
  }

  /**
   * 調査結果をサマリー
   */
  generateSummary(results: any[]) {
    console.log('\n📊 調査結果サマリー');
    console.log('=' .repeat(50));

    const totalPages = results.length;
    const pagesWithLabels = results.filter(r => r.hasLabels).length;
    const pagesWithoutLabels = totalPages - pagesWithLabels;

    console.log(`📊 総ページ数: ${totalPages}`);
    console.log(`📊 ラベルあり: ${pagesWithLabels}件`);
    console.log(`📊 ラベルなし: ${pagesWithoutLabels}件`);
    console.log(`📊 ラベル率: ${((pagesWithLabels / totalPages) * 100).toFixed(1)}%`);

    console.log('\n📋 詳細結果:');
    results.forEach((result, index) => {
      console.log(`\n[${index + 1}] ${result.title}`);
      console.log(`  ページID: ${result.pageId}`);
      console.log(`  ラベル数: ${result.labelCount}`);
      console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
    });

    // 問題の特定
    console.log('\n⚠️ 特定された問題:');
    if (pagesWithoutLabels > 0) {
      console.log(`  1. ${pagesWithoutLabels}件のページでラベルが取得できていない`);
    }
    
    const meetingNotesPages = results.filter(r => 
      r.title.includes('議事録') || r.title.includes('ミーティング')
    );
    console.log(`  2. 議事録関連ページ: ${meetingNotesPages.length}件`);
    meetingNotesPages.forEach(page => {
      console.log(`     - ${page.title} (ラベル: ${page.labelCount}個)`);
    });

    // 推奨修正策
    console.log('\n💡 推奨修正策:');
    console.log('  1. Confluence APIのラベル取得方法を確認');
    console.log('  2. metadata.labels.expand パラメータの確認');
    console.log('  3. ラベル取得失敗時のフォールバック処理');
    console.log('  4. 議事録ページのラベル設定確認');
  }
}

// デバッグ実行
async function runSimpleLabelDebug() {
  const debug = new SimpleLabelDebug();
  
  try {
    console.log('🧪 シンプルラベルデバッグテスト開始');
    console.log('=' .repeat(50));
    
    const results = await debug.investigateMultiplePages();
    debug.generateSummary(results);
    
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error);
  }
}

// テスト実行
runSimpleLabelDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});

 * 基本的なConfluence API呼び出しでラベル問題を特定
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

class SimpleLabelDebug {
  private baseUrl: string;
  private username: string;
  private apiToken: string;

  constructor() {
    this.baseUrl = process.env.CONFLUENCE_BASE_URL || '';
    this.username = process.env.CONFLUENCE_USER_EMAIL || '';
    this.apiToken = process.env.CONFLUENCE_API_TOKEN || '';
  }

  /**
   * Confluence APIからページを取得（ラベル情報含む）
   */
  async getConfluencePageWithLabels(pageId: string): Promise<ConfluencePage | null> {
    try {
      const url = `${this.baseUrl}/rest/api/content/${pageId}?expand=body.storage,space,version,metadata.labels`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`❌ API呼び出しエラー: ${response.status} ${response.statusText}`);
        return null;
      }

      const page = await response.json();
      return page;
    } catch (error) {
      console.error(`❌ ページ取得エラー (${pageId}):`, error);
      return null;
    }
  }

  /**
   * ラベル情報を詳細分析
   */
  analyzeLabels(page: ConfluencePage) {
    console.log(`\n📋 ページ分析: ${page.title}`);
    console.log(`  ページID: ${page.id}`);
    console.log(`  最終更新: ${page.version?.when || 'N/A'}`);
    
    // メタデータの詳細分析
    console.log(`\n🔍 メタデータ分析:`);
    console.log(`  metadata: ${JSON.stringify(page.metadata, null, 2)}`);
    
    if (page.metadata?.labels) {
      console.log(`\n📊 ラベル情報:`);
      console.log(`  labels: ${JSON.stringify(page.metadata.labels, null, 2)}`);
      
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
   * 複数ページのラベル状況を調査
   */
  async investigateMultiplePages() {
    console.log('🔍 複数ページのラベル状況を調査');
    console.log('=' .repeat(50));

    // テスト用のページID（議事録を含む）
    const testPageIds = [
      '703561854', // ユーザー指定のページID
      '1696530433', // 2025-09-10 ミーティング議事録（月初）
      '1696759809', // 2025-09-24 ミーティング議事録
      '703627373', // 012_【FIX】求人詳細閲覧機能
      '704643213', // 163_【FIX】教室情報編集機能
    ];

    const results = [];

    for (const pageId of testPageIds) {
      console.log(`\n🔍 ページID ${pageId} を調査中...`);
      
      const page = await this.getConfluencePageWithLabels(pageId);
      if (page) {
        this.analyzeLabels(page);
        results.push({
          pageId,
          title: page.title,
          hasLabels: !!(page.metadata?.labels?.results?.length),
          labelCount: page.metadata?.labels?.results?.length || 0,
          labels: page.metadata?.labels?.results?.map(l => l.name) || []
        });
      } else {
        console.log(`❌ ページID ${pageId} を取得できませんでした`);
        results.push({
          pageId,
          title: 'N/A',
          hasLabels: false,
          labelCount: 0,
          labels: []
        });
      }
    }

    return results;
  }

  /**
   * 調査結果をサマリー
   */
  generateSummary(results: any[]) {
    console.log('\n📊 調査結果サマリー');
    console.log('=' .repeat(50));

    const totalPages = results.length;
    const pagesWithLabels = results.filter(r => r.hasLabels).length;
    const pagesWithoutLabels = totalPages - pagesWithLabels;

    console.log(`📊 総ページ数: ${totalPages}`);
    console.log(`📊 ラベルあり: ${pagesWithLabels}件`);
    console.log(`📊 ラベルなし: ${pagesWithoutLabels}件`);
    console.log(`📊 ラベル率: ${((pagesWithLabels / totalPages) * 100).toFixed(1)}%`);

    console.log('\n📋 詳細結果:');
    results.forEach((result, index) => {
      console.log(`\n[${index + 1}] ${result.title}`);
      console.log(`  ページID: ${result.pageId}`);
      console.log(`  ラベル数: ${result.labelCount}`);
      console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
    });

    // 問題の特定
    console.log('\n⚠️ 特定された問題:');
    if (pagesWithoutLabels > 0) {
      console.log(`  1. ${pagesWithoutLabels}件のページでラベルが取得できていない`);
    }
    
    const meetingNotesPages = results.filter(r => 
      r.title.includes('議事録') || r.title.includes('ミーティング')
    );
    console.log(`  2. 議事録関連ページ: ${meetingNotesPages.length}件`);
    meetingNotesPages.forEach(page => {
      console.log(`     - ${page.title} (ラベル: ${page.labelCount}個)`);
    });

    // 推奨修正策
    console.log('\n💡 推奨修正策:');
    console.log('  1. Confluence APIのラベル取得方法を確認');
    console.log('  2. metadata.labels.expand パラメータの確認');
    console.log('  3. ラベル取得失敗時のフォールバック処理');
    console.log('  4. 議事録ページのラベル設定確認');
  }
}

// デバッグ実行
async function runSimpleLabelDebug() {
  const debug = new SimpleLabelDebug();
  
  try {
    console.log('🧪 シンプルラベルデバッグテスト開始');
    console.log('=' .repeat(50));
    
    const results = await debug.investigateMultiplePages();
    debug.generateSummary(results);
    
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error);
  }
}

// テスト実行
runSimpleLabelDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
