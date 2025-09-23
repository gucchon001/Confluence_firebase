/*
 * ハイブリッド・キーワード抽出
 * 1) 伝統的手法（tiny-segmenter による分かち書き or フォールバックのn-gram）
 * 2) LLM補助（環境が許せば同義語・関連語を補助）
 */

type ExtractResult = {
  keywords: string[];
  highPriority: Set<string>; // 原語（強め）
  lowPriority: Set<string>;  // LLM補助語（弱め）
};

const JA_TOKEN_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9_.-]+/u;
const STOPWORDS = new Set<string>([
  'こと','もの','ため','など','これ','それ','あれ','について','の','は','が','を','に','で','と','や','から','まで','より','へ','も','な','だ','です','ます','ください','教えて','件','ですか','とは'
  // 詳細、仕様、機能、情報、方法 は除外（教室管理では重要な語）
  // 原因、問題、制限、条件 は除外（問題解決では重要な語）
]);

// キーワード優先度定義
enum KeywordPriority {
  CRITICAL = 1,    // 基本キーワード（教室、管理、詳細）
  HIGH = 2,        // ドメインキーワード（教室管理）
  MEDIUM = 3,      // 機能キーワード（教室一覧、教室登録等）
  LOW = 4          // LLM拡張キーワード
}

// 教室管理関連ドメインパターン
const CLASSROOM_DOMAIN_PATTERNS = [
  /教室管理/,
  /教室管理機能/,
  /教室管理-求人管理機能/,
  /求人・教室管理機能/
];

// 教室管理機能名パターン
const CLASSROOM_FUNCTION_PATTERNS = [
  { pattern: /教室一覧/, keyword: '教室一覧' },
  { pattern: /教室登録/, keyword: '教室登録' },
  { pattern: /教室編集/, keyword: '教室編集' },
  { pattern: /教室削除/, keyword: '教室削除' },
  { pattern: /教室コピー/, keyword: '教室コピー' },
  { pattern: /教室新規登録/, keyword: '教室登録' },
  { pattern: /教室情報編集/, keyword: '教室編集' },
  { pattern: /教室掲載フラグ/, keyword: '教室掲載フラグ' },
  { pattern: /教室公開フラグ/, keyword: '教室公開フラグ' }
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

/**
 * 基本キーワード抽出（最優先）
 */
function extractBasicKeywords(query: string): string[] {
  console.log('[keyword-extractor] extractBasicKeywords called with:', query);
  
  // 元のクエリから基本キーワードを抽出
  const basicKeywords = query.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9_.-]+/u) || [];
  
  // 長さ制限（2-4文字）とストップワード除外
  const filteredKeywords = basicKeywords.filter(kw => 
    kw.length >= 2 && 
    kw.length <= 4 && 
    !STOPWORDS.has(kw)
  );
  
  console.log('[keyword-extractor] extractBasicKeywords result:', filteredKeywords);
  return filteredKeywords;
}

/**
 * ドメイン特化キーワード抽出（高優先度）
 */
function extractDomainKeywords(query: string): string[] {
  console.log('[keyword-extractor] extractDomainKeywords called with:', query);
  
  const domainKeywords: string[] = [];
  
  // 教室管理ドメインパターンマッチング
  if (/教室管理/.test(query)) {
    domainKeywords.push('教室管理');
  }
  
  // エンティティキーワード抽出
  if (/教室/.test(query)) {
    domainKeywords.push('教室');
  }
  
  console.log('[keyword-extractor] extractDomainKeywords result:', domainKeywords);
  return domainKeywords;
}

/**
 * 機能キーワード抽出（中優先度）
 */
function extractFunctionKeywords(query: string): string[] {
  console.log('[keyword-extractor] extractFunctionKeywords called with:', query);
  
  const functionKeywords: string[] = [];
  
  // 仕様書で定義された機能名パターン
  for (const { pattern, keyword } of CLASSROOM_FUNCTION_PATTERNS) {
    if (pattern.test(query)) {
      functionKeywords.push(keyword);
    }
  }
  
  // 詳細関連キーワード
  if (/詳細/.test(query)) {
    functionKeywords.push('教室管理の詳細');
  }
  
  console.log('[keyword-extractor] extractFunctionKeywords result:', functionKeywords);
  return functionKeywords;
}

