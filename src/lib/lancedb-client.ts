/**
 * 統一されたLanceDBクライアント
 * 重複コードを解消し、一貫したLanceDB接続とテーブル操作を提供
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
}

/**
 * LanceDBクライアントのシングルトンクラス
 */
export class LanceDBClient {
  private static instance: LanceDBClient;
  private connection: LanceDBConnection | null = null;
  private config: LanceDBClientConfig;

  private constructor(config: LanceDBClientConfig = {}) {
    this.config = {
      dbPath: config.dbPath || path.resolve(process.cwd(), '.lancedb'),
      tableName: config.tableName || 'confluence',
      ...config
    };
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
   * LanceDBに接続し、テーブルを開く
   */
  public async connect(): Promise<LanceDBConnection> {
    if (this.connection) {
      return this.connection;
    }

    try {
      console.log(`[LanceDBClient] Connecting to LanceDB at ${this.config.dbPath}`);
      
      // データベースに接続
      const db = await lancedb.connect(this.config.dbPath!);
      
      // テーブル存在確認
      const tableNames = await db.tableNames();
      if (!tableNames.includes(this.config.tableName!)) {
        throw new Error(`Table '${this.config.tableName}' not found. Available tables: ${tableNames.join(', ')}`);
      }
      
      // テーブルを開く
      const table = await db.openTable(this.config.tableName!);
      
      this.connection = {
        db,
        table,
        tableName: this.config.tableName!
      };
      
      console.log(`[LanceDBClient] Successfully connected to table '${this.config.tableName}'`);
      return this.connection;
      
    } catch (error) {
      console.error('[LanceDBClient] Connection failed:', error);
      throw error;
    }
  }

  /**
   * 接続を取得（既に接続されている場合はそのまま返す）
   */
  public async getConnection(): Promise<LanceDBConnection> {
    if (!this.connection) {
      await this.connect();
    }
    return this.connection!;
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
   * 接続を閉じる
   */
  public async close(): Promise<void> {
    if (this.connection) {
      // LanceDBの接続を閉じる（必要に応じて）
      this.connection = null;
      console.log('[LanceDBClient] Connection closed');
    }
  }

  /**
   * 接続状態を確認
   */
  public isConnected(): boolean {
    return this.connection !== null;
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
