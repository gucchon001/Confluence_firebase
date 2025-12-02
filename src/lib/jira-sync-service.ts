import 'dotenv/config';

import { connect as connectLanceDB } from '@lancedb/lancedb';
import admin from 'firebase-admin';
import * as path from 'path';
import fetch from 'node-fetch';

import { initializeFirebaseAdmin } from './firebase-admin-init';
import { getEmbeddings } from './embeddings';
import { appConfig } from '@/config/app-config';
import { chunkText } from './text-chunking';
import { semanticChunkText } from './semantic-chunking';

initializeFirebaseAdmin();

const firestore = admin.firestore();

export interface JiraSyncResult {
  totalIssues: number;
  storedIssues: number;
  skippedIssues: number;
  lanceDbRecords: number;
  added: number;
  updated: number;
  unchanged: number;
}

interface JiraUser {
  displayName?: string;
}

interface ChangelogHistory {
  id: string;
  created: string;
  author: {
    displayName?: string;
  };
  items: Array<{
    field: string;
    fieldtype: string;
    from?: string | null;
    fromString?: string | null;
    to?: string | null;
    toString?: string | null;
  }>;
}

interface ChangelogResponse {
  histories?: ChangelogHistory[];
  maxResults?: number;
  startAt?: number;
  total?: number;
}

interface NormalizedChangelogItem {
  id: string;
  field: string;
  from: string;
  to: string;
  changedAt: string;
  changedBy: string;
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

// LanceDBのcreateTableは Record<string, unknown>[] を期待しているため、
// 型定義を Record<string, unknown> に互換性を持たせる
type LanceDbRecord = Record<string, unknown> & {
  id: string; // issue_keyをidとして使用（チャンク分割なし）または issue_key-chunkIndex（チャンク分割あり）
  issue_key: string;
  title: string;
  content: string;
  vector: number[]; // 768次元のベクトル
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
  // カスタムフィールド
  month: string; // 月 (customfield_10276)
  custom_assignee: string; // 担当 (customfield_10277)
  gig_status: string; // GIG状況 (customfield_10278)
  dev_validation: string; // 開発検証 (customfield_10279)
  prod_validation: string; // 本番検証 (customfield_10280)
  release_date: string; // リリース予定日 (customfield_10281)
  completed_date: string; // 完了日 (customfield_10282)
  desired_release_date: string; // 希望リリース日 (customfield_10283)
  deadline_release_date: string; // 限界リリース日 (customfield_10284)
  impact_domain: string; // 影響業務 (customfield_10291)
  impact_level: string; // 業務影響度 (customfield_10292)
  url: string;
  // チャンク分割関連フィールド
  isChunked?: boolean; // チャンク分割されているかどうか
  chunkIndex?: number; // チャンクのインデックス（0, 1, 2, ...）
  totalChunks?: number; // 総チャンク数
}

interface JiraSearchBatchResponse {
  issues: JiraIssueResponse[];
  startAt?: number;
  maxResults?: number;
  total?: number;
  isLast?: boolean;
  nextPageToken?: string;
}

export class JiraSyncService {
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly apiToken: string;
  private readonly projectKey: string;
  private readonly pageSize = 100;
  private readonly maxIssues: number;
  
  // レート制限対策: リクエスト間隔（ミリ秒）
  // 環境変数で調整可能（デフォルト: 100ms = 10 req/sec）
  private readonly REQUEST_DELAY_MS = process.env.JIRA_REQUEST_DELAY_MS 
    ? parseInt(process.env.JIRA_REQUEST_DELAY_MS, 10) 
    : 100;
  private lastRequestTime: number = 0;

  constructor(maxIssues?: number) {
    // 統合設定ファイルからJira設定を取得（型安全で検証済み）
    // Jira固有の設定がない場合はConfluence設定をフォールバックとして使用
    this.baseUrl = appConfig.jira.baseUrl;
    this.email = appConfig.jira.userEmail;
    this.apiToken = appConfig.jira.apiToken;
    this.projectKey = appConfig.jira.projectKey;
    
    // maxIssuesが明示的に指定されている場合はそれを使用、そうでない場合は統合設定から取得
    if (maxIssues !== undefined) {
      this.maxIssues = maxIssues;
    } else {
      this.maxIssues = appConfig.jira.maxIssues; // デフォルト値: 1000
    }

    // 統合設定ファイルで検証済みだが、projectKeyは空文字の可能性があるため再チェック
    if (!this.baseUrl || !this.email || !this.apiToken || !this.projectKey) {
      throw new Error('Jira同期に必要な設定が不足しています。JIRA_PROJECT_KEY を設定してください。');
    }
  }