/**
 * キーワード長さ制御
 */
function validateKeywordLength(keyword: string): boolean {
  return keyword.length >= 2 && keyword.length <= 8;
}

/**
 * 重複除去
 */
function removeDuplicates(keywords: string[]): string[] {
  const seen = new Set<string>();
  return keywords.filter(kw => {
    const normalized = kw.toLowerCase();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

/**
 * 優先度別キーワード選択
 */
function selectKeywordsByPriority(
  basicKeywords: string[],
  domainKeywords: string[],
  functionKeywords: string[],
  llmKeywords: string[]
): string[] {
  console.log('[keyword-extractor] selectKeywordsByPriority called');
  console.log('  basicKeywords:', basicKeywords);
  console.log('  domainKeywords:', domainKeywords);
  console.log('  functionKeywords:', functionKeywords);
  console.log('  llmKeywords:', llmKeywords);
  
  const selectedKeywords: string[] = [];
  const maxKeywords = 8;
  
  // 1. 基本キーワードを最優先で追加
  for (const kw of basicKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
      console.log('[keyword-extractor] Added basic keyword:', kw);
    }
  }
  
  // 2. ドメインキーワードを追加
  for (const kw of domainKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
      console.log('[keyword-extractor] Added domain keyword:', kw);
    }
  }
  
  // 3. 機能キーワードを追加
  for (const kw of functionKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
      console.log('[keyword-extractor] Added function keyword:', kw);
    }
  }
  
  // 4. LLM拡張キーワードで補完
  for (const kw of llmKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
      console.log('[keyword-extractor] Added LLM keyword:', kw);
    }
  }
  
  console.log('[keyword-extractor] selectKeywordsByPriority result:', selectedKeywords);
  return selectedKeywords;
}

/**
 * 品質チェック
 */
function validateKeywordQuality(keywords: string[]): {
  isValid: boolean;
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;
  
  // 基本キーワードチェック
  const hasClassroom = keywords.some(kw => kw.includes('教室'));
  const hasManagement = keywords.some(kw => kw.includes('管理'));
  const hasDetail = keywords.some(kw => kw.includes('詳細'));
  
  if (hasClassroom) score += 25;
  else issues.push('教室キーワードが不足');
  
  if (hasManagement) score += 25;
  else issues.push('管理キーワードが不足');
  
  if (hasDetail) score += 25;
  else issues.push('詳細キーワードが不足');
  
  // 機能キーワードチェック
  const functionKeywords = ['教室一覧', '教室登録', '教室編集', '教室削除', '教室コピー'];
  const foundFunctions = functionKeywords.filter(fk => 
    keywords.some(kw => kw.includes(fk))
  );
  
  score += (foundFunctions.length / functionKeywords.length) * 25;
  
  if (foundFunctions.length < 3) {
    issues.push('機能キーワードが不足');
  }
  
  return {
    isValid: issues.length === 0,
    score,
    issues
  };
}

function simpleNGrams(text: string, minLen = 2, maxLen = 3): string[] {
  const normalized = text.normalize('NFKC');
  const tokens = normalized.match(new RegExp(JA_TOKEN_RE, 'gu')) || [];
  const ngrams: string[] = [];
  for (const t of tokens) {
    if (!t) continue;
    if (t.length >= minLen) ngrams.push(t);
    const arr = Array.from(t);
    for (let n = Math.min(maxLen, arr.length); n >= minLen; n--) {
      for (let i = 0; i + n <= arr.length; i++) {
        const sub = arr.slice(i, i + n).join('');
        ngrams.push(sub);
      }
    }
  }
  const filtered = ngrams.filter(w => !STOPWORDS.has(w) && w.length >= minLen);
  const uniq = uniquePreserveOrder(filtered);
  uniq.sort((a, b) => b.length - a.length);
  return uniq.slice(0, 12);
}

