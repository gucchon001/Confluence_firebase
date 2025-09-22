import 'dotenv/config';
import axios from 'axios';
import { getConfluenceLabels } from './batch-sync-confluence';

// getConfluenceLabels関数をbatch-sync-confluenceからインポート

async function main() {
  // テスト対象のページID（既知のページから数件）
  const testPageIds = [
    '960561281', // 【統合のためクローズ】アカウント契約情報
    '666927294', // ■クライアント企業向け管理画面
    '816742401', // 【FIX】クライアント企業管理者アカウントロック通知メール
  ];

  console.log('=== ラベル取得テスト ===\n');

  for (const pageId of testPageIds) {
    try {
      console.log(`Testing pageId: ${pageId}`);
      const labels = await getConfluenceLabels(pageId);
      console.log(`Result: ${labels.length} labels found`);
      console.log(`Labels: ${JSON.stringify(labels)}`);
      console.log('---\n');
    } catch (error: any) {
      console.error(`Error for pageId ${pageId}: ${error.message}`);
      console.log('---\n');
    }
  }
}

main().catch(console.error);
