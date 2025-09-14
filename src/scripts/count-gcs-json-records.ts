import 'dotenv/config';
import { Storage } from '@google-cloud/storage';

async function main() {
  const gsUri = process.argv[2];
  if (!gsUri || !gsUri.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/count-gcs-json-records.ts gs://bucket/path/data.json');
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
  console.log('records:', Array.isArray(arr) ? arr.length : 0);
}

main().catch(e => { console.error(e.message); process.exit(1); });


