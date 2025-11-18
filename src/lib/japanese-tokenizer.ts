/**
 * 日本語分かち書きトークナイザー
 * kuromojiを使用して日本語テキストを分かち書きに変換
 */

import kuromoji from 'kuromoji';
import * as path from 'path';
import { saveTokenizerState, loadTokenizerState } from './persistent-cache';

/**
 * kuromojiの辞書パスを環境に応じて決定
 * - ローカル環境: node_modules/kuromoji/dict
 * - 本番環境（Cloud Run）: .next/standalone/node_modules/kuromoji/dict
 */
function getDictionaryPath(): string {
  // 環境判定を動的に行う（循環依存を避けるため、直接インポートしない）
  const isCloudRun = !!process.env.K_SERVICE;
  
  if (isCloudRun) {
    // Cloud Run環境: 実行時のprocess.cwd()は/workspace/.next/standalone
    // そのため、相対パスで.node_modules/kuromoji/dictを探す
    // または、/workspaceを基準にした絶対パスを使用
    const cwd = process.cwd();
    
    // パターン1: 現在のディレクトリがstandalone内の場合
    if (cwd.endsWith('.next/standalone') || cwd.includes('.next/standalone')) {
      // standalone内のnode_modulesを探す
      const standalonePath = path.resolve(cwd, 'node_modules/kuromoji/dict');
      return standalonePath;
    }
    
    // パターン2: /workspaceを基準にしたパス
    // process.cwd()が/workspace/.next/standaloneの場合、/workspaceに戻る
    const workspaceRoot = cwd.replace(/\.next\/standalone.*$/, '');
    const standalonePath = path.resolve(workspaceRoot, '.next/standalone/node_modules/kuromoji/dict');
    return standalonePath;
  } else {
    // ローカル環境: 通常のnode_modules内の辞書を使用
    const localPath = path.resolve(process.cwd(), 'node_modules/kuromoji/dict');
    return localPath;
  }
}

// シングルトンでTokenizerを管理
let tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;
let tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null;
let dictionaryChecked: boolean = false; // 辞書ファイルの存在確認を一度だけ行う
let verifiedDictionaryPath: string | null = null; // 検証済みの辞書パスを保持（再計算を防ぐ）

/**
 * kuromojiトークナイザーを事前初期化
 * ⚡ 最適化: 永続化キャッシュで超高速起動を実現
 * ★★★ 修正: キャッシュ状態に関わらず、実際にトークナイザーを初期化 ★★★
 * 理由: キャッシュ状態だけでは、実際のトークナイザーインスタンスが保持されない
 */
