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
2. 提供された参考情報を詳しく分析し、質問に関連する情報があれば積極的に回答してください。
3. 参考情報に質問と関連する記述がある場合は、具体的で有用な回答を提供してください。
4. 参考情報に直接的な回答がない場合でも、関連する情報があれば「以下の情報が参考になるかもしれません」として回答してください。
5. 本当に全く関連する情報がない場合のみ、「参考情報の中に関連する記述が見つかりませんでした」と回答してください。
6. 回答は、ユーザーの質問に対して簡潔かつ明確に要約してください。
7. 回答には参照元情報をテキストとして含めないでください。参照元は別途処理されます。
8. ユーザーからの挨拶や感謝には、フレンドリーに返答してください。
9. 提供された参考情報にあるラベルやスペース情報も活用して、より関連性の高い回答を提供してください。
10. 情報の確実性が低い場合は、推測や不確かな情報を提供するのではなく、「この点についての詳細な情報は見つかりませんでした」と正直に伝えてください。

# 提供された参考情報 (Context)
{{context}}

# 会話履歴 (Chat History)
{{chat_history}}

# ユーザーの質問 (Question)
{{question}}

# 回答例 (Example)
質問: "教室管理の仕様は"
参考情報に「500_■教室管理機能」がある場合:
→ 「教室管理機能について、以下の仕様が確認できます：[具体的な機能仕様を要約]」

質問: "ログイン機能の詳細を教えて"
参考情報に「042_【FIX】会員ログイン・ログアウト機能」がある場合:
→ 「ログイン機能について、以下の詳細が確認できます：[具体的な機能詳細を要約]」

# 重要な注意事項
- 議事録やミーティング記録は参考情報として不適切です。機能仕様書や設計書を優先してください。
- 回答は具体的で実用的な情報に焦点を当ててください。
- 「500_■教室管理機能」のような包括的なドキュメントがある場合は、その内容を詳しく分析して回答してください。
- ドキュメントの内容が空や「true」のみの場合は、そのドキュメントは参考にならないため、他のドキュメントを優先してください。

# 出力構成（必須）
1) 1段落の要約
2) 章立て（定義/サイト表示/管理機能/関連バッチ等、該当するもの）
3) 引用（High/Mediumのみ）: 箇条書きでタイトルを列挙
4) 参考情報（Low）: 必要に応じて短く列挙

# 信頼区分の扱い
- 固定のスコア閾値で資料を除外しないでください。
- High/Medium の資料のみ本文の根拠として用い、Low は「参考情報（Low）」で触れてください。

# 厳格な禁止事項
- 参考情報に根拠のない推測は出力しないでください。
- 章立ての各章は、該当する根拠ドキュメントが存在しない場合は省略してください（空章を作らない）。
- メールテンプレートのみを根拠に仕様（要件/挙動）を断定しないでください。
`;

const compiledTemplate = Handlebars.compile(PROMPT_TEMPLATE);

/**
 * マークダウン表記を除去する関数
 */
function removeMarkdownFormatting(text: string): string {
  if (!text) return text;
  
  // マークダウンの見出し記号を除去
  let cleaned = text.replace(/^#{1,6}\s*/gm, '');
  
  // マークダウンの太字記号を除去
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
  cleaned = cleaned.replace(/__(.*?)__/g, '$1');
  
  // マークダウンの斜体記号を除去
  cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');
  cleaned = cleaned.replace(/_(.*?)_/g, '$1');
  
  // マークダウンのコード記号を除去
  cleaned = cleaned.replace(/`(.*?)`/g, '$1');
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  
  // マークダウンのリンク記号を除去
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // マークダウンのリスト記号を除去
  cleaned = cleaned.replace(/^[\s]*[-*+]\s*/gm, '');
  cleaned = cleaned.replace(/^[\s]*\d+\.\s*/gm, '');
  
  // マークダウンの水平線を除去
  cleaned = cleaned.replace(/^[\s]*[-*_]{3,}[\s]*$/gm, '');
  
  // 余分な空白行を整理
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return cleaned.trim();
}

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
      // 追加情報（検索スコアとソース種別）
      distance: z.number().optional(),
      source: z.enum(['vector', 'keyword', 'bm25', 'hybrid']).optional(),
      scoreText: z.string().optional(),
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
          `## ドキュメント: ${doc.title}
