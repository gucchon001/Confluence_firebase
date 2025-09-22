/**
 * ラベル処理の共通ユーティリティ関数
 */

/**
 * ラベルを文字列配列に正規化する
 * LanceDBのUtf8Vector<Utf8>オブジェクトやその他の形式を統一された配列に変換
 */
export function getLabelsAsArray(labels: any): string[] {
  if (Array.isArray(labels)) {
    return labels.map(String).filter(label => label.trim().length > 0);
  }
  
  if (labels && typeof labels.toArray === 'function') {
    // lancedbのList型を考慮
    try {
      return labels.toArray().map(String).filter(label => label.trim().length > 0);
    } catch (error) {
      console.warn('[getLabelsAsArray] Failed to convert List toArray:', error);
      return [];
    }
  }
  
  if (labels && labels.constructor && labels.constructor.name === 'Utf8Vector') {
    // Utf8Vector<Utf8>オブジェクトを処理
    try {
      return Array.from(labels).map(String).filter(label => label.trim().length > 0);
    } catch (error) {
      console.warn('[getLabelsAsArray] Failed to convert Utf8Vector:', error);
      return [];
    }
  }
  
  if (typeof labels === 'string') {
    // JSON配列文字列を試行
    try {
      const parsed = JSON.parse(labels);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(label => label.trim().length > 0);
      }
    } catch (error) {
      // JSON解析に失敗した場合は通常の文字列処理
    }
    
    // '[label1,label2]' や 'label1' のような文字列形式を処理
    const cleaned = labels.replace(/[\[\]"']/g, '');
    return cleaned.split(',')
      .map(l => l.trim())
      .filter(l => l.length > 0);
  }
  
  return [];
}


/**
 * ラベル配列をフィルタリング
 */
export function filterLabels(labels: string[], excludeLabels: string[]): string[] {
  if (!excludeLabels || excludeLabels.length === 0) {
    return labels;
  }
  
  return labels.filter(label => 
    !excludeLabels.some(excludeLabel => 
      String(label).toLowerCase() === excludeLabel.toLowerCase()
    )
  );
}

/**
 * ラベル配列が包含ラベルを含むかチェック
 */
export function hasIncludedLabel(labels: string[], includeLabels: string[]): boolean {
  if (!labels || labels.length === 0 || !includeLabels || includeLabels.length === 0) {
    return false;
  }
  
  return labels.some(label => 
    includeLabels.some(includeLabel => 
      String(label).toLowerCase() === includeLabel.toLowerCase()
    )
  );
}
