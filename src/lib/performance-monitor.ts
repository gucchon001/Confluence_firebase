/**
 * パフォーマンス監視システム
 * リアルタイムでパフォーマンスを監視し、最適化の機会を特定
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: any;
}

interface PerformanceReport {
  averageResponseTime: number;
  totalRequests: number;
  slowQueries: PerformanceMetric[];
  recommendations: string[];
  healthScore: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // 保持する最大メトリクス数
  private slowQueryThreshold = 5000; // 5秒を遅いクエリとして定義

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * パフォーマンスメトリクスを記録
   */
  public recordMetric(operation: string, duration: number, metadata?: any): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      metadata
    };

    this.metrics.push(metric);

    // メトリクス数制限
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // 遅いクエリの警告
    if (duration > this.slowQueryThreshold) {
      console.warn(`⚠️ Slow query detected: ${operation} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * パフォーマンスレポートを生成
   */
  public generateReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return {
        averageResponseTime: 0,
        totalRequests: 0,
        slowQueries: [],
        recommendations: ['No performance data available'],
        healthScore: 100
      };
    }

    // 基本統計
    const totalDuration = this.metrics.reduce((sum, metric) => sum + metric.duration, 0);
    const averageResponseTime = totalDuration / this.metrics.length;

    // 遅いクエリの特定
    const slowQueries = this.metrics
      .filter(metric => metric.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10); // 上位10件

    // 推奨事項の生成
    const recommendations = this.generateRecommendations(averageResponseTime, slowQueries);

    // ヘルススコアの計算
    const healthScore = this.calculateHealthScore(averageResponseTime, slowQueries.length);

    return {
      averageResponseTime,
      totalRequests: this.metrics.length,
      slowQueries,
      recommendations,
      healthScore
    };
  }

  /**
   * 推奨事項を生成
   */
  private generateRecommendations(averageResponseTime: number, slowQueries: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];

    if (averageResponseTime > 10000) { // 10秒以上
      recommendations.push('🚨 Critical: Average response time is extremely high. Consider immediate optimization.');
    } else if (averageResponseTime > 5000) { // 5秒以上
      recommendations.push('⚠️ Warning: Average response time is high. Optimization recommended.');
    }

    if (slowQueries.length > 0) {
      const slowQueryPercentage = (slowQueries.length / this.metrics.length) * 100;
      if (slowQueryPercentage > 20) {
        recommendations.push('🔍 High percentage of slow queries detected. Review search algorithms.');
      }
    }

    // 操作別の推奨事項
    const operationStats = this.getOperationStats();
    for (const [operation, stats] of Object.entries(operationStats)) {
      if (stats.average > 3000) { // 3秒以上
        recommendations.push(`🐌 ${operation} is slow (avg: ${stats.average.toFixed(2)}ms). Consider optimization.`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Performance is within acceptable limits.');
    }

    return recommendations;
  }

  /**
   * ヘルススコアを計算
   */
  private calculateHealthScore(averageResponseTime: number, slowQueryCount: number): number {
    let score = 100;

    // 平均応答時間による減点
    if (averageResponseTime > 10000) {
      score -= 50; // 10秒以上で50点減点
    } else if (averageResponseTime > 5000) {
      score -= 30; // 5秒以上で30点減点
    } else if (averageResponseTime > 3000) {
      score -= 15; // 3秒以上で15点減点
    }

    // 遅いクエリ数による減点
    const slowQueryPercentage = (slowQueryCount / this.metrics.length) * 100;
    if (slowQueryPercentage > 50) {
      score -= 30;
    } else if (slowQueryPercentage > 20) {
      score -= 15;
    }

    return Math.max(0, score);
  }

  /**
   * 操作別統計を取得
   */
  private getOperationStats(): { [operation: string]: { count: number; average: number; max: number } } {
    const stats: { [operation: string]: { count: number; total: number; max: number } } = {};

    for (const metric of this.metrics) {
      if (!stats[metric.operation]) {
        stats[metric.operation] = { count: 0, total: 0, max: 0 };
      }
      stats[metric.operation].count++;
      stats[metric.operation].total += metric.duration;
      stats[metric.operation].max = Math.max(stats[metric.operation].max, metric.duration);
    }

    // 平均値を計算
    const result: { [operation: string]: { count: number; average: number; max: number } } = {};
    for (const [operation, stat] of Object.entries(stats)) {
      result[operation] = {
        count: stat.count,
        average: stat.total / stat.count,
        max: stat.max
      };
    }

    return result;
  }

  /**
   * リアルタイムパフォーマンスダッシュボード
   */
  public getDashboard(): {
    currentPerformance: {
      averageResponseTime: number;
      totalRequests: number;
      healthScore: number;
    };
    recentMetrics: PerformanceMetric[];
    topSlowQueries: PerformanceMetric[];
    operationBreakdown: { [operation: string]: { count: number; average: number } };
  } {
    const report = this.generateReport();
    const operationStats = this.getOperationStats();

    return {
      currentPerformance: {
        averageResponseTime: report.averageResponseTime,
        totalRequests: report.totalRequests,
        healthScore: report.healthScore
      },
      recentMetrics: this.metrics.slice(-10), // 最新10件
      topSlowQueries: report.slowQueries.slice(0, 5), // 上位5件
      operationBreakdown: Object.fromEntries(
        Object.entries(operationStats).map(([op, stats]) => [op, { count: stats.count, average: stats.average }])
      )
    };
  }

  /**
   * メトリクスをクリア
   */
  public clearMetrics(): void {
    this.metrics = [];
    console.log('🧹 Performance metrics cleared');
  }

  /**
   * パフォーマンス監視を開始
   */
  public startMonitoring(): void {
    console.log('📊 Performance monitoring started');
    
    // 定期的なレポート生成
    setInterval(() => {
      const report = this.generateReport();
      if (report.healthScore < 70) {
        console.warn('⚠️ Performance degradation detected:', report.recommendations);
      }
    }, 60000); // 1分ごと
  }

  /**
   * パフォーマンス警告の設定
   */
  public setSlowQueryThreshold(threshold: number): void {
    this.slowQueryThreshold = threshold;
    console.log(`📊 Slow query threshold set to ${threshold}ms`);
  }
}

// シングルトンインスタンス
export const performanceMonitor = PerformanceMonitor.getInstance();

/**
 * パフォーマンス測定のデコレータ
 */
export function measurePerformance(operation: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now();
      try {
        const result = await method.apply(this, args);
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric(operation, duration, { success: true });
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric(operation, duration, { success: false, error: error.message });
        throw error;
      }
    };

    return descriptor;
  };
}