async function extractWithTinySegmenter(text: string): Promise<string[]> {
  try {
    // 動的import（未インストール時は失敗してフォールバック）
    // @ts-ignore - tiny-segmenter may not be installed
    const mod: any = await import('tiny-segmenter').catch(() => null);
    if (!mod) {
      return simpleNGrams(text);
    }
    const Segmenter = mod.default || mod;
    const seg = new Segmenter();
    const words: string[] = seg.segment(text.normalize('NFKC')) || [];
    const filtered = words
      .map(w => w.trim())
      .filter(w => w && JA_TOKEN_RE.test(w) && !STOPWORDS.has(w) && w.length >= 2);
    const uniq = uniquePreserveOrder(filtered);
    uniq.sort((a, b) => b.length - a.length);
    return uniq.slice(0, 12);
  } catch {
    return simpleNGrams(text);
  }
}

async function extractWithKuromoji(text: string): Promise<string[]> {
  try {
    const kuromoji: any = await import('kuromoji');
    const builder = kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' });
    const tokenizer = await new Promise<any>((resolve, reject) => {
      builder.build((err: any, tk: any) => (err ? reject(err) : resolve(tk)));
    });
    const tokens = tokenizer.tokenize(text.normalize('NFKC')) as Array<{ surface_form: string; pos: string; pos_detail_1: string; basic_form: string }>;
    const nouns = tokens
      .filter(t => t.pos === '名詞' && !STOPWORDS.has(t.surface_form) && (t.surface_form || '').length >= 2)
      .map(t => t.surface_form);
    const uniq = uniquePreserveOrder(nouns);
    // 長い語優先で上位を返す
    uniq.sort((a, b) => b.length - a.length);
    return uniq.slice(0, 8);
  } catch {
    return extractWithTinySegmenter(text);
  }
}

function extractWithRegex(text: string): string[] {
  // 日本語の単語を抽出（2文字以上）
  const japaneseWords = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}/gu) || [];
  
  // 英語の単語を抽出（2文字以上）
  const englishWords = text.match(/[A-Za-z]{2,}/gu) || [];
  
  // 数字を含む語を抽出
  const numberWords = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9]{2,}/gu) || [];
  
  // すべての語を統合
  const allWords = [...japaneseWords, ...englishWords, ...numberWords];
  
  // ストップワードを除外し、重複を除去
  const filtered = allWords.filter(w => !STOPWORDS.has(w) && w.length >= 2);
  const unique = uniquePreserveOrder(filtered);
  
  // 長い語を優先
  unique.sort((a, b) => b.length - a.length);
  
  return unique.slice(0, 10); // 最大10個まで
}

// 汎用的なキーワード優先度選択関数
function selectKeywordsByPriority(keywords: string[], query: string): string[] {
  const selected: string[] = [];
  const queryLower = query.toLowerCase();
  
  // 1. クエリに直接含まれるキーワード（最高優先度）
  const directMatches = keywords.filter(kw => 
    queryLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(queryLower)
  );
  selected.push(...directMatches);
  
  // 2. 短いキーワードを優先（2-4文字の重要キーワード）
  const shortKeywords = keywords.filter(kw => 
    kw.length >= 2 && 
    kw.length <= 4 && 
    !selected.includes(kw) &&
    // 重要な短いキーワードパターン
    (/^[\p{Script=Han}]{2,4}$/u.test(kw) || // 2-4文字の漢字
     /^[\p{Script=Han}]{2,}[\p{Script=Hiragana}]{1,2}$/u.test(kw) || // 漢字+ひらがな
     /^[\p{Script=Han}]{2,}[\p{Script=Katakana}]{1,2}$/u.test(kw)) // 漢字+カタカナ
  );
  selected.push(...shortKeywords);
  
  // 3. エンティティキーワード（高優先度）
  const entityPatterns = [
    /^[A-Za-z0-9]+$/,  // 英語・数字の単語
    /[\p{Script=Han}]{2,6}$/u,  // 2-6文字の漢字
    /[\p{Script=Han}]{2,}[\p{Script=Hiragana}]{1,3}$/u,  // 漢字+ひらがな
    /[\p{Script=Han}]{2,}[\p{Script=Katakana}]{1,3}$/u   // 漢字+カタカナ
  ];
  
  const entityKeywords = keywords.filter(kw => 
    entityPatterns.some(pattern => pattern.test(kw)) && 
    !selected.includes(kw)
  );
  selected.push(...entityKeywords);
  
  // 4. 機能・動作キーワード（中優先度）
  const functionPatterns = [
    /機能$/, /管理$/, /システム$/, /情報$/, /一覧$/, /閲覧$/, /登録$/, /編集$/, /削除$/, /設定$/,
    /詳細$/, /仕様$/, /要件$/, /手順$/, /方法$/, /プロセス$/, /フロー$/, /ワーク$/
  ];
  
  const functionKeywords = keywords.filter(kw => 
    functionPatterns.some(pattern => pattern.test(kw)) && 
    !selected.includes(kw)
  );
  selected.push(...functionKeywords);
  
  // 5. 修飾語・形容詞（低優先度）
  const modifierKeywords = keywords.filter(kw => 
    kw.length >= 3 && 
    kw.length <= 8 && 
    !selected.includes(kw) &&
    !functionPatterns.some(pattern => pattern.test(kw))
  );
  selected.push(...modifierKeywords);
  
  return uniquePreserveOrder(selected);
}

