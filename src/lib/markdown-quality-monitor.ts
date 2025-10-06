/**
 * マークダウン品質監視サービス
 * マークダウン変換エラーや品質問題を検出・アラート
 */

import type { PostLog } from '@/types';

export interface MarkdownQualityIssue {
  id: string;
  postLogId: string;
  issueType: 'heading_spacing' | 'bullet_point' | 'table_format' | 'list_format' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  originalText: string;
  expectedFormat: string;
  detectedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface MarkdownQualityReport {
  totalIssues: number;
  issuesByType: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  recentIssues: MarkdownQualityIssue[];
  qualityScore: number; // 0-100
  trends: {
    date: string;
    issuesCount: number;
    qualityScore: number;
  }[];
}

export class MarkdownQualityMonitor {
  /**
   * マークダウン品質問題を検出
   */
  detectMarkdownIssues(postLog: PostLog): MarkdownQualityIssue[] {
    const issues: MarkdownQualityIssue[] = [];
    const answer = postLog.answer;

    // 1. 見出しのスペース問題を検出
    const headingSpaceIssues = this.detectHeadingSpaceIssues(answer, postLog.id);
    issues.push(...headingSpaceIssues);

    // 2. 箇条書きの問題を検出
    const bulletPointIssues = this.detectBulletPointIssues(answer, postLog.id);
    issues.push(...bulletPointIssues);

    // 3. テーブル形式の問題を検出
    const tableIssues = this.detectTableIssues(answer, postLog.id);
    issues.push(...tableIssues);

    // 4. リスト形式の問題を検出
    const listIssues = this.detectListIssues(answer, postLog.id);
    issues.push(...listIssues);

    // 5. 一般的なマークダウン問題を検出
    const generalIssues = this.detectGeneralMarkdownIssues(answer, postLog.id);
    issues.push(...generalIssues);

    return issues;
  }

  /**
   * 見出しのスペース問題を検出
   */
  private detectHeadingSpaceIssues(text: string, postLogId: string): MarkdownQualityIssue[] {
    const issues: MarkdownQualityIssue[] = [];
    
    // ##詳細 のようなパターンを検出
    const headingSpacePattern = /(#{1,6})[^#\s][^\n]*/g;
    let match;
    
    while ((match = headingSpacePattern.exec(text)) !== null) {
      const fullMatch = match[0];
      const hashes = match[1];
      
      issues.push({
        id: `heading_space_${Date.now()}_${Math.random()}`,
        postLogId,
        issueType: 'heading_spacing',
        severity: 'medium',
        description: `見出しの後にスペースがありません: "${fullMatch}"`,
        originalText: fullMatch,
        expectedFormat: `${hashes} 適切な見出し`,
        detectedAt: new Date(),
        resolved: false
      });
    }

    return issues;
  }

  /**
   * 箇条書きの問題を検出
   */
  private detectBulletPointIssues(text: string, postLogId: string): MarkdownQualityIssue[] {
    const issues: MarkdownQualityIssue[] = [];
    
    // - ｘｘｘ文字 のようなパターンを検出
    const bulletPointPattern = /-\s*[ｘｘｘ]+\s*文字/g;
    let match;
    
    while ((match = bulletPointPattern.exec(text)) !== null) {
      issues.push({
        id: `bullet_point_${Date.now()}_${Math.random()}`,
        postLogId,
        issueType: 'bullet_point',
        severity: 'high',
        description: `箇条書きに無意味な文字が含まれています: "${match[0]}"`,
        originalText: match[0],
        expectedFormat: '- 適切な箇条書き項目',
        detectedAt: new Date(),
        resolved: false
      });
    }

    // 文中の箇条書きパターン（改行されていない）
    const inlineBulletPattern = /([^-\n])-\s*[^\n]+(?!\n)/g;
    while ((match = inlineBulletPattern.exec(text)) !== null) {
      issues.push({
        id: `inline_bullet_${Date.now()}_${Math.random()}`,
        postLogId,
        issueType: 'bullet_point',
        severity: 'low',
        description: `文中に箇条書きが含まれています（改行が必要）: "${match[0]}"`,
        originalText: match[0],
        expectedFormat: '\n- 適切な箇条書き項目',
        detectedAt: new Date(),
        resolved: false
      });
    }

    return issues;
  }

  /**
   * テーブル形式の問題を検出
   */
  private detectTableIssues(text: string, postLogId: string): MarkdownQualityIssue[] {
    const issues: MarkdownQualityIssue[] = [];
    
    // テーブルヘッダーが正しくないパターンを検出
    const malformedTablePattern = /\|.*\|[\s\S]*?(?=\n\n|\n$|$)/g;
    let match;
    
    while ((match = malformedTablePattern.exec(text)) !== null) {
      const tableContent = match[0];
      
      // セパレーター行がないテーブル
      if (!tableContent.includes('---')) {
        issues.push({
          id: `table_separator_${Date.now()}_${Math.random()}`,
          postLogId,
          issueType: 'table_format',
          severity: 'medium',
          description: 'テーブルにセパレーター行がありません',
          originalText: tableContent.substring(0, 100) + '...',
          expectedFormat: '| ヘッダー | ヘッダー |\n| --- | --- |\n| データ | データ |',
          detectedAt: new Date(),
          resolved: false
        });
      }
      
      // パイプが揃っていないテーブル
      const lines = tableContent.split('\n');
      const pipeCounts = lines.map(line => (line.match(/\|/g) || []).length);
      const inconsistentPipes = pipeCounts.some(count => count !== pipeCounts[0]);
      
      if (inconsistentPipes) {
        issues.push({
          id: `table_pipes_${Date.now()}_${Math.random()}`,
          postLogId,
          issueType: 'table_format',
          severity: 'low',
          description: 'テーブルの列数が一致していません',
          originalText: tableContent.substring(0, 100) + '...',
          expectedFormat: 'すべての行で同じ数のパイプを使用',
          detectedAt: new Date(),
          resolved: false
        });
      }
    }

    return issues;
  }

  /**
   * リスト形式の問題を検出
   */
  private detectListIssues(text: string, postLogId: string): MarkdownQualityIssue[] {
    const issues: MarkdownQualityIssue[] = [];
    
    // 番号付きリストの問題
    const numberedListPattern = /(\d+\.\s*[^\n]+)(?!\n)/g;
    let match;
    
    while ((match = numberedListPattern.exec(text)) !== null) {
      issues.push({
        id: `numbered_list_${Date.now()}_${Math.random()}`,
        postLogId,
        issueType: 'list_format',
        severity: 'low',
        description: `番号付きリストが改行されていません: "${match[1]}"`,
        originalText: match[1],
        expectedFormat: '\n' + match[1],
        detectedAt: new Date(),
        resolved: false
      });
    }

    return issues;
  }

  /**
   * 一般的なマークダウン問題を検出
   */
  private detectGeneralMarkdownIssues(text: string, postLogId: string): MarkdownQualityIssue[] {
    const issues: MarkdownQualityIssue[] = [];
    
    // 連続する空行（3行以上）
    const multipleEmptyLines = /\n\s*\n\s*\n\s*\n/g;
    if (multipleEmptyLines.test(text)) {
      issues.push({
        id: `multiple_empty_lines_${Date.now()}_${Math.random()}`,
        postLogId,
        issueType: 'general',
        severity: 'low',
        description: '連続する空行が多すぎます（3行以上）',
        originalText: '（複数箇所）',
        expectedFormat: '最大2行の空行に制限',
        detectedAt: new Date(),
        resolved: false
      });
    }

    // マークダウン記号の誤用
    const malformedMarkdown = /[*_]{3,}/g;
    let match;
    
    while ((match = malformedMarkdown.exec(text)) !== null) {
      issues.push({
        id: `malformed_markdown_${Date.now()}_${Math.random()}`,
        postLogId,
        issueType: 'general',
        severity: 'medium',
        description: `マークダウン記号の誤用: "${match[0]}"`,
        originalText: match[0],
        expectedFormat: '**太字** または *斜体* を使用',
        detectedAt: new Date(),
        resolved: false
      });
    }

    return issues;
  }

  /**
   * 品質スコアを計算
   */
  calculateQualityScore(issues: MarkdownQualityIssue[]): number {
    if (issues.length === 0) return 100;
    
    let score = 100;
    
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    });
    
