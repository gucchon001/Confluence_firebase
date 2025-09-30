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
# 指示 (Instructions)
あなたは、社内のConfluenceに書かれた仕様書に関する質問に答える、優秀なAIアシスタントです。
以下のルールを厳格に守って、ユーザーの質問に回答してください。

# ルール (Rules)
1. 回答は、必ず「提供された参考情報」セクションの記述のみを根拠としてください。
2. 提供された参考情報を詳しく分析し、質問に関連する情報があれば積極的に回答してください。
3. 参考情報に質問と関連する記述がある場合は、具体的で有用な回答を提供してください。
4. 参考情報に直接的な回答がない場合でも、関連する情報があれば「以下の情報が参考になるかもしれません」として回答してください。
5. 本当に全く関連する情報がない場合のみ、「参考情報の中に関連する記述が見つかりませんでした」と回答してください。
6. 回答は、ユーザーの質問に対して簡潔かつ明確に要約してください。
7. 回答には参照元情報をテキストとして含めないでください。参照元は別途処理されます。
8. 「参照元」「### 参照元」「## 参照元」などの参照元セクションは絶対に生成しないでください。
9. ユーザーからの挨拶や感謝には、フレンドリーに返答してください。
10. 提供された参考情報にあるラベルやスペース情報も活用して、より関連性の高い回答を提供してください。
11. 情報の確実性が低い場合は、推測や不確かな情報を提供するのではなく、「この点についての詳細な情報は見つかりませんでした」と正直に伝えてください。

# 項目リスト出力の特別ルール (Special Rules for Item Lists)
以下の質問パターンが検出された場合、項目を表形式で出力してください：
- 「項目は」「可能な項目」「コピーできる項目」「一覧」「リスト」などのキーワードが含まれる質問
- 機能の詳細な項目を要求する質問
- 設定可能な項目を聞く質問

## 表形式出力の要件：
1. **Markdownテーブル形式**で出力してください
2. 列構成：項目名 | 説明 | 備考（該当する場合）
3. 参考情報から抽出できる具体的な項目を全て含めてください
4. 項目が見つからない場合は「該当する詳細項目は見つかりませんでした」と明記してください
5. 関連する項目がある場合は、可能な限り詳細に記載してください

