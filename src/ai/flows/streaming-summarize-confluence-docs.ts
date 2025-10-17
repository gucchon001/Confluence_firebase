/**
 * Confluence文書要約（ストリーミング版）
 * Phase 5 Week 2: TTFB最適化 + 回答キャッシュ統合
 * リアルタイムで回答を生成・配信
 */

import * as z from 'zod';
import Handlebars from 'handlebars';
import { ai } from '../genkit';
import { GeminiConfig } from '@/config/ai-models-config';
import { getAnswerCache } from '@/lib/answer-cache';

// フォールバック回答生成関数
function generateFallbackAnswer(question: string, context: any[]): string {
  console.log('🔄 フォールバック回答生成開始');
  
  // 関連文書から主要な情報を抽出
  const relevantDocs = context.slice(0, 3); // 上位3件の文書を使用
  const titles = relevantDocs.map(doc => doc.title || 'タイトル不明').filter(Boolean);
  
  let answer = `申し訳ございませんが、現在AIサービスが一時的に利用できない状態です。\n\n`;
  answer += `ご質問「${question}」に関連する情報を以下にまとめました：\n\n`;
  
  if (titles.length > 0) {
    answer += `**関連するドキュメント：**\n`;
    titles.forEach((title, index) => {
      answer += `${index + 1}. ${title}\n`;
    });
    answer += `\n`;
  }
  
  // 質問の種類に応じた基本的な回答
  if (question.includes('ログイン') || question.includes('認証')) {
    answer += `**ログイン機能について：**\n`;
    answer += `- 会員ログイン機能\n`;
    answer += `- クライアント企業ログイン機能\n`;
    answer += `- 全体管理者ログイン機能\n`;
    answer += `- パスワード再設定機能\n\n`;
  } else if (question.includes('仕様') || question.includes('要件')) {
    answer += `**仕様・要件について：**\n`;
    answer += `関連するドキュメントを確認して詳細な仕様をご確認ください。\n\n`;
  } else {
    answer += `**一般的な回答：**\n`;
    answer += `関連するドキュメントを確認して詳細な情報をご確認ください。\n\n`;
  }
  
  answer += `AIサービスが復旧次第、より詳細な回答を提供いたします。`;
  
  return answer;
}

// ストリーミング応答のスキーマ
const StreamingResponseSchema = z.object({
  answer: z.string(),
  references: z.array(z.object({
    id: z.string(),
    title: z.string(),
    url: z.string().optional(),
    score: z.number().optional(),
  })),
  isComplete: z.boolean(),
  chunkIndex: z.number(),
  totalChunks: z.number().optional(),
});

