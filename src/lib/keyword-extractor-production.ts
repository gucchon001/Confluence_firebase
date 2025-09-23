/*
 * 本番用キーワード抽出ライブラリ
 * デバッグログなし、ハードコーディングなし、ドメイン知識活用
 */

import { KeywordListsLoader } from './keyword-lists-loader';

type ExtractResult = {
  keywords: string[];
  highPriority: Set<string>;
  lowPriority: Set<string>;
};

const JA_TOKEN_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9_.-]+/u;

const STOPWORDS = new Set<string>([
  'こと','もの','ため','など','これ','それ','あれ','について','の','は','が','を','に','で','と','や','から','まで','より','へ','も','な','だ','です','ます','ください','教えて','件','ですか','とは'
]);

const GENERIC_FUNCTION_PATTERNS = [
  /一覧/, /閲覧/, /登録/, /編集/, /削除/, /コピー/, /複製/,
  /機能/, /管理/, /設定/, /詳細/, /仕様/, /情報/, /データ/,
  /制限/, /条件/, /方法/, /手順/, /問題/, /原因/, /エラー/
];

function uniquePreserveOrder(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const k = x.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

function extractBasicKeywords(query: string): string[] {
  const basicKeywords: string[] = [];
  const parts = query.split(/[の・・、は？]/g).filter(part => part.trim().length > 0);
  
  for (const part of parts) {
    const words = part.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9_.-]+/gu) || [];
    
    for (const word of words) {
      if (word.length >= 2 && word.length <= 4 && !STOPWORDS.has(word)) {
        basicKeywords.push(word);
      }
    }
  }
  
  return [...new Set(basicKeywords)];
}

function extractDomainKeywords(query: string): string[] {
  const keywordLoader = KeywordListsLoader.getInstance();
  
  // キーワードリストが読み込まれていない場合は初期化
  if (!keywordLoader.isLoaded()) {
    try {
      keywordLoader.loadKeywordLists();
    } catch (error) {
      console.warn('[keyword-extractor] キーワードリストの読み込みに失敗、フォールバックを使用');
      return extractDomainKeywordsFallback(query);
    }
  }
  
  // キーワードリストからキーワードを抽出
  const extractedKeywords = keywordLoader.extractKeywords(query);
  const domainKeywords = [...extractedKeywords.domainNames, ...extractedKeywords.functionNames];
  
  // フォールバック: 基本的なエンティティ抽出も追加
  const fallbackKeywords = extractDomainKeywordsFallback(query);
  
  // 重複除去して結合
  const allKeywords = [...domainKeywords, ...fallbackKeywords];
  return [...new Set(allKeywords)];
}

/**
 * フォールバック用のドメインキーワード抽出
 */
function extractDomainKeywordsFallback(query: string): string[] {
  const domainKeywords: string[] = [];
  const entityMatches = query.match(/[\p{Script=Han}]{2,4}/gu) || [];
  
  for (const match of entityMatches) {
    if (match.length >= 2 && match.length <= 4 && !STOPWORDS.has(match)) {
      domainKeywords.push(match);
    }
  }
  
  return domainKeywords;
}

function extractFunctionKeywords(query: string): string[] {
  const functionKeywords: string[] = [];
  
  for (const pattern of GENERIC_FUNCTION_PATTERNS) {
    const matches = query.match(pattern);
    if (matches) {
      for (const match of matches) {
        if (match.length >= 2 && match.length <= 6 && !STOPWORDS.has(match)) {
          functionKeywords.push(match);
        }
      }
    }
  }
  
  return functionKeywords;
}

function selectKeywordsByPriority(
  basicKeywords: string[],
  domainKeywords: string[],
  functionKeywords: string[],
  llmKeywords: string[]
): string[] {
  const selectedKeywords: string[] = [];
  const maxKeywords = 8;
  
  // 1. 基本キーワードを最優先で追加
  for (const kw of basicKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
    }
  }
  
  // 2. ドメインキーワードを追加
  for (const kw of domainKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
    }
  }
  
  // 3. 機能キーワードを追加
  for (const kw of functionKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
    }
  }
  
  // 4. LLM拡張キーワードで補完
  for (const kw of llmKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
    }
  }
  
  return selectedKeywords;
}

