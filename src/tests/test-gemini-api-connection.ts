/**
 * Gemini API疎通テスト
 * Embedding APIとLLM生成APIの接続確認
 */

import { loadTestEnv } from './test-helpers/env-loader';

// 環境変数の読み込み
loadTestEnv();

async function testGeminiApiConnection() {
  console.log('🔍 Gemini API疎通テスト開始\n');
  
  const results = {
    apiKey: false,
    embedding: false,
    llm: false,
  };
  
  // 1. APIキーの存在確認
  console.log('📝 テスト1: APIキーの存在確認');
  console.log('─'.repeat(60));
  
  try {
    // app-configを動的インポート（loadTestEnvの後に読み込む必要がある）
    const { appConfig } = await import('../config/app-config');
    const apiKey = appConfig.gemini.apiKey;
    
    if (!apiKey || apiKey.trim() === '') {
      console.error('❌ APIキーが設定されていません');
      console.log('   環境変数 GEMINI_API_KEY を確認してください\n');
      return results;
    }
    
    // APIキーの形式チェック（Gemini APIキーは通常20文字以上）
    if (apiKey.length < 20) {
      console.warn('⚠️  APIキーの長さが短すぎます。有効なAPIキーを確認してください');
    }
    
    console.log(`✅ APIキーが設定されています: ${apiKey.substring(0, 10)}...`);
    console.log(`   長さ: ${apiKey.length}文字\n`);
    results.apiKey = true;
    
  } catch (error) {
    console.error(`❌ APIキーの確認中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    console.log('');
    return results;
  }
  
  // 2. Embedding APIの疎通テスト
  console.log('📝 テスト2: Embedding APIの疎通テスト');
  console.log('─'.repeat(60));
  
  try {
    const { getEmbeddings } = await import('../lib/embeddings');
    const testText = 'これはGemini API疎通テスト用のサンプルテキストです';
    
    console.log(`   テストテキスト: "${testText}"`);
    console.log('   Embedding生成中...');
    
    const startTime = Date.now();
    const embedding = await getEmbeddings(testText);
    const elapsed = Date.now() - startTime;
    
    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.error('❌ Embedding生成に失敗しました: 空の配列が返されました');
      console.log('');
    } else {
      console.log(`✅ Embedding生成に成功しました`);
      console.log(`   ベクトル次元数: ${embedding.length}`);
      console.log(`   処理時間: ${elapsed}ms`);
      console.log(`   ベクトルの先頭5要素: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      console.log('');
      results.embedding = true;
    }
    
  } catch (error) {
    console.error(`❌ Embedding APIの疎通テストに失敗しました`);
    console.error(`   エラー: ${error instanceof Error ? error.message : String(error)}`);
    
    // エラーの種類に応じた詳細情報
    if (error instanceof Error) {
      if (error.message.includes('403') || error.message.includes('leaked') || error.message.includes('permission_denied')) {
        console.error('   ⚠️  APIキーが漏洩として報告されている可能性があります');
        console.error('   GitHub SecretsのGEMINI_API_KEYを更新してください');
      } else if (error.message.includes('401')) {
        console.error('   ⚠️  APIキーが無効です');
        console.error('   GEMINI_API_KEYの値を確認してください');
      } else if (error.message.includes('429')) {
        console.error('   ⚠️  APIリクエストのレート制限に達しています');
        console.error('   しばらく待ってから再試行してください');
      }
    }
    console.log('');
  }
  
  // 3. LLM生成APIの疎通テスト（Genkit経由）
  console.log('📝 テスト3: LLM生成APIの疎通テスト（Genkit経由）');
  console.log('─'.repeat(60));
  
  try {
    const { ai } = await import('../ai/genkit');
    const { GeminiConfig } = await import('../config/ai-models-config');
    
    const testPrompt = '「こんにちは」とだけ簡潔に返答してください。説明は不要です。';
    
    console.log(`   テストプロンプト: "${testPrompt}"`);
    console.log(`   モデル: ${GeminiConfig.model}`);
    console.log('   AI生成中...');
    
    const startTime = Date.now();
    const result = await ai.generate({
      model: GeminiConfig.model,
      prompt: testPrompt,
      config: {
        ...GeminiConfig.config,
        maxOutputTokens: 50, // 疎通テストなので短く設定
        temperature: 0.1, // 低温度で一貫性を重視
      },
    });
    const elapsed = Date.now() - startTime;
    
    if (!result || !result.text) {
      console.error('❌ LLM生成に失敗しました: レスポンスが空です');
      console.log('');
    } else {
      const responseText = result.text.trim();
      console.log(`✅ LLM生成に成功しました`);
      console.log(`   レスポンス: "${responseText}"`);
      console.log(`   処理時間: ${elapsed}ms`);
      
      // レスポンスの長さ確認
      if (responseText.length > 0) {
        console.log(`   レスポンス長: ${responseText.length}文字`);
        console.log('');
        results.llm = true;
      } else {
        console.warn('⚠️  レスポンスは空です');
        console.log('');
      }
    }
    
  } catch (error) {
    console.error(`❌ LLM生成APIの疎通テストに失敗しました`);
    console.error(`   エラー: ${error instanceof Error ? error.message : String(error)}`);
    
    // エラーの種類に応じた詳細情報
    if (error instanceof Error) {
      if (error.message.includes('403') || error.message.includes('permission')) {
        console.error('   ⚠️  APIキーに問題がある可能性があります');
        console.error('   GEMINI_API_KEYを確認してください');
      } else if (error.message.includes('401')) {
        console.error('   ⚠️  APIキーが無効です');
        console.error('   GEMINI_API_KEYの値を確認してください');
      } else if (error.message.includes('429')) {
        console.error('   ⚠️  APIリクエストのレート制限に達しています');
        console.error('   しばらく待ってから再試行してください');
      } else if (error.message.includes('timeout')) {
        console.error('   ⚠️  タイムアウトが発生しました');
        console.error('   ネットワーク接続を確認してください');
      }
    }
    console.log('');
  }
  
  // テスト結果のサマリー
  console.log('📊 テスト結果サマリー');
  console.log('─'.repeat(60));
  console.log(`   APIキー確認: ${results.apiKey ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`   Embedding API: ${results.embedding ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`   LLM生成API: ${results.llm ? '✅ 成功' : '❌ 失敗'}`);
  console.log('');
  
  const allPassed = results.apiKey && results.embedding && results.llm;
  if (allPassed) {
    console.log('✅ すべての疎通テストが成功しました！');
  } else {
    console.log('❌ 一部のテストが失敗しました。上記のエラーメッセージを確認してください。');
    process.exit(1);
  }
  
  return results;
}

// 実行
testGeminiApiConnection().catch((error) => {
  console.error('❌ テスト実行中に予期しないエラーが発生しました:');
  console.error(error);
  process.exit(1);
});

