export async function getRowsByPageId(tbl: any, pageId: number) {
  // Fallback strategy to emulate equality in environments where '=' may not hit
  // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
  const lower = pageId;
  const upper = pageId + 1;
  const where = `\`page_id\` >= ${lower} AND \`page_id\` < ${upper}`;
  const results = await (tbl as any).query().where(where).toArray();
  
  // ★★★ MIGRATION: データベースのpage_idをpageIdに変換（API互換性） ★★★
  const { mapLanceDBRecordsToAPI } = await import('./pageid-migration-helper');
  return mapLanceDBRecordsToAPI(results);
}

export async function getRowsByPageIdViaUrl(tbl: any, pageId: number) {
  // Reliable fallback: url contains /pages/<pageId>
  const where = `url LIKE '%/pages/${pageId}%'`;
  return await (tbl as any).query().where(where).toArray();
}


