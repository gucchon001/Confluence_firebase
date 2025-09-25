import { answerWithRag } from '../lib/rag-engine';

async function main() {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Usage: npx tsx src/scripts/run-rag.ts <query>');
    process.exit(1);
  }

  console.log(`=== RAG RUN ===\nQuery: ${query}`);
  const ans = await answerWithRag(query, { labelFilters: { excludeMeetingNotes: true, excludeArchived: true } });

  console.log('\n--- 要約 ---');
  console.log(ans.summary);

  if (ans.bullets && ans.bullets.length > 0) {
    console.log('\n--- 要点 ---');
    for (const b of ans.bullets) console.log(`- ${b}`);
  }

  if (ans.citations && ans.citations.length > 0) {
    console.log('\n--- 引用 ---');
    ans.citations.forEach((c, i) => {
      console.log(`[${i + 1}] ${c.title} (${c.scoreText})`);
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


