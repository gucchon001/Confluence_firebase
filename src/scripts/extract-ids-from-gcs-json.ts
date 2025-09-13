import 'dotenv/config';
import { Storage } from '@google-cloud/storage';

async function main() {
  const gsUri = process.argv[2];
  const limit = Number(process.argv[3] || 5);
  if (!gsUri || !gsUri.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/extract-ids-from-gcs-json.ts gs://bucket/path/data.json [limit]');
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

  const [buf] = await file.download();
  const arr = JSON.parse(buf.toString('utf8')) as any[];
  const ids = arr
    .map(o => (o.datapointId ?? o.id))
    .filter((v: any) => typeof v === 'string')
    .slice(0, limit);
  console.log(ids.join(' '));
}

main().catch(e => { console.error(e.message); process.exit(1); });


