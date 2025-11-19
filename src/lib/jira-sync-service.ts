import 'dotenv/config';

import { connect as connectLanceDB } from '@lancedb/lancedb';
import admin from 'firebase-admin';
import * as path from 'path';
import fetch from 'node-fetch';

import { initializeFirebaseAdmin } from './firebase-admin-init';
import { getEmbeddings } from './embeddings';
import { appConfig } from '@/config/app-config';

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
  id: string; // issue_keyをidとして使用
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
  impact_domain: string;
  impact_level: string;
  dev_validation: string;
  prod_validation: string;
  url: string;
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

    let stored = 0;
    let skipped = 0;
    let added = 0;
    let updated = 0;
    let unchanged = 0;

    console.log(`📝 Firestoreへの保存を開始します (${issues.length}件)`);
    
    // バッチ処理用に正規化されたissueを収集
    const normalizedIssues: Array<{ issue: ReturnType<typeof this.normalizeIssue>; original: JiraIssueResponse }> = [];
    
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      try {
        if (!issue || !issue.key) {
          console.warn(`⚠️ 無効なissueをスキップ: ${JSON.stringify(issue).substring(0, 100)}`);
          skipped += 1;
          continue;
        }
        const normalized = this.normalizeIssue(issue);
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
            // 全コメント履歴を抽出
            const allComments = this.extractAllComments(original.fields?.comment?.comments || []);
            
            batch.set(docRef, {
              ...normalized,
              // rawデータをJSON文字列として保存（20レベル制限を回避）
              // 必要に応じて JSON.parse() で復元可能
              rawJson: JSON.stringify(original),
              // 全コメント履歴を配列としても保存（検索しやすくするため）
              comments: allComments,
              syncedAt: admin.firestore.FieldValue.serverTimestamp(),
              url: this.buildIssueUrl(normalized.key)
            }, { merge: true });
            lanceDbRecords.push(this.toLanceDbRecord(normalized));
            
            if (changeType === 'added') {
              console.log(`➕ 新規追加: ${normalized.key} - ${normalized.summary.substring(0, 50)}`);
            } else if (changeType === 'updated') {
              const timeDiff = existingUpdated && jiraUpdated 
                ? new Date(jiraUpdated).getTime() - new Date(existingUpdated).getTime()
                : 0;
              console.log(`🔄 更新: ${normalized.key} - ${normalized.summary.substring(0, 50)} (${timeDiff}ms新しい)`);
            }
          } else {
            // 変更なしの場合はLanceDBレコードにも追加（既存データを使用）
            // ただし、LanceDBは全件再構築するため、ここではスキップ
            // LanceDBは変更があったもののみ再生成する方が効率的だが、
            // 現状の実装では全件再構築しているため、変更なしのものも含める
            // 将来的にはLanceDBも差分更新に変更することを検討
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
    console.log(`🗃️ LanceDBへの書き込みを開始します (${lanceDbRecords.length}件)`);
    const lanceDbCount = await this.writeLanceDbRecords(lanceDbRecords);
    console.log(`✅ LanceDBへの書き込みが完了しました (${lanceDbCount}件)`);

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

    // ベクトル生成用のテキスト（タイトル + コンテンツ）
    const vectorText = `${issue.summary}\n${sections.join('\n')}`;
    
    return {
      id: issue.key, // issue_keyをidとして使用
      issue_key: issue.key,
      title: issue.summary,
      content: sections.join('\n'),
      vector: [], // 後で生成（writeLanceDbRecordsで）
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
      url: this.buildIssueUrl(issue.key),
      _vectorText: vectorText // ベクトル生成用テキスト（一時的なフィールド）
    } as LanceDbRecord & { _vectorText: string };
  }

  private async writeLanceDbRecords(records: (LanceDbRecord & { _vectorText?: string })[]): Promise<number> {
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
    console.log(`🗃️ LanceDB テーブル '${tableName}' を作成中...`);
    
    await db.createTable(tableName, recordsWithVectors);
    console.log(`✅ LanceDB テーブル '${tableName}' 作成完了`);
    
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

