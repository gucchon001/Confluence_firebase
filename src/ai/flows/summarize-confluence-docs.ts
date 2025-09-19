/**
 * Confluence文書要約（プレーン関数版）
 */
// import { gemini15Flash } from '@genkit-ai/googleai';
import * as z from 'zod';
import Handlebars from 'handlebars';
import { ai } from '../genkit';

// プロンプトテンプレート (変更なし)
const PROMPT_TEMPLATE = `
# 指示 (Instructions)
あなたは、社内のConfluenceに書かれた仕様書に関する質問に答える、優秀なAIアシスタントです。
以下のルールを厳格に守って、ユーザーの質問に回答してください。

# ルール (Rules)
1. 回答は、必ず「提供された参考情報」セクションの記述のみを根拠としてください。
2. 「提供された参考情報」に質問と明確に関連する記述がある場合のみ、具体的な回答を提供してください。
3. 「提供された参考情報」に質問と関連する記述がない場合は、「参考情報の中に関連する記述が見つかりませんでした」と回答し、関連しそうなドキュメントのタイトルを3件程度示してください。
4. 回答は、ユーザーの質問に対して簡潔かつ明確に要約してください。
5. 回答には参照元情報をテキストとして含めないでください。参照元は別途処理されます。
6. ユーザーからの挨拶や感謝には、フレンドリーに返答してください。
7. 提供された参考情報にあるラベルやスペース情報も活用して、より関連性の高い回答を提供してください。
8. 情報の確実性が低い場合は、推測や不確かな情報を提供するのではなく、「この点についての詳細な情報は見つかりませんでした」と正直に伝えてください。

# 提供された参考情報 (Context)
{{context}}

# 会話履歴 (Chat History)
{{chat_history}}

# ユーザーの質問 (Question)
{{question}}
`;

const compiledTemplate = Handlebars.compile(PROMPT_TEMPLATE);

// ドキュメントの型を定義
export const DocumentSchema = z.object({
  content: z.string(),
  title: z.string(),
  url: z.string(),
  spaceName: z.string().optional(),
  lastUpdated: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

export const SummarizeInputSchema = z.object({
  question: z.string(),
  context: z.array(DocumentSchema),
  chatHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'ai']),
        content: z.string(),
      })
    )
    .optional(),
});

export const SummarizeOutputSchema = z.object({
  answer: z.string(),
  references: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      spaceName: z.string().optional(),
      lastUpdated: z.string().nullable().optional(),
    })
  ),
});

export type SummarizeInput = z.infer<typeof SummarizeInputSchema>;
export type SummarizeOutput = z.infer<typeof SummarizeOutputSchema>;

