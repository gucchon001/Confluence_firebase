import fs from 'fs';

function main() {
  const inPath = 'temp/_preview.json';
  const outPath = 'temp/prod-sample.jsonl';
  if (!fs.existsSync(inPath)) {
    console.error(`input not found: ${inPath}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(inPath, 'utf8')
    .split(/\r?\n/)
    .map(l => l.replace(/^\uFEFF/, '').trim())
    .filter(l => l.length > 0)
    .slice(0, 5); // sample 5 lines

  const out: string[] = [];
  for (const l of lines) {
    const o = JSON.parse(l);
    const id: string = o.id;
    const embedding: number[] = o.embedding;
    const title: string = o.title || '';
    const spaceKey: string = o.spaceKey || '';
    const labels: string[] = Array.isArray(o.labels) ? o.labels : [];

    const restricts: any[] = [
      { namespace: 'title', allow_list: [title] },
      { namespace: 'space_key', allow_list: [spaceKey] },
      { namespace: 'content_type', allow_list: ['confluence_page'] },
    ];
    if (labels.length > 0) {
      restricts.push({ namespace: 'label', allow_list: labels });
    }

    out.push(JSON.stringify({ id, embedding, restricts }));
  }

  fs.writeFileSync(outPath, out.join('\n'), { encoding: 'utf8' });
  console.log(`Wrote ${out.length} records to ${outPath}`);
}

main();
