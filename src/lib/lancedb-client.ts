/**
 * 統一されたLanceDBクライアント
 * 重複コードを解消し、一貫したLanceDB接続とテーブル操作を提供
 * optimized-lancedb-client.ts の機能を統合（接続プール、エラーハンドリング、ヘルスチェック）
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

export interface LanceDBConnection {
  db: lancedb.Connection;
  table: lancedb.Table;
  tableName: string;
}

export interface LanceDBClientConfig {
  dbPath?: string;
  tableName?: string;
  connectionTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface LanceDBStatus {
  isConnected: boolean;
  isConnecting: boolean;
  connectionPromise: Promise<LanceDBConnection> | null;
  lastConnectionTime: number;
  connectionCount: number;
  error: string | null;
}

/**
 * LanceDBクライアントのシングルトンクラス
 * 最適化機能（接続プール、重複接続防止、ヘルスチェック）を統合
 */
export class LanceDBClient {
  private static instance: LanceDBClient;
  private connection: LanceDBConnection | null = null;
  private config: LanceDBClientConfig;
  private status: LanceDBStatus = {
    isConnected: false,
    isConnecting: false,
    connectionPromise: null,
    lastConnectionTime: 0,
    connectionCount: 0,
    error: null
  };

  private constructor(config: LanceDBClientConfig = {}) {
    this.config = {
      dbPath: config.dbPath || this.getDbPath(),
      tableName: config.tableName || 'confluence',
      connectionTimeout: config.connectionTimeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      ...config
    };
  }

