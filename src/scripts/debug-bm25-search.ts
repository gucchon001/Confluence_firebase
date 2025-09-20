/**
 * BM25検索のデバッグスクリプト
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function debugBM25Search() {
  try {
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    const keywords = ['教室', 'room reservation', 'room booking'];
    console.log(`=== BM25検索デバッグ: ${keywords.join(', ')} ===`);
    
    // 各キーワードで検索
    const allRows = new Map<string, any>();
    
    for (const keyword of keywords) {
      console.log(`\n--- キーワード: "${keyword}" の検索 ---`);
      const esc = keyword.replace(/'/g, "''");
      const rows = await tbl.query().where(`title LIKE '%${esc}%'`).limit(20).toArray();
      
      console.log(`検索結果数: ${rows.length}`);
      
      for (const row of rows) {
        const key = row.id;
        if (!allRows.has(key)) {
          allRows.set(key, row);
        }
        console.log(`  - ${row.title}`);
      }
    }
    
    const rows = Array.from(allRows.values());
    console.log(`\n=== 統合結果 ===`);
    console.log(`総ページ数: ${rows.length}`);
    
    // 教室管理を含むページをフィルタ
    const classroomPages = rows.filter(r => 
      r.title?.includes('教室管理')
    );
    
    console.log(`\n教室管理を含むページ数: ${classroomPages.length}`);
    classroomPages.forEach((page, index) => {
      console.log(`\n--- ページ ${index + 1} ---`);
      console.log(`タイトル: ${page.title}`);
      console.log(`スペース: ${page.space_key}`);
      console.log(`URL: ${page.url}`);
    });
    
    // BM25スコアを計算
    console.log(`\n=== BM25スコア計算 ===`);
    const totalDocs = 100000;
    const k1 = 1.2;
    const b = 0.75;
    const avgdl = 12;
    
    const keywordScores = new Map<string, number>();
    for (const keyword of keywords) {
      const esc = keyword.replace(/'/g, "''");
      const matchingRows = rows.filter(r => String(r.title || '').includes(esc));
      const df = Math.max(1, matchingRows.length);
      const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
      keywordScores.set(keyword, idf);
      console.log(`キーワード "${keyword}": df=${df}, idf=${idf.toFixed(4)}`);
    }
    
    const bm25Results = rows.map((r: any) => {
      const title = String(r.title || '');
      const dl = Math.max(1, Array.from(title).length / 2);
      let totalScore = 0;
      
      for (const keyword of keywords) {
        const tf = (title.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (tf > 0) {
          const idf = keywordScores.get(keyword) || 1;
          const score = idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgdl))));
          totalScore += score;
        }
      }
      
      return { ...r, _bm25Score: totalScore };
    });
    
    // スコア順でソート
    bm25Results.sort((a, b) => b._bm25Score - a._bm25Score);
    
    console.log(`\n=== BM25スコア順（上位10件）===`);
    bm25Results.slice(0, 10).forEach((result, index) => {
      console.log(`\n--- 結果 ${index + 1} ---`);
      console.log(`タイトル: ${result.title}`);
      console.log(`BM25スコア: ${result._bm25Score.toFixed(4)}`);
      console.log(`教室管理を含む: ${result.title?.includes('教室管理') ? 'YES' : 'NO'}`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

debugBM25Search().catch(console.error);
