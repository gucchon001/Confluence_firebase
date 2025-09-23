const fs = require('fs');
const path = require('path');

// Confluenceデータを読み込み
const dataPath = 'data/confluence-extraction-large/confluence-data.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('=== Confluenceページ分析 ===');
console.log(`総ページ数: ${data.pages.length}`);

// 1. ページタイトルのパターン分析
console.log('\n=== ページタイトルパターン分析 ===');
const titles = data.pages.map(p => p.title);

// タイトルに含まれるキーワードの頻度分析
const titleKeywords = {};
titles.forEach(title => {
  // 数字、記号、括弧を除去してキーワードを抽出
  const cleanTitle = title
    .replace(/【.*?】/g, '') // 【FIX】などの記号を除去
    .replace(/[0-9_\-\(\)]/g, ' ') // 数字、アンダースコア、ハイフン、括弧を除去
    .replace(/\s+/g, ' ') // 複数スペースを単一スペースに
    .trim();
  
  const words = cleanTitle.split(' ').filter(w => w.length > 0);
  words.forEach(word => {
    if (word.length >= 2) { // 2文字以上の単語のみ
      titleKeywords[word] = (titleKeywords[word] || 0) + 1;
    }
  });
});

// 頻度順でソート
const sortedKeywords = Object.entries(titleKeywords)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 50);

console.log('タイトルに含まれるキーワード（頻度順）:');
sortedKeywords.forEach(([word, count]) => {
  console.log(`${word}: ${count}回`);
});

// 2. ラベル分析
console.log('\n=== ラベル分析 ===');
const allLabels = {};
data.pages.forEach(page => {
  if (page.labels && page.labels.length > 0) {
    page.labels.forEach(label => {
      allLabels[label] = (allLabels[label] || 0) + 1;
    });
  }
});

const sortedLabels = Object.entries(allLabels)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);

console.log('ラベル（頻度順）:');
sortedLabels.forEach(([label, count]) => {
  console.log(`${label}: ${count}回`);
});

// 3. 階層構造分析
console.log('\n=== 階層構造分析 ===');
const parentTitles = {};
data.pages.forEach(page => {
  if (page.parentTitle) {
    parentTitles[page.parentTitle] = (parentTitles[page.parentTitle] || 0) + 1;
  }
});

const sortedParents = Object.entries(parentTitles)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);

console.log('親ページ（頻度順）:');
sortedParents.forEach(([parent, count]) => {
  console.log(`${parent}: ${count}回`);
});

// 4. ドメイン名候補の抽出
console.log('\n=== ドメイン名候補 ===');
const domainCandidates = new Set();

// タイトルから「管理」「機能」「システム」などの語を含むものを抽出
titles.forEach(title => {
  if (title.includes('管理') || title.includes('機能') || title.includes('システム')) {
    // 括弧内の数字や記号を除去
    const cleanTitle = title
      .replace(/【.*?】/g, '')
      .replace(/[0-9_\-\(\)]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleanTitle.length > 0) {
      domainCandidates.add(cleanTitle);
    }
  }
});

console.log('ドメイン名候補:');
Array.from(domainCandidates).slice(0, 30).forEach(domain => {
  console.log(`- ${domain}`);
});

// 5. サンプルページの内容分析
console.log('\n=== サンプルページ内容分析 ===');
const samplePages = data.pages
  .filter(p => p.content && p.content.length > 100)
  .slice(0, 5);

samplePages.forEach((page, index) => {
  console.log(`\n--- サンプル${index + 1}: ${page.title} ---`);
  console.log(`ラベル: ${page.labels.join(', ')}`);
  console.log(`親ページ: ${page.parentTitle || 'なし'}`);
  console.log(`内容の最初の200文字: ${page.content.substring(0, 200)}...`);
});
