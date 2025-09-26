/**
 * 抽出した33件のページから「フォルダ」ラベルを削除
 */

import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface FolderPage {
  id: string;
  title: string;
  spaceKey: string;
  spaceName: string;
  lastModified: string;
  labels: string[];
  url: string;
}

interface FolderPagesResult {
  totalPages: number;
  pages: FolderPage[];
  searchQuery: string;
  timestamp: string;
}

interface LabelRemovalResult {
  pageId: string;
  title: string;
  success: boolean;
  error?: string;
  labelsBefore: string[];
  labelsAfter: string[];
}

interface RemovalSummary {
  totalPages: number;
  successful: number;
  failed: number;
  results: LabelRemovalResult[];
  timestamp: string;
}

async function removeFolderLabels() {
  try {
    console.log('🗑️ 「フォルダ」ラベルの削除を開始します...');
    
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const username = process.env.CONFLUENCE_USER_EMAIL;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;

    if (!baseUrl || !username || !apiToken) {
      throw new Error('Confluence APIの設定が不完全です。環境変数を確認してください。');
    }

    console.log(`📡 API URL: ${baseUrl}`);
    console.log(`👤 ユーザー: ${username}`);

    // 最新のfolder-pages-no-diamond-*.jsonファイルを検索
    const currentDir = process.cwd();
    const files = fs.readdirSync(currentDir);
    const noDiamondFiles = files
      .filter(file => file.startsWith('folder-pages-no-diamond-') && file.endsWith('.json'))
      .sort()
      .reverse();

    if (noDiamondFiles.length === 0) {
      throw new Error('folder-pages-no-diamond-*.jsonファイルが見つかりません。先にfilter-no-diamond-pages.tsを実行してください。');
    }

    const latestFile = noDiamondFiles[0];
    console.log(`📁 読み込みファイル: ${latestFile}`);

    // JSONファイルを読み込み
    const filePath = path.join(currentDir, latestFile);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data: FolderPagesResult = JSON.parse(fileContent);

    console.log(`📊 対象ページ数: ${data.totalPages}件`);

    if (data.totalPages === 0) {
      console.log('⚠️ 削除対象のページがありません。');
      return;
    }

    // 確認メッセージ
    console.log('\n⚠️ 注意: 以下のページから「フォルダ」ラベルを削除します:');
    data.pages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.title} (ID: ${page.id})`);
    });

    console.log(`\n🗑️ ${data.totalPages}件のページから「フォルダ」ラベルを削除します...`);

    const results: LabelRemovalResult[] = [];
    let successful = 0;
    let failed = 0;

    // 各ページのラベルを削除
    for (let i = 0; i < data.pages.length; i++) {
      const page = data.pages[i];
      console.log(`\n[${i + 1}/${data.totalPages}] 処理中: ${page.title}`);
      
      try {
        // 現在のラベルを取得
        const labelsResponse = await axios.get(
          `${baseUrl}/wiki/rest/api/content/${page.id}/label`,
          {
            auth: { username, password: apiToken },
            timeout: 10000
          }
        );

        const currentLabels = labelsResponse.data.results?.map((label: any) => label.name) || [];
        console.log(`   現在のラベル: [${currentLabels.join(', ')}]`);

        // 「フォルダ」ラベルが存在するかチェック
        if (!currentLabels.includes('フォルダ')) {
          console.log('   ⏭️ 「フォルダ」ラベルが見つかりません。スキップします。');
          results.push({
            pageId: page.id,
            title: page.title,
            success: true,
            labelsBefore: currentLabels,
            labelsAfter: currentLabels
          });
          successful++;
          continue;
        }

        // 「フォルダ」ラベルを削除
        console.log('   🗑️ 「フォルダ」ラベルを削除中...');
        
        // ラベル名を直接指定して削除
        await axios.delete(
          `${baseUrl}/wiki/rest/api/content/${page.id}/label/フォルダ`,
          {
            auth: { username, password: apiToken },
            timeout: 10000,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
        );

        // 削除後のラベルを取得
        const updatedLabelsResponse = await axios.get(
          `${baseUrl}/wiki/rest/api/content/${page.id}/label`,
          {
            auth: { username, password: apiToken },
            timeout: 10000
          }
        );

        const updatedLabels = updatedLabelsResponse.data.results?.map((label: any) => label.name) || [];
        console.log(`   ✅ 削除完了。更新後のラベル: [${updatedLabels.join(', ')}]`);

        results.push({
          pageId: page.id,
          title: page.title,
          success: true,
          labelsBefore: currentLabels,
          labelsAfter: updatedLabels
        });

        successful++;

      } catch (error: any) {
        console.error(`   ❌ エラー: ${error.message}`);
        
        results.push({
          pageId: page.id,
          title: page.title,
          success: false,
          error: error.message,
          labelsBefore: [],
          labelsAfter: []
        });

        failed++;
      }

      // APIレート制限を避けるため少し待機
      if (i < data.pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 結果を保存
    const summary: RemovalSummary = {
      totalPages: data.totalPages,
      successful,
      failed,
      results,
      timestamp: new Date().toISOString()
    };

    const filename = `folder-label-removal-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(filename, JSON.stringify(summary, null, 2));

    // 結果を表示
    console.log('\n📊 削除結果サマリー:');
    console.log('=' * 60);
    console.log(`総ページ数: ${summary.totalPages}件`);
    console.log(`成功: ${summary.successful}件`);
    console.log(`失敗: ${summary.failed}件`);
    console.log(`成功率: ${((summary.successful / summary.totalPages) * 100).toFixed(1)}%`);

    if (summary.failed > 0) {
      console.log('\n❌ 失敗したページ:');
      summary.results
        .filter(result => !result.success)
        .forEach(result => {
          console.log(`   - ${result.title} (ID: ${result.pageId}): ${result.error}`);
        });
    }

    console.log(`\n💾 詳細結果を保存しました: ${filename}`);

    return summary;

  } catch (error: any) {
    console.error('❌ エラーが発生しました:');
    console.error(error.message);
    throw error;
  }
}

// メイン実行
async function main() {
  try {
    const result = await removeFolderLabels();
    if (result) {
      console.log(`\n✅ 完了: ${result.successful}/${result.totalPages}件のページから「フォルダ」ラベルを削除しました`);
    }
  } catch (error) {
    console.error('❌ スクリプト実行に失敗しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain()を呼び出し
if (require.main === module) {
  main();
}

export { removeFolderLabels };
