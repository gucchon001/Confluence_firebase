/**
 * パフォーマンスアラートサービス
 * パフォーマンスメトリクスを監視し、閾値を超えた場合にアラートを生成します
 */

import type { PostLog, PerformanceAlert } from '@/types';

// アラート閾値設定（仕様書に基づく）
const ALERT_THRESHOLDS = {
  searchTime: 5000, // 5秒（ミリ秒）
  aiGenerationTime: 30000, // 30秒（ミリ秒）
  errorRate: 5, // 5%（パーセンテージ）
  systemLoad: 80, // 80%（メモリ使用率、パーセンテージ）
} as const;

export class PerformanceAlertService {
  private static instance: PerformanceAlertService;

  private constructor() {}

  public static getInstance(): PerformanceAlertService {
    if (!PerformanceAlertService.instance) {
      PerformanceAlertService.instance = new PerformanceAlertService();
    }
    return PerformanceAlertService.instance;
  }

  /**
   * 投稿ログからパフォーマンスアラートを生成
   */
  public generateAlerts(postLogs: PostLog[]): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];

    if (postLogs.length === 0) {
      return alerts;
    }

    // 検索時間アラート
    const searchTimeAlerts = this.checkSearchTimeAlerts(postLogs);
    alerts.push(...searchTimeAlerts);

    // AI生成時間アラート
    const aiTimeAlerts = this.checkAiGenerationTimeAlerts(postLogs);
    alerts.push(...aiTimeAlerts);

    // エラー率アラート
    const errorRateAlerts = this.checkErrorRateAlerts(postLogs);
    alerts.push(...errorRateAlerts);

    return alerts;
  }

  /**
   * 検索時間アラートをチェック
   */
  private checkSearchTimeAlerts(postLogs: PostLog[]): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];
    const recentLogs = this.getRecentLogs(postLogs, 60 * 60 * 1000); // 過去1時間

    if (recentLogs.length === 0) {
      return alerts;
    }

    // 平均検索時間を計算
    const avgSearchTime = recentLogs.reduce((sum, log) => sum + log.searchTime, 0) / recentLogs.length;
    
    // 最大検索時間を取得
    const maxSearchTime = Math.max(...recentLogs.map(log => log.searchTime));

    // 平均が閾値を超えている場合
    if (avgSearchTime > ALERT_THRESHOLDS.searchTime) {
      alerts.push({
        id: `search-time-avg-${Date.now()}`,
        type: 'search_time',
        severity: avgSearchTime > ALERT_THRESHOLDS.searchTime * 2 ? 'critical' : 'warning',
        message: `平均検索時間が閾値を超過: ${(avgSearchTime / 1000).toFixed(1)}秒（閾値: ${ALERT_THRESHOLDS.searchTime / 1000}秒）`,
        value: avgSearchTime,
        threshold: ALERT_THRESHOLDS.searchTime,
        timestamp: new Date(),
        resolved: false,
      });
    }

    // 最大値が閾値を大幅に超えている場合
    if (maxSearchTime > ALERT_THRESHOLDS.searchTime * 2) {
      alerts.push({
        id: `search-time-max-${Date.now()}`,
        type: 'search_time',
        severity: 'critical',
        message: `最大検索時間が閾値を大幅に超過: ${(maxSearchTime / 1000).toFixed(1)}秒（閾値: ${ALERT_THRESHOLDS.searchTime / 1000}秒）`,
        value: maxSearchTime,
        threshold: ALERT_THRESHOLDS.searchTime,
        timestamp: new Date(),
        resolved: false,
      });
    }

    return alerts;
  }

  /**
   * AI生成時間アラートをチェック
   */
  private checkAiGenerationTimeAlerts(postLogs: PostLog[]): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];
    const recentLogs = this.getRecentLogs(postLogs, 60 * 60 * 1000); // 過去1時間

    if (recentLogs.length === 0) {
      return alerts;
    }

    // 平均AI生成時間を計算
    const avgAiTime = recentLogs.reduce((sum, log) => sum + log.aiGenerationTime, 0) / recentLogs.length;
    
    // 最大AI生成時間を取得
    const maxAiTime = Math.max(...recentLogs.map(log => log.aiGenerationTime));

    // 平均が閾値を超えている場合
    if (avgAiTime > ALERT_THRESHOLDS.aiGenerationTime) {
      alerts.push({
        id: `ai-time-avg-${Date.now()}`,
        type: 'ai_generation_time',
        severity: avgAiTime > ALERT_THRESHOLDS.aiGenerationTime * 2 ? 'critical' : 'warning',
        message: `平均AI生成時間が閾値を超過: ${(avgAiTime / 1000).toFixed(1)}秒（閾値: ${ALERT_THRESHOLDS.aiGenerationTime / 1000}秒）`,
        value: avgAiTime,
        threshold: ALERT_THRESHOLDS.aiGenerationTime,
        timestamp: new Date(),
        resolved: false,
      });
    }

    // 最大値が閾値を大幅に超えている場合
    if (maxAiTime > ALERT_THRESHOLDS.aiGenerationTime * 2) {
      alerts.push({
        id: `ai-time-max-${Date.now()}`,
        type: 'ai_generation_time',
        severity: 'critical',
        message: `最大AI生成時間が閾値を大幅に超過: ${(maxAiTime / 1000).toFixed(1)}秒（閾値: ${ALERT_THRESHOLDS.aiGenerationTime / 1000}秒）`,
        value: maxAiTime,
        threshold: ALERT_THRESHOLDS.aiGenerationTime,
        timestamp: new Date(),
        resolved: false,
      });
    }

    return alerts;
  }

  /**
   * エラー率アラートをチェック
   */
  private checkErrorRateAlerts(postLogs: PostLog[]): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];
    const recentLogs = this.getRecentLogs(postLogs, 60 * 60 * 1000); // 過去1時間

    if (recentLogs.length === 0) {
      return alerts;
    }

    // エラー率を計算
    const errorCount = recentLogs.filter(log => log.errors && log.errors.length > 0).length;
    const errorRate = (errorCount / recentLogs.length) * 100;

    if (errorRate > ALERT_THRESHOLDS.errorRate) {
      alerts.push({
        id: `error-rate-${Date.now()}`,
        type: 'error_rate',
        severity: errorRate > ALERT_THRESHOLDS.errorRate * 2 ? 'critical' : 'warning',
        message: `エラー率が閾値を超過: ${errorRate.toFixed(1)}%（閾値: ${ALERT_THRESHOLDS.errorRate}%）`,
        value: errorRate,
        threshold: ALERT_THRESHOLDS.errorRate,
        timestamp: new Date(),
        resolved: false,
      });
    }

    return alerts;
  }

  /**
   * 指定時間内のログを取得
   */
  private getRecentLogs(postLogs: PostLog[], timeWindowMs: number): PostLog[] {
    const now = Date.now();
    return postLogs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return now - logTime <= timeWindowMs;
    });
  }

  /**
   * アラートを解決済みにマーク
   */
  public resolveAlert(alert: PerformanceAlert, resolvedBy: string): PerformanceAlert {
    return {
      ...alert,
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy,
    };
  }

  /**
   * アラートの重要度を取得（表示用）
   */
  public getAlertSeverityColor(severity: 'warning' | 'critical'): string {
    return severity === 'critical' ? 'text-red-600' : 'text-yellow-600';
  }

  /**
   * アラートの重要度バッジ色を取得
   */
  public getAlertSeverityBadgeVariant(severity: 'warning' | 'critical'): 'default' | 'destructive' {
    return severity === 'critical' ? 'destructive' : 'default';
  }
}

// シングルトンインスタンスをエクスポート
export const performanceAlertService = PerformanceAlertService.getInstance();

