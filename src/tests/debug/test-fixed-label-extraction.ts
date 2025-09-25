/**
 * 修正版ラベル抽出テスト
 * 正しいラベル取得ロジックを実装
 */

import 'dotenv/config';

interface ConfluencePage {
  id: string;
  title: string;
  metadata?: {
    labels?: {
      results?: Array<{
        name: string;
        label: string;
        prefix: string;
        id: string;
      }>;
    };
  };
}

class FixedLabelExtractor {
  private baseUrl: string;
  private username: string;
  private apiToken: string;
  private spaceKey: string;

  constructor() {
    this.baseUrl = process.env.CONFLUENCE_BASE_URL || '';
    this.username = process.env.CONFLUENCE_USER_EMAIL || '';
    this.apiToken = process.env.CONFLUENCE_API_TOKEN || '';
    this.spaceKey = process.env.CONFLUENCE_SPACE_KEY || '';
  }

  /**
   * 修正版ラベル抽出
   */
  extractLabelsFromPage(page: ConfluencePage): string[] {
    if (!page.metadata?.labels?.results) {
      return [];
    }

    return page.metadata.labels.results.map(label => label.name);
  }

  /**
   * Confluence APIからページ一覧を取得（ラベル情報含む）
   */
  async getConfluencePagesWithLabels(limit: number = 10): Promise<ConfluencePage[]> {
    const url = `${this.baseUrl}/wiki/rest/api/content?spaceKey=${this.spaceKey}&expand=body.storage,space,version,metadata.labels&limit=${limit}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API呼び出しエラー: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  /**
   * ラベルフィルタリングをテスト
   */
  async testLabelFiltering() {
    console.log('🧪 修正版ラベルフィルタリングテスト');
    console.log('=' .repeat(50));

    try {
      // ページ一覧を取得
      const pages = await this.getConfluencePagesWithLabels(20);
      console.log(`📄 取得したページ数: ${pages.length}件`);

      // 各ページのラベル情報を分析
      const labelAnalysis = [];
      for (const page of pages) {
        const labels = this.extractLabelsFromPage(page);
        labelAnalysis.push({
          pageId: page.id,
          title: page.title,
          labels: labels,
          hasLabels: labels.length > 0
        });

        console.log(`\n📋 ページ: ${page.title}`);
        console.log(`  ページID: ${page.id}`);
        console.log(`  ラベル: ${JSON.stringify(labels)}`);
        console.log(`  ラベル数: ${labels.length}個`);
      }

      // ラベルフィルタリングを実行
      const excludeLabels = ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive'];
      
      console.log('\n🔍 ラベルフィルタリング実行');
      console.log(`除外ラベル: ${JSON.stringify(excludeLabels)}`);

      const filteredPages = labelAnalysis.filter(page => {
        const hasExcludedLabel = page.labels.some(label => 
          excludeLabels.some(excludeLabel => 
            label.toLowerCase().includes(excludeLabel.toLowerCase())
          )
        );
        return !hasExcludedLabel;
      });

      console.log(`\n📊 フィルタリング結果:`);
      console.log(`  総ページ数: ${labelAnalysis.length}`);
      console.log(`  フィルタリング後: ${filteredPages.length}`);
      console.log(`  除外されたページ数: ${labelAnalysis.length - filteredPages.length}`);

      // 除外されたページを表示
      const excludedPages = labelAnalysis.filter(page => {
        const hasExcludedLabel = page.labels.some(label => 
          excludeLabels.some(excludeLabel => 
            label.toLowerCase().includes(excludeLabel.toLowerCase())
          )
        );
        return hasExcludedLabel;
      });

      if (excludedPages.length > 0) {
        console.log('\n🚫 除外されたページ:');
        excludedPages.forEach((page, index) => {
          console.log(`  [${index + 1}] ${page.title} - ラベル: ${JSON.stringify(page.labels)}`);
        });
      }

      // 議事録ページを特定
      const meetingPages = labelAnalysis.filter(page => 
        page.title.includes('議事録') || 
        page.title.includes('ミーティング') ||
        page.title.includes('meeting')
      );

      console.log(`\n📋 議事録関連ページ: ${meetingPages.length}件`);
      meetingPages.forEach((page, index) => {
        console.log(`  [${index + 1}] ${page.title} - ラベル: ${JSON.stringify(page.labels)}`);
      });

      return {
        totalPages: labelAnalysis.length,
        filteredPages: filteredPages.length,
        excludedPages: excludedPages.length,
        meetingPages: meetingPages.length
      };

    } catch (error) {
      console.error('❌ テスト実行エラー:', error);
      throw error;
    }
  }

  /**
   * 修正版ラベル取得ロジックをテスト
   */
  async testFixedLabelLogic() {
    console.log('\n🧪 修正版ラベル取得ロジックテスト');
    console.log('=' .repeat(50));

    try {
      const pages = await this.getConfluencePagesWithLabels(5);
      
      console.log('📋 修正版ラベル取得ロジックのテスト:');
      pages.forEach((page, index) => {
        console.log(`\n[${index + 1}] ${page.title}`);
        console.log(`  ページID: ${page.id}`);
        
        // 生のメタデータを表示
        console.log(`  生のメタデータ: ${JSON.stringify(page.metadata, null, 2)}`);
        
        // 修正版ラベル抽出
        const labels = this.extractLabelsFromPage(page);
        console.log(`  抽出されたラベル: ${JSON.stringify(labels)}`);
        
        // ラベルフィルタリングのテスト
        const excludeLabels = ['フォルダ', '議事録'];
        const hasExcludedLabel = labels.some(label => 
          excludeLabels.some(excludeLabel => 
            label.toLowerCase().includes(excludeLabel.toLowerCase())
          )
        );
        console.log(`  除外対象: ${hasExcludedLabel ? 'はい' : 'いいえ'}`);
      });

    } catch (error) {
      console.error('❌ テスト実行エラー:', error);
    }
  }

  /**
   * デバッグ結果をサマリー
   */
  generateDebugSummary(results: any) {
    console.log('\n📊 修正版ラベル機能デバッグ結果サマリー');
    console.log('=' .repeat(50));

    console.log('✅ 修正された問題:');
    console.log('  1. ラベル情報の取得方法を修正');
    console.log('  2. metadata.labels.results から正しくラベルを抽出');
    console.log('  3. ラベルフィルタリング機能を修正');

    console.log('\n📊 テスト結果:');
    console.log(`  総ページ数: ${results.totalPages}`);
    console.log(`  フィルタリング後: ${results.filteredPages}`);
    console.log(`  除外されたページ数: ${results.excludedPages}`);
    console.log(`  議事録関連ページ: ${results.meetingPages}`);

    console.log('\n💡 推奨される次のステップ:');
    console.log('  1. 修正版ラベル取得ロジックを本番環境に適用');
    console.log('  2. ラベルフィルタリング機能を修正');
    console.log('  3. 全データの再同期を実行');
    console.log('  4. ラベル機能の動作確認');
  }
}

// デバッグ実行
async function runFixedLabelTest() {
  const extractor = new FixedLabelExtractor();
  
  try {
    console.log('🧪 修正版ラベル機能テスト開始');
    console.log('=' .repeat(50));
    
    const results = await extractor.testLabelFiltering();
    await extractor.testFixedLabelLogic();
    extractor.generateDebugSummary(results);
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

// テスト実行
runFixedLabelTest().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});

interface ConfluencePage {
  id: string;
  title: string;
  metadata?: {
    labels?: {
      results?: Array<{
        name: string;
        label: string;
        prefix: string;
        id: string;
      }>;
    };
  };
}

class FixedLabelExtractor {
  private baseUrl: string;
  private username: string;
  private apiToken: string;
  private spaceKey: string;

  constructor() {
    this.baseUrl = process.env.CONFLUENCE_BASE_URL || '';
    this.username = process.env.CONFLUENCE_USER_EMAIL || '';
    this.apiToken = process.env.CONFLUENCE_API_TOKEN || '';
    this.spaceKey = process.env.CONFLUENCE_SPACE_KEY || '';
  }

  /**
   * 修正版ラベル抽出
   */
  extractLabelsFromPage(page: ConfluencePage): string[] {
    if (!page.metadata?.labels?.results) {
      return [];
    }

    return page.metadata.labels.results.map(label => label.name);
  }

  /**
   * Confluence APIからページ一覧を取得（ラベル情報含む）
   */
  async getConfluencePagesWithLabels(limit: number = 10): Promise<ConfluencePage[]> {
    const url = `${this.baseUrl}/wiki/rest/api/content?spaceKey=${this.spaceKey}&expand=body.storage,space,version,metadata.labels&limit=${limit}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API呼び出しエラー: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  /**
   * ラベルフィルタリングをテスト
   */
  async testLabelFiltering() {
    console.log('🧪 修正版ラベルフィルタリングテスト');
    console.log('=' .repeat(50));

    try {
      // ページ一覧を取得
      const pages = await this.getConfluencePagesWithLabels(20);
      console.log(`📄 取得したページ数: ${pages.length}件`);

      // 各ページのラベル情報を分析
      const labelAnalysis = [];
      for (const page of pages) {
        const labels = this.extractLabelsFromPage(page);
        labelAnalysis.push({
          pageId: page.id,
          title: page.title,
          labels: labels,
          hasLabels: labels.length > 0
        });

        console.log(`\n📋 ページ: ${page.title}`);
        console.log(`  ページID: ${page.id}`);
        console.log(`  ラベル: ${JSON.stringify(labels)}`);
        console.log(`  ラベル数: ${labels.length}個`);
      }

      // ラベルフィルタリングを実行
      const excludeLabels = ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive'];
      
      console.log('\n🔍 ラベルフィルタリング実行');
      console.log(`除外ラベル: ${JSON.stringify(excludeLabels)}`);

      const filteredPages = labelAnalysis.filter(page => {
        const hasExcludedLabel = page.labels.some(label => 
          excludeLabels.some(excludeLabel => 
            label.toLowerCase().includes(excludeLabel.toLowerCase())
          )
        );
        return !hasExcludedLabel;
      });

      console.log(`\n📊 フィルタリング結果:`);
      console.log(`  総ページ数: ${labelAnalysis.length}`);
      console.log(`  フィルタリング後: ${filteredPages.length}`);
      console.log(`  除外されたページ数: ${labelAnalysis.length - filteredPages.length}`);

      // 除外されたページを表示
      const excludedPages = labelAnalysis.filter(page => {
        const hasExcludedLabel = page.labels.some(label => 
          excludeLabels.some(excludeLabel => 
            label.toLowerCase().includes(excludeLabel.toLowerCase())
          )
        );
        return hasExcludedLabel;
      });

      if (excludedPages.length > 0) {
        console.log('\n🚫 除外されたページ:');
        excludedPages.forEach((page, index) => {
          console.log(`  [${index + 1}] ${page.title} - ラベル: ${JSON.stringify(page.labels)}`);
        });
      }

      // 議事録ページを特定
      const meetingPages = labelAnalysis.filter(page => 
        page.title.includes('議事録') || 
        page.title.includes('ミーティング') ||
        page.title.includes('meeting')
      );

      console.log(`\n📋 議事録関連ページ: ${meetingPages.length}件`);
      meetingPages.forEach((page, index) => {
        console.log(`  [${index + 1}] ${page.title} - ラベル: ${JSON.stringify(page.labels)}`);
      });

      return {
        totalPages: labelAnalysis.length,
        filteredPages: filteredPages.length,
        excludedPages: excludedPages.length,
        meetingPages: meetingPages.length
      };

    } catch (error) {
      console.error('❌ テスト実行エラー:', error);
      throw error;
    }
  }

  /**
   * 修正版ラベル取得ロジックをテスト
   */
  async testFixedLabelLogic() {
    console.log('\n🧪 修正版ラベル取得ロジックテスト');
    console.log('=' .repeat(50));

    try {
      const pages = await this.getConfluencePagesWithLabels(5);
      
      console.log('📋 修正版ラベル取得ロジックのテスト:');
      pages.forEach((page, index) => {
        console.log(`\n[${index + 1}] ${page.title}`);
        console.log(`  ページID: ${page.id}`);
        
        // 生のメタデータを表示
        console.log(`  生のメタデータ: ${JSON.stringify(page.metadata, null, 2)}`);
        
        // 修正版ラベル抽出
        const labels = this.extractLabelsFromPage(page);
        console.log(`  抽出されたラベル: ${JSON.stringify(labels)}`);
        
        // ラベルフィルタリングのテスト
        const excludeLabels = ['フォルダ', '議事録'];
        const hasExcludedLabel = labels.some(label => 
          excludeLabels.some(excludeLabel => 
            label.toLowerCase().includes(excludeLabel.toLowerCase())
          )
        );
        console.log(`  除外対象: ${hasExcludedLabel ? 'はい' : 'いいえ'}`);
      });

    } catch (error) {
      console.error('❌ テスト実行エラー:', error);
    }
  }

  /**
   * デバッグ結果をサマリー
   */
  generateDebugSummary(results: any) {
    console.log('\n📊 修正版ラベル機能デバッグ結果サマリー');
    console.log('=' .repeat(50));

    console.log('✅ 修正された問題:');
    console.log('  1. ラベル情報の取得方法を修正');
    console.log('  2. metadata.labels.results から正しくラベルを抽出');
    console.log('  3. ラベルフィルタリング機能を修正');

    console.log('\n📊 テスト結果:');
    console.log(`  総ページ数: ${results.totalPages}`);
    console.log(`  フィルタリング後: ${results.filteredPages}`);
    console.log(`  除外されたページ数: ${results.excludedPages}`);
    console.log(`  議事録関連ページ: ${results.meetingPages}`);

    console.log('\n💡 推奨される次のステップ:');
    console.log('  1. 修正版ラベル取得ロジックを本番環境に適用');
    console.log('  2. ラベルフィルタリング機能を修正');
    console.log('  3. 全データの再同期を実行');
    console.log('  4. ラベル機能の動作確認');
  }
}

// デバッグ実行
async function runFixedLabelTest() {
  const extractor = new FixedLabelExtractor();
  
  try {
    console.log('🧪 修正版ラベル機能テスト開始');
    console.log('=' .repeat(50));
    
    const results = await extractor.testLabelFiltering();
    await extractor.testFixedLabelLogic();
    extractor.generateDebugSummary(results);
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

// テスト実行
runFixedLabelTest().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
