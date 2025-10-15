/**
 * Firestoreに保存されたStructuredLabelを表示
 */

import 'dotenv/config';
import { getStructuredLabelStats } from '@/lib/structured-label-service-admin';
import * as admin from 'firebase-admin';

// Firebase Admin SDK初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();
const COLLECTION_NAME = 'structured_labels';

async function main() {
  console.log('\n📊 生成されたStructuredLabel一覧\n');
  
  try {
    // 全件取得
    const snapshot = await db.collection(COLLECTION_NAME).get();
    
    console.log(`総件数: ${snapshot.size}件\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const labels: any[] = [];
    
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      labels.push({
        index: index + 1,
        pageId: data.pageId,
        label: data.structuredLabel,
        generatedBy: data.generatedBy,
        generatedAt: data.generatedAt?.toDate?.() || data.generatedAt
      });
    });
    
    // ソート: カテゴリ → ドメイン → 機能名
    labels.sort((a, b) => {
      if (a.label.category !== b.label.category) {
        return a.label.category.localeCompare(b.label.category);
      }
      if (a.label.domain !== b.label.domain) {
        return a.label.domain.localeCompare(b.label.domain);
      }
      return a.label.feature.localeCompare(b.label.feature);
    });
    
    // 表示
    labels.forEach((item) => {
      const label = item.label;
      console.log(`[${item.index}] 📄 ${label.feature}`);
      console.log(`   🏢 ドメイン: ${label.domain}`);
      console.log(`   📁 カテゴリ: ${label.category}`);
      console.log(`   ⚡ 優先度: ${label.priority}`);
      console.log(`   📋 ステータス: ${label.status}`);
      if (label.version) {
        console.log(`   🔢 バージョン: ${label.version}`);
      }
      if (label.tags && label.tags.length > 0) {
        console.log(`   🏷️  タグ: ${label.tags.join(', ')}`);
      }
      console.log(`   🎯 信頼度: ${((label.confidence || 0) * 100).toFixed(0)}%`);
      console.log(`   🤖 生成方法: ${item.generatedBy === 'rule-based' ? 'ルールベース' : 'LLM'}`);
      console.log('');
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 統計
    const stats = await getStructuredLabelStats();
    
    console.log('📈 統計サマリー\n');
    console.log(`総件数: ${stats.total}件`);
    console.log(`平均信頼度: ${(stats.averageConfidence * 100).toFixed(1)}%\n`);
    
    console.log('📋 カテゴリ別:');
    Object.entries(stats.byCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   - ${category}: ${count}件`);
      });
    
    console.log('\n🏢 ドメイン別 (上位10件):');
    Object.entries(stats.byDomain)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([domain, count]) => {
        console.log(`   - ${domain}: ${count}件`);
      });
    
    console.log('\n📝 ステータス別:');
    Object.entries(stats.byStatus)
      .sort(([, a], [, b]) => b - a)
      .forEach(([status, count]) => {
        console.log(`   - ${status}: ${count}件`);
      });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    console.error(error.stack);
  }
}

main();

