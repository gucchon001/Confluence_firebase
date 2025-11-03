/**
 * 最適化されたLunr初期化マネージャー
 * シングルトンパターンで初期化状態を管理し、重複初期化を防止
 */

import { LunrInitializer, lunrInitializer } from './lunr-initializer';

interface OptimizedLunrStatus {
  isInitialized: boolean;
  isInitializing: boolean;
  initializationPromise: Promise<void> | null;
  lastInitializationTime: number;
  error: string | null;
}

export class OptimizedLunrInitializer {
  private static instance: OptimizedLunrInitializer;
  private status: OptimizedLunrStatus = {
    isInitialized: false,
    isInitializing: false,
    initializationPromise: null,
    lastInitializationTime: 0,
    error: null
  };

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): OptimizedLunrInitializer {
    if (!OptimizedLunrInitializer.instance) {
      OptimizedLunrInitializer.instance = new OptimizedLunrInitializer();
    }
    return OptimizedLunrInitializer.instance;
  }

  /**
   * 最適化された初期化（重複実行を防止）
   */
  public async initializeOnce(): Promise<void> {
    // 既に初期化済みの場合は即座にリターン
    if (this.status.isInitialized) {
      console.log('[OptimizedLunrInitializer] Already initialized, skipping...');
      return;
    }

    // 初期化中の場合は同じPromiseを返す
    if (this.status.isInitializing && this.status.initializationPromise) {
      console.log('[OptimizedLunrInitializer] Initialization in progress, waiting...');
      return this.status.initializationPromise;
    }

    // 新しい初期化を開始
    console.log('[OptimizedLunrInitializer] Starting Lunr initialization...');
    this.status.isInitializing = true;
    this.status.error = null;
    this.status.initializationPromise = this._performInitialization();

    try {
      await this.status.initializationPromise;
    } catch (error) {
      // エラーが発生した場合は初期化状態をリセット
      this.status.isInitializing = false;
      this.status.initializationPromise = null;
      throw error;
    }
  }

  /**
   * 実際の初期化処理を実行
   */
  private async _performInitialization(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // 既存のLunrInitializerを使用して初期化
      await lunrInitializer.initializeAsync();
      
      const endTime = performance.now();
      this.status.lastInitializationTime = endTime - startTime;
      this.status.isInitialized = true;
      this.status.isInitializing = false;
      
      console.log(`[OptimizedLunrInitializer] Initialization completed in ${this.status.lastInitializationTime.toFixed(2)}ms`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.status.error = errorMessage;
      this.status.isInitializing = false;
      
      console.error(`[OptimizedLunrInitializer] Initialization failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 初期化状態を確認
   */
  public isReady(): boolean {
    return this.status.isInitialized && lunrInitializer.isReady();
  }

  /**
   * 初期化状態を取得
   */
  public getStatus(): OptimizedLunrStatus {
    return { ...this.status };
  }

  /**
   * 初期化を強制的にリセット（テスト用）
   */
  public reset(): void {
    this.status = {
      isInitialized: false,
      isInitializing: false,
      initializationPromise: null,
      lastInitializationTime: 0,
      error: null
    };
    console.log('[OptimizedLunrInitializer] Status reset');
  }

  /**
   * 初期化時間を取得
   */
  public getInitializationTime(): number {
    return this.status.lastInitializationTime;
  }
}

// シングルトンインスタンスをエクスポート
export const optimizedLunrInitializer = OptimizedLunrInitializer.getInstance();