// プロンプトテンプレート（元の仕様を維持しつつストリーミング対応）
const STREAMING_PROMPT_TEMPLATE = `
あなたはConfluence仕様書の質問に答えるAIアシスタントです。

## ルール
1. 提供された参考情報のみを根拠として回答
2. 関連情報がない場合は「詳細な情報は見つかりませんでした」と回答
3. 参照元セクションは生成しない
4. 機能質問には具体的な手順・設定項目を含める
5. マークダウン形式で見出し・箇条書きを使用
6. **重要**: ドキュメントタイトル（【FIX】や【NEW】などのプレフィックス付き）を言及する際は、自然な形で言い換えてください
   - 悪い例: 「以下の【FIX】会員:アカウント情報 が利用されます」
   - 良い例: 「会員のアカウント情報（メールアドレス、パスワードなど）が利用されます」
   - 必要な場合のみ、カッコ内に元のタイトルを記載: 「会員のアカウント情報（【FIX】会員:アカウント情報）が利用されます」

## 項目リスト質問の場合
「項目は」「一覧」「リスト」などのキーワードを含む質問には箇条書きリスト形式で回答：

**重要**: 項目リストは以下のルールを厳守してください：
1. 各項目は**箇条書き（-）**で記載する
2. 項目名を**太字**にする
3. コロン（:）の後に説明を記載
4. 必要に応じて、インデントでサブ項目を追加

正しい例:

- **項目1**: 説明1（備考1）
- **項目2**: 説明2（備考2）
  - サブ項目: 詳細説明

## 参考情報
{{context}}

## 質問
{{question}}

## 回答形式（必須）
質問の内容に応じて柔軟に回答してください：

1. **概要**: 質問に対する簡潔な概要から開始
2. **詳細**: 質問に応じたマークダウン形式で具体的な情報を整理
3. **完全性**: 途中で切らず、全ての関連情報を含める

**重要**: 上記の例は参考であり、質問の内容に応じて適切な構造で回答してください。

## マークダウン形式の完全な例

**正しい例**:
\`\`\`markdown
## 🔑 ログイン認証の仕様概要

本システムにおけるログイン認証は、メールアドレスとパスワードを用いて行われます。

## 👥 詳細

### 1. ログイン認証に利用される情報

ログイン認証には、以下の情報が利用されます：

- **メールアドレス**: ユーザーのログインIDとして機能
- **パスワード**: ユーザーの認証情報として機能

### 2. アカウントロック機能

ログイン失敗が続いた場合の対策機能です。

#### ロック対象

- クライアント企業管理者
- 全体管理者

#### ロック解除条件

以下のいずれかの方法でロックが解除されます：

1. 時間経過による自動解除: 30分間待つと自動的にロック解除
2. パスワード再設定による即時解除: パスワードを再設定すると即座にロック解除
\`\`\`

**上記の例のポイント**:
- セクション見出しには ### を使用（1. だけではダメ）
- 本文内の手順には番号付きリスト 1. 2. を使用
- サブ項目には箇条書き - を使用
- 見出しの後には必ず空行を入れる

## マークダウン形式の厳格な要件
**最重要ルール**: 

1. **メインタイトル**: ## 🔑 機能名の仕様概要 で開始
2. **セクション見出し**: ## 👥 詳細 で各セクションを区切る
3. **サブセクション見出し**: 必ず ### を使用
   - 良い例: ### 1. ログイン認証に利用される情報
   - 悪い例: 1.ログイン認証に利用される情報 （### がない）
4. **サブサブセクション見出し**: 必ず #### を使用
   - 良い例: #### ロック解除条件
   - 悪い例: ロック解除条件: （#### がない）
5. **見出しの後**: 必ず空行を1行入れる
6. **本文内の手順**: 番号付きリスト（1. 2. 3.）を使用

**絶対に守るべき見出しのルール**:
- セクションタイトル（例：「〜に利用される情報」「〜機能」）は必ず ### で開始してください
- サブセクション（例：「成功時」「失敗時」「条件」）は必ず #### で開始してください  
- 見出し記号（### や ####）がない場合、それは見出しではなく本文になってしまいます

## 番号付きリストの厳格なルール
**絶対に守るべきルール**:

1. **各項目は必ず新しい行から開始**してください
2. **ピリオドの後に半角スペースを1つ**入れてください
3. **サブ項目は3スペースのインデント + ハイフン**で記述してください
4. **リストの前には空行**を入れてください

**悪い例（絶対に避けること）**:
...機能です。1.項目A 2.項目B
応募者への連絡方法:「電話」

**良い例（必ずこの形式で）**:
...機能です。

1. 項目A
   - サブ項目A1: 説明
   - サブ項目A2: 説明

2. 項目B
   - サブ項目B1: 説明
   - サブ項目B2: 説明

## テーブル形式の厳格なルール
**絶対に守るべきルール**:

1. **各セルはパイプ（|）で区切る**
2. **ヘッダー行の次の行に区切り線を入れる**: | :--- | :--- |
3. **各行は必ずパイプで開始・終了する**
4. **タブ文字は使用しない**（必ずパイプを使用）
5. **テーブルの前後には空行を入れる**

**悪い例（絶対に避けること）**:
| 項目名 | 説明 | 備考 |
:---	:---
求人番号	指定した番号

**良い例（必ずこの形式で）**:

| 項目名 | 説明 | 備考 |
| :--- | :--- | :--- |
| 求人番号 | 指定した番号の求人基本情報 | 必須 |
| 連絡方法 | 応募者への連絡方法 | 選択式 |

マークダウン形式で回答してください：
`;

