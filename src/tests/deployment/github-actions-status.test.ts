/**
 * GitHub Actions実行状況確認テスト
 * 
 * このテストは以下の項目を検証します：
 * 1. ワークフローファイルの有効性
 * 2. ワークフローの実行可能性
 * 3. 必要なシークレットの存在確認
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadTestEnv } from '../test-helpers/env-loader';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// テスト用の環境変数を事前に読み込む
loadTestEnv();

describe('GitHub Actions実行状況確認テスト', () => {
  beforeAll(() => {
    console.log('🔍 GitHub Actions実行状況確認テスト開始');
  });

  afterAll(() => {
    console.log('✅ GitHub Actions実行状況確認テスト完了');
  });

  describe('1. ワークフローファイルの有効性', () => {
    it('すべてのワークフローファイルが存在する', () => {
      const workflows = [
        'sync-confluence.yml',
        'weekly-full-sync.yml',
        'sync-jira.yml'
      ];

      workflows.forEach(workflowFile => {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        expect(existsSync(workflowPath)).toBe(true);
      });
    });

    it('すべてのワークフローファイルが有効なYAML形式である', () => {
      const workflows = [
        'sync-confluence.yml',
        'weekly-full-sync.yml',
        'sync-jira.yml'
      ];

      workflows.forEach(workflowFile => {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        const content = readFileSync(workflowPath, 'utf-8');
        
        // YAMLパースエラーがないことを確認
        expect(() => {
          yaml.load(content);
        }).not.toThrow();
      });
    });
  });

  describe('2. 必要なシークレットの確認', () => {
    it('Confluence同期に必要なシークレットが定義されている', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-confluence.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(content) as any;

      const requiredSecrets = [
        'CONFLUENCE_API_TOKEN',
        'GEMINI_API_KEY',
        'GOOGLE_CLOUD_CREDENTIALS'
      ];

      const contentLower = content.toLowerCase();
      requiredSecrets.forEach(secret => {
        // シークレットが参照されていることを確認
        expect(contentLower).toContain(secret.toLowerCase());
      });
    });

    it('週次完全同期に必要なシークレットが定義されている', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'weekly-full-sync.yml');
      const content = readFileSync(workflowPath, 'utf-8');

      const requiredSecrets = [
        'CONFLUENCE_API_TOKEN',
        'GEMINI_API_KEY',
        'GOOGLE_CLOUD_CREDENTIALS'
      ];

      const contentLower = content.toLowerCase();
      requiredSecrets.forEach(secret => {
        expect(contentLower).toContain(secret.toLowerCase());
      });
    });

    it('Jira同期に必要なシークレットが定義されている', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-jira.yml');
      const content = readFileSync(workflowPath, 'utf-8');

      const requiredSecrets = [
        'JIRA_API_TOKEN',
        'JIRA_PROJECT_KEY',
        'GEMINI_API_KEY',
        'GOOGLE_CLOUD_CREDENTIALS'
      ];

      const contentLower = content.toLowerCase();
      requiredSecrets.forEach(secret => {
        // Jira固有のシークレットまたはフォールバックが設定されていることを確認
        const hasDirectSecret = contentLower.includes(secret.toLowerCase());
        const hasFallback = secret === 'JIRA_API_TOKEN' && contentLower.includes('confluence_api_token');
        expect(hasDirectSecret || hasFallback).toBe(true);
      });
    });
  });

  describe('3. ワークフローの実行可能性', () => {
    it('Confluence同期ワークフローが手動実行可能である', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-confluence.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(content) as any;

      expect(workflow.on).toHaveProperty('workflow_dispatch');
    });

    it('週次完全同期ワークフローが手動実行可能である', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'weekly-full-sync.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(content) as any;

      expect(workflow.on).toHaveProperty('workflow_dispatch');
    });

    it('Jira同期ワークフローが手動実行可能である', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-jira.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(content) as any;

      expect(workflow.on).toHaveProperty('workflow_dispatch');
    });
  });

  describe('4. スケジュール設定の検証', () => {
    it('Confluence同期のスケジュールが正しく設定されている', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-confluence.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(content) as any;

      expect(workflow.on).toHaveProperty('schedule');
      expect(workflow.on.schedule[0].cron).toBe('0 17 * * *'); // 毎日UTC 17:00 = JST 2:00
    });

    it('週次完全同期のスケジュールが正しく設定されている', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'weekly-full-sync.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(content) as any;

      expect(workflow.on).toHaveProperty('schedule');
      expect(workflow.on.schedule[0].cron).toBe('0 18 * * 6'); // 毎週土曜日UTC 18:00 = 日曜日JST 3:00
    });

    it('Jira同期のスケジュールが正しく設定されている', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-jira.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(content) as any;

      expect(workflow.on).toHaveProperty('schedule');
      expect(workflow.on.schedule[0].cron).toBe('*/30 * * * *'); // 30分おき
    });
  });

  describe('5. エラーハンドリングの検証', () => {
    it('すべてのワークフローにエラー通知が設定されている', () => {
      const workflows = [
        'sync-confluence.yml',
        'weekly-full-sync.yml',
        'sync-jira.yml'
      ];

      workflows.forEach(workflowFile => {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        const content = readFileSync(workflowPath, 'utf-8');
        
        // エラー通知ステップが含まれていることを確認
        expect(content).toContain('Notify failure');
        expect(content).toContain('failure()');
      });
    });

    it('すべてのワークフローに成功通知が設定されている', () => {
      const workflows = [
        'sync-confluence.yml',
        'weekly-full-sync.yml',
        'sync-jira.yml'
      ];

      workflows.forEach(workflowFile => {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        const content = readFileSync(workflowPath, 'utf-8');
        
        // 成功通知ステップが含まれていることを確認
        expect(content).toContain('Notify completion');
      });
    });
  });

  describe('6. 実行コマンドの検証', () => {
    it('Confluence同期コマンドが正しく設定されている', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-confluence.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(content) as any;

      const steps = workflow.jobs.sync.steps;
      const differentialStep = steps.find((s: any) => s.name === 'Run differential sync');
      const fullStep = steps.find((s: any) => s.name === 'Run full sync');

      expect(differentialStep.run).toBe('npm run sync:confluence:differential');
      expect(fullStep.run).toBe('npm run sync:confluence:batch');
    });

    it('週次完全同期コマンドが正しく設定されている', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'weekly-full-sync.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(content) as any;

      const steps = workflow.jobs['full-sync'].steps;
      const fullSyncStep = steps.find((s: any) => s.name === 'Run full sync');

      expect(fullSyncStep.run).toBe('npm run sync:confluence:batch');
    });

    it('Jira同期コマンドが正しく設定されている', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-jira.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      const workflow = yaml.load(content) as any;

      const steps = workflow.jobs.sync.steps;
      const jiraSyncStep = steps.find((s: any) => s.name === 'Run Jira sync');

      expect(jiraSyncStep.run).toBe('npm run sync:jira');
    });
  });
});

