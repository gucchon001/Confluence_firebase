/**
 * 515ページにStructuredLabelを付与してis_validを確認
 */

import 'dotenv/config';
import { optimizedLanceDBClient } from '@/lib/optimized-lancedb-client';
import { autoLabelFlow } from '@/ai/flows/auto-label-flow';
import { saveStructuredLabel } from '@/lib/structured-label-service-admin';

async function main() {
  console.log('\n🏷️ 515ページへのラベル付与テスト\n');
  
  try {
    const connection = await optimizedLanceDBClient.getConnection();
    const table = connection.table;
    
    // 515ページを検索
    const arrow = await table.query().limit(1500).toArrow();
    
    let page515: any = null;
    
    for (let i = 0; i < arrow.numRows; i++) {
      const row: any = {};
      for (let j = 0; j < arrow.schema.fields.length; j++) {
        const field = arrow.schema.fields[j];
        const column = arrow.getChildAt(j);
        row[field.name] = column?.get(i);
      }
      
      if (row.title && row.title.includes('515_【作成中】教室管理-教室コピー機能')) {
        page515 = row;
        break;
      }
    }
    
    if (!page515) {
      console.error('❌ 515ページが見つかりませんでした');
      return;
    }
    
    console.log('📄 515ページ情報:');
    console.log(`   タイトル: ${page515.title}`);
    console.log(`   pageId: ${page515.pageId || page515.id}`);
    console.log(`   コンテンツ長: ${page515.content?.length || 0}文字`);
    console.log(`   内容: "${page515.content || '(空)'}"\n`);
    
    // labelsを配列に正規化
    let labels: string[] = [];
    if (page515.labels) {
      if (Array.isArray(page515.labels)) {
        labels = page515.labels;
      } else if (typeof page515.labels === 'object' && 'length' in page515.labels) {
        const jsonLabels = JSON.parse(JSON.stringify(page515.labels));
        if (Array.isArray(jsonLabels)) {
          labels = jsonLabels;
        }
      }
    }
    
    // StructuredLabel生成
    console.log('🏷️ StructuredLabel生成中...\n');
    
    const structuredLabel = await autoLabelFlow({
      title: page515.title || 'Untitled',
      content: page515.content || '',
      labels
    });
    
    console.log('✅ StructuredLabel生成完了:\n');
    console.log(JSON.stringify(structuredLabel, null, 2));
    console.log('');
    
    // 検証
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔍 検証結果:\n');
    console.log(`content_length: ${structuredLabel.content_length || 0}文字`);
    console.log(`is_valid: ${structuredLabel.is_valid ? '✅ true' : '❌ false'}`);
    
    if (!structuredLabel.is_valid) {
      console.log('\n✅ 空ページとして正しく検出されました！');
      console.log('   → 検索時にこのページを除外できます\n');
    }
    
    // Firestoreに保存
    const pageId = String(page515.pageId || page515.id || 'unknown');
    await saveStructuredLabel(pageId, structuredLabel);
    
    console.log(`📝 Firestoreに保存しました: ${pageId}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    console.error(error.stack);
  }
}

main();

