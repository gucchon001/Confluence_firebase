/**
 * 046_会員退会機能のチャンク内に期待コンテンツがあるか確認
 */

import 'dotenv/config';
import { optimizedLanceDBClient } from '@/lib/optimized-lancedb-client';

async function main() {
  console.log('\n🔍 046_会員退会機能のコンテンツ詳細分析\n');
  
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
      
      if (row.title && row.title.includes('046_【FIX】会員退会機能')) {
        chunks.push(row);
      }
    }
    
    if (chunks.length === 0) {
      console.log('❌ 046ページが見つかりませんでした\n');
      return;
    }
    
    console.log(`📊 046_【FIX】会員退会機能\n`);
    console.log(`チャンク数: ${chunks.length}個\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 期待コンテンツのキーワード
    const targetKeywords = [
      '退会後',
      '退会時に登録されていたメールアドレス',
      '新たに会員登録',
      '新アカウント',
      '同じメールアドレス',
      '再登録'
    ];
    
    console.log('🎯 期待コンテンツの検索\n');
    console.log('探しているフレーズ:');
    console.log('「退会後、退会時に登録されていたメールアドレスを用いて');
    console.log(' 新たに会員登録を行うことが可能で、新アカウントとして登録される」\n');
    
    let foundInChunk = -1;
    let foundContent = '';
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      console.log(`\nチャンク${i + 1}/${chunks.length}:`);
      console.log(`  ID: ${chunk.id}`);
      console.log(`  長さ: ${chunk.content?.length || 0}文字`);
      
      // 各キーワードを含むかチェック
      const foundKeywords = targetKeywords.filter(kw => 
        chunk.content && chunk.content.includes(kw)
      );
      
      if (foundKeywords.length > 0) {
        console.log(`  🔑 含まれるキーワード: ${foundKeywords.join(', ')}`);
      }
      
      // 「退会後」かつ「新アカウント」または「新たに会員登録」を含む場合
      if (chunk.content && 
          chunk.content.includes('退会後') && 
          (chunk.content.includes('新アカウント') || chunk.content.includes('新たに会員登録'))) {
        console.log(`  ✅ 期待コンテンツを含む可能性が高い！`);
        foundInChunk = i;
        
        // 該当箇所を抽出
        const match = chunk.content.match(/.{0,50}退会後.{0,200}/);
        if (match) {
          foundContent = match[0];
          console.log(`\n  📝 該当箇所:`);
          console.log(`  「${foundContent.replace(/\n/g, ' ')}」`);
        }
      }
      
      // チャンクの全文を表示（短い場合のみ）
      if (chunk.content && chunk.content.length < 500) {
        console.log(`\n  📄 全文:`);
        console.log(`  ${chunk.content.replace(/\n/g, ' ')}`);
      } else if (chunk.content) {
        // 長い場合は最初と最後を表示
        const start = chunk.content.substring(0, 200).replace(/\n/g, ' ');
        const end = chunk.content.substring(chunk.content.length - 100).replace(/\n/g, ' ');
        console.log(`\n  📄 内容（抜粋）:`);
        console.log(`  開始: ${start}...`);
        console.log(`  終了: ...${end}`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 結論
    console.log('🎯 分析結果\n');
    
    if (foundInChunk >= 0) {
      console.log(`✅ 期待コンテンツが見つかりました！`);
      console.log(`   場所: チャンク${foundInChunk + 1}/${chunks.length}`);
      console.log(`   内容: 「${foundContent.substring(0, 100).replace(/\n/g, ' ')}...」\n`);
    } else {
      console.log(`❌ 期待コンテンツが見つかりませんでした`);
      console.log(`   → ページに記載がないか、キーワードが異なる可能性があります\n`);
    }
    
    // チャンク化の適切性
    const totalLength = chunks.reduce((sum, c) => sum + (c.content?.length || 0), 0);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 チャンク戦略の評価\n');
    
    if (totalLength < 3000) {
      console.log(`❌ チャンク化不要: ${totalLength}文字 → 1チャンクで十分`);
      console.log(`\n【現状の問題】:`);
      console.log(`  - ${chunks.length}チャンクに分割されている`);
      console.log(`  - 検索時に${chunks.length}個の結果として扱われる`);
      console.log(`  - RRF融合でスコアが分散`);
      console.log(`  - 重複表示の可能性\n`);
      
      console.log(`【改善後（重複排除）】:`);
      console.log(`  - ${chunks.length}チャンク → ベスト1チャンクのみ表示`);
      console.log(`  - ページ単位で1エントリ ✅`);
      console.log(`  - スコア競合が公平に ✅\n`);
      
      console.log(`【改善後（チャンキング見直し）】:`);
      console.log(`  - チャンク数: ${chunks.length} → 1個`);
      console.log(`  - 全文コンテキスト保持 ✅`);
      console.log(`  - データ削減: ${chunks.length - 1}チャンク削減 ✅\n`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }
}

main();