// 多様性を保つキーワード選択関数
function selectDiverseKeywords(keywords: string[]): string[] {
  const selected: string[] = [];
  const used = new Set<string>();
  
  // 1. 優先順位付け（長いキーワードを優先）
  const sortedByPriority = [...keywords].sort((a, b) => {
    // 長いキーワードを優先（より具体的）
    if (a.length !== b.length) return b.length - a.length;
    // 同じ長さの場合はアルファベット順
    return a.localeCompare(b);
  });
  
  for (const kw of sortedByPriority) {
    if (selected.length >= 8) break;
    
    const kwLower = kw.toLowerCase();
    
    // 重複チェックを緩和（完全一致のみ）
    const isDuplicate = selected.some(selectedKw => 
      selectedKw.toLowerCase() === kwLower
    );
    
    if (!isDuplicate && !used.has(kwLower)) {
      selected.push(kw);
      used.add(kwLower);
    }
  }
  
  // 2. 不足分を長いキーワードで補完
  if (selected.length < 5) {
    const remaining = keywords.filter(kw => !used.has(kw.toLowerCase()));
    const longKeywords = remaining
      .filter(kw => kw.length >= 4)
      .sort((a, b) => b.length - a.length);
    
    for (const kw of longKeywords) {
      if (selected.length >= 8) break;
      selected.push(kw);
      used.add(kw.toLowerCase());
    }
  }
  
  return selected;
}

async function expandWithLLM(baseQuery: string, baseKeywords: string[]): Promise<string[]> {
  try {
    console.log('[keyword-extractor] expandWithLLM called with:', { baseQuery, baseKeywords, USE_LLM_EXPANSION: process.env.USE_LLM_EXPANSION });
    if (process.env.USE_LLM_EXPANSION !== 'true') {
      console.log('[keyword-extractor] LLM expansion disabled');
      return [];
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.log('[keyword-extractor] No API key found');
      return [];
    }

    // 動的import（未インストールなら無視）
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
    console.warn('[keyword-extractor] LLM expansion skipped:', (e as Error).message);
    return [];
  }
}

/**
 * 新しい階層的キーワード抽出関数
 */
export async function extractKeywordsHybrid(query: string): Promise<ExtractResult> {
  console.log('[keyword-extractor] extractKeywordsHybrid called with:', query);
  
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
    console.log('[keyword-extractor] Quality check:', qualityCheck);
    
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
    
    console.log('[keyword-extractor] Final result:', {
      keywords: finalKeywords,
      highPriority: Array.from(highPriority),
      lowPriority: Array.from(lowPriority),
      qualityScore: qualityCheck.score
    });
    
    return {
      keywords: finalKeywords,
      highPriority,
      lowPriority
    };
    
  } catch (error) {
    console.error('[keyword-extractor] Error in extractKeywordsHybrid:', error);
    
    // エラー時はフォールバック
    const fallbackKeywords = extractBasicKeywords(query);
    return {
      keywords: fallbackKeywords,
      highPriority: new Set(fallbackKeywords.map(k => k.toLowerCase())),
      lowPriority: new Set()
    };
  }
}
