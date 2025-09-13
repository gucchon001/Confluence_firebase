/**
 * 768次元のテストデータを生成するスクリプト
 */
const fs = require('fs');
const path = require('path');

// 768次元のベクトルを生成する関数
function createVector(index) {
  const vector = Array(768).fill(0);
  vector[index] = 1; // インデックスの位置だけ1、他は0
  return normalize(vector);
}

// L2正規化
function normalize(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / magnitude);
}

// テストデータの作成
const testData = [
  {
    id: 'test-1',
    embedding: createVector(0) // 最初の要素が1、他は0
  },
  {
    id: 'test-2',
    embedding: createVector(1) // 2番目の要素が1、他は0
  },
  {
    id: 'test-3',
    embedding: createVector(2) // 3番目の要素が1、他は0
  },
  {
    id: 'test-4',
    embedding: normalize([0.7, 0.7].concat(Array(766).fill(0))) // 最初の2要素が0.7、他は0
  }
];

// JSONファイルを作成
const outputPath = path.join(__dirname, '..', 'temp', 'test-data-768d.json');
const jsonContent = testData.map(record => JSON.stringify(record)).join('\n');
fs.writeFileSync(outputPath, jsonContent);

console.log(`768次元のテストデータを作成しました: ${outputPath}`);
