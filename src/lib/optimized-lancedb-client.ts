/**
 * 最適化されたLanceDBクライアント
 * 接続の永続化と接続プールを実装
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

interface LanceDBConnection {
  db: lancedb.Connection;
  table: lancedb.Table;
  tableName: string;
}

interface OptimizedLanceDBStatus {
  isConnected: boolean;
  isConnecting: boolean;
  connectionPromise: Promise<LanceDBConnection> | null;
  lastConnectionTime: number;
  connectionCount: number;
  error: string | null;
}

export class OptimizedLanceDBClient {
  private static instance: OptimizedLanceDBClient;
  private connection: LanceDBConnection | null = null;
  private status: OptimizedLanceDBStatus = {
    isConnected: false,
    isConnecting: false,
    connectionPromise: null,
    lastConnectionTime: 0,
    connectionCount: 0,
    error: null
  };
  
  private readonly config = {
    dbPath: path.resolve(process.cwd(), '.lancedb'),
    tableName: 'confluence',
    connectionTimeout: 30000, // 30秒
    maxRetries: 3,
    retryDelay: 1000 // 1秒
  };

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): OptimizedLanceDBClient {
    if (!OptimizedLanceDBClient.instance) {
      OptimizedLanceDBClient.instance = new OptimizedLanceDBClient();
    }
    return OptimizedLanceDBClient.instance;
  }

  /**
   * 最適化された接続取得（重複接続を防止）
   */
  public async getConnection(): Promise<LanceDBConnection> {
    // 既に接続済みの場合は即座にリターン
    if (this.status.isConnected && this.connection) {
      console.log('[OptimizedLanceDBClient] Using existing connection');
      return this.connection;
    }

    // 接続中の場合は同じPromiseを返す
    if (this.status.isConnecting && this.status.connectionPromise) {
      console.log('[OptimizedLanceDBClient] Connection in progress, waiting...');
      return this.status.connectionPromise;
    }

    // 新しい接続を開始
    console.log('[OptimizedLanceDBClient] Starting LanceDB connection...');
    this.status.isConnecting = true;
    this.status.error = null;
    this.status.connectionPromise = this._performConnection();

    try {
      this.connection = await this.status.connectionPromise;
      this.status.isConnected = true;
      this.status.lastConnectionTime = Date.now();
      this.status.connectionCount++;
      console.log(`[OptimizedLanceDBClient] Connection established (count: ${this.status.connectionCount})`);
      return this.connection;
    } catch (error) {
      // エラーが発生した場合は接続状態をリセット
      this.status.isConnecting = false;
      this.status.connectionPromise = null;
      this.status.isConnected = false;
      this.connection = null;
      throw error;
    }
  }

  /**
   * 実際の接続処理を実行
   */
  private async _performConnection(): Promise<LanceDBConnection> {
    const startTime = Date.now();
    
    try {
      console.log(`[OptimizedLanceDBClient] Connecting to database at: ${this.config.dbPath}`);
      
      // LanceDBデータベースに接続
      const db = await lancedb.connect(this.config.dbPath);
      console.log(`[OptimizedLanceDBClient] Database connected in ${Date.now() - startTime}ms`);

      // テーブルの存在確認と取得
      let table: lancedb.Table;
      try {
        // 既存のテーブルを開く
        table = await db.openTable(this.config.tableName);
        console.log(`[OptimizedLanceDBClient] Opened existing table '${this.config.tableName}'`);
      } catch (error) {
        console.log(`[OptimizedLanceDBClient] Table '${this.config.tableName}' not found, creating...`);
        
        // テーブルが存在しない場合は作成
        const emptyData = [{
          id: 'dummy',
          title: 'dummy',
          content: 'dummy',
          url: 'dummy',
          lastUpdated: 'dummy'
        }];

        const lanceSchema = {
          id: 'utf8',
          title: 'utf8',
          content: 'utf8',
          url: 'utf8',
          lastUpdated: 'utf8'
        };
        
        table = await db.createTable(this.config.tableName, emptyData);
        console.log(`[OptimizedLanceDBClient] Created new table '${this.config.tableName}'`);
        
        // ダミーデータを削除
        await table.delete('id = "dummy"');
        console.log(`[OptimizedLanceDBClient] Removed dummy data from table`);
      }

      const connection: LanceDBConnection = {
        db,
        table,
        tableName: this.config.tableName
      };

      const connectionTime = Date.now() - startTime;
      console.log(`[OptimizedLanceDBClient] Connection established in ${connectionTime}ms`);
      
      return connection;
      
    } catch (error) {
      console.error('[OptimizedLanceDBClient] Connection failed:', error);
      this.status.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
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
  public getStats(): OptimizedLanceDBStatus {
    return { ...this.status };
  }

  /**
   * 接続をリセット（エラー時など）
   */
  public resetConnection(): void {
    console.log('[OptimizedLanceDBClient] Resetting connection...');
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
   * 接続を強制終了
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.db.close();
        console.log('[OptimizedLanceDBClient] Connection closed');
      }
    } catch (error) {
      console.error('[OptimizedLanceDBClient] Error closing connection:', error);
    } finally {
      this.resetConnection();
    }
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
      console.log(`[OptimizedLanceDBClient] Health check passed (${result} rows)`);
      return true;
    } catch (error) {
      console.error('[OptimizedLanceDBClient] Health check failed:', error);
      this.resetConnection();
      return false;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const optimizedLanceDBClient = OptimizedLanceDBClient.getInstance();

// アプリケーション終了時に接続を閉じる
process.on('beforeExit', async () => {
  await optimizedLanceDBClient.disconnect();
});

process.on('SIGINT', async () => {
  await optimizedLanceDBClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await optimizedLanceDBClient.disconnect();
  process.exit(0);
});