  async syncAllIssues(): Promise<JiraSyncResult> {
    const startedAt = new Date();
    const syncJobRef = firestore.collection('jiraSyncJobs').doc(startedAt.toISOString());

    const issues = await this.fetchAllIssues();
    const lanceDbRecords: LanceDbRecord[] = [];
    const needsLanceDbBootstrap = await this.isJiraLanceDbEmpty();

    let stored = 0;
    let skipped = 0;
    let added = 0;
    let updated = 0;
    let unchanged = 0;

    console.log(`📝 Firestoreへの保存を開始します (${issues.length}件)`);
    
    // バッチ処理用に正規化されたissueを収集
    const normalizedIssues: Array<{ issue: ReturnType<typeof this.normalizeIssue>; original: JiraIssueResponse }> = [];
    
    // コメントが20件以上ある課題を特定（/rest/api/3/search/jqlでは20件に制限されている）
    const issuesNeedingFullComments: string[] = [];
    for (const issue of issues) {
      if (issue?.fields?.comment?.comments && issue.fields.comment.comments.length >= 20) {
        issuesNeedingFullComments.push(issue.key);
      }
    }

    if (issuesNeedingFullComments.length > 0) {
      console.log(`📝 ${issuesNeedingFullComments.length}件の課題について、全コメントを個別に取得します...`);
    }

    console.log(`📜 全課題について、変更履歴を個別に取得します (${issues.length}件)...`);

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      try {
        if (!issue || !issue.key) {
          console.warn(`⚠️ 無効なissueをスキップ: ${JSON.stringify(issue).substring(0, 100)}`);
          skipped += 1;
          continue;
        }
        const normalized = this.normalizeIssue(issue);
        
        // コメントが20件以上ある場合は、個別に全コメントを取得
        if (issuesNeedingFullComments.includes(issue.key)) {
          const allComments = await this.fetchAllCommentsForIssue(issue.key);
          if (allComments.length > 0) {
            normalized.allComments = allComments;
            console.log(`  ✅ ${issue.key}: ${allComments.length}件のコメントを取得しました`);
          }
        }
        
        // 変更履歴を個別に取得
        const changelog = await this.fetchChangelogForIssue(issue.key);
        if (changelog.length > 0) {
          normalized.changelog = changelog;
        }
        
        // 進捗ログ（50件ごと）
        if ((i + 1) % 50 === 0) {
          console.log(`  📊 進捗: ${i + 1} / ${issues.length}件処理完了`);
        }
        
        normalizedIssues.push({ issue: normalized, original: issue });
      } catch (error) {
        const issueKey = issue?.key || 'unknown';
        console.error(`❌ Jira issue 正規化中にエラー (${issueKey}):`, error instanceof Error ? error.message : error);
        skipped += 1;
      }
    }
    
    // Firestoreへのバッチ書き込み（rawJsonを含むため、サイズ制限を考慮して50件ずつ）
    // Firestoreの1バッチあたりのペイロードサイズ制限は約11MB
    const BATCH_SIZE = 50;
    const progressInterval = Math.max(1, Math.floor(normalizedIssues.length / 10));
    
    for (let i = 0; i < normalizedIssues.length; i += BATCH_SIZE) {
      const batch = firestore.batch();
      const batchIssues = normalizedIssues.slice(i, i + BATCH_SIZE);
      
      // 既存データを一括取得して差分チェック
      const existingDocs = await Promise.all(
        batchIssues.map(({ issue }) => 
          firestore.collection('jiraIssues').doc(issue.key).get()
        )
      );
      
      for (let j = 0; j < batchIssues.length; j++) {
        const { issue: normalized, original } = batchIssues[j];
        const existingDoc = existingDocs[j];
        
        try {
          const docRef = firestore.collection('jiraIssues').doc(normalized.key);
          
          // 差分チェック: 既存データのupdatedと比較
          const existingUpdated = existingDoc?.exists ? existingDoc.data()?.updated : null;
          const jiraUpdated = normalized.updated || '';
          
          let shouldUpdate = false;
          let changeType: 'added' | 'updated' | 'unchanged' = 'unchanged';
          
          if (!existingDoc?.exists) {
            // 新規追加
            shouldUpdate = true;
            changeType = 'added';
            added++;
          } else if (existingUpdated && jiraUpdated) {
            // 更新日時を比較（1秒以内の差は同じとみなす）
            const existingDate = new Date(existingUpdated);
            const jiraDate = new Date(jiraUpdated);
            const timeDiff = jiraDate.getTime() - existingDate.getTime();
            const isSignificantlyNewer = timeDiff > 1000; // 1秒以上新しい場合のみ更新
            
            if (isSignificantlyNewer) {
              shouldUpdate = true;
              changeType = 'updated';
              updated++;
            } else {
              changeType = 'unchanged';
              unchanged++;
            }
          } else {
            // updatedフィールドがない場合は更新（安全のため）
            shouldUpdate = true;
            changeType = 'updated';
            updated++;
          }
          
          if (shouldUpdate) {
            batch.set(docRef, {
              ...normalized,
              // rawデータをJSON文字列として保存（20レベル制限を回避）
              // 必要に応じて JSON.parse() で復元可能
              rawJson: JSON.stringify(original),
              // 全コメント履歴を配列としても保存（検索しやすくするため）
              // normalizeIssueで既にallCommentsが取得されているため、それを使用
              comments: normalized.allComments || [],
              // 変更履歴を配列として保存
              changelog: normalized.changelog || [],
              syncedAt: admin.firestore.FieldValue.serverTimestamp(),
              url: this.buildIssueUrl(normalized.key)
            }, { merge: true });
            // チャンク分割対応: 複数のレコードを返す可能性がある
            const records = this.toLanceDbRecords(normalized);
            lanceDbRecords.push(...records);
            
            if (changeType === 'added') {
              console.log(`➕ 新規追加: ${normalized.key} - ${normalized.summary.substring(0, 50)}`);
            } else if (changeType === 'updated') {
              const timeDiff = existingUpdated && jiraUpdated 
                ? new Date(jiraUpdated).getTime() - new Date(existingUpdated).getTime()
                : 0;
              console.log(`🔄 更新: ${normalized.key} - ${normalized.summary.substring(0, 50)} (${timeDiff}ms新しい)`);
            }
          } else if (needsLanceDbBootstrap) {
            // LanceDBテーブルが空の場合は、既存データも再投入する
            // チャンク分割対応: 複数のレコードを返す可能性がある
            const records = this.toLanceDbRecords(normalized);
            lanceDbRecords.push(...records);
          } else {
            // 変更なし & LanceDBも最新の場合は何もしない
          }
        } catch (error) {
          console.error(`❌ Issue ${normalized.key} のFirestore保存準備中にエラー:`, error instanceof Error ? error.message : String(error));
          skipped += 1;
        }
      }
      
      try {
        await batch.commit();
      } catch (error) {
        console.error(`❌ バッチコミット中にエラーが発生しました。バッチ内の最初のissue: ${batchIssues[0]?.issue?.key || 'unknown'}`);
        throw error;
      }
      stored += batchIssues.filter((_, idx) => {
        const existingDoc = existingDocs[idx];
        if (!existingDoc?.exists) return true;
        const existingUpdated = existingDoc.data()?.updated;
        const jiraUpdated = batchIssues[idx].issue.updated;
        if (!existingUpdated || !jiraUpdated) return true;
        const timeDiff = new Date(jiraUpdated).getTime() - new Date(existingUpdated).getTime();
        return timeDiff > 1000;
      }).length;
      
      // 進捗ログ
      const processed = Math.min(i + BATCH_SIZE, normalizedIssues.length);
      if (processed % progressInterval === 0 || processed === normalizedIssues.length) {
        console.log(`📝 Firestore保存進捗: ${processed} / ${normalizedIssues.length} (${Math.round(processed / normalizedIssues.length * 100)}%)`);
        console.log(`  追加: ${added}, 更新: ${updated}, 変更なし: ${unchanged}`);
      }
    }

