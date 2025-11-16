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

class JiraDashboardService {
  /**
   * ダッシュボードデータを取得
   */
  async getDashboardData(filters: JiraDashboardFilters = {}): Promise<JiraDashboardData> {
    try {
      // LanceDBから全データを取得
      const db = await lancedbClient.getDatabase();
      const jiraTable = await db.openTable('jira_issues');
      const allIssues = await jiraTable.query().toArray();

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

      return {
        stats,
        trends,
        filters,
        issues,
        totalIssues: filteredIssues.length
      };
    } catch (error) {
      console.error('[JiraDashboardService] データ取得エラー:', error);
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

    // Firestoreから完了日を取得
    const completedDatesMap = new Map<string, string>();
    try {
      const issueKeys = issues.map((issue: any) => issue.issue_key || issue.id).filter(Boolean);
      if (issueKeys.length > 0) {
        // バッチで取得（500件ずつ）
        const batchSize = 500;
        for (let i = 0; i < issueKeys.length; i += batchSize) {
          const batch = issueKeys.slice(i, i + batchSize);
          const promises = batch.map(async (key: string) => {
            try {
              const doc = await firestore.collection('jiraIssues').doc(key).get();
              if (doc.exists) {
                const data = doc.data();
                // completedDateフィールドを確認
                if (data?.completedDate) {
                  completedDatesMap.set(key, data.completedDate);
                }
              }
            } catch (error) {
              // エラーは無視（データが存在しない場合など）
            }
          });
          await Promise.all(promises);
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
   * 利用可能なフィルタオプションを取得
   */
  async getFilterOptions(): Promise<{
    statuses: string[];
    statusCategories: string[];
    assignees: string[];
    priorities: string[];
    issueTypes: string[];
  }> {
    try {
      const db = await lancedbClient.getDatabase();
      const jiraTable = await db.openTable('jira_issues');
      const allIssues = await jiraTable.query().toArray();

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

      return {
        statuses: Array.from(statuses).sort(),
        statusCategories: Array.from(statusCategories).sort(),
        assignees: Array.from(assignees).sort(),
        priorities: Array.from(priorities).sort(),
        issueTypes: Array.from(issueTypes).sort()
      };
    } catch (error) {
      console.error('[JiraDashboardService] フィルタオプション取得エラー:', error);
      throw error;
    }
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
}

export const jiraDashboardService = new JiraDashboardService();