  /**
   * Phase 0A-4: Cloud Run Gen2環境でインメモリファイルシステムのパスを返す
   */
  private getDbPath(): string {
    const isCloudRun = process.env.K_SERVICE !== undefined;
    const useInMemoryFS = process.env.USE_INMEMORY_FS === 'true' && isCloudRun;
    
    if (useInMemoryFS) {
      console.log('🔥 [LanceDBClient] Using in-memory file system: /dev/shm/.lancedb');
      return '/dev/shm/.lancedb';
    }
    
    return path.resolve(process.cwd(), '.lancedb');
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(config?: LanceDBClientConfig): LanceDBClient {
    if (!LanceDBClient.instance) {
      LanceDBClient.instance = new LanceDBClient(config);
    }
    return LanceDBClient.instance;
  }

  /**
   * 最適化された接続取得（重複接続を防止）
   */
  public async getConnection(): Promise<LanceDBConnection> {
    // 既に接続済みの場合は即座にリターン
    if (this.status.isConnected && this.connection) {
      console.log('[LanceDBClient] Using existing connection');
      return this.connection;
    }

    // 接続中の場合は同じPromiseを返す
    if (this.status.isConnecting && this.status.connectionPromise) {
      console.log('[LanceDBClient] Connection in progress, waiting...');
      return this.status.connectionPromise;
    }

    // 新しい接続を開始
    console.log('[LanceDBClient] Starting LanceDB connection...');
    this.status.isConnecting = true;
    this.status.error = null;
    this.status.connectionPromise = this._performConnection();

    try {
      this.connection = await this.status.connectionPromise;
      this.status.isConnected = true;
      this.status.lastConnectionTime = Date.now();
      this.status.connectionCount++;
      console.log(`[LanceDBClient] Connection established (count: ${this.status.connectionCount})`);
      return this.connection;
    } catch (error) {
      // エラーが発生した場合は接続状態をリセット
      this.status.isConnecting = false;
      this.status.connectionPromise = null;
      this.status.isConnected = false;
      this.status.error = error instanceof Error ? error.message : String(error);
      this.connection = null;
      throw error;
    }
  }

  /**
   * LanceDBに接続し、テーブルを開く（後方互換性のため維持）
   */
  public async connect(): Promise<LanceDBConnection> {
    return await this.getConnection();
  }

  /**
   * 実際の接続処理を実行
   */
  private async _performConnection(): Promise<LanceDBConnection> {
    const startTime = Date.now();
    
    try {
      console.log(`[LanceDBClient] Connecting to database at: ${this.config.dbPath}`);
      
      // LanceDBデータベースに接続
      const db = await lancedb.connect(this.config.dbPath!);
      console.log(`[LanceDBClient] Database connected in ${Date.now() - startTime}ms`);

      // テーブル存在確認
      const tableNames = await db.tableNames();
      let table;
      
      if (!tableNames.includes(this.config.tableName!)) {
        console.log(`[LanceDBClient] Table '${this.config.tableName}' not found. Creating new table...`);
        
        // 空のデータでテーブルを作成（LanceDBの正しいスキーマ形式）
        // ★★★ EXTENDED SCHEMA: StructuredLabelフィールドを含む ★★★
        const emptyData = [{
          id: 'dummy',
          vector: new Array(768).fill(0.0), // float32の配列
          space_key: 'dummy',
          title: 'dummy',
          labels: ['dummy'], // 文字列配列（明示的に配列として定義）
          content: 'dummy',
          page_id: 0,  // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
          chunkIndex: 0,
          url: 'dummy',
          lastUpdated: new Date().toISOString(),
          isChunked: true,
          totalChunks: 1,
          // StructuredLabelフィールド（非nullデフォルト値でスキーマ推論を補助）
          structured_category: '',
          structured_domain: '',
          structured_feature: '',
          structured_priority: '',
          structured_status: '',
          structured_version: '',
          structured_tags: ['dummy'], // 空配列では推論できないためダミー要素を追加
          structured_confidence: 0.0,
          structured_content_length: 0,
          structured_is_valid: false
        }];
        
        try {
          table = await db.createTable(this.config.tableName!, emptyData);
          console.log(`[LanceDBClient] Created new table '${this.config.tableName}'`);
          
          // ダミーデータを削除
          await table.delete('id = "dummy"');
          console.log(`[LanceDBClient] Removed dummy data from table`);
        } catch (error) {
          console.log(`[LanceDBClient] Table creation failed, trying to open existing table: ${error}`);
          table = await db.openTable(this.config.tableName!);
          console.log(`[LanceDBClient] Opened existing table '${this.config.tableName}'`);
        }
      } else {
        // 既存のテーブルを開く
        table = await db.openTable(this.config.tableName!);
        console.log(`[LanceDBClient] Opened existing table '${this.config.tableName}'`);
      }

      const connection: LanceDBConnection = {
        db,
        table,
        tableName: this.config.tableName!
      };

      const connectionTime = Date.now() - startTime;
      console.log(`[LanceDBClient] Connection established in ${connectionTime}ms`);
      
      return connection;
      
    } catch (error) {
      console.error('[LanceDBClient] Connection failed:', error);
      this.status.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }


  /**
   * テーブルを取得
   */
  public async getTable(): Promise<lancedb.Table> {
    const connection = await this.getConnection();
    return connection.table;
  }

  /**
   * データベースを取得
   */
  public async getDatabase(): Promise<lancedb.Connection> {
    const connection = await this.getConnection();
    return connection.db;
  }

  /**
   * テーブル名を取得
   */
  public getTableName(): string {
    return this.config.tableName!;
  }

  /**
   * 接続を閉じる（後方互換性のため維持）
   */
  public async close(): Promise<void> {
    await this.disconnect();
  }

  /**
   * 接続を強制終了
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.db.close();
        console.log('[LanceDBClient] Connection closed');
      }
    } catch (error) {
      console.error('[LanceDBClient] Error closing connection:', error);
    } finally {
      this.resetConnection();
    }
  }

  /**
   * 接続をリセット（エラー時など）
   */
  public resetConnection(): void {
    console.log('[LanceDBClient] Resetting connection...');
    this.status = {
      isConnected: false,
      isConnecting: false,
      connectionPromise: null,
      lastConnectionTime: 0,
      connectionCount: this.status.connectionCount,
      error: null
    };
    this.connection = null;
  }

  /**
   * 接続状態を確認
   */
  public isConnected(): boolean {
    return this.status.isConnected && this.connection !== null;
  }

  /**
   * 接続統計を取得
   */
  public getStats(): LanceDBStatus {
    return { ...this.status };
  }

  /**
   * 接続の健全性チェック
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        return false;
      }

      const connection = await this.getConnection();
      // 簡単なクエリで接続をテスト
      const result = await connection.table.countRows();
      console.log(`[LanceDBClient] Health check passed (${result} rows)`);
      return true;
    } catch (error) {
      console.error('[LanceDBClient] Health check failed:', error);
      this.resetConnection();
      return false;
    }
  }

  /**
   * 設定を更新
   */
  public updateConfig(newConfig: Partial<LanceDBClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 設定が変更された場合は接続をリセット
    if (this.connection) {
      this.connection = null;
    }
  }
}

/**
 * デフォルトのLanceDBクライアントインスタンス
 */
export const lancedbClient = LanceDBClient.getInstance();

// アプリケーション終了時に接続を閉じる
process.on('beforeExit', async () => {
  await lancedbClient.disconnect();
});

process.on('SIGINT', async () => {
  await lancedbClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await lancedbClient.disconnect();
  process.exit(0);
});

/**
 * 便利な関数: テーブルを取得
 */
export async function getLanceDBTable(tableName?: string): Promise<lancedb.Table> {
  const client = tableName 
    ? LanceDBClient.getInstance({ tableName })
    : lancedbClient;
  
  return await client.getTable();
}

/**
 * 便利な関数: データベースを取得
 */
export async function getLanceDBDatabase(): Promise<lancedb.Connection> {
  return await lancedbClient.getDatabase();
}
