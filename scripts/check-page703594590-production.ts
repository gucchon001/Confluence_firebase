/**
 * 本番環境のpageId=703594590のStructuredLabel確認スクリプト
 */

import * as admin from 'firebase-admin';
import { config } from 'dotenv';

config();

// Firebase Admin SDK初期化
if (!admin.apps.length) {
  try {
    if (process.env.NODE_ENV === 'production') {
      admin.initializeApp();
    } else {
      admin.initializeApp({
        credential: admin.credential.cert(
          require('../keys/firebase-adminsdk-key.json')
        )
      });
    }
  } catch (error) {
    console.error('[CheckScript] Firebase Admin SDK初期化エラー:', error);
    admin.initializeApp();
  }
}

const db = admin.firestore();
const COLLECTION_NAME = 'structured_labels';
const TARGET_PAGE_ID = '703594590';

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   本番環境 pageId=703594590 StructuredLabel 確認スクリプト      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  try {
    console.log(`🔍 pageId=${TARGET_PAGE_ID} のStructuredLabelを確認中...\n`);
    
    const doc = await db.collection(COLLECTION_NAME).doc(TARGET_PAGE_ID).get();
    
    if (doc.exists) {
      const data = doc.data();
      const label = data?.structuredLabel || {};
      
      console.log(`✅ pageId=${TARGET_PAGE_ID} のStructuredLabelが見つかりました:\n`);
      console.log(`   feature: ${label.feature || 'N/A'}`);
      console.log(`   domain: ${label.domain || 'N/A'}`);
      console.log(`   category: ${label.category || 'N/A'}`);
      console.log(`   status: ${label.status || 'N/A'}`);
      console.log(`   priority: ${label.priority || 'N/A'}`);
      console.log(`   tags: ${label.tags?.join(', ') || 'N/A'}`);
      console.log(`   tags (array):`, label.tags || []);
      console.log(`   confidence: ${label.confidence || 'N/A'}`);
      console.log(`   is_valid: ${label.is_valid || 'N/A'}`);
      console.log(`   generatedAt: ${data?.generatedAt?.toDate() || 'N/A'}`);
      console.log(`   generatedBy: ${data?.generatedBy || 'N/A'}`);
      console.log('');
      
      // タグの詳細確認
      if (label.tags && Array.isArray(label.tags)) {
        console.log(`📋 タグ詳細 (${label.tags.length}件):`);
        label.tags.forEach((tag: string, index: number) => {
          console.log(`   ${index + 1}. "${tag}" (type: ${typeof tag})`);
        });
        console.log('');
        
        // 退会関連のタグをチェック
        const withdrawalTags = label.tags.filter((tag: string) => 
          tag.toLowerCase().includes('退会') || 
          tag.toLowerCase().includes('再登録') ||
          tag.toLowerCase().includes('メールアドレス') ||
          tag.toLowerCase().includes('パスワード再設定')
        );
        if (withdrawalTags.length > 0) {
          console.log(`✅ 退会関連タグ: ${withdrawalTags.join(', ')}\n`);
        } else {
          console.log(`⚠️ 退会関連タグが見つかりませんでした\n`);
        }
      } else {
        console.log(`❌ tagsが配列ではありません: ${typeof label.tags}\n`);
      }
      
    } else {
      console.log(`❌ pageId=${TARGET_PAGE_ID} のStructuredLabelが見つかりませんでした\n`);
      
      // 類似のpageIdを検索
      console.log('🔍 類似のpageIdを検索中...\n');
      const snapshot = await db.collection(COLLECTION_NAME)
        .where('pageId', '>=', '703594590')
        .where('pageId', '<=', '703594599')
        .get();
      
      if (snapshot.size > 0) {
        console.log(`📊 類似pageId: ${snapshot.size}件\n`);
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log(`   pageId: ${data.pageId}, feature: ${data.structuredLabel?.feature || 'N/A'}`);
        });
        console.log('');
      }
    }
    
    console.log('✅ 確認完了\n');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main().then(() => {
  console.log('✅ スクリプト実行完了');
  process.exit(0);
}).catch((error) => {
  console.error('❌ スクリプト実行エラー:', error);
  process.exit(1);
});

