import 'dotenv/config';
import admin from 'firebase-admin';
import { initializeFirebaseAdmin } from '../src/lib/firebase-admin-init';

initializeFirebaseAdmin();

// Firestoreインスタンスを取得（データベースIDを明示的に指定）
const firestore = admin.firestore();

async function main() {
  try {
    console.log('📊 Firestore jiraIssuesコレクションの件数を確認中...');
    console.log(`   プロジェクトID: ${admin.app().options.projectId}`);
    console.log(`   Firestoreデータベース: (default)\n`);
    
    const issuesRef = firestore.collection('jiraIssues');
    
    // まず、特定のドキュメントを取得して接続を確認
    console.log('🔍 接続テスト: サンプルドキュメントを取得中...');
    try {
      // よくあるJiraのキーを試す
      const testKeys = ['CTJ-1', 'CTJ-100', 'CTJ-1000'];
      let found = false;
      for (const key of testKeys) {
        try {
          const doc = await issuesRef.doc(key).get();
          if (doc.exists) {
            console.log(`✅ ドキュメントが見つかりました: ${key}`);
            found = true;
            break;
          }
        } catch (err) {
          // スキップ
        }
      }
      if (!found) {
        console.log('⚠️  サンプルドキュメントが見つかりませんでした（コレクションが空の可能性があります）');
      }
    } catch (testError) {
      console.log('⚠️  接続テストでエラー:', testError instanceof Error ? testError.message : testError);
    }
    
    // check-sync-progress.tsと同じ方法でcount()を試す
    console.log('\n📊 件数カウント中...');
    try {
      const countSnapshot = await issuesRef.count().get();
      const count = countSnapshot.data().count;
      console.log(`\n✅ jiraIssuesコレクションの総件数（count()）: ${count}件\n`);
      
      // サンプルとして最初の5件を取得
      if (count > 0) {
        const sampleSnapshot = await issuesRef.limit(5).get();
        console.log('📋 サンプル（最初の5件）:');
        sampleSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log(`  - ${data.key || doc.id}: ${data.summary?.substring(0, 50) || 'N/A'}`);
        });
      }
    } catch (countError) {
      console.log('⚠️ count()が使用できないため、全件取得でカウントします...');
      console.log(`   エラー: ${countError instanceof Error ? countError.message : countError}`);
      
      // バッチ処理で全件取得（Firestoreの制限を考慮）
      console.log('📥 全ドキュメントを取得中...');
      const issueKeys = new Set<string>();
      const duplicates: string[] = [];
      const allDocs: admin.firestore.QueryDocumentSnapshot[] = [];
      let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
      const batchSize = 1000;
      let totalCount = 0;
      
      while (true) {
        let query: admin.firestore.Query = issuesRef.limit(batchSize);
        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
          break;
        }
        
        snapshot.forEach((doc) => {
          allDocs.push(doc);
          const data = doc.data();
          const key = data.key || doc.id;
          if (issueKeys.has(key)) {
            duplicates.push(key);
          } else {
            issueKeys.add(key);
          }
        });
        
        totalCount += snapshot.size;
        console.log(`  📥 取得済み: ${totalCount}件...`);
        
        if (snapshot.size < batchSize) {
          break;
        }
        
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
      }
      
      console.log(`\n✅ jiraIssuesコレクションの総件数: ${totalCount}件`);
      console.log(`🔍 ユニークなissue_key数: ${issueKeys.size}件`);
      
      if (duplicates.length > 0) {
        console.log(`⚠️  重複しているissue_key: ${duplicates.length}件`);
        console.log(`   重複キー: ${duplicates.slice(0, 10).join(', ')}${duplicates.length > 10 ? '...' : ''}`);
      } else {
        console.log('✅ 重複はありません');
      }
      
      // サンプルとして最初の5件のissue_keyを表示
      if (allDocs.length > 0) {
        console.log('\n📋 サンプル（最初の5件）:');
        allDocs.slice(0, 5).forEach((doc) => {
          const data = doc.data();
          console.log(`  - ${data.key || doc.id}: ${data.summary?.substring(0, 50) || 'N/A'}`);
        });
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    if (error instanceof Error) {
      console.error('   メッセージ:', error.message);
      console.error('   スタック:', error.stack);
    }
    process.exit(1);
  }
}

main();

