/**
 * Jira APIからサンプル課題を取得してカスタムフィールドを分析
 * 
 * 目的: Jira APIから実際に取得できるカスタムフィールドを確認
 * 
 * 実行方法:
 *   npx tsx scripts/fetch-jira-sample-issue.ts
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { appConfig } from '../src/config/app-config';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Jira API カスタムフィールド分析');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const baseUrl = appConfig.jira.baseUrl;
  const email = appConfig.jira.userEmail;
  const apiToken = appConfig.jira.apiToken;
  const projectKey = appConfig.jira.projectKey;

  if (!baseUrl || !email || !apiToken || !projectKey) {
    console.error('❌ Jira設定が不足しています');
    console.error('   appConfig.jira の設定を確認してください');
    process.exit(1);
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

  try {
    // 1. 現在の実装と同じフィールド指定で取得
    console.log('【ステップ1】現在の実装と同じフィールド指定で取得\n');
    const currentFields = 'summary,description,status,priority,assignee,reporter,created,updated,labels,issuetype,project,customfield_10276,customfield_10277,customfield_10278,customfield_10279,customfield_10280,customfield_10281,customfield_10282,customfield_10283,customfield_10284,customfield_10291,customfield_10292,comment';
    
    const currentUrl = `${baseUrl}/rest/api/3/search/jql?jql=project=${projectKey}&fields=${currentFields}&maxResults=10`;
    const currentResponse = await fetch(currentUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!currentResponse.ok) {
      throw new Error(`API request failed: ${currentResponse.status} ${currentResponse.statusText}`);
    }

    const currentData = await currentResponse.json() as any;
    
    if (currentData.issues && currentData.issues.length > 0) {
      // 値が設定されているカスタムフィールドを持つ課題を探す
      const issuesWithCustomFields: Array<{ key: string; fields: Record<string, any> }> = [];
      
      for (const issue of currentData.issues) {
        const fields = issue.fields || {};
        const customFields = Object.keys(fields).filter(k => 
          k.startsWith('customfield_') && 
          fields[k] !== null && 
          fields[k] !== undefined
        );
        
        if (customFields.length > 0) {
          issuesWithCustomFields.push({ key: issue.key, fields });
        }
      }
      
      console.log(`✅ ${currentData.issues.length}件の課題を取得`);
      console.log(`   カスタムフィールドに値が設定されている課題: ${issuesWithCustomFields.length}件\n`);
      
      if (issuesWithCustomFields.length > 0) {
        // 最初の課題のカスタムフィールドを表示
        const sampleIssue = issuesWithCustomFields[0];
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📋 サンプル課題: ${sampleIssue.key}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        const customFields = Object.keys(sampleIssue.fields).filter(k => 
          k.startsWith('customfield_') && 
          sampleIssue.fields[k] !== null && 
          sampleIssue.fields[k] !== undefined
        );
        
        for (const fieldId of customFields.sort()) {
          const value = sampleIssue.fields[fieldId];
          const valueType = value === null ? 'null' : 
                           value === undefined ? 'undefined' :
                           Array.isArray(value) ? 'array' :
                           typeof value;
          
          let valuePreview = '';
          if (value !== null && value !== undefined) {
            if (typeof value === 'object' && !Array.isArray(value)) {
              // オブジェクトの場合は簡略化
              if (value.value !== undefined) {
                valuePreview = `value: ${value.value}`;
              } else if (value.name !== undefined) {
                valuePreview = `name: ${value.name}`;
              } else {
                valuePreview = JSON.stringify(value).substring(0, 100);
              }
            } else if (Array.isArray(value)) {
              valuePreview = `array[${value.length}]`;
            } else {
              valuePreview = String(value).substring(0, 100);
            }
          }
          
          console.log(`${fieldId}`);
          console.log(`   型: ${valueType}`);
          if (valuePreview) {
            console.log(`   値: ${valuePreview}`);
          }
          console.log('');
        }
      }
    }

    // 2. 不足しているフィールドを確認
    console.log('【ステップ2】不足しているフィールドの確認\n');
    const expectedFields = [
      'customfield_10276', // 月
      'customfield_10277', // 担当
      'customfield_10278', // GIG状況
      'customfield_10279', // 開発検証
      'customfield_10280', // 本番検証
      'customfield_10281', // リリース予定日
      'customfield_10282', // 完了日
      'customfield_10283', // 希望リリース日
      'customfield_10284', // 限界リリース日
      'customfield_10291', // 影響業務
      'customfield_10292'  // 業務影響度
    ];
    
    if (currentData.issues && currentData.issues.length > 0) {
      const issue = currentData.issues[0];
      const fields = issue.fields || {};
      
      const missingFields = expectedFields.filter(f => !(f in fields) || fields[f] === null || fields[f] === undefined);
      const existingFields = expectedFields.filter(f => f in fields && fields[f] !== null && fields[f] !== undefined);
      
      console.log(`期待しているフィールド: ${expectedFields.length}個`);
      console.log(`取得できたフィールド: ${existingFields.length}個`);
      console.log(`不足しているフィールド: ${missingFields.length}個\n`);
      
      if (missingFields.length > 0) {
        console.log('不足しているカスタムフィールド:');
        for (const fieldId of missingFields) {
          console.log(`  ❌ ${fieldId}`);
        }
        console.log('');
      }
      
      // サマリー
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 サマリー');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`現在取得しているフィールド: ${existingFields.length}個`);
      console.log(`不足しているフィールド: ${missingFields.length}個`);
      if (missingFields.length > 0) {
        console.log(`\n次のステップ: 不足しているフィールド（${missingFields.join(', ')}）が実際に存在するか確認してください`);
      }
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    if (error instanceof Error) {
      console.error('   エラー詳細:', error.message);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

