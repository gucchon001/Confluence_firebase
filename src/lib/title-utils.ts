/**
 * タイトル関連のユーティリティ関数
 * 重複コードを削除して統一管理
 */

/**
 * タイトルが除外パターンにマッチするかチェック
 * @param title チェック対象のタイトル
 * @param excludePatterns 除外パターンの配列
 * @returns 除外対象の場合true
 */
export function isTitleExcluded(title: string, excludePatterns: string[]): boolean {
  if (!title || !excludePatterns || excludePatterns.length === 0) {
    return false;
  }
  
  return excludePatterns.some(pattern => {
    // パターンが末尾に*がある場合は前方一致
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return title.startsWith(prefix);
    }
    // パターンが先頭に*がある場合は後方一致
    else if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      return title.endsWith(suffix);
    }
    // パターンが*で囲まれている場合は部分一致
    else if (pattern.startsWith('*') && pattern.endsWith('*')) {
      const substring = pattern.slice(1, -1);
      return title.includes(substring);
    }
    // 完全一致
    else {
      return title === pattern;
    }
  });
}