    return Math.max(0, score);
  }

  /**
   * 品質レポートを生成
   */
  generateQualityReport(issues: MarkdownQualityIssue[]): MarkdownQualityReport {
    const totalIssues = issues.length;
    
    // 問題タイプ別集計
    const issuesByType = issues.reduce((acc, issue) => {
      acc[issue.issueType] = (acc[issue.issueType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // 重要度別集計
    const issuesBySeverity = issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // 最近の問題（過去24時間）
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentIssues = issues
      .filter(issue => issue.detectedAt >= oneDayAgo)
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
      .slice(0, 10);
    
    // 品質スコア
    const qualityScore = this.calculateQualityScore(issues);
    
    // トレンド（過去7日間の日別集計）
    const trends = this.calculateTrends(issues);
    
    return {
      totalIssues,
      issuesByType,
      issuesBySeverity,
      recentIssues,
      qualityScore,
      trends
    };
  }

  /**
   * トレンド計算
   */
  private calculateTrends(issues: MarkdownQualityIssue[]): { date: string; issuesCount: number; qualityScore: number }[] {
    const trends: { [date: string]: MarkdownQualityIssue[] } = {};
    
    // 過去7日間のデータを日別にグループ化
    issues.forEach(issue => {
      const date = issue.detectedAt.toISOString().split('T')[0];
      if (!trends[date]) {
        trends[date] = [];
      }
      trends[date].push(issue);
    });
    
    // 日別の統計を計算
    const result = Object.entries(trends)
      .map(([date, dayIssues]) => ({
        date,
        issuesCount: dayIssues.length,
        qualityScore: this.calculateQualityScore(dayIssues)
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // 過去7日間
    
    return result;
  }

  /**
   * アラート条件をチェック
   */
  shouldAlert(issues: MarkdownQualityIssue[]): boolean {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical').length;
    const highIssues = issues.filter(issue => issue.severity === 'high').length;
    const totalIssues = issues.length;
    
    // アラート条件
    return (
      criticalIssues > 0 ||           // クリティカルな問題が1件以上
      highIssues > 3 ||               // 高重要度の問題が3件以上
      totalIssues > 10                // 総問題数が10件以上
    );
  }

  /**
   * アラートメッセージを生成
   */
  generateAlertMessage(issues: MarkdownQualityIssue[]): string {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const totalCount = issues.length;
    
    if (criticalCount > 0) {
      return `🚨 クリティカルなマークダウン品質問題が検出されました（${criticalCount}件）`;
    } else if (highCount > 3) {
      return `⚠️ 高重要度のマークダウン品質問題が多数検出されています（${highCount}件）`;
    } else if (totalCount > 10) {
      return `📊 マークダウン品質問題が多発しています（${totalCount}件）`;
    }
    
    return '';
  }
}

export const markdownQualityMonitor = new MarkdownQualityMonitor();
