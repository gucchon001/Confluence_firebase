/**
 * GitHub Actionsワークフローテスト
 * 
 * このテストは以下の項目を検証します：
 * 1. Confluence同期ワークフロー（sync-confluence.yml）
 * 2. 週次完全同期ワークフロー（weekly-full-sync.yml）
 * 3. Jira同期ワークフロー（sync-jira.yml）
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadTestEnv } from '../test-helpers/env-loader';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// テスト用の環境変数を事前に読み込む
loadTestEnv();

describe('GitHub Actionsワークフローテスト', () => {
  beforeAll(() => {
    console.log('🔄 GitHub Actionsワークフローテスト開始');
  });

  afterAll(() => {
    console.log('✅ GitHub Actionsワークフローテスト完了');
  });

  describe('1. Confluence同期ワークフロー (sync-confluence.yml)', () => {
    let workflow: any;

    beforeAll(() => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-confluence.yml');
      if (existsSync(workflowPath)) {
        const content = readFileSync(workflowPath, 'utf-8');
        workflow = yaml.load(content);
      }
    });

    it('ワークフローファイルが存在する', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-confluence.yml');
      expect(existsSync(workflowPath)).toBe(true);
    });

    it('スケジュールが正しく設定されている', () => {
      if (!workflow) return;
      
      expect(workflow.on).toHaveProperty('schedule');
      expect(Array.isArray(workflow.on.schedule)).toBe(true);
      expect(workflow.on.schedule[0].cron).toBe('0 17 * * *'); // UTC 17:00 = JST 2:00（翌日）
    });

    it('手動実行（workflow_dispatch）が設定されている', () => {
      if (!workflow) return;
      
      expect(workflow.on).toHaveProperty('workflow_dispatch');
      expect(workflow.on.workflow_dispatch).toHaveProperty('inputs');
      expect(workflow.on.workflow_dispatch.inputs).toHaveProperty('sync_type');
      expect(workflow.on.workflow_dispatch.inputs.sync_type.type).toBe('choice');
      expect(workflow.on.workflow_dispatch.inputs.sync_type.options).toContain('differential');
      expect(workflow.on.workflow_dispatch.inputs.sync_type.options).toContain('full');
    });

    it('必須ステップが含まれている', () => {
      if (!workflow) return;
      
      const steps = workflow.jobs.sync.steps;
      const stepNames = steps.map((s: any) => s.name);
      
      expect(stepNames).toContain('Checkout repository');
      expect(stepNames).toContain('Setup Node.js');
      expect(stepNames).toContain('Install dependencies');
      expect(stepNames).toContain('Run differential sync');
      expect(stepNames).toContain('Run full sync');
      expect(stepNames).toContain('Create LanceDB indexes');
      expect(stepNames).toContain('Rebuild Lunr index');
      expect(stepNames).toContain('Upload data to Cloud Storage');
    });

    it('差分同期ステップの条件が正しい', () => {
      if (!workflow) return;
      
      const differentialStep = workflow.jobs.sync.steps.find((s: any) => s.name === 'Run differential sync');
      expect(differentialStep).toBeDefined();
      expect(differentialStep.if).toContain('schedule');
      expect(differentialStep.if).toContain('differential');
    });

    it('完全同期ステップの条件が正しい', () => {
      if (!workflow) return;
      
      const fullStep = workflow.jobs.sync.steps.find((s: any) => s.name === 'Run full sync');
      expect(fullStep).toBeDefined();
      expect(fullStep.if).toContain('workflow_dispatch');
      expect(fullStep.if).toContain('full');
    });

    it('環境変数が正しく設定されている', () => {
      if (!workflow) return;
      
      const differentialStep = workflow.jobs.sync.steps.find((s: any) => s.name === 'Run differential sync');
      expect(differentialStep).toHaveProperty('env');
      expect(differentialStep.env).toHaveProperty('CONFLUENCE_API_TOKEN');
      expect(differentialStep.env).toHaveProperty('GEMINI_API_KEY');
      expect(differentialStep.env).toHaveProperty('CONFLUENCE_BASE_URL');
      expect(differentialStep.env).toHaveProperty('CONFLUENCE_USER_EMAIL');
      expect(differentialStep.env).toHaveProperty('CONFLUENCE_SPACE_KEY');
    });
  });

  describe('2. 週次完全同期ワークフロー (weekly-full-sync.yml)', () => {
    let workflow: any;

    beforeAll(() => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'weekly-full-sync.yml');
      if (existsSync(workflowPath)) {
        const content = readFileSync(workflowPath, 'utf-8');
        workflow = yaml.load(content);
      }
    });

    it('ワークフローファイルが存在する', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'weekly-full-sync.yml');
      expect(existsSync(workflowPath)).toBe(true);
    });

    it('スケジュールが正しく設定されている', () => {
      if (!workflow) return;
      
      expect(workflow.on).toHaveProperty('schedule');
      expect(Array.isArray(workflow.on.schedule)).toBe(true);
      expect(workflow.on.schedule[0].cron).toBe('0 18 * * 6'); // UTC 18:00土曜日 = JST 3:00日曜日
    });

    it('手動実行（workflow_dispatch）が設定されている', () => {
      if (!workflow) return;
      
      expect(workflow.on).toHaveProperty('workflow_dispatch');
    });

    it('完全同期ステップが含まれている', () => {
      if (!workflow) return;
      
      const steps = workflow.jobs['full-sync'].steps;
      const stepNames = steps.map((s: any) => s.name);
      
      expect(stepNames).toContain('Run full sync');
      expect(stepNames).toContain('Create LanceDB indexes');
      expect(stepNames).toContain('Rebuild Lunr index');
      expect(stepNames).toContain('Upload data to Cloud Storage');
    });

    it('完全同期コマンドが正しい', () => {
      if (!workflow) return;
      
      const fullSyncStep = workflow.jobs['full-sync'].steps.find((s: any) => s.name === 'Run full sync');
      expect(fullSyncStep).toBeDefined();
      expect(fullSyncStep.run).toBe('npm run sync:confluence:batch');
    });
  });

  describe('3. Jira同期ワークフロー (sync-jira.yml)', () => {
    let workflow: any;

    beforeAll(() => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-jira.yml');
      if (existsSync(workflowPath)) {
        const content = readFileSync(workflowPath, 'utf-8');
        workflow = yaml.load(content);
      }
    });

    it('ワークフローファイルが存在する', () => {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'sync-jira.yml');
      expect(existsSync(workflowPath)).toBe(true);
    });

    it('スケジュールが正しく設定されている', () => {
      if (!workflow) return;
      
      expect(workflow.on).toHaveProperty('schedule');
      expect(Array.isArray(workflow.on.schedule)).toBe(true);
      expect(workflow.on.schedule[0].cron).toBe('*/30 * * * *'); // 30分おき（UTC時間）
    });

    it('手動実行（workflow_dispatch）が設定されている', () => {
      if (!workflow) return;
      
      expect(workflow.on).toHaveProperty('workflow_dispatch');
      expect(workflow.on.workflow_dispatch).toHaveProperty('inputs');
      expect(workflow.on.workflow_dispatch.inputs).toHaveProperty('max_issues');
    });

    it('Jira同期ステップが含まれている', () => {
      if (!workflow) return;
      
      const steps = workflow.jobs.sync.steps;
      const stepNames = steps.map((s: any) => s.name);
      
      expect(stepNames).toContain('Run Jira sync');
      expect(stepNames).toContain('Initialize Jira Lunr index');
      expect(stepNames).toContain('Create LanceDB indexes');
      expect(stepNames).toContain('Upload data to Cloud Storage');
    });

    it('Jira同期コマンドが正しい', () => {
      if (!workflow) return;
      
      const jiraSyncStep = workflow.jobs.sync.steps.find((s: any) => s.name === 'Run Jira sync');
      expect(jiraSyncStep).toBeDefined();
      expect(jiraSyncStep.run).toBe('npm run sync:jira');
    });

    it('Jira環境変数が正しく設定されている', () => {
      if (!workflow) return;
      
      const jiraSyncStep = workflow.jobs.sync.steps.find((s: any) => s.name === 'Run Jira sync');
      expect(jiraSyncStep).toHaveProperty('env');
      expect(jiraSyncStep.env).toHaveProperty('JIRA_BASE_URL');
      expect(jiraSyncStep.env).toHaveProperty('JIRA_USER_EMAIL');
      expect(jiraSyncStep.env).toHaveProperty('JIRA_API_TOKEN');
      expect(jiraSyncStep.env).toHaveProperty('JIRA_PROJECT_KEY');
      expect(jiraSyncStep.env).toHaveProperty('GEMINI_API_KEY');
    });
  });

  describe('4. 共通設定の検証', () => {
    it('すべてのワークフローでNode.jsバージョンが統一されている', () => {
      const workflows = ['sync-confluence.yml', 'weekly-full-sync.yml', 'sync-jira.yml'];
      const nodeVersions: string[] = [];

      workflows.forEach(workflowFile => {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        if (existsSync(workflowPath)) {
          const content = readFileSync(workflowPath, 'utf-8');
          const workflow = yaml.load(content) as any;
          
          const setupNodeStep = Object.values(workflow.jobs)[0]?.steps?.find((s: any) => 
            s.name === 'Setup Node.js' || s.uses?.includes('setup-node')
          );
          
          if (setupNodeStep?.with?.node_version) {
            nodeVersions.push(setupNodeStep.with.node_version);
          }
        }
      });

      // すべてのワークフローで同じNode.jsバージョンが使用されていることを確認
      if (nodeVersions.length > 0) {
        const uniqueVersions = new Set(nodeVersions);
        expect(uniqueVersions.size).toBe(1);
        expect(nodeVersions[0]).toBe('22');
      }
    });

    it('すべてのワークフローでGoogle Cloud認証が設定されている', () => {
      const workflows = ['sync-confluence.yml', 'weekly-full-sync.yml', 'sync-jira.yml'];

      workflows.forEach(workflowFile => {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        if (existsSync(workflowPath)) {
          const content = readFileSync(workflowPath, 'utf-8');
          const workflow = yaml.load(content) as any;
          
          const steps = Object.values(workflow.jobs)[0]?.steps || [];
          const hasAuth = steps.some((s: any) => 
            s.name === 'Authenticate to Google Cloud' || 
            s.uses?.includes('google-github-actions/auth')
          );
          
          expect(hasAuth).toBe(true);
        }
      });
    });

    it('すべてのワークフローでCloud Storageアップロードが設定されている', () => {
      const workflows = ['sync-confluence.yml', 'weekly-full-sync.yml', 'sync-jira.yml'];

      workflows.forEach(workflowFile => {
        const workflowPath = path.join(process.cwd(), '.github', 'workflows', workflowFile);
        if (existsSync(workflowPath)) {
          const content = readFileSync(workflowPath, 'utf-8');
          const workflow = yaml.load(content) as any;
          
          const steps = Object.values(workflow.jobs)[0]?.steps || [];
          const hasUpload = steps.some((s: any) => 
            s.name === 'Upload data to Cloud Storage' ||
            s.run?.includes('upload:production-data')
          );
          
          expect(hasUpload).toBe(true);
        }
      });
    });
  });
});

