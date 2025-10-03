/**
 * 日本語分かち書きトークナイザー
 * kuromojiを使用して日本語テキストを分かち書きに変換
 */

import kuromoji from 'kuromoji';
import * as path from 'path';

// kuromojiの辞書パス
const DIC_PATH = path.resolve(process.cwd(), 'node_modules/kuromoji/dict');

// シングルトンでTokenizerを管理
let tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;
let tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null;

/**
 * kuromojiトークナイザーを事前初期化
 */
export async function preInitializeTokenizer(): Promise<void> {
  await getTokenizer();
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
 * @param text 元のテキスト
 * @returns スペースで区切られた単語の文字列 (例: "教室 管理 の 仕様")
 */
export async function tokenizeJapaneseText(text: string): Promise<string> {
  if (!text || typeof text !== 'string') {
    return '';
  }

  try {
    const tokenizer = await getTokenizer();
    const tokens = tokenizer.tokenize(text);
    
    // 全ての単語（名詞、動詞、助詞など）をそのままスペースで連結
    const tokenizedText = tokens.map(t => t.surface_form).join(' ');
    
    console.log(`[JapaneseTokenizer] Tokenized: "${text}" -> "${tokenizedText}"`);
    return tokenizedText;
  } catch (error) {
    console.error('[JapaneseTokenizer] Tokenization failed:', error);
    // エラー時は元のテキストをそのまま返す
    return text;
  }
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
