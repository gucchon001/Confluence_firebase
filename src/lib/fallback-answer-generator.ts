/**
 * フォールバック回答生成ユーティリティ
 * AIサービスが一時的に利用できない場合のフォールバック回答を生成
 */

/**
 * フォールバック回答を生成
 * @param question ユーザーの質問
 * @param context 関連文書の配列
 * @returns フォールバック回答の文字列
 */
export function generateFallbackAnswer(question: string, context: any[]): string {
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
  
  answer += `上記のドキュメントを参照して詳細な情報をご確認ください。\n\n`;
  answer += `AIサービスが復旧次第、より詳細な回答を提供いたします。`;
  
  return answer;
}

