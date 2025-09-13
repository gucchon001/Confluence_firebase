import { test, expect } from '@playwright/test';
import { mockAuthState, mockChatService, mockRAGService } from './helpers';

test.describe('深掘り質問機能', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン済み状態をモック
    await mockAuthState(page, true);
    
    // チャットサービスをモック
    await mockChatService(page);
    
    // RAGサービスをモック
    await mockRAGService(page);
    
    // 会話の文脈を考慮したモックレスポンスを設定
    await page.addInitScript(() => {
      // 質問と回答のペアをモック
      const contextualResponses = {
        '求人詳細機能の仕様について教えてください': {
          content: '求人詳細機能は、主に以下の3つの主要コンポーネントで構成されています：\n\n1. 求人情報の表示エリア\n2. 応募ボタンと関連アクション\n3. 関連求人の表示セクション',
          sources: [
            {
              title: '[PROJ-123] 求人詳細画面仕様書',
              url: 'https://example.atlassian.net/wiki/spaces/PROJ/pages/123456/job-detail-spec'
            }
          ]
        },
        '応募ボタンを押した後のフローはどうなっていますか': {
          content: '応募ボタンを押した後のフローは以下のようになっています：\n\n1. ユーザー認証チェック\n2. 応募フォーム画面\n3. 確認画面\n4. 完了画面',
          sources: [
            {
              title: '[FLOW-78] 応募フロー設計書',
              url: 'https://example.atlassian.net/wiki/spaces/FLOW/pages/78901/application-flow'
            }
          ]
        }
      };
      
      // askQuestionアクションをモック
      let conversationContext = [];
      window.__askQuestionMock = async (question) => {
        // 会話履歴に質問を追加
        conversationContext.push(question);
        
        // 1秒後に応答を返す
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        let responseContent;
        let responseSources;
        
        // 初回質問の場合
        if (conversationContext.length === 1) {
          responseContent = contextualResponses['求人詳細機能の仕様について教えてください'].content;
          responseSources = contextualResponses['求人詳細機能の仕様について教えてください'].sources;
        } 
        // 深掘り質問の場合
        else if (question.includes('応募') || question.includes('フロー')) {
          responseContent = contextualResponses['応募ボタンを押した後のフローはどうなっていますか'].content;
          responseSources = contextualResponses['応募ボタンを押した後のフローはどうなっていますか'].sources;
        } 
        // その他の質問
        else {
          responseContent = `これはモックの回答です。質問: "${question}"`;
          responseSources = [
            {
              title: '[MOCK-123] モック参照元',
              url: 'https://example.atlassian.net/wiki/spaces/MOCK/pages/123456/mock-doc'
            }
          ];
        }
        
        return {
          id: `mock-response-${Date.now()}`,
          content: responseContent,
          role: 'assistant',
          createdAt: new Date().toISOString(),
          userId: 'mock-user-123',
          sources: responseSources
        };
      };
    });
    
    // チャット画面にアクセス
    await page.goto('/?mock=true');
    
    // チャット画面が表示されるまで待機
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('会話の文脈を維持した深掘り質問ができる（仕様USR-005）', async ({ page }) => {
    // 初回の質問を送信
    const textarea = page.locator('textarea');
    await textarea.fill('求人詳細機能の仕様について教えてください');
    
    // 送信ボタンをクリック
    const sendButton = page.getByRole('button', { name: /送信/i });
    await sendButton.click();
    
    // ユーザーの質問が表示されることを確認
    await expect(page.getByText('求人詳細機能の仕様について教えてください')).toBeVisible();
    
    // AIの回答が表示されるまで待機
    await expect(page.getByText(/求人詳細機能は、主に以下の3つの主要コンポーネント/i)).toBeVisible({ timeout: 5000 });
    
    // 参照元が表示されることを確認
    await expect(page.getByText(/PROJ-123/i)).toBeVisible();
    
    // 深掘り質問を送信
    await textarea.fill('応募ボタンを押した後のフローはどうなっていますか');
    await sendButton.click();
    
    // 深掘り質問が表示されることを確認
    await expect(page.getByText('応募ボタンを押した後のフローはどうなっていますか')).toBeVisible();
    
    // 文脈を考慮した回答が表示されるまで待機
    await expect(page.getByText(/応募ボタンを押した後のフローは以下のようになっています/i)).toBeVisible({ timeout: 5000 });
    
    // 新しい参照元が表示されることを確認
    await expect(page.getByText(/FLOW-78/i)).toBeVisible();
  });
});
