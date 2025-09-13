// テスト用のモックデータ

import { Message } from '@/types';

// モックメッセージデータ
export const mockMessages: Message[] = [
  {
    id: '1',
    content: '求人詳細機能の仕様について教えてください',
    role: 'user',
    createdAt: '2023-10-01T10:00:00Z',
    userId: 'mock-user-123',
    user: {
      uid: 'mock-user-123',
      displayName: 'テストユーザー',
      email: 'test@example.com',
      photoURL: 'https://via.placeholder.com/150',
    }
  },
  {
    id: '2',
    content: '求人詳細機能は、主に以下の3つの主要コンポーネントで構成されています：\n\n1. 求人情報の表示エリア\n2. 応募ボタンと関連アクション\n3. 関連求人の表示セクション\n\n求人情報の表示エリアでは、職種、勤務地、給与、必要スキルなどの基本情報が表示されます。応募ボタンは画面上部と下部の両方に配置され、クリックするとアプリケーションフォームに遷移します。関連求人セクションでは、類似の職種や同じ企業の他の求人が表示されます。',
    role: 'assistant',
    createdAt: '2023-10-01T10:00:30Z',
    userId: 'mock-user-123',
    sources: [
      {
        title: '[PROJ-123] 求人詳細画面仕様書',
        url: 'https://example.atlassian.net/wiki/spaces/PROJ/pages/123456/job-detail-spec'
      },
      {
        title: '[ARCH-45] 求人データモデル定義',
        url: 'https://example.atlassian.net/wiki/spaces/ARCH/pages/45678/job-data-model'
      }
    ]
  },
  {
    id: '3',
    content: '応募ボタンを押した後のフローはどうなっていますか？',
    role: 'user',
    createdAt: '2023-10-01T10:05:00Z',
    userId: 'mock-user-123',
    user: {
      uid: 'mock-user-123',
      displayName: 'テストユーザー',
      email: 'test@example.com',
      photoURL: 'https://via.placeholder.com/150',
    }
  },
  {
    id: '4',
    content: '応募ボタンを押した後のフローは以下のようになっています：\n\n1. ユーザー認証チェック\n   - 未ログインの場合は、ログイン画面に遷移\n   - ログイン済みの場合は、次のステップへ\n\n2. 応募フォーム画面\n   - 基本情報（氏名、連絡先など）は自動入力\n   - 職務経歴、自己PR、志望動機などを入力\n   - 添付書類（履歴書、職務経歴書）のアップロード\n\n3. 確認画面\n   - 入力内容の最終確認\n   - プライバシーポリシーと利用規約への同意\n\n4. 完了画面\n   - 応募完了メッセージの表示\n   - 応募履歴への遷移リンク\n   - 関連求人の表示\n\nこのフローは「シングルページアプリケーション」として実装され、ユーザーの離脱を防ぐために画面遷移を最小限に抑えています。',
    role: 'assistant',
    createdAt: '2023-10-01T10:05:30Z',
    userId: 'mock-user-123',
    sources: [
      {
        title: '[FLOW-78] 応募フロー設計書',
        url: 'https://example.atlassian.net/wiki/spaces/FLOW/pages/78901/application-flow'
      }
    ]
  }
];

// モックチャット履歴データ
export const mockChatHistory = [
  {
    id: 'chat-1',
    title: '求人詳細機能の仕様について',
    createdAt: '2023-10-01T10:00:00Z',
    updatedAt: '2023-10-01T10:05:30Z',
    userId: 'mock-user-123'
  },
  {
    id: 'chat-2',
    title: 'ログイン認証の仕組みについて',
    createdAt: '2023-09-28T14:30:00Z',
    updatedAt: '2023-09-28T14:35:20Z',
    userId: 'mock-user-123'
  },
  {
    id: 'chat-3',
    title: 'データベースのスキーマ構造について',
    createdAt: '2023-09-25T09:15:00Z',
    updatedAt: '2023-09-25T09:20:45Z',
    userId: 'mock-user-123'
  }
];
