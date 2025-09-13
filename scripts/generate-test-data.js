/**
 * テストデータを生成するスクリプト
 */
const fs = require('fs');
const path = require('path');

// 768次元のテストベクトルを作成する関数
function createTestVector(position) {
  // 768次元のゼロベクトルを作成
  const vector = Array(768).fill(0);
  // 指定された位置に値を設定
  if (Array.isArray(position)) {
    // 複数の位置に値を設定する場合
    position.forEach((pos, index) => {
      vector[pos] = 1 / Math.sqrt(position.length); // 正規化された値を設定
    });
  } else {
    // 単一の位置に値を設定する場合
    vector[position] = 1;
  }
  return vector;
}

// テストデータの作成
const testData = [
  {
    id: 'test-1',
    pageId: 'test-page-1',
    title: 'テストページ1',
    spaceKey: 'TEST',
    spaceName: 'テストスペース',
    url: 'https://example.com/wiki/spaces/TEST/pages/test-page-1',
    lastUpdated: new Date().toISOString(),
    chunkIndex: 0,
    content: 'これはテストページ1のコンテンツです。Vector Searchのテストに使用します。',
    labels: ['test', 'vector-search'],
    embedding: createTestVector(0) // 最初の次元が1、他は0
  },
  {
    id: 'test-2',
    pageId: 'test-page-2',
    title: 'テストページ2',
    spaceKey: 'TEST',
    spaceName: 'テストスペース',
    url: 'https://example.com/wiki/spaces/TEST/pages/test-page-2',
    lastUpdated: new Date().toISOString(),
    chunkIndex: 0,
    content: 'これはテストページ2のコンテンツです。ベクトル検索のテストに使用します。',
    labels: ['test', 'vector-search'],
    embedding: createTestVector(1) // 2番目の次元が1、他は0
  },
  {
    id: 'test-3',
    pageId: 'test-page-3',
    title: 'テストページ3',
    spaceKey: 'TEST',
    spaceName: 'テストスペース',
    url: 'https://example.com/wiki/spaces/TEST/pages/test-page-3',
    lastUpdated: new Date().toISOString(),
    chunkIndex: 0,
    content: 'これはテストページ3のコンテンツです。埋め込みベクトルのテストに使用します。',
    labels: ['test', 'embedding'],
    embedding: createTestVector(2) // 3番目の次元が1、他は0
  },
  {
    id: 'test-4',
    pageId: 'test-page-4',
    title: 'テストページ4',
    spaceKey: 'TEST',
    spaceName: 'テストスペース',
    url: 'https://example.com/wiki/spaces/TEST/pages/test-page-4',
    lastUpdated: new Date().toISOString(),
    chunkIndex: 0,
    content: 'これはテストページ4のコンテンツです。複合ベクトルのテストに使用します。',
    labels: ['test', 'complex'],
    embedding: createTestVector([0, 1]) // 1番目と2番目の次元が0.7071、他は0
  }
];

// L2正規化関数
function normalize(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / magnitude);
}

// JSONファイルを作成
const outputPath = path.join(__dirname, '..', 'temp', 'test-data.json');
const jsonContent = testData.map(record => JSON.stringify(record)).join('\n');
fs.writeFileSync(outputPath, jsonContent);

console.log(`テストデータを作成しました: ${outputPath}`);
