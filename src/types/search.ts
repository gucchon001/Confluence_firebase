export type SourceType = 'vector' | 'bm25' | 'hybrid' | 'title';
export type ScoreKind = 'vector' | 'bm25' | 'hybrid' | 'title';

export interface SearchParams {
  query: string;
  topK?: number;
  useLunrBM25?: boolean;
  labelFilters?: { includeMeetingNotes: boolean };
  tableName?: string;
}

export interface LanceDBRow {
  pageId: number; // 小文字i
  title: string;
  content: string;
  labels: string[];
  url: string;
  spaceKey?: string;
  vector?: number[] | Float32Array;
}

export interface SearchResult {
  pageId: number;
  title: string;
  content: string;
  labels: string[];
  url: string;
  source: SourceType;
  scoreKind: ScoreKind;
  scoreRaw: number;
  scoreText: string;
}