function validateKeywordQuality(keywords: string[]): {
  isValid: boolean;
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;
  
  // キーワード数のチェック（最低3個以上）
  if (keywords.length >= 3) score += 30;
  else issues.push('キーワード数が不足（3個以上必要）');
  
  // エンティティキーワードのチェック（2-4文字の名詞）
  const hasEntityKeywords = keywords.some(kw => 
    kw.length >= 2 && kw.length <= 4 && /[\p{Script=Han}]{2,4}/u.test(kw)
  );
  
  if (hasEntityKeywords) score += 30;
  else issues.push('エンティティキーワードが不足');
  
  // 機能キーワードのチェック
  const hasFunctionKeywords = keywords.some(kw => 
    GENERIC_FUNCTION_PATTERNS.some(pattern => pattern.test(kw))
  );
  
  if (hasFunctionKeywords) score += 30;
  else issues.push('機能キーワードが不足');
  
  // キーワードの多様性チェック（重複の少なさ）
  const uniqueKeywords = [...new Set(keywords)];
  const diversityScore = (uniqueKeywords.length / keywords.length) * 10;
  score += diversityScore;
  
  // 基本的な品質基準をクリア
  const isClear = keywords.length >= 3 && hasEntityKeywords && hasFunctionKeywords;
  
  return {
    isValid: isClear,
    score,
    issues
  };
}

async function expandWithLLM(baseQuery: string, baseKeywords: string[]): Promise<string[]> {
  try {
    if (process.env.USE_LLM_EXPANSION !== 'true') {
      return [];
    }
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return [];
    }

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI: any = new (GoogleGenerativeAI as any)(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = [
      'あなたは社内ドキュメント検索のためのキーワード抽出補助を行います。',
      '以下の質問文に対し、実際のシステム機能名に基づいた具体的なキーワードを最大10件、JSON配列で返してください。',
      '重要: 汎用的すぎるキーワード（予約、確保、割り当てなど）は避け、実際の機能名（一覧、登録、編集、削除、コピーなど）を優先してください。',
      '機能関連の場合: 一覧、登録、編集、削除、コピー、管理、詳細、仕様、処理、実行 など',
      '問題・制限関連の場合: 制限、条件、チェック、エラー、失敗、不具合、障害、異常 など',
      'データ関連の場合: データ、情報、詳細、仕様、管理、処理 など',
      '出力はJSON配列のみ。',
      `質問文: ${baseQuery}`
    ].join('\n');
    
    const resp: any = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const text = resp?.response?.text?.() || '';
    const jsonText = (text.match(/\[[\s\S]*\]/) || [])[0] || '[]';
    const arr = JSON.parse(jsonText);
    
    if (!Array.isArray(arr)) return [];
    
    const expanded = arr
      .map((x: any) => String(x || '').trim())
      .filter((x: string) => x && !STOPWORDS.has(x) && x.length >= 2);
    
    // 原語と重複を除去
    const baseSet = new Set(baseKeywords.map(k => k.toLowerCase()));
    const uniq = uniquePreserveOrder(expanded.filter(x => !baseSet.has(x.toLowerCase())));
    return uniq.slice(0, 8);
  } catch (e) {
    return [];
  }
}

/**
 * 本番用キーワード抽出関数
 */
export async function extractKeywordsHybrid(query: string): Promise<ExtractResult> {
  try {
    // 1. 基本キーワード抽出（最優先）
    const basicKeywords = extractBasicKeywords(query);
    
    // 2. ドメイン特化キーワード抽出（高優先度）
    const domainKeywords = extractDomainKeywords(query);
    
    // 3. 機能キーワード抽出（中優先度）
    const functionKeywords = extractFunctionKeywords(query);
    
    // 4. LLM拡張キーワード抽出（補完）
    let llmKeywords: string[] = [];
    if (process.env.USE_LLM_EXPANSION === 'true') {
      llmKeywords = await expandWithLLM(query, basicKeywords);
    }
    
    // 5. 優先度別キーワード選択
    const selectedKeywords = selectKeywordsByPriority(
      basicKeywords,
      domainKeywords,
      functionKeywords,
      llmKeywords
    );
    
    // 6. 品質チェック
    const qualityCheck = validateKeywordQuality(selectedKeywords);
    
    // 7. 最終的なキーワード数調整（8件に制限）
    const finalKeywords = selectedKeywords.slice(0, 8);
    
    // 8. 優先度セットの構成
    const highPriority = new Set<string>();
    const lowPriority = new Set<string>();
    
    // 基本キーワードとドメインキーワードを高優先度に
    [...basicKeywords, ...domainKeywords].forEach(kw => {
      if (finalKeywords.includes(kw)) {
        highPriority.add(kw.toLowerCase());
      }
    });
    
    // 機能キーワードとLLMキーワードを低優先度に
    [...functionKeywords, ...llmKeywords].forEach(kw => {
      if (finalKeywords.includes(kw) && !highPriority.has(kw.toLowerCase())) {
        lowPriority.add(kw.toLowerCase());
      }
    });
    
    return {
      keywords: finalKeywords,
      highPriority,
      lowPriority
    };
    
  } catch (error) {
    // エラー時はフォールバック
    const fallbackKeywords = extractBasicKeywords(query);
    return {
      keywords: fallbackKeywords,
      highPriority: new Set(fallbackKeywords.map(k => k.toLowerCase())),
      lowPriority: new Set()
    };
  }
}
