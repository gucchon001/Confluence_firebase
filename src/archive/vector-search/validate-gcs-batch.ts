import 'dotenv/config';
import { Storage } from '@google-cloud/storage';

type ValidationIssue = {
  index: number;
  reason: string;
  id?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateRecord(
  record: any,
  idx: number,
  expectedDims = 768,
  options: { requireUnitL2?: boolean; l2Tolerance?: number; valueRange?: { min: number; max: number } } = {}
): ValidationIssue | null {
  if (record == null || typeof record !== 'object') {
    return { index: idx, reason: 'record is not an object' };
  }

  const id = record.id ?? record.datapointId;
  if (typeof id !== 'string' || id.trim().length === 0) {
    return { index: idx, reason: 'id is missing or not a non-empty string', id };
  }

  const embedding = record.embedding ?? record.featureVector;
  if (!Array.isArray(embedding)) {
    return { index: idx, reason: 'embedding is not an array', id };
  }
  if (embedding.length !== expectedDims) {
    return { index: idx, reason: `embedding length ${embedding.length} != ${expectedDims}`, id };
  }
  for (let i = 0; i < embedding.length; i += 1) {
    const v = embedding[i];
    if (!isFiniteNumber(v)) {
      return { index: idx, reason: `embedding[${i}] is not finite number`, id };
    }
    if (options.valueRange) {
      if (v < options.valueRange.min || v > options.valueRange.max) {
        return { index: idx, reason: `embedding[${i}] out of range ${options.valueRange.min}..${options.valueRange.max}`, id };
      }
    }
  }

  if (options.requireUnitL2) {
    const norm = Math.sqrt(embedding.reduce((s: number, v: number) => s + v * v, 0));
    const tol = options.l2Tolerance ?? 1e-3;
    if (Math.abs(norm - 1) > tol) {
      return { index: idx, reason: `L2 norm ${norm.toFixed(6)} deviates > ${tol}`, id };
    }
  }

  // Optional: restricts must be array if present
  if (record.restricts != null && !Array.isArray(record.restricts)) {
    return { index: idx, reason: 'restricts is present but not an array', id };
  }

  return null;
}

async function main() {
  const gsUri = process.argv[2];
  const expectedDims = Number(process.argv[3] || 768);
  if (!gsUri || !gsUri.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/validate-gcs-batch.ts gs://bucket/path/data.json [dims=768]');
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
  let records: any[];
  try {
    records = JSON.parse(buf.toString('utf8')) as any[];
  } catch (e: any) {
    console.error('JSON parse error:', e.message);
    process.exit(1);
  }
  if (!Array.isArray(records)) {
    console.error('Top-level JSON is not an array');
    process.exit(1);
  }

  const issues: ValidationIssue[] = [];
  const opts = { requireUnitL2: true, l2Tolerance: 1e-3, valueRange: { min: -1e6, max: 1e6 } };
  for (let i = 0; i < records.length; i += 1) {
    const issue = validateRecord(records[i], i, expectedDims, opts);
    if (issue) issues.push(issue);
  }

  console.log('records:', records.length);
  console.log('issues:', issues.length);
  if (issues.length > 0) {
    const preview = issues.slice(0, 20);
    console.log('sample issues (up to 20):');
    preview.forEach((it) => console.log(it));
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error('Error:', e?.message || e);
  process.exit(1);
});