    console.log(`✅ Firestoreへの保存が完了しました`);
    console.log(`  📊 統計: 追加 ${added}件, 更新 ${updated}件, 変更なし ${unchanged}件, スキップ ${skipped}件`);
    
    let lanceDbCount = 0;
    if (lanceDbRecords.length > 0) {
      const modeLabel = needsLanceDbBootstrap ? '全件再構築モード' : '差分アップサートモード';
      console.log(`🗃️ LanceDBへの書き込みを開始します (${modeLabel} / 対象 ${lanceDbRecords.length}件)`);
      lanceDbCount = await this.writeLanceDbRecords(lanceDbRecords, { replaceAll: needsLanceDbBootstrap });
      console.log(`✅ LanceDBへの書き込みが完了しました (${lanceDbCount}件)`);
    } else {
      console.log('🗃️ LanceDBの更新は不要でした（差分なし）');
    }

    const finishedAt = new Date();
    await syncJobRef.set({
      startedAt: admin.firestore.Timestamp.fromDate(startedAt),
      finishedAt: admin.firestore.Timestamp.fromDate(finishedAt),
      totalIssues: issues.length,
      storedIssues: stored,
      skippedIssues: skipped,
      lanceDbRecords: lanceDbCount,
      added,
      updated,
      unchanged,
      projectKey: this.projectKey,
      status: 'completed'
    });

    return {
      totalIssues: issues.length,
      storedIssues: stored,
      skippedIssues: skipped,
      lanceDbRecords: lanceDbCount,
      added,
      updated,
      unchanged
    };
  }

  private async fetchAllIssues(): Promise<JiraIssueResponse[]> {
    const issues: JiraIssueResponse[] = [];
    let nextPageToken: string | undefined = undefined;
    let isLast = false;
    let effectiveMaxIssues = this.maxIssues;

    // maxIssuesが0の場合は全件取得モード（isLastがtrueになるまで取得）
    if (effectiveMaxIssues === 0) {
      effectiveMaxIssues = Infinity;
      console.log(`📊 全件取得モード: isLastがtrueになるまで取得します`);
    } else {
      console.log(`📊 最大取得件数: ${effectiveMaxIssues}件`);
    }

    while (!isLast && issues.length < effectiveMaxIssues) {
      const batch = await this.fetchIssuesBatch(nextPageToken);
      const batchIssues = batch.issues || [];
      
      // 最大件数に達するまで追加
      const remaining = effectiveMaxIssues - issues.length;
      if (remaining > 0) {
        issues.push(...batchIssues.slice(0, remaining));
      }
      
      console.log(`📥 Jira issues fetched: ${issues.length} / ${effectiveMaxIssues}`);

      if (batchIssues.length === 0 || issues.length >= effectiveMaxIssues) {
        break;
      }

      isLast = batch.isLast === true || batchIssues.length < this.pageSize;
      nextPageToken = batch.nextPageToken;
      
      // nextPageTokenがない場合は終了
      if (!nextPageToken && !isLast) {
        console.warn(`⚠️ nextPageTokenがありませんが、isLast=${isLast}です。終了します。`);
        isLast = true;
      }
    }

    console.log(`✅ 取得完了: ${issues.length}件`);
    return issues;
  }