**URL**: ${doc.url}
**スペース**: ${doc.spaceName || 'Unknown'}
**最終更新**: ${doc.lastUpdated || 'Unknown'}
**ラベル**: ${(doc.labels || []).join(', ')}
        **関連度スコア**: ${(doc as any).distance || 'N/A'}%

### 内容
${doc.content}`
      )
      .join('\n\n---\n\n');

    const prompt = compiledTemplate({
      context: contextText,
      chat_history: formattedChatHistory,
      question,
    });
    
    console.log('[summarizeConfluenceDocs] Generated prompt preview:', prompt.substring(0, 500) + '...');
    console.log('[summarizeConfluenceDocs] Question:', question);
    console.log('[summarizeConfluenceDocs] Context text length:', contextText.length);

    // テスト環境の場合はモックレスポンスを返す
    let answer;
    if (process.env.NODE_ENV === 'test') {
      console.log('[summarizeConfluenceDocs] Using test mock response');
      answer = `これはテスト環境用のモック回答です。\n\n${question}に対する回答として、${documents.length}件の関連ドキュメントから情報を抽出しました。`;
    } else {
      console.log('[summarizeConfluenceDocs] Sending prompt to LLM...');
      console.log('[summarizeConfluenceDocs] Prompt length:', prompt.length);
      console.log('[summarizeConfluenceDocs] Documents for context:', documents.length);
      
      const llmResponse = await ai.generate({ model: 'googleai/gemini-2.5-flash', prompt });
      console.log('[summarizeConfluenceDocs] LLM Response type:', typeof llmResponse);
      console.log('[summarizeConfluenceDocs] LLM Response keys:', Object.keys(llmResponse || {}));
      console.log('[summarizeConfluenceDocs] LLM Response:', llmResponse);
      
      // 応答形式の確認とデバッグ
      if (llmResponse && typeof llmResponse === 'object') {
        // custom.text関数を使用（最新のGenkit形式）
        if ((llmResponse as any).custom && typeof (llmResponse as any).custom.text === 'function') {
          answer = (llmResponse as any).custom.text();
          console.log('[summarizeConfluenceDocs] Using custom.text() function');
        }
        // raw.text関数を使用（代替形式）
        else if ((llmResponse as any).raw && typeof (llmResponse as any).raw.text === 'function') {
          answer = (llmResponse as any).raw.text();
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
        else if ((llmResponse as any).message && Array.isArray((llmResponse as any).message.content) && (llmResponse as any).message.content.length > 0) {
          const textPart = (llmResponse as any).message.content.find((part: any) => part.type === 'text');
          if (textPart && textPart.text) {
            answer = textPart.text;
            console.log('[summarizeConfluenceDocs] Using message.content[].text');
          } else {
            console.warn('[summarizeConfluenceDocs] No text part found in message.content');
            answer = JSON.stringify((llmResponse as any).message.content);
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
    
    // 応答の長さをログ出力
    console.log('[summarizeConfluenceDocs] Final answer length:', answer?.length || 0);
    console.log('[summarizeConfluenceDocs] Final answer:', answer);
    
    // 応答が空または非常に短い場合のフォールバック（判定基準を緩和）
    if (!answer || answer.trim().length < 5) {
      console.log('[summarizeConfluenceDocs] Response too short, using fallback');
      console.log('[summarizeConfluenceDocs] Original answer length:', answer?.length || 0);
      console.log('[summarizeConfluenceDocs] Original answer:', answer);
      
      // 検索結果のタイトルから関連しそうなものを抽出
      const relevantTitles = documents
        .slice(0, 3) // 適切な件数に戻す
        .map(doc => `- ${doc.title}`)
        .join('\n');
      
      // より詳細で有用な回答を生成
      answer = `質問「${question}」について、以下のドキュメントが関連しています：\n\n${relevantTitles}\n\nこれらのドキュメントに詳細な情報が含まれている可能性があります。`;
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
    title: removeMarkdownFormatting(doc.title), // マークダウン表記を除去
    url: doc.url,
    spaceName: doc.spaceName,
    lastUpdated: doc.lastUpdated,
    distance: (doc as any).distance,
    source: (doc as any).source, // vector / keyword / bm25 / hybrid
    scoreText: (doc as any).scoreText,
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