/**
 * KGの全体的な状態を確認
 */

import { KGStorageService } from '../src/lib/kg-storage-service';

async function checkKGStatus() {
  console.log('\n🔍 KGの全体状態を確認\n');
  
  const kgStorage = new KGStorageService();
  
  // 全ノード取得
  const stats = await kgStorage.getStats();
  console.log('📊 KG統計情報:');
  console.log(`  ノード数: ${stats.nodeCount}`);
  console.log(`  エッジ数: ${stats.edgeCount}\n`);
  
  // サンプルノードを取得
  console.log('📋 サンプルノード（最初の10件）:\n');
  
  // Firestoreから直接ノードを取得
  const { getApp, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  
  // 既存のアプリを使用
  const app = getApps().length > 0 ? getApp() : (() => {
    throw new Error('Firebase app not initialized');
  })();
  
  const db = getFirestore(app);
  
  // ノードコレクション確認
  const nodesSnapshot = await db.collection('knowledge_graph_nodes').limit(10).get();
  
  if (nodesSnapshot.empty) {
    console.log('❌ ノードが存在しません！\n');
  } else {
    nodesSnapshot.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`${idx + 1}. ID: ${doc.id}`);
      console.log(`   タイトル: ${data.title || 'N/A'}`);
      console.log(`   pageId: ${data.pageId || 'N/A'}`);
      console.log(`   タイプ: ${data.type || 'N/A'}\n`);
    });
  }
  
  // エッジコレクション確認
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 サンプルエッジ（最初の10件）:\n');
  
  const edgesSnapshot = await db.collection('knowledge_graph_edges').limit(10).get();
  
  if (edgesSnapshot.empty) {
    console.log('❌ エッジが存在しません！\n');
  } else {
    edgesSnapshot.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`${idx + 1}. ${data.source || 'N/A'} → ${data.target || 'N/A'}`);
      console.log(`   タイプ: ${data.type || 'N/A'}, 重み: ${data.weight || 'N/A'}\n`);
    });
  }
  
  // 特定のページID（164, 177）を検索
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔍 164と177を含むノードを検索:\n');
  
  const searchIds = ['164', '168', '177', '718373062', '704053518', '804094117'];
  
  for (const id of searchIds) {
    const nodeDoc = await db.collection('knowledge_graph_nodes').doc(id).get();
    if (nodeDoc.exists) {
      const data = nodeDoc.data();
      console.log(`✅ ノード "${id}" が見つかりました`);
      console.log(`   タイトル: ${data?.title || 'N/A'}`);
      console.log(`   pageId: ${data?.pageId || 'N/A'}\n`);
    }
  }
  
  // タイトルで検索
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔍 タイトルに "164" または "教室削除" を含むノードを検索:\n');
  
  const titleQuery = await db.collection('knowledge_graph_nodes')
    .where('title', '>=', '164')
    .where('title', '<=', '164\uf8ff')
    .limit(5)
    .get();
  
  if (titleQuery.empty) {
    console.log('❌ タイトルに "164" を含むノードが見つかりません\n');
  } else {
    titleQuery.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`${idx + 1}. ID: ${doc.id}, タイトル: ${data.title}\n`);
    });
  }
  
  process.exit(0);
}

checkKGStatus().catch(error => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
