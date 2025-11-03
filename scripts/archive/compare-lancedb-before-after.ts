/**
 * LanceDB比較調査: Phase 0A-4完了時 vs 現在
 * 順位劣化の原因を特定
 */

import * as lancedb from '@lancedb/lancedb';
import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { config } from 'dotenv';

config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       LanceDB比較調査: Phase 0A-4 vs 現在                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  try {
    // 現在のLanceDB
    console.log('📊 現在のLanceDB...');
    const dbCurrent = await lancedb.connect('.lancedb');
    const tableCurrent = await dbCurrent.openTable('confluence');
    const recordsCurrent = await tableCurrent.query().toArray();
    
    console.log(`   総レコード数: ${recordsCurrent.length}件`);
    
    const pageIdsCurrent = new Set<string>();
    recordsCurrent.forEach((r: any) => {
      pageIdsCurrent.add(String(r.pageId));
    });
    console.log(`   ユニークページ数: ${pageIdsCurrent.size}ページ\n`);

    // Phase 0A-4時点のLanceDB
    console.log('📊 Phase 0A-4時点のLanceDB（バックアップ）...');
    const dbBefore = await lancedb.connect('.lancedb.backup.label-sync.1760528975460');
    const tableBefore = await dbBefore.openTable('confluence');
    const recordsBefore = await tableBefore.query().toArray();
    
    console.log(`   総レコード数: ${recordsBefore.length}件`);
    
    const pageIdsBefore = new Set<string>();
    recordsBefore.forEach((r: any) => {
      pageIdsBefore.add(String(r.pageId));
    });
    console.log(`   ユニークページ数: ${pageIdsBefore.size}ページ\n`);

    // 差分計算
    console.log('📊 差分分析...\n');
    console.log(`   レコード数差分: ${recordsCurrent.length - recordsBefore.length}件`);
    console.log(`   ページ数差分: ${pageIdsCurrent.size - pageIdsBefore.size}ページ\n`);

    // 削除されたページを特定
    const removedPageIds: string[] = [];
    pageIdsBefore.forEach(pageId => {
      if (!pageIdsCurrent.has(pageId)) {
        removedPageIds.push(pageId);
      }
    });

    console.log(`🗑️  削除されたページ: ${removedPageIds.length}件\n`);
    
    if (removedPageIds.length > 0) {
      // 削除されたページの詳細を取得
      const removedPages = recordsBefore.filter((r: any) => 
        removedPageIds.includes(String(r.pageId))
      );
      
      // ページIDごとにグループ化
      const removedByPageId = new Map<string, any[]>();
      removedPages.forEach((r: any) => {
        const pageId = String(r.pageId);
        if (!removedByPageId.has(pageId)) {
          removedByPageId.set(pageId, []);
        }
        removedByPageId.get(pageId)?.push(r);
      });

      console.log('   削除されたページ一覧（最初の20件）:\n');
      let count = 0;
      for (const [pageId, records] of removedByPageId.entries()) {
        if (count >= 20) break;
        const firstRecord = records[0];
        const labels = Array.isArray(firstRecord.labels) ? firstRecord.labels : [];
        console.log(`   ${count + 1}. ${firstRecord.title}`);
        console.log(`      PageId: ${pageId}`);
        console.log(`      Labels: [${labels.join(', ')}]`);
        console.log(`      Records: ${records.length}件\n`);
        count++;
      }

      // ラベル分析
      console.log('\n📊 削除されたページのラベル分析...\n');
      const labelCounts: { [label: string]: number } = {};
      removedByPageId.forEach((records) => {
        const labels = Array.isArray(records[0].labels) ? records[0].labels : [];
        labels.forEach((label: string) => {
          labelCounts[label] = (labelCounts[label] || 0) + 1;
        });
      });

      const sortedLabels = Object.entries(labelCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 10);

      if (sortedLabels.length > 0) {
        console.log('   Top 10 削除ページのラベル:');
        sortedLabels.forEach(([label, count]) => {
          console.log(`   - ${label}: ${count}ページ`);
        });
      } else {
        console.log('   ラベルなし: すべてのページ');
      }
    }

    // 追加されたページを特定
    const addedPageIds: string[] = [];
    pageIdsCurrent.forEach(pageId => {
      if (!pageIdsBefore.has(pageId)) {
        addedPageIds.push(pageId);
      }
    });

    console.log(`\n📥 追加されたページ: ${addedPageIds.length}件`);
    
    if (addedPageIds.length > 0) {
      const addedPages = recordsCurrent.filter((r: any) => 
        addedPageIds.includes(String(r.pageId))
      );
      
      const addedByPageId = new Map<string, any[]>();
      addedPages.forEach((r: any) => {
        const pageId = String(r.pageId);
        if (!addedByPageId.has(pageId)) {
          addedByPageId.set(pageId, []);
        }
        addedByPageId.get(pageId)?.push(r);
      });

      console.log('\n   追加されたページ一覧（最初の10件）:\n');
      let count = 0;
      for (const [pageId, records] of addedByPageId.entries()) {
        if (count >= 10) break;
        const firstRecord = records[0];
        console.log(`   ${count + 1}. ${firstRecord.title}`);
        console.log(`      PageId: ${pageId}\n`);
        count++;
      }
    }

    // テストケースの期待ページを確認
    console.log('\n\n🔍 テストケース期待ページの確認...\n');
    
    const expectedPages = [
      { id: "046_【FIX】会員退会機能", pageId: null },
      { id: "164_【FIX】教室削除機能", pageId: null },
      { id: "168_【FIX】教室コピー機能", pageId: null },
      { id: "014_【FIX】求人応募機能", pageId: null },
      { id: "721_【作成中】学年自動更新バッチ", pageId: null },
    ];

    for (const expected of expectedPages) {
      const beforeExists = recordsBefore.some((r: any) => r.title === expected.id);
      const currentExists = recordsCurrent.some((r: any) => r.title === expected.id);
      
      console.log(`   ${expected.id}`);
      console.log(`   ├─ Phase 0A-4: ${beforeExists ? '✅ 存在' : '❌ なし'}`);
      console.log(`   └─ 現在: ${currentExists ? '✅ 存在' : '❌ なし'}\n`);
    }

    console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║       結論                                                              ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

    if (removedPageIds.length > 0) {
      console.log(`🔴 ${removedPageIds.length}ページが削除されています`);
      console.log('   → ベクトル空間の分布が変わった可能性あり');
      console.log('   → ベクトル検索の精度に影響');
    }

    if (addedPageIds.length > 0) {
      console.log(`\n📥 ${addedPageIds.length}ページが追加されています`);
    }

    console.log('\n推奨アクション:');
    console.log('   1. 削除されたページがフィルタリング対象か確認');
    console.log('   2. ベクトルインデックスの再構築が必要か検討');
    console.log('   3. Phase 0A-4時点のバックアップに戻すか検討');

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  } finally {
    const client = OptimizedLanceDBClient.getInstance();
    client.resetConnection();
    await client.disconnect();
  }
}

main();


