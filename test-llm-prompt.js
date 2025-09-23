const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

console.log('🔧 LLMプロンプトテストを開始します...');

// 環境変数の確認
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEYが設定されていません');
  process.exit(1);
}

// Gemini API クライアントの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// 実際のプロンプトをテスト
async function testPrompt() {
  try {
    console.log('🚀 実際のプロンプトをテスト中...');
    
    // 実際のプロンプト（簡略版）
    const prompt = `# Role
あなたは仕様書を分析し、ドメイン知識を抽出する専門家です。

# Context
これから渡すテキストは、大規模なシステム仕様書の一部です。
- ページタイトル: "テストページ"
- 親ページ: "テスト親ページ"
- ラベル: "テスト"
- 階層: "テスト > テストページ"
- URL: "https://example.com"
- 最終更新: "2024-01-01"
- 作成者: "テストユーザー"

# Task
上記コンテキストを考慮して、このページで説明されている以下の要素を抽出してください。
1.  **ドメイン名・エンティティ名**: このページが扱う主要な概念や対象（例: 教室管理、ユーザー管理、オファー管理、企業、会員）。ページタイトルや親ページから推測される最上位の概念を優先してください。
2.  **機能名・操作名**: このページで説明されている具体的なシステム機能やユーザー操作（例: 教室登録、教室編集、求人一覧閲覧、パスワード再設定）。
3.  **関連キーワード**: 検索に有効な、上記カテゴリに属さないがページ内容に関連する重要な用語やフレーズ。

# Rules
- 出力は必ずJSON形式にしてください。
- フォーマット: { "domainNames": ["ドメイン名1", ...], "functionNames": ["機能名1", ...], "operationNames": ["操作名1", ...], "relatedKeywords": ["キーワード1", ...], "confidence": 0.85 }
- ドメイン名・エンティティ名は、ページタイトルや親ページに含まれる「管理」「機能」などの接尾辞を除いた、最も簡潔で上位の概念を抽出してください。
- 機能名・操作名は具体的で分かりやすいものにしてください。
- キーワードは検索で使える用語を抽出してください。
- 各カテゴリの項目数に厳密な制限はありませんが、重要度に応じて優先順位を付けてください。
- 信頼度を0-1の数値で評価してください。

# Output Format
{
  "domainNames": ["ドメイン名1", "ドメイン名2"],
  "functionNames": ["機能名1", "機能名2"],
  "operationNames": ["操作名1", "操作名2"],
  "relatedKeywords": ["キーワードA", "キーワードB"],
  "confidence": 0.9
}

# Input
---
これはテスト用のコンテンツです。教室管理に関する機能について説明しています。
---
`;

    console.log(`📝 プロンプト長: ${prompt.length}文字`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ プロンプトテスト成功！');
    console.log(`📝 応答長: ${text.length}文字`);
    console.log(`📝 応答: ${text.substring(0, 200)}...`);
    
  } catch (error) {
    console.error('❌ プロンプトテスト失敗:');
    console.error(`  - エラータイプ: ${error.constructor.name}`);
    console.error(`  - エラーメッセージ: ${error.message}`);
    console.error(`  - エラーコード: ${error.code || 'N/A'}`);
  }
}

testPrompt();
