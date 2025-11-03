/**
 * nullカテゴリの中に議事録が含まれているか確認
 */

import { optimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';

async function main() {
  console.log('🔍 nullカテゴリの中の議事録を確認...\n');

  try {
    const connection = await optimizedLanceDBClient.getConnection();
    const data = await connection.table.query().limit(2000).toArrow();

    const catIndex = data.schema.fields.findIndex((f: any) => f.name === 'structured_category');
    const titleIndex = data.schema.fields.findIndex((f: any) => f.name === 'title');
    
    if (catIndex === -1 || titleIndex === -1) {
      console.error('❌ フィールドが見つかりません');
      return;
    }

    const catCol = data.getChildAt(catIndex);
    const titleCol = data.getChildAt(titleIndex);

    // 議事録を示すタイトルパターン
    const meetingPatterns = [
      /ミーティング議事録/i,
      /会議議事録/i,
      /^\d{4}-\d{2}-\d{2}\s+(ミーティング|会議|打ち合わせ)/i,
      /MTG議事録/i,
      /meeting\s*notes?/i,
    ];

    const nullCategoryMeetings: string[] = [];
    let nullCategoryCount = 0;

    for (let i = 0; i < data.numRows; i++) {
      const cat = catCol?.get(i);
      const title = titleCol?.get(i) || 'Unknown';
      
      if (!cat || cat === 'null') {
        nullCategoryCount++;
        
        // 議事録パターンをチェック
        const isMeetingNote = meetingPatterns.some(pattern => pattern.test(title));
        
        if (isMeetingNote) {
          nullCategoryMeetings.push(title);
        }
      }
    }

    console.log(`📊 nullカテゴリの総数: ${nullCategoryCount}件\n`);
    
    console.log(`🏷️ nullカテゴリ内の議事録: ${nullCategoryMeetings.length}件\n`);
    
    if (nullCategoryMeetings.length > 0) {
      console.log('📝 nullカテゴリ内の議事録リスト:\n');
      nullCategoryMeetings.slice(0, 20).forEach((title, idx) => {
        console.log(`${idx + 1}. ${title}`);
      });
      
      if (nullCategoryMeetings.length > 20) {
        console.log(`\n... 他 ${nullCategoryMeetings.length - 20}件`);
      }
    } else {
      console.log('✅ nullカテゴリ内に議事録は見つかりませんでした');
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

