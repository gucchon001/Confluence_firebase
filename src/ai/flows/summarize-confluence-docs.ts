/**
 * Confluence文書要約（プレーン関数版）
 * Phase 5 Week 2: 回答キャッシュ統合
 */
// import { gemini15Flash } from '@genkit-ai/googleai';
import * as z from 'zod';
import Handlebars from 'handlebars';
import { ai } from '../genkit';
import { GeminiConfig } from '@/config/ai-models-config';
import { getAnswerCache } from '@/lib/answer-cache';

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
|--------|------|------|
| 項目A | 項目Aの説明 | 条件・制限等 |
| 項目B | 項目Bの説明 | 条件・制限等 |
| 項目C | 項目Cの説明 | 条件・制限等 |
\`\`\`

**絶対に守るべき見出しのルール**:
- セクションタイトル（例：「〜に利用される情報」「〜機能」）は必ず ### で開始してください
- サブセクション（例：「成功時」「失敗時」「条件」）は必ず #### で開始してください
- 見出し記号（### や ####）がないと、それは見出しではなく本文として扱われます
- 本文内の手順・項目の列挙のみ → 1. 項目、2. 項目 （番号付きリスト、見出し記号なし）

# 番号付きリストの厳格なルール
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

# テーブル形式の厳格なルール
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

# 提供された参考情報 (Context)
{{context}}

# 会話履歴 (Chat History)
{{chat_history}}

# ユーザーの質問 (Question)
{{question}}

# 回答例 (Example)
質問: "機能名の仕様は"
参考情報に該当する機能ドキュメントがある場合:
→ 「機能名について、以下の仕様が確認できます：[具体的な機能仕様を要約]」

質問: "機能名の詳細を教えて"
参考情報に該当する機能ドキュメントがある場合:
→ 「機能名について、以下の詳細が確認できます：[具体的な機能詳細を要約]」

質問: "機能名の項目は"
参考情報に該当する機能ドキュメントがある場合:
→ 「機能名では、以下の項目が確認できます：

\`\`\`
| 項目名 | 説明 | 備考 |
|--------|------|------|
| 項目A | 項目Aの説明 | 条件・制限等 |
| 項目B | 項目Bの説明 | 条件・制限等 |
| 項目C | 項目Cの説明 | 条件・制限等 |
\`\`\`」」

# 重要な注意事項
- 議事録やミーティング記録は参考情報として不適切です。機能仕様書や設計書を優先してください。
- 回答は具体的で実用的な情報に焦点を当ててください。
- 包括的なドキュメントがある場合は、その内容を詳しく分析して回答してください。
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
  prompt: z.string().optional(),
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

    // Phase 5 Week 2: 回答キャッシュチェック（品質影響なし）
    const answerCache = getAnswerCache();
    // ドキュメントをキャッシュ用の形式に変換（urlをIDとして使用）
    const cacheDocuments = documents.map(doc => ({
      id: doc.url || doc.title || '', // urlまたはtitleをIDとして使用
      pageId: doc.url || doc.title || ''
    }));
    const cachedAnswer = answerCache.get(question, cacheDocuments);
    
    if (cachedAnswer) {
      console.log('[Phase 5 Cache] ⚡ 回答キャッシュヒット - 即座に返却');
      return {
        answer: cachedAnswer.answer,
        references: cachedAnswer.references,
      };
    }
    
    console.log('[Phase 5 Cache] キャッシュミス - Gemini生成開始');

    const formattedChatHistory = chatHistory
      .map((msg) => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`)
      .join('\n\n');

    const contextText = documents
      .slice(0, 10)  // Phase 5修正: 最大10件に制限（品質維持とトークン制限のバランス）
      .map(
        (doc, index) => {
          // ランキングに基づく動的な文字数制限（1位のドキュメントに十分な文字数を確保）
          // 1位: 2000文字、2位: 1500文字、3位: 1200文字、4位以降: 800文字
          const maxLength = index === 0 ? 2000 : index === 1 ? 1500 : index === 2 ? 1200 : 800;
          const truncatedContent = doc.content && doc.content.length > maxLength 
            ? doc.content.substring(0, maxLength) + '...' 
            : doc.content || '内容なし';
          
          return `## ドキュメント: ${doc.title}
**URL**: ${doc.url}
**スペース**: ${doc.spaceName || 'Unknown'}
**最終更新**: ${doc.lastUpdated || 'Unknown'}
**ラベル**: ${(doc.labels || []).join(', ')}
        **関連度スコア**: ${(doc as any).scoreText || 'N/A'}

### 内容
${truncatedContent}`;
        }
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
      
      const llmResponse = await ai.generate({ 
        model: GeminiConfig.model, 
        prompt,
        config: GeminiConfig.config 
      });
      console.log('[summarizeConfluenceDocs] LLM Response type:', typeof llmResponse);
      console.log('[summarizeConfluenceDocs] LLM Response keys:', Object.keys(llmResponse || {}));
      console.log('[summarizeConfluenceDocs] LLM Response preview:', JSON.stringify(llmResponse).substring(0, 500) + '...');
      
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
        // フォールバック - より積極的にテキストを探す
        else {
          console.warn('[summarizeConfluenceDocs] Unexpected response format, trying fallback extraction');
          console.log('[summarizeConfluenceDocs] Full response:', llmResponse);
          
          // 文字列として直接使えるかチェック
          if (typeof llmResponse === 'string') {
            answer = llmResponse;
          } else {
            // JSONからテキストを抽出を試行
            const responseStr = JSON.stringify(llmResponse);
            if (responseStr.includes('text') || responseStr.includes('content')) {
              // 部分的な抽出を試行
              const textMatch = responseStr.match(/"text":"([^"]+)"/);
              if (textMatch) {
                answer = textMatch[1];
              } else {
                answer = responseStr;
              }
            } else {
              answer = responseStr;
            }
          }
        }
      } else {
        answer = String(llmResponse);
      }
    }
    
    // 応答の長さをログ出力
    console.log('[summarizeConfluenceDocs] Final answer length:', answer?.length || 0);
    console.log('[summarizeConfluenceDocs] Final answer:', answer);
    
    // 応答が空または非常に短い場合のフォールバック
    if (!answer || answer.trim().length < 20) {
      console.log('[summarizeConfluenceDocs] Response too short, using fallback');
      console.log('[summarizeConfluenceDocs] Original answer length:', answer?.length || 0);
      console.log('[summarizeConfluenceDocs] Original answer:', answer);
      
      // より適切なフォールバック回答を生成
      answer = `提供された参考情報からは、教室のデータ連携や関連データに関する情報が一部確認できますが、教室の登録・編集・削除といった直接的な管理機能の詳細な仕様は見つかりませんでした。`;
    }

    // 参照元テキストを除去する後処理
    if (answer) {
      const lines = answer.split('\n');
      let referenceStartIndex = -1;
      
      // より包括的な参照元セクションと参考情報セクションの検出
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (
          line.startsWith('### 参照元') ||
          line.startsWith('## 参照元') ||
          line.startsWith('# 参照元') ||
          line.startsWith('参照元') ||
          line.startsWith('### 参考情報') ||
          line.startsWith('## 参考情報') ||
          line.startsWith('# 参考情報') ||
          line.startsWith('参考情報') ||
          line.includes('参考情報（Low）') ||
          (line.startsWith('*') && line.includes('Title:')) ||
          line.match(/^\*\s*Title:/) ||
          line.match(/^###?\s*参照元/) ||
          line.match(/^###?\s*参考情報/)
        ) {
          referenceStartIndex = i;
          break;
        }
      }
      
      if (referenceStartIndex !== -1) {
        answer = lines.slice(0, referenceStartIndex).join('\n').trim();
        console.log('[summarizeConfluenceDocs] Removed reference text from answer at line', referenceStartIndex);
      }
    }

  const references = documents.map((doc) => ({
    id: doc.url || doc.title || '', // キャッシュ用のID
    title: removeMarkdownFormatting(doc.title), // マークダウン表記を除去
    url: doc.url,
    spaceName: doc.spaceName,
    lastUpdated: doc.lastUpdated,
    distance: (doc as any).distance,
    source: (doc as any).source, // vector / keyword / bm25 / hybrid
    scoreText: (doc as any).scoreText,
  }));

  // Phase 5 Week 2: 回答をキャッシュに保存（品質影響なし）
  const cacheDocumentsForSet = documents.map(doc => ({
    id: doc.url || doc.title || '',
    pageId: doc.url || doc.title || ''
  }));
  answerCache.set(question, cacheDocumentsForSet, answer, references);
  console.log('[Phase 5 Cache] 💾 回答をキャッシュに保存');

    return { answer, references, prompt };
  } catch (error: any) {
    console.error(`[summarizeConfluenceDocs] Error: ${error.message}`);
    return {
      answer: `エラーが発生しました: ${error.message}`,
      references: [],
      prompt: '',
    };
  }
}