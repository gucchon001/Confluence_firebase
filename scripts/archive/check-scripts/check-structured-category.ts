/**
 * LanceDB内のstructured_categoryの分布を確認
 */

import { optimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';

async function main() {
  console.log('🔍 structured_category分布を確認...\n');

  try {
    const connection = await optimizedLanceDBClient.getConnection();
    const data = await connection.table.query().limit(2000).toArrow();

    const catIndex = data.schema.fields.findIndex((f: any) => f.name === 'structured_category');
    const titleIndex = data.schema.fields.findIndex((f: any) => f.name === 'title');
    
    if (catIndex === -1) {
      console.error('❌ structured_categoryフィールドが見つかりません');
      return;
    }

    const catCol = data.getChildAt(catIndex);
    const titleCol = titleIndex >= 0 ? data.getChildAt(titleIndex) : null;

    const categories: Record<string, number> = {};
    const meetingSamples: string[] = [];

    for (let i = 0; i < data.numRows; i++) {
      const cat = catCol?.get(i) || 'null';
      const title = titleCol?.get(i) || 'Unknown';
      
      const catStr = String(cat);
      categories[catStr] = (categories[catStr] || 0) + 1;
      
      // meetingカテゴリのサンプルを収集
      if (catStr === 'meeting' && meetingSamples.length < 10) {
        meetingSamples.push(title);
      }
    }

    console.log('📊 structured_category分布:\n');
    Object.entries(categories)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count}件`);
      });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (meetingSamples.length > 0) {
      console.log(`🏷️ 'meeting'カテゴリのページサンプル（${meetingSamples.length}件）:\n`);
      meetingSamples.forEach((title, idx) => {
        console.log(`${idx + 1}. ${title}`);
      });
    } else {
      console.log('⚠️ meetingカテゴリのページが見つかりませんでした');
    }

    console.log('\n✅ 分析完了');

  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  } finally {
    await optimizedLanceDBClient.resetConnection();
    process.exit(0);
  }
}

main();

