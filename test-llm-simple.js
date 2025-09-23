const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

console.log('🔧 簡単なLLM APIテストを開始します...');

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

// 簡単なテスト
async function testLLM() {
  try {
    console.log('🚀 LLM API呼び出しをテスト中...');
    
    const prompt = 'こんにちは。これはテストです。';
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ LLM API呼び出し成功！');
    console.log(`📝 応答: ${text}`);
    
  } catch (error) {
    console.error('❌ LLM API呼び出し失敗:');
    console.error(`  - エラータイプ: ${error.constructor.name}`);
    console.error(`  - エラーメッセージ: ${error.message}`);
    console.error(`  - エラーコード: ${error.code || 'N/A'}`);
    console.error(`  - エラー詳細: ${JSON.stringify(error, null, 2)}`);
  }
}

testLLM();
