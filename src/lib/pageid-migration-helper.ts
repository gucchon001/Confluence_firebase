/**
 * pageId → page_id マイグレーション用ヘルパー関数
 * 
 * データベースフィールド名は`page_id`、APIレスポンスでは`pageId`を維持
 * これにより、フロントエンド側への影響を最小限に抑えます
 */

/**
 * データベースから取得したレコードをAPIレスポンス形式に変換
 * page_id → pageId に変換
 * spaceKey → space_key に変換（LanceDBスキーマはspaceKeyだが、APIではspace_keyを使用）
 */
export function mapLanceDBRecordToAPI(record: any): any {
  if (!record) return record;
  
  // 🔧 BOM文字（U+FEFF）を削除（データベースから読み込んだデータにBOM文字が含まれている可能性を考慮）
  const cleanTitle = (record.title || '').replace(/\uFEFF/g, '');
  const cleanContent = (record.content || '').replace(/\uFEFF/g, '');
  
  // page_idが存在する場合は、pageIdに変換
  // ★★★ 修正: BigInt対応を追加（page_id消失問題の根本原因を修正） ★★★
  if (record.page_id !== undefined && record.page_id !== null) {
    const { page_id, spaceKey, ...rest } = record;
    
    // BigInt, Number, Stringのいずれでも確実にNumberに変換
    let numericPageId: number;
    if (typeof page_id === 'bigint') {
      // BigIntをNumberに変換（安全な範囲内の場合）
      const num = Number(page_id);
      numericPageId = Number.isSafeInteger(num) ? num : Number(page_id.toString());
    } else if (typeof page_id === 'number') {
      numericPageId = Number.isFinite(page_id) ? page_id : 0;
    } else if (typeof page_id === 'string') {
      const parsed = Number(page_id);
      numericPageId = Number.isFinite(parsed) ? parsed : 0;
    } else {
      // その他の型の場合は文字列に変換してから数値化
      try {
        const parsed = Number(String(page_id));
        numericPageId = Number.isFinite(parsed) ? parsed : 0;
      } catch {
        numericPageId = 0;
      }
    }
    
    // 有効な数値の場合のみ設定（0は無効とみなす）
    const finalPageId = numericPageId > 0 ? numericPageId : undefined;
    
    return {
      ...rest,
      title: cleanTitle,
      content: cleanContent,
      pageId: finalPageId,  // page_idをpageIdに変換（Numberへ正規化）
      // page_idも残す（内部処理用、確実にNumber型に変換）
      page_id: finalPageId,
      // spaceKey → space_key に変換（LanceDBスキーマはspaceKeyだが、APIではspace_keyを使用）
      space_key: record.space_key ?? spaceKey ?? ''
    };
  }
  
  // 既にpageIdがある場合はそのまま（BOM除去処理は適用）
  // spaceKey → space_key に変換
  const { spaceKey, ...rest } = record;
  return {
    ...rest,
    title: cleanTitle,
    content: cleanContent,
    space_key: record.space_key ?? spaceKey ?? ''
  };
}

/**
 * 複数のレコードを一括変換
 */
export function mapLanceDBRecordsToAPI(records: any[]): any[] {
  return records.map(mapLanceDBRecordToAPI);
}

/**
 * APIリクエストからデータベース形式に変換
 * pageId → page_id に変換（データ投入時）
 */
export function mapAPIToDatabaseRecord(record: any): any {
  if (!record) return record;
  
  // pageIdが存在する場合は、page_idに変換
  if (record.pageId !== undefined) {
    const { pageId, ...rest } = record;
    return {
      ...rest,
      page_id: record.pageId  // pageIdをpage_idに変換
    };
  }
  
  // 既にpage_idがある場合はそのまま
  return record;
}

/**
 * データベースレコードからpage_idを取得
 * page_idフィールドのみを使用（フォールバックなし）
 * ★★★ 修正: BigInt対応とロバストな取得ロジック ★★★
 */
export function getPageIdFromRecord(record: any): number | string | undefined {
  if (!record) {
    return undefined;
  }
  
  // page_idフィールドを優先的に使用（複数のパターンを試す）
  const rawPageId = record.page_id ?? record['page_id'];
  
  if (rawPageId === undefined || rawPageId === null) {
    // page_idが存在しない場合はundefinedを返す（フォールバックしない）
    return undefined;
  }
  
  // BigInt, Number, Stringのいずれでも確実に処理
  if (typeof rawPageId === 'bigint') {
    // BigIntをNumberに変換（安全な範囲内の場合）
    const num = Number(rawPageId);
    if (Number.isSafeInteger(num)) {
      return num;
    }
    // 安全な範囲を超える場合は文字列に変換
    return rawPageId.toString();
  }
  
  if (typeof rawPageId === 'number') {
    // Number型の場合はそのまま返す
    return Number.isFinite(rawPageId) ? rawPageId : undefined;
  }
  
  if (typeof rawPageId === 'string') {
    // String型の場合は数値に変換を試みる
    const parsed = Number(rawPageId);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    // 数値に変換できない場合は文字列のまま返す
    return rawPageId;
  }
  
  // その他の型の場合は文字列に変換
  try {
    const str = String(rawPageId);
    const parsed = Number(str);
    return Number.isFinite(parsed) ? parsed : str;
  } catch {
    return undefined;
  }
}

