/**
 * 日本語トークン化のテストスクリプト
 * kuromojiによる分かち書きの動作を確認
 */

import 'dotenv/config';
import { tokenizeJapaneseText, tokenizeJapaneseNouns, getTokenizerStatus } from '../src/lib/japanese-tokenizer';

async function testJapaneseTokenization() {
  console.log('🔍 日本語トークン化テスト開始\n');
  
  // トークナイザーの状態確認
  const status = getTokenizerStatus();
  console.log(`📊 トークナイザー状態: ${status.initialized ? '初期化済み' : '未初期化'}`);
  if (status.error) {
    console.log(`❌ エラー: ${status.error}`);
  }
  
  const testTexts = [
    '教室管理の仕様',
    'ログイン機能の詳細',
    '急募の設定方法',
    '会員登録の流れ',
    '求人情報の編集',
    'システム要件定義書',
    'データベース設計',
    'API仕様書',
    'ユーザーインターフェース',
    '認証・認可機能'
  ];
  
  console.log('\n📝 分かち書きテスト:');
  console.log('='.repeat(60));
  
  for (const text of testTexts) {
    try {
      const tokenized = await tokenizeJapaneseText(text);
      const nounsOnly = await tokenizeJapaneseNouns(text);
      
      console.log(`原文: "${text}"`);
      console.log(`分かち書き: "${tokenized}"`);
      console.log(`名詞のみ: "${nounsOnly}"`);
      console.log('-'.repeat(40));
    } catch (error) {
      console.log(`❌ エラー: "${text}" - ${error}`);
    }
  }
  
  // 長いテキストのテスト
  console.log('\n📄 長文テスト:');
  const longText = 'このシステムは、塾講師ステーションの運営に必要な機能を提供するWebアプリケーションです。会員登録、求人情報の管理、教室予約、応募管理などの機能を包括的にサポートしています。';
  
  try {
    const tokenized = await tokenizeJapaneseText(longText);
    const nounsOnly = await tokenizeJapaneseNouns(longText);
    
    console.log(`原文: "${longText}"`);
    console.log(`分かち書き: "${tokenized}"`);
    console.log(`名詞のみ: "${nounsOnly}"`);
  } catch (error) {
    console.log(`❌ 長文テストエラー: ${error}`);
  }
  
  // 英語混じりテキストのテスト
  console.log('\n🌐 英語混じりテキストテスト:');
  const mixedTexts = [
    'API仕様書の作成',
    'データベース設計書',
    'ユーザーインターフェース設計',
    '認証・認可機能の実装',
    'Webアプリケーション開発'
  ];
  
  for (const text of mixedTexts) {
    try {
      const tokenized = await tokenizeJapaneseText(text);
      console.log(`"${text}" -> "${tokenized}"`);
    } catch (error) {
      console.log(`❌ エラー: "${text}" - ${error}`);
    }
  }
  
  console.log('\n✅ 日本語トークン化テスト完了');
}

// テスト実行
testJapaneseTokenization().catch(console.error);
