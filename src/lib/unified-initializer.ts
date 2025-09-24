/**
 * 統一された初期化サービス
 * 重複コードを解消し、一貫したアプリケーション初期化を提供
 */

import { lancedbClient } from './lancedb-client';
import { lunrInitializer } from './lunr-initializer';

export interface InitializationStatus {
  lancedb: boolean;
  lunr: boolean;
  overall: boolean;
  errors: string[];
}

/**
 * 統一された初期化サービス
 */
export class UnifiedInitializer {
  private static instance: UnifiedInitializer;
  private status: InitializationStatus = {
    lancedb: false,
    lunr: false,
    overall: false,
    errors: []
  };

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): UnifiedInitializer {
    if (!UnifiedInitializer.instance) {
      UnifiedInitializer.instance = new UnifiedInitializer();
    }
    return UnifiedInitializer.instance;
  }

  /**
   * アプリケーション全体を初期化
   */
  public async initializeAll(): Promise<InitializationStatus> {
    console.log('🚀 Starting application initialization...');
    
    // エラーをリセット
    this.status.errors = [];
    
    try {
      // 並列初期化でパフォーマンス向上
      console.log('[UnifiedInitializer] Starting parallel initialization...');
      
      const [lancedbResult, lunrResult] = await Promise.allSettled([
        this.initializeLanceDB(),
        this.initializeLunr()
      ]);
      
      // LanceDB結果の処理
      if (lancedbResult.status === 'fulfilled') {
        console.log('✅ LanceDB initialization completed');
        this.status.lancedb = true;
      } else {
        const errorMessage = `LanceDB initialization failed: ${lancedbResult.reason}`;
        console.error(`❌ ${errorMessage}`);
        this.status.errors.push(errorMessage);
      }
      
      // Lunr結果の処理
      if (lunrResult.status === 'fulfilled') {
        console.log('✅ Lunr initialization completed');
        this.status.lunr = true;
      } else {
        const errorMessage = `Lunr initialization failed: ${lunrResult.reason}`;
        console.error(`❌ ${errorMessage}`);
        this.status.errors.push(errorMessage);
      }
      
      // 全体の状態を更新
      this.status.overall = this.status.lancedb && this.status.lunr;
      
      if (this.status.overall) {
        console.log('✅ Application initialization completed successfully');
      } else {
        console.warn('⚠️ Application initialization completed with warnings');
      }
      
    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      this.status.errors.push(error instanceof Error ? error.message : String(error));
    }
    
    return this.status;
  }

  /**
   * LanceDBを初期化
   */
  private async initializeLanceDB(): Promise<void> {
    try {
      console.log('[UnifiedInitializer] Initializing LanceDB...');
      await lancedbClient.connect();
      this.status.lancedb = true;
      console.log('✅ LanceDB initialization completed');
    } catch (error) {
      console.error('❌ LanceDB initialization failed:', error);
      this.status.errors.push(`LanceDB: ${error instanceof Error ? error.message : String(error)}`);
      this.status.lancedb = false;
    }
  }

  /**
   * Lunrを初期化
   */
  private async initializeLunr(): Promise<void> {
    try {
      console.log('[UnifiedInitializer] Initializing Lunr...');
      await lunrInitializer.initializeAsync();
      this.status.lunr = lunrInitializer.isReady();
      
      if (this.status.lunr) {
        console.log('✅ Lunr initialization completed');
      } else {
        console.warn('⚠️ Lunr initialization completed but not ready');
      }
    } catch (error) {
      console.error('❌ Lunr initialization failed:', error);
      this.status.errors.push(`Lunr: ${error instanceof Error ? error.message : String(error)}`);
      this.status.lunr = false;
    }
  }

  /**
   * 初期化状態を取得
   */
  public getStatus(): InitializationStatus {
    return { ...this.status };
  }

  /**
   * 初期化が完了しているかチェック
   */
  public isInitialized(): boolean {
    return this.status.overall;
  }

  /**
   * 特定のコンポーネントが初期化されているかチェック
   */
  public isComponentInitialized(component: 'lancedb' | 'lunr'): boolean {
    return this.status[component];
  }

  /**
   * エラーを取得
   */
  public getErrors(): string[] {
    return [...this.status.errors];
  }

  /**
   * 状態をリセット
   */
  public reset(): void {
    this.status = {
      lancedb: false,
      lunr: false,
      overall: false,
      errors: []
    };
  }
}

/**
 * デフォルトの統一初期化サービスインスタンス
 */
export const unifiedInitializer = UnifiedInitializer.getInstance();

/**
 * 便利な関数: アプリケーション全体を初期化
 */
export async function initializeApplication(): Promise<InitializationStatus> {
  return await unifiedInitializer.initializeAll();
}

/**
 * 便利な関数: 初期化状態をチェック
 */
export function isApplicationInitialized(): boolean {
  return unifiedInitializer.isInitialized();
}
