/**
 * コピー596ページのメタデータを確認するスクリプト
 */

// 環境変数を読み込み
import * as dotenv from 'dotenv';
dotenv.config();

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const pageId = '940769281'; // コピー596_【不使用】応募管理 - 一覧閲覧機能（バックアップ）

async function checkMetadata() {
  console.log(`🔍 ページID ${pageId} のメタデータを確認中...\n`);
  
  // Firebase初期化
  const serviceAccountPath = path.join(process.cwd(), 'keys', 'firebase-adminsdk-key.json');
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account key not found: ${serviceAccountPath}`);
  }
  
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
  
  const db = getFirestore();
  
  // FirestoreのStructuredLabelを確認
  console.log('📋 Firestore StructuredLabel:');
  const labelDoc = await db.collection('structured_labels').doc(pageId).get();
  if (labelDoc.exists) {
    const labelData = labelDoc.data();
    console.log(JSON.stringify(labelData, null, 2));
  } else {
    console.log('  ❌ StructuredLabelが存在しません');
  }
  
  console.log('\n');
  
  // LanceDBのメタデータは検索結果から確認
  
  // 検索クエリ「014_【FIX】求人応募機能」で検索した場合のスコアを確認
  console.log('\n📋 検索クエリ「014_【FIX】求人応募機能」での検索結果:');
  const { searchLanceDB } = await import('../src/lib/lancedb-search-client');
  const { getPageIdFromRecord } = await import('../src/lib/pageid-migration-helper');
  
  const searchResults = await searchLanceDB({
    query: '014_【FIX】求人応募機能',
    topK: 30,
    useLunrIndex: true,
    labelFilters: {
      includeMeetingNotes: false
    }
  });
  
  const targetIndex = searchResults.findIndex(r => {
    const pid = String(getPageIdFromRecord(r) || '');
    return pid === pageId;
  });
  
  if (targetIndex >= 0) {
    const result = searchResults[targetIndex];
    console.log(`  ✅ 見つかりました: ${targetIndex + 1}位`);
    console.log(`  タイトル: ${result.title}`);
    const score = (result as any).score ?? (result as any)._compositeScore ?? (result as any)._score;
    console.log(`  スコア: ${score !== undefined ? (typeof score === 'number' ? score.toFixed(4) : String(score)) : 'N/A'}`);
    console.log(`  _compositeScore: ${(result as any)._compositeScore || 'N/A'}`);
    console.log(`  _rrfScore: ${(result as any)._rrfScore || 'N/A'}`);
    console.log(`  _distance: ${(result as any)._distance || 'N/A'}`);
    console.log(`  _hybridScore: ${(result as any)._hybridScore || 'N/A'}`);
    console.log(`  structured_category: ${result.structured_category || 'N/A'}`);
    console.log(`  structured_domain: ${result.structured_domain || 'N/A'}`);
    console.log(`  structured_feature: ${result.structured_feature || 'N/A'}`);
    console.log(`  structured_tags: ${JSON.stringify(result.structured_tags || [], null, 2)}`);
    console.log(`  labels: ${JSON.stringify(result.labels || [], null, 2)}`);
    console.log(`  _sourceType: ${(result as any)._sourceType || 'N/A'}`);
    console.log(`  _scoreBreakdown: ${JSON.stringify((result as any)._scoreBreakdown || {}, null, 2)}`);
  } else {
    console.log('  ❌ 検索結果に見つかりませんでした');
  }
  
  // 上位10件の結果も表示して比較
  console.log('\n📋 上位10件の結果（比較用）:');
  for (let i = 0; i < Math.min(10, searchResults.length); i++) {
    const result = searchResults[i];
    const pid = String(getPageIdFromRecord(result) || '');
    const score = (result as any).score ?? (result as any)._compositeScore ?? (result as any)._score;
    const category = result.structured_category || 'N/A';
    const tags = Array.isArray(result.structured_tags) ? result.structured_tags : [];
    console.log(`  ${i + 1}. ${result.title}`);
    console.log(`     pageId: ${pid}, score: ${score !== undefined ? (typeof score === 'number' ? score.toFixed(4) : String(score)) : 'N/A'}, category: ${category}, tags: ${tags.length > 0 ? tags.join(', ') : 'なし'}`);
  }
  
  process.exit(0);
}

checkMetadata().catch(console.error);

