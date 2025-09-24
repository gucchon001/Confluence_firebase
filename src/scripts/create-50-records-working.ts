/**
 * 50レコードの動作するテーブルを作成
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

async function create50RecordsWorking(): Promise<void> {
  console.log('🏗️ 50レコードの動作するテーブルを作成');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    
    // 1. 既存テーブルの削除
    console.log(`\n=== 1. 既存テーブルの削除 ===`);
    try {
      await db.dropTable('confluence');
      console.log('✅ 既存テーブルを削除しました');
    } catch (error) {
      console.log('⚠️ テーブルが存在しないか、削除に失敗しました:', error);
    }
    
    // 2. テストデータの準備
    console.log(`\n=== 2. テストデータの準備 ===`);
    
    const testData = [
      // 教室管理関連（10レコード）
      { id: 'classroom-001', pageId: 100001, title: '教室管理機能の詳細', content: '教室管理機能では、教室の登録、編集、削除、一覧表示が可能です。教室情報には、教室名、住所、電話番号、担当者情報が含まれます。', labels: ['教室管理', '機能'] },
      { id: 'classroom-002', pageId: 100002, title: '教室登録・公開・削除フロー', content: '教室の登録から公開、削除までの一連のフローについて説明します。登録時には必須項目の入力が必要で、公開後は編集が制限されます。', labels: ['教室管理', 'フロー'] },
      { id: 'classroom-003', pageId: 100003, title: '教室管理ページの操作方法', content: '教室管理ページでの操作方法を詳しく説明します。検索機能、フィルタリング、一括操作などの使い方を学べます。', labels: ['教室管理', 'マニュアル'] },
      { id: 'classroom-004', pageId: 100004, title: '教室情報の編集方法', content: '教室情報の編集方法について詳しく説明します。各項目の編集手順、バリデーション、保存方法などを記載しています。', labels: ['教室管理', '編集'] },
      { id: 'classroom-005', pageId: 100005, title: '教室一覧の表示と検索', content: '教室一覧の表示方法と検索機能について説明します。フィルタリング、ソート、ページネーションなどの機能を学べます。', labels: ['教室管理', '一覧'] },
      { id: 'classroom-006', pageId: 100006, title: '教室の削除手順', content: '教室の削除手順について詳しく説明します。削除前の確認事項、削除後の影響、復元方法などを記載しています。', labels: ['教室管理', '削除'] },
      { id: 'classroom-007', pageId: 100007, title: '教室管理の権限設定', content: '教室管理の権限設定について説明します。管理者権限、編集権限、閲覧権限などの設定方法を学べます。', labels: ['教室管理', '権限'] },
      { id: 'classroom-008', pageId: 100008, title: '教室データのエクスポート', content: '教室データのエクスポート機能について説明します。CSV形式、Excel形式での出力方法を詳しく記載しています。', labels: ['教室管理', 'エクスポート'] },
      { id: 'classroom-009', pageId: 100009, title: '教室管理のバックアップ', content: '教室管理データのバックアップ方法について説明します。定期バックアップの設定、手動バックアップの実行方法を学べます。', labels: ['教室管理', 'バックアップ'] },
      { id: 'classroom-010', pageId: 100010, title: '教室管理のトラブルシューティング', content: '教室管理で発生する可能性のある問題とその解決方法について説明します。よくあるエラーと対処法を記載しています。', labels: ['教室管理', 'トラブル'] },
      
      // ユーザー管理関連（10レコード）
      { id: 'user-001', pageId: 200001, title: 'ユーザー登録・退会フロー', content: 'ユーザーの登録から退会までの手順を説明します。メール認証、パスワード設定、プロフィール入力などの詳細な流れを記載しています。', labels: ['ユーザー管理', 'フロー'] },
      { id: 'user-002', pageId: 200002, title: 'ユーザー登録機能の仕様', content: 'ユーザー登録機能の技術仕様について詳しく説明します。バリデーション、セキュリティ、データベース設計などの詳細を記載しています。', labels: ['ユーザー管理', '仕様'] },
      { id: 'user-003', pageId: 200003, title: 'ユーザー情報の編集', content: 'ユーザー情報の編集方法について詳しく説明します。プロフィール更新、パスワード変更、メールアドレス変更などの手順を学べます。', labels: ['ユーザー管理', '編集'] },
      { id: 'user-004', pageId: 200004, title: 'ユーザー一覧の管理', content: 'ユーザー一覧の管理方法について説明します。検索、フィルタリング、一括操作、権限設定などの機能を詳しく記載しています。', labels: ['ユーザー管理', '一覧'] },
      { id: 'user-005', pageId: 200005, title: 'ユーザー権限の設定', content: 'ユーザー権限の設定方法について詳しく説明します。ロールベースのアクセス制御、個別権限設定などを学べます。', labels: ['ユーザー管理', '権限'] },
      { id: 'user-006', pageId: 200006, title: 'ユーザー認証の仕組み', content: 'ユーザー認証の仕組みについて説明します。ログイン認証、セッション管理、セキュリティ対策などの詳細を記載しています。', labels: ['ユーザー管理', '認証'] },
      { id: 'user-007', pageId: 200007, title: 'ユーザー活動ログの確認', content: 'ユーザーの活動ログの確認方法について説明します。ログイン履歴、操作履歴、アクセス記録などの確認方法を学べます。', labels: ['ユーザー管理', 'ログ'] },
      { id: 'user-008', pageId: 200008, title: 'ユーザーアカウントの無効化', content: 'ユーザーアカウントの無効化手順について詳しく説明します。一時的な無効化、永続的な無効化、復元方法などを記載しています。', labels: ['ユーザー管理', '無効化'] },
      { id: 'user-009', pageId: 200009, title: 'ユーザーデータの削除', content: 'ユーザーデータの削除手順について説明します。個人情報の削除、関連データの処理、法的要件の遵守などを学べます。', labels: ['ユーザー管理', '削除'] },
      { id: 'user-010', pageId: 200010, title: 'ユーザー管理のセキュリティ', content: 'ユーザー管理におけるセキュリティ対策について説明します。パスワードポリシー、二要素認証、不正アクセス対策などを詳しく記載しています。', labels: ['ユーザー管理', 'セキュリティ'] },
      
      // 契約管理関連（10レコード）
      { id: 'contract-001', pageId: 300001, title: 'クライアント企業契約・登録・更新・契約終了フロー', content: 'クライアント企業との契約管理について説明します。契約の登録、更新、終了の各プロセスと必要な手続きを詳しく記載しています。', labels: ['契約管理', 'フロー'] },
      { id: 'contract-002', pageId: 300002, title: '契約管理機能の詳細', content: '契約管理機能の詳細な操作方法を説明します。契約情報の検索、編集、履歴確認、レポート出力などの機能について記載しています。', labels: ['契約管理', '機能'] },
      { id: 'contract-003', pageId: 300003, title: '契約書の作成と管理', content: '契約書の作成と管理方法について詳しく説明します。テンプレートの使用、カスタマイズ、承認フローなどを学べます。', labels: ['契約管理', '契約書'] },
      { id: 'contract-004', pageId: 300004, title: '契約更新の手順', content: '契約更新の手順について説明します。更新タイミングの管理、更新条件の確認、更新手続きの実行方法を詳しく記載しています。', labels: ['契約管理', '更新'] },
      { id: 'contract-005', pageId: 300005, title: '契約終了の処理', content: '契約終了の処理方法について詳しく説明します。終了手続き、清算処理、関連データの処理などを学べます。', labels: ['契約管理', '終了'] },
      { id: 'contract-006', pageId: 300006, title: '契約履歴の管理', content: '契約履歴の管理方法について説明します。履歴の記録、確認、分析、レポート作成などの機能を詳しく記載しています。', labels: ['契約管理', '履歴'] },
      { id: 'contract-007', pageId: 300007, title: '契約条件の変更', content: '契約条件の変更手順について詳しく説明します。変更申請、承認プロセス、変更履歴の管理などを学べます。', labels: ['契約管理', '変更'] },
      { id: 'contract-008', pageId: 300008, title: '契約データのバックアップ', content: '契約データのバックアップ方法について説明します。定期バックアップの設定、手動バックアップの実行、復元手順を詳しく記載しています。', labels: ['契約管理', 'バックアップ'] },
      { id: 'contract-009', pageId: 300009, title: '契約管理の権限設定', content: '契約管理の権限設定について詳しく説明します。閲覧権限、編集権限、承認権限などの設定方法を学べます。', labels: ['契約管理', '権限'] },
      { id: 'contract-010', pageId: 300010, title: '契約管理のレポート機能', content: '契約管理のレポート機能について説明します。契約一覧、更新予定、終了予定などのレポート作成方法を詳しく記載しています。', labels: ['契約管理', 'レポート'] },
      
      // 採用管理関連（10レコード）
      { id: 'recruitment-001', pageId: 400001, title: 'オファー・応募・選考・採用フロー', content: 'オファーから応募、選考、採用までの一連のフローについて説明します。各段階での必要な手続きと注意点を詳しく記載しています。', labels: ['採用管理', 'フロー'] },
      { id: 'recruitment-002', pageId: 400002, title: '採用管理機能の使い方', content: '採用管理機能の使い方を詳しく説明します。応募者の管理、選考プロセスの進行、採用決定までの流れを学べます。', labels: ['採用管理', 'マニュアル'] },
      { id: 'recruitment-003', pageId: 400003, title: '応募者の管理方法', content: '応募者の管理方法について詳しく説明します。応募情報の登録、選考状況の更新、結果の記録などを学べます。', labels: ['採用管理', '応募者'] },
      { id: 'recruitment-004', pageId: 400004, title: '選考プロセスの管理', content: '選考プロセスの管理方法について説明します。面接日程の調整、評価の記録、合否の決定などの手順を詳しく記載しています。', labels: ['採用管理', '選考'] },
      { id: 'recruitment-005', pageId: 400005, title: '採用決定の手順', content: '採用決定の手順について詳しく説明します。最終面接、内定通知、入社手続きなどの流れを学べます。', labels: ['採用管理', '決定'] },
      { id: 'recruitment-006', pageId: 400006, title: '採用データの分析', content: '採用データの分析方法について説明します。応募者数、選考通過率、採用率などの分析手法を詳しく記載しています。', labels: ['採用管理', '分析'] },
      { id: 'recruitment-007', pageId: 400007, title: '採用レポートの作成', content: '採用レポートの作成方法について詳しく説明します。月次レポート、年次レポート、部門別レポートなどの作成手順を学べます。', labels: ['採用管理', 'レポート'] },
      { id: 'recruitment-008', pageId: 400008, title: '採用管理の権限設定', content: '採用管理の権限設定について説明します。人事部、部門管理者、面接官などの権限設定方法を詳しく記載しています。', labels: ['採用管理', '権限'] },
      { id: 'recruitment-009', pageId: 400009, title: '採用データのバックアップ', content: '採用データのバックアップ方法について詳しく説明します。定期バックアップの設定、手動バックアップの実行、復元手順を学べます。', labels: ['採用管理', 'バックアップ'] },
      { id: 'recruitment-010', pageId: 400010, title: '採用管理のトラブルシューティング', content: '採用管理で発生する可能性のある問題とその解決方法について説明します。よくあるエラーと対処法を詳しく記載しています。', labels: ['採用管理', 'トラブル'] },
      
      // メール通知関連（10レコード）
      { id: 'email-001', pageId: 500001, title: 'メール通知機能の設定', content: 'メール通知機能の設定方法を説明します。通知の種類、送信タイミング、テンプレートの設定などについて詳しく記載しています。', labels: ['メール通知', '設定'] },
      { id: 'email-002', pageId: 500002, title: 'メール通知履歴の確認方法', content: 'メール通知の履歴を確認する方法を説明します。送信済みメールの一覧表示、詳細確認、再送信などの操作方法を学べます。', labels: ['メール通知', '履歴'] },
      { id: 'email-003', pageId: 500003, title: 'メールテンプレートの管理', content: 'メールテンプレートの管理方法について詳しく説明します。テンプレートの作成、編集、削除、適用などの手順を学べます。', labels: ['メール通知', 'テンプレート'] },
      { id: 'email-004', pageId: 500004, title: 'メール送信のスケジュール設定', content: 'メール送信のスケジュール設定について説明します。定期送信、一括送信、条件付き送信などの設定方法を詳しく記載しています。', labels: ['メール通知', 'スケジュール'] },
      { id: 'email-005', pageId: 500005, title: 'メール通知の配信状況確認', content: 'メール通知の配信状況確認方法について詳しく説明します。送信成功、失敗、開封状況などの確認方法を学べます。', labels: ['メール通知', '配信状況'] },
      { id: 'email-006', pageId: 500006, title: 'メール通知のエラー処理', content: 'メール通知のエラー処理について説明します。送信失敗の原因、再送信手順、エラーログの確認などを詳しく記載しています。', labels: ['メール通知', 'エラー'] },
      { id: 'email-007', pageId: 500007, title: 'メール通知の権限管理', content: 'メール通知の権限管理について詳しく説明します。送信権限、テンプレート編集権限、履歴閲覧権限などの設定方法を学べます。', labels: ['メール通知', '権限'] },
      { id: 'email-008', pageId: 500008, title: 'メール通知のセキュリティ', content: 'メール通知のセキュリティ対策について説明します。スパム対策、認証設定、暗号化などのセキュリティ機能を詳しく記載しています。', labels: ['メール通知', 'セキュリティ'] },
      { id: 'email-009', pageId: 500009, title: 'メール通知のバックアップ', content: 'メール通知データのバックアップ方法について詳しく説明します。テンプレート、履歴、設定のバックアップ手順を学べます。', labels: ['メール通知', 'バックアップ'] },
      { id: 'email-010', pageId: 500010, title: 'メール通知のトラブルシューティング', content: 'メール通知で発生する可能性のある問題とその解決方法について説明します。よくあるエラーと対処法を詳しく記載しています。', labels: ['メール通知', 'トラブル'] }
    ];
    
    // 3. 埋め込み生成とデータ準備
    console.log(`\n=== 3. 埋め込み生成とデータ準備 ===`);
    
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
        
        // データ準備
        const processedRecord = {
          id: record.id,
          pageId: record.pageId,
          title: record.title,
          lastUpdated: new Date().toISOString(),
          chunkIndex: 0,
          content: record.content,
          labels: record.labels,
          vector: embedding // 配列として保存
        };
        
        processedData.push(processedRecord);
        successCount++;
        
        // 進捗表示
        if (processedData.length % 10 === 0) {
          console.log(`\n📊 進捗: ${processedData.length}/${testData.length} (${(processedData.length / testData.length * 100).toFixed(1)}%)`);
        }
        
      } catch (error) {
        console.error(`❌ レコード ${record.id} の処理エラー:`, error);
        errorCount++;
      }
    }
    
    // 4. テーブルの作成
    console.log(`\n=== 4. テーブルの作成 ===`);
    
    const tbl = await db.createTable('confluence', processedData);
    console.log(`✅ ${processedData.length}件のレコードでテーブルを作成しました`);
    
    // 5. 最終確認
    console.log(`\n=== 5. 最終確認 ===`);
    
    const finalCount = await tbl.countRows();
    console.log(`最終レコード数: ${finalCount}`);
    console.log(`成功: ${successCount}件`);
    console.log(`エラー: ${errorCount}件`);
    
    // 6. ベクトル検索のテスト
    console.log(`\n=== 6. ベクトル検索のテスト ===`);
    
    try {
      const queryEmbedding = await getEmbeddings('教室管理');
      console.log(`✅ クエリ埋め込み生成成功: ${queryEmbedding.length}次元`);
      
      const searchResults = await tbl.search(queryEmbedding).limit(5).toArray();
      console.log(`✅ ベクトル検索成功: ${searchResults.length}件の結果`);
      
      for (const result of searchResults) {
        console.log(`\n--- 検索結果 ---`);
        console.log(`タイトル: ${result.title}`);
        console.log(`距離: ${result._distance?.toFixed(4) || 'N/A'}`);
      }
      
    } catch (error) {
      console.error('❌ ベクトル検索エラー:', error);
    }
    
  } catch (error) {
    console.error('❌ テーブル作成エラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 50レコードの動作するテーブル作成完了');
}

if (require.main === module) {
  create50RecordsWorking();
}

export { create50RecordsWorking };
