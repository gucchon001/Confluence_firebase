/**
 * Firestore StructuredLabels確認スクリプト
 */

import admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

config();

// Firebase Admin初期化
const serviceAccountPath = path.join(process.cwd(), 'keys', 'firebase-adminsdk-key.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const COLLECTION_NAME = 'structured_labels';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       Firestore StructuredLabels 確認                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  try {
    console.log('📥 Firestoreから StructuredLabels を取得中...');
    const snapshot = await db.collection(COLLECTION_NAME).get();
    const firestoreLabels = snapshot.docs.map(doc => ({
      pageId: doc.id,
      structuredLabel: doc.data().structuredLabel,
      ...doc.data()
    }));
    
    console.log(`✅ 取得完了: ${firestoreLabels.length}件\n`);
    
    if (firestoreLabels.length === 0) {
      console.log('❌ Firestoreに StructuredLabels が存在しません');
      console.log('\n推奨アクション:');
      console.log('   1. ラベル生成スクリプトを実行:');
      console.log('      npm run label:generate:all');
      return;
    }
    
    console.log('📊 サンプル（最初の5件）:\n');
    firestoreLabels.slice(0, 5).forEach((doc, i) => {
      const label = doc.structuredLabel;
      console.log(`${i + 1}. PageId: ${doc.pageId}`);
      console.log(`   ├─ category: ${label.category}`);
      console.log(`   ├─ domain: ${label.domain}`);
      console.log(`   ├─ feature: ${label.feature}`);
      console.log(`   ├─ status: ${label.status}`);
      console.log(`   ├─ priority: ${label.priority}`);
      console.log(`   ├─ confidence: ${label.confidence?.toFixed(2)}`);
      console.log(`   └─ tags: [${(label.tags || []).join(', ')}]`);
      console.log('');
    });
    
    // カテゴリ別統計
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📂 カテゴリ別統計:\n');
    
    const categoryCounts: { [key: string]: number } = {};
    firestoreLabels.forEach(doc => {
      const category = doc.structuredLabel.category || 'unknown';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    Object.entries(categoryCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .forEach(([category, count]) => {
        console.log(`   - ${category}: ${count}件 (${(count / firestoreLabels.length * 100).toFixed(1)}%)`);
      });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Firestoreに StructuredLabels が存在します');
    console.log('\n次のステップ:');
    console.log('   LanceDBに同期:');
    console.log('   npx tsx scripts/sync-firestore-labels-to-lancedb.ts');
    
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }
}

main();