## 表形式出力例：
\`\`\`
| 項目名 | 説明 | 備考 |
|:---|:---|:---|
| 基本情報 | 教室の基本データ | 必須項目 |
| 求人情報 | 求人関連のデータ | オプション |
| ロゴ画像 | 教室のロゴファイル | 画像制限あり |
\`\`\`

## 表形式の厳格な要件：
1. **必ずヘッダー行**: \`| 項目名 | 説明 | 備考 |\` 形式
2. **必ずセパレーター行**: \`|:---|:---|:---|\` 形式（左寄せ）
3. **データ行**: \`| 項目名 | 説明内容 | 備考内容 |\` 形式
4. **空行**: 表の前後に必ず1行の空行を入れる
5. **完全な表構造**: ヘッダー、セパレーター、データ行を必ず含む

# 重要な注意事項
- 議事録やミーティング記録は参考情報として不適切です。機能仕様書や設計書を優先してください。
- 回答は具体的で実用的な情報に焦点を当ててください。
- 「500_■教室管理機能」のような包括的なドキュメントがある場合は、その内容を詳しく分析して回答してください。
- ドキュメントの内容が空や「true」のみの場合は、そのドキュメントは参考にならないため、他のドキュメントを優先してください。

# 出力構成（必須）
1) 1段落の要約
2) 章立て（定義/サイト表示/管理機能/関連バッチ等、該当するもの）

# 信頼区分の扱い
- 固定のスコア閾値で資料を除外しないでください。
- High/Medium の資料のみ本文の根拠として用いてください。

# 厳格な禁止事項
- 参考情報に根拠のない推測は出力しないでください。
- 章立ての各章は、該当する根拠ドキュメントが存在しない場合は省略してください（空章を作らない）。
- メールテンプレートのみを根拠に仕様（要件/挙動）を断定しないでください。
- 「参考情報（Low）」「### 参考情報」「## 参考情報」などの参考情報セクションは絶対に生成しないでください。

# 提供された参考情報 (Context)
{{context}}

# 会話履歴 (Chat History)
{{chat_history}}

# ユーザーの質問 (Question)
{{question}}

# ストリーミング指示
- 回答を段階的に生成し、重要な情報から順番に提供してください
- 各チャンクは完全な文として構成してください
- 最後のチャンクでは「以上です」で終了してください
- **必ずマークダウン形式で出力**: 見出し、箇条書き、太文字を適切に使用してください

## 表形式について：
- **表は使用しない**: 表形式は避けて、箇条書きや段落形式で情報を整理してください
- **情報の整理**: 複雑な情報は番号付きリストや箇条書きで表現してください

## 改行とスペーシングの厳格な要件：
- **見出し**: 各見出しの前後に必ず2行の空行を入れる
  - 例: \`\n\n## 👥 サイト表示\n\n\` のように前後に空行が必要
- **段落**: 各段落の前後に必ず2行の空行を入れる
- **リスト項目**: 各リスト項目の間に1行の空行を入れる
- **セクション区切り**: \`---\` の前後に2行の空行を入れる
- **読みやすさ優先**: 詰まった印象を与えないよう、適切なスペーシングを確保してください
- **重要**: 見出し記号（##、###）の前に必ず空行を2行入れてください。これがないとマークダウンとして認識されません

# レイアウト・フォーマット指示
以下の見やすいマークダウン型式を厳格に採用してください：

## 基本構造
1. **メインタイトル**: \`## 🔑 機能名の仕様概要\` 形式
2. **概要段落**: 最初に1段落で全体の要約を提供
3. **セクション見出し**: \`## 👥 セクション名\` 形式で階層化
4. **サブセクション**: 番号付きリスト \`1. 項目名\`, \`2. 項目名\` で詳細化

## 見出しの階層とアイコン
\`\`\`
## 🔑 機能名の仕様概要

機能の概要説明文をここに記載します。

## 👥 セクション名

セクションの説明文を記載します。

### 1. 項目名

項目の説明文を記載します。

- **詳細項目**: 詳細説明

- **詳細項目**: 詳細説明

### 2. 項目名

項目の説明文を記載します。

- **詳細項目**: 詳細説明

---

## 🔗 関連機能

### 1. 関連項目名

関連項目の説明文を記載します。

- **詳細項目**: 詳細説明

\`\`\`

**重要**: 上記の例のように、全ての見出し（##、###）の前後に必ず空行を2行入れてください。空行がないとマークダウンとして認識されません。

## 書式設定の厳格な要件
- **メインタイトル**: \`## 🔑 機能名の仕様概要\` のみ使用
- **セクション見出し**: \`## 👥 セクション名\` で区切る（必ずマークダウン見出しとして変換）
- **サブセクション**: \`### 1. 項目名\`, \`### 2. 項目名\` で番号付け
- **箇条書き**: \`- **項目**: 説明\` 形式で強調（項目名の後に必ず改行）
- **段落**: 各段落の前後に必ず2行の空行を入れる
- **見出し**: 各見出しの前後に必ず2行の空行を入れる
- **箇条書き**: 各リスト項目の間に1行の空行を入れる
- **リスト構造**: タイトル直下にリストを配置せず、説明文を先に記載
- **情報整理**: 複雑な情報は箇条書きや番号付きリストで整理
- **セクション区切り**: 各機能セクションの間に \`---\` を配置（前後に2行の空行）
- **改行のゆとり**: 読みやすさを最優先に、適切なスペーシングを確保する
- **マークダウン変換**: 全ての見出し記法を正しくマークダウンとして出力する
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
    // コンテキストの準備（元の仕様と同じ詳細形式）
    const contextText = context
      .slice(0, 5)
      .map(
        (doc) =>
          `## ドキュメント: ${doc.title}
**URL**: ${doc.url}
**スペース**: ${doc.spaceName || 'Unknown'}
**最終更新**: ${doc.lastUpdated || 'Unknown'}
**ラベル**: ${(doc.labels || []).join(', ')}
**関連度スコア**: ${(doc as any).scoreText || 'N/A'}

### 内容
${doc.content}`
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
    
    console.log('🔍 [DEBUG] prompt length:', prompt.length);
    console.log('🔍 [DEBUG] context length:', context.length);
    console.log('🔍 [DEBUG] context text length:', contextText.length);

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
          maxOutputTokens: 8192,
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
