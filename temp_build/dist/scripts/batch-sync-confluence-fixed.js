"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// This is a fixed version of batch-sync-confluence.ts to ensure correct output path.
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const ai_1 = require("@genkit-ai/ai");
const core_1 = require("@genkit-ai/core");
const googleai_1 = require("@genkit-ai/googleai");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const confluence_1 = require("../../lib/confluence");
const firestore_2 = require("../../lib/firestore");
const utils_1 = require("../../lib/utils");
// Use path.resolve to ensure the temp directory is always relative to the project root
const TEMP_DIR = path.resolve(__dirname, '../../../temp');
async function main() {
    try {
        const serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
        (0, app_1.initializeApp)({
            credential: (0, app_1.cert)(serviceAccount),
        });
        (0, core_1.configureGenkit)({
            plugins: [(0, googleai_1.googleAI)()],
            logLevel: 'debug',
            enableTracingAndMetrics: true,
        });
        const spaceId = process.env.CONFLUENCE_SPACE_ID;
        if (!spaceId) {
            throw new Error('CONFLUENCE_SPACE_ID is not defined in .env file');
        }
        const lastSync = await (0, firestore_2.getLastSyncTime)(spaceId);
        console.log(`Last sync time for space ${spaceId}: ${lastSync?.toDate()}`);
        let start = 0;
        const limit = 25;
        let hasMore = true;
        let pageCount = 0;
        let batchCount = 0;
        const space = await (0, confluence_1.getSpaceById)(spaceId);
        const spaceName = space ? space.name : 'Unknown Space';
        while (hasMore) {
            batchCount++;
            console.log(`Fetching pages (batch ${batchCount})...`);
            const pages = await (0, confluence_1.getAllPages)(spaceId, start, limit, lastSync);
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
            let recordsToEmbed = [];
            let recordMetadatas = [];
            for (const page of pages) {
                const chunks = (0, utils_1.splitTextIntoChunks)(page.body.storage.value);
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
                        labels: page.metadata.labels.results.map((l) => l.name),
                    });
                });
            }
            const EMBEDDING_BATCH_SIZE = 20;
            for (let i = 0; i < recordsToEmbed.length; i += EMBEDDING_BATCH_SIZE) {
                const embeddingSubBatch = recordsToEmbed.slice(i, i + EMBEDDING_BATCH_SIZE);
                const metadataSubBatch = recordMetadatas.slice(i, i + EMBEDDING_BATCH_SIZE);
                const embeddings = await ai_1.aai.embed({
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
            const db = (0, firestore_1.getFirestore)();
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
        await (0, firestore_2.setLastSyncTime)(spaceId, new Date());
        console.log(`Sync completed for space ${spaceId}. Total pages processed: ${pageCount}.`);
        // GCS and Vector Search upload steps would follow here
        // Example:
        // const gcsPath = await uploadFileToGCS(filePath);
        // await uploadFileToVectorSearch(gcsPath);
    }
    catch (error) {
        console.error('Error during Confluence sync:', error);
        process.exit(1);
    }
}
main();
