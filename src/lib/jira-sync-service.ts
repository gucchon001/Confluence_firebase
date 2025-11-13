import 'dotenv/config';

import { connect as connectLanceDB } from '@lancedb/lancedb';
import admin from 'firebase-admin';
import * as path from 'path';
import fetch from 'node-fetch';

import { initializeFirebaseAdmin } from './firebase-admin-init';

initializeFirebaseAdmin();

const firestore = admin.firestore();

export interface JiraSyncResult {
  totalIssues: number;
  storedIssues: number;
  skippedIssues: number;
  lanceDbRecords: number;
}

interface JiraUser {
  displayName?: string;
}

interface JiraStatus {
  name?: string;
  statusCategory?: {
    name?: string;
  };
}

interface JiraPriority {
  name?: string;
}

interface JiraIssueField {
  key: string;
  summary: string;
  description?: any;
  status?: JiraStatus;
  priority?: JiraPriority;
  assignee?: JiraUser | null;
  reporter?: JiraUser | null;
  created?: string;
  updated?: string;
  labels?: string[];
  issuetype?: { name?: string };
  project?: { key?: string; name?: string };
  // カスタムフィールド
  customfield_10276?: { value?: string } | null; // 月
  customfield_10277?: { value?: string } | null; // 担当
  customfield_10278?: { value?: string } | null; // GIG状況
  customfield_10279?: { value?: string } | null; // 開発検証
  customfield_10280?: { value?: string } | null; // 本番検証
  customfield_10281?: string | null; // リリース予定日 (date型)
  customfield_10282?: string | null; // 完了日 (date型)
  customfield_10283?: string | null; // 希望リリース日 (date型)
  customfield_10284?: string | null; // 限界リリース日 (date型)
  customfield_10291?: { value?: string } | null; // 影響業務
  customfield_10292?: { value?: string } | null; // 業務影響度
  comment?: {
    comments?: Array<{
      body?: any;
      created?: string;
      updateAuthor?: JiraUser;
    }>;
  };
}

interface JiraIssueResponse {
  key: string;
  fields: JiraIssueField;
}

interface JiraSearchQueryResult {
  total: number;
  results: JiraIssueResponse[];
  startAt: number;
  maxResults: number;
}

interface LanceDbRecord {
  issue_key: string;
  title: string;
  content: string;
  status: string;
  status_category: string;
  priority: string;
  assignee: string;
  reporter: string;
  updated_at: string;
  created_at: string;
  labels_text: string;
  issue_type: string;
  project_key: string;
  project_name: string;
  impact_domain: string;
  impact_level: string;
  dev_validation: string;
  prod_validation: string;
  url: string;
  [key: string]: unknown; // インデックスシグネチャを追加してRecord<string, unknown>に互換性を持たせる
}

interface JiraSearchBatchResponse {
  issues: JiraIssueResponse[];
  startAt?: number;
  maxResults?: number;
  isLast?: boolean;
}

export class JiraSyncService {
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly apiToken: string;
  private readonly projectKey: string;
  private readonly pageSize = 100;
  private readonly maxIssues: number;

  constructor(maxIssues?: number) {
    this.baseUrl = process.env.JIRA_BASE_URL || process.env.CONFLUENCE_BASE_URL || '';
    this.email = process.env.JIRA_USER_EMAIL || process.env.CONFLUENCE_USER_EMAIL || '';
    this.apiToken = process.env.JIRA_API_TOKEN || process.env.CONFLUENCE_API_TOKEN || '';
    this.projectKey = process.env.JIRA_PROJECT_KEY || '';
    this.maxIssues = maxIssues || parseInt(process.env.JIRA_MAX_ISSUES || '1000', 10);

    if (!this.baseUrl || !this.email || !this.apiToken || !this.projectKey) {
      throw new Error('Jira同期に必要な環境変数 (JIRA_BASE_URL, JIRA_USER_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY) が不足しています。');
    }
  }

  async syncAllIssues(): Promise<JiraSyncResult> {
    const startedAt = new Date();
    const syncJobRef = firestore.collection('jiraSyncJobs').doc(startedAt.toISOString());

    const issues = await this.fetchAllIssues();
    const lanceDbRecords: LanceDbRecord[] = [];

    let stored = 0;
    let skipped = 0;

    for (const issue of issues) {
      try {
        if (!issue || !issue.key) {
          console.warn(`⚠️ 無効なissueをスキップ: ${JSON.stringify(issue).substring(0, 100)}`);
          skipped += 1;
          continue;
        }
        const normalized = this.normalizeIssue(issue);
        await this.saveIssueToFirestore(normalized);
        lanceDbRecords.push(this.toLanceDbRecord(normalized));
        stored += 1;
      } catch (error) {
        const issueKey = issue?.key || 'unknown';
        console.error(`❌ Jira issue 保存中にエラー (${issueKey}):`, error instanceof Error ? error.message : error);
        skipped += 1;
      }
    }

    const lanceDbCount = await this.writeLanceDbRecords(lanceDbRecords);

    const finishedAt = new Date();
    await syncJobRef.set({
      startedAt: admin.firestore.Timestamp.fromDate(startedAt),
      finishedAt: admin.firestore.Timestamp.fromDate(finishedAt),
      totalIssues: issues.length,
      storedIssues: stored,
      skippedIssues: skipped,
      lanceDbRecords: lanceDbCount,
      projectKey: this.projectKey,
      status: 'completed'
    });

    return {
      totalIssues: issues.length,
      storedIssues: stored,
      skippedIssues: skipped,
      lanceDbRecords: lanceDbCount
    };
  }

