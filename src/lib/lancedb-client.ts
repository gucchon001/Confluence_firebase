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
          // StructuredLabelフィールド（nullable）
          structured_category: null,
          structured_domain: null,
          structured_feature: null,
          structured_priority: null,
          structured_status: null,
          structured_version: null,
          structured_tags: null,
          structured_confidence: null,
          structured_content_length: null,
          structured_is_valid: null
        }];
        
        // LanceDB Arrow形式のスキーマ定義（完全版 + StructuredLabel）
        // ★★★ EXTENDED SCHEMA: StructuredLabelフィールドを含む ★★★
        const lanceSchema = {
          id: 'utf8',
          vector: { 
            type: 'fixed_size_list', 
            listSize: 768, 
            field: { type: 'float32' } 
          },
          space_key: 'utf8',
          title: 'utf8',
          labels: { 
            type: 'list', 
            field: { type: 'utf8' } 
          },
          content: 'utf8',
          page_id: 'int64',  // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
          chunkIndex: 'int32',
          url: 'utf8',
          lastUpdated: 'utf8',
          isChunked: 'bool',
          totalChunks: 'int32',
          // StructuredLabelフィールド（nullable）
          structured_category: 'utf8',
          structured_domain: 'utf8',
          structured_feature: 'utf8',
          structured_priority: 'utf8',
          structured_status: 'utf8',
          structured_version: 'utf8',
          structured_tags: { 
            type: 'list', 
            field: { type: 'utf8' } 
          },
          structured_confidence: 'float32',
          structured_content_length: 'int32',
          structured_is_valid: 'bool'
        };
        
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
