import { scheduledSyncConfluenceData, manualSyncConfluenceData } from '@/functions/scheduler';

// ルートの動的生成を有効化
export const dynamic = 'force-dynamic';

// Cloud Schedulerからの定期実行用エンドポイント
export async function POST(req: Request) {
  return scheduledSyncConfluenceData(req);
}

// 管理者による手動実行用エンドポイント
export async function GET(req: Request) {
  return manualSyncConfluenceData(req);
}
