/**
 * テキストチャンキングユーティリティ
 * テキストを指定サイズでチャンクに分割
 */

export interface ChunkOptions {
  maxChunkSize?: number;
  overlap?: number;
}

export interface TextChunk {
  text: string;
  index: number;
  start: number;
  end: number;
}

/**
 * テキストをチャンクに分割
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxChunkSize = options.maxChunkSize || 1800;
  const overlap = options.overlap || 200;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    const chunkText = text.substring(start, end).trim();

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunks.length,
        start,
        end,
      });
    }

    // 次のチャンクはoverlapだけ前から開始（文脈を保持）
    start = end - overlap;

    // 最後のチャンクに到達した場合は終了
    if (start + maxChunkSize >= text.length && chunks.length > 0) {
      break;
    }
  }

  // コンテンツがない場合は空のチャンクを返す
  if (chunks.length === 0) {
    chunks.push({
      text: text.trim() || '',
      index: 0,
      start: 0,
      end: text.length,
    });
  }

  return chunks;
}

