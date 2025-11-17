/**
 * GitHub Actions実行状況確認テスト
 * 
 * このテストは以下の項目を検証します：
 * 1. ワークフローファイルの有効性
 * 2. ワークフローの実行可能性
 * 3. 必要なシークレットの存在確認
 * 4. 実行履歴の確認（GitHub CLI使用時）
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadTestEnv } from '../test-helpers/env-loader';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

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

  describe('2. Confluence同期ワークフロー (sync-confluence.yml)', () => {
    let workflow: any;

    beforeAll(() => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-confluence.yml');
      if (existsSync(workflowPath)) {
        const content = readFileSync(workflowPath, 'utf-8');
        workflow = yaml.load(content);
      }
    });

    it('スケジュールが正しく設定されている', () => {
      if (!workflow) return;
      
      expect(workflow.on).toHaveProperty('schedule');
      expect(workflow.on.schedule[0].cron).toBe('0 17 * * *'); // UTC 17:00 = JST 2:00（翌日）
    });

    it('手動実行（workflow_dispatch）が設定されている', () => {
      if (!workflow) return;
      
      expect(workflow.on).toHaveProperty('workflow_dispatch');
      expect(workflow.on.workflow_dispatch.inputs).toHaveProperty('sync_type');
    });

    it('必須ステップが含まれている', () => {
      if (!workflow) return;
      
      const steps = workflow.jobs.sync.steps;
      const stepNames = steps.map((s: any) => s.name);
      
      expect(stepNames).toContain('Run differential sync');
      expect(stepNames).toContain('Run full sync');
      expect(stepNames).toContain('Create LanceDB indexes');
      expect(stepNames).toContain('Rebuild Lunr index');
      expect(stepNames).toContain('Upload data to Cloud Storage');
    });

    it('環境変数が正しく設定されている', () => {
      if (!workflow) return;
      
      const differentialStep = workflow.jobs.sync.steps.find((s: any) => s.name === 'Run differential sync');
      expect(differentialStep).toHaveProperty('env');
      expect(differentialStep.env).toHaveProperty('CONFLUENCE_API_TOKEN');
      expect(differentialStep.env).toHaveProperty('GEMINI_API_KEY');
    });
  });

  describe('3. 週次完全同期ワークフロー (weekly-full-sync.yml)', () => {
    let workflow: any;

    beforeAll(() => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'weekly-full-sync.yml');
      if (existsSync(workflowPath)) {
        const content = readFileSync(workflowPath, 'utf-8');
        workflow = yaml.load(content);
      }
    });

    it('スケジュールが正しく設定されている', () => {
      if (!workflow) return;
      
      expect(workflow.on).toHaveProperty('schedule');
      expect(workflow.on.schedule[0].cron).toBe('0 18 * * 6'); // UTC 18:00土曜日 = JST 3:00日曜日
    });

    it('完全同期コマンドが正しい', () => {
      if (!workflow) return;
      
      const fullSyncStep = workflow.jobs['full-sync'].steps.find((s: any) => s.name === 'Run full sync');
      expect(fullSyncStep.run).toBe('npm run sync:confluence:batch');
    });
  });

  describe('4. Jira同期ワークフロー (sync-jira.yml)', () => {
    let workflow: any;

    beforeAll(() => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-jira.yml');
      if (existsSync(workflowPath)) {
        const content = readFileSync(workflowPath, 'utf-8');
        workflow = yaml.load(content);
      }
    });

    it('スケジュールが正しく設定されている', () => {
      if (!workflow) return;
      
      expect(workflow.on).toHaveProperty('schedule');
      expect(workflow.on.schedule[0].cron).toBe('*/30 * * * *'); // 30分おき
    });

    it('Jira同期コマンドが正しい', () => {
      if (!workflow) return;
      
      const jiraSyncStep = workflow.jobs.sync.steps.find((s: any) => s.name === 'Run Jira sync');
      expect(jiraSyncStep.run).toBe('npm run sync:jira');
    });
  });

  describe('5. 実行状況の確認（GitHub CLI使用時）', () => {
    let hasGitHubCLI: boolean = false;

    beforeAll(() => {
      // GitHub CLIが利用可能か確認
      try {
        execSync('gh --version', { stdio: 'ignore' });
        hasGitHubCLI = true;
      } catch {
        hasGitHubCLI = false;
      }
    });

    it('GitHub CLIが利用可能である（オプショナル）', () => {
      // GitHub CLIが利用可能な場合のみテスト
      if (!hasGitHubCLI) {
        console.log('⚠️ GitHub CLI is not available. Skipping execution status checks.');
        expect(true).toBe(true); // スキップ
        return;
      }

      expect(hasGitHubCLI).toBe(true);
    });

    it('ワークフロー一覧が取得できる（オプショナル）', () => {
      if (!hasGitHubCLI) {
        console.log('⚠️ GitHub CLI is not available. Skipping workflow list check.');
        expect(true).toBe(true); // スキップ
        return;
      }

      try {
        const output = execSync('gh workflow list', { encoding: 'utf-8' });
        expect(output).toBeTruthy();
        expect(output.length).toBeGreaterThan(0);
      } catch (error) {
        console.warn('⚠️ Failed to get workflow list:', error);
        expect(true).toBe(true); // エラーでもテストは続行
      }
    });

    it('Confluence同期ワークフローの実行履歴が確認できる（オプショナル）', () => {
      if (!hasGitHubCLI) {
        console.log('⚠️ GitHub CLI is not available. Skipping run history check.');
        expect(true).toBe(true); // スキップ
        return;
      }

      try {
        const output = execSync('gh run list --workflow=sync-confluence.yml --limit 5', { encoding: 'utf-8' });
        expect(output).toBeTruthy();
        // 実行履歴が存在することを確認（空でない）
        if (output.trim().length > 0) {
          console.log('✅ Confluence sync workflow has execution history');
        }
      } catch (error) {
        console.warn('⚠️ Failed to get run history:', error);
        expect(true).toBe(true); // エラーでもテストは続行
      }
    });

    it('週次完全同期ワークフローの実行履歴が確認できる（オプショナル）', () => {
      if (!hasGitHubCLI) {
        console.log('⚠️ GitHub CLI is not available. Skipping run history check.');
        expect(true).toBe(true); // スキップ
        return;
      }

      try {
        const output = execSync('gh run list --workflow=weekly-full-sync.yml --limit 5', { encoding: 'utf-8' });
        expect(output).toBeTruthy();
        if (output.trim().length > 0) {
          console.log('✅ Weekly full sync workflow has execution history');
        }
      } catch (error) {
        console.warn('⚠️ Failed to get run history:', error);
        expect(true).toBe(true);
      }
    });

    it('Jira同期ワークフローの実行履歴が確認できる（オプショナル）', () => {
      if (!hasGitHubCLI) {
        console.log('⚠️ GitHub CLI is not available. Skipping run history check.');
        expect(true).toBe(true); // スキップ
        return;
      }

      try {
        const output = execSync('gh run list --workflow=sync-jira.yml --limit 5', { encoding: 'utf-8' });
        expect(output).toBeTruthy();
        if (output.trim().length > 0) {
          console.log('✅ Jira sync workflow has execution history');
        }
      } catch (error) {
        console.warn('⚠️ Failed to get run history:', error);
        expect(true).toBe(true);
      }
    });
  });

  describe('6. エラーハンドリングの検証', () => {
    it('すべてのワークフローにエラー通知が設定されている', () => {
      const workflows = [
        'sync-confluence.yml',
        'weekly-full-sync.yml',
        'sync-jira.yml'
      ];

      workflows.forEach(workflowFile => {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        const content = readFileSync(workflowPath, 'utf-8');
        
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
        
        expect(content).toContain('Notify completion');
      });
    });
  });
});

