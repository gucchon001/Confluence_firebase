/**
 * マークダウン品質管理サービス
 * Firestoreでの品質問題の保存・管理
 */

import { getFirebaseFirestore } from '@/lib/firebase-unified';
import { collection, addDoc, query, orderBy, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { markdownQualityMonitor, type MarkdownQualityIssue, type MarkdownQualityReport } from '@/lib/markdown-quality-monitor';

const db = getFirebaseFirestore();

export class MarkdownQualityService {

  /**
   * モック品質レポートを生成
   */
  private getMockQualityReport(): MarkdownQualityReport {
    const mockIssues: MarkdownQualityIssue[] = [
      {
        id: 'mock-issue-1',
        postLogId: 'post-1',
        issueType: 'heading_spacing',
        severity: 'medium',
        description: '見出しの後にスペースがありません',
        originalText: '##詳細',
        expectedFormat: '## 詳細',
        detectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        resolved: false
      },
      {
        id: 'mock-issue-2',
        postLogId: 'post-2',
        issueType: 'bullet_point',
        severity: 'high',
        description: '箇条書きに無意味な文字が含まれています',
        originalText: '- ｘｘｘ文字',
        expectedFormat: '- 適切な箇条書き項目',
        detectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        resolved: true,
        resolvedAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
      }
    ];

    return markdownQualityMonitor.generateQualityReport(mockIssues);
  }

  /**
   * モック品質問題を生成
   */
  private getMockIssues(limit: number): MarkdownQualityIssue[] {
    const mockIssues: MarkdownQualityIssue[] = [];
    const issueTypes = ['heading_spacing', 'bullet_point', 'table_format', 'list_format', 'general'];
    const severities = ['low', 'medium', 'high', 'critical'];
    
    for (let i = 0; i < Math.min(limit, 10); i++) {
      const issueType = issueTypes[Math.floor(Math.random() * issueTypes.length)];
      const severity = severities[Math.floor(Math.random() * severities.length)];
      
      mockIssues.push({
        id: `mock-issue-${i}`,
        postLogId: `post-${i}`,
        issueType: issueType as any,
        severity: severity as any,
        description: `Mock issue description ${i + 1}`,
        originalText: `Mock original text ${i + 1}`,
        expectedFormat: `Mock expected format ${i + 1}`,
        detectedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
        resolved: Math.random() > 0.5
      });
    }
    
    return mockIssues;
  }

  /**
   * マークダウン品質問題を保存
   */
  async saveMarkdownIssues(issues: MarkdownQualityIssue[]): Promise<string[]> {
    try {
      const savedIds: string[] = [];
      const issuesRef = collection(db, 'markdownQualityIssues');
      
      for (const issue of issues) {
        const docRef = await addDoc(issuesRef, {
          ...issue,
          detectedAt: Timestamp.fromDate(issue.detectedAt),
          resolvedAt: issue.resolvedAt ? Timestamp.fromDate(issue.resolvedAt) : null
        });
        savedIds.push(docRef.id);
      }
      
      console.log(`✅ マークダウン品質問題を保存しました: ${savedIds.length}件`);
      return savedIds;
    } catch (error) {
      console.error('❌ マークダウン品質問題の保存に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 品質問題を解決済みにマーク
   */
  async resolveIssue(issueId: string): Promise<void> {
    try {
      const issueRef = doc(db, 'markdownQualityIssues', issueId);
      await updateDoc(issueRef, {
        resolved: true,
        resolvedAt: Timestamp.fromDate(new Date())
      });
      
      console.log(`✅ 品質問題を解決済みにマークしました: ${issueId}`);
    } catch (error) {
      console.error('❌ 品質問題の更新に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 未解決の品質問題を取得
   */
  async getUnresolvedIssues(limit: number = 50): Promise<MarkdownQualityIssue[]> {
    try {
      const issuesRef = collection(db, 'markdownQualityIssues');
      
      // インデックスエラーを回避するため、シンプルなクエリに変更
      const snapshot = await getDocs(issuesRef);
      
      const allIssues = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        detectedAt: doc.data().detectedAt.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate()
      })) as MarkdownQualityIssue[];

      // JavaScriptでフィルタリングとソート、制限を適用
      const unresolvedIssues = allIssues
        .filter(issue => !issue.resolved)
        .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
        .slice(0, limit);

      console.log(`📊 未解決の品質問題を取得しました: ${unresolvedIssues.length}件`);
      return unresolvedIssues;
    } catch (error) {
      console.error('❌ 未解決品質問題の取得に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 品質レポートを生成
   */
  async generateQualityReport(days: number = 7): Promise<MarkdownQualityReport> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const issuesRef = collection(db, 'markdownQualityIssues');
      
      // インデックスエラーを回避するため、シンプルなクエリに変更
      const snapshot = await getDocs(issuesRef);
      
      const allIssues = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        detectedAt: doc.data().detectedAt.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate()
      })) as MarkdownQualityIssue[];

      // JavaScriptでフィルタリングを適用
      const issues = allIssues.filter(issue => issue.detectedAt >= startDate);

      const report = markdownQualityMonitor.generateQualityReport(issues);
      
      console.log(`📈 品質レポートを生成しました: ${issues.length}件のデータから`);
      return report;
    } catch (error) {
      console.error('❌ 品質レポートの生成に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 特定の投稿ログの品質問題を取得
   */
  async getIssuesForPostLog(postLogId: string): Promise<MarkdownQualityIssue[]> {
    try {
      const issuesRef = collection(db, 'markdownQualityIssues');
      
      // インデックスエラーを回避するため、シンプルなクエリに変更
      const snapshot = await getDocs(issuesRef);
      
      const allIssues = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        detectedAt: doc.data().detectedAt.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate()
      })) as MarkdownQualityIssue[];

      // JavaScriptでフィルタリングとソートを適用
      const issues = allIssues
        .filter(issue => issue.postLogId === postLogId)
        .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

      console.log(`🔍 投稿ログの品質問題を取得しました: ${issues.length}件`);
      return issues;
    } catch (error) {
      console.error('❌ 投稿ログ品質問題の取得に失敗しました:', error);
      throw error;
    }
  }

  /**
   * アラートが必要な問題を取得
   */
  async getAlertableIssues(): Promise<MarkdownQualityIssue[]> {
    try {
      const issues = await this.getUnresolvedIssues(100);
      const alertableIssues = issues.filter(issue => 
        markdownQualityMonitor.shouldAlert([issue])
      );
      
      console.log(`🚨 アラート対象の品質問題: ${alertableIssues.length}件`);
      return alertableIssues;
    } catch (error) {
      console.error('❌ アラート対象問題の取得に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 問題タイプ別の統計を取得
   */
  async getIssueStatistics(days: number = 30): Promise<{
    totalIssues: number;
    issuesByType: Record<string, number>;
    issuesBySeverity: Record<string, number>;
    resolutionRate: number;
    averageResolutionTime: number;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const issuesRef = collection(db, 'markdownQualityIssues');
      
      // インデックスエラーを回避するため、シンプルなクエリに変更
      const snapshot = await getDocs(issuesRef);
      
      const allIssues = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        detectedAt: doc.data().detectedAt.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate()
      })) as MarkdownQualityIssue[];

      // JavaScriptでフィルタリングを適用
      const issues = allIssues.filter(issue => issue.detectedAt >= startDate);

      const totalIssues = issues.length;
      const resolvedIssues = issues.filter(issue => issue.resolved);
      const resolutionRate = totalIssues > 0 ? (resolvedIssues.length / totalIssues) * 100 : 0;

      // 解決時間の平均計算
      const resolvedWithTime = resolvedIssues.filter(issue => issue.resolvedAt);
      const averageResolutionTime = resolvedWithTime.length > 0 
        ? resolvedWithTime.reduce((sum, issue) => {
            const resolutionTime = issue.resolvedAt!.getTime() - issue.detectedAt.getTime();
            return sum + resolutionTime;
          }, 0) / resolvedWithTime.length / (1000 * 60 * 60) // 時間単位
        : 0;

      // タイプ別集計
      const issuesByType = issues.reduce((acc, issue) => {
        acc[issue.issueType] = (acc[issue.issueType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 重要度別集計
      const issuesBySeverity = issues.reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statistics = {
        totalIssues,
        issuesByType,
        issuesBySeverity,
        resolutionRate,
        averageResolutionTime
      };

      console.log(`📊 品質問題統計を生成しました: ${totalIssues}件（解決率: ${resolutionRate.toFixed(1)}%）`);
      return statistics;
    } catch (error) {
      console.error('❌ 品質問題統計の生成に失敗しました:', error);
      throw error;
    }
  }
}

export const markdownQualityService = new MarkdownQualityService();
