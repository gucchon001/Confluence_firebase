/**
 * Utilities for building robust pageId equality conditions for LanceDB SQL-like filters.
 * Some environments exhibit instability with direct equality on numeric columns.
 * We emulate equality by querying a half-open range: [pageId, pageId+1).
 */

/**
 * Build a WHERE fragment that matches exactly one pageId via half-open range.
 * Example: "\"pageId\" >= 512 AND \"pageId\" < 513"
 */
export function buildPageIdEqualityWhere(pageId: number): string {
  const lower = Number(pageId) | 0;
  const upper = lower + 1;
  return `"pageId" >= ${lower} AND "pageId" < ${upper}`;
}

/**
 * Build a WHERE fragment that matches any of the specified pageIds using OR of half-open ranges.
 * Example for [1,2]: ("pageId" >= 1 AND "pageId" < 2) OR ("pageId" >= 2 AND "pageId" < 3)
 */
export function buildPageIdsAnyWhere(pageIds: number[]): string {
  const parts = (pageIds || [])
    .map(pid => buildPageIdEqualityWhere(pid))
    .filter(Boolean);
  if (parts.length === 0) return '1=0';
  return parts.length === 1 ? parts[0] : `(${parts.join(') OR (')})`;
}