  private async fetchAllIssues(): Promise<JiraIssueResponse[]> {
    const issues: JiraIssueResponse[] = [];
    let startAt = 0;
    let isLast = false;

    console.log(`📊 最大取得件数: ${this.maxIssues}件`);

    while (!isLast && issues.length < this.maxIssues) {
      const batch = await this.fetchIssuesBatch(startAt);
      const batchIssues = batch.issues || [];
      
      // 最大件数に達するまで追加
      const remaining = this.maxIssues - issues.length;
      if (remaining > 0) {
        issues.push(...batchIssues.slice(0, remaining));
      }
      
      console.log(`📥 Jira issues fetched: ${issues.length} / ${this.maxIssues}`);

      if (batchIssues.length === 0 || issues.length >= this.maxIssues) {
        break;
      }

      isLast = batch.isLast === true || batchIssues.length < this.pageSize;
      startAt += batchIssues.length;
    }

    console.log(`✅ 取得完了: ${issues.length}件`);
    return issues;
  }

  private async fetchIssuesBatch(startAt: number): Promise<JiraSearchBatchResponse> {
    const jql = `project = "${this.projectKey}" ORDER BY updated DESC`;
    const encodedJql = encodeURIComponent(jql);
    
    // テストスクリプトと同じエンドポイントを使用
    // カスタムフィールドも含めて取得
    const searchUrl = new URL(
      `/rest/api/3/search/jql?jql=${encodedJql}&fields=summary,description,status,priority,assignee,reporter,created,updated,labels,issuetype,project,customfield_10276,customfield_10277,customfield_10278,customfield_10279,customfield_10280,customfield_10281,customfield_10282,customfield_10283,customfield_10284,customfield_10291,customfield_10292,comment&startAt=${startAt}&maxResults=${this.pageSize}`,
      this.baseUrl
    );

    const headers = {
      Authorization: `Basic ${Buffer.from(`${this.email}:${this.apiToken}`).toString('base64')}`,
      Accept: 'application/json'
    };

    console.log(`🌐 Fetching Jira issues: startAt=${startAt}`);

    const res = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jira API error ${res.status} ${res.statusText}: ${body}`);
    }

    const data = (await res.json()) as any;
    
    // Jira API v3のレスポンス構造に合わせて変換
    return {
      issues: data.issues || [],
      startAt: data.startAt,
      maxResults: data.maxResults,
      isLast: data.startAt + data.issues.length >= data.total
    };
  }

  private normalizeIssue(issue: JiraIssueResponse) {
    if (!issue || !issue.fields) {
      throw new Error(`Invalid issue structure: ${JSON.stringify(issue)}`);
    }

    const fields = issue.fields;
    const description = this.extractTextFromADF(fields.description);
    const latestComment = this.extractLatestComment(fields.comment?.comments || []);

    return {
      key: issue.key,
      summary: fields.summary || '',
      description,
      latestComment,
      status: fields.status?.name || '',
      statusCategory: fields.status?.statusCategory?.name || '',
      priority: fields.priority?.name || '',
      assignee: fields.assignee?.displayName || '(unassigned)',
      reporter: fields.reporter?.displayName || '(unknown)',
      created: fields.created || '',
      updated: fields.updated || '',
      labels: fields.labels || [],
      issueType: fields.issuetype?.name || '',
      projectKey: fields.project?.key || '',
      projectName: fields.project?.name || '',
      // カスタムフィールド
      month: fields.customfield_10276?.value || '', // 月
      customAssignee: fields.customfield_10277?.value || '', // 担当
      gigStatus: fields.customfield_10278?.value || '', // GIG状況
      devValidation: fields.customfield_10279?.value || '', // 開発検証
      prodValidation: fields.customfield_10280?.value || '', // 本番検証
      releaseDate: fields.customfield_10281 || '', // リリース予定日
      completedDate: fields.customfield_10282 || '', // 完了日
      desiredReleaseDate: fields.customfield_10283 || '', // 希望リリース日
      deadlineReleaseDate: fields.customfield_10284 || '', // 限界リリース日
      impactDomain: fields.customfield_10291?.value || '', // 影響業務
      impactLevel: fields.customfield_10292?.value || '' // 業務影響度
    };
  }

  private async saveIssueToFirestore(data: ReturnType<typeof this.normalizeIssue>) {
    const docRef = firestore.collection('jiraIssues').doc(data.key);
    await docRef.set({
      ...data,
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      url: this.buildIssueUrl(data.key)
    }, { merge: true });
  }

  private toLanceDbRecord(issue: ReturnType<typeof this.normalizeIssue>): LanceDbRecord {
    const metadata = [
      `ステータス: ${issue.status}`,
      `カテゴリ: ${issue.statusCategory}`,
      `優先度: ${issue.priority}`,
      `担当: ${issue.assignee}`,
      `報告者: ${issue.reporter}`,
      `影響業務: ${issue.impactDomain || '(未設定)'}`,
      `業務影響度: ${issue.impactLevel || '(未設定)'}`,
      `開発検証: ${issue.devValidation || '(未設定)'}`,
      `本番検証: ${issue.prodValidation || '(未設定)'}`
    ].join('\n');

    const sections = [metadata];
    if (issue.description) {
      sections.push('', issue.description);
    }
    if (issue.latestComment) {
      sections.push('', `最新コメント:\n${issue.latestComment}`);
    }

    return {
      issue_key: issue.key,
      title: issue.summary,
      content: sections.join('\n'),
      status: issue.status,
      status_category: issue.statusCategory,
      priority: issue.priority,
      assignee: issue.assignee,
      reporter: issue.reporter,
      updated_at: issue.updated,
      created_at: issue.created,
      labels_text: issue.labels.join(', '),
      issue_type: issue.issueType,
      project_key: issue.projectKey,
      project_name: issue.projectName,
      impact_domain: issue.impactDomain,
      impact_level: issue.impactLevel,
      dev_validation: issue.devValidation,
      prod_validation: issue.prodValidation,
      url: this.buildIssueUrl(issue.key)
    };
  }

  private async writeLanceDbRecords(records: LanceDbRecord[]): Promise<number> {
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const tableName = 'jira_issues';
    const db = await connectLanceDB(dbPath);
    const tableNames = await db.tableNames();

    if (tableNames.includes(tableName)) {
      console.log('🧹 既存の jira_issues テーブルを削除します');
      await db.dropTable(tableName);
    }

    if (records.length === 0) {
      console.log('⚠️ LanceDB に投入するレコードがありません');
      return 0;
    }

    console.log(`🗃️ LanceDB テーブル '${tableName}' を作成中 (${records.length}件)`);
    await db.createTable(tableName, records);
    return records.length;
  }

  private extractTextFromADF(node: any): string {
    if (!node) {
      return '';
    }

    switch (node.type) {
      case 'doc':
        return (node.content || []).map((child: any) => this.extractTextFromADF(child)).join('\n');
      case 'paragraph':
        return (node.content || []).map((child: any) => this.extractTextFromADF(child)).join('');
      case 'text':
        return node.text || '';
      case 'hardBreak':
        return '\n';
      case 'bulletList':
        return (node.content || [])
          .map((item: any) => `- ${this.extractTextFromADF(item)}`)
          .join('\n');
      case 'orderedList':
        return (node.content || [])
          .map((item: any, index: number) => `${index + 1}. ${this.extractTextFromADF(item)}`)
          .join('\n');
      case 'listItem':
        return (node.content || []).map((child: any) => this.extractTextFromADF(child)).join('');
      case 'blockquote':
        return (node.content || []).map((child: any) => this.extractTextFromADF(child)).join('\n');
      case 'table':
        return (node.content || [])
          .map((row: any) => (row.content || [])
            .map((cell: any) => this.extractTextFromADF(cell).trim())
            .join(' | '))
          .join('\n');
      default:
        if (Array.isArray(node.content)) {
          return node.content.map((child: any) => this.extractTextFromADF(child)).join('');
        }
        return '';
    }
  }

  private extractLatestComment(comments: Array<{ body?: any; created?: string; updateAuthor?: JiraUser; }>): string {
    if (!comments || comments.length === 0) {
      return '';
    }

    const sorted = comments
      .slice()
      .sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime());
    const latest = sorted[0];
    const author = latest.updateAuthor?.displayName || '(unknown)';
    const created = latest.created || '';
    const text = this.extractTextFromADF(latest.body);
    return `投稿者: ${author}\n投稿日: ${created}\n${text}`.trim();
  }

  private buildIssueUrl(issueKey: string): string {
    return `${this.baseUrl}/browse/${issueKey}`;
  }
}

