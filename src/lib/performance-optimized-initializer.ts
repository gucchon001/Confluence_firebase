/**
 * パフォーマンス最適化された初期化サービス
 * 初期化処理の重複を排除し、並列化とキャッシュ戦略を実装
 */

import { lancedbClient } from './lancedb-client';
import { lunrInitializer } from './lunr-initializer';
import { tokenizeJapaneseText, getTokenizerStatus } from './japanese-tokenizer';

interface OptimizedInitializationStatus {
  lancedb: boolean;
  lunr: boolean;
  tokenizer: boolean;
  overall: boolean;
  errors: string[];
  initializationTime: number;
}

export class PerformanceOptimizedInitializer {
  private static instance: PerformanceOptimizedInitializer;
  private status: OptimizedInitializationStatus = {
    lancedb: false,
    lunr: false,
    tokenizer: false,
    overall: false,
    errors: [],
    initializationTime: 0
  };

  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): PerformanceOptimizedInitializer {
    if (!PerformanceOptimizedInitializer.instance) {
      PerformanceOptimizedInitializer.instance = new PerformanceOptimizedInitializer();
    }
    return PerformanceOptimizedInitializer.instance;
  }

  /**
   * 最適化された初期化処理
   * 並列化、キャッシュ、エラーハンドリングを強化
   */
  async initializeAsync(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    const startTime = performance.now();
    console.log('[PerformanceOptimizedInitializer] Starting optimized initialization...');

    try {
      // 並列初期化：3つのサービスを同時に初期化
      const [lancedbResult, lunrResult, tokenizerResult] = await Promise.allSettled([
        this.initializeLanceDB(),
        this.initializeLunr(),
        this.initializeTokenizer()
      ]);

      // 結果の処理
      this.processInitializationResults(lancedbResult, lunrResult, tokenizerResult);

      const endTime = performance.now();
      this.status.initializationTime = endTime - startTime;

      this.isInitialized = this.status.lancedb && this.status.lunr && this.status.tokenizer;
      this.status.overall = this.isInitialized;

      if (this.isInitialized) {
        console.log(`✅ Optimized initialization completed in ${this.status.initializationTime.toFixed(2)}ms`);
      } else {
        console.warn(`⚠️ Partial initialization completed in ${this.status.initializationTime.toFixed(2)}ms`);
        console.warn('Errors:', this.status.errors);
      }

    } catch (error) {
      console.error('❌ Optimized initialization failed:', error);
      this.status.errors.push(`Initialization: ${error instanceof Error ? error.message : String(error)}`);
      this.status.overall = false;
      throw error;
    }
  }

  /**
   * LanceDBの最適化された初期化
   */
  private async initializeLanceDB(): Promise<void> {
    try {
      console.log('[PerformanceOptimizedInitializer] Initializing LanceDB...');
      await lancedbClient.getConnection(); // 接続確認のみ
      this.status.lancedb = true;
      console.log('✅ LanceDB initialization completed');
    } catch (error) {
      console.error('❌ LanceDB initialization failed:', error);
      this.status.errors.push(`LanceDB: ${error instanceof Error ? error.message : String(error)}`);
      this.status.lancedb = false;
      throw error;
    }
  }

  /**
   * Lunrの最適化された初期化
   */
  private async initializeLunr(): Promise<void> {
    try {
      console.log('[PerformanceOptimizedInitializer] Initializing Lunr...');
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
      // Lunrの初期化失敗は致命的ではないため、エラーを投げない
    }
  }

  /**
   * 日本語トークナイザーの最適化された初期化
   */
  private async initializeTokenizer(): Promise<void> {
    try {
      console.log('[PerformanceOptimizedInitializer] Initializing Japanese tokenizer...');
      
      // 事前にトークナイザーを初期化
      await tokenizeJapaneseText('初期化テスト');
      
      const tokenizerStatus = getTokenizerStatus();
      this.status.tokenizer = tokenizerStatus.initialized;
      
      if (this.status.tokenizer) {
        console.log('✅ Japanese tokenizer initialization completed');
      } else {
        console.warn('⚠️ Japanese tokenizer initialization failed');
      }
    } catch (error) {
      console.error('❌ Japanese tokenizer initialization failed:', error);
      this.status.errors.push(`Tokenizer: ${error instanceof Error ? error.message : String(error)}`);
      this.status.tokenizer = false;
      // トークナイザーの初期化失敗は致命的ではないため、エラーを投げない
    }
  }

  /**
   * 初期化結果の処理
   */
  private processInitializationResults(
    lancedbResult: PromiseSettledResult<void>,
    lunrResult: PromiseSettledResult<void>,
    tokenizerResult: PromiseSettledResult<void>
  ): void {
    if (lancedbResult.status === 'rejected') {
      this.status.lancedb = false;
      this.status.errors.push(`LanceDB: ${lancedbResult.reason}`);
    }

    if (lunrResult.status === 'rejected') {
      this.status.lunr = false;
      this.status.errors.push(`Lunr: ${lunrResult.reason}`);
    }

    if (tokenizerResult.status === 'rejected') {
      this.status.tokenizer = false;
      this.status.errors.push(`Tokenizer: ${tokenizerResult.reason}`);
    }
  }

  /**
   * 初期化状態を取得
   */
  public getStatus(): OptimizedInitializationStatus {
    return { ...this.status };
  }

  /**
   * 初期化が完了しているかチェック
   */
  public isReady(): boolean {
    return this.isInitialized && this.status.overall;
  }

  /**
   * 初期化をリセット（テスト用）
   */
  public reset(): void {
    this.isInitialized = false;
    this.initializationPromise = null;
    this.status = {
      lancedb: false,
      lunr: false,
      tokenizer: false,
      overall: false,
      errors: [],
      initializationTime: 0
    };
  }

  /**
   * パフォーマンス統計を取得
   */
  public getPerformanceStats(): {
    initializationTime: number;
    isOptimized: boolean;
    servicesReady: { lancedb: boolean; lunr: boolean; tokenizer: boolean };
  } {
    return {
      initializationTime: this.status.initializationTime,
      isOptimized: this.isInitialized,
      servicesReady: {
        lancedb: this.status.lancedb,
        lunr: this.status.lunr,
        tokenizer: this.status.tokenizer
      }
    };
  }
}

// シングルトンインスタンス
export const performanceOptimizedInitializer = PerformanceOptimizedInitializer.getInstance();

/**
 * アプリケーション起動時の最適化された初期化
 */
export async function initializeOptimizedOnStartup(): Promise<void> {
  try {
    await performanceOptimizedInitializer.initializeAsync();
    console.log('🚀 Optimized initialization completed on startup');
  } catch (error) {
    console.error('❌ Optimized initialization failed on startup:', error);
    // エラーが発生してもアプリケーションは継続
  }
}