  private async fetchIssuesBatch(nextPageToken?: string): Promise<JiraSearchBatchResponse> {
    const jql = `project = "${this.projectKey}" ORDER BY updated DESC`;
    const encodedJql = encodeURIComponent(jql);
    
    // テストスクリプトと同じエンドポイントを使用
    // カスタムフィールドも含めて取得
    // /rest/api/3/search/jqlエンドポイントはstartAtを無視するため、nextPageTokenを使用
    let searchUrl: URL;
    if (nextPageToken) {
      searchUrl = new URL(
        `/rest/api/3/search/jql?jql=${encodedJql}&fields=summary,description,status,priority,assignee,reporter,created,updated,labels,issuetype,project,customfield_10276,customfield_10277,customfield_10278,customfield_10279,customfield_10280,customfield_10281,customfield_10282,customfield_10283,customfield_10284,customfield_10291,customfield_10292,comment&nextPageToken=${encodeURIComponent(nextPageToken)}&maxResults=${this.pageSize}`,
        this.baseUrl
      );
    } else {
      searchUrl = new URL(
        `/rest/api/3/search/jql?jql=${encodedJql}&fields=summary,description,status,priority,assignee,reporter,created,updated,labels,issuetype,project,customfield_10276,customfield_10277,customfield_10278,customfield_10279,customfield_10280,customfield_10281,customfield_10282,customfield_10283,customfield_10284,customfield_10291,customfield_10292,comment&maxResults=${this.pageSize}`,
        this.baseUrl
      );
    }

    const headers = {
      Authorization: `Basic ${Buffer.from(`${this.email}:${this.apiToken}`).toString('base64')}`,
      Accept: 'application/json'
    };

    console.log(`🌐 Fetching Jira issues: ${nextPageToken ? `nextPageToken使用` : '最初のページ'}`);

    const res = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jira API error ${res.status} ${res.statusText}: ${body}`);
    }

    const data = (await res.json()) as any;
    
    // Jira API v3の新しいエンドポイント(/rest/api/3/search/jql)のレスポンス構造に合わせて変換
    // このエンドポイントはtotalを返さず、nextPageTokenとisLastを使用
    // startAtパラメータは無視されるため、nextPageTokenを使用する必要がある
    return {
      issues: data.issues || [],
      startAt: data.startAt,
      maxResults: data.maxResults || this.pageSize,
      total: data.total, // 新しいAPIではundefinedになる可能性がある
      isLast: data.isLast === true,
      nextPageToken: data.nextPageToken
    };
  }

  private normalizeIssue(issue: JiraIssueResponse) {
    if (!issue || !issue.fields) {
      throw new Error(`Invalid issue structure: ${JSON.stringify(issue)}`);
    }

    const fields = issue.fields;
    const description = this.extractTextFromADF(fields.description);
    const latestComment = this.extractLatestComment(fields.comment?.comments || []);
    // 注意: /rest/api/3/search/jqlではコメントが20件に制限されているため、
    // 全コメントを取得するには個別に/rest/api/3/issue/{issueKey}/commentを呼び出す必要がある
    // ただし、normalizeIssueは同期的な処理のため、ここではsearch/jqlから取得したコメントを使用
    // 全コメントは後でfetchAllCommentsForIssueメソッドで取得する
    const allComments = this.extractAllComments(fields.comment?.comments || []);

    return {
      key: issue.key,
      summary: fields.summary || '',
      description,
      latestComment, // 後方互換性のため保持
      allComments, // 全コメント履歴を追加
      changelog: undefined as NormalizedChangelogItem[] | undefined, // 後で設定
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
      // 日付フィールドは文字列に変換（オブジェクトの場合はISO文字列に変換）
      releaseDate: this.serializeField(fields.customfield_10281) || '', // リリース予定日
      completedDate: this.serializeField(fields.customfield_10282) || '', // 完了日
      desiredReleaseDate: this.serializeField(fields.customfield_10283) || '', // 希望リリース日
      deadlineReleaseDate: this.serializeField(fields.customfield_10284) || '', // 限界リリース日
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

  /**
   * IssueをLanceDBレコード（複数）に変換（チャンク分割対応）
   * contentフィールドが3000文字以上の場合はチャンク分割される
   */
  private toLanceDbRecords(issue: ReturnType<typeof this.normalizeIssue>): Array<LanceDbRecord & { _vectorText: string }> {
    const metadata = [
      `ステータス: ${issue.status}`,
      `カテゴリ: ${issue.statusCategory}`,
      `優先度: ${issue.priority}`,
      `担当: ${issue.assignee}`,
      `報告者: ${issue.reporter}`,
      // カスタムフィールドをメタデータに追加（ベクトル検索に含めるため）
      ...(issue.month ? [`月: ${issue.month}`] : []),
      ...(issue.customAssignee ? [`カスタム担当: ${issue.customAssignee}`] : []),
      ...(issue.gigStatus ? [`GIG状況: ${issue.gigStatus}`] : []),
      `影響業務: ${issue.impactDomain || '(未設定)'}`,
      `業務影響度: ${issue.impactLevel || '(未設定)'}`,
      `開発検証: ${issue.devValidation || '(未設定)'}`,
      `本番検証: ${issue.prodValidation || '(未設定)'}`,
      ...(issue.releaseDate ? [`リリース予定日: ${issue.releaseDate}`] : []),
      ...(issue.completedDate ? [`完了日: ${issue.completedDate}`] : []),
      ...(issue.desiredReleaseDate ? [`希望リリース日: ${issue.desiredReleaseDate}`] : []),
      ...(issue.deadlineReleaseDate ? [`限界リリース日: ${issue.deadlineReleaseDate}`] : [])
    ].join('\n');

    const sections = [metadata];
    if (issue.description) {
      sections.push('', issue.description);
    }
    
    // 全コメント履歴を追加（最新の1件ではなく、すべてのコメント）
    if (issue.allComments && issue.allComments.length > 0) {
      const commentsText = issue.allComments
        .map((comment, index) => {
          return `コメント${index + 1}:\n投稿者: ${comment.author}\n投稿日: ${comment.created}\n${comment.body}`;
        })
        .join('\n\n');
      sections.push('', `コメント履歴:\n${commentsText}`);
    } else if (issue.latestComment) {
      // 後方互換性のため、allCommentsがない場合はlatestCommentを使用
      sections.push('', `最新コメント:\n${issue.latestComment}`);
    }

    // 変更履歴を追加（時系列順：古い順）
    if (issue.changelog && issue.changelog.length > 0) {
      const changelogText = issue.changelog
        .map((change, index) => {
          return `変更${index + 1}:\n変更日時: ${change.changedAt}\n変更者: ${change.changedBy}\nフィールド: ${change.field}\n変更前: ${change.from}\n変更後: ${change.to}`;
        })
        .join('\n\n');
      sections.push('', `変更履歴:\n${changelogText}`);
    }

    // contentフィールドを構築
    const content = sections.join('\n');
    
    // ベクトル生成用のテキスト（タイトル + コンテンツ）
    const vectorText = `${issue.summary}\n${content}`;

    // 共通フィールドを定義
    const commonFields = {
      issue_key: issue.key,
      title: issue.summary,
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
      // カスタムフィールドをLanceDBレコードに追加
      month: issue.month,
      custom_assignee: issue.customAssignee,
      gig_status: issue.gigStatus,
      dev_validation: issue.devValidation,
      prod_validation: issue.prodValidation,
      release_date: issue.releaseDate,
      completed_date: issue.completedDate,
      desired_release_date: issue.desiredReleaseDate,
      deadline_release_date: issue.deadlineReleaseDate,
      impact_domain: issue.impactDomain,
      impact_level: issue.impactLevel,
      url: this.buildIssueUrl(issue.key),
      vector: [] as number[], // 後で生成（writeLanceDbRecordsで）
    };

    // チャンク分割の閾値チェック（3000文字以上）
    const CHUNK_THRESHOLD = 3000;
    const shouldChunk = content.length >= CHUNK_THRESHOLD;

    if (!shouldChunk) {
      // チャンク分割なし（既存の実装）
      return [{
        ...commonFields,
        id: issue.key, // issue_keyをidとして使用
        content,
        _vectorText: vectorText
      } as LanceDbRecord & { _vectorText: string }];
    }

    // チャンク分割が必要な場合（セマンティックチャンキングを使用）
    // 既存のパラメータ（1800文字、200文字オーバーラップ）を維持
    const chunks = semanticChunkText(content, {
      maxChunkSize: 1800,
      overlap: 200,
      respectSentenceBoundaries: true,
    });

    if (chunks.length === 0) {
      // チャンクが生成されなかった場合（通常は発生しない）
      return [{
        ...commonFields,
        id: issue.key,
        content,
        isChunked: false,
        _vectorText: vectorText
      } as LanceDbRecord & { _vectorText: string }];
    }

    // 各チャンクをレコードに変換
    const records: Array<LanceDbRecord & { _vectorText: string }> = chunks.map((chunk, index) => {
      // 各チャンクにタイトルを含める（Confluenceと同様）
      const chunkVectorText = chunks.length > 1 
        ? `${issue.summary}\n\n${issue.summary}\n\n${issue.summary}\n\n${chunk.text}`
        : vectorText;

      return {
        ...commonFields,
        id: chunks.length > 1 ? `${issue.key}-${index}` : issue.key,
        content: chunk.text,
        isChunked: chunks.length > 1,
        chunkIndex: chunks.length > 1 ? index : undefined,
        totalChunks: chunks.length > 1 ? chunks.length : undefined,
        _vectorText: chunkVectorText
      } as LanceDbRecord & { _vectorText: string };
    });

    return records;
  }

  /**
   * IssueをLanceDBレコード（単一）に変換（後方互換性のため残す）
   * @deprecated チャンク分割対応のため、toLanceDbRecordsを使用してください
   */
  private toLanceDbRecord(issue: ReturnType<typeof this.normalizeIssue>): LanceDbRecord {
    const records = this.toLanceDbRecords(issue);
    // 最初のレコードを返す（チャンク分割されている場合は最初のチャンク）
    return records[0];
  }

  private async isJiraLanceDbEmpty(): Promise<boolean> {
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const tableName = 'jira_issues';
    
    try {
      const db = await connectLanceDB(dbPath);
      const tableNames = await db.tableNames();
      
      if (!tableNames.includes(tableName)) {
        console.log('🛈 LanceDB jira_issuesテーブルが存在しないため、全件再構築を行います');
        return true;
      }
      
      const table = await db.openTable(tableName);
      const rowCount = await table.countRows();
      if (rowCount === 0) {
        console.log('🛈 LanceDB jira_issuesテーブルが空のため、全件再構築を行います');
        return true;
      }
      
      // チャンク分割フィールド（isChunked）の存在確認
      // 1件のレコードを取得して、isChunkedフィールドが存在するかチェック
      try {
        const sampleRecords = await table
          .query()
          .limit(1)
          .toArray();
        
        if (sampleRecords.length > 0) {
          const sampleRecord = sampleRecords[0];
          // isChunkedフィールドが存在しない場合（undefined）、チャンク分割対応前のテーブル
          if (sampleRecord.isChunked === undefined) {
            console.log('🛈 LanceDB jira_issuesテーブルにチャンク分割フィールド（isChunked）が存在しないため、全件再構築を行います');
            console.log('   チャンク分割機能を適用するため、テーブルを再構築します');
            return true;
          }
        }
      } catch (schemaCheckError) {
        // スキーマチェックでエラーが発生した場合、安全のため再構築
        console.warn('⚠️ テーブルスキーマの確認に失敗しました。安全のため全件再構築にフォールバックします:', schemaCheckError);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('⚠️ LanceDBの状態確認に失敗しました。安全のため全件再構築にフォールバックします:', error);
      return true;
    }
  }

  private async writeLanceDbRecords(
    records: (LanceDbRecord & { _vectorText?: string })[],
    options?: { replaceAll?: boolean }
  ): Promise<number> {
    if (records.length === 0) {
      console.log('⚠️ LanceDB に投入するレコードがありません');
      return 0;
    }

    const replaceAll = options?.replaceAll ?? false;
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const tableName = 'jira_issues';
    const db = await connectLanceDB(dbPath);
    let tableNames = await db.tableNames();
    let table: import('@lancedb/lancedb').Table | null = null;

    if (!replaceAll) {
      table = tableNames.includes(tableName)
        ? await db.openTable(tableName)
        : null;

      if (!table) {
        console.log(`🆕 LanceDBテーブル '${tableName}' が存在しないため新規作成します`);
        table = await db.createTable(tableName, [{
          id: 'dummy',
          issue_key: 'dummy',
          title: 'dummy',
          content: 'dummy',
          vector: new Array(768).fill(0),
          status: 'dummy',
          status_category: 'dummy',
          priority: 'dummy',
          assignee: 'dummy',
          reporter: 'dummy',
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          labels_text: '',
          issue_type: 'dummy',
          project_key: 'dummy',
          project_name: 'dummy',
          impact_domain: '',
          impact_level: '',
          dev_validation: '',
          prod_validation: '',
          url: '',
          // チャンク分割関連フィールド
          isChunked: false,
          chunkIndex: undefined,
          totalChunks: undefined
        }]);
        await table.delete('id = "dummy"');
      }
    }

    console.log(`📊 ベクトル生成中... (${records.length}件)`);
    
    // ベクトル生成をバッチ処理で実行（並列数制限とリトライ付き）
    const BATCH_SIZE = 50; // 1バッチあたりの件数
    const CONCURRENCY = 10; // バッチ内の並列数
    const MAX_RETRIES = 3; // 最大リトライ回数
    const RETRY_DELAY = 1000; // リトライ待機時間（ミリ秒）
    
    let processedCount = 0;
    const totalRecords = records.length;
    const progressInterval = Math.max(1, Math.floor(totalRecords / 20)); // 20回に分けて進捗表示
    const recordsWithVectors: LanceDbRecord[] = [];
    
    // リトライ付きでベクトル生成を実行する関数
    const generateEmbeddingWithRetry = async (
      record: LanceDbRecord & { _vectorText?: string },
      retryCount = 0
    ): Promise<LanceDbRecord> => {
      try {
        const vectorText = record._vectorText || `${record.title}\n${record.content}`;
        const vector = await getEmbeddings(vectorText);
        
        // _vectorTextフィールドを削除してベクトルを追加
        const { _vectorText, ...recordWithoutVectorText } = record;
        return {
          ...recordWithoutVectorText,
          vector
        } as LanceDbRecord;
      } catch (error) {
        if (retryCount < MAX_RETRIES) {
          console.warn(`⚠️ ベクトル生成エラー (リトライ ${retryCount + 1}/${MAX_RETRIES}): ${error instanceof Error ? error.message : String(error)}`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1))); // 指数バックオフ
          return generateEmbeddingWithRetry(record, retryCount + 1);
        } else {
          console.error(`❌ ベクトル生成失敗 (最大リトライ回数に達しました): ${error instanceof Error ? error.message : String(error)}`);
          throw error;
        }
      }
    };
    
    // 並列数を制限して処理する関数
    const processBatchWithConcurrency = async (
      batch: (LanceDbRecord & { _vectorText?: string })[]
    ): Promise<LanceDbRecord[]> => {
      const results: LanceDbRecord[] = [];
      for (let i = 0; i < batch.length; i += CONCURRENCY) {
        const chunk = batch.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(
          chunk.map(record => generateEmbeddingWithRetry(record))
        );
        results.push(...chunkResults);
        
        // 進捗ログ
        processedCount += chunkResults.length;
        if (processedCount % progressInterval === 0 || processedCount === totalRecords) {
          console.log(`📊 ベクトル生成進捗: ${processedCount} / ${totalRecords} (${Math.round(processedCount / totalRecords * 100)}%)`);
        }
      }
      return results;
    };
    
    // バッチ処理で実行
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(records.length / BATCH_SIZE);
      console.log(`📦 バッチ ${batchNumber}/${totalBatches} を処理中... (${batch.length}件)`);
      
      const batchResults = await processBatchWithConcurrency(batch);
      recordsWithVectors.push(...batchResults);
      
      // バッチ間で少し待機（APIレート制限対策）
      if (i + BATCH_SIZE < records.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5秒待機
      }
    }
    
    console.log(`✅ ベクトル生成完了 (${recordsWithVectors.length}件)`);
    
    if (replaceAll) {
      console.log('🧹 LanceDB jira_issuesテーブルを全件再構築します');
      // 最新のテーブル一覧を取得し直す（この関数内で作成した可能性があるため）
      tableNames = await db.tableNames();
      if (tableNames.includes(tableName)) {
        await db.dropTable(tableName);
      }
      await db.createTable(tableName, recordsWithVectors);
      console.log(`✅ LanceDB テーブル '${tableName}' を再作成しました (${recordsWithVectors.length}件)`);
    } else {
      console.log('🔁 差分アップサートを実行します');
      const UPSERT_BATCH_SIZE = 25;
      for (let i = 0; i < recordsWithVectors.length; i += UPSERT_BATCH_SIZE) {
        const batch = recordsWithVectors.slice(i, i + UPSERT_BATCH_SIZE);
        
        // 既存レコードを削除
        // チャンク分割されたレコードの場合、同じissue_keyのすべてのチャンクを削除
        const uniqueIssueKeys = new Set<string>();
        for (const record of batch) {
          uniqueIssueKeys.add(record.issue_key as string);
        }
        
        for (const issueKey of uniqueIssueKeys) {
          const escapedIssueKey = issueKey.replace(/'/g, "''");
          try {
            // 同じissue_keyのすべてのレコード（チャンク含む）を削除
            await table!.delete(`"issue_key" = '${escapedIssueKey}'`);
          } catch (error) {
            console.warn(`⚠️ 既存レコード削除に失敗しました (issue_key=${issueKey}): ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        await table!.add(batch);
        console.log(`   ✅ アップサート進捗: ${Math.min(i + UPSERT_BATCH_SIZE, recordsWithVectors.length)} / ${recordsWithVectors.length}`);
      }
      console.log('✅ 差分アップサートが完了しました');
    }
    
    return recordsWithVectors.length;
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

  /**
   * 特定の課題の全コメントを取得（/rest/api/3/issue/{issueKey}/commentエンドポイントを使用）
   * /rest/api/3/search/jqlではコメントが20件に制限されているため、全コメントを取得するには個別に取得する必要がある
   */
  /**
   * 429エラー対応: リトライロジック付きHTTPリクエスト
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 5,
    baseDelay: number = 1000
  ): Promise<Response> {
    // スロットリング: リクエスト間隔を制御
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.REQUEST_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY_MS - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, options);
        
        // 429エラーの場合、Retry-Afterヘッダーを確認して待機
        if (res.status === 429) {
          const retryAfterHeader = res.headers.get('Retry-After');
          const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
          
          if (attempt < maxRetries) {
            // Retry-Afterヘッダーがあればその値を、なければ指数バックオフを使用
            const waitTime = retryAfter 
              ? retryAfter * 1000 
              : Math.min(baseDelay * Math.pow(2, attempt), 30000); // 最大30秒
            
            console.warn(`⚠️ レート制限検出 (429): ${waitTime}ms待機後にリトライします (試行 ${attempt + 1}/${maxRetries + 1})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        return res;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // ネットワークエラーなどの場合はリトライ
        if (attempt < maxRetries) {
          const waitTime = Math.min(baseDelay * Math.pow(2, attempt), 5000);
          console.warn(`⚠️ リクエストエラー: ${waitTime}ms待機後にリトライします (試行 ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
    }
    
    throw lastError || new Error('リクエストが失敗しました');
  }

  private async fetchAllCommentsForIssue(issueKey: string): Promise<Array<{
    id?: string;
    author: string;
    created: string;
    body: string;
  }>> {
    try {
      const commentUrl = `${this.baseUrl}/rest/api/3/issue/${issueKey}/comment`;
      const headers = {
        Authorization: `Basic ${Buffer.from(`${this.email}:${this.apiToken}`).toString('base64')}`,
        Accept: 'application/json'
      };

      const res = await this.fetchWithRetry(commentUrl, {
        method: 'GET',
        headers
      });

      if (!res.ok) {
        // エラーが発生した場合は、search/jqlから取得したコメントを使用（フォールバック）
        console.warn(`⚠️ 課題 ${issueKey} のコメント取得に失敗: ${res.status} ${res.statusText}`);
        return [];
      }

      const data = (await res.json()) as any;
      const comments = data.comments || [];

      // 作成日時でソート（古い順）
      const sorted = comments
        .slice()
        .sort((a: any, b: any) => new Date(a.created || 0).getTime() - new Date(b.created || 0).getTime());

      return sorted.map((comment: any) => ({
        id: comment.id,
        author: comment.updateAuthor?.displayName || comment.author?.displayName || '(unknown)',
        created: comment.created || '',
        body: this.extractTextFromADF(comment.body)
      }));
    } catch (error) {
      // エラーが発生した場合は、search/jqlから取得したコメントを使用（フォールバック）
      console.warn(`⚠️ 課題 ${issueKey} のコメント取得中にエラー:`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * 全コメント履歴を抽出して配列として返す
   * 注意: bodyRawは20レベル制限を回避するため含めない
   * 必要に応じてrawJsonから復元可能
   */
  private extractAllComments(comments: Array<{ body?: any; created?: string; updateAuthor?: JiraUser; id?: string; }>): Array<{
    id?: string;
    author: string;
    created: string;
    body: string;
  }> {
    if (!comments || comments.length === 0) {
      return [];
    }

    // 作成日時でソート（古い順）
    const sorted = comments
      .slice()
      .sort((a, b) => new Date(a.created || 0).getTime() - new Date(b.created || 0).getTime());

    return sorted.map(comment => ({
      id: comment.id,
      author: comment.updateAuthor?.displayName || '(unknown)',
      created: comment.created || '',
      body: this.extractTextFromADF(comment.body)
      // bodyRawは20レベル制限を回避するため含めない
      // 必要に応じてrawJsonから復元可能
    }));
  }

  /**
   * 特定の課題の変更履歴を取得（/rest/api/3/issue/{issueKey}/changelogエンドポイントを使用）
   * ステータス変更履歴、フィールド変更履歴などを取得
   */
  private async fetchChangelogForIssue(issueKey: string): Promise<NormalizedChangelogItem[]> {
    try {
      const changelogUrl = `${this.baseUrl}/rest/api/3/issue/${issueKey}?expand=changelog`;
      const headers = {
        Authorization: `Basic ${Buffer.from(`${this.email}:${this.apiToken}`).toString('base64')}`,
        Accept: 'application/json'
      };

      const res = await this.fetchWithRetry(changelogUrl, {
        method: 'GET',
        headers
      });

      if (!res.ok) {
        // エラーが発生した場合は空配列を返す（フォールバック）
        console.warn(`⚠️ 課題 ${issueKey} の変更履歴取得に失敗: ${res.status} ${res.statusText}`);
        return [];
      }

      const data = (await res.json()) as any;
      // expand=changelogを使用している場合、レスポンス構造が異なる
      // /rest/api/3/issue/{issueKey}?expand=changelog の場合、changelogはルートレベルにある
      const changelog = data.changelog || data;
      const histories = changelog.histories || [];

      // 作成日時でソート（古い順）
      const sorted = histories
        .slice()
        .sort((a, b) => new Date(a.created || 0).getTime() - new Date(b.created || 0).getTime());

      // 変更履歴を正規化
      const changelogItems: NormalizedChangelogItem[] = [];
      for (const history of sorted) {
        for (const item of history.items || []) {
          // フィールド名を日本語化（主要なフィールドのみ）
          const fieldName = this.translateFieldName(item.field);
          const fromValue = item.fromString || item.from || '(未設定)';
          const toValue = item.toString || item.to || '(未設定)';
          const changedBy = history.author?.displayName || '(unknown)';
          const changedAt = history.created || '';

          changelogItems.push({
            id: history.id,
            field: fieldName,
            from: String(fromValue),
            to: String(toValue),
            changedAt,
            changedBy
          });
        }
      }

      return changelogItems;
    } catch (error) {
      // エラーが発生した場合は空配列を返す（フォールバック）
      console.warn(`⚠️ 課題 ${issueKey} の変更履歴取得中にエラー:`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * フィールド名を日本語に翻訳
   */
  private translateFieldName(fieldName: string): string {
    const fieldNameMap: Record<string, string> = {
      'status': 'ステータス',
      'priority': '優先度',
      'assignee': '担当者',
      'reporter': '報告者',
      'summary': 'タイトル',
      'description': '説明',
      'labels': 'ラベル',
      'resolution': '解決',
      'created': '作成日時',
      'updated': '更新日時',
      'customfield_10276': '月',
      'customfield_10277': '担当',
      'customfield_10278': 'GIG状況',
      'customfield_10279': '開発検証',
      'customfield_10280': '本番検証',
      'customfield_10281': 'リリース予定日',
      'customfield_10282': '完了日',
      'customfield_10283': '希望リリース日',
      'customfield_10284': '限界リリース日',
      'customfield_10291': '影響業務',
      'customfield_10292': '業務影響度'
    };

    return fieldNameMap[fieldName] || fieldName;
  }

  /**
   * フィールド値をFirestore保存可能な形式に変換
   * オブジェクトの場合はJSON文字列に変換、日付の場合はISO文字列に変換
   */
  private serializeField(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object') {
      // 日付オブジェクトの場合はISO文字列に変換
      if (value instanceof Date) {
        return value.toISOString();
      }
      // その他のオブジェクトはJSON文字列に変換
      return JSON.stringify(value);
    }
    return String(value);
  }

  private buildIssueUrl(issueKey: string): string {
    return `${this.baseUrl}/browse/${issueKey}`;
  }
}

