import 'dotenv/config';
import { retrieveRelevantDocs } from '../ai/flows/retrieve-relevant-docs-lancedb';

async function main() {
  const question = 'ログイン機能の詳細は';
  console.log('=== retrieveRelevantDocs debug ===');
  console.log(`Question: ${question}`);
  const results = await retrieveRelevantDocs({
    question,
    labelFilters: { includeMeetingNotes: false, includeArchived: false },
  });
  console.log(`Results: ${results.length}`);
  results.slice(0, 10).forEach((r: any, i: number) => {
    console.log(`${i + 1}. title=${r.title}, pageId=${r.pageId}, url=${r.url}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
