import fs from 'fs';

function main() {
  const path = 'temp/_preview.json';
  if (!fs.existsSync(path)) {
    console.error(`file not found: ${path}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(path, 'utf8').trim().split(/\r?\n/).slice(0, 5);
  const sigs = lines.map((l, i) => {
    try {
      const o = JSON.parse(l);
      const sig = o.embedding.slice(0, 10).map((v: number) => Number(v.toFixed(6))).join(',');
      return sig;
    } catch (e: any) {
      console.error(`JSON parse error at line ${i}: ${e.message}`);
      process.exit(1);
    }
  });
  const base = sigs[0];
  sigs.forEach((s, i) => {
    const same = s === base;
    console.log(`Record ${i} sameAs0=${same} first10=${s}`);
  });
}

main();
