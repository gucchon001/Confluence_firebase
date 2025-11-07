/**
 * Firestore StructuredLabels → LanceDB 同期スクリプト
 * Phase 0A-2: ラベル統合
 * 
 * 機能:
 * 1. Firestoreから`structured_labels`コレクションを読み込み
 * 2. LanceDBの既存レコードに`StructuredLabel`を追加
 * 3. バッチ処理でパフォーマンス最適化
 */

import * as lancedb from '@lancedb/lancedb';
import * as arrow from 'apache-arrow';
import * as admin from 'firebase-admin';
import { config } from 'dotenv';
import { 
  EXTENDED_LANCEDB_SCHEMA, 
  flattenStructuredLabel,
  type ExtendedLanceDBRecord 
} from '../src/lib/lancedb-schema-extended';

config(); // .envファイルをロード

// Firebase Admin SDK初期化
if (!admin.apps.length) {
  try {
    // 本番環境では環境変数から認証情報を取得
    if (process.env.NODE_ENV === 'production') {
      // Cloud RunやApp Engineでは自動的に認証情報が提供される
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
    console.error('[SyncScript] Firebase Admin SDK初期化エラー:', error);
    // 本番環境での認証情報取得に失敗した場合は、デフォルト認証を試行
    admin.initializeApp();
  }
}

const db = admin.firestore();
const COLLECTION_NAME = 'structured_labels';

interface StructuredLabelDocument {
  pageId: string;
  structuredLabel: any;
  generatedAt: admin.firestore.Timestamp;
  generatedBy: 'rule-based' | 'llm-based';
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   Firestore StructuredLabels → LanceDB 同期                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 1: Firestoreから全StructuredLabelsを取得
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('📥 Firestoreから StructuredLabels を取得中...\n');
    
    const snapshot = await db.collection(COLLECTION_NAME).get();
    
    console.log(`✅ 取得完了: ${snapshot.size}件\n`);
    
    // pageId → StructuredLabel のマップを作成
    const labelMap = new Map<string, any>();
    
    for (const doc of snapshot.docs) {
      const data = doc.data() as StructuredLabelDocument;
      labelMap.set(data.pageId, data.structuredLabel);
    }
    
    console.log(`📊 ラベルマップ作成完了: ${labelMap.size}件\n`);
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 2: LanceDBに接続
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔌 LanceDBに接続中...\n');
    
    const lanceDb = await lancedb.connect('.lancedb');
    const table = await lanceDb.openTable('confluence');
    
    const totalRecords = await table.countRows();
    console.log(`✅ 接続完了: ${totalRecords}レコード\n`);
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 3: 既存レコードを読み込み、ラベルを統合
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔄 既存レコードにラベルを統合中...\n');
    
    const allRecords = await table.query().limit(totalRecords).toArray();
    
    let withLabel = 0;
    let withoutLabel = 0;
    
    const updatedRecords: ExtendedLanceDBRecord[] = allRecords.map((record: any) => {
      // pageIdを抽出（チャンクの場合は "-chunk-N" を削除）
      const pageId = String(record.pageId || record.id).replace(/-chunk-\d+$/, '');
      
      // Firestoreからラベルを取得
      const structuredLabel = labelMap.get(pageId);
      
      if (structuredLabel) {
        withLabel++;
      } else {
        withoutLabel++;
      }
      
      // StructuredLabelをフラット化
      const flatLabel = flattenStructuredLabel(structuredLabel);
      
      // labelsフィールドのクリーンアップ（文字列配列に変換）
      let cleanLabels: string[] = [];
      if (Array.isArray(record.labels)) {
        cleanLabels = record.labels
          .filter((label: any) => typeof label === 'string')
          .map((label: string) => String(label));
      }
      
      // 既存レコードとマージ
      return {
        id: record.id,
        pageId: String(record.pageId),
        title: record.title,
        content: record.content,
        vector: Array.from(record.vector),
        isChunked: record.isChunked || false,
        chunkIndex: record.chunkIndex || 0,
        totalChunks: record.totalChunks || 1,
        labels: cleanLabels,
        spaceKey: record.spaceKey || '',
        lastUpdated: record.lastUpdated || '',
        ...flatLabel,
      };
    });
    
    console.log(`📊 統合結果:`);
    console.log(`   ✅ ラベルあり: ${withLabel}件 (${(withLabel / allRecords.length * 100).toFixed(1)}%)`);
    console.log(`   ❌ ラベルなし: ${withoutLabel}件 (${(withoutLabel / allRecords.length * 100).toFixed(1)}%)\n`);
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 4: バックアップ作成
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('💾 バックアップを作成中...\n');
    
    const fs = await import('fs');
    const path = await import('path');
    const backupDir = 'backups/lancedb';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(backupDir, `.lancedb.backup.label-sync.${Date.now()}`);
    
    if (fs.existsSync('.lancedb')) {
      fs.cpSync('.lancedb', backupPath, { recursive: true });
      console.log(`   ✅ バックアップ完了: ${backupPath}\n`);
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 5: LanceDBを再作成
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔨 LanceDBテーブルを再作成中...\n');
    
    // 古いテーブルを削除
    if (fs.existsSync('.lancedb')) {
      fs.rmSync('.lancedb', { recursive: true, force: true });
    }
    
    // ファイルシステム同期待機
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 新しいテーブルを作成
    const newDb = await lancedb.connect('.lancedb');
    await newDb.createTable('confluence', updatedRecords as any, { 
      schema: EXTENDED_LANCEDB_SCHEMA 
    });
    
    console.log(`✅ テーブル再作成完了: ${updatedRecords.length}レコード\n`);
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 6: 検証
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔍 同期結果を検証中...\n');
    
    const verifyTable = await newDb.openTable('confluence');
    const verifyRecords = await verifyTable.query().limit(10).toArray();
    
    console.log('📋 サンプルレコード（最初の3件）:\n');
    
    for (let i = 0; i < Math.min(3, verifyRecords.length); i++) {
      const r = verifyRecords[i];
      console.log(`${i + 1}. ${r.title}`);
      console.log(`   pageId: ${r.pageId}`);
      console.log(`   category: ${r.structured_category || 'なし'}`);
      console.log(`   domain: ${r.structured_domain || 'なし'}`);
      console.log(`   feature: ${r.structured_feature || 'なし'}`);
      console.log(`   status: ${r.structured_status || 'なし'}`);
      console.log(`   confidence: ${r.structured_confidence !== undefined ? r.structured_confidence.toFixed(2) : 'なし'}\n`);
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 7: 統計情報
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                        同期完了                                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
    
    console.log(`📊 最終統計:`);
    console.log(`   総レコード数: ${updatedRecords.length}件`);
    console.log(`   ラベルあり: ${withLabel}件 (${(withLabel / updatedRecords.length * 100).toFixed(1)}%)`);
    console.log(`   ラベルなし: ${withoutLabel}件 (${(withoutLabel / updatedRecords.length * 100).toFixed(1)}%)`);
    console.log(`   バックアップ: ${backupPath}\n`);
    
    // カテゴリ別統計
    const categoryStats: Record<string, number> = {};
    updatedRecords.forEach(r => {
      if (r.structured_category) {
        categoryStats[r.structured_category] = (categoryStats[r.structured_category] || 0) + 1;
      }
    });
    
    console.log(`📂 カテゴリ別内訳:`);
    Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`   - ${cat}: ${count}件`);
      });
    
    console.log('\n✅ 同期処理が正常に完了しました！\n');
    
  } catch (error: any) {
    console.error('\n❌ エラーが発生しました:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();

