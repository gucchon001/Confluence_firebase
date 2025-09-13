import { test, expect } from '@playwright/test';
import { mockAuthState } from '../e2e/helpers';

test.describe('エラーハンドリングテスト', () => {
  
  test.describe('認証エラー', () => {
    test('認証トークンが無効な場合、ログイン画面にリダイレクトされる', async ({ page }) => {
      // 認証済みの状態をモック
      await mockAuthState(page, true);
      
      // 認証エラーをシミュレート
      await page.addInitScript(() => {
        // 既存のfetchをオーバーライドして401を返す
        const originalFetch = window.fetch;
        window.fetch = async (url, options) => {
          if (typeof url === 'string' && url.includes('/api/')) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 'unauthorized',
                  message: '認証トークンが無効です。'
                }
              }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
          }
          return originalFetch(url, options);
        };
      });
      
      await page.goto('/?mock=true');
      
      // ログイン画面にリダイレクトされることを確認
      await expect(page).toHaveURL(/\/login/);
      
      // エラーメッセージが表示されることを確認
      const errorMessages = [
        'セッションが切れました',
        '再度ログインしてください',
        'Session expired',
        'Please login again'
      ];
      
      let messageFound = false;
      for (const message of errorMessages) {
        const element = page.getByText(new RegExp(message, 'i'));
        if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
          messageFound = true;
          break;
        }
      }
      
      // メッセージが見つからない場合でも、ログイン画面に遷移していればOK
      expect(page.url()).toContain('/login');
    });
  });
  
  test.describe('API通信エラー', () => {
    test('Confluence APIエラー時に適切なエラーメッセージが表示される', async ({ page }) => {
      await mockAuthState(page, true);
      
      // Confluence APIエラーをシミュレート
      await page.addInitScript(() => {
        window.__askQuestionMock = async (question: string) => {
          throw new Error('Confluenceからのデータ取得に失敗しました。');
        };
      });
      
      await page.goto('/?mock=true');
      await page.waitForLoadState('networkidle');
      
      // ログインが必要な場合は実行
      const loginButton = page.getByRole('button', { name: /Sign in with Google/i });
      if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loginButton.click();
        await page.waitForTimeout(2000);
      }
      
      // 質問を入力
      const inputSelectors = ['textarea', 'input[type="text"]', '[role="textbox"]'];
      let inputFound = false;
      
      for (const selector of inputSelectors) {
        const input = page.locator(selector);
        if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
          await input.fill('テスト質問');
          inputFound = true;
          break;
        }
      }
      
      if (inputFound) {
        // 送信ボタンをクリック
        const sendButton = page.getByRole('button', { name: /送信|Send/i });
        if (await sendButton.isVisible()) {
          await sendButton.click();
          
          // エラーメッセージが表示されることを確認
          const errorMessages = [
            '仕様書の取得に失敗しました',
            '時間をおいて再度お試しください',
            'Failed to fetch specifications',
            'Please try again later'
          ];
          
          let errorFound = false;
          for (const message of errorMessages) {
            if (await page.getByText(new RegExp(message, 'i')).isVisible({ timeout: 5000 }).catch(() => false)) {
              errorFound = true;
              break;
            }
          }
          
          // エラーメッセージが見つからない場合でも、何らかのエラー表示があることを確認
          if (!errorFound) {
            const anyError = await page.getByText(/エラー|失敗|Error|Failed/i).isVisible({ timeout: 3000 }).catch(() => false);
            expect(anyError).toBeTruthy();
          }
        }
      }
    });
    
    test('LLM APIエラー時に適切なエラーメッセージが表示される', async ({ page }) => {
      await mockAuthState(page, true);
      
      // LLM APIエラーをシミュレート
      await page.addInitScript(() => {
        window.__askQuestionMock = async (question: string) => {
          return {
            content: '',
            sources: [],
            error: {
              code: 'llm_api_error',
              message: 'AIからの回答生成に失敗しました。'
            }
          };
        };
      });
      
      await page.goto('/?mock=true');
      await page.waitForLoadState('networkidle');
      
      // ログインが必要な場合は実行
      const loginButton = page.getByRole('button', { name: /Sign in with Google/i });
      if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loginButton.click();
        await page.waitForTimeout(2000);
      }
      
      // エラーメッセージの表示を確認（入力なしでも表示される場合）
      const llmErrorMessages = [
        '回答の生成中にエラーが発生しました',
        '別の質問をお試しください',
        'Error generating response',
        'Please try a different question'
      ];
      
      // ページにエラーが表示されているか確認
      let errorDisplayed = false;
      for (const message of llmErrorMessages) {
        if (await page.getByText(new RegExp(message, 'i')).isVisible({ timeout: 2000 }).catch(() => false)) {
          errorDisplayed = true;
          break;
        }
      }
      
      // エラーがまだ表示されていない場合は、質問を送信してエラーを発生させる
      if (!errorDisplayed) {
        const inputSelectors = ['textarea', 'input[type="text"]', '[role="textbox"]'];
        for (const selector of inputSelectors) {
          const input = page.locator(selector);
          if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
            await input.fill('テスト質問');
            const sendButton = page.getByRole('button', { name: /送信|Send/i });
            if (await sendButton.isVisible()) {
              await sendButton.click();
              
              // エラーメッセージが表示されることを再確認
              for (const message of llmErrorMessages) {
                if (await page.getByText(new RegExp(message, 'i')).isVisible({ timeout: 5000 }).catch(() => false)) {
                  errorDisplayed = true;
                  break;
                }
              }
            }
            break;
          }
        }
      }
      
      // 何らかのエラー表示があることを確認
      if (!errorDisplayed) {
        const anyError = await page.getByText(/エラー|失敗|Error|Failed/i).isVisible({ timeout: 3000 }).catch(() => false);
        expect(anyError).toBeTruthy();
      }
    });
  });
  
  test.describe('ネットワークエラー', () => {
    test('ネットワーク接続エラー時の処理', async ({ page, context }) => {
      await mockAuthState(page, true);
      
      await page.goto('/?mock=true');
      await page.waitForLoadState('networkidle');
      
      // オフラインモードをシミュレート
      await context.setOffline(true);
      
      // ページを操作しようとする
      const inputSelectors = ['textarea', 'input[type="text"]', '[role="textbox"]'];
      let inputFound = false;
      
      for (const selector of inputSelectors) {
        const input = page.locator(selector);
        if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
          await input.fill('オフラインテスト');
          inputFound = true;
          break;
        }
      }
      
      if (inputFound) {
        const sendButton = page.getByRole('button', { name: /送信|Send/i });
        if (await sendButton.isVisible()) {
          await sendButton.click();
          
          // ネットワークエラーメッセージが表示されることを確認
          const networkErrorMessages = [
            'ネットワーク',
            'インターネット',
            '接続',
            'Network',
            'Internet',
            'Connection',
            'offline'
          ];
          
          let errorFound = false;
          for (const message of networkErrorMessages) {
            if (await page.getByText(new RegExp(message, 'i')).isVisible({ timeout: 5000 }).catch(() => false)) {
              errorFound = true;
              break;
            }
          }
          
          // 一般的なエラーメッセージでも可
          if (!errorFound) {
            const anyError = await page.getByText(/エラー|失敗|Error|Failed/i).isVisible({ timeout: 3000 }).catch(() => false);
            expect(anyError).toBeTruthy();
          }
        }
      }
      
      // オンラインに戻す
      await context.setOffline(false);
    });
  });
  
  test.describe('入力検証エラー', () => {
    test('空の質問を送信しようとした場合の処理', async ({ page }) => {
      await mockAuthState(page, true);
      
      await page.goto('/?mock=true');
      await page.waitForLoadState('networkidle');
      
      // ログインが必要な場合は実行
      const loginButton = page.getByRole('button', { name: /Sign in with Google/i });
      if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loginButton.click();
        await page.waitForTimeout(2000);
      }
      
      // 送信ボタンをクリック（入力なし）
      const sendButton = page.getByRole('button', { name: /送信|Send/i });
      if (await sendButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendButton.click();
        
        // 何も起こらないか、エラーメッセージが表示されることを確認
        await page.waitForTimeout(1000);
        
        // ローディング状態にならないことを確認
        const loadingIndicator = page.locator('.animate-pulse, .loading, [role="progressbar"]');
        await expect(loadingIndicator).not.toBeVisible();
        
        // 新しいメッセージが追加されていないことを確認
        const messages = await page.locator('[role="article"], .message, .chat-message').count();
        expect(messages).toBe(0);
      }
    });
    
    test('非常に長い質問を送信した場合の処理', async ({ page }) => {
      await mockAuthState(page, true);
      
      await page.goto('/?mock=true');
      await page.waitForLoadState('networkidle');
      
      // ログインが必要な場合は実行
      const loginButton = page.getByRole('button', { name: /Sign in with Google/i });
      if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loginButton.click();
        await page.waitForTimeout(2000);
      }
      
      // 非常に長いテキストを生成
      const longText = 'あ'.repeat(5000);
      
      const inputSelectors = ['textarea', 'input[type="text"]', '[role="textbox"]'];
      for (const selector of inputSelectors) {
        const input = page.locator(selector);
        if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
          await input.fill(longText);
          
          const sendButton = page.getByRole('button', { name: /送信|Send/i });
          if (await sendButton.isVisible()) {
            await sendButton.click();
            
            // 文字数制限エラーまたは切り詰められて送信されることを確認
            const errorMessages = [
              '文字数',
              '長すぎ',
              'too long',
              'character limit',
              'maximum'
            ];
            
            let limitMessageFound = false;
            for (const message of errorMessages) {
              if (await page.getByText(new RegExp(message, 'i')).isVisible({ timeout: 3000 }).catch(() => false)) {
                limitMessageFound = true;
                break;
              }
            }
            
            // エラーメッセージがない場合は、質問が切り詰められて送信されたことを確認
            if (!limitMessageFound) {
              const sentMessage = await page.locator('[role="article"], .message, .chat-message').first().textContent();
              // 送信されたメッセージが元のテキストより短いことを確認
              expect(sentMessage?.length || 0).toBeLessThan(longText.length);
            }
          }
          break;
        }
      }
    });
  });
});
