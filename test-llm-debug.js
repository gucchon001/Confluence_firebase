const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

console.log('🔧 LLMデバッグテストを開始します...');

// 環境変数の確認
console.log('📋 環境変数確認:');
console.log(`  - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '設定済み' : '未設定'}`);
console.log(`  - キーの長さ: ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0}文字`);

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEYが設定されていません');
  process.exit(1);
}

// Gemini API クライアントの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// 実際のページコンテンツでテスト
async function testWithRealContent() {
  try {
    console.log('🚀 実際のページコンテンツでテスト中...');
    
    // 実際のページコンテンツ
    const pageContent = "あなたの新しいスペースへようこそ! Confluenceのスペースは、コンテンツやお知らせをあなたのチームとシェアするのに最適です。こちらがあなたのホームページです。現在はスペースでの最近のアクティビティが表示されていますが、お好みに合わせてこのページをカスタマイズすることができます。 最初にお勧めするステップ: この概要をカスタマイズ &nbsp;右上にある&nbsp; 編集アイコン &nbsp;を使って、この概要をカスタマイズします。 スペース サイドバー &nbsp;の&nbsp; + &nbsp;をクリックしてページを新規作成して続行すると、計画やアイデアなど、何でも自由に入力できるようになります。 参考情報 スペースの簡単な説明と最適な使用方法については、&nbsp; 「Confluence 101: organize your work in spaces」を参照してください。 スペースを設定する方法の概要については&nbsp; アトラシアンのガイドを参照してください . 空白のスペースから始めるのは大変そうと感じたら、より手軽な &nbsp;スペース テンプレート &nbsp;をお試しください。";
    
    // 実際のプロンプト（簡略版）
    const prompt = `# Role
あなたは仕様書を分析し、ドメイン知識を抽出する専門家です。

# Context
これから渡すテキストは、大規模なシステム仕様書の一部です。
- ページタイトル: "client-tomonokai-juku Home"
- 親ページ: "なし"
- ラベル: ""
- 階層: "client-tomonokai-juku Home"
- URL: "/spaces/CLIENTTOMO/overview"
- 最終更新: "2022-12-01T05:33:12.822Z"
- 作成者: "ejiri_yusuke"

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
${pageContent}
---
`;

    console.log(`📝 プロンプト長: ${prompt.length}文字`);
    console.log(`📝 ページコンテンツ長: ${pageContent.length}文字`);
    
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
    console.error(`  - エラー詳細:`, error);
  }
}

testWithRealContent();
