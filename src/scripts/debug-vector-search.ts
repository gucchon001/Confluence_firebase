/**
 * ベクトル検索のデバッグスクリプト
 */
import 'dotenv/config';
import { getEmbeddings } from '../lib/embeddings';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function debugVectorSearch() {
  const query = '教室管理の仕様は';
  console.log(`=== ベクトル検索デバッグ: "${query}" ===`);
  
  try {
    // 埋め込みベクトルを生成
    const vector = await getEmbeddings(query);
    console.log(`埋め込みベクトル生成完了 (${vector.length} 次元)`);
    
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    // ベクトル検索を実行（より多くの結果を取得）
    console.log('\n=== ベクトル検索結果（上位20件）===');
    const vectorResults = await tbl.search(vector).limit(20).toArray();
    
    console.log(`ベクトル検索結果数: ${vectorResults.length}`);
    
    vectorResults.forEach((result, index) => {
      console.log(`\n--- 結果 ${index + 1} ---`);
      console.log(`タイトル: ${result.title}`);
      console.log(`距離: ${result._distance?.toFixed(4) || 'N/A'}`);
      console.log(`教室管理を含む: ${result.title?.includes('教室管理') ? 'YES' : 'NO'}`);
    });
    
    // 教室管理を含む結果をフィルタ
    const classroomResults = vectorResults.filter(r => 
      r.title?.includes('教室管理')
    );
    
    console.log(`\n教室管理を含むベクトル検索結果数: ${classroomResults.length}`);
    
    if (classroomResults.length > 0) {
      console.log('\n教室管理を含むベクトル検索結果:');
      classroomResults.forEach((result, index) => {
        console.log(`\n--- 結果 ${index + 1} ---`);
        console.log(`タイトル: ${result.title}`);
        console.log(`距離: ${result._distance?.toFixed(4) || 'N/A'}`);
      });
    } else {
      console.log('\n教室管理を含むベクトル検索結果が見つかりませんでした。');
    }
    
    // 特定のページを直接検索してベクトル距離を計算
    console.log('\n=== 特定ページのベクトル距離計算 ===');
    const specificTitles = [
      '511_【FIX】教室管理-求人一覧閲覧機能',
      '512_【FIX】教室管理-求人情報新規登録機能'
    ];
    
    for (const title of specificTitles) {
      console.log(`\n--- "${title}" の検索 ---`);
      const pages = await tbl.query()
        .where(`title = '${title.replace(/'/g, "''")}'`)
        .limit(1)
        .toArray();
      
      if (pages.length > 0) {
        const page = pages[0];
        console.log(`ページが見つかりました: ${page.title}`);
        console.log(`ページの埋め込みベクトル次元: ${page.vector?.length || 'N/A'}`);
        
        // 手動でベクトル距離を計算（もしベクトルが存在する場合）
        if (page.vector && Array.isArray(page.vector)) {
          // コサイン類似度を計算
          const dotProduct = vector.reduce((sum, val, i) => sum + val * page.vector[i], 0);
          const magnitude1 = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
          const magnitude2 = Math.sqrt(page.vector.reduce((sum, val) => sum + val * val, 0));
          const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);
          const distance = 1 - cosineSimilarity;
          
          console.log(`計算された距離: ${distance.toFixed(4)}`);
          console.log(`コサイン類似度: ${cosineSimilarity.toFixed(4)}`);
        } else {
          console.log('ページにベクトルが存在しません');
        }
      } else {
        console.log('ページが見つかりませんでした');
      }
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

debugVectorSearch().catch(console.error);
