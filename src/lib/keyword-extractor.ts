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
]);

function uniquePreserveOrder(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const k = x.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
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
  
  // 1. 長さの多様性を保つ（短いものから長いものまで）
  const sortedByLength = [...keywords].sort((a, b) => a.length - b.length);
  
  for (const kw of sortedByLength) {
    if (selected.length >= 8) break;
    
    const kwLower = kw.toLowerCase();
    
    // 既に類似のキーワードが選択されている場合はスキップ
    const isSimilar = selected.some(selectedKw => 
      selectedKw.toLowerCase().includes(kwLower) || 
      kwLower.includes(selectedKw.toLowerCase())
    );
    
    if (!isSimilar && !used.has(kwLower)) {
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
      '以下の質問文に対し、実際のシステム機能名に基づいた具体的なキーワードを最大8件、JSON配列で返してください。',
      '重要: 汎用的すぎるキーワード（予約、確保、割り当てなど）は避け、実際の機能名（一覧、登録、編集、削除、コピーなど）を優先してください。',
      '教室管理システムの場合: 教室一覧、教室登録、教室編集、教室削除、教室コピー、教室管理機能 など',
      '求人管理システムの場合: 求人一覧、求人登録、求人編集、求人削除、求人管理機能 など',
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

export async function extractKeywordsHybrid(query: string): Promise<ExtractResult> {
  const stripped = query.replace(/-\S+/g, ' ').trim();
  
  // 1. 形態素解析による基本キーワード抽出
  const baseKeywords = await extractWithKuromoji(stripped);
  
  // 2. 正規表現による補完抽出（形態素解析で漏れた語を補完）
  const regexKeywords = extractWithRegex(stripped);
  
  // 3. 基本キーワードと正規表現キーワードを統合
  const combinedKeywords = uniquePreserveOrder([...baseKeywords, ...regexKeywords]);
  
  // 4. LLM補助（環境有効時は常に実行）
  let llmSynonyms: string[] = [];
  if (process.env.USE_LLM_EXPANSION === 'true') {
    llmSynonyms = await expandWithLLM(query, combinedKeywords);
  }

  // 5. 粗集合（combinedKeywords + llmSynonyms）
  const rawKeywords = uniquePreserveOrder([...combinedKeywords, ...llmSynonyms]);
  console.log(`[keyword-extractor] rawKeywords:`, rawKeywords);

  const highPriority = new Set(baseKeywords.map(k => k.toLowerCase()));
  const lowPriority = new Set(llmSynonyms.map(k => k.toLowerCase()));

  // キーワード分割と補完（STOPWORDSチェック前）
  const splitKeywords: string[] = [];
  for (const w of rawKeywords) {
    console.log(`[keyword-extractor] Processing keyword: "${w}" (length: ${w.length})`);
    
    // 元のキーワードを追加
    splitKeywords.push(w);
    
    // 長いキーワードを分割
    if (w.length > 4) { // 閾値を4に下げる
      // 複数の分割パターンを適用
      const splitPatterns = [
        /[の・・、]/g,  // 助詞・記号での分割
        /(詳細|仕様|機能|管理|情報|一覧|閲覧|登録|編集|削除|コピー|設定|更新)/g,  // 機能語での分割
        /(教室|求人|企業|ユーザー|システム)/g  // エンティティ語での分割
      ];
      
      for (const pattern of splitPatterns) {
        const parts = w.split(pattern).filter(part => part.length >= 2);
        if (parts.length > 1) {
          console.log(`[keyword-extractor] Split "${w}" with pattern ${pattern} into:`, parts);
          splitKeywords.push(...parts);
        }
      }
    }
  }
  console.log(`[keyword-extractor] splitKeywords:`, splitKeywords);

  // 簡易正規化・圧縮
  const isKanaOnly = (s: string) => /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(s);
  const isMeaningfulLen = (s: string) => s.length >= 2 && s.length <= 16;
  const filtered = splitKeywords.filter(w => isMeaningfulLen(w) && !STOPWORDS.has(w));
  console.log('[keyword-extractor] filtered:', filtered);
  
  // 部分列は長い語に吸収（"ログイ" などは "ログイン" があれば除外）
  const byLength = [...filtered].sort((a, b) => b.length - a.length);
  const chosen: string[] = [];
  for (const w of byLength) {
    const lower = w.toLowerCase();
    if (chosen.some(x => x.toLowerCase().includes(lower))) continue; // 既により長い語に含まれる
    chosen.push(w);
  }
  console.log('[keyword-extractor] chosen:', chosen);
  
  // LLM語は弱めなので末尾側へ。原語（highPriorityに含まれるもの）を優先配置
  const hp = chosen.filter(w => highPriority.has(w.toLowerCase()));
  const lp = chosen.filter(w => !highPriority.has(w.toLowerCase()));
  const compact = uniquePreserveOrder([...hp, ...lp]).slice(0, 8);
  console.log('[keyword-extractor] compact:', compact);
  // 汎用クエリ正規化: 数値+期間表現や一般的な制約語を抽出し、漏れがあれば補完
  try {
    // 表記揺れの統合（汎用）
    const normalizedQ = stripped
      .replace(/送信できない|送信できません|送信不可/g, '送信不可')
      .replace(/退会済み|アカウント削除/g, '退会')
      .replace(/編集済み|修正/g, '編集');
    const timeTokens = (normalizedQ.match(/([0-9０-９]{1,4})\s*(日|日間|時間|週|週間|か月|ヶ月)/g) || []).map(s => s.replace(/\s+/g, ''));
    const constraintTokens = (normalizedQ.match(/(不可|できない|できません|禁止|制限|上限|下限|以内|以外|無効|退会|編集|送信不可|送信)/g) || []);
    const hpSet = new Set(hp.map(w => w.toLowerCase()));
    const lpSet = new Set(lp.map(w => w.toLowerCase()));
    for (const t of [...timeTokens, ...constraintTokens]) {
      const tl = t.toLowerCase();
      if (!hpSet.has(tl) && !lpSet.has(tl)) {
        compact.push(t);
      }
    }
  } catch {}
  // 具体的な機能名を優先するキーワード選択戦略
  const keywords = (() => {
    console.log('[keyword-extractor] Starting improved keyword selection');
    
    // 1. 基本フィルタリング（長さとストップワード）
    const basicFiltered = compact.filter(kw => 
      kw.length >= 2 && 
      kw.length <= 12 && 
      !STOPWORDS.has(kw)
    );
    console.log('[keyword-extractor] basicFiltered:', basicFiltered);
    
    // 2. 具体的な機能名を優先
    const functionKeywords = basicFiltered.filter(w => 
      /(一覧|閲覧|登録|編集|削除|コピー|管理|機能|詳細|仕様)/.test(w)
    );
    const entityKeywords = basicFiltered.filter(w => 
      /(教室|求人|企業|ユーザー|システム)/.test(w)
    );
    const otherKeywords = basicFiltered.filter(w => 
      !/(一覧|閲覧|登録|編集|削除|コピー|管理|機能|詳細|仕様|教室|求人|企業|ユーザー|システム)/.test(w)
    );
    
    console.log('[keyword-extractor] functionKeywords:', functionKeywords);
    console.log('[keyword-extractor] entityKeywords:', entityKeywords);
    console.log('[keyword-extractor] otherKeywords:', otherKeywords);
    
    // 3. 優先順位で選択（機能名 > エンティティ名 > その他）
    const prioritizedKeywords = [
      ...functionKeywords.slice(0, 4),
      ...entityKeywords.slice(0, 2),
      ...otherKeywords.slice(0, 2)
    ];
    console.log('[keyword-extractor] prioritizedKeywords:', prioritizedKeywords);
    
    // 4. 多様性を保つためのキーワード選択
    const diverseKeywords = selectDiverseKeywords(prioritizedKeywords);
    console.log('[keyword-extractor] diverseKeywords:', diverseKeywords);
    
    // 5. 最終的なキーワード数調整
    const finalKeywords = diverseKeywords.slice(0, 8);
    console.log('[keyword-extractor] finalKeywords:', finalKeywords);
    return finalKeywords;
  })();

  // デバッグ
  try {
    console.log('[keyword-extractor] baseKeywords:', baseKeywords);
    console.log('[keyword-extractor] llmSynonyms:', llmSynonyms);
    console.log('[keyword-extractor] reduced:', keywords);
  } catch {}

  // 優先度セットもkeywordsに合わせて再構成
  const highReduced = new Set(keywords.filter(k => highPriority.has(k.toLowerCase())).map(k => k.toLowerCase()));
  const lowReduced = new Set(keywords.filter(k => !highReduced.has(k.toLowerCase())).map(k => k.toLowerCase()));
  return { keywords, highPriority: highReduced, lowPriority: lowReduced };
}
