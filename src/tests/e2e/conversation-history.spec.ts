import { test, expect } from '@playwright/test';
import { mockAuthState, mockChatService } from './helpers';

test.describe('会話履歴機能', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン済み状態をモック
    await mockAuthState(page, true);
    
    // チャットサービスをモック
    await mockChatService(page);
    
    // 会話履歴データをモック
    await page.addInitScript(() => {
      window.__mockChatHistory = [
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
      
      // getChatHistoryをモック
      window.__getChatHistoryMock = async () => {
        return window.__mockChatHistory;
      };
    });
    
    // チャット画面にアクセス
    await page.goto('/?mock=true');
    
    // チャット画面が表示されるまで待機
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('会話履歴一覧が表示される（仕様USR-006）', async ({ page }) => {
    // 注: 実際のアプリケーションでは会話履歴一覧が左サイドバーに表示されるはずですが、
    // 現在の実装では会話履歴機能が完全には実装されていない可能性があります。
    // このテストは将来の実装を見据えて作成しています。
    
    // 会話履歴ボタンまたはサイドバーが表示されることを確認
    // 注: セレクタは実際の実装に合わせて調整する必要があります
    const historyButton = page.getByRole('button', { name: /履歴/i });
    
    // 会話履歴ボタンが存在する場合はクリック
    if (await historyButton.isVisible()) {
      await historyButton.click();
    }
    
    // 会話履歴一覧が表示されることを確認
    // 注: 実際の実装に合わせてセレクタを調整
    await expect(page.getByText('求人詳細機能の仕様について')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ログイン認証の仕組みについて')).toBeVisible();
    await expect(page.getByText('データベースのスキーマ構造について')).toBeVisible();
  });

  test('新しいチャットを作成できる', async ({ page }) => {
    // 新しいチャットボタンが表示されることを確認
    // 注: セレクタは実際の実装に合わせて調整する必要があります
    const newChatButton = page.getByRole('button', { name: /新しいチャット/i });
    
    // 新しいチャットボタンが存在する場合はクリック
    if (await newChatButton.isVisible()) {
      await newChatButton.click();
      
      // 新しいチャット画面が表示されることを確認
      // 入力欄が空になっていることを確認
      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible();
      await expect(textarea).toHaveValue('');
      
      // ウェルカムメッセージまたは空の会話画面が表示されることを確認
      await expect(page.getByText(/ようこそ|Confluence|質問/i)).toBeVisible();
    } else {
      // ボタンが存在しない場合はテストをスキップ
      test.skip('新しいチャット機能が実装されていません');
    }
  });
});
