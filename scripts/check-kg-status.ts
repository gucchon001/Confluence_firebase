/**
 * Knowledge Graph構築状況の確認
 */

import { kgStorageService } from '../src/lib/kg-storage-service';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require('../keys/firebase-adminsdk-key.json')
    )
  });
}

async function main() {
  console.log('='.repeat(100));
  console.log('Knowledge Graph 構築状況確認');
  console.log('='.repeat(100));
  console.log();
  
  // KG統計情報
  const stats = await kgStorageService.getStats();
  
  console.log('📊 Knowledge Graph統計:');
  console.log(`   総ノード数: ${stats.nodeCount.toLocaleString()}件`);
  console.log(`   総エッジ数: ${stats.edgeCount.toLocaleString()}件`);
  
  if (stats.nodeCount > 0) {
    console.log(`   平均次数: ${(stats.edgeCount / stats.nodeCount).toFixed(2)}本/ノード`);
  }
  
  console.log();
  
  if (stats.nodeCount === 0) {
    console.log('❌ Knowledge Graphが構築されていません！');
    console.log();
    console.log('原因:');
    console.log('   1. KGビルドスクリプトが未実行');
    console.log('   2. Firestoreの kg_nodes / kg_edges コレクションが空');
    console.log();
    console.log('対処:');
    console.log('   1. npm run kg:build を実行してKGを構築');
    console.log('   2. または、KG拡張機能を無効化してパフォーマンス改善');
    return;
  }
  
  // サンプルノード表示
  console.log('📄 サンプルKGノード（最初の5件）:');
  const db = admin.firestore();
  const nodesSnapshot = await db.collection('kg_nodes').limit(5).get();
  
  nodesSnapshot.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`\n${i + 1}. pageId: ${doc.id}`);
    console.log(`   title: ${data.title || 'N/A'}`);
    console.log(`   domain: ${data.domain || 'N/A'}`);
    console.log(`   tags: ${data.tags?.join(', ') || 'N/A'}`);
  });
  
  console.log();
  
  // サンプルエッジ表示
  console.log('🔗 サンプルKGエッジ（最初の5件）:');
  const edgesSnapshot = await db.collection('kg_edges').limit(5).get();
  
  edgesSnapshot.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`\n${i + 1}. ${data.sourcePageId} → ${data.targetPageId}`);
    console.log(`   edgeType: ${data.edgeType}`);
    console.log(`   confidence: ${data.confidence?.toFixed(2) || 'N/A'}`);
  });
  
  console.log();
  console.log('='.repeat(100));
}

main().catch(console.error);

