/**
 * 515_【作成中】教室管理-教室コピー機能の内容を調査
 * 
 * 問題: このページが検索結果に含まれるが、中身は「168_【FIX】教室コピー機能を参照」のみ
 */

import 'dotenv/config';
import { optimizedLanceDBClient } from '@/lib/optimized-lancedb-client';

async function main() {
  console.log('\n🔍 515_【作成中】教室管理-教室コピー機能 調査\n');
  
  try {
    const connection = await optimizedLanceDBClient.getConnection();
    const table = connection.table;
    
    // 515を含むページを検索
    const arrow = await table.query().limit(2000).toArrow();
    
    const pages: any[] = [];
    for (let i = 0; i < arrow.numRows; i++) {
      const row: any = {};
      for (let j = 0; j < arrow.schema.fields.length; j++) {
        const field = arrow.schema.fields[j];
        const column = arrow.getChildAt(j);
        row[field.name] = column?.get(i);
      }
      
      if (row.title && (row.title.includes('515') || row.title.includes('168') || row.title.includes('教室コピー'))) {
        pages.push(row);
      }
    }
    
    console.log(`📊 "515" または "168" または "教室コピー" を含むページ: ${pages.length}件\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      console.log(`[${i + 1}] ${page.title}`);
      console.log(`   pageId: ${page.pageId || page.id}`);
      console.log(`   URL: ${page.url || 'N/A'}`);
      console.log(`   コンテンツ長: ${page.content?.length || 0}文字`);
      
      if (page.content) {
        const snippet = page.content.substring(0, 300).replace(/\n/g, ' ');
        console.log(`   内容: ${snippet}...`);
      } else {
        console.log(`   内容: (空)`);
      }
      
      // 「参照」を含むか確認
      if (page.content && page.content.includes('参照')) {
        console.log(`   ⚠️ "参照"を含む → 別ページへのリダイレクトページの可能性`);
        
        // 168への参照を含むか
        if (page.content.includes('168')) {
          console.log(`   🔗 168への参照を含む`);
        }
      }
      
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 168ページの内容を確認
    const page168 = pages.find(p => p.title.includes('168_【FIX】教室コピー機能'));
    
    if (page168) {
      console.log('🎯 168_【FIX】教室コピー機能 の詳細\n');
      console.log(`タイトル: ${page168.title}`);
      console.log(`コンテンツ長: ${page168.content?.length || 0}文字`);
      
      if (page168.content && page168.content.length > 0) {
        // 「コピー可能な項目」を含むか確認
        if (page168.content.includes('コピー可能な項目') || 
            page168.content.includes('コピー可能') ||
            page168.content.includes('コピーする項目')) {
          console.log(`✅ "コピー可能な項目" に関する記載あり`);
          
          // 該当部分を抽出
          const matches = page168.content.match(/.{0,100}コピー可能.{0,200}/g);
          if (matches) {
            console.log('\n📝 該当箇所:\n');
            matches.slice(0, 3).forEach((match, idx) => {
              console.log(`[${idx + 1}] ${match.replace(/\n/g, ' ')}`);
              console.log('');
            });
          }
        } else {
          console.log(`⚠️ "コピー可能な項目" の記載が見つからない`);
        }
      }
    } else {
      console.log('⚠️ 168_【FIX】教室コピー機能 が見つかりませんでした\n');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    console.error(error.stack);
  }
}

main();

