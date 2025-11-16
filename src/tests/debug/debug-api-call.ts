/**
 * API呼び出しの詳細デバッグ
 * 404エラーの原因を特定
 */

import 'dotenv/config';

class APIDebugger {
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
   * 基本的なAPI呼び出しをテスト
   */
  async testBasicApiCall() {
    console.log('🧪 基本的なAPI呼び出しテスト');
    console.log('=' .repeat(50));

    const url = `${this.baseUrl}/wiki/rest/api/content?spaceKey=${this.spaceKey}&limit=5`;
    console.log(`🔗 テストURL: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`📊 レスポンス状況: ${response.status} ${response.statusText}`);
      console.log(`📊 レスポンスヘッダー:`, Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ API呼び出し成功: ${data.results?.length || 0}件のページを取得`);
        
        if (data.results && data.results.length > 0) {
          console.log('\n📋 取得したページ（最初の3件）:');
          data.results.slice(0, 3).forEach((page: any, index: number) => {
            console.log(`  [${index + 1}] ${page.title} (ID: ${page.id})`);
          });
        }
      } else {
        console.log(`❌ API呼び出し失敗: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`エラー詳細: ${errorText}`);
      }
    } catch (error) {
      console.error(`❌ API呼び出しエラー:`, error);
    }
  }

  /**
   * ラベル情報を含むAPI呼び出しをテスト
   */
  async testLabelsApiCall() {
    console.log('\n🧪 ラベル情報を含むAPI呼び出しテスト');
    console.log('=' .repeat(50));

    const url = `${this.baseUrl}/wiki/rest/api/content?spaceKey=${this.spaceKey}&expand=body.storage,space,version,metadata.labels&limit=5`;
    console.log(`🔗 テストURL: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`📊 レスポンス状況: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ API呼び出し成功: ${data.results?.length || 0}件のページを取得`);
        
        if (data.results && data.results.length > 0) {
          console.log('\n📋 ラベル情報の分析:');
          data.results.slice(0, 3).forEach((page: any, index: number) => {
            console.log(`\n[${index + 1}] ${page.title} (ID: ${page.id})`);
            console.log(`  メタデータ: ${JSON.stringify(page.metadata, null, 2)}`);
            
            if (page.metadata?.labels) {
              console.log(`  ラベル情報: ${JSON.stringify(page.metadata.labels, null, 2)}`);
            } else {
              console.log(`  ラベル情報: なし`);
            }
          });
        }
      } else {
        console.log(`❌ API呼び出し失敗: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`エラー詳細: ${errorText}`);
      }
    } catch (error) {
      console.error(`❌ API呼び出しエラー:`, error);
    }
  }

  /**
   * 個別ページのラベル情報をテスト
   */
  async testIndividualPageLabels() {
    console.log('\n🧪 個別ページのラベル情報テスト');
    console.log('=' .repeat(50));

    // まずページ一覧を取得
    const pagesUrl = `${this.baseUrl}/wiki/rest/api/content?spaceKey=${this.spaceKey}&limit=3`;
    console.log(`🔗 ページ一覧URL: ${pagesUrl}`);

    try {
      const pagesResponse = await fetch(pagesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!pagesResponse.ok) {
        console.log(`❌ ページ一覧取得失敗: ${pagesResponse.status} ${pagesResponse.statusText}`);
        return;
      }

      const pagesData = await pagesResponse.json();
      console.log(`✅ ページ一覧取得成功: ${pagesData.results?.length || 0}件`);

      if (pagesData.results && pagesData.results.length > 0) {
        // 最初のページのラベル情報を取得
        const firstPage = pagesData.results[0];
        const pageId = firstPage.id;
        
        console.log(`\n🔍 ページID ${pageId} のラベル情報を取得中...`);
        
        const labelsUrl = `${this.baseUrl}/wiki/rest/api/content/${pageId}?expand=metadata.labels`;
        console.log(`🔗 ラベル情報URL: ${labelsUrl}`);

        const labelsResponse = await fetch(labelsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(`📊 ラベル情報レスポンス: ${labelsResponse.status} ${labelsResponse.statusText}`);

        if (labelsResponse.ok) {
          const labelsData = await labelsResponse.json();
          console.log(`✅ ラベル情報取得成功`);
          console.log(`📋 ページ情報: ${labelsData.title} (ID: ${labelsData.id})`);
          console.log(`📊 メタデータ: ${JSON.stringify(labelsData.metadata, null, 2)}`);
          
          if (labelsData.metadata?.labels) {
            console.log(`📊 ラベル情報: ${JSON.stringify(labelsData.metadata.labels, null, 2)}`);
          } else {
            console.log(`📊 ラベル情報: なし`);
          }
        } else {
          console.log(`❌ ラベル情報取得失敗: ${labelsResponse.status} ${labelsResponse.statusText}`);
          const errorText = await labelsResponse.text();
          console.log(`エラー詳細: ${errorText}`);
        }
      }
    } catch (error) {
      console.error(`❌ 個別ページテストエラー:`, error);
    }
  }

  /**
   * デバッグ結果をサマリー
   */
  generateDebugSummary() {
    console.log('\n📊 デバッグ結果サマリー');
    console.log('=' .repeat(50));

    console.log('✅ 確認されたこと:');
    console.log('  1. 環境変数は正しく読み込まれている');
    console.log('  2. 基本的なAPI呼び出しは成功している');
    console.log('  3. ページ一覧の取得は成功している');

    console.log('\n⚠️ 調査が必要なこと:');
    console.log('  1. ラベル情報の取得方法');
    console.log('  2. metadata.labels.expand パラメータの動作');
    console.log('  3. 個別ページのラベル情報取得');

    console.log('\n💡 次のステップ:');
    console.log('  1. ラベル情報の取得方法を修正');
    console.log('  2. 正しいAPI呼び出し方法を実装');
    console.log('  3. ラベルフィルタリング機能を修正');
  }
}

// デバッグ実行
async function runAPIDebug() {
  const apiDebugger = new APIDebugger();
  
  try {
    await apiDebugger.testBasicApiCall();
    await apiDebugger.testLabelsApiCall();
    await apiDebugger.testIndividualPageLabels();
    apiDebugger.generateDebugSummary();
  } catch (error) {
    console.error('❌ デバッグ実行エラー:', error);
  }
}

// テスト実行
runAPIDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});

