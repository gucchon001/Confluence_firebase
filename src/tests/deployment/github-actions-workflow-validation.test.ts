/**
 * GitHub Actionsワークフロー検証テスト
 * 
 * このテストは、3つのワークフロー（sync-confluence.yml、weekly-full-sync.yml、sync-jira.yml）が
 * 正しく設定され、実行可能であることを検証します。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadTestEnv } from '../test-helpers/env-loader';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { readFile } from 'fs/promises';

// テスト用の環境変数を事前に読み込む
loadTestEnv();

describe('GitHub Actionsワークフロー検証テスト', () => {
  beforeAll(() => {
    console.log('🔍 GitHub Actionsワークフロー検証テスト開始');
  });

  afterAll(() => {
    console.log('✅ GitHub Actionsワークフロー検証テスト完了');
  });

  describe('1. ワークフローファイルの存在確認', () => {
    const requiredWorkflows = [
      'sync-confluence.yml',
      'weekly-full-sync.yml',
      'sync-jira.yml'
    ];

    it.each(requiredWorkflows)('ワークフローファイル %s が存在する', (workflowFile) => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
      expect(existsSync(workflowPath)).toBe(true);
    });

    it('すべてのワークフローファイルが有効なYAML形式である', () => {
      requiredWorkflows.forEach(workflowFile => {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        const content = readFileSync(workflowPath, 'utf-8');
        
        expect(() => {
          yaml.load(content);
        }).not.toThrow(`Failed to parse ${workflowFile}`);
      });
    });
  });

  describe('2. sync-confluence.yml の検証', () => {
    let workflow: any;

    beforeAll(async () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-confluence.yml');
      const content = await readFile(workflowPath, 'utf-8');
      workflow = yaml.load(content);
    });

    it('ワークフロー名が正しい', () => {
      expect(workflow.name).toBe('Sync Confluence Data');
    });

    it('スケジュールが正しく設定されている', () => {
      expect(workflow.on).toHaveProperty('schedule');
      expect(workflow.on.schedule).toHaveLength(1);
      expect(workflow.on.schedule[0].cron).toBe('0 17 * * *'); // UTC 17:00 = JST 2:00（翌日）
    });

    it('手動実行（workflow_dispatch）が設定されている', () => {
      expect(workflow.on).toHaveProperty('workflow_dispatch');
      expect(workflow.on.workflow_dispatch.inputs).toHaveProperty('sync_type');
      expect(workflow.on.workflow_dispatch.inputs.sync_type.type).toBe('choice');
      expect(workflow.on.workflow_dispatch.inputs.sync_type.options).toEqual(['differential', 'full']);
    });

    it('syncジョブが存在する', () => {
      expect(workflow.jobs).toHaveProperty('sync');
      expect(workflow.jobs.sync['runs-on']).toBe('ubuntu-latest');
    });

    it('必須ステップがすべて含まれている', () => {
      const steps = workflow.jobs.sync.steps;
      const stepNames = steps.map((s: any) => s.name);
      
      const requiredSteps = [
        'Checkout repository',
        'Setup Node.js',
        'Authenticate to Google Cloud',
        'Setup Google Cloud CLI',
        'Install dependencies',
        'Run differential sync',
        'Run full sync',
        'Create LanceDB indexes',
        'Rebuild Lunr index',
        'Upload data to Cloud Storage',
        'Notify completion',
        'Notify failure'
      ];

      requiredSteps.forEach(stepName => {
        expect(stepNames).toContain(stepName);
      });
    });

    it('Node.jsバージョンが22に設定されている', () => {
      const setupNodeStep = workflow.jobs.sync.steps.find((s: any) => 
        s.name === 'Setup Node.js'
      );
      expect(setupNodeStep).toBeDefined();
      expect(setupNodeStep.with.node_version).toBe('22');
    });

    it('差分同期ステップの条件が正しい', () => {
      const differentialStep = workflow.jobs.sync.steps.find((s: any) => 
        s.name === 'Run differential sync'
      );
      expect(differentialStep).toBeDefined();
      expect(differentialStep.if).toContain('schedule');
      expect(differentialStep.if).toContain('differential');
    });

    it('完全同期ステップの条件が正しい', () => {
      const fullStep = workflow.jobs.sync.steps.find((s: any) => 
        s.name === 'Run full sync'
      );
      expect(fullStep).toBeDefined();
      expect(fullStep.if).toContain('workflow_dispatch');
      expect(fullStep.if).toContain('full');
    });

    it('環境変数が正しく設定されている', () => {
      const differentialStep = workflow.jobs.sync.steps.find((s: any) => 
        s.name === 'Run differential sync'
      );
      
      expect(differentialStep.env).toHaveProperty('CONFLUENCE_API_TOKEN');
      expect(differentialStep.env).toHaveProperty('GEMINI_API_KEY');
      expect(differentialStep.env).toHaveProperty('CONFLUENCE_BASE_URL');
      expect(differentialStep.env).toHaveProperty('CONFLUENCE_USER_EMAIL');
      expect(differentialStep.env).toHaveProperty('CONFLUENCE_SPACE_KEY');
    });

    it('エラーハンドリングが設定されている', () => {
      const steps = workflow.jobs.sync.steps;
      const notifyFailureStep = steps.find((s: any) => s.name === 'Notify failure');
      
      expect(notifyFailureStep).toBeDefined();
      expect(notifyFailureStep.if).toBe('failure()');
    });
  });

  describe('3. weekly-full-sync.yml の検証', () => {
    let workflow: any;

    beforeAll(async () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'weekly-full-sync.yml');
      const content = await readFile(workflowPath, 'utf-8');
      workflow = yaml.load(content);
    });

    it('ワークフロー名が正しい', () => {
      expect(workflow.name).toBe('Weekly Full Sync');
    });

    it('スケジュールが正しく設定されている', () => {
      expect(workflow.on).toHaveProperty('schedule');
      expect(workflow.on.schedule).toHaveLength(1);
      expect(workflow.on.schedule[0].cron).toBe('0 18 * * 6'); // UTC 18:00土曜日 = JST 3:00日曜日
    });

    it('手動実行（workflow_dispatch）が設定されている', () => {
      expect(workflow.on).toHaveProperty('workflow_dispatch');
    });

    it('full-syncジョブが存在する', () => {
      expect(workflow.jobs).toHaveProperty('full-sync');
      expect(workflow.jobs['full-sync']['runs-on']).toBe('ubuntu-latest');
    });

    it('完全同期コマンドが正しい', () => {
      const fullSyncStep = workflow.jobs['full-sync'].steps.find((s: any) => 
        s.name === 'Run full sync'
      );
      expect(fullSyncStep).toBeDefined();
      expect(fullSyncStep.run).toBe('npm run sync:confluence:batch');
    });

    it('必須ステップがすべて含まれている', () => {
      const steps = workflow.jobs['full-sync'].steps;
      const stepNames = steps.map((s: any) => s.name);
      
      const requiredSteps = [
        'Checkout repository',
        'Setup Node.js',
        'Authenticate to Google Cloud',
        'Setup Google Cloud CLI',
        'Install dependencies',
        'Run full sync',
        'Create LanceDB indexes',
        'Rebuild Lunr index',
        'Upload data to Cloud Storage',
        'Notify completion',
        'Notify failure'
      ];

      requiredSteps.forEach(stepName => {
        expect(stepNames).toContain(stepName);
      });
    });

    it('Node.jsバージョンが22に設定されている', () => {
      const setupNodeStep = workflow.jobs['full-sync'].steps.find((s: any) => 
        s.name === 'Setup Node.js'
      );
      expect(setupNodeStep).toBeDefined();
      expect(setupNodeStep.with.node_version).toBe('22');
    });
  });

  describe('4. sync-jira.yml の検証', () => {
    let workflow: any;

    beforeAll(async () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-jira.yml');
      const content = await readFile(workflowPath, 'utf-8');
      workflow = yaml.load(content);
    });

    it('ワークフロー名が正しい', () => {
      expect(workflow.name).toBe('Sync Jira Data');
    });

    it('スケジュールが正しく設定されている', () => {
      expect(workflow.on).toHaveProperty('schedule');
      expect(workflow.on.schedule).toHaveLength(1);
      expect(workflow.on.schedule[0].cron).toBe('*/30 * * * *'); // 30分おき（UTC時間）
    });

    it('手動実行（workflow_dispatch）が設定されている', () => {
      expect(workflow.on).toHaveProperty('workflow_dispatch');
      expect(workflow.on.workflow_dispatch.inputs).toHaveProperty('max_issues');
      expect(workflow.on.workflow_dispatch.inputs.max_issues.type).toBe('string');
    });

    it('syncジョブが存在する', () => {
      expect(workflow.jobs).toHaveProperty('sync');
      expect(workflow.jobs.sync['runs-on']).toBe('ubuntu-latest');
    });

    it('Jira同期コマンドが正しい', () => {
      const jiraSyncStep = workflow.jobs.sync.steps.find((s: any) => 
        s.name === 'Run Jira sync'
      );
      expect(jiraSyncStep).toBeDefined();
      expect(jiraSyncStep.run).toBe('npm run sync:jira');
    });

    it('必須ステップがすべて含まれている', () => {
      const steps = workflow.jobs.sync.steps;
      const stepNames = steps.map((s: any) => s.name);
      
      const requiredSteps = [
        'Checkout repository',
        'Setup Node.js',
        'Authenticate to Google Cloud',
        'Setup Google Cloud CLI',
        'Install dependencies',
        'Run Jira sync',
        'Initialize Jira Lunr index',
        'Create LanceDB indexes',
        'Upload data to Cloud Storage',
        'Notify completion',
        'Notify failure'
      ];

      requiredSteps.forEach(stepName => {
        expect(stepNames).toContain(stepName);
      });
    });

    it('Node.jsバージョンが22に設定されている', () => {
      const setupNodeStep = workflow.jobs.sync.steps.find((s: any) => 
        s.name === 'Setup Node.js'
      );
      expect(setupNodeStep).toBeDefined();
      expect(setupNodeStep.with.node_version).toBe('22');
    });

    it('Jira環境変数が正しく設定されている', () => {
      const jiraSyncStep = workflow.jobs.sync.steps.find((s: any) => 
        s.name === 'Run Jira sync'
      );
      
      expect(jiraSyncStep.env).toHaveProperty('JIRA_BASE_URL');
      expect(jiraSyncStep.env).toHaveProperty('JIRA_USER_EMAIL');
      expect(jiraSyncStep.env).toHaveProperty('JIRA_API_TOKEN');
      expect(jiraSyncStep.env).toHaveProperty('JIRA_PROJECT_KEY');
      expect(jiraSyncStep.env).toHaveProperty('GEMINI_API_KEY');
      expect(jiraSyncStep.env).toHaveProperty('GOOGLE_CLOUD_PROJECT');
    });
  });

  describe('5. 共通設定の検証', () => {
    it('すべてのワークフローでNode.jsバージョンが統一されている', async () => {
      const workflows = ['sync-confluence.yml', 'weekly-full-sync.yml', 'sync-jira.yml'];
      const nodeVersions: string[] = [];

      for (const workflowFile of workflows) {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        const content = await readFile(workflowPath, 'utf-8');
        const workflow = yaml.load(content) as any;
        
        const setupNodeStep = Object.values(workflow.jobs)[0]?.steps?.find((s: any) => 
          s.name === 'Setup Node.js'
        );
        
        if (setupNodeStep?.with?.node_version) {
          nodeVersions.push(setupNodeStep.with.node_version);
        }
      }

      // すべてのワークフローで同じNode.jsバージョンが使用されていることを確認
      expect(nodeVersions.length).toBe(3);
      const uniqueVersions = new Set(nodeVersions);
      expect(uniqueVersions.size).toBe(1);
      expect(nodeVersions[0]).toBe('22');
    });

    it('すべてのワークフローでGoogle Cloud認証が設定されている', async () => {
      const workflows = ['sync-confluence.yml', 'weekly-full-sync.yml', 'sync-jira.yml'];

      for (const workflowFile of workflows) {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        const content = await readFile(workflowPath, 'utf-8');
        const workflow = yaml.load(content) as any;
        
        const steps = Object.values(workflow.jobs)[0]?.steps || [];
        const hasAuth = steps.some((s: any) => 
          s.name === 'Authenticate to Google Cloud' || 
          s.uses?.includes('google-github-actions/auth')
        );
        
        expect(hasAuth).toBe(true);
      }
    });

    it('すべてのワークフローでCloud Storageアップロードが設定されている', async () => {
      const workflows = ['sync-confluence.yml', 'weekly-full-sync.yml', 'sync-jira.yml'];

      for (const workflowFile of workflows) {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        const content = await readFile(workflowPath, 'utf-8');
        const workflow = yaml.load(content) as any;
        
        const steps = Object.values(workflow.jobs)[0]?.steps || [];
        const hasUpload = steps.some((s: any) => 
          s.name === 'Upload data to Cloud Storage' ||
          s.run?.includes('upload:production-data')
        );
        
        expect(hasUpload).toBe(true);
      }
    });

    it('すべてのワークフローでエラーハンドリングが設定されている', async () => {
      const workflows = ['sync-confluence.yml', 'weekly-full-sync.yml', 'sync-jira.yml'];

      for (const workflowFile of workflows) {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        const content = await readFile(workflowPath, 'utf-8');
        const workflow = yaml.load(content) as any;
        
        const steps = Object.values(workflow.jobs)[0]?.steps || [];
        const hasFailureNotification = steps.some((s: any) => 
          s.name === 'Notify failure' && s.if === 'failure()'
        );
        
        expect(hasFailureNotification).toBe(true);
      }
    });
  });
});