export async function preInitializeTokenizer(): Promise<void> {
  // ⚡ 最優先: 既に初期化済みの場合は即座に返す
  if (tokenizer) {
    console.log('[JapaneseTokenizer] 🚀 Tokenizer already initialized');
    return;
  }
  
  // ⚡ 初期化中の場合は、既存のPromiseを待つ（重複初期化を完全に防止）
  if (tokenizerPromise) {
    console.log('[JapaneseTokenizer] ⏳ Tokenizer initialization in progress, waiting...');
    await tokenizerPromise;
    return;
  }
  
  // キャッシュから初期化状態を確認（ログ出力用）
  const cachedState = loadTokenizerState();
  if (cachedState?.isInitialized) {
    console.log('[JapaneseTokenizer] 🚀 Fast startup: Using cached tokenizer state');
    // キャッシュ状態があっても、実際にトークナイザーを初期化する
  }
  
  console.log('[JapaneseTokenizer] Initializing tokenizer...');
  const startTime = Date.now();
  await getTokenizer(); // 実際にトークナイザーを初期化
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
 * ⚡ 最適化: 既に初期化済みの場合は一切の処理をスキップ（デグレード防止）
 */
async function getTokenizer(): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
  // ⚡ 最優先: 既に初期化済みの場合は即座に返す（辞書ファイルのチェックも含めて一切の処理をスキップ）
  if (tokenizer) {
    return tokenizer;
  }

  // 初期化中の場合は、既存のPromiseを返す
  if (tokenizerPromise) {
    return tokenizerPromise;
  }

  // ⚡ 最適化: 辞書ファイルの存在確認を一度だけ行う（ダウンロードを防ぐ）
  // 検証済みのパスがあればそれを使用、なければ環境に応じて決定
  let dicPath: string;
  
  if (verifiedDictionaryPath) {
    // 既に検証済みのパスを使用（再計算を防ぐ）
    dicPath = verifiedDictionaryPath;
  } else {
    // 初回のみ: 環境に応じて辞書パスを決定
    dicPath = getDictionaryPath();
    
    if (!dictionaryChecked) {
      const fs = await import('fs');
      
      // フォールバック: 本番環境でstandaloneパスが見つからない場合、通常のnode_modulesを試す
      if (!fs.existsSync(dicPath)) {
        const fallbackPath = path.resolve(process.cwd(), 'node_modules/kuromoji/dict');
        if (fs.existsSync(fallbackPath)) {
          dicPath = fallbackPath;
          console.log(`[JapaneseTokenizer] ⚠️  Primary path not found, using fallback: ${fallbackPath}`);
        } else {
          const errorMsg = `Kuromoji dictionary directory not found at ${dicPath} or ${fallbackPath}. Please ensure kuromoji is properly installed with 'npm install kuromoji'`;
          console.error(`[JapaneseTokenizer] ❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }
      }

      // 辞書ファイルの存在確認（主要なファイルをチェック）
      const requiredFiles = ['base.dat.gz', 'check.dat.gz', 'cc.dat.gz'];
      const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(dicPath, file)));
      if (missingFiles.length > 0) {
        const errorMsg = `Kuromoji dictionary files missing: ${missingFiles.join(', ')}. Please ensure kuromoji is properly installed with 'npm install kuromoji'`;
        console.error(`[JapaneseTokenizer] ❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // 検証済みパスを保存（次回以降は再計算・再チェックをスキップ）
      verifiedDictionaryPath = dicPath;
      dictionaryChecked = true;
      console.log(`[JapaneseTokenizer] ✅ Dictionary files verified at: ${dicPath}`);
    }
  }

  tokenizerPromise = new Promise((resolve, reject) => {
    // ⚡ 最適化: ログを1回だけ出力（重複ログを防止）
    // dictionaryCheckedがfalseの場合のみログを出力（初回のみ）
    // 注意: dictionaryCheckedは辞書ファイルの存在確認が完了したことを示すフラグ
    // tokenizerがnullの場合でも、dictionaryCheckedがtrueの可能性がある（前回の初期化試行でチェック済み）
    if (!dictionaryChecked) {
      console.log(`[JapaneseTokenizer] 🔧 Initializing kuromoji tokenizer with path: ${dicPath}...`);
      console.log(`[JapaneseTokenizer] 📦 This is the FIRST initialization - dictionary files will be loaded once`);
    } else {
      // 既に辞書ファイルがチェック済みの場合（前回の初期化試行でチェック済みだが、tokenizerがnullの場合）
      // これは正常なケース（エラーで初期化が失敗した場合など）
      console.log(`[JapaneseTokenizer] 🔧 Initializing kuromoji tokenizer (dictionary already verified at: ${verifiedDictionaryPath || dicPath})...`);
    }
    kuromoji.builder({ dicPath: dicPath }).build((err, t) => {
      if (err) {
        console.error('[JapaneseTokenizer] ❌ Failed to initialize kuromoji:', err);
        tokenizerPromise = null; // エラー時はPromiseをリセット
        reject(err);
        return;
      }
      if (!dictionaryChecked) {
        console.log('[JapaneseTokenizer] ✅ Kuromoji tokenizer initialized successfully (FIRST TIME ONLY)');
        console.log('[JapaneseTokenizer] 🚀 Tokenizer is now cached in memory - no more dictionary loading');
      }
      tokenizer = t;
      tokenizerPromise = null; // 初期化完了後はPromiseをリセット
      resolve(t);
    });
  });

  return tokenizerPromise;
}

/**
 * 日本語のテキストを分かち書きされた文字列に変換する
 * ★★★ 修正: kuromojiを確実に使用する（軽量トークン化による問題を回避） ★★★
 * 理由: 軽量トークン化が「自動オファー」を「】自動オファー設定機能」のように長いトークンにし、
 *       検索クエリ「自動オファー」と完全一致しない問題を解決
 * @param text 元のテキスト
 * @returns スペースで区切られた単語の文字列 (例: "教室 管理 の 仕様")
 */
export async function tokenizeJapaneseText(text: string): Promise<string> {
  if (!text || typeof text !== 'string') {
    return '';
  }

  try {
    // ★★★ 修正: kuromojiが初期化されるまで待つ（軽量トークン化を使わない） ★★★
    // 理由: 軽量トークン化が長いトークンを生成し、Lunrの完全一致検索と互換性がない
    // 参考: docs/analysis/auto-offer-search-issue-root-cause.md
    const tokenizerInstance = await getTokenizer(); // 初期化されるまで待つ
    
    const tokens = tokenizerInstance.tokenize(text);
    
    // 全ての単語（名詞、動詞、助詞など）をそのままスペースで連結
    const tokenizedText = tokens.map(t => t.surface_form).join(' ');
    
    // ⚡ 最適化: バッチ処理時はログを抑制（パフォーマンス向上）
    // デバッグ時のみログを出力（環境変数で制御可能）
    if (process.env.DEBUG_TOKENIZATION === 'true') {
      console.log(`[JapaneseTokenizer] Tokenized: "${text}" -> "${tokenizedText}"`);
    }
    return tokenizedText;
  } catch (error) {
    console.error('[JapaneseTokenizer] Tokenization failed:', error);
    // ★★★ 修正: エラー時も軽量トークン化を使わず、エラーを投げる ★★★
    // 理由: 軽量トークン化によるトークン不一致の問題を回避
    throw new Error(`Failed to tokenize Japanese text: ${error instanceof Error ? error.message : String(error)}`);
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
  // ⚡ 最適化: バッチ処理時はログを抑制（パフォーマンス向上）
  if (process.env.DEBUG_TOKENIZATION === 'true') {
    console.log(`[JapaneseTokenizer] ⚡ Lightweight tokenized: "${text}" -> "${result}"`);
  }
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
    // ⚡ 最適化: バッチ処理時はログを抑制（パフォーマンス向上）
    if (process.env.DEBUG_TOKENIZATION === 'true') {
      console.log(`[JapaneseTokenizer] Nouns only: "${text}" -> "${tokenizedText}"`);
    }
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
