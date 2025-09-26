/**
 * 「フォルダ」ラベル付きページから「■」がついていないタイトルのページを抽出
 */

import 'dotenv/config';
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

async function filterNoDiamondPages() {
  try {
    console.log('🔍 「フォルダ」ラベル付きページから「■」がついていないタイトルのページを抽出中...');
    
    // 最新のfolder-pages-*.jsonファイルを検索
    const currentDir = process.cwd();
    const files = fs.readdirSync(currentDir);
    const folderPageFiles = files
      .filter(file => file.startsWith('folder-pages-') && file.endsWith('.json'))
      .sort()
      .reverse(); // 最新のファイルを最初に

    if (folderPageFiles.length === 0) {
      throw new Error('folder-pages-*.jsonファイルが見つかりません。先にget-folder-pages.tsを実行してください。');
    }

    const latestFile = folderPageFiles[0];
    console.log(`📁 読み込みファイル: ${latestFile}`);

    // JSONファイルを読み込み
    const filePath = path.join(currentDir, latestFile);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data: FolderPagesResult = JSON.parse(fileContent);

    console.log(`📊 元データ: ${data.totalPages}件のページ`);

    // 「■」がついていないタイトルのページをフィルタリング
    const filteredPages = data.pages.filter(page => !page.title.includes('■'));

    console.log(`🔍 フィルタリング後: ${filteredPages.length}件のページ`);

    if (filteredPages.length === 0) {
      console.log('⚠️ 「■」がついていないタイトルのページは見つかりませんでした。');
      return;
    }

    console.log('\n📋 「■」がついていないタイトルのページ一覧:');
    console.log('=' * 80);
    
    filteredPages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.title}`);
      console.log(`   ID: ${page.id}`);
      console.log(`   スペース: ${page.spaceName} (${page.spaceKey})`);
      console.log(`   最終更新: ${new Date(page.lastModified).toLocaleString('ja-JP')}`);
      console.log(`   ラベル: ${page.labels.join(', ')}`);
      console.log(`   URL: ${page.url}`);
      console.log('');
    });

    // 結果を新しいJSONファイルに保存
    const filteredResult: FolderPagesResult = {
      totalPages: filteredPages.length,
      pages: filteredPages,
      searchQuery: `${data.searchQuery} (■なしタイトル)`,
      timestamp: new Date().toISOString()
    };

    const filename = `folder-pages-no-diamond-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(filename, JSON.stringify(filteredResult, null, 2));
    console.log(`💾 フィルタリング結果を保存しました: ${filename}`);

    // 統計情報を表示
    console.log('\n📊 統計情報:');
    console.log('=' * 50);
    console.log(`元のページ数: ${data.totalPages}件`);
    console.log(`「■」なしページ数: ${filteredPages.length}件`);
    console.log(`「■」ありページ数: ${data.totalPages - filteredPages.length}件`);
    console.log(`「■」なしページの割合: ${((filteredPages.length / data.totalPages) * 100).toFixed(1)}%`);

    // ラベル別統計
    const labelCounts: { [key: string]: number } = {};
    filteredPages.forEach(page => {
      page.labels.forEach(label => {
        if (label !== 'フォルダ') { // 「フォルダ」ラベルは除外
          labelCounts[label] = (labelCounts[label] || 0) + 1;
        }
      });
    });

    console.log('\n🏷️ ラベル別統計（「フォルダ」以外）:');
    const sortedLabels = Object.entries(labelCounts)
      .sort(([,a], [,b]) => b - a);
    
    sortedLabels.forEach(([label, count]) => {
      console.log(`   ${label}: ${count}件`);
    });

    return filteredResult;

  } catch (error: any) {
    console.error('❌ エラーが発生しました:');
    console.error(error.message);
    throw error;
  }
}

// メイン実行
async function main() {
  try {
    const result = await filterNoDiamondPages();
    if (result) {
      console.log(`\n✅ 完了: ${result.totalPages}件の「■」なしページを抽出しました`);
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

export { filterNoDiamondPages };
