// This is a fixed version of batch-sync-confluence.ts to ensure correct output path.
import * as dotenv from 'dotenv';
dotenv.config();

import { aai } from '@genkit-ai/ai';
import { configureGenkit } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/googleai';
import * as fs from 'fs';
import * as path from 'path';

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { ConfluencePage, getAllPages, getSpaceById } from '../../lib/confluence';
import { getLastSyncTime, setLastSyncTime } from '../../lib/firestore';
import { splitTextIntoChunks } from '../../lib/utils';
import { uploadFileToGCS } from './upload-jsonl-to-gcs';
import { uploadFileToVectorSearch } from './upload-to-vector-search';

// Use path.resolve to ensure the temp directory is always relative to the project root
const TEMP_DIR = path.resolve(__dirname, '../../../temp');


async function main() {
  try {
    const serviceAccount = JSON.parse(
      fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, 'utf8')
    );
    initializeApp({
      credential: cert(serviceAccount),
    });

    configureGenkit({
      plugins: [googleAI()],
      logLevel: 'debug',
      enableTracingAndMetrics: true,
    });

    const spaceId = process.env.CONFLUENCE_SPACE_ID;
    if (!spaceId) {
      throw new Error('CONFLUENCE_SPACE_ID is not defined in .env file');
    }

    const lastSync = await getLastSyncTime(spaceId);
    console.log(`Last sync time for space ${spaceId}: ${lastSync?.toDate()}`);

    let start = 0;
    const limit = 25;
    let hasMore = true;
    let pageCount = 0;
    let batchCount = 0;

    const space = await getSpaceById(spaceId);
    const spaceName = space ? space.name : 'Unknown Space';

    while (hasMore) {
      batchCount++;
      console.log(`Fetching pages (batch ${batchCount})...`);
      const pages = await getAllPages(spaceId, start, limit, lastSync);

      if (pages.length === 0) {
        console.log('No new pages to sync.');
        hasMore = false;
        continue;
      }

      pageCount += pages.length;
      console.log(`Fetched ${pages.length} pages. Total fetched: ${pageCount}`);
      
      if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR);
      }
      const timestamp = new Date().getTime();
      const filePath = path.join(TEMP_DIR, `vector-search-data-${new Date().toISOString().split('T')[0]}-batch-${batchCount}-${timestamp}.json`);
      
      let recordsToEmbed: any[] = [];
      let recordMetadatas: any[] = [];

      for (const page of pages) {
        const chunks = splitTextIntoChunks(page.body.storage.value);
        chunks.forEach((chunk, index) => {
          const recordId = `${page.id}-${index}`;
          recordsToEmbed.push({
            content: chunk,
          });
          recordMetadatas.push({
            id: recordId,
            pageId: page.id,
            title: page.title,
            spaceKey: page.space?.key,
            spaceName: spaceName,
            url: `${process.env.CONFLUENCE_BASE_URL}/wiki${page._links.webui}`,
            lastUpdated: page.version.when,
            chunkIndex: index,
            content: chunk,
            labels: page.metadata.labels.results.map((l: any) => l.name),
          });
        });
      }

      const EMBEDDING_BATCH_SIZE = 20;
      for (let i = 0; i < recordsToEmbed.length; i += EMBEDDING_BATCH_SIZE) {
        const embeddingSubBatch = recordsToEmbed.slice(i, i + EMBEDDING_BATCH_SIZE);
        const metadataSubBatch = recordMetadatas.slice(i, i + EMBEDDING_BATCH_SIZE);

        const embeddings = await aai.embed({
          embedder: 'googleai/text-embedding-004',
          content: embeddingSubBatch.map(r => r.content),
        });

        const jsonlData = metadataSubBatch.map((metadata, index) => {
          return JSON.stringify({
            id: metadata.id,
            embedding: embeddings[index],
            restricts: [
              {
                namespace: 'space_key',
                allow: [metadata.spaceKey],
              },
              {
                namespace: 'label',
                allow: metadata.labels,
              },
            ],
            metadata: {
              ...metadata
            }
          });
        }).join('\n');
        fs.appendFileSync(filePath, jsonlData + '\n');
      }

      const db = getFirestore();
      const batch = db.batch();
      recordMetadatas.forEach(metadata => {
        const docRef = db.collection('chunks').doc(metadata.id);
        batch.set(docRef, { ...metadata, createdAt: new Date() });
      });
      await batch.commit();
      console.log(`Saved ${recordMetadatas.length} chunks to Firestore.`);

      start += pages.length;
      hasMore = pages.length === limit;
      // hasMore = false; // for testing
    }

    await setLastSyncTime(spaceId, new Date());
    console.log(`Sync completed for space ${spaceId}. Total pages processed: ${pageCount}.`);

    // GCS and Vector Search upload steps would follow here
    // Example:
    // const gcsPath = await uploadFileToGCS(filePath);
    // await uploadFileToVectorSearch(gcsPath);

  } catch (error) {
    console.error('Error during Confluence sync:', error);
    process.exit(1);
  }
}

main();
