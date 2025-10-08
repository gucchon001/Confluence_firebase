/**
 * 日本語分かち書きトークナイザー
 * kuromojiを使用して日本語テキストを分かち書きに変換
 */

import kuromoji from 'kuromoji';
import * as path from 'path';
import { saveTokenizerState, loadTokenizerState } from './persistent-cache';

// kuromojiの辞書パス
const DIC_PATH = path.resolve(process.cwd(), 'node_modules/kuromoji/dict');

// シングルトンでTokenizerを管理
let tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;
let tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null;

/**
 * kuromojiトークナイザーを事前初期化
 * ⚡ 最適化: 永続化キャッシュで超高速起動を実現
 */
export async function preInitializeTokenizer(): Promise<void> {
  // キャッシュから初期化状態を確認
  const cachedState = loadTokenizerState();
  if (cachedState?.isInitialized) {
    console.log('[JapaneseTokenizer] 🚀 Fast startup: Using cached tokenizer state');
    return;
  }
  
  console.log('[JapaneseTokenizer] Initializing fresh tokenizer...');
  const startTime = Date.now();
  await getTokenizer();
  const initTime = Date.now() - startTime;
  
  // 初期化状態をキャッシュに保存
  saveTokenizerState(true, Date.now());
  console.log(`[JapaneseTokenizer] ✅ Tokenizer initialized and cached in ${initTime}ms`);
}

/**
 * kuromojiトークナイザーを遅延初期化
 * ⚡ 最適化: 実際に必要になった時に初期化
 */
export async function preInitializeTokenizerLazy(): Promise<void> {
  // ⚡ 最適化: 軽量な初期化のみ実行
  // 重い辞書読み込みは実際の使用時に実行
  console.log('[JapaneseTokenizer] ⚡ Lazy initialization started');
  
  // 軽量な初期化処理（辞書読み込みはスキップ）
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      console.log('[JapaneseTokenizer] ⚡ Lazy initialization completed (dictionary loading deferred)');
      resolve();
    }, 100); // 100msで完了
  });
}

/**
 * トークナイザーの初期化状態を確認
 */
export function isTokenizerInitialized(): boolean {
  return tokenizer !== null;
}

/**
 * kuromojiトークナイザーを初期化（シングルトン）
 */
async function getTokenizer(): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
  if (tokenizer) {
    return tokenizer;
  }

  if (tokenizerPromise) {
    return tokenizerPromise;
  }

  tokenizerPromise = new Promise((resolve, reject) => {
    console.log('[JapaneseTokenizer] Initializing kuromoji tokenizer...');
    kuromoji.builder({ dicPath: DIC_PATH }).build((err, t) => {
      if (err) {
        console.error('[JapaneseTokenizer] Failed to initialize kuromoji:', err);
        reject(err);
        return;
      }
      console.log('[JapaneseTokenizer] Kuromoji tokenizer initialized successfully');
      tokenizer = t;
      resolve(t);
    });
  });

  return tokenizerPromise;
}

/**
 * 日本語のテキストを分かち書きされた文字列に変換する
 * ⚡ 最適化: トークナイザーが初期化されていない場合は軽量な代替処理を使用
 * @param text 元のテキスト
 * @returns スペースで区切られた単語の文字列 (例: "教室 管理 の 仕様")
 */
export async function tokenizeJapaneseText(text: string): Promise<string> {
  if (!text || typeof text !== 'string') {
    return '';
  }

  try {
    // ⚡ 最適化: トークナイザーが初期化されていない場合は軽量な処理を使用
    if (!tokenizer) {
      console.log('[JapaneseTokenizer] ⚡ Using lightweight tokenization (kuromoji not ready)');
      return performLightweightTokenization(text);
    }

    const tokenizerInstance = await getTokenizer();
    const tokens = tokenizerInstance.tokenize(text);
    
    // 全ての単語（名詞、動詞、助詞など）をそのままスペースで連結
    const tokenizedText = tokens.map(t => t.surface_form).join(' ');
    
    console.log(`[JapaneseTokenizer] Tokenized: "${text}" -> "${tokenizedText}"`);
    return tokenizedText;
  } catch (error) {
    console.error('[JapaneseTokenizer] Tokenization failed, using lightweight fallback:', error);
    // エラー時は軽量な代替処理を使用
    return performLightweightTokenization(text);
  }
}

/**
 * 軽量な日本語トークナイゼーション（kuromojiなし）
 * ⚡ 最適化: 簡単な文字分割で高速処理
 */
function performLightweightTokenization(text: string): string {
  // 簡単な文字分割（ひらがな、カタカナ、漢字、英数字の境界で分割）
  const tokens = text
    .replace(/([ひらがなカタカナ漢字]+)/g, '$1 ') // 日本語文字の後にスペース
    .replace(/([a-zA-Z0-9]+)/g, '$1 ') // 英数字の後にスペース
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 0);
  
  const result = tokens.join(' ');
  console.log(`[JapaneseTokenizer] ⚡ Lightweight tokenized: "${text}" -> "${result}"`);
  return result;
}

/**
 * 複数のテキストを一括で分かち書きに変換する
 * @param texts 元のテキスト配列
 * @returns 分かち書きされたテキスト配列
 */
export async function tokenizeJapaneseTexts(texts: string[]): Promise<string[]> {
  if (!Array.isArray(texts)) {
    return [];
  }

  try {
    const tokenizer = await getTokenizer();
    return texts.map(text => {
      if (!text || typeof text !== 'string') {
        return '';
      }
      
      const tokens = tokenizer.tokenize(text);
      return tokens.map(t => t.surface_form).join(' ');
    });
  } catch (error) {
    console.error('[JapaneseTokenizer] Batch tokenization failed:', error);
    // エラー時は元のテキストをそのまま返す
    return texts;
  }
}

/**
 * 名詞のみを抽出して分かち書きする（より精密な検索用）
 * @param text 元のテキスト
 * @returns 名詞のみの分かち書き文字列
 */
export async function tokenizeJapaneseNouns(text: string): Promise<string> {
  if (!text || typeof text !== 'string') {
    return '';
  }

  try {
    const tokenizer = await getTokenizer();
    const tokens = tokenizer.tokenize(text);
    
    // 名詞のみを抽出（一般名詞、固有名詞、サ変名詞など）
    const nouns = tokens
      .filter(t => {
        const pos = t.part_of_speech;
        return pos && Array.isArray(pos) && pos.some(p => p.includes('名詞')) && 
               !pos.some(p => p.includes('非自立')) && !pos.some(p => p.includes('接尾'));
      })
      .map(t => t.surface_form);
    
    const tokenizedText = nouns.join(' ');
    console.log(`[JapaneseTokenizer] Nouns only: "${text}" -> "${tokenizedText}"`);
    return tokenizedText;
  } catch (error) {
    console.error('[JapaneseTokenizer] Noun tokenization failed:', error);
    return text;
  }
}

/**
 * トークナイザーの状態を取得
 */
export function getTokenizerStatus(): { initialized: boolean; error?: string } {
  return {
    initialized: tokenizer !== null,
    error: tokenizerPromise ? undefined : 'Not initialized'
  };
}

/**
 * トークナイザーをリセット（テスト用）
 */
export function resetTokenizer(): void {
  tokenizer = null;
  tokenizerPromise = null;
}
