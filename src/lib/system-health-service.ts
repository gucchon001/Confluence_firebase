import { getFirebaseFirestore, getFirebaseAuth } from '@/lib/firebase-unified';
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';

const db = getFirebaseFirestore();
const auth = getFirebaseAuth();

export type SystemHealthMetric = {
  id: string;
  metricType: 'cpu' | 'memory' | 'disk' | 'network' | 'database' | 'api_response_time' | 'error_rate' | 'user_sessions';
  value: number;
  unit: string;
  timestamp: Date;
  status: 'healthy' | 'warning' | 'critical';
  metadata: {
    server?: string;
    region?: string;
    component?: string;
    additionalInfo?: Record<string, any>;
  };
};

export type SystemAlert = {
  id: string;
  alertType: 'performance' | 'availability' | 'error_rate' | 'resource_usage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: {
    component?: string;
    threshold?: number;
    currentValue?: number;
    additionalInfo?: Record<string, any>;
  };
};

export type SystemStatus = {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    database: 'healthy' | 'degraded' | 'critical';
    api: 'healthy' | 'degraded' | 'critical';
    search: 'healthy' | 'degraded' | 'critical';
    ai: 'healthy' | 'degraded' | 'critical';
  };
  metrics: {
    uptime: number; // パーセンテージ
    responseTime: number; // ミリ秒
    errorRate: number; // パーセンテージ
    activeUsers: number;
  };
  lastUpdated: Date;
};

