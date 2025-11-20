/**
 * Jiraダッシュボード用の統計データ集計サービス
 */

import { initializeFirebaseAdmin } from './firebase-admin-init';
import admin from 'firebase-admin';
import { lancedbClient } from './lancedb-client';

initializeFirebaseAdmin();
const firestore = admin.firestore();

export interface JiraDashboardStats {
  total: number;
  byStatus: Record<string, number>;
  byStatusCategory: Record<string, number>;
  byAssignee: Record<string, number>;
  byPriority: Record<string, number>;
  byIssueType: Record<string, number>;
  byImpactDomain?: Record<string, number>;
  byImpactLevel?: Record<string, number>;
}

export interface JiraTrendData {
  period: string; // YYYY-MM-DD or YYYY-MM
  date: string;
  total: number;
  toDo: number;
  inProgress: number;
  done: number;
  completed: number; // 完了日ベース
}

export interface JiraDashboardFilters {
  period?: 'all' | '1month' | '3months' | 'custom';
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  granularity?: 'day' | 'week' | 'month';
  status?: string[];
  statusCategory?: string[];
  assignee?: string[];
  priority?: string[];
  issueType?: string[];
  completedStatusFilter?: string[]; // 完了件数推移のステータスフィルタ
  searchQuery?: string; // 個別案件検索用
}

export interface JiraIssue {
  issue_key: string;
  title: string;
  status: string;
  status_category: string;
  assignee: string;
  priority: string;
  issue_type: string;
  created_at: string;
  updated_at: string;
  url: string;
}

export interface JiraDashboardData {
  stats: JiraDashboardStats;
  trends: JiraTrendData[];
  filters: JiraDashboardFilters;
  issues?: JiraIssue[]; // 個別案件一覧
  totalIssues?: number; // 総件数（検索結果）
}

// モジュールレベルのキャッシュ（サーバーレス環境でも共有される）
// フィルタオプションのキャッシュ（5分間有効）
let filterOptionsCache: {
  data: {
    statuses: string[];
    statusCategories: string[];
    assignees: string[];
    priorities: string[];
    issueTypes: string[];
  } | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0
};
const FILTER_OPTIONS_CACHE_TTL = 5 * 60 * 1000; // 5分

// ダッシュボードデータのキャッシュ（3分間有効）
const dashboardDataCache: Map<string, {
  data: JiraDashboardData;
  timestamp: number;
}> = new Map();
const DASHBOARD_DATA_CACHE_TTL = 3 * 60 * 1000; // 3分

// 完了日のキャッシュ（10分間有効）
const completedDatesCache: Map<string, string> = new Map();
let completedDatesCacheTimestamp: number = 0;
const COMPLETED_DATES_CACHE_TTL = 10 * 60 * 1000; // 10分

class JiraDashboardService {