// ストリーミング要約フロー
export async function* streamingSummarizeConfluenceDocs(
  params: {
    question: string;
    context: any[];
    chatHistory: any[];
  }
): AsyncGenerator<{
  chunk: string;
  isComplete: boolean;
  chunkIndex: number;
  totalChunks?: number;
  references: any[];
}, void, unknown> {
  
  const { question, context, chatHistory } = params;
  
  console.log('🌊 ストリーミング要約開始:', question);
  
  // Phase 5 Week 2: 回答キャッシュチェック（品質影響なし）
  const answerCache = getAnswerCache();
  const cachedAnswer = answerCache.get(question, context);
  
  if (cachedAnswer) {
    console.log('[Phase 5 Streaming Cache] ⚡ キャッシュヒット - 即座に配信');
    
    // キャッシュされた回答を高速にストリーム配信
    const chunks = splitIntoChunks(cachedAnswer.answer, 100);
    
    for (let i = 0; i < chunks.length; i++) {
      yield {
        chunk: chunks[i],
        isComplete: false,
        chunkIndex: i,
        references: cachedAnswer.references
      };
      // Phase 5最適化: チャンク間の遅延を削除（人為的な遅延は不要）
    }
    
    // 完了チャンク
    yield {
      chunk: '',
      isComplete: true,
      chunkIndex: chunks.length,
      totalChunks: chunks.length,
      references: cachedAnswer.references
    };
    
    console.log(`✅ [Phase 5 Streaming Cache] キャッシュから配信完了: ${chunks.length}チャンク`);
    return;
  }
  
  console.log('[Phase 5 Streaming Cache] キャッシュミス - Gemini生成開始');
  
  try {
    // コンテキストの準備（パフォーマンス最適化: 品質を維持しつつ削減）
    const contextText = context
      .slice(0, 5) // 上位5件（品質維持）
      .map(
        (doc) => {
          // 各文書の内容を3分の2に削減（800 → 530文字、パフォーマンスと品質のバランス）
          const truncatedContent = doc.content.length > 530 
            ? doc.content.substring(0, 530) + '...' 
            : doc.content;
          
          return `**${doc.title}**
${truncatedContent}`;
        }
      )
      .join('\n\n');

    // チャット履歴の準備
    const chatHistoryText = chatHistory.length > 0 
      ? chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')
      : 'なし';

    // プロンプトの準備
    const template = Handlebars.compile(STREAMING_PROMPT_TEMPLATE);
    const prompt = template({
      context: contextText,
      chat_history: chatHistoryText,
      question: question
    });
    
    console.log('🔍 [DEBUG] prompt length:', prompt.length);
    console.log('🔍 [DEBUG] context length:', context.length);
    console.log('🔍 [DEBUG] context text length:', contextText.length);

    // ストリーミング生成の実行（Phase 3最適化: タイムアウト付きエラーハンドリング）
    let result;
    try {
      console.log('🔍 [DEBUG] AI generate開始');
      console.log('🔍 [DEBUG] prompt length:', prompt.length);
      console.log('🔍 [DEBUG] context length:', context.length);
      
      // Phase 3最適化: タイムアウト付きでAI生成を実行
      const generatePromise = ai.generate({
        model: GeminiConfig.model,
        prompt: prompt,
        config: GeminiConfig.config
      });
      
      // 完全性重視: タイムアウトを設定（より多くの時間を確保）
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI generation timeout')), GeminiConfig.timeout)
      );
      
      result = await Promise.race([generatePromise, timeoutPromise]);
      
      console.log('🔍 [DEBUG] AI generate完了');
      console.log('🔍 [DEBUG] result.text length:', result.text?.length || 0);
    } catch (error) {
      console.error('❌ Gemini API エラー:', error);
      
      // Phase 3最適化: 高速フォールバック回答を生成
      const fallbackAnswer = generateFallbackAnswer(question, context);
      console.log('🔄 フォールバック回答を生成:', fallbackAnswer.substring(0, 100) + '...');
      
      // フォールバック結果を返す
      const references = context.map((doc, index) => ({
        id: doc.id || `${doc.pageId}-${index}`,
        title: doc.title || 'タイトル不明',
        url: doc.url,
        distance: doc.distance || 0.5,
        score: doc.score || 0,
        source: doc.source || 'vector'
      }));

      yield {
        chunk: fallbackAnswer,
        chunkIndex: 1,
        totalChunks: 1,
        isComplete: true,
        references: references
      };
      return;
    }

    // 参照元の準備
    const references = context.map((doc, index) => ({
      id: doc.id || `${doc.pageId}-${index}`,
      title: doc.title || 'タイトル不明',
      url: doc.url,
      distance: doc.distance,
      score: doc.score || 0,
      source: doc.source || 'vector'
    }));

    // ストリーミングをシミュレート
    let answer = '';
    console.log('🔍 [DEBUG] result.text:', result.text);
    console.log('🔍 [DEBUG] typeof result.text:', typeof result.text);
    
    if (typeof result.text === 'string') {
      answer = result.text;
    } else if (result.text !== null && result.text !== undefined) {
      answer = String(result.text);
    } else {
      answer = '回答を生成できませんでした。';
    }
    
    console.log('🔍 [DEBUG] answer after processing:', answer);
    console.log('🔍 [DEBUG] answer.includes("[object Object]"):', answer.includes('[object Object]'));
    
    // オブジェクトが混入していないかチェック
    if (answer.includes('[object Object]')) {
      console.warn('Object detected in answer, using fallback');
      answer = '回答の生成中にエラーが発生しました。';
    }
    
    console.log('🔍 [DEBUG] final answer:', answer);
    
    const chunks = splitIntoChunks(answer, 100);
    
    // チャンクを順次出力
    for (let i = 0; i < chunks.length; i++) {
      yield {
        chunk: chunks[i],
        isComplete: false,
        chunkIndex: i,
        references: references
      };
      
      // Phase 5最適化: チャンク間の遅延を削除（人為的な遅延は不要）
      // 旧: await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Phase 5 Week 2: 回答をキャッシュに保存（品質影響なし）
    answerCache.set(question, context, answer, references);
    console.log('[Phase 5 Streaming Cache] 💾 回答をキャッシュに保存');

    // 完了チャンク
    yield {
      chunk: '',
      isComplete: true,
      chunkIndex: chunks.length,
      totalChunks: chunks.length,
      references: references
    };

    console.log(`✅ ストリーミング要約完了: ${chunks.length}チャンク`);

  } catch (error) {
    console.error('❌ ストリーミング要約失敗:', error);
    
    // エラーチャンク
    yield {
      chunk: '申し訳ございませんが、回答の生成中にエラーが発生しました。',
      isComplete: true,
      chunkIndex: 0,
      totalChunks: 1,
      references: []
    };
  }
}

