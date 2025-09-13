// RAG評価用の質問セット

export interface EvaluationQuestion {
  id: string;
  question: string;
  category: string;
  expectedTopics: string[];  // 回答に含まれることが期待されるトピック
  relatedDocs?: string[];     // 関連するドキュメントID（あれば）
}

export const evaluationQuestions: EvaluationQuestion[] = [
  // 認証・ログイン関連
  {
    id: 'auth-1',
    question: 'ログイン認証の仕組みはどうなっていますか？',
    category: '認証',
    expectedTopics: ['Firebase Authentication', 'Googleアカウント', 'IDトークン', 'セッション管理']
  },
  {
    id: 'auth-2',
    question: 'パスワードリセット機能の実装方法を教えてください',
    category: '認証',
    expectedTopics: ['パスワードリセット', 'メール送信', 'トークン', 'セキュリティ']
  },
  
  // UI/UX関連
  {
    id: 'ui-1',
    question: '求人詳細画面の仕様について教えてください',
    category: 'UI/UX',
    expectedTopics: ['求人情報表示', '応募ボタン', 'レイアウト', 'モバイル対応']
  },
  {
    id: 'ui-2',
    question: 'モバイル版とデスクトップ版の違いは何ですか？',
    category: 'UI/UX',
    expectedTopics: ['レスポンシブデザイン', 'ブレークポイント', 'UI差分', 'タッチ操作']
  },
  
  // データモデル関連
  {
    id: 'data-1',
    question: 'ユーザー登録時の必須項目は何ですか？',
    category: 'データモデル',
    expectedTopics: ['必須フィールド', 'メールアドレス', 'プロフィール', 'バリデーション']
  },
  {
    id: 'data-2',
    question: 'データベースのスキーマ構造はどうなっていますか？',
    category: 'データモデル',
    expectedTopics: ['テーブル構造', 'リレーション', '主キー', 'インデックス']
  },
  
  // API関連
  {
    id: 'api-1',
    question: 'API認証の方式について説明してください',
    category: 'API',
    expectedTopics: ['認証方式', 'トークン', 'APIキー', 'OAuth']
  },
  {
    id: 'api-2',
    question: 'エラーハンドリングの実装方法を教えてください',
    category: 'API',
    expectedTopics: ['エラーコード', 'HTTPステータス', 'エラーメッセージ', 'リトライ']
  },
  
  // 機能関連
  {
    id: 'feature-1',
    question: '管理者権限でできることを教えてください',
    category: '機能',
    expectedTopics: ['管理機能', '権限管理', 'ユーザー管理', 'コンテンツ管理']
  },
  {
    id: 'feature-2',
    question: '通知機能の仕様について教えてください',
    category: '機能',
    expectedTopics: ['通知タイプ', 'プッシュ通知', 'メール通知', '通知設定']
  },
  {
    id: 'feature-3',
    question: '検索機能の実装方法は？',
    category: '機能',
    expectedTopics: ['検索アルゴリズム', 'フィルタリング', 'ソート', '全文検索']
  },
  
  // パフォーマンス関連
  {
    id: 'perf-1',
    question: 'ページの読み込み速度を改善する方法は？',
    category: 'パフォーマンス',
    expectedTopics: ['最適化', 'キャッシュ', 'CDN', '画像圧縮']
  },
  
  // セキュリティ関連
  {
    id: 'security-1',
    question: 'セキュリティ対策について教えてください',
    category: 'セキュリティ',
    expectedTopics: ['認証', '暗号化', 'HTTPS', 'CSRF対策']
  },
  
  // アーキテクチャ関連
  {
    id: 'arch-1',
    question: 'システムアーキテクチャの全体像を説明してください',
    category: 'アーキテクチャ',
    expectedTopics: ['フロントエンド', 'バックエンド', 'データベース', 'インフラ']
  },
  {
    id: 'arch-2',
    question: 'マイクロサービスの構成はどうなっていますか？',
    category: 'アーキテクチャ',
    expectedTopics: ['サービス分割', 'API Gateway', 'サービス間通信', 'コンテナ']
  },
  
  // デプロイメント関連
  {
    id: 'deploy-1',
    question: 'デプロイメントプロセスについて説明してください',
    category: 'デプロイメント',
    expectedTopics: ['CI/CD', 'ビルド', 'テスト', 'リリース']
  },
  
  // ビジネスロジック関連
  {
    id: 'business-1',
    question: '決済システムの実装はどうなっていますか？',
    category: 'ビジネスロジック',
    expectedTopics: ['決済フロー', '決済プロバイダー', 'セキュリティ', 'エラー処理']
  },
  {
    id: 'business-2',
    question: 'ポイントシステムの仕組みを教えてください',
    category: 'ビジネスロジック',
    expectedTopics: ['ポイント計算', '有効期限', '付与条件', '利用制限']
  },
  
  // 統合関連
  {
    id: 'integration-1',
    question: '外部サービスとの連携方法は？',
    category: '統合',
    expectedTopics: ['API連携', 'Webhook', '認証', 'データ同期']
  },
  
  // モニタリング関連
  {
    id: 'monitoring-1',
    question: 'ログ監視の仕組みについて教えてください',
    category: 'モニタリング',
    expectedTopics: ['ログ収集', '監視ツール', 'アラート', 'ダッシュボード']
  }
];
