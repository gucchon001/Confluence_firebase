/**
 * Firestore保存先の構造を表示
 */

import 'dotenv/config';
import * as admin from 'firebase-admin';

// Firebase Admin SDK初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function main() {
  console.log('\n📍 Firestore保存先の詳細\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Firebase設定情報
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'confluence-copilot-ppjye';
  
  console.log('🔧 Firebase プロジェクト情報\n');
  console.log(`プロジェクトID: ${projectId}`);
  console.log(`プロジェクトURL: https://console.firebase.google.com/project/${projectId}\n`);
  
  // Firestoreコレクション
  const COLLECTION_NAME = 'structured_labels';
  
  console.log('📂 Firestoreコレクション構造\n');
  console.log(`コレクション名: ${COLLECTION_NAME}`);
  console.log(`パス: /structured_labels/{pageId}\n`);
  
  // サンプルドキュメント構造
  console.log('📄 ドキュメント構造\n');
  console.log('```json');
  console.log('{');
  console.log('  "pageId": "page-0",');
  console.log('  "structuredLabel": {');
  console.log('    "category": "workflow",');
  console.log('    "domain": "クライアント企業管理",');
  console.log('    "feature": "商品登録・購入不可化フロー",');
  console.log('    "priority": "high",');
  console.log('    "status": "approved",');
  console.log('    "tags": ["登録"],');
  console.log('    "confidence": 0.9');
  console.log('  },');
  console.log('  "generatedAt": Timestamp,');
  console.log('  "generatedBy": "rule-based"');
  console.log('}');
  console.log('```\n');
  
  // 実データの確認
  console.log('📊 実データの確認\n');
  
  try {
    const snapshot = await db.collection(COLLECTION_NAME).limit(3).get();
    
    console.log(`保存済みドキュメント数: ${snapshot.size}件（サンプル3件表示）\n`);
    
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`[${index + 1}] ドキュメントID: ${doc.id}`);
      console.log(`    pageId: ${data.pageId}`);
      console.log(`    機能名: ${data.structuredLabel?.feature}`);
      console.log(`    ドメイン: ${data.structuredLabel?.domain}`);
      console.log(`    生成日時: ${data.generatedAt?.toDate?.() || data.generatedAt}`);
      console.log('');
    });
    
    // Firestore ConsoleのURL
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🌐 Firestore Console URL\n');
    console.log(`https://console.firebase.google.com/project/${projectId}/firestore/databases/-default-/data/~2F${COLLECTION_NAME}\n`);
    
    // 統計情報
    const totalSnapshot = await db.collection(COLLECTION_NAME).get();
    console.log('📈 保存済みデータ統計\n');
    console.log(`総ドキュメント数: ${totalSnapshot.size}件`);
    
    const categories = new Map<string, number>();
    totalSnapshot.forEach(doc => {
      const category = doc.data().structuredLabel?.category;
      if (category) {
        categories.set(category, (categories.get(category) || 0) + 1);
      }
    });
    
    console.log('\nカテゴリ別内訳:');
    Array.from(categories.entries())
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`  - ${category}: ${count}件`);
      });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }
}

main();

