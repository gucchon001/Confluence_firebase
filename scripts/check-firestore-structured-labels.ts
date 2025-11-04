/**
 * Firestore StructuredLabel確認スクリプト
 * 
 * 目的: FirestoreにStructuredLabelが存在するかを確認
 * 特に「教室削除機能」に関連するStructuredLabelを検索
 */

import * as admin from 'firebase-admin';
import { config } from 'dotenv';

config(); // .envファイルをロード

// Firebase Admin SDK初期化
if (!admin.apps.length) {
  try {
    // 本番環境では環境変数から認証情報を取得
    if (process.env.NODE_ENV === 'production') {
      admin.initializeApp();
    } else {
      // 開発環境ではローカルキーファイルを使用
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

interface StructuredLabelDocument {
  pageId: string;
  structuredLabel: {
    category?: string;
    domain?: string;
    feature?: string;
    priority?: string;
    status?: string;
    version?: string;
    tags?: string[];
    confidence?: number;
    content_length?: number;
    is_valid?: boolean;
  };
  generatedAt: admin.firestore.Timestamp;
  generatedBy: 'rule-based' | 'llm-based';
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   Firestore StructuredLabel 確認スクリプト                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 1: 全StructuredLabelを取得
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('📥 Firestoreから StructuredLabels を取得中...\n');
    
    const snapshot = await db.collection(COLLECTION_NAME).get();
    
    console.log(`✅ 取得完了: ${snapshot.size}件\n`);
    
    if (snapshot.size === 0) {
      console.log('❌ StructuredLabelが存在しません\n');
      return;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 2: 教室削除機能に関連するStructuredLabelを検索
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔍 「教室削除機能」に関連するStructuredLabelを検索中...\n');
    
    const classroomDeletionLabels: Array<{
      pageId: string;
      label: StructuredLabelDocument;
      matchType: string;
    }> = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data() as StructuredLabelDocument;
      const label = data.structuredLabel;
      
      // 検索条件: feature, domain, tagsに「教室削除」が含まれる
      const featureMatch = label.feature?.toLowerCase().includes('教室削除');
      const domainMatch = label.domain?.toLowerCase().includes('教室');
      const tagsMatch = label.tags?.some(tag => 
        tag.toLowerCase().includes('教室削除') || 
        tag.toLowerCase().includes('削除')
      );
      
      if (featureMatch || domainMatch || tagsMatch) {
        let matchType = '';
        if (featureMatch) matchType += 'feature ';
        if (domainMatch) matchType += 'domain ';
        if (tagsMatch) matchType += 'tags';
        
        classroomDeletionLabels.push({
          pageId: data.pageId,
          label: data,
          matchType: matchType.trim()
        });
      }
    }
    
    console.log(`📊 関連するStructuredLabel: ${classroomDeletionLabels.length}件\n`);
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 3: 詳細表示
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    if (classroomDeletionLabels.length > 0) {
      console.log('📋 詳細情報:\n');
      
      for (const item of classroomDeletionLabels) {
        const label = item.label.structuredLabel;
        console.log(`  📄 pageId: ${item.pageId}`);
        console.log(`     feature: ${label.feature || 'N/A'}`);
        console.log(`     domain: ${label.domain || 'N/A'}`);
        console.log(`     category: ${label.category || 'N/A'}`);
        console.log(`     status: ${label.status || 'N/A'}`);
        console.log(`     priority: ${label.priority || 'N/A'}`);
        console.log(`     tags: ${label.tags?.join(', ') || 'N/A'}`);
        console.log(`     confidence: ${label.confidence || 'N/A'}`);
        console.log(`     matchType: ${item.matchType}`);
        console.log('');
      }
      
      // 特に「教室削除機能」の完全一致をチェック
      const exactMatch = classroomDeletionLabels.find(item => 
        item.label.structuredLabel.feature?.toLowerCase().includes('教室削除機能')
      );
      
      if (exactMatch) {
        console.log('✅ 「教室削除機能」の完全一致が見つかりました:');
        console.log(`   pageId: ${exactMatch.pageId}`);
        console.log(`   feature: ${exactMatch.label.structuredLabel.feature}`);
        console.log('');
      } else {
        console.log('⚠️ 「教室削除機能」の完全一致は見つかりませんでした');
        console.log('');
      }
    } else {
      console.log('❌ 「教室削除機能」に関連するStructuredLabelが見つかりませんでした\n');
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 4: 統計情報
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('📊 統計情報:\n');
    
    const stats = {
      total: snapshot.size,
      withFeature: 0,
      withDomain: 0,
      withTags: 0,
      approved: 0,
      byCategory: {} as Record<string, number>,
      byDomain: {} as Record<string, number>
    };
    
    for (const doc of snapshot.docs) {
      const data = doc.data() as StructuredLabelDocument;
      const label = data.structuredLabel;
      
      if (label.feature) stats.withFeature++;
      if (label.domain) stats.withDomain++;
      if (label.tags && label.tags.length > 0) stats.withTags++;
      if (label.status === 'approved') stats.approved++;
      
      if (label.category) {
        stats.byCategory[label.category] = (stats.byCategory[label.category] || 0) + 1;
      }
      
      if (label.domain) {
        stats.byDomain[label.domain] = (stats.byDomain[label.domain] || 0) + 1;
      }
    }
    
    console.log(`  総件数: ${stats.total}`);
    console.log(`  featureあり: ${stats.withFeature} (${(stats.withFeature / stats.total * 100).toFixed(1)}%)`);
    console.log(`  domainあり: ${stats.withDomain} (${(stats.withDomain / stats.total * 100).toFixed(1)}%)`);
    console.log(`  tagsあり: ${stats.withTags} (${(stats.withTags / stats.total * 100).toFixed(1)}%)`);
    console.log(`  approved: ${stats.approved} (${(stats.approved / stats.total * 100).toFixed(1)}%)`);
    console.log('');
    
    console.log('  カテゴリ別:');
    for (const [category, count] of Object.entries(stats.byCategory)) {
      console.log(`    ${category}: ${count}`);
    }
    console.log('');
    
    console.log('  ドメイン別（上位10件）:');
    const sortedDomains = Object.entries(stats.byDomain)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [domain, count] of sortedDomains) {
      console.log(`    ${domain}: ${count}`);
    }
    console.log('');
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 5: ページID「164」のStructuredLabelを確認
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔍 ページID「164」のStructuredLabelを確認中...\n');
    
    const page164Doc = await db.collection(COLLECTION_NAME).doc('164').get();
    
    if (page164Doc.exists) {
      const data = page164Doc.data() as StructuredLabelDocument;
      const label = data.structuredLabel;
      
      console.log('✅ ページID「164」のStructuredLabelが見つかりました:');
      console.log(`   feature: ${label.feature || 'N/A'}`);
      console.log(`   domain: ${label.domain || 'N/A'}`);
      console.log(`   category: ${label.category || 'N/A'}`);
      console.log(`   status: ${label.status || 'N/A'}`);
      console.log(`   priority: ${label.priority || 'N/A'}`);
      console.log(`   version: ${label.version || 'N/A'}`);
      console.log(`   tags: ${label.tags?.join(', ') || 'N/A'}`);
      console.log(`   confidence: ${label.confidence || 'N/A'}`);
      console.log(`   is_valid: ${label.is_valid || 'N/A'}`);
      console.log('');
    } else {
      console.log('❌ ページID「164」のStructuredLabelが見つかりませんでした\n');
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 6: 機能名に「削除機能」が含まれるStructuredLabelを検索
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔍 機能名に「削除機能」が含まれるStructuredLabelを検索中...\n');
    
    const deletionFunctionLabels: Array<{
      pageId: string;
      feature: string;
    }> = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data() as StructuredLabelDocument;
      const label = data.structuredLabel;
      
      if (label.feature?.includes('削除機能')) {
        deletionFunctionLabels.push({
          pageId: data.pageId,
          feature: label.feature
        });
      }
    }
    
    console.log(`📊 「削除機能」を含むStructuredLabel: ${deletionFunctionLabels.length}件\n`);
    
    if (deletionFunctionLabels.length > 0) {
      console.log('📋 詳細情報:\n');
      deletionFunctionLabels.slice(0, 20).forEach(item => {
        console.log(`  📄 pageId: ${item.pageId}, feature: ${item.feature}`);
      });
      if (deletionFunctionLabels.length > 20) {
        console.log(`  ... 他 ${deletionFunctionLabels.length - 20}件`);
      }
      console.log('');
    }
    
    console.log('✅ 確認完了\n');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
main().then(() => {
  console.log('✅ スクリプト実行完了');
  process.exit(0);
}).catch((error) => {
  console.error('❌ スクリプト実行エラー:', error);
  process.exit(1);
});

