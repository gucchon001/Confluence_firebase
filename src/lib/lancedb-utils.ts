import { mapLanceDBRecordToAPI, mapLanceDBRecordsToAPI } from './pageid-migration-helper';
import { removeBOM } from './bom-utils';

/**
 * ページIDで範囲検索して行を取得（フォールバック対応）
 * ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
 */
export async function getRowsByPageId(tbl: any, pageId: number) {
  // Fallback strategy to emulate equality in environments where '=' may not hit
  const lower = pageId;
  const upper = pageId + 1;
  const where = `\`page_id\` >= ${lower} AND \`page_id\` < ${upper}`;
  const results = await (tbl as any).query().where(where).toArray();
  
  // ★★★ MIGRATION: データベースのpage_idをpageIdに変換（API互換性） ★★★
  return mapLanceDBRecordsToAPI(results);
}

/**
 * URLのLIKE検索でページIDの行を取得（フォールバック用）
 */
export async function getRowsByPageIdViaUrl(tbl: any, pageId: number) {
  // Reliable fallback: url contains /pages/<pageId>
  const where = `url LIKE '%/pages/${pageId}%'`;
  return await (tbl as any).query().where(where).toArray();
}

/**
 * ページIDで単一ページを取得（最初のチャンクのみ）
 * @param tbl LanceDBテーブル
 * @param pageId ページID（string型: "718373062"）
 * @returns ページデータまたはnull
 */
export async function fetchPageFromLanceDB(tbl: any, pageId: string): Promise<any | null> {
  try {
    if (!pageId || pageId === 'undefined') {
      console.error(`[fetchPageFromLanceDB] Invalid pageId: ${pageId}`);
      return null;
    }
    
    // バッククォートを使用してフィールド名を囲む（LanceDB SQL方言）
    // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
    const results = await tbl.query()
      .where(`\`page_id\` = '${pageId}'`)
      .limit(1)
      .toArray();
    
    if (results.length > 0) {
      // ★★★ MIGRATION: データベースのpage_idをpageIdに変換（API互換性） ★★★
      const mappedResult = mapLanceDBRecordToAPI(results[0]);
      console.log(`[fetchPageFromLanceDB] Found page ${pageId}: ${mappedResult.title}`);
      return mappedResult;
    }
    
    console.log(`[fetchPageFromLanceDB] Page ${pageId} not found in LanceDB`);
    return null;
  } catch (error) {
    console.error(`[fetchPageFromLanceDB] Error fetching page ${pageId}:`, error);
    return null;
  }
}

/**
 * ページIDで全チャンクを取得
 * @param tbl LanceDBテーブル
 * @param pageId ページID（string型: "718373062"）
 * @returns チャンク配列（chunkIndexでソート済み）
 */
export async function getAllChunksByPageId(tbl: any, pageId: string): Promise<any[]> {
  try {
    // ★★★ FIX: pageIdが "718373062-0" のような形式の場合、"-0"を削除して数値としてパース ★★★
    // APIレスポンスのidフィールドが `${pageId}-0` という形式になっているため
    let cleanedPageId = pageId;
    if (pageId.includes('-')) {
      // "718373062-0" のような形式の場合、最初の部分（数値部分）を抽出
      const parts = pageId.split('-');
      cleanedPageId = parts[0];
    }
    
    const numericPageId = Number(cleanedPageId);
    if (isNaN(numericPageId)) {
      console.error(`[getAllChunksByPageId] Invalid pageId (not a number): ${pageId} (cleaned: ${cleanedPageId})`);
      return [];
    }
    
    // スカラーインデックスを使用した数値型での完全一致検索
    // スカラーインデックス（B-Tree）が作成されていれば、O(log n)で高速
    // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
    const results = await tbl
      .query()
      .where(`\`page_id\` = ${numericPageId}`)
      .limit(1000)
      .toArray();
    
    if (results.length > 0) {
      // chunkIndexでソート
      results.sort((a: any, b: any) => {
        const aIndex = a.chunkIndex || 0;
        const bIndex = b.chunkIndex || 0;
        return aIndex - bIndex;
      });
      
      // ★★★ MIGRATION: データベースのpage_idをpageIdに変換（API互換性） ★★★
      // 内部処理ではpage_idを使用、APIレスポンスではpageIdを維持
      const mappedResults = mapLanceDBRecordsToAPI(results);
      
      // 本番環境でLanceDBから取得したデータにBOMが含まれている場合に備える
      // チャンクのコンテンツとタイトルにBOM除去を適用
      const cleanedResults = mappedResults.map((chunk: any) => ({
        ...chunk,
        content: removeBOM(chunk.content || ''),
        title: removeBOM(chunk.title || ''),
      }));
      
      return cleanedResults;
    }
    
    // 見つからない場合は空配列を返す
    return [];
  } catch (error) {
    console.error(`[getAllChunksByPageId] Error fetching chunks for pageId ${pageId}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}


