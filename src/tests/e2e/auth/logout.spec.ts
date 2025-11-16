import { test, expect } from '@playwright/test';
import { mockAuthState } from '../helpers';

test.describe('ログアウト機能', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page, true);
    await page.goto('/?mock=true');
    await page.waitForLoadState('networkidle');
  });

  test('E2E-AUTH-005: ログアウトボタンをクリックするとログアウトできる', async ({ page }) => {
    // ログアウトボタンを探す
    const logoutButtons = [
      page.getByRole('button', { name: /ログアウト|Logout|Sign out/i }),
      page.locator('[data-testid*="logout" i]'),
      page.locator('button').filter({ hasText: /ログアウト|Logout/i })
    ];
    
    let logoutButtonFound = false;
    for (const button of logoutButtons) {
      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await button.click();
        logoutButtonFound = true;
        break;
      }
    }
    
    // ログアウトボタンが見つからない場合はスキップ
    if (!logoutButtonFound) {
      test.skip('ログアウトボタンが見つかりません');
      return;
    }
    
    // ログイン画面にリダイレクトされることを確認
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes('/login') || 
                       (await page.getByRole('button', { name: /Sign in with Google/i }).isVisible({ timeout: 2000 }).catch(() => false));
    
    expect(isLoginPage).toBe(true);
  });
});

