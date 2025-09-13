import 'dotenv/config';
import { syncConfluenceData } from '../functions/sync-confluence-data';

async function testSyncBatch() {
  try {
    console.log('Testing Confluence data sync batch...');
    
    // データ同期バッチを実行
    const result = await syncConfluenceData();
    
    console.log('Sync batch result:', result);
    console.log('Sync batch completed successfully');
    
  } catch (error) {
    console.error('Sync batch test failed:', error);
  }
}

testSyncBatch();
