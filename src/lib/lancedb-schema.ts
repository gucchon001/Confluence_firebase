/**
 * LanceDBスキーマ定義
 */
// スキーマ定義のインターフェース
interface SchemaField {
  type: string;
  valueType?: string;
  dimensions?: number;
  nullable: boolean;
}

interface SchemaDefinition {
  [key: string]: SchemaField;
}

// 最小限のスキーマ定義（エラー切り分け用）
export const MinimalLanceDBSchema: SchemaDefinition = {
  id: { type: 'string', nullable: false },
  vector: { type: 'vector', valueType: 'float32', dimensions: 384, nullable: false },
  title: { type: 'string', nullable: false },
  content: { type: 'string', nullable: false }
};

// 完全なスキーマ定義
export const FullLanceDBSchema: SchemaDefinition = {
  id: { type: 'string', nullable: false },
  vector: { type: 'vector', valueType: 'float32', dimensions: 384, nullable: false },
  space_key: { type: 'string', nullable: false },
  title: { type: 'string', nullable: false },
  labels: { type: 'list', valueType: 'string', nullable: false },
  content: { type: 'string', nullable: false },
  pageId: { type: 'int64', nullable: false },
  chunkIndex: { type: 'int32', nullable: false },
  url: { type: 'string', nullable: false },
  lastUpdated: { type: 'string', nullable: false }
};

// Confluenceテーブルのスキーマ型
export interface ConfluenceSchema {
  id: string;
  vector: number[];
  space_key: string;
  title: string;
  labels: string[];
  content: string;
  pageId: number;
  chunkIndex: number;
  url: string;
  lastUpdated: string;
}

/**
 * Confluenceテーブルのサンプルデータを生成する
 * @returns サンプルデータ
 */
export function createConfluenceSampleData(): ConfluenceSchema {
  return {
    id: 'sample-1',
    vector: new Array(384).fill(0),
    space_key: 'SAMPLE',
    title: 'Sample Title',
    labels: ['sample'],
    content: 'Sample content',
    pageId: 1000000000,
    chunkIndex: 0,
    url: 'https://example.com',
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Confluenceレコードを作成する
 * @param id レコードID
 * @param vector 埋め込みベクトル
 * @param spaceKey スペースキー
 * @param title タイトル
 * @param content 内容
 * @param pageId ページID
 * @param chunkIndex チャンクインデックス
 * @param url URL
 * @param lastUpdated 最終更新日時
 * @param labels ラベル
 * @returns Confluenceレコード
 */
export function createConfluenceRecord(
  id: string,
  vector: number[],
  spaceKey: string,
  title: string,
  content: string,
  pageId: number,
  chunkIndex: number,
  url: string,
  lastUpdated: string,
  labels: string[] = []
): ConfluenceSchema {
  return {
    id,
    vector,
    space_key: spaceKey,
    title,
    labels,
    content,
    pageId,
    chunkIndex,
    url,
    lastUpdated
  };
}
