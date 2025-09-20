/**
 * 512ページのベクトル距離をデバッグするスクリプト
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

async function debug512Page() {
  try {
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    console.log('=== 512ページのデバッグ ===');
    
    // 512ページを検索
    const pages = await tbl.query()
      .where(`title LIKE '%512_【FIX】教室管理-求人情報新規登録機能%'`)
      .toArray();
    
    console.log(`512ページの件数: ${pages.length}`);
    
    if (pages.length > 0) {
      const page = pages[0];
      console.log(`\n--- ページ情報 ---`);
      console.log(`ID: ${page.id}`);
      console.log(`タイトル: ${page.title}`);
      console.log(`ページID: ${page.pageId}`);
      console.log(`ベクトル: ${page.vector ? 'あり' : 'なし'}`);
      console.log(`ベクトル次元数: ${page.vector ? page.vector.length : 0}`);
      
      // クエリのベクトルを生成
      const query = "教室管理の仕様は";
      const queryVector = await getEmbeddings(query);
      console.log(`\nクエリベクトル次元数: ${queryVector.length}`);
      
      // ベクトル距離を計算
      if (page.vector) {
        console.log(`\n--- ベクトル形式確認 ---`);
        console.log(`ベクトルの型: ${typeof page.vector}`);
        console.log(`ベクトルが配列か: ${Array.isArray(page.vector)}`);
        console.log(`ベクトルの長さ: ${page.vector.length}`);
        console.log(`ベクトルの最初の5要素: ${JSON.stringify(page.vector.slice(0, 5))}`);
        
        // ベクトルを配列に変換
        let pageVector: number[];
        if (Array.isArray(page.vector)) {
          pageVector = page.vector;
        } else if (page.vector && typeof page.vector === 'object' && 'data' in page.vector) {
          // Float32ArrayやTypedArrayの場合
          pageVector = Array.from(page.vector as any);
        } else {
          console.log('ベクトルの形式が不明です');
          return;
        }
        
        const distance = calculateCosineDistance(queryVector, pageVector);
        console.log(`\n--- ベクトル距離計算 ---`);
        console.log(`クエリ: "${query}"`);
        console.log(`ページ: "${page.title}"`);
        console.log(`コサイン距離: ${distance.toFixed(6)}`);
        console.log(`類似度: ${((1 - distance) * 100).toFixed(2)}%`);
        
        // ベクトルの詳細分析
        console.log(`\n--- ベクトル詳細分析 ---`);
        console.log(`クエリベクトル統計:`);
        console.log(`  平均値: ${(queryVector.reduce((a, b) => a + b, 0) / queryVector.length).toFixed(6)}`);
        console.log(`  最大値: ${Math.max(...queryVector).toFixed(6)}`);
        console.log(`  最小値: ${Math.min(...queryVector).toFixed(6)}`);
        console.log(`  標準偏差: ${calculateStandardDeviation(queryVector).toFixed(6)}`);
        
        console.log(`\nページベクトル統計:`);
        console.log(`  平均値: ${(pageVector.reduce((a, b) => a + b, 0) / pageVector.length).toFixed(6)}`);
        console.log(`  最大値: ${Math.max(...pageVector).toFixed(6)}`);
        console.log(`  最小値: ${Math.min(...pageVector).toFixed(6)}`);
        console.log(`  標準偏差: ${calculateStandardDeviation(pageVector).toFixed(6)}`);
        
        // ベクトルの相関を分析
        const correlation = calculateCorrelation(queryVector, pageVector);
        console.log(`\nベクトル相関: ${correlation.toFixed(6)}`);
        
        // コンテンツの分析
        console.log(`\n--- コンテンツ分析 ---`);
        console.log(`コンテンツ長: ${page.content ? page.content.length : 0} 文字`);
        if (page.content) {
          const contentSnippet = page.content.substring(0, 200);
          console.log(`コンテンツ先頭: ${contentSnippet}...`);
          
          // キーワードの出現頻度
          const keywords = ['教室管理', '求人', '新規登録', '機能', '仕様'];
          console.log(`\nキーワード出現頻度:`);
          keywords.forEach(keyword => {
            const count = (page.content.match(new RegExp(keyword, 'g')) || []).length;
            console.log(`  ${keyword}: ${count}回`);
          });
        }
      } else {
        console.log('ベクトルが存在しません');
      }
    } else {
      console.log('512ページが見つかりませんでした');
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

function calculateCosineDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('ベクトルの次元が一致しません');
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);
  
  if (norm1 === 0 || norm2 === 0) {
    return 1; // ベクトルがゼロベクトルの場合
  }
  
  return 1 - (dotProduct / (norm1 * norm2));
}

function calculateStandardDeviation(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateCorrelation(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('ベクトルの次元が一致しません');
  }
  
  const n = vec1.length;
  const mean1 = vec1.reduce((a, b) => a + b, 0) / n;
  const mean2 = vec2.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;
  
  for (let i = 0; i < n; i++) {
    const diff1 = vec1[i] - mean1;
    const diff2 = vec2[i] - mean2;
    numerator += diff1 * diff2;
    sumSq1 += diff1 * diff1;
    sumSq2 += diff2 * diff2;
  }
  
  const denominator = Math.sqrt(sumSq1 * sumSq2);
  return denominator === 0 ? 0 : numerator / denominator;
}

debug512Page().catch(console.error);
