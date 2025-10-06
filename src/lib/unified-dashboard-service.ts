/**
 * 統合管理ダッシュボードサービス
 * 仕様書に基づく4つの主要機能を統合管理
 */

import { postLogService } from './post-log-service';
import { errorMonitoringService } from './error-monitoring-service';
import { systemHealthService } from './system-health-service';
import { markdownQualityService } from './markdown-quality-service';
import { questionAnalysisService } from './question-analysis-service';
import { performanceMonitor } from './performance-monitor';

export interface UnifiedDashboardData {
  // リアルタイムメトリクス
  realtimeMetrics: {
    avgSearchTime: number;
    avgAiTime: number;
    avgTotalTime: number;
    errorRate: number;
    activeUsers: number;
  };
  
  // 現在進行中の会話
  activeConversations: Array<{
    userId: string;
    question: string;
    status: 'searching' | 'ai_generating' | 'completed';
    elapsedTime: number;
    progress: number;
  }>;
  
  // パフォーマンス推移
  performanceTrend: Array<{
    timestamp: Date;
    searchTime: number;
    aiTime: number;
    totalTime: number;
    errorRate: number;
  }>;
  
  // システムヘルス
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    services: Record<string, 'up' | 'down' | 'degraded'>;
    metrics: {
      memoryUsage: number;
      cpuUsage: number;
      diskUsage: number;
    };
  };
  
  // エラー統計
  errorStats: {
    total: number;
    critical: number;
    resolved: number;
    unresolved: number;
  };
  
  // 質問分析
  questionAnalysis: {
    topQuestions: Array<{
      question: string;
      count: number;
      avgResponseTime: number;
    }>;
    categories: Record<string, number>;
  };
}

export class UnifiedDashboardService {
  private static instance: UnifiedDashboardService;
  
  public static getInstance(): UnifiedDashboardService {
    if (!UnifiedDashboardService.instance) {
      UnifiedDashboardService.instance = new UnifiedDashboardService();
    }
    return UnifiedDashboardService.instance;
  }

  /**
   * 統合ダッシュボードデータを取得
   */
  async getDashboardData(): Promise<UnifiedDashboardData> {
    try {
      console.log('🔍 統合ダッシュボードデータ取得開始');
      
      // 全サービスからデータを並行取得
      const [
        recentLogs,
        errorStats,
        systemHealth,
        performanceData,
        questionAnalysis
      ] = await Promise.all([
        this.getRecentPostLogs(),
        this.getErrorStatistics(),
        this.getSystemHealthData(),
        this.getPerformanceData(),
        this.getQuestionAnalysisData()
      ]);

      // リアルタイムメトリクス計算
      const realtimeMetrics = this.calculateRealtimeMetrics(recentLogs);
      
      // 現在進行中の会話（模擬データ）
      const activeConversations = this.getActiveConversations();
      
      // パフォーマンス推移計算
      const performanceTrend = this.calculatePerformanceTrend(recentLogs);
      
      const dashboardData: UnifiedDashboardData = {
        realtimeMetrics,
        activeConversations,
        performanceTrend,
        systemHealth,
        errorStats,
        questionAnalysis
      };

      console.log('✅ 統合ダッシュボードデータ取得完了', {
        metricsCount: Object.keys(realtimeMetrics).length,
        activeConversationsCount: activeConversations.length,
        performanceDataPoints: performanceTrend.length
      });

      return dashboardData;
    } catch (error) {
      console.error('❌ 統合ダッシュボードデータ取得エラー:', error);
      throw error;
    }
  }

  /**
   * 最近の投稿ログを取得
   */
  private async getRecentPostLogs() {
    try {
      return await postLogService.getRecentPostLogs(100);
    } catch (error) {
      console.warn('⚠️ 投稿ログ取得に失敗:', error);
      return [];
    }
  }

  /**
   * エラー統計を取得
   */
  private async getErrorStatistics() {
    try {
      const [stats, criticalErrors] = await Promise.all([
        errorMonitoringService.getErrorStats('day'),
        errorMonitoringService.getUnresolvedCriticalErrors()
      ]);

      return {
        total: stats?.totalErrors || 0,
        critical: criticalErrors?.length || 0,
        resolved: stats?.resolvedErrors || 0,
        unresolved: stats?.unresolvedErrors || 0
      };
    } catch (error) {
      console.warn('⚠️ エラー統計取得に失敗:', error);
      return { total: 0, critical: 0, resolved: 0, unresolved: 0 };
    }
  }

