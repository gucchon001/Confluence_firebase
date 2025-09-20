export async function getRowsByPageId(tbl: any, pageId: number) {
  // Fallback strategy to emulate equality in environments where '=' may not hit
  const lower = pageId;
  const upper = pageId + 1;
  const where = `"pageId" >= ${lower} AND "pageId" < ${upper}`;
  return await (tbl as any).query().where(where).toArray();
}

export async function getRowsByPageIdViaUrl(tbl: any, pageId: number) {
  // Reliable fallback: url contains /pages/<pageId>
  const where = `url LIKE '%/pages/${pageId}%'`;
  return await (tbl as any).query().where(where).toArray();
}


