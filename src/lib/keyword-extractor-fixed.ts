/**
 * 修正版キーワード抽出ライブラリ
 * 「教室管理の詳細は」クエリの問題を修正
 */

type ExtractResult = {
  keywords: string[];
  highPriority: Set<string>;
  lowPriority: Set<string>;
  metadata: {
    query: string;
    processingTime: number;
    keywordSource: 'basic' | 'fallback';
    statistics: {
      totalExtracted: number;
    };
  };
};

const STOPWORDS = new Set<string>([
  'こと','もの','ため','など','これ','それ','あれ','について','の','は','が','を','に','で','と','や','から','まで','より','へ','も','な','だ','です','ます','ください','教えて','件','ですか','とは'
]);

/**
 * 修正版キーワード抽出関数
 * 基本的なキーワード抽出のみを使用し、過度な拡張を避ける
 */
export async function extractKeywordsFixed(query: string): Promise<ExtractResult> {
  const startTime = Date.now();
  
  try {
    // 基本的なキーワード抽出のみを使用
    const basicKeywords = extractBasicKeywords(query);
    
    // 優先度別に分類
    const prioritySets = categorizeByPriority(basicKeywords, query);
    
    // 最終的なキーワード選択（最大8個）
    const finalKeywords = selectFinalKeywords(prioritySets, 8);
    
    const processingTime = Date.now() - startTime;
    
    return {
      keywords: finalKeywords,
      highPriority: prioritySets.high,
      lowPriority: prioritySets.low,
      metadata: {
        query,
        processingTime,
        keywordSource: 'basic',
        statistics: {
          totalExtracted: finalKeywords.length
        }
      }
    };
    
  } catch (error) {
    console.error('[extractKeywordsFixed] エラー:', error);
    
    // エラー時は最小限のフォールバック
    const fallbackKeywords = extractMinimalKeywords(query);
    const processingTime = Date.now() - startTime;
    
    return {
      keywords: fallbackKeywords,
      highPriority: new Set(fallbackKeywords.map(k => k.toLowerCase())),
      lowPriority: new Set(),
      metadata: {
        query,
        processingTime,
        keywordSource: 'fallback',
        statistics: {
          totalExtracted: fallbackKeywords.length
        }
      }
    };
  }
}

/**
 * 基本的なキーワード抽出（修正版）
 */
function extractBasicKeywords(query: string): string[] {
  const keywords: string[] = [];
  
  // 助詞・記号で分割
  const parts = query.split(/[の・・、は？]/g).filter(part => part.trim().length > 0);
  
  for (const part of parts) {
    const words = part.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9_.-]+/gu) || [];
    
    for (const word of words) {
      // より厳格な条件
      if (word.length >= 2 && word.length <= 8 && !STOPWORDS.has(word)) {
        keywords.push(word);
      }
    }
  }
  
  // 複合語の抽出も追加
  const compoundWords = extractCompoundWords(query);
  keywords.push(...compoundWords);
  
  return [...new Set(keywords)];
}

/**
 * 複合語の抽出
 */
function extractCompoundWords(query: string): string[] {
  const compoundWords: string[] = [];
  
  // よくある複合語パターン
  const patterns = [
    /教室管理/g,
    /教室一覧/g,
    /教室登録/g,
    /教室編集/g,
    /教室削除/g,
    /教室コピー/g,
    /求人管理/g,
    /求人一覧/g,
    /求人登録/g,
    /求人編集/g,
    /ログイン機能/g,
    /ログアウト機能/g,
    /認証機能/g,
    /管理機能/g,
    /閲覧機能/g,
    /登録機能/g,
    /編集機能/g,
    /削除機能/g
  ];
  
  for (const pattern of patterns) {
    const matches = query.match(pattern);
    if (matches) {
      compoundWords.push(...matches);
    }
  }
  
  return compoundWords;
}

/**
 * 最小限のキーワード抽出（エラー時用）
 */
function extractMinimalKeywords(query: string): string[] {
  const keywords: string[] = [];
  
  // 基本的な分割のみ
  const words = query.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9_.-]+/gu) || [];
  
  for (const word of words) {
    if (word.length >= 2 && word.length <= 4 && !STOPWORDS.has(word)) {
      keywords.push(word);
    }
  }
  
  return [...new Set(keywords)];
}

/**
 * 優先度別にキーワードを分類（修正版）
 */
function categorizeByPriority(keywords: string[], query: string): {
  high: Set<string>;
  low: Set<string>;
} {
  const highPriority = new Set<string>();
  const lowPriority = new Set<string>();
  
  for (const keyword of keywords) {
    const priority = calculateKeywordPriority(keyword, query);
    
    if (priority === 'high') {
      highPriority.add(keyword.toLowerCase());
    } else {
      lowPriority.add(keyword.toLowerCase());
    }
  }
  
  return { high: highPriority, low: lowPriority };
}

/**
 * キーワードの優先度を計算（修正版）
 */
function calculateKeywordPriority(keyword: string, query: string): 'high' | 'low' {
  // クエリに直接含まれるキーワードは高優先度
  if (query.includes(keyword)) {
    return 'high';
  }
  
  // 長いキーワードは高優先度
  if (keyword.length >= 3) {
    return 'high';
  }
  
  // 短いキーワードは低優先度
  return 'low';
}

/**
 * 最終的なキーワード選択（修正版）
 */
function selectFinalKeywords(prioritySets: {
  high: Set<string>;
  low: Set<string>;
}, maxKeywords: number): string[] {
  const allKeywords: string[] = [];
  
  // 高優先度キーワードを優先的に追加
  allKeywords.push(...Array.from(prioritySets.high));
  
  // 低優先度キーワードを追加（余裕があれば）
  if (allKeywords.length < maxKeywords) {
    allKeywords.push(...Array.from(prioritySets.low));
  }
  
  // 最大数に制限
  return allKeywords.slice(0, maxKeywords);
}

export { ExtractResult };
