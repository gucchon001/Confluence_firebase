/**
 * pageId → page_id マイグレーション用ヘルパー関数
 * 
 * データベースフィールド名は`page_id`、APIレスポンスでは`pageId`を維持
 * これにより、フロントエンド側への影響を最小限に抑えます
 */

/**
 * データベースから取得したレコードをAPIレスポンス形式に変換
 * page_id → pageId に変換
 */
export function mapLanceDBRecordToAPI(record: any): any {
  if (!record) return record;
  
  // page_idが存在する場合は、pageIdに変換
  if (record.page_id !== undefined) {
    const { page_id, ...rest } = record;
    return {
      ...rest,
      pageId: page_id,  // page_idをpageIdに変換
      // page_idも残す（内部処理用）
      page_id: page_id
    };
  }
  
  // 既にpageIdがある場合はそのまま
  return record;
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
 */
export function getPageIdFromRecord(record: any): number | string | undefined {
  // page_idフィールドのみを使用（唯一の信頼できる情報源）
  if (record.page_id !== undefined) {
    return record.page_id;
  }
  // page_idが存在しない場合はundefinedを返す（フォールバックしない）
  return undefined;
}

