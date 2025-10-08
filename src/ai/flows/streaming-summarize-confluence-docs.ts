/**
 * Confluence文書要約（ストリーミング版）
 * リアルタイムで回答を生成・配信
 */

import * as z from 'zod';
import Handlebars from 'handlebars';
import { ai } from '../genkit';

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
「項目は」「一覧」「リスト」などのキーワードを含む質問には表形式で回答：

| 項目名 | 説明 | 備考 |
|:---|:---|:---|
| 項目1 | 説明1 | 備考1 |

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

## マークダウン形式の例
\`\`\`
## 🔑 機能名の仕様概要

質問に対する機能の概要を簡潔に説明します。

## 👥 詳細

### 1. 主要な機能

- **機能1**: 具体的な説明
- **機能2**: 具体的な説明

### 2. 設定項目

- **設定A**: 設定内容の説明
- **設定B**: 設定内容の説明

### 3. 関連機能

- **関連機能1**: 関連性の説明
- **関連機能2**: 関連性の説明
\`\`\`

## マークダウン形式の厳格な要件
**重要**: 以下の形式を必ず守って回答してください：

1. **メインタイトル**: ## 🔑 機能名の仕様概要 で開始
2. **セクション見出し**: ## 👥 セクション名 で各セクションを区切る
3. **サブセクション**: ### 1. 項目名 でサブセクションを作成
4. **サブサブセクション**: #### 成功時: や #### 失敗時: でさらに細分化
5. **箇条書き**: - **項目名**: 説明 で箇条書きを使用
6. **見出しの前後**: 必ず空行を入れる
7. **番号付きリスト**: 1. 項目、2. 項目 で順序立てた説明

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
  
  try {
    // コンテキストの準備（完全性重視: より多くの情報を提供）
    const contextText = context
      .slice(0, 5) // 文書数を5件に増加（完全性重視）
      .map(
        (doc) => {
          // 各文書の内容を800文字に増加（完全性重視）
          const truncatedContent = doc.content.length > 800 
            ? doc.content.substring(0, 800) + '...' 
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
        model: 'googleai/gemini-2.5-flash',
        prompt: prompt,
        config: {
          maxOutputTokens: 4096, // 完全性重視: 出力トークンを増加
          temperature: 0.1, // 完全性重視: 温度を下げて一貫性を向上
          topP: 0.9, // 完全性重視: topPを上げて多様性を向上
          topK: 50, // 完全性重視: topKを上げて選択肢を増加
        }
      });
      
      // 完全性重視: 60秒のタイムアウトを設定（より多くの時間を確保）
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI generation timeout')), 60000)
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
      
      // チャンク間の遅延をシミュレート
      await new Promise(resolve => setTimeout(resolve, 50));
    }

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
