/**
 * 164ページのどのチャンクが検索されているか確認
 */

import 'dotenv/config';
import { optimizedLanceDBClient } from '@/lib/optimized-lancedb-client';

async function main() {
  console.log('\n🔍 164_【FIX】教室削除機能のチャンク内容確認\n');
  
  try {
    const connection = await optimizedLanceDBClient.getConnection();
    const table = connection.table;
    
    const arrow = await table.query().limit(2000).toArrow();
    
    const chunks: any[] = [];
    
    for (let i = 0; i < arrow.numRows; i++) {
      const row: any = {};
      for (let j = 0; j < arrow.schema.fields.length; j++) {
        const field = arrow.schema.fields[j];
        const column = arrow.getChildAt(j);
        row[field.name] = column?.get(i);
      }
      
      if (row.pageId === 718373062 || (row.title && row.title.includes('164_【FIX】教室削除機能'))) {
        chunks.push(row);
      }
    }
    
    console.log(`📊 164ページのチャンク数: ${chunks.length}個\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      console.log(`チャンク${i + 1}/${chunks.length}:\n`);
      console.log(`ID: ${chunk.id}`);
      console.log(`長さ: ${chunk.content?.length || 0}文字\n`);
      
      // 重要キーワードの確認
      const criticalKeywords = [
        '削除ができない',
        '条件を満たす',
        '非掲載',
        '応募情報',
        '採用ステータス',
        '177_【FIX】求人削除機能'
      ];
      
      const foundKeywords = criticalKeywords.filter(kw => 
        chunk.content && chunk.content.includes(kw)
      );
      
      console.log(`🔑 重要キーワード:`);
      if (foundKeywords.length > 0) {
        foundKeywords.forEach(kw => {
          console.log(`  ✅ ${kw}`);
          
          // 該当箇所を抽出
          if (chunk.content) {
            const regex = new RegExp(`.{0,80}${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.{0,150}`, 'g');
            const matches = chunk.content.match(regex);
            if (matches && matches.length > 0) {
              console.log(`     📝 「${matches[0].substring(0, 200).replace(/\n/g, ' ')}...」`);
            }
          }
        });
      } else {
        console.log(`  ❌ 重要キーワードなし`);
      }
      
      console.log('');
      
      // このチャンクに「削除条件」の詳細があるか
      if (chunk.content && chunk.content.includes('以下の条件')) {
        console.log(`📋 削除条件の記載:`);
        
        // 「以下の条件」から200文字抽出
        const conditionMatch = chunk.content.match(/.{0,50}以下の条件.{0,400}/);
        if (conditionMatch) {
          console.log(`${conditionMatch[0].replace(/\n/g, ' ')}\n`);
        }
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
    
    // 結論
    console.log('🎯 分析結果\n');
    
    const hasDetailedConditions = chunks.some(c => 
      c.content && 
      c.content.includes('177') && 
      c.content.includes('採用ステータス') &&
      c.content.includes('非掲載')
    );
    
    if (hasDetailedConditions) {
      console.log('✅ 詳細な削除条件の記載あり');
      console.log('   - 177_【FIX】求人削除機能への言及');
      console.log('   - 非掲載状態の条件');
      console.log('   - 採用ステータスの条件');
      console.log('   - 採用決定日の条件\n');
      
      console.log('⚠️ しかし、AIが詳細回答を返せなかった原因:\n');
      console.log('【可能性1】: チャンク1のみが参照され、チャンク2が欠落');
      console.log('【可能性2】: プロンプトがリストアップを優先し、詳細を省略');
      console.log('【可能性3】: コンテキスト長制限でチャンク2が切り捨て\n');
    } else {
      console.log('❌ 詳細な削除条件の記載が見つかりませんでした\n');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }
}

main();

