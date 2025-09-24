/**
 * 正しい同期仕様のテスト実行スクリプト
 */

import { CorrectSyncService, TestPage } from './test-correct-sync-spec';

// テスト用の10ページデータ
const testPages: TestPage[] = [
  {
    id: 'test-001',
    title: 'テストページ1 - 教室管理',
    content: '教室管理に関する基本的な機能について説明します。教室の登録、編集、削除などの操作が可能です。また、教室の詳細情報として、住所、電話番号、定員数などを管理できます。',
    lastModified: '2024-01-01T10:00:00Z',
    spaceKey: 'TEST'
  },
  {
    id: 'test-002',
    title: 'テストページ2 - 求人管理',
    content: '求人管理システムの機能について詳しく説明します。求人の投稿、編集、削除、応募管理などの機能があります。また、求人の検索機能やフィルタリング機能も提供されています。',
    lastModified: '2024-01-02T11:00:00Z',
    spaceKey: 'TEST'
  },
  {
    id: 'test-003',
    title: 'テストページ3 - 会員管理',
    content: '会員管理システムの概要を説明します。会員の登録、認証、プロフィール管理、権限管理などの機能があります。セキュリティ面での考慮事項も含めて詳しく解説します。',
    lastModified: '2024-01-03T12:00:00Z',
    spaceKey: 'TEST'
  },
  {
    id: 'test-004',
    title: 'テストページ4 - 請求管理',
    content: '請求管理システムの機能について説明します。請求書の作成、送信、支払い状況の管理、レポート生成などの機能があります。会計システムとの連携についても触れます。',
    lastModified: '2024-01-04T13:00:00Z',
    spaceKey: 'TEST'
  },
  {
    id: 'test-005',
    title: 'テストページ5 - レポート機能',
    content: '各種レポート機能について詳しく説明します。売上レポート、会員レポート、教室利用状況レポートなど、多様なレポートを生成できます。データの可視化についても解説します。',
    lastModified: '2024-01-05T14:00:00Z',
    spaceKey: 'TEST'
  },
  {
    id: 'test-006',
    title: 'テストページ6 - システム設定',
    content: 'システム全体の設定について説明します。基本設定、通知設定、セキュリティ設定、バックアップ設定など、システムの動作に影響する各種設定項目について詳しく解説します。',
    lastModified: '2024-01-06T15:00:00Z',
    spaceKey: 'TEST'
  },
  {
    id: 'test-007',
    title: 'テストページ7 - API仕様',
    content: 'システムのAPI仕様について説明します。RESTful APIの設計、認証方式、エラーハンドリング、レート制限など、APIの利用に必要な情報を提供します。',
    lastModified: '2024-01-07T16:00:00Z',
    spaceKey: 'TEST'
  },
  {
    id: 'test-008',
    title: 'テストページ8 - データベース設計',
    content: 'データベースの設計について詳しく説明します。テーブル設計、インデックス設計、正規化、パフォーマンス最適化など、データベースの効率的な運用に必要な知識を提供します。',
    lastModified: '2024-01-08T17:00:00Z',
    spaceKey: 'TEST'
  },
  {
    id: 'test-009',
    title: 'テストページ9 - セキュリティ対策',
    content: 'セキュリティ対策について説明します。認証・認可、データ暗号化、SQLインジェクション対策、XSS対策など、システムの安全性を確保するための各種対策について解説します。',
    lastModified: '2024-01-09T18:00:00Z',
    spaceKey: 'TEST'
  },
  {
    id: 'test-010',
    title: 'テストページ10 - 運用ガイド',
    content: 'システムの運用について説明します。日常的なメンテナンス、監視、ログ管理、障害対応など、システムを安定して運用するためのガイドラインを提供します。',
    lastModified: '2024-01-10T19:00:00Z',
    spaceKey: 'TEST'
  }
];

async function runCorrectSyncTest() {
  console.log('🧪 正しい同期仕様のテストを開始します...\n');

  const syncService = new CorrectSyncService();

  try {
    // 1. 初期状態を表示
    console.log('📊 テスト開始前の状態:');
    await syncService.showDatabaseStatus();

    // 2. 初回同期（全ページ追加）
    console.log('\n🔄 初回同期を実行...');
    const firstSyncResult = await syncService.syncPages(testPages);
    console.log('\n📈 初回同期結果:');
    console.log(`  追加: ${firstSyncResult.added}ページ`);
    console.log(`  更新: ${firstSyncResult.updated}ページ`);
    console.log(`  変更なし: ${firstSyncResult.unchanged}ページ`);
    console.log(`  エラー: ${firstSyncResult.errors.length}件`);

    // 3. 同期後の状態を表示
    console.log('\n📊 初回同期後の状態:');
    await syncService.showDatabaseStatus();

    // 4. 2回目同期（変更なし）
    console.log('\n🔄 2回目同期を実行（変更なし）...');
    const secondSyncResult = await syncService.syncPages(testPages);
    console.log('\n📈 2回目同期結果:');
    console.log(`  追加: ${secondSyncResult.added}ページ`);
    console.log(`  更新: ${secondSyncResult.updated}ページ`);
    console.log(`  変更なし: ${secondSyncResult.unchanged}ページ`);
    console.log(`  エラー: ${secondSyncResult.errors.length}件`);

    // 5. 更新テスト用のデータを作成
    const updatedPages: TestPage[] = testPages.map((page, index) => ({
      ...page,
      title: `${page.title} (更新版)`,
      content: `${page.content}\n\n[更新日時: ${new Date().toISOString()}]`,
      lastModified: new Date().toISOString() // 現在時刻に更新
    }));

    // 6. 3回目同期（更新あり）
    console.log('\n🔄 3回目同期を実行（更新あり）...');
    const thirdSyncResult = await syncService.syncPages(updatedPages);
    console.log('\n📈 3回目同期結果:');
    console.log(`  追加: ${thirdSyncResult.added}ページ`);
    console.log(`  更新: ${thirdSyncResult.updated}ページ`);
    console.log(`  変更なし: ${thirdSyncResult.unchanged}ページ`);
    console.log(`  エラー: ${thirdSyncResult.errors.length}件`);

    // 7. 最終状態を表示
    console.log('\n📊 最終状態:');
    await syncService.showDatabaseStatus();

    // 8. テスト結果の評価
    console.log('\n🎯 テスト結果の評価:');
    const isFirstSyncCorrect = firstSyncResult.added === 10 && firstSyncResult.updated === 0 && firstSyncResult.unchanged === 0;
    const isSecondSyncCorrect = secondSyncResult.added === 0 && secondSyncResult.updated === 0 && secondSyncResult.unchanged === 10;
    const isThirdSyncCorrect = thirdSyncResult.added === 0 && thirdSyncResult.updated === 10 && thirdSyncResult.unchanged === 0;

    console.log(`✅ 初回同期（全追加）: ${isFirstSyncCorrect ? '成功' : '失敗'}`);
    console.log(`✅ 2回目同期（変更なし）: ${isSecondSyncCorrect ? '成功' : '失敗'}`);
    console.log(`✅ 3回目同期（全更新）: ${isThirdSyncCorrect ? '成功' : '失敗'}`);

    const allTestsPassed = isFirstSyncCorrect && isSecondSyncCorrect && isThirdSyncCorrect;
    console.log(`\n🎉 全体結果: ${allTestsPassed ? 'すべてのテストが成功しました！' : '一部のテストが失敗しました。'}`);

  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
  }
}

// スクリプト実行
if (require.main === module) {
  runCorrectSyncTest();
}

export { runCorrectSyncTest };