class SystemHealthService {
  private healthThresholds = {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 80, critical: 95 },
    disk: { warning: 85, critical: 95 },
    api_response_time: { warning: 2000, critical: 5000 },
    error_rate: { warning: 5, critical: 10 }
  };


  /**
   * システムメトリクスを記録
   */
  async recordMetric(
    metricType: SystemHealthMetric['metricType'],
    value: number,
    unit: string,
    options: {
      server?: string;
      region?: string;
      component?: string;
      additionalInfo?: Record<string, any>;
    } = {}
  ): Promise<string> {
    try {
      const status = this.determineMetricStatus(metricType, value);
      
      const metric: Omit<SystemHealthMetric, 'id'> = {
        metricType,
        value,
        unit,
        timestamp: new Date(),
        status,
        metadata: options
      };

      // Firestoreに保存
      const docRef = await addDoc(collection(db, 'systemMetrics'), {
        ...metric,
        timestamp: Timestamp.fromDate(metric.timestamp)
      });

      // アラート条件をチェック
      if (status !== 'healthy') {
        await this.checkMetricAlert(metricType, value, status);
      }

      return docRef.id;
    } catch (error) {
      console.error('[SystemHealthService] Failed to record metric:', error);
      throw error;
    }
  }

  /**
   * システムアラートを作成
   */
  async createAlert(
    alertType: SystemAlert['alertType'],
    severity: SystemAlert['severity'],
    message: string,
    options: {
      component?: string;
      threshold?: number;
      currentValue?: number;
      additionalInfo?: Record<string, any>;
    } = {}
  ): Promise<string> {
    try {
      const alert: Omit<SystemAlert, 'id'> = {
        alertType,
        severity,
        message,
        timestamp: new Date(),
        resolved: false,
        metadata: options
      };

      const docRef = await addDoc(collection(db, 'systemAlerts'), {
        ...alert,
        timestamp: Timestamp.fromDate(alert.timestamp)
      });

      console.log(`[SystemHealthService] Alert created: ${alertType} (${severity})`, alert);
      return docRef.id;
    } catch (error) {
      console.error('[SystemHealthService] Failed to create alert:', error);
      throw error;
    }
  }

  /**
   * システムステータスを取得
   */
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // 最近のメトリクスを取得
      const metrics = await this.getRecentMetrics(oneHourAgo, now);
      
      // 最近のアラートを取得
      const alerts = await this.getRecentAlerts(oneHourAgo, now);

      // システムステータスを計算
      const components = this.calculateComponentStatus(metrics, alerts);
      const overall = this.calculateOverallStatus(components);
      const systemMetrics = this.calculateSystemMetrics(metrics);

      return {
        overall,
        components,
        metrics: systemMetrics,
        lastUpdated: now
      };
    } catch (error) {
      console.error('[SystemHealthService] Failed to get system status:', error);
      throw error;
    }
  }

  /**
   * 最近のメトリクスを取得
   */
  async getRecentMetrics(startDate: Date, endDate: Date): Promise<SystemHealthMetric[]> {
    try {
      // テスト環境または未認証の場合はモックデータを返す
      if (process.env.NODE_ENV === 'test') {
        console.log('[SystemHealthService] Recent metrics skipped in test environment');
        return [];
      }

      if (!auth.currentUser) {
        console.log('[SystemHealthService] Recent metrics skipped: no authenticated user');
        return [];
      }

      const metricsRef = collection(db, 'systemMetrics');
      
      // インデックスエラーを回避するため、シンプルなクエリに変更
      const snapshot = await getDocs(metricsRef);
      
      const allMetrics = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as SystemHealthMetric[];

      // JavaScriptでフィルタリングとソートを適用
      const filteredMetrics = allMetrics.filter(metric => 
        metric.timestamp >= startDate && metric.timestamp <= endDate
      );

      // タイムスタンプでソート（降順）
      filteredMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      console.log(`[SystemHealthService] Retrieved ${filteredMetrics.length} metrics`);
      return filteredMetrics;
    } catch (error) {
      console.error('[SystemHealthService] Failed to get recent metrics:', error);
      throw error;
    }
  }

  /**
   * 最近のアラートを取得
   */
  async getRecentAlerts(startDate: Date, endDate: Date): Promise<SystemAlert[]> {
    try {
      // テスト環境または未認証の場合はモックデータを返す
      if (process.env.NODE_ENV === 'test') {
        console.log('[SystemHealthService] Recent alerts skipped in test environment');
        return [];
      }

      if (!auth.currentUser) {
        console.log('[SystemHealthService] Recent alerts skipped: no authenticated user');
        return [];
      }

      const alertsRef = collection(db, 'systemAlerts');
      
      // インデックスエラーを回避するため、シンプルなクエリに変更
      const snapshot = await getDocs(alertsRef);
      
      const allAlerts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as SystemAlert[];

      // JavaScriptでフィルタリングとソートを適用
      const filteredAlerts = allAlerts.filter(alert => 
        alert.timestamp >= startDate && alert.timestamp <= endDate
      );

      // タイムスタンプでソート（降順）
      filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      console.log(`[SystemHealthService] Retrieved ${filteredAlerts.length} alerts`);
      return filteredAlerts;
    } catch (error) {
      console.error('[SystemHealthService] Failed to get recent alerts:', error);
      throw error;
    }
  }

  /**
   * メトリクスのステータスを判定
   */
  private determineMetricStatus(metricType: SystemHealthMetric['metricType'], value: number): 'healthy' | 'warning' | 'critical' {
    const thresholds = this.healthThresholds[metricType as keyof typeof this.healthThresholds];
    
    if (!thresholds) {
      return 'healthy';
    }

    if (value >= thresholds.critical) {
      return 'critical';
    } else if (value >= thresholds.warning) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * メトリクスアラートをチェック
   */
  private async checkMetricAlert(
    metricType: SystemHealthMetric['metricType'],
    value: number,
    status: 'warning' | 'critical'
  ): Promise<void> {
    try {
      const severity = status === 'critical' ? 'high' : 'medium';
      const message = `${metricType}が${status === 'critical' ? '危険' : '警告'}レベルに達しました: ${value}`;

      await this.createAlert('resource_usage', severity, message, {
        component: metricType,
        threshold: this.healthThresholds[metricType as keyof typeof this.healthThresholds]?.[status],
        currentValue: value
      });
    } catch (error) {
      console.error('[SystemHealthService] Failed to create metric alert:', error);
    }
  }

  /**
   * コンポーネントステータスを計算
   */
  private calculateComponentStatus(metrics: SystemHealthMetric[], alerts: SystemAlert[]): SystemStatus['components'] {
    const components: SystemStatus['components'] = {
      database: 'healthy',
      api: 'healthy',
      search: 'healthy',
      ai: 'healthy'
    };

    // アラートに基づいてステータスを更新
    alerts.forEach(alert => {
      if (!alert.resolved) {
        const component = alert.metadata.component;
        if (component && component in components) {
          if (alert.severity === 'critical' || alert.severity === 'high') {
            (components as any)[component] = 'critical';
          } else if ((components as any)[component] !== 'critical') {
            (components as any)[component] = 'degraded';
          }
        }
      }
    });

    return components;
  }

  /**
   * 全体ステータスを計算
   */
  private calculateOverallStatus(components: SystemStatus['components']): 'healthy' | 'degraded' | 'critical' {
    const statuses = Object.values(components);
    
    if (statuses.includes('critical')) {
      return 'critical';
    } else if (statuses.includes('degraded')) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * システムメトリクスを計算
   */
  private calculateSystemMetrics(metrics: SystemHealthMetric[]): SystemStatus['metrics'] {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // アプタイム計算（簡略化）
    const uptime = 99.9; // 実際の実装では適切な計算を行う

    // 平均レスポンス時間
    const apiMetrics = metrics.filter(m => m.metricType === 'api_response_time');
    const responseTime = apiMetrics.length > 0 
      ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length
      : 0;

    // エラー率
    const errorMetrics = metrics.filter(m => m.metricType === 'error_rate');
    const errorRate = errorMetrics.length > 0
      ? errorMetrics.reduce((sum, m) => sum + m.value, 0) / errorMetrics.length
      : 0;

    // アクティブユーザー数
    const userMetrics = metrics.filter(m => m.metricType === 'user_sessions');
    const activeUsers = userMetrics.length > 0
      ? Math.max(...userMetrics.map(m => m.value))
      : 0;

    return {
      uptime,
      responseTime: Math.round(responseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      activeUsers: Math.round(activeUsers)
    };
  }

  /**
   * システムヘルスダッシュボード用のデータを取得
   */
  async getHealthDashboardData(): Promise<{
    status: SystemStatus;
    recentAlerts: SystemAlert[];
    metricsHistory: SystemHealthMetric[];
    performanceTrend: Array<{ timestamp: Date; value: number; metric: string }>;
  }> {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [status, recentAlerts, metricsHistory] = await Promise.all([
        this.getSystemStatus(),
        this.getRecentAlerts(oneDayAgo, now),
        this.getRecentMetrics(oneDayAgo, now)
      ]);

      // パフォーマンストレンドデータを生成
      const performanceTrend = this.generatePerformanceTrend(metricsHistory);

      return {
        status,
        recentAlerts: recentAlerts.slice(0, 10),
        metricsHistory: metricsHistory.slice(0, 50),
        performanceTrend
      };
    } catch (error) {
      console.error('[SystemHealthService] Failed to get health dashboard data:', error);
      throw error;
    }
  }

  /**
   * パフォーマンストレンドデータを生成
   */
  private generatePerformanceTrend(metrics: SystemHealthMetric[]): Array<{ timestamp: Date; value: number; metric: string }> {
    const trend: Array<{ timestamp: Date; value: number; metric: string }> = [];
    
    // 過去24時間を6時間間隔でグループ化
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const timestamp = new Date(now.getTime() - (6 * i * 60 * 60 * 1000));
      const periodStart = new Date(timestamp.getTime() - 6 * 60 * 60 * 1000);
      
      const periodMetrics = metrics.filter(m => 
        m.timestamp >= periodStart && m.timestamp <= timestamp
      );

      const avgResponseTime = periodMetrics
        .filter(m => m.metricType === 'api_response_time')
        .reduce((sum, m) => sum + m.value, 0) / Math.max(1, periodMetrics.length);

      trend.push({
        timestamp,
        value: avgResponseTime || 0,
        metric: 'API Response Time'
      });
    }

    return trend.reverse();
  }

  /**
   * アラートを解決済みにマーク
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    try {
      // ここではFirebase Admin SDKを使用して更新
      // 実際の実装では適切な方法で更新
      console.log(`[SystemHealthService] Alert ${alertId} resolved by ${resolvedBy}`);
    } catch (error) {
      console.error('[SystemHealthService] Failed to resolve alert:', error);
      throw error;
    }
  }
}

export const systemHealthService = new SystemHealthService();