  /**
   * システムヘルスデータを取得
   */
  private async getSystemHealthData() {
    try {
      const dashboardData = await systemHealthService.getHealthDashboardData();
      return dashboardData.status;
    } catch (error) {
      console.warn('⚠️ システムヘルスデータ取得に失敗:', error);
      return {
        status: 'warning' as const,
        services: {
          lancedb: 'degraded' as const,
          firestore: 'up' as const,
          gemini: 'up' as const,
          authentication: 'up' as const
        },
        metrics: {
          memoryUsage: 0,
          cpuUsage: 0,
          diskUsage: 0
        }
      };
    }
  }

  /**
   * パフォーマンスデータを取得
   */
  private async getPerformanceData() {
    try {
      const stats = await postLogService.getPerformanceStats();
      return stats;
    } catch (error) {
      console.warn('⚠️ パフォーマンスデータ取得に失敗:', error);
      return {
        avgSearchTime: 0,
        avgAiTime: 0,
        avgTotalTime: 0,
        totalPosts: 0,
        errorRate: 0
      };
    }
  }

  /**
   * 質問分析データを取得
   */
  private async getQuestionAnalysisData() {
    try {
      const analysis = await questionAnalysisService.getQuestionAnalysis();
      return analysis;
    } catch (error) {
      console.warn('⚠️ 質問分析データ取得に失敗:', error);
      return {
        topQuestions: [],
        categories: {}
      };
    }
  }

  /**
   * リアルタイムメトリクスを計算
   */
  private calculateRealtimeMetrics(logs: any[]) {
    if (logs.length === 0) {
      return {
        avgSearchTime: 0,
        avgAiTime: 0,
        avgTotalTime: 0,
        errorRate: 0,
        activeUsers: 0
      };
    }

    const totalSearchTime = logs.reduce((sum, log) => sum + (log.searchTime || 0), 0);
    const totalAiTime = logs.reduce((sum, log) => sum + (log.aiGenerationTime || 0), 0);
    const totalTime = logs.reduce((sum, log) => sum + (log.totalTime || 0), 0);
    const errorCount = logs.filter(log => log.errors && log.errors.length > 0).length;
    const uniqueUsers = new Set(logs.map(log => log.userId)).size;

    return {
      avgSearchTime: totalSearchTime / logs.length,
      avgAiTime: totalAiTime / logs.length,
      avgTotalTime: totalTime / logs.length,
      errorRate: (errorCount / logs.length) * 100,
      activeUsers: uniqueUsers
    };
  }

  /**
   * 現在進行中の会話を取得（模擬データ）
   */
  private getActiveConversations() {
    // 実際の実装では、WebSocketやリアルタイムデータベースから取得
    return [
      {
        userId: 'user-001',
        question: '教室管理の詳細について教えて',
        status: 'searching' as const,
        elapsedTime: 5000,
        progress: 25
      },
      {
        userId: 'user-002', 
        question: 'ログイン認証の仕組みはどうなっていますか？',
        status: 'ai_generating' as const,
        elapsedTime: 12000,
        progress: 75
      }
    ];
  }

  /**
   * パフォーマンス推移を計算
   */
  private calculatePerformanceTrend(logs: any[]) {
    // 過去24時間の時間別集計
    const now = new Date();
    const trends = [];
    
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(now.getTime() - (i - 1) * 60 * 60 * 1000);
      
      const hourLogs = logs.filter(log => {
        const logTime = new Date(log.timestamp);
        return logTime >= hourStart && logTime < hourEnd;
      });

      const avgSearchTime = hourLogs.length > 0 
        ? hourLogs.reduce((sum, log) => sum + (log.searchTime || 0), 0) / hourLogs.length 
        : 0;
      const avgAiTime = hourLogs.length > 0
        ? hourLogs.reduce((sum, log) => sum + (log.aiGenerationTime || 0), 0) / hourLogs.length
        : 0;
      const avgTotalTime = hourLogs.length > 0
        ? hourLogs.reduce((sum, log) => sum + (log.totalTime || 0), 0) / hourLogs.length
        : 0;
      const errorRate = hourLogs.length > 0
        ? (hourLogs.filter(log => log.errors && log.errors.length > 0).length / hourLogs.length) * 100
        : 0;

      trends.push({
        timestamp: hourStart,
        searchTime: avgSearchTime,
        aiTime: avgAiTime,
        totalTime: avgTotalTime,
        errorRate: errorRate
      });
    }

    return trends;
  }

  /**
   * リアルタイム更新用のデータストリーム
   */
  async *getRealtimeDataStream() {
    while (true) {
      try {
        const data = await this.getDashboardData();
        yield data;
        
        // 30秒間隔で更新
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error) {
        console.error('リアルタイムデータストリームエラー:', error);
        yield null;
        await new Promise(resolve => setTimeout(resolve, 5000)); // エラー時は5秒後に再試行
      }
    }
  }
}

// シングルトンインスタンスをエクスポート
export const unifiedDashboardService = UnifiedDashboardService.getInstance();