  /**
   * ダッシュボードデータを取得
   */
  async getDashboardData(filters: JiraDashboardFilters = {}): Promise<JiraDashboardData> {
    try {
      // キャッシュキーを生成（フィルタ条件を文字列化）
      const cacheKey = JSON.stringify(filters);
      const now = Date.now();
      
      // キャッシュをチェック
      const cached = dashboardDataCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < DASHBOARD_DATA_CACHE_TTL) {
        console.log('[JiraDashboardService] キャッシュからダッシュボードデータを取得', {
          cacheKey: cacheKey.substring(0, 100),
          age: Math.round((now - cached.timestamp) / 1000) + '秒前'
        });
        return cached.data;
      }

      console.log('[JiraDashboardService] ダッシュボードデータ取得開始', { filters });
      // LanceDBから全データを取得
      const db = await lancedbClient.getDatabase();
      console.log('[JiraDashboardService] LanceDB接続成功');
      const jiraTable = await db.openTable('jira_issues');
      console.log('[JiraDashboardService] jira_issuesテーブルを開きました');
      const allIssues = await jiraTable.query().toArray();
      console.log(`[JiraDashboardService] ${allIssues.length}件のIssueを取得しました`);

      // フィルタリング
      let filteredIssues = this.applyFilters(allIssues, filters);

      // 統計データを集計
      const stats = this.calculateStats(filteredIssues);

      // トレンドデータを集計
      const trends = await this.calculateTrends(filteredIssues, filters);

      // 個別案件一覧を取得（検索クエリがある場合、または常に取得）
      let issues: JiraIssue[] = [];
      if (filters.searchQuery || true) { // 常に取得（必要に応じて条件変更）
        issues = this.getIssuesList(filteredIssues, filters);
      }

      const result: JiraDashboardData = {
        stats,
        trends,
        filters,
        issues,
        totalIssues: filteredIssues.length
      };

      // キャッシュに保存
      dashboardDataCache.set(cacheKey, {
        data: result,
        timestamp: now
      });

      // 古いキャッシュをクリーンアップ（10件以上の場合）
      if (dashboardDataCache.size > 10) {
        const oldestKey = Array.from(dashboardDataCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        dashboardDataCache.delete(oldestKey);
      }
      
      console.log('[JiraDashboardService] ダッシュボードデータをキャッシュに保存', {
        cacheKey: cacheKey.substring(0, 100),
        cacheSize: dashboardDataCache.size
      });

      return result;
    } catch (error) {
      console.error('[JiraDashboardService] データ取得エラー:', error);
      if (error instanceof Error) {
        console.error('[JiraDashboardService] エラー詳細:', {
          message: error.message,
          stack: error.stack
        });
      }
      if (this.isJiraTableMissingError(error)) {
        console.warn('[JiraDashboardService] jira_issuesテーブルが存在しないため、空のダッシュボードデータを返します。');
        return this.createEmptyDashboardData(filters);
      }
      throw error;
    }
  }

  /**
   * フィルタを適用
   */
  private applyFilters(issues: any[], filters: JiraDashboardFilters): any[] {
    let filtered = [...issues];

    // 期間フィルタ
    if (filters.period && filters.period !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (filters.period) {
        case '1month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case '3months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case 'custom':
          if (filters.startDate) {
            startDate = new Date(filters.startDate);
          } else {
            return filtered;
          }
          break;
        default:
          return filtered;
      }

      const endDate = filters.endDate ? new Date(filters.endDate) : now;

      filtered = filtered.filter((issue: any) => {
        const createdDate = new Date(issue.created_at || 0);
        return createdDate >= startDate && createdDate <= endDate;
      });
    }

    // ステータスフィルタ
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter((issue: any) =>
        filters.status!.includes(issue.status)
      );
    }

    // ステータスカテゴリフィルタ
    if (filters.statusCategory && filters.statusCategory.length > 0) {
      filtered = filtered.filter((issue: any) =>
        filters.statusCategory!.includes(issue.status_category)
      );
    }

    // 担当者フィルタ
    if (filters.assignee && filters.assignee.length > 0) {
      filtered = filtered.filter((issue: any) =>
        filters.assignee!.includes(issue.assignee)
      );
    }

    // 優先度フィルタ
    if (filters.priority && filters.priority.length > 0) {
      filtered = filtered.filter((issue: any) =>
        filters.priority!.includes(issue.priority)
      );
    }

    // 課題タイプフィルタ
    if (filters.issueType && filters.issueType.length > 0) {
      filtered = filtered.filter((issue: any) =>
        filters.issueType!.includes(issue.issue_type)
      );
    }

