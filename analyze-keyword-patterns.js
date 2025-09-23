const fs = require('fs');

// Confluenceデータを読み込み
const dataPath = 'data/confluence-extraction-large/confluence-data.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('=== キーワードパターン詳細分析 ===');

// 1. 機能名パターンの分析
console.log('\n=== 機能名パターン分析 ===');
const functionPatterns = {
  '管理': [],
  '機能': [],
  '閲覧': [],
  '登録': [],
  '編集': [],
  '削除': [],
  '一覧': [],
  '詳細': [],
  '設定': [],
  '確認': []
};

data.pages.forEach(page => {
  const title = page.title;
  Object.keys(functionPatterns).forEach(pattern => {
    if (title.includes(pattern)) {
      functionPatterns[pattern].push({
        title: title,
        parentTitle: page.parentTitle,
        labels: page.labels
      });
    }
  });
});

Object.keys(functionPatterns).forEach(pattern => {
  console.log(`\n--- "${pattern}"を含むページ (${functionPatterns[pattern].length}件) ---`);
  functionPatterns[pattern].slice(0, 10).forEach(page => {
    console.log(`- ${page.title}`);
    if (page.parentTitle) console.log(`  親: ${page.parentTitle}`);
    if (page.labels.length > 0) console.log(`  ラベル: ${page.labels.join(', ')}`);
  });
});

// 2. ドメイン名の特定
console.log('\n=== ドメイン名特定 ===');
const domainNames = new Set();

// 管理機能のドメイン名を抽出
functionPatterns['管理'].forEach(page => {
  const title = page.title;
  // 【FIX】や数字を除去してドメイン名を抽出
  const cleanTitle = title
    .replace(/【.*?】/g, '')
    .replace(/[0-9_\-\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // 「管理」で終わるものをドメイン名として抽出
  if (cleanTitle.endsWith('管理')) {
    domainNames.add(cleanTitle);
  }
});

console.log('ドメイン名候補:');
Array.from(domainNames).forEach(domain => {
  console.log(`- ${domain}`);
});

// 3. 階層構造からドメイン名を抽出
console.log('\n=== 階層構造からドメイン名抽出 ===');
const parentDomains = new Set();

data.pages.forEach(page => {
  if (page.parentTitle && page.parentTitle.includes('■')) {
    // ■で始まる親ページをドメイン名として抽出
    const domain = page.parentTitle.replace(/■/, '').trim();
    if (domain.length > 0) {
      parentDomains.add(domain);
    }
  }
});

console.log('階層構造から抽出されたドメイン名:');
Array.from(parentDomains).forEach(domain => {
  console.log(`- ${domain}`);
});

// 4. 実際のキーワード抽出パターンの分析
console.log('\n=== キーワード抽出パターン分析 ===');

// 教室管理関連のページを詳細分析
const classroomPages = data.pages.filter(page => 
  page.title.includes('教室') || 
  page.parentTitle?.includes('教室') ||
  page.labels.some(label => label.includes('教室'))
);

console.log(`教室関連ページ: ${classroomPages.length}件`);
classroomPages.forEach(page => {
  console.log(`- ${page.title}`);
  console.log(`  親: ${page.parentTitle || 'なし'}`);
  console.log(`  ラベル: ${page.labels.join(', ') || 'なし'}`);
  if (page.content) {
    // 内容からキーワードを抽出
    const content = page.content.substring(0, 500);
    const keywords = content.match(/[^\s、。！？\n\r]+/g) || [];
    const uniqueKeywords = [...new Set(keywords)].slice(0, 20);
    console.log(`  キーワード例: ${uniqueKeywords.join(', ')}`);
  }
  console.log('');
});

// 5. ラベルパターンの分析
console.log('\n=== ラベルパターン分析 ===');
const allLabels = {};
data.pages.forEach(page => {
  page.labels.forEach(label => {
    allLabels[label] = (allLabels[label] || 0) + 1;
  });
});

const sortedLabels = Object.entries(allLabels)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30);

console.log('ラベル（頻度順）:');
sortedLabels.forEach(([label, count]) => {
  console.log(`${label}: ${count}回`);
});

// 6. ページタイトルの構造分析
console.log('\n=== ページタイトル構造分析 ===');
const titleStructures = {
  '【FIX】': 0,
  '【作成中】': 0,
  '■': 0,
  '数字_': 0,
  'その他': 0
};

data.pages.forEach(page => {
  const title = page.title;
  if (title.startsWith('【FIX】')) {
    titleStructures['【FIX】']++;
  } else if (title.startsWith('【作成中】')) {
    titleStructures['【作成中】']++;
  } else if (title.startsWith('■')) {
    titleStructures['■']++;
  } else if (/^\d+_/.test(title)) {
    titleStructures['数字_']++;
  } else {
    titleStructures['その他']++;
  }
});

console.log('タイトル構造:');
Object.entries(titleStructures).forEach(([structure, count]) => {
  console.log(`${structure}: ${count}件`);
});
