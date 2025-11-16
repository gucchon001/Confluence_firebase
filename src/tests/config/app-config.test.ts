/**
 * 統合設定ファイルのテスト
 * 
 * 環境変数の検証ロジックと型安全性をテスト
 */

import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appConfig } from '@/config/app-config';

describe('AppConfig', () => {
  describe('環境変数の検証', () => {
    it('必須環境変数が設定されている', () => {
      // Confluence設定
      expect(appConfig.confluence.baseUrl).toBeTruthy();
      expect(appConfig.confluence.userEmail).toBeTruthy();
      expect(appConfig.confluence.apiToken).toBeTruthy();
      expect(appConfig.confluence.spaceKey).toBeTruthy();

      // Gemini設定
      expect(appConfig.gemini.apiKey).toBeTruthy();

      // Firebase設定（クライアント側）
      expect(appConfig.firebase.apiKey).toBeTruthy();
      expect(appConfig.firebase.authDomain).toBeTruthy();
      expect(appConfig.firebase.projectId).toBeTruthy();
      expect(appConfig.firebase.storageBucket).toBeTruthy();
      expect(appConfig.firebase.messagingSenderId).toBeTruthy();
      expect(appConfig.firebase.appId).toBeTruthy();
    });

    it('Confluence設定が正しい形式である', () => {
      // URL形式の検証
      expect(appConfig.confluence.baseUrl).toMatch(/^https?:\/\/.+/);
      
      // メールアドレス形式の検証
      expect(appConfig.confluence.userEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('Jira設定が正しくフォールバックされる', () => {
      // Jira固有の設定がない場合、Confluence設定をフォールバックとして使用
      const jiraBaseUrl = appConfig.jira.baseUrl;
      expect(jiraBaseUrl).toBeTruthy();
      
      // フォールバックが正しく動作している場合、Confluence設定と同じ値になる
      if (!process.env.JIRA_BASE_URL) {
        expect(jiraBaseUrl).toBe(appConfig.confluence.baseUrl);
      }
    });
  });

  describe('型安全性', () => {
    it('Confluence設定が正しい型である', () => {
      expect(typeof appConfig.confluence.baseUrl).toBe('string');
      expect(typeof appConfig.confluence.userEmail).toBe('string');
      expect(typeof appConfig.confluence.apiToken).toBe('string');
      expect(typeof appConfig.confluence.spaceKey).toBe('string');
    });

    it('Jira設定が正しい型である', () => {
      expect(typeof appConfig.jira.baseUrl).toBe('string');
      expect(typeof appConfig.jira.userEmail).toBe('string');
      expect(typeof appConfig.jira.apiToken).toBe('string');
      expect(typeof appConfig.jira.maxIssues).toBe('number');
      expect(appConfig.jira.maxIssues).toBeGreaterThan(0);
    });

    it('Gemini設定が正しい型である', () => {
      expect(typeof appConfig.gemini.apiKey).toBe('string');
    });

    it('Firebase設定が正しい型である', () => {
      expect(typeof appConfig.firebase.apiKey).toBe('string');
      expect(typeof appConfig.firebase.authDomain).toBe('string');
      expect(typeof appConfig.firebase.projectId).toBe('string');
      expect(typeof appConfig.firebase.storageBucket).toBe('string');
      expect(typeof appConfig.firebase.messagingSenderId).toBe('string');
      expect(typeof appConfig.firebase.appId).toBe('string');
    });

    it('環境判定が正しい型である', () => {
      expect(typeof appConfig.environment.isDevelopment).toBe('boolean');
      expect(typeof appConfig.environment.isProduction).toBe('boolean');
      expect(typeof appConfig.environment.isTest).toBe('boolean');
      expect(typeof appConfig.environment.nodeEnv).toBe('string');
      
      // 環境判定は排他的である必要がある
      const envCount = [
        appConfig.environment.isDevelopment,
        appConfig.environment.isProduction,
        appConfig.environment.isTest
      ].filter(Boolean).length;
      
      expect(envCount).toBe(1); // 1つの環境のみtrue
    });

    it('デプロイメント判定が正しい型である', () => {
      expect(typeof appConfig.deployment.isCloudRun).toBe('boolean');
      expect(typeof appConfig.deployment.useInMemoryFS).toBe('boolean');
      
      // useInMemoryFSがtrueの場合、isCloudRunもtrueである必要がある
      if (appConfig.deployment.useInMemoryFS) {
        expect(appConfig.deployment.isCloudRun).toBe(true);
      }
    });
  });

  describe('設定値の一貫性', () => {
    it('環境変数と統合設定の値が一致している', () => {
      const envBaseUrl = process.env.CONFLUENCE_BASE_URL;
      if (envBaseUrl) {
        expect(appConfig.confluence.baseUrl).toBe(envBaseUrl);
      }

      const envUserEmail = process.env.CONFLUENCE_USER_EMAIL;
      if (envUserEmail) {
        expect(appConfig.confluence.userEmail).toBe(envUserEmail);
      }

      const envApiToken = process.env.CONFLUENCE_API_TOKEN;
      if (envApiToken) {
        expect(appConfig.confluence.apiToken).toBe(envApiToken);
      }

      const envSpaceKey = process.env.CONFLUENCE_SPACE_KEY;
      if (envSpaceKey) {
        expect(appConfig.confluence.spaceKey).toBe(envSpaceKey);
      }
    });

    it('Jira設定が正しくフォールバックされている', () => {
      const jiraBaseUrl = process.env.JIRA_BASE_URL || process.env.CONFLUENCE_BASE_URL;
      if (jiraBaseUrl) {
        expect(appConfig.jira.baseUrl).toBe(jiraBaseUrl);
      }

      const jiraUserEmail = process.env.JIRA_USER_EMAIL || process.env.CONFLUENCE_USER_EMAIL;
      if (jiraUserEmail) {
        expect(appConfig.jira.userEmail).toBe(jiraUserEmail);
      }

      const jiraApiToken = process.env.JIRA_API_TOKEN || process.env.CONFLUENCE_API_TOKEN;
      if (jiraApiToken) {
        expect(appConfig.jira.apiToken).toBe(jiraApiToken);
      }
    });

    it('NODE_ENVが正しく反映されている', () => {
      const nodeEnv = process.env.NODE_ENV || 'development';
      expect(appConfig.environment.nodeEnv).toBe(nodeEnv);
    });
  });

  describe('設定値の妥当性', () => {
    it('Confluence baseUrlが有効なURLである', () => {
      expect(() => {
        new URL(appConfig.confluence.baseUrl);
      }).not.toThrow();
    });

    it('Confluence userEmailが有効なメールアドレスである', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(appConfig.confluence.userEmail).toMatch(emailRegex);
    });

    it('Jira maxIssuesが正の数である', () => {
      expect(appConfig.jira.maxIssues).toBeGreaterThan(0);
      expect(Number.isInteger(appConfig.jira.maxIssues)).toBe(true);
    });

    it('Firebase設定が正しい形式である', () => {
      // Firebase APIキーが設定されている
      expect(appConfig.firebase.apiKey).toBeTruthy();
      
      // FirebaseプロジェクトIDが設定されている
      expect(appConfig.firebase.projectId).toBeTruthy();
      
      // 本番環境では、Firebase APIキーがAIzaで始まることを確認（テスト環境ではスキップ）
      if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.startsWith('AIza')) {
        expect(appConfig.firebase.apiKey).toMatch(/^AIza/);
      }
    });
  });

  describe('フォールバックロジック', () => {
    it('Jira設定がConfluence設定をフォールバックとして使用する', () => {
      // Jira固有の設定がない場合
      if (!process.env.JIRA_BASE_URL) {
        expect(appConfig.jira.baseUrl).toBe(appConfig.confluence.baseUrl);
      }
      
      if (!process.env.JIRA_USER_EMAIL) {
        expect(appConfig.jira.userEmail).toBe(appConfig.confluence.userEmail);
      }
      
      if (!process.env.JIRA_API_TOKEN) {
        expect(appConfig.jira.apiToken).toBe(appConfig.confluence.apiToken);
      }
    });

    it('Firebase Server設定がFirebase Client設定をフォールバックとして使用する', () => {
      const serverProjectId = appConfig.firebaseServer.projectId;
      const clientProjectId = appConfig.firebase.projectId;
      
      if (!process.env.FIREBASE_PROJECT_ID) {
        expect(serverProjectId).toBe(clientProjectId);
      }
    });
  });

  describe('デプロイメント判定', () => {
    it('Cloud Run環境が正しく判定される', () => {
      const isCloudRun = !!process.env.K_SERVICE;
      expect(appConfig.deployment.isCloudRun).toBe(isCloudRun);
    });

    it('インメモリファイルシステムの使用が正しく判定される', () => {
      const useInMemoryFS = process.env.USE_INMEMORY_FS === 'true' && !!process.env.K_SERVICE;
      expect(appConfig.deployment.useInMemoryFS).toBe(useInMemoryFS);
      
      // useInMemoryFSがtrueの場合、isCloudRunもtrueである必要がある
      if (appConfig.deployment.useInMemoryFS) {
        expect(appConfig.deployment.isCloudRun).toBe(true);
      }
    });
  });
});

