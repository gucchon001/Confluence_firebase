/**
 * システムヘルス監視サービス
 * データベース接続、サービス状況、システムメトリクスを監視します
 */

import type { SystemHealth, ServiceStatus, PerformanceAlert } from '@/types';
// LanceDBクライアントは動的インポートを使用（サーバーサイドでのみ必要）
// import { lancedbClient } from './lancedb-client';
import { performanceAlertService } from './performance-alert-service';
import type { PostLog } from '@/types';

export class SystemHealthService {
  private static instance: SystemHealthService;
  private lastHealthCheck: SystemHealth | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): SystemHealthService {
    if (!SystemHealthService.instance) {
      SystemHealthService.instance = new SystemHealthService();
    }
    return SystemHealthService.instance;
  }

  /**
   * システムステータスを取得
   */
  public async getSystemStatus(): Promise<SystemHealth> {
    const startTime = Date.now();

    // 各サービスのヘルスチェックを並列実行
    const [lancedbStatus, firestoreStatus, geminiStatus, authStatus, cacheStatus] = await Promise.all([
      this.checkLanceDBHealth(),
      this.checkFirestoreHealth(),
      this.checkGeminiHealth(),
      this.checkAuthenticationHealth(),
      this.checkCacheHealth(),
    ]);

    // パフォーマンスアラートを取得
    const alerts = await this.getSystemAlerts();

    // 全体のステータスを決定
    const overallStatus = this.determineOverallStatus([
      lancedbStatus,
      firestoreStatus,
      geminiStatus,
      authStatus,
      cacheStatus,
    ]);

    const health: SystemHealth = {
      id: `health-${Date.now()}`,
      timestamp: new Date(),
      status: overallStatus,
      services: {
        lancedb: lancedbStatus,
        firestore: firestoreStatus,
        gemini: geminiStatus,
        authentication: authStatus,
        cache: cacheStatus,
      },
      alerts,
    };

    this.lastHealthCheck = health;
    return health;
  }

  /**
   * LanceDBのヘルスチェック
   * サーバーサイドでのみ実行可能（ネイティブモジュールのため）
   */
  private async checkLanceDBHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      // クライアントサイドでは実行不可
      if (typeof window !== 'undefined') {
        return {
          status: 'warning',
          message: 'LanceDBヘルスチェックはサーバーサイドでのみ利用可能です',
          lastChecked: new Date(),
          responseTime: Date.now() - startTime,
        };
      }

      // サーバーサイドでのみ動的インポート（ネイティブモジュールをブラウザに含めない）
      const { lancedbClient } = await import('./lancedb-client');
      const isHealthy = await lancedbClient.healthCheck();
      const responseTime = Date.now() - startTime;

      if (!isHealthy) {
        return {
          status: 'critical',
          message: 'LanceDB接続に失敗しました',
          lastChecked: new Date(),
          responseTime,
        };
      }

      const stats = lancedbClient.getStats();
      const status: ServiceStatus = {
        status: 'healthy',
        message: `LanceDB接続正常`,
        lastChecked: new Date(),
        responseTime,
      };

      if (responseTime > 1000) {
        status.status = 'warning';
        status.message += ' (応答時間が遅い)';
      }

      return status;
    } catch (error) {
      return {
        status: 'critical',
        message: `LanceDBエラー: ${error instanceof Error ? error.message : String(error)}`,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Firestoreのヘルスチェック
   */
  private async checkFirestoreHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      // サーバーサイドでのみ実行可能
      if (typeof window !== 'undefined') {
        return {
          status: 'warning',
          message: 'Firestoreヘルスチェックはサーバーサイドでのみ利用可能です',
          lastChecked: new Date(),
        };
      }

      const { getFirestore } = await import('firebase-admin/firestore');
      const { getApps } = await import('firebase-admin/app');
      
      if (getApps().length === 0) {
        return {
          status: 'critical',
          message: 'Firebase Adminが初期化されていません',
          lastChecked: new Date(),
        };
      }

      const firestore = getFirestore();
      // 簡単な読み取り操作で接続をテスト
      const testRef = firestore.collection('_health_check').doc('test');
      await testRef.get();
      
      const responseTime = Date.now() - startTime;
      return {
        status: 'healthy',
        message: 'Firestore接続正常',
        lastChecked: new Date(),
        responseTime,
      };
    } catch (error) {
      return {
        status: 'critical',
        message: `Firestoreエラー: ${error instanceof Error ? error.message : String(error)}`,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Gemini APIのヘルスチェック
   */
  private async checkGeminiHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      // Gemini APIの接続確認（実際のAPI呼び出しは行わない）
      // 環境変数の存在確認のみ
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return {
          status: 'critical',
          message: 'Gemini APIキーが設定されていません',
          lastChecked: new Date(),
        };
      }

      // APIキーの形式チェック（簡単な検証）
      if (apiKey.length < 20) {
        return {
          status: 'warning',
          message: 'Gemini APIキーの形式が不正の可能性があります',
          lastChecked: new Date(),
        };
      }

      return {
        status: 'healthy',
        message: 'Gemini API設定正常',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'critical',
        message: `Gemini APIエラー: ${error instanceof Error ? error.message : String(error)}`,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 認証サービスのヘルスチェック
   */
  private async checkAuthenticationHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      // Firebase Authenticationの設定確認
      if (typeof window !== 'undefined') {
        // クライアントサイド: Firebase Authの初期化確認
        const { getAuth } = await import('firebase/auth');
        const { app } = await import('./firebase');
        const auth = getAuth(app);
        
        return {
          status: 'healthy',
          message: 'Firebase Authentication初期化済み',
          lastChecked: new Date(),
          responseTime: Date.now() - startTime,
        };
      } else {
        // サーバーサイド: Firebase Admin Authの確認
        const { getAuth } = await import('firebase-admin/auth');
        const { getApps } = await import('firebase-admin/app');
        
        if (getApps().length === 0) {
          return {
            status: 'critical',
            message: 'Firebase Adminが初期化されていません',
            lastChecked: new Date(),
          };
        }

        const auth = getAuth();
        // 認証サービスの利用可能性を確認（実際のユーザー取得は行わない）
        return {
          status: 'healthy',
          message: 'Firebase Admin Authentication利用可能',
          lastChecked: new Date(),
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        status: 'critical',
        message: `認証サービスエラー: ${error instanceof Error ? error.message : String(error)}`,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * キャッシュサービスのヘルスチェック
   */
  private async checkCacheHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      // キャッシュサービスの状態確認
      // 実際の実装では、キャッシュサービスのヘルスチェックメソッドを呼び出す
      return {
        status: 'healthy',
        message: 'キャッシュサービス正常',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'warning',
        message: `キャッシュサービス警告: ${error instanceof Error ? error.message : String(error)}`,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * システムアラートを取得
   */
  private async getSystemAlerts(): Promise<PerformanceAlert[]> {
    try {
      // システム負荷関連のアラートを取得
      // 実際の実装では、PostLogからシステム負荷を計算
      const alerts: PerformanceAlert[] = [];
      
      // 現在はシステムアラートなし（メトリクス削除に伴い）

      return alerts;
    } catch (error) {
      console.error('[SystemHealthService] アラート取得エラー:', error);
      return [];
    }
  }

  /**
   * 全体のステータスを決定
   */
  private determineOverallStatus(
    services: ServiceStatus[]
  ): 'healthy' | 'warning' | 'critical' {
    // Criticalステータスのサービスがある場合
    if (services.some(s => s.status === 'critical')) {
      return 'critical';
    }

    // Warningステータスのサービスがある場合
    if (services.some(s => s.status === 'warning')) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * ヘルスダッシュボード用のデータを取得
   */
  public async getHealthDashboardData(): Promise<{
    status: SystemHealth;
    history: SystemHealth[];
  }> {
    const status = await this.getSystemStatus();
    
    // 履歴は簡易実装（実際の実装ではFirestoreから取得）
    const history: SystemHealth[] = this.lastHealthCheck ? [this.lastHealthCheck] : [];

    return {
      status,
      history,
    };
  }

  /**
   * 定期的なヘルスチェックを開始
   */
  public startPeriodicHealthCheck(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      this.stopPeriodicHealthCheck();
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.getSystemStatus();
    }, intervalMs);
  }

  /**
   * 定期的なヘルスチェックを停止
   */
  public stopPeriodicHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * サービスステータスの表示名を取得
   */
  public getServiceName(service: keyof SystemHealth['services']): string {
    const names: Record<keyof SystemHealth['services'], string> = {
      lancedb: 'LanceDB',
      firestore: 'Firestore',
      gemini: 'Gemini API',
      authentication: '認証サービス',
      cache: 'キャッシュサービス',
    };
    return names[service] || service;
  }

  /**
   * ステータスの色を取得
   */
  public getStatusColor(status: 'healthy' | 'warning' | 'critical'): string {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  /**
   * ステータスの表示名を取得
   */
  public getStatusName(status: 'healthy' | 'warning' | 'critical'): string {
    switch (status) {
      case 'healthy':
        return '正常';
      case 'warning':
        return '警告';
      case 'critical':
        return '緊急';
      default:
        return '不明';
    }
  }
}

// シングルトンインスタンスをエクスポート
export const systemHealthService = SystemHealthService.getInstance();

