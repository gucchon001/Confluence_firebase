/**
 * LanceDBのURLの問題を確認するスクリプト
 * ローカル環境と本番環境のURLをチェック
 */

import * as lancedb from '@lancedb/lancedb';
import * as fs from 'fs';
import * as path from 'path';

const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL || 'https://giginc.atlassian.net';

interface UrlIssue {
  id: string;
  page_id: number;
  title: string;
  current_url: string;
  expected_url: string;
  space_key: string;
  issue_type: 'invalid_format' | 'missing_base_url' | 'wrong_space' | 'wrong_page_id' | 'relative_path' | 'placeholder';
}

async function checkLocalUrls(): Promise<UrlIssue[]> {
  console.log('📋 ローカル環境のURLを確認中...\n');
  
  const issues: UrlIssue[] = [];
  
  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    
    // サンプルデータを取得（1000件）
    const allData = await table.search(new Array(768).fill(0)).limit(1000).toArray();
    
    console.log(`📊 確認対象: ${allData.length}件\n`);
    
    for (const record of allData) {
      const pageId = Number(record.page_id || record.pageId || 0);
      const spaceKey = String(record.space_key || record.spaceKey || '');
      const currentUrl = String(record.url || '');
      const title = String(record.title || '');
      const id = String(record.id || '');
      
      // 期待されるURL
      const expectedUrl = `${CONFLUENCE_BASE_URL}/wiki/spaces/${spaceKey}/pages/${pageId}`;
      
      // 問題の種類を判定
      let issueType: UrlIssue['issue_type'] | null = null;
      
      if (!currentUrl || currentUrl === '') {
        issueType = 'placeholder';
      } else if (currentUrl === '#') {
        issueType = 'placeholder';
      } else if (currentUrl.startsWith('/')) {
        issueType = 'relative_path';
      } else if (!currentUrl.startsWith('http')) {
        issueType = 'invalid_format';
      } else if (!currentUrl.includes(CONFLUENCE_BASE_URL)) {
        issueType = 'missing_base_url';
      } else if (currentUrl !== expectedUrl) {
        // URLの形式は正しいが、space_keyやpage_idが違う可能性
        if (!currentUrl.includes(`/spaces/${spaceKey}/`)) {
          issueType = 'wrong_space';
        } else if (!currentUrl.includes(`/pages/${pageId}`)) {
          issueType = 'wrong_page_id';
        }
      }
      
      if (issueType) {
        issues.push({
          id,
          page_id: pageId,
          title,
          current_url: currentUrl,
          expected_url: expectedUrl,
          space_key: spaceKey,
          issue_type: issueType
        });
      }
    }
    
    console.log(`❌ 問題のあるURL: ${issues.length}件\n`);
    
    // 問題の種類別に集計
    const issueStats = new Map<string, number>();
    issues.forEach(issue => {
      issueStats.set(issue.issue_type, (issueStats.get(issue.issue_type) || 0) + 1);
    });
    
    console.log('📊 問題の種類別集計:');
    for (const [type, count] of Array.from(issueStats.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`   - ${type}: ${count}件`);
    }
    console.log('');
    
    // サンプルを表示（最初の10件）
    if (issues.length > 0) {
      console.log('📋 問題のあるURL（サンプル、最初の10件）:');
      issues.slice(0, 10).forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.title}`);
        console.log(`   - ページID: ${issue.page_id}`);
        console.log(`   - スペースキー: ${issue.space_key}`);
        console.log(`   - 現在のURL: ${issue.current_url}`);
        console.log(`   - 期待されるURL: ${issue.expected_url}`);
        console.log(`   - 問題タイプ: ${issue.issue_type}`);
      });
      
      if (issues.length > 10) {
        console.log(`\n   ... 他${issues.length - 10}件\n`);
      }
    } else {
      console.log('✅ 問題のあるURLは見つかりませんでした\n');
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
  
  return issues;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   LanceDB URL問題確認スクリプト                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📦 Confluence Base URL: ${CONFLUENCE_BASE_URL}\n`);
  
  const issues = await checkLocalUrls();
  
  // 結果をJSONファイルに保存
  const outputPath = path.join(__dirname, 'url-issues-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(issues, null, 2));
  console.log(`📄 詳細レポートを保存しました: ${outputPath}\n`);
  
  console.log('✅ 確認完了');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ スクリプトエラー:', error);
    process.exit(1);
  });
}

export { checkLocalUrls };

