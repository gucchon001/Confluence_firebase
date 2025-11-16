/**
 * 実際のデータを確認するスクリプト
 * LanceDBに保存されているデータ、特に表を含むドキュメントを確認
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { connect } from '@lancedb/lancedb';
import { getPageIdFromRecord } from '../src/lib/pageid-migration-helper';

async function checkActualData() {
  console.log('🔍 実際のデータ確認開始\n');
  console.log('='.repeat(80));

  try {
    // LanceDBに接続
    const dbPath = process.cwd() + '/.lancedb';
    const db = await connect(dbPath);
    const table = await db.openTable('confluence');

    // 学年自動更新バッチのドキュメントを検索
    const targetPageId = '743473812'; // 721_【作成中】学年自動更新バッチ
    console.log(`📄 対象ページID: ${targetPageId}\n`);

    // 全データを取得してフィルタリング
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(10000).toArray();

    // 対象ページのデータを検索
    const targetData = allData.filter((record: any) => {
      const pageId = getPageIdFromRecord(record) || record.pageId;
      return String(pageId) === targetPageId;
    });

    if (targetData.length === 0) {
      console.error(`❌ ページID ${targetPageId} のデータが見つかりませんでした。`);
      process.exit(1);
    }

    console.log(`✅ ${targetData.length}件のチャンクが見つかりました。\n`);

    // 各チャンクのデータを確認
    for (let i = 0; i < targetData.length; i++) {
      const record = targetData[i];
      const pageId = getPageIdFromRecord(record) || record.pageId;
      const title = record.title || '';
      const content = record.content || '';
      const chunkIndex = record.chunkIndex !== undefined ? record.chunkIndex : i;

      console.log('='.repeat(80));
      console.log(`📦 チャンク ${chunkIndex + 1}/${targetData.length}`);
      console.log('='.repeat(80));
      console.log(`ページID: ${pageId}`);
      console.log(`タイトル: ${title}`);
      console.log(`コンテンツ長: ${content.length}文字`);
      console.log(`チャンクインデックス: ${chunkIndex}\n`);

      // 表の内容を確認
      console.log('📊 表の内容確認:');
      
      // 表に関連するキーワードを検索
      const tableKeywords = ['表1', '表2', '更新前', '更新後', '学部1年生', '学部2年生', '現在の職業の更新'];
      for (const keyword of tableKeywords) {
        const index = content.indexOf(keyword);
        if (index >= 0) {
          // キーワードの前後50文字を表示
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + 50);
          const snippet = content.substring(start, end);
          console.log(`\n   "${keyword}" (位置: ${index}文字目):`);
          console.log(`   ...${snippet}...`);
        }
      }

      // 表の構造を確認（HTMLタグが残っているか、テキスト化されているか）
      console.log('\n📋 表の構造確認:');
      const hasTableTags = content.includes('<table') || content.includes('<tr') || content.includes('<td');
      const hasTableSeparator = content.includes(' | ');
      const hasTableNewline = content.includes('\n');
      
      console.log(`   HTMLタグ（<table>, <tr>, <td>）: ${hasTableTags ? '✅ あり' : '❌ なし'}`);
      console.log(`   セル区切り（ | ）: ${hasTableSeparator ? '✅ あり' : '❌ なし'}`);
      console.log(`   改行（\\n）: ${hasTableNewline ? '✅ あり' : '❌ なし'}`);

      // 表の内容を抽出（表1と表2の周辺）
      const table1Index = content.indexOf('表1');
      const table2Index = content.indexOf('表2');
      
      if (table1Index >= 0) {
        console.log(`\n📋 表1の周辺（${table1Index}文字目から200文字）:`);
        const table1Snippet = content.substring(table1Index, Math.min(content.length, table1Index + 200));
        console.log(table1Snippet);
      }

      if (table2Index >= 0) {
        console.log(`\n📋 表2の周辺（${table2Index}文字目から200文字）:`);
        const table2Snippet = content.substring(table2Index, Math.min(content.length, table2Index + 200));
        console.log(table2Snippet);
      }

      // 「現在の職業の更新」の周辺
      const occupationUpdateIndex = content.indexOf('現在の職業の更新');
      if (occupationUpdateIndex >= 0) {
        console.log(`\n📋 「現在の職業の更新」の周辺（${occupationUpdateIndex}文字目から200文字）:`);
        const occupationSnippet = content.substring(occupationUpdateIndex, Math.min(content.length, occupationUpdateIndex + 200));
        console.log(occupationSnippet);
      }

      // コンテンツの一部を表示（最初の500文字）
      console.log('\n📄 コンテンツの最初の500文字:');
      console.log(content.substring(0, Math.min(500, content.length)));
      if (content.length > 500) {
        console.log('...');
      }

      // コンテンツの最後の500文字
      if (content.length > 500) {
        console.log('\n📄 コンテンツの最後の500文字:');
        console.log('...');
        console.log(content.substring(Math.max(0, content.length - 500)));
      }

      console.log('\n');
    }

    // サマリー
    console.log('='.repeat(80));
    console.log('📊 サマリー');
    console.log('='.repeat(80));
    console.log(`総チャンク数: ${targetData.length}`);
    console.log(`総文字数: ${targetData.reduce((sum: number, record: any) => sum + (record.content || '').length, 0)}文字`);
    
    // 表の構造の確認
    const allContent = targetData.map((record: any) => record.content || '').join('');
    const hasTableTags = allContent.includes('<table') || allContent.includes('<tr') || allContent.includes('<td');
    const hasTableSeparator = allContent.includes(' | ');
    
    console.log(`\n表の構造:`);
    console.log(`  HTMLタグ: ${hasTableTags ? '✅ あり（HTMLタグが残っている）' : '❌ なし（テキスト化済み）'}`);
    console.log(`  セル区切り（ | ）: ${hasTableSeparator ? '✅ あり（構造が保持されている）' : '❌ なし（構造が失われている）'}`);

    // 表1と表2の存在確認
    const hasTable1 = allContent.includes('表1');
    const hasTable2 = allContent.includes('表2');
    console.log(`\n表の存在:`);
    console.log(`  表1: ${hasTable1 ? '✅ あり' : '❌ なし'}`);
    console.log(`  表2: ${hasTable2 ? '✅ あり' : '❌ なし'}`);

    // 「現在の職業の更新」の存在確認
    const hasOccupationUpdate = allContent.includes('現在の職業の更新');
    console.log(`\n重要なキーワード:`);
    console.log(`  「現在の職業の更新」: ${hasOccupationUpdate ? '✅ あり' : '❌ なし'}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ データ確認完了');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

checkActualData();