    return filtered;
  }

  /**
   * 統計データを集計
   */
  private calculateStats(issues: any[]): JiraDashboardStats {
    const stats: JiraDashboardStats = {
      total: issues.length,
      byStatus: {},
      byStatusCategory: {},
      byAssignee: {},
      byPriority: {},
      byIssueType: {},
      byImpactDomain: {},
      byImpactLevel: {}
    };

    issues.forEach((issue: any) => {
      // ステータス別
      const status = issue.status || '(未設定)';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // ステータスカテゴリ別
      const statusCategory = issue.status_category || '(未設定)';
      stats.byStatusCategory[statusCategory] = (stats.byStatusCategory[statusCategory] || 0) + 1;

      // 担当者別
      const assignee = issue.assignee || '(未割当)';
      stats.byAssignee[assignee] = (stats.byAssignee[assignee] || 0) + 1;

      // 優先度別
      const priority = issue.priority || '(未設定)';
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

      // 課題タイプ別
      const issueType = issue.issue_type || '(未設定)';
      stats.byIssueType[issueType] = (stats.byIssueType[issueType] || 0) + 1;

      // 影響業務別（オプション）
      if (issue.impact_domain) {
        const impactDomain = issue.impact_domain || '(未設定)';
        stats.byImpactDomain![impactDomain] = (stats.byImpactDomain![impactDomain] || 0) + 1;
      }

      // 業務影響度別（オプション）
      if (issue.impact_level) {
        const impactLevel = issue.impact_level || '(未設定)';
        stats.byImpactLevel![impactLevel] = (stats.byImpactLevel![impactLevel] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * トレンドデータを集計
   */
  private async calculateTrends(issues: any[], filters: JiraDashboardFilters): Promise<JiraTrendData[]> {
    const granularity = filters.granularity || 'week';
    const trendsMap = new Map<string, JiraTrendData>();

    // Firestoreから完了日を取得（キャッシュを活用）
    const completedDatesMap = new Map<string, string>();
    try {
      const issueKeys = issues.map((issue: any) => issue.issue_key || issue.id).filter(Boolean);
      if (issueKeys.length > 0) {
        const startTime = Date.now();
        const now = Date.now();
        
        // キャッシュをチェック
        const useCache = (now - completedDatesCacheTimestamp) < COMPLETED_DATES_CACHE_TTL;
        const uncachedKeys: string[] = [];
        
        if (useCache && completedDatesCache.size > 0) {
          // キャッシュから取得
          issueKeys.forEach(key => {
            const cached = completedDatesCache.get(key);
            if (cached) {
              completedDatesMap.set(key, cached);
            } else {
              uncachedKeys.push(key);
            }
          });
          const cacheHitCount = issueKeys.length - uncachedKeys.length;
          console.log(`[JiraDashboardService] 完了日キャッシュヒット: ${cacheHitCount}/${issueKeys.length}件 (キャッシュサイズ: ${completedDatesCache.size}件)`);
        } else {
          // キャッシュが無効または空の場合、未キャッシュ分のみ取得
          issueKeys.forEach(key => {
            const cached = completedDatesCache.get(key);
            if (cached) {
              completedDatesMap.set(key, cached);
            } else {
              uncachedKeys.push(key);
            }
          });
          console.log(`[JiraDashboardService] 完了日キャッシュ: ${issueKeys.length - uncachedKeys.length}/${issueKeys.length}件ヒット、${uncachedKeys.length}件を取得 (キャッシュサイズ: ${completedDatesCache.size}件)`);
        }

        // キャッシュにないキーのみFirestoreから取得
        if (uncachedKeys.length > 0) {
          // FirestoreのgetAll()を使用してバッチ取得（最大10件ずつ）
          // これにより、個別のget()呼び出しよりも大幅に高速化
          const batchSize = 10; // FirestoreのgetAll()の制限
          for (let i = 0; i < uncachedKeys.length; i += batchSize) {
            const batch = uncachedKeys.slice(i, i + batchSize);
            try {
              // ドキュメント参照の配列を作成
              const docRefs = batch.map(key => firestore.collection('jiraIssues').doc(key));
              // バッチで一括取得
              const docs = await firestore.getAll(...docRefs);
              
              // 完了日を抽出してキャッシュに保存
              docs.forEach(doc => {
                if (doc.exists) {
                  const data = doc.data();
                  if (data?.completedDate) {
                    completedDatesMap.set(doc.id, data.completedDate);
                    completedDatesCache.set(doc.id, data.completedDate);
                  }
                }
              });
            } catch (error) {
              // バッチエラーは無視（データが存在しない場合など）
              console.warn(`[JiraDashboardService] バッチ取得エラー（続行）:`, error);
            }
          }
          
          // キャッシュタイムスタンプを更新
          if (uncachedKeys.length > 0) {
            completedDatesCacheTimestamp = now;
            console.log(`[JiraDashboardService] 完了日キャッシュを更新: ${uncachedKeys.length}件追加 (総キャッシュサイズ: ${completedDatesCache.size}件)`);
          }
        }
        
        const duration = Date.now() - startTime;
        if (duration > 1000) {
          console.warn(`[JiraDashboardService] 完了日取得に時間がかかりました: ${duration}ms (${issueKeys.length}件)`);
        }
      }
    } catch (error) {
      console.warn('[JiraDashboardService] 完了日取得エラー（続行）:', error);
    }

    issues.forEach((issue: any) => {
      const createdDate = new Date(issue.created_at || 0);
      const period = this.getPeriod(createdDate, granularity);

      if (!trendsMap.has(period)) {
        trendsMap.set(period, {
          period,
          date: this.getPeriodStartDate(period, granularity),
          total: 0,
          toDo: 0,
          inProgress: 0,
          done: 0,
          completed: 0
        });
      }

      const trend = trendsMap.get(period)!;
      trend.total += 1;

      const statusCategory = issue.status_category || '';
      if (statusCategory === 'To Do' || statusCategory === '未着手') {
        trend.toDo += 1;
      } else if (statusCategory === 'In Progress' || statusCategory === '進行中') {
        trend.inProgress += 1;
      } else if (statusCategory === 'Done' || statusCategory === '完了') {
        trend.done += 1;
      }

      // 完了日ベースの集計（ステータスフィルタを考慮）
      const issueKey = issue.issue_key || issue.id;
      if (issueKey && completedDatesMap.has(issueKey)) {
        // ステータスフィルタがある場合は、該当するステータスのみ集計
        const shouldInclude = !filters.completedStatusFilter || 
          filters.completedStatusFilter.length === 0 ||
          filters.completedStatusFilter.includes(issue.status) ||
          filters.completedStatusFilter.includes(issue.status_category);
        
        if (shouldInclude) {
          const completedDate = new Date(completedDatesMap.get(issueKey)!);
          const completedPeriod = this.getPeriod(completedDate, granularity);
          if (!trendsMap.has(completedPeriod)) {
            trendsMap.set(completedPeriod, {
              period: completedPeriod,
              date: this.getPeriodStartDate(completedPeriod, granularity),
              total: 0,
              toDo: 0,
              inProgress: 0,
              done: 0,
              completed: 0
            });
          }
          const completedTrend = trendsMap.get(completedPeriod)!;
          completedTrend.completed += 1;
        }
      }
    });

    // 期間でソート
    const trends = Array.from(trendsMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return trends;
  }

  /**
   * 期間を取得（日、週、または月）
   */
  private getPeriod(date: Date, granularity: 'day' | 'week' | 'month'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (granularity === 'day') {
      return `${year}-${month}-${day}`;
    } else if (granularity === 'week') {
      const week = Math.ceil(parseInt(day) / 7);
      return `${year}-${month}-W${week}`;
    } else {
      return `${year}-${month}`;
    }
  }

  /**
   * 期間の開始日を取得
   */
  private getPeriodStartDate(period: string, granularity: 'day' | 'week' | 'month'): string {
    if (granularity === 'day') {
      return period; // YYYY-MM-DD形式
    } else if (granularity === 'week') {
      const [year, month, week] = period.split('-');
      const weekNum = parseInt(week.replace('W', ''));
      const day = (weekNum - 1) * 7 + 1;
      return `${year}-${month}-${String(day).padStart(2, '0')}`;
    } else {
      return `${period}-01`;
    }
  }

  /**
   * 利用可能なフィルタオプションを取得（キャッシュ付き）
   */
  async getFilterOptions(): Promise<{
    statuses: string[];
    statusCategories: string[];
    assignees: string[];
    priorities: string[];
    issueTypes: string[];
  }> {
    // キャッシュをチェック
    const now = Date.now();
    if (filterOptionsCache.data && (now - filterOptionsCache.timestamp) < FILTER_OPTIONS_CACHE_TTL) {
      console.log('[JiraDashboardService] キャッシュからフィルタオプションを取得');
      return filterOptionsCache.data;
    }

    try {
      const startTime = Date.now();
      console.log('[JiraDashboardService] フィルタオプション取得開始');
      const db = await lancedbClient.getDatabase();
      console.log('[JiraDashboardService] LanceDB接続成功');
      const jiraTable = await db.openTable('jira_issues');
      console.log('[JiraDashboardService] jira_issuesテーブルを開きました');
      const allIssues = await jiraTable.query().toArray();
      console.log(`[JiraDashboardService] ${allIssues.length}件のIssueを取得しました`);

      const statuses = new Set<string>();
      const statusCategories = new Set<string>();
      const assignees = new Set<string>();
      const priorities = new Set<string>();
      const issueTypes = new Set<string>();

      allIssues.forEach((issue: any) => {
        if (issue.status) statuses.add(issue.status);
        if (issue.status_category) statusCategories.add(issue.status_category);
        if (issue.assignee) assignees.add(issue.assignee);
        if (issue.priority) priorities.add(issue.priority);
        if (issue.issue_type) issueTypes.add(issue.issue_type);
      });

      const result = {
        statuses: Array.from(statuses).sort(),
        statusCategories: Array.from(statusCategories).sort(),
        assignees: Array.from(assignees).sort(),
        priorities: Array.from(priorities).sort(),
        issueTypes: Array.from(issueTypes).sort()
      };

      // キャッシュに保存
      filterOptionsCache = {
        data: result,
        timestamp: now
      };

      const duration = Date.now() - startTime;
      console.log(`[JiraDashboardService] フィルタオプション取得完了 (${duration}ms)`);
      if (duration > 1000) {
        console.warn(`[JiraDashboardService] フィルタオプション取得に時間がかかりました: ${duration}ms`);
      }

      return result;
    } catch (error) {
      console.error('[JiraDashboardService] フィルタオプション取得エラー:', error);
      if (this.isJiraTableMissingError(error)) {
        console.warn('[JiraDashboardService] jira_issuesテーブルが存在しないため、空のフィルタオプションを返します。');
        const fallback = this.createEmptyFilterOptions();
        filterOptionsCache = {
          data: fallback,
          timestamp: Date.now()
        };
        return fallback;
      }
      throw error;
    }
  }

  private createEmptyFilterOptions() {
    return {
      statuses: [],
      statusCategories: [],
      assignees: [],
      priorities: [],
      issueTypes: []
    };
  }

  /**
   * 個別案件一覧を取得
   */
  private getIssuesList(issues: any[], filters: JiraDashboardFilters): JiraIssue[] {
    let result = issues.map((issue: any) => ({
      issue_key: issue.issue_key || issue.id || '',
      title: issue.title || '',
      status: issue.status || '',
      status_category: issue.status_category || '',
      assignee: issue.assignee || '',
      priority: issue.priority || '',
      issue_type: issue.issue_type || '',
      created_at: issue.created_at || '',
      updated_at: issue.updated_at || '',
      url: issue.url || ''
    }));

    // 検索クエリでフィルタ
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter((issue: JiraIssue) =>
        issue.issue_key.toLowerCase().includes(query) ||
        issue.title.toLowerCase().includes(query) ||
        issue.assignee.toLowerCase().includes(query) ||
        issue.status.toLowerCase().includes(query)
      );
    }

    // 更新日時でソート（新しい順）
    result.sort((a, b) => {
      const dateA = new Date(a.updated_at || 0).getTime();
      const dateB = new Date(b.updated_at || 0).getTime();
      return dateB - dateA;
    });

    return result;
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    dashboardDataCache.clear();
    completedDatesCache.clear();
    completedDatesCacheTimestamp = 0;
    filterOptionsCache.data = null;
    filterOptionsCache.timestamp = 0;
    console.log('[JiraDashboardService] キャッシュをクリアしました');
  }

  private isJiraTableMissingError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const message = error.message || '';
    return message.includes("Table 'jira_issues' was not found") ||
      message.includes('jira_issues.lance') ||
      (message.includes('Dataset at path') && message.includes('jira_issues'));
  }

  private createEmptyDashboardData(filters: JiraDashboardFilters): JiraDashboardData {
    return {
      stats: {
        total: 0,
        byStatus: {},
        byStatusCategory: {},
        byAssignee: {},
        byPriority: {},
        byIssueType: {}
      },
      trends: [],
      filters,
      issues: [],
      totalIssues: 0
    };
  }
}

export const jiraDashboardService = new JiraDashboardService();

