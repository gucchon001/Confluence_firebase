import 'dotenv/config';
import { Storage } from '@google-cloud/storage';

function isAsciiPrintable(str: string): boolean {
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}

async function main() {
  const gsUri = process.argv[2];
  if (!gsUri || !gsUri.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/audit-gcs-batch.ts gs://bucket/path/data.json');
    process.exit(1);
  }
  const [, , bucket, ...rest] = gsUri.split('/');
  const filePath = rest.join('/');
  const storage = new Storage();
  const file = storage.bucket(bucket).file(filePath);
  const [exists] = await file.exists();
  if (!exists) {
    console.error('GCS file not found:', gsUri);
    process.exit(1);
  }
  const [metadata] = await file.getMetadata();
  console.log('contentType:', metadata.contentType);
  console.log('size(bytes):', metadata.size);

  const [buf] = await file.download();
  const arr = JSON.parse(buf.toString('utf8')) as any[];
  if (!Array.isArray(arr)) {
    console.error('Top-level is not an array');
    process.exit(1);
  }
  const total = arr.length;
  const idSet = new Set<string>();
  const dupIds: string[] = [];
  let maxIdLen = 0;
  let nonAsciiCount = 0;
  const badCharSamples: string[] = [];
  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;
  let minNorm = Number.POSITIVE_INFINITY;
  let maxNorm = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < arr.length; i += 1) {
    const r = arr[i];
    const id = (r?.id ?? r?.datapointId) as string;
    const emb = (r?.embedding ?? r?.featureVector) as number[];
    if (typeof id === 'string') {
      if (id.length > maxIdLen) maxIdLen = id.length;
      if (!isAsciiPrintable(id)) {
        nonAsciiCount += 1;
        if (badCharSamples.length < 10) badCharSamples.push(id);
      }
      if (idSet.has(id)) {
        if (dupIds.length < 20) dupIds.push(id);
      } else {
        idSet.add(id);
      }
    }
    if (Array.isArray(emb)) {
      let sumSq = 0;
      for (let j = 0; j < emb.length; j += 1) {
        const v = emb[j];
        if (typeof v === 'number' && Number.isFinite(v)) {
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
          sumSq += v * v;
        }
      }
      const norm = Math.sqrt(sumSq);
      if (norm < minNorm) minNorm = norm;
      if (norm > maxNorm) maxNorm = norm;
    }
  }

  console.log('records:', total);
  console.log('uniqueIds:', idSet.size);
  console.log('duplicateIds(sample<=20):', dupIds);
  console.log('maxIdLength:', maxIdLen);
  console.log('nonAsciiIdCount:', nonAsciiCount);
  if (badCharSamples.length) console.log('nonAsciiIdSamples:', badCharSamples);
  console.log('embedding value range:', { min: minVal, max: maxVal });
  console.log('embedding L2 norm range:', { min: minNorm, max: maxNorm });
}

main().catch((e) => { console.error('Error:', e?.message || e); process.exit(1); });


