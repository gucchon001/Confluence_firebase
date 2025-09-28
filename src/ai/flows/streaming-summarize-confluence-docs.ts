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

// プロンプトテンプレート（最適化版）
const STREAMING_PROMPT_TEMPLATE = `
# 指示
あなたは、社内のConfluenceに書かれた仕様書に関する質問に答える、優秀なAIアシスタントです。

# ルール
1. 提供された参考情報のみを根拠として回答してください
2. 参考情報に関連する記述がある場合は、具体的で有用な回答を提供してください
3. 回答は、ユーザーの質問に対して簡潔かつ明確に要約してください
4. 回答には参照元情報をテキストとして含めないでください
5. 「参照元」「### 参照元」などの参照元セクションは絶対に生成しないでください
6. 情報の確実性が低い場合は、「この点についての詳細な情報は見つかりませんでした」と正直に伝えてください

# 出力構成
1) 1段落の要約
2) 章立て（定義/機能/関連情報等、該当するもの）

# フォーマット指示
- マークダウン記法（**太文字**、*斜体*、###見出しなど）を適切に使用してください
- 見出しの前後には適切な改行を入れてください
- 箇条書きの前後には空行を入れてください
- 最後のチャンクでは「以上です」で終了してください

# 参考情報
{{context}}

# 質問
{{question}}

# ストリーミング指示
- 回答を段階的に生成し、重要な情報から順番に提供してください
- 各チャンクは完全な文として構成してください
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
    // コンテキストの準備（最適化された形式）
    const contextText = context
      .slice(0, 5) // 上位5件のみに制限
      .map(
        (doc) =>
          `## ${doc.title}
${doc.content.substring(0, 2000)}` // 内容を2000文字に制限
      )
      .join('\n\n---\n\n');

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

    // ストリーミング生成の実行（エラーハンドリング付き）
    let result;
    try {
      console.log('🔍 [DEBUG] AI generate開始');
      console.log('🔍 [DEBUG] prompt length:', prompt.length);
      console.log('🔍 [DEBUG] context length:', context.length);
      
      result = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt: prompt,
        config: {
          maxOutputTokens: 4096, // トークン制限を倍増
          temperature: 0.1,
          topP: 0.8,
        }
      });
      
      console.log('🔍 [DEBUG] AI generate完了');
      console.log('🔍 [DEBUG] result:', result);
      console.log('🔍 [DEBUG] result.text type:', typeof result.text);
      console.log('🔍 [DEBUG] result.text length:', result.text?.length || 0);
    } catch (error) {
      console.error('❌ Gemini API エラー:', error);
      
      // フォールバック: 基本的な回答を生成
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
    console.log('🔍 [DEBUG] answer length:', answer.length);
    
    // より細かいチャンクでリアルタイム表示を実現
    const chunks = splitIntoChunks(answer, 150); // より小さなチャンクサイズ
    console.log('🔍 [DEBUG] chunks created:', chunks.length);
    console.log('🔍 [DEBUG] chunks:', chunks.map((chunk, i) => `[${i}]: ${chunk.substring(0, 50)}...`));
    
    // チャンクを順次出力（リアルタイム表示）
    for (let i = 0; i < chunks.length; i++) {
      console.log(`🔍 [DEBUG] yielding chunk ${i + 1}/${chunks.length}:`, chunks[i].substring(0, 100) + '...');
      
      yield {
        chunk: chunks[i],
        isComplete: false,
        chunkIndex: i,
        totalChunks: chunks.length,
        references: references
      };
      
      // より短い遅延でリアルタイム感を向上
      await new Promise(resolve => setTimeout(resolve, 10));
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
    chunk.length >= 400 || // 最大チャンクサイズを増加
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
  
  // より細かい分割でリアルタイム表示を実現
  // 改行、句読点、マークダウン記法で分割
  const splitPoints = text.split(/(\n|。|！|？|\.|!|\?|\*\*|\*|###|##|#)/);
  
  for (let i = 0; i < splitPoints.length; i++) {
    const segment = splitPoints[i];
    
    // 空のセグメントをスキップ
    if (!segment.trim()) continue;
    
    // チャンクが指定サイズを超える場合、新しいチャンクを開始
    if (currentChunk.length + segment.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = segment;
    } else {
      currentChunk += segment;
    }
  }
  
  // 最後のチャンクを追加
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // 空のチャンクをフィルタリング
  return chunks.filter(chunk => chunk.trim().length > 0).length > 0 
    ? chunks.filter(chunk => chunk.trim().length > 0)
    : [text];
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
