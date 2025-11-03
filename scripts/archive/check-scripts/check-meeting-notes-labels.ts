/**
 * LanceDB内の議事録関連ラベルを確認するスクリプト
 */

import { optimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';

async function main() {
  console.log('🔍 議事録関連ラベルの確認を開始...\n');

  try {
    const connection = await optimizedLanceDBClient.getConnection();
    const table = connection.table;

    // すべてのレコードを取得（限定的）
    const allRecords = await table
      .query()
      .limit(10000)
      .toArrow();

    console.log(`📊 総レコード数: ${allRecords.numRows}\n`);

    // ラベルフィールドのインデックスを取得
    const labelFieldIndex = allRecords.schema.fields.findIndex((f: any) => f.name === 'labels');
    const titleFieldIndex = allRecords.schema.fields.findIndex((f: any) => f.name === 'title');
    const pageIdFieldIndex = allRecords.schema.fields.findIndex((f: any) => f.name === 'pageId' || f.name === 'id');

    if (labelFieldIndex === -1) {
      console.error('❌ labelsフィールドが見つかりません');
      return;
    }

    const labelColumn = allRecords.getChildAt(labelFieldIndex);
    const titleColumn = titleFieldIndex >= 0 ? allRecords.getChildAt(titleFieldIndex) : null;
    const pageIdColumn = pageIdFieldIndex >= 0 ? allRecords.getChildAt(pageIdFieldIndex) : null;

    // 議事録関連のキーワード
    const meetingKeywords = ['議事録', 'meeting-notes', 'meeting', 'ミーティング', '会議'];
    
    let meetingNotesCount = 0;
    let totalWithLabels = 0;
    const meetingNotesSamples: any[] = [];

    // 最初の3件でラベルの型を確認
    console.log('🔍 ラベルデータの型確認（最初の3件）:\n');
    for (let i = 0; i < Math.min(3, allRecords.numRows); i++) {
      const labels = labelColumn?.get(i);
      const title = titleColumn?.get(i) || 'Unknown';
      
      console.log(`${i + 1}. ${title}`);
      console.log(`   labels型: ${typeof labels}`);
      console.log(`   labels値: ${JSON.stringify(labels)}`);
      console.log(`   Array.isArray: ${Array.isArray(labels)}`);
      if (labels && typeof labels === 'object') {
        console.log(`   hasOwnProperty('toArray'): ${labels.hasOwnProperty && labels.hasOwnProperty('toArray')}`);
        console.log(`   constructor.name: ${labels.constructor?.name}`);
      }
      console.log('');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (let i = 0; i < allRecords.numRows; i++) {
      const labels = labelColumn?.get(i);
      const title = titleColumn?.get(i) || 'Unknown';
      const pageId = pageIdColumn?.get(i) || 'Unknown';

      // ラベルが存在するかチェック
      if (labels) {
        totalWithLabels++;

        let labelArray: string[] = [];
        
        // ラベルの形式を判定
        if (typeof labels === 'string') {
          // JSON文字列の可能性
          try {
            labelArray = JSON.parse(labels);
          } catch {
            labelArray = [labels];
          }
        } else if (Array.isArray(labels)) {
          labelArray = labels;
        } else if (labels && typeof labels === 'object' && typeof labels.toArray === 'function') {
          // Arrow型の場合
          labelArray = Array.from(labels.toArray());
        } else if (labels && typeof labels === 'object') {
          // その他のオブジェクト型（JSON.stringifyして配列に変換）
          try {
            const jsonLabels = JSON.parse(JSON.stringify(labels));
            if (Array.isArray(jsonLabels)) {
              labelArray = jsonLabels;
            } else if (typeof jsonLabels === 'object') {
              // オブジェクトの値を配列に変換
              labelArray = Object.values(jsonLabels).filter(v => v !== null && v !== undefined).map(String);
            }
          } catch (e) {
            console.warn(`⚠️ ラベル変換失敗: ${title}`);
          }
        }

        // 議事録関連のラベルをチェック
        const hasMeetingLabel = labelArray.some((label: any) => {
          const labelStr = String(label).toLowerCase();
          return meetingKeywords.some(keyword => labelStr.includes(keyword.toLowerCase()));
        });

        if (hasMeetingLabel) {
          meetingNotesCount++;
          
          if (meetingNotesSamples.length < 10) {
            meetingNotesSamples.push({
              pageId,
              title,
              labels: labelArray
            });
          }
        }
      }
    }

    console.log('📊 統計結果:');
    console.log(`   総レコード数: ${allRecords.numRows}`);
    console.log(`   ラベルを持つレコード数: ${totalWithLabels}`);
    console.log(`   議事録関連ラベルを持つレコード数: ${meetingNotesCount}`);
    console.log(`   議事録の割合: ${(meetingNotesCount / allRecords.numRows * 100).toFixed(2)}%\n`);

    if (meetingNotesSamples.length > 0) {
      console.log('📋 議事録ラベルを持つページのサンプル（最大10件）:\n');
      meetingNotesSamples.forEach((sample, idx) => {
        console.log(`${idx + 1}. ${sample.title}`);
        console.log(`   PageID: ${sample.pageId}`);
        console.log(`   Labels: ${sample.labels.join(', ')}`);
        console.log('');
      });
    } else {
      console.log('⚠️ 議事録ラベルを持つページが見つかりませんでした\n');
    }

    // タイトルに「議事録」を含むページも確認
    console.log('🔍 タイトルに「議事録」「ミーティング」を含むページを確認:\n');
    
    let titleMatchCount = 0;
    const titleMatchSamples: any[] = [];

    for (let i = 0; i < allRecords.numRows; i++) {
      const title = titleColumn?.get(i) || '';
      const labels = labelColumn?.get(i);
      const pageId = pageIdColumn?.get(i) || 'Unknown';

      const titleStr = String(title).toLowerCase();
      const hasMeetingInTitle = meetingKeywords.some(keyword => 
        titleStr.includes(keyword.toLowerCase())
      );

      if (hasMeetingInTitle) {
        titleMatchCount++;

        if (titleMatchSamples.length < 10) {
          let labelArray: string[] = [];
          if (labels) {
            if (typeof labels === 'string') {
              try {
                labelArray = JSON.parse(labels);
              } catch {
                labelArray = [labels];
              }
            } else if (Array.isArray(labels)) {
              labelArray = labels;
            }
          }

          titleMatchSamples.push({
            pageId,
            title,
            labels: labelArray
          });
        }
      }
    }

    console.log(`📊 タイトルに議事録関連キーワードを含むページ: ${titleMatchCount}件\n`);
    
    if (titleMatchSamples.length > 0) {
      console.log('📋 サンプル（最大10件）:\n');
      titleMatchSamples.forEach((sample, idx) => {
        console.log(`${idx + 1}. ${sample.title}`);
        console.log(`   PageID: ${sample.pageId}`);
        console.log(`   Labels: ${sample.labels.length > 0 ? sample.labels.join(', ') : '(なし)'}`);
        console.log('');
      });
    }

    console.log('✅ 分析完了');

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);
  } finally {
    await optimizedLanceDBClient.resetConnection();
    process.exit(0);
  }
}

main();

