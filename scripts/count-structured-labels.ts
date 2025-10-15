/**
 * StructuredLabel件数確認スクリプト
 */

import 'dotenv/config';
import { getStructuredLabelStats } from '../src/lib/structured-label-service-admin';

async function main() {
  try {
    const stats = await getStructuredLabelStats();
    console.log(`\n📊 StructuredLabel件数: ${stats.total}件\n`);
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

main();

