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
  'こと','もの','ため','など','これ','それ','あれ','について','の','は','が','を','に','で','と','や','から','まで','より','へ','も','な','だ','です','ます','ください','教えて','詳細','仕様','機能','情報','方法','件','ですか','とは'
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

async function expandWithLLM(baseQuery: string, baseKeywords: string[]): Promise<string[]> {
  try {
    // デフォルトでAPIキーがあれば有効化（明示的に false の場合のみ無効）
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (process.env.USE_LLM_EXPANSION === 'false' || !apiKey) return [];

    // 動的import（未インストールなら無視）
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI: any = new (GoogleGenerativeAI as any)(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = [
      'あなたは社内ドキュメント検索のためのキーワード抽出補助を行います。',
      '以下の質問文に対し、同義語・言い換え・機能名候補を最大8件、JSON配列で返してください。',
      '一般語・ストップワードは除外し、日本語/英語の双方を含めても構いません。',
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
  // 共通サニタイズ関数（末尾の助詞/記号を除去）
  const sanitize = (s: string): string => {
    return s
      .replace(/[\s\u3000]+$/g, '')
      // よく付く終端助詞・助詞句を除去
      .replace(/(の仕様は|の仕様|の設定箇所は|の設定|の詳細は|の詳細|の機能は|の機能|の手順は|の手順|について|とは|は)$/g, '')
      .replace(/(の)$/g, '')
      .replace(/[。、．\.\,;；:：]+$/g, '')
      .trim();
  };
  // 形態素解析優先（kuromoji）→tiny-segmenter→n-gram
  const baseKeywords = await extractWithKuromoji(stripped);

  // LLM補助は「抽出が弱い」「抽出数が少ない」などのときに限定（または環境有効時）
  let llmSynonyms: string[] = [];
  if (baseKeywords.length <= 2 || process.env.USE_LLM_EXPANSION === 'true') {
    llmSynonyms = await expandWithLLM(query, baseKeywords);
  }

  const highPriority = new Set(baseKeywords.map(k => k.toLowerCase()));
  const lowPriority = new Set(llmSynonyms.map(k => k.toLowerCase()));
  // 粗集合
  const rawKeywords = uniquePreserveOrder([...baseKeywords, ...llmSynonyms]);

  // 簡易正規化・圧縮
  const isKanaOnly = (s: string) => /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(s);
  const isMeaningfulLen = (s: string) => s.length >= 2 && s.length <= 16;
  const filtered = rawKeywords.filter(w => isMeaningfulLen(w) && !STOPWORDS.has(w));
  // 部分列は長い語に吸収（"ログイ" などは "ログイン" があれば除外）
  const byLength = [...filtered].sort((a, b) => b.length - a.length);
  const chosen: string[] = [];
  for (const w of byLength) {
    const lower = w.toLowerCase();
    if (chosen.some(x => x.toLowerCase().includes(lower))) continue; // 既により長い語に含まれる
    chosen.push(w);
  }
  // LLM語は弱めなので末尾側へ。原語（highPriorityに含まれるもの）を優先配置
  const hp = chosen.filter(w => highPriority.has(w.toLowerCase()));
  const lp = chosen.filter(w => !highPriority.has(w.toLowerCase()));
  const compact = uniquePreserveOrder([...hp, ...lp]).slice(0, 8);
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
  // コア語抽出（改良版）
  const core = (() => {
  // より積極的に修飾語を除去
    const q = sanitize(stripped)
      // 終端の一般語からは「管理」は除外しない（教室管理などを保持）
      .replace(/(の方法|の手順|の設定箇所|設定箇所|設定|詳細|方法|手順|プロセス|システム|機能|仕様)$/g, '')
      .trim();
  
  // 「仕様」を含むクエリの場合は、関連キーワードを追加
  if (stripped.includes('仕様')) {
    // 仕様に関連するキーワードを抽出
    const specKeywords: string[] = (stripped.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9]{2,}/gu) as string[]) || [];
    const relevantSpecKeywords = specKeywords.filter((kw: string) => 
      kw.includes('管理') || kw.includes('機能') || kw.includes('求人') || kw.includes('教室')
    );
    if (relevantSpecKeywords.length > 0) {
      // 関連キーワードをLLM同義語に追加
      llmSynonyms.push(...relevantSpecKeywords);
    }
  }
    
    // より長い語を優先的に抽出
    const words: string[] = (q.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9]{2,}/gu) as string[]) || [];
    // 名詞の複合語化（教室+管理 など）
    if (words.length >= 2) {
      const joinedPairs: string[] = [];
      for (let i = 0; i < words.length - 1; i++) {
        const pair = sanitize(words[i] + words[i + 1]);
        if (pair.length >= 2) joinedPairs.push(pair);
      }
      // クエリに含まれる既知の複合を優先
      const priority = joinedPairs.find(p => q.includes(p));
      if (priority) return priority;
    }
    if (words.length > 0) {
      // 長い語を優先
      const sortedWords = words.sort((a, b) => b.length - a.length);
      return sanitize(sortedWords[0]);
    }
    
    // LLM同義語にシンプルな候補があれば優先
    const simpleLLM = llmSynonyms.find(s => s.length <= 8 && !/\s/.test(s));
    return sanitize(simpleLLM || compact[0] || stripped);
  })();
  
  // キーワードをより厳選（コア語を最優先、重複除去）
  const finalKeywords = [core];
  for (const kw of compact) {
    if (kw !== core && !finalKeywords.some(k => k.includes(kw) || kw.includes(k))) {
      finalKeywords.push(sanitize(kw));
    }
    if (finalKeywords.length >= 3) break;
  }
  const keywords = uniquePreserveOrder(finalKeywords.map(sanitize).filter(k => k.length >= 2));

  // デバッグ
  try {
    console.log('[keyword-extractor] baseKeywords:', baseKeywords);
    console.log('[keyword-extractor] llmSynonyms:', llmSynonyms);
    console.log('[keyword-extractor] reduced:', keywords);
  } catch {}

  // 優先度セットもreducedに合わせて再構成
  const highReduced = new Set(keywords.filter(k => k.toLowerCase() === core.toLowerCase() || highPriority.has(k.toLowerCase())).map(k => k.toLowerCase()));
  const lowReduced = new Set(keywords.filter(k => !highReduced.has(k.toLowerCase())).map(k => k.toLowerCase()));
  return { keywords, highPriority: highReduced, lowPriority: lowReduced };
}


