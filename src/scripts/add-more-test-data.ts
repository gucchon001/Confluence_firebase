/**
 * テスト用データの追加
 * 
 * 50レコードのテストデータをLanceDBに追加する
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

/**
 * テスト用データの追加
 */
async function addMoreTestData(): Promise<void> {
  console.log('📊 テスト用データの追加（50レコード目標）');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    // 1. 現在のデータ状況の確認
    console.log(`\n=== 1. 現在のデータ状況 ===`);
    const currentCount = await tbl.countRows();
    console.log(`現在のレコード数: ${currentCount}`);
    
    // 2. テストデータの準備
    console.log(`\n=== 2. テストデータの準備 ===`);
    
    const testData = [
      // 教室管理関連
      {
        id: 'classroom-001',
        pageId: 100001,
        title: '教室管理機能の詳細',
        spaceKey: 'SYSTEM',
        lastUpdated: '2024-01-01T00:00:00.000Z',
        chunkIndex: 0,
        content: '教室管理機能では、教室の登録、編集、削除、一覧表示が可能です。教室情報には、教室名、住所、電話番号、担当者情報が含まれます。',
        labels: ['教室管理', '機能']
      },
      {
        id: 'classroom-002',
        pageId: 100002,
        title: '教室登録・公開・削除フロー',
        spaceKey: 'SYSTEM',
        lastUpdated: '2024-01-02T00:00:00.000Z',
        chunkIndex: 0,
        content: '教室の登録から公開、削除までの一連のフローについて説明します。登録時には必須項目の入力が必要で、公開後は編集が制限されます。',
        labels: ['教室管理', 'フロー']
      },
      {
        id: 'classroom-003',
        pageId: 100003,
        title: '教室管理ページの操作方法',
        spaceKey: 'MANUAL',
        lastUpdated: '2024-01-03T00:00:00.000Z',
        chunkIndex: 0,
        content: '教室管理ページでの操作方法を詳しく説明します。検索機能、フィルタリング、一括操作などの使い方を学べます。',
        labels: ['教室管理', 'マニュアル']
      },
      
      // ユーザー登録関連
      {
        id: 'user-001',
        pageId: 200001,
        title: 'ユーザー登録・退会フロー',
        spaceKey: 'SYSTEM',
        lastUpdated: '2024-01-04T00:00:00.000Z',
        chunkIndex: 0,
        content: 'ユーザーの登録から退会までの手順を説明します。メール認証、パスワード設定、プロフィール入力などの詳細な流れを記載しています。',
        labels: ['ユーザー管理', 'フロー']
      },
      {
        id: 'user-002',
        pageId: 200002,
        title: 'ユーザー登録機能の仕様',
        spaceKey: 'SPEC',
        lastUpdated: '2024-01-05T00:00:00.000Z',
        chunkIndex: 0,
        content: 'ユーザー登録機能の技術仕様について詳しく説明します。バリデーション、セキュリティ、データベース設計などの詳細を記載しています。',
        labels: ['ユーザー管理', '仕様']
      },
      
      // 契約管理関連
      {
        id: 'contract-001',
        pageId: 300001,
        title: 'クライアント企業契約・登録・更新・契約終了フロー',
        spaceKey: 'SYSTEM',
        lastUpdated: '2024-01-06T00:00:00.000Z',
        chunkIndex: 0,
        content: 'クライアント企業との契約管理について説明します。契約の登録、更新、終了の各プロセスと必要な手続きを詳しく記載しています。',
        labels: ['契約管理', 'フロー']
      },
      {
        id: 'contract-002',
        pageId: 300002,
        title: '契約管理機能の詳細',
        spaceKey: 'SYSTEM',
        lastUpdated: '2024-01-07T00:00:00.000Z',
        chunkIndex: 0,
        content: '契約管理機能の詳細な操作方法を説明します。契約情報の検索、編集、履歴確認、レポート出力などの機能について記載しています。',
        labels: ['契約管理', '機能']
      },
      
      // 採用フロー関連
      {
        id: 'recruitment-001',
        pageId: 400001,
        title: 'オファー・応募・選考・採用フロー',
        spaceKey: 'SYSTEM',
        lastUpdated: '2024-01-08T00:00:00.000Z',
        chunkIndex: 0,
        content: 'オファーから応募、選考、採用までの一連のフローについて説明します。各段階での必要な手続きと注意点を詳しく記載しています。',
        labels: ['採用管理', 'フロー']
      },
      {
        id: 'recruitment-002',
        pageId: 400002,
        title: '採用管理機能の使い方',
        spaceKey: 'MANUAL',
        lastUpdated: '2024-01-09T00:00:00.000Z',
        chunkIndex: 0,
        content: '採用管理機能の使い方を詳しく説明します。応募者の管理、選考プロセスの進行、採用決定までの流れを学べます。',
        labels: ['採用管理', 'マニュアル']
      },
      
      // メール通知関連
      {
        id: 'email-001',
        pageId: 500001,
        title: 'メール通知機能の設定',
        spaceKey: 'SYSTEM',
        lastUpdated: '2024-01-10T00:00:00.000Z',
        chunkIndex: 0,
        content: 'メール通知機能の設定方法を説明します。通知の種類、送信タイミング、テンプレートの設定などについて詳しく記載しています。',
        labels: ['メール通知', '設定']
      },
      {
        id: 'email-002',
        pageId: 500002,
        title: 'メール通知履歴の確認方法',
        spaceKey: 'MANUAL',
        lastUpdated: '2024-01-11T00:00:00.000Z',
        chunkIndex: 0,
        content: 'メール通知の履歴を確認する方法を説明します。送信済みメールの一覧表示、詳細確認、再送信などの操作方法を学べます。',
        labels: ['メール通知', '履歴']
      },
      
      // その他の機能
      {
        id: 'other-001',
        pageId: 600001,
        title: 'システム設定の基本操作',
        spaceKey: 'MANUAL',
        lastUpdated: '2024-01-12T00:00:00.000Z',
        chunkIndex: 0,
        content: 'システム設定の基本操作について説明します。各種パラメータの設定、権限管理、システムメンテナンスなどの操作方法を記載しています。',
        labels: ['システム設定', '基本操作']
      },
      {
        id: 'other-002',
        pageId: 600002,
        title: 'レポート機能の使い方',
        spaceKey: 'MANUAL',
        lastUpdated: '2024-01-13T00:00:00.000Z',
        chunkIndex: 0,
        content: 'レポート機能の使い方を詳しく説明します。各種レポートの生成、出力形式の選択、スケジュール設定などの操作方法を学べます。',
        labels: ['レポート', '機能']
      },
      {
        id: 'other-003',
        pageId: 600003,
        title: 'データバックアップとリストア',
        spaceKey: 'SYSTEM',
        lastUpdated: '2024-01-14T00:00:00.000Z',
        chunkIndex: 0,
        content: 'データのバックアップとリストアの手順を説明します。定期バックアップの設定、手動バックアップの実行、リストア手順などを詳しく記載しています。',
        labels: ['データ管理', 'バックアップ']
      },
      {
        id: 'other-004',
        pageId: 600004,
        title: 'セキュリティ設定の管理',
        spaceKey: 'SECURITY',
        lastUpdated: '2024-01-15T00:00:00.000Z',
        chunkIndex: 0,
        content: 'セキュリティ設定の管理方法を説明します。パスワードポリシー、アクセス制御、ログ監視などの設定について詳しく記載しています。',
        labels: ['セキュリティ', '設定']
      },
      {
        id: 'other-005',
        pageId: 600005,
        title: 'API連携の設定方法',
        spaceKey: 'TECHNICAL',
        lastUpdated: '2024-01-16T00:00:00.000Z',
        chunkIndex: 0,
        content: '外部システムとのAPI連携の設定方法を説明します。認証設定、エンドポイント設定、データマッピングなどの技術的な詳細を記載しています。',
        labels: ['API', '連携']
      }
    ];
    
    // 3. 埋め込み生成とデータ挿入
    console.log(`\n=== 3. 埋め込み生成とデータ挿入 ===`);
    
    const processedData = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const record of testData) {
      try {
        console.log(`\n--- レコード処理: ${record.title} ---`);
        
        // 埋め込み生成
        const content = record.content || record.title || 'No content';
        const embedding = await getEmbeddings(content);
        
        console.log(`✅ 埋め込み生成成功: ${embedding.length}次元`);
        
        // データ準備（既存スキーマに合わせる）
        const processedRecord = {
          id: record.id,
          pageId: record.pageId,
          title: record.title,
          lastUpdated: record.lastUpdated,
          chunkIndex: record.chunkIndex,
          content: record.content,
          labels: record.labels,
          vector: new Float32Array(embedding)
        };
        
        processedData.push(processedRecord);
        successCount++;
        
        // 進捗表示
        if (processedData.length % 5 === 0) {
          console.log(`\n📊 進捗: ${processedData.length}/${testData.length} (${(processedData.length / testData.length * 100).toFixed(1)}%)`);
        }
        
      } catch (error) {
        console.error(`❌ レコード ${record.id} の処理エラー:`, error);
        errorCount++;
      }
    }
    
    // 4. データの挿入
    console.log(`\n=== 4. データの挿入 ===`);
    
    if (processedData.length > 0) {
      await tbl.add(processedData);
      console.log(`✅ ${processedData.length}件のレコードを挿入しました`);
    } else {
      console.log('⚠️ 挿入するデータがありません');
    }
    
    // 5. 最終確認
    console.log(`\n=== 5. 最終確認 ===`);
    
    const finalCount = await tbl.countRows();
    console.log(`最終レコード数: ${finalCount}`);
    console.log(`追加されたレコード数: ${finalCount - currentCount}`);
    console.log(`成功: ${successCount}件`);
    console.log(`エラー: ${errorCount}件`);
    
    // 6. サンプルレコードの確認
    console.log(`\n=== 6. サンプルレコードの確認 ===`);
    
    const sampleRecords = await tbl.query().limit(3).toArray();
    for (const record of sampleRecords) {
      console.log(`\n--- レコード確認 ---`);
      console.log(`ID: ${record.id}`);
      console.log(`タイトル: ${record.title}`);
      console.log(`コンテンツ長: ${record.content?.length || 0}文字`);
      
      const vector = record.vector?.toArray ? record.vector.toArray() : record.vector;
      if (vector && Array.isArray(vector)) {
        console.log(`✅ ベクトル次元数: ${vector.length}`);
        console.log(`ベクトル範囲: ${Math.min(...vector).toFixed(4)} ～ ${Math.max(...vector).toFixed(4)}`);
      } else {
        console.log('❌ ベクトルが存在しません');
      }
    }
    
  } catch (error) {
    console.error('❌ データ追加エラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ テスト用データの追加完了');
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  try {
    await addMoreTestData();
  } catch (error) {
    console.error('❌ 実行エラー:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

export { addMoreTestData };
