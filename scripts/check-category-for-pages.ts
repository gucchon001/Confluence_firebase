/**
 * 特定のページのstructured_categoryを確認するスクリプト
 */

// 環境変数を読み込み
import * as dotenv from 'dotenv';
dotenv.config();

import { initializeFirebaseAdmin } from '../src/lib/firebase-admin-init';

async function checkCategories() {
  await initializeFirebaseAdmin();
  const admin = await import('firebase-admin');
  const db = admin.firestore();
  
  // 確認対象のページID
  const pageIds = [
    '685834288', // 【FIX】退会完了通知メール（会員宛）
    '1223295007', // 【作成中】キャリア用応募完了メール（会員宛）
    '703889475', // 042_【FIX】会員ログイン・ログアウト機能
  ];
  
  console.log('📋 ページのstructured_categoryを確認中...\n');
  
  for (const pageId of pageIds) {
    try {
      const doc = await db.collection('structured_labels').doc(pageId).get();
      
      if (doc.exists) {
        const data = doc.data();
        console.log(`\n📄 pageId: ${pageId}`);
        console.log(`   structured_category: ${data?.structured_category || '未設定'}`);
        console.log(`   structured_domain: ${data?.structured_domain || '未設定'}`);
        console.log(`   structured_feature: ${data?.structured_feature || '未設定'}`);
        console.log(`   structured_tags: ${data?.structured_tags?.join(', ') || '未設定'}`);
      } else {
        console.log(`\n📄 pageId: ${pageId}`);
        console.log(`   ❌ Firestoreにデータが存在しません`);
      }
    } catch (error: any) {
      console.error(`\n❌ pageId ${pageId} の確認中にエラー:`, error.message);
    }
  }
  
  process.exit(0);
}

checkCategories();

