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
2. 「提供された参考情報」に質問と関連する記述がない場合は、情報をでっち上げたりせず、正直に「参考情報の中に関連する記述が見つかりませんでした。」と回答してください。
3. 回答は、ユーザーの質問に対して簡潔かつ明確に要約してください。
4. 回答の最後には、根拠として利用した情報の出典を「参照元」として、タイトル、スペース名、最終更新日、URLのリスト形式で必ず記載してください。
5. ユーザーからの挨拶や感謝には、フレンドリーに返答してください。
6. 提供された参考情報にあるラベルやスペース情報も活用して、より関連性の高い回答を提供してください。

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
        answer: '申し訳ありませんが、参考情報の中に求人詳細画面に関する具体的な記述が見つかりませんでした。別のキーワードで検索するか、より具体的な質問をお試しください。',
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
      answer = '申し訳ありませんが、検索結果から適切な回答を生成できませんでした。検索結果には関連情報が含まれていますが、質問に直接対応する内容が見つかりませんでした。別の質問方法をお試しください。';
    }

    const references = documents.map((doc) => ({
      title: doc.title,
      url: doc.url,
      spaceName: doc.spaceName,
      lastUpdated: doc.lastUpdated,
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