/**
 * チャンクの完了判定
 */
function isChunkComplete(chunk: string): boolean {
  // 句読点、改行、または一定の長さで区切る
  const lastChar = chunk[chunk.length - 1];
  const punctuationMarks = ['。', '！', '？', '.', '!', '?', '\n'];
  
  return (
    punctuationMarks.includes(lastChar) ||
    chunk.length >= 150 || // 最大チャンクサイズ
    chunk.includes('\n\n') // 段落区切り
  );
}

/**
 * テキストをチャンクに分割
 */
function splitIntoChunks(text: string, chunkSize: number): string[] {
  // 入力の安全性チェック
  if (typeof text !== 'string') {
    console.warn('splitIntoChunks received non-string input:', text);
    text = String(text);
  }
  
  // オブジェクトが混入していないかチェック
  if (text.includes('[object Object]')) {
    console.warn('Object detected in splitIntoChunks input, using fallback');
    return ['回答の生成中にエラーが発生しました。'];
  }
  
  const chunks: string[] = [];
  let currentChunk = '';
  
  const sentences = text.split(/([。！？\.!?])/);
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] + (sentences[i + 1] || '');
    
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text];
}

/**
 * ストリーミング要約の統計情報
 */
export interface StreamingStats {
  totalChunks: number;
  totalTime: number;
  averageChunkTime: number;
  firstChunkTime: number;
  lastChunkTime: number;
}

/**
 * ストリーミング要約の実行（統計付き）
 */
export async function* streamingSummarizeWithStats(
  params: {
    question: string;
    context: any[];
    chatHistory: any[];
  }
): AsyncGenerator<{
  chunk: string;
  isComplete: boolean;
  chunkIndex: number;
  totalChunks?: number;
  references: any[];
  stats?: StreamingStats;
}, void, unknown> {
  
  const startTime = performance.now();
  let firstChunkTime: number | null = null;
  let lastChunkTime: number | null = null;
  let chunkCount = 0;
  let totalChunkTime = 0;

  try {
    for await (const result of streamingSummarizeConfluenceDocs(params)) {
      const currentTime = performance.now();
      
      if (firstChunkTime === null) {
        firstChunkTime = currentTime - startTime;
      }
      
      lastChunkTime = currentTime - startTime;
      chunkCount = result.chunkIndex + 1;
      
      if (result.isComplete) {
        const stats: StreamingStats = {
          totalChunks: chunkCount,
          totalTime: lastChunkTime,
          averageChunkTime: lastChunkTime / chunkCount,
          firstChunkTime: firstChunkTime || 0,
          lastChunkTime: lastChunkTime
        };
        
        yield {
          ...result,
          stats: stats
        };
      } else {
        yield result;
      }
    }
  } catch (error) {
    console.error('❌ ストリーミング統計収集失敗:', error);
    throw error;
  }
}

/**
 * バックエンド用のストリーミング要約（非ストリーミング互換）
 */
export async function streamingSummarizeConfluenceDocsBackend(params: {
  question: string;
  context: any[];
  chatHistory: any[];
}): Promise<{
  answer: string;
  references: any[];
  streamingStats?: StreamingStats;
}> {
  
  let fullAnswer = '';
  let references: any[] = [];
  let streamingStats: StreamingStats | undefined;

  try {
    for await (const chunk of streamingSummarizeWithStats(params)) {
      if (!chunk.isComplete) {
        fullAnswer += chunk.chunk;
        references = chunk.references;
      } else {
        streamingStats = chunk.stats;
      }
    }

    return {
      answer: fullAnswer.trim(),
      references: references,
      streamingStats: streamingStats
    };
  } catch (error) {
    console.error('❌ バックエンドストリーミング要約失敗:', error);
    throw error;
  }
}

// デフォルトエクスポート
export default {
  streamingSummarizeConfluenceDocs,
  streamingSummarizeWithStats,
  streamingSummarizeConfluenceDocsBackend
};