export async function summarizeConfluenceDocs({
  question,
  context: documents,
  chatHistory = [],
}: SummarizeInput): Promise<SummarizeOutput> {
  try {
    if (!documents || documents.length === 0) {
      return {
        answer: '申し訳ありませんが、検索クエリに関連するドキュメントが見つかりませんでした。別のキーワードで検索するか、より具体的な質問をお試しください。',
        references: [],
      };
    }

    const formattedChatHistory = chatHistory
      .map((msg) => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`)
      .join('\n\n');

    const contextText = documents
      .map(
        (doc) =>
          `[Title: ${doc.title}, URL: ${doc.url}, Space: ${
            doc.spaceName || 'Unknown'
          }, Updated: ${doc.lastUpdated || 'Unknown'}, Labels: ${(
            doc.labels || []
          ).join(', ')}]
${doc.content}`
      )
      .join('\n\n---\n\n');

    const prompt = compiledTemplate({
      context: contextText,
      chat_history: formattedChatHistory,
      question,
    });

    // テスト環境の場合はモックレスポンスを返す
    let answer;
    if (process.env.NODE_ENV === 'test') {
      console.log('[summarizeConfluenceDocs] Using test mock response');
      answer = `これはテスト環境用のモック回答です。\n\n${question}に対する回答として、${documents.length}件の関連ドキュメントから情報を抽出しました。`;
    } else {
      const llmResponse = await ai.generate({ model: 'googleai/gemini-2.5-flash', prompt });
      console.log('[summarizeConfluenceDocs] LLM Response:', llmResponse);
      
      // 応答形式の確認とデバッグ
      if (llmResponse && typeof llmResponse === 'object') {
        // custom.text関数を使用（最新のGenkit形式）
        if (llmResponse.custom && typeof llmResponse.custom.text === 'function') {
          answer = llmResponse.custom.text();
          console.log('[summarizeConfluenceDocs] Using custom.text() function');
        }
        // raw.text関数を使用（代替形式）
        else if (llmResponse.raw && typeof llmResponse.raw.text === 'function') {
          answer = llmResponse.raw.text();
          console.log('[summarizeConfluenceDocs] Using raw.text() function');
        }
        // 直接textプロパティを使用（古い形式）
        else if ('text' in llmResponse) {
          answer = typeof (llmResponse as any).text === 'function'
            ? (llmResponse as any).text()
            : (llmResponse as any).text;
          console.log('[summarizeConfluenceDocs] Using direct text property');
        }
        // outputプロパティを使用（別の形式）
        else if ('output' in llmResponse) {
          answer = typeof (llmResponse as any).output === 'function'
            ? (llmResponse as any).output()
            : (llmResponse as any).output;
          console.log('[summarizeConfluenceDocs] Using output property');
        }
        // message.content配列を使用（最新の形式の別の場所）
        else if (llmResponse.message && Array.isArray(llmResponse.message.content) && llmResponse.message.content.length > 0) {
          const textPart = llmResponse.message.content.find((part: any) => part.type === 'text');
          if (textPart && textPart.text) {
            answer = textPart.text;
            console.log('[summarizeConfluenceDocs] Using message.content[].text');
          } else {
            console.warn('[summarizeConfluenceDocs] No text part found in message.content');
            answer = JSON.stringify(llmResponse.message.content);
          }
        }
        // フォールバック
        else {
          console.warn('[summarizeConfluenceDocs] Unexpected response format:', llmResponse);
          answer = JSON.stringify(llmResponse);
        }
      } else {
        answer = String(llmResponse);
      }
    }
    
    // 応答が空または非常に短い場合のフォールバック
    if (!answer || answer.trim().length < 10) {
      console.log('[summarizeConfluenceDocs] Response too short, using fallback');
      
      // 検索結果のタイトルから関連しそうなものを抽出
      const relevantTitles = documents
        .slice(0, 3)
        .map(doc => `- ${doc.title}`)
        .join('\n');
      
      answer = `申し訳ありませんが、検索結果から質問「${question}」に直接対応する内容が見つかりませんでした。\n\n以下のドキュメントが関連している可能性がありますが、詳細な情報は含まれていません：\n\n${relevantTitles}\n\n別のキーワードで検索するか、より具体的な質問をお試しください。`;
    }

    // 参照元テキストを除去する後処理
    if (answer) {
      // 「参照元」で始まる行以降を除去
      const lines = answer.split('\n');
      const referenceStartIndex = lines.findIndex(line => 
        line.trim().startsWith('参照元') || 
        line.trim().startsWith('*') && line.includes('Title:') ||
        line.trim().match(/^\*\s*Title:/)
      );
      
      if (referenceStartIndex !== -1) {
        answer = lines.slice(0, referenceStartIndex).join('\n').trim();
        console.log('[summarizeConfluenceDocs] Removed reference text from answer');
      }
    }

  const references = documents.map((doc) => ({
    title: doc.title,
    url: doc.url,
    spaceName: doc.spaceName,
    lastUpdated: doc.lastUpdated,
    distance: doc.distance, // 距離（類似度スコア）を追加
    source: doc.source, // 検索ソース（vector/keyword）を追加
  }));

    return { answer, references };
  } catch (error: any) {
    console.error(`[summarizeConfluenceDocs] Error: ${error.message}`);
    return {
      answer: `エラーが発生しました: ${error.message}`,
      references: [],
    };
  }
}