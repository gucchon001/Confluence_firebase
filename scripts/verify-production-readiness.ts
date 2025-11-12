/**
 * 本番環境へのアップロード前の最終検証スクリプト
 * 
 * 確認項目:
 * 1. StructuredLabelの同期状態
 * 2. インデックスの状態
 * 3. メタデータの整合性
 * 4. サンプルページのデータ品質
 */

import * as lancedb from '@lancedb/lancedb';
import * as admin from 'firebase-admin';
import { config } from 'dotenv';
import { getLabelsAsArray } from '../src/lib/label-utils';

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
    console.error('[VerifyScript] Firebase Admin SDK初期化エラー:', error);
    admin.initializeApp();
  }
}

const db = admin.firestore();
const TARGET_PAGE_ID = '703594590'; // サンプルページ

async function checkLanceDBIndexes() {
  console.log('🔍 インデックスの状態を確認中...\n');
  
  try {
    const lanceDb = await lancedb.connect('.lancedb');
    const table = await lanceDb.openTable('confluence');
    
    // インデックス情報を取得
    const indexes = await table.listIndices();
    
    console.log(`📊 インデックス数: ${indexes.length}\n`);
    
    if (indexes.length === 0) {
      console.log('⚠️ インデックスが作成されていません\n');
      return false;
    }
    
    // インデックスの詳細を表示
    for (const index of indexes) {
      console.log(`  - ${index.name || 'unnamed'}: ${index.indexType || 'unknown'}`);
      if (index.columns) {
        console.log(`    カラム: ${index.columns.join(', ')}`);
      }
    }
    console.log('');
    
    return true;
  } catch (error: any) {
    console.error('❌ インデックス確認エラー:', error.message);
    return false;
  }
}

async function checkStructuredLabels() {
  console.log('🔍 StructuredLabelの同期状態を確認中...\n');
  
  try {
    const lanceDb = await lancedb.connect('.lancedb');
    const table = await lanceDb.openTable('confluence');
    
    // 全レコードを取得
    const dummyVector = new Array(768).fill(0);
    const allResults = await table.search(dummyVector).limit(10000).toArray();
    
    console.log(`📊 総レコード数: ${allResults.length}\n`);
    
    // StructuredLabelフィールドの統計
    const stats = {
      total: allResults.length,
      withCategory: 0,
      withDomain: 0,
      withFeature: 0,
      withTags: 0,
      withStatus: 0,
      complete: 0, // 全フィールドが揃っている
    };
    
    for (const record of allResults) {
      if (record.structured_category) stats.withCategory++;
      if (record.structured_domain) stats.withDomain++;
      if (record.structured_feature) stats.withFeature++;
      if (record.structured_tags) {
        const tags = getLabelsAsArray(record.structured_tags);
        if (tags.length > 0) stats.withTags++;
      }
      if (record.structured_status) stats.withStatus++;
      
      // 全フィールドが揃っているか
      if (record.structured_category && 
          record.structured_domain && 
          record.structured_feature &&
          getLabelsAsArray(record.structured_tags).length > 0) {
        stats.complete++;
      }
    }
    
    console.log('📋 StructuredLabel統計:\n');
    console.log(`  総レコード数: ${stats.total}`);
    console.log(`  categoryあり: ${stats.withCategory} (${(stats.withCategory / stats.total * 100).toFixed(1)}%)`);
    console.log(`  domainあり: ${stats.withDomain} (${(stats.withDomain / stats.total * 100).toFixed(1)}%)`);
    console.log(`  featureあり: ${stats.withFeature} (${(stats.withFeature / stats.total * 100).toFixed(1)}%)`);
    console.log(`  tagsあり: ${stats.withTags} (${(stats.withTags / stats.total * 100).toFixed(1)}%)`);
    console.log(`  statusあり: ${stats.withStatus} (${(stats.withStatus / stats.total * 100).toFixed(1)}%)`);
    console.log(`  完全なレコード: ${stats.complete} (${(stats.complete / stats.total * 100).toFixed(1)}%)\n`);
    
    // サンプルページの確認
    const targetResult = allResults.find((r: any) => {
      const pageId = r.page_id || r.pageId;
      return String(pageId) === TARGET_PAGE_ID;
    });
    
    if (targetResult) {
      console.log(`✅ サンプルページ (pageId=${TARGET_PAGE_ID}) が見つかりました:\n`);
      console.log(`  title: ${targetResult.title || 'N/A'}`);
      console.log(`  category: ${targetResult.structured_category || 'N/A'}`);
      console.log(`  domain: ${targetResult.structured_domain || 'N/A'}`);
      console.log(`  feature: ${targetResult.structured_feature || 'N/A'}`);
      const tags = getLabelsAsArray(targetResult.structured_tags);
      console.log(`  tags: ${tags.length > 0 ? tags.join(', ') : 'N/A'}`);
      console.log(`  status: ${targetResult.structured_status || 'N/A'}\n`);
      
      if (tags.length === 0) {
        console.log('⚠️ サンプルページのtagsが空です\n');
        return false;
      }
    } else {
      console.log(`❌ サンプルページ (pageId=${TARGET_PAGE_ID}) が見つかりませんでした\n`);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.error('❌ StructuredLabel確認エラー:', error.message);
    return false;
  }
}

async function checkFirestoreSync() {
  console.log('🔍 Firestoreとの同期状態を確認中...\n');
  
  try {
    // FirestoreからサンプルページのStructuredLabelを取得
    const firestoreDoc = await db.collection('structured_labels').doc(TARGET_PAGE_ID).get();
    
    if (!firestoreDoc.exists) {
      console.log(`❌ FirestoreにpageId=${TARGET_PAGE_ID}のStructuredLabelが存在しません\n`);
      return false;
    }
    
    const firestoreData = firestoreDoc.data();
    const firestoreLabel = firestoreData?.structuredLabel || {};
    
    // LanceDBから同じページを取得
    const lanceDb = await lancedb.connect('.lancedb');
    const table = await lanceDb.openTable('confluence');
    const dummyVector = new Array(768).fill(0);
    const allResults = await table.search(dummyVector).limit(10000).toArray();
    const lancedbResult = allResults.find((r: any) => {
      const pageId = r.page_id || r.pageId;
      return String(pageId) === TARGET_PAGE_ID;
    });
    
    if (!lancedbResult) {
      console.log(`❌ LanceDBにpageId=${TARGET_PAGE_ID}が見つかりません\n`);
      return false;
    }
    
    console.log('📋 Firestore vs LanceDB 比較:\n');
    console.log('  Firestore:');
    console.log(`    category: ${firestoreLabel.category || 'N/A'}`);
    console.log(`    domain: ${firestoreLabel.domain || 'N/A'}`);
    console.log(`    feature: ${firestoreLabel.feature || 'N/A'}`);
    console.log(`    tags: ${firestoreLabel.tags?.join(', ') || 'N/A'}`);
    console.log(`    status: ${firestoreLabel.status || 'N/A'}\n`);
    
    console.log('  LanceDB:');
    console.log(`    category: ${lancedbResult.structured_category || 'N/A'}`);
    console.log(`    domain: ${lancedbResult.structured_domain || 'N/A'}`);
    console.log(`    feature: ${lancedbResult.structured_feature || 'N/A'}`);
    const lancedbTags = getLabelsAsArray(lancedbResult.structured_tags);
    console.log(`    tags: ${lancedbTags.join(', ') || 'N/A'}`);
    console.log(`    status: ${lancedbResult.structured_status || 'N/A'}\n`);
    
    // 比較
    const categoryMatch = firestoreLabel.category === lancedbResult.structured_category;
    const domainMatch = firestoreLabel.domain === lancedbResult.structured_domain;
    const featureMatch = firestoreLabel.feature === lancedbResult.structured_feature;
    const tagsMatch = JSON.stringify(firestoreLabel.tags || []) === JSON.stringify(lancedbTags);
    const statusMatch = firestoreLabel.status === lancedbResult.structured_status;
    
    console.log('📊 同期状態:\n');
    console.log(`  category: ${categoryMatch ? '✅' : '❌'}`);
    console.log(`  domain: ${domainMatch ? '✅' : '❌'}`);
    console.log(`  feature: ${featureMatch ? '✅' : '❌'}`);
    console.log(`  tags: ${tagsMatch ? '✅' : '❌'}`);
    console.log(`  status: ${statusMatch ? '✅' : '❌'}\n`);
    
    if (!categoryMatch || !domainMatch || !featureMatch || !tagsMatch || !statusMatch) {
      console.log('⚠️ FirestoreとLanceDBの同期が不完全です\n');
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.error('❌ Firestore同期確認エラー:', error.message);
    return false;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   本番環境アップロード前 最終検証スクリプト                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  const results = {
    indexes: false,
    structuredLabels: false,
    firestoreSync: false,
  };
  
  // 1. インデックスの確認
  results.indexes = await checkLanceDBIndexes();
  
  // 2. StructuredLabelの確認
  results.structuredLabels = await checkStructuredLabels();
  
  // 3. Firestoreとの同期確認
  results.firestoreSync = await checkFirestoreSync();
  
  // 最終結果
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                        検証結果                                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`  インデックス: ${results.indexes ? '✅ OK' : '❌ NG'}`);
  console.log(`  StructuredLabel: ${results.structuredLabels ? '✅ OK' : '❌ NG'}`);
  console.log(`  Firestore同期: ${results.firestoreSync ? '✅ OK' : '❌ NG'}\n`);
  
  const allOk = results.indexes && results.structuredLabels && results.firestoreSync;
  
  if (allOk) {
    console.log('✅ すべての検証項目が合格しました。本番環境へのアップロード準備が整いました。\n');
    process.exit(0);
  } else {
    console.log('❌ 一部の検証項目が不合格です。本番環境へのアップロード前に修正してください。\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  });
}

