"use strict";
/**
 * ConfluenceAPIから取得できるメタデータを確認するテスト
 */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// 環境変数の読み込み
function loadEnv() {
    // .env ファイルがあれば読み込む
    const envPath = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log('[loadEnv] Loaded environment variables from .env file');
    }
    else {
        console.log('[loadEnv] No .env file found, using existing environment variables');
    }
}
/**
 * Confluence APIの認証情報を取得する
 */
function getConfluenceAuth() {
    const username = process.env.CONFLUENCE_USERNAME;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    if (!username || !apiToken || !baseUrl) {
        throw new Error('Confluence API credentials not found in environment variables');
    }
    return {
        username,
        apiToken,
        baseUrl
    };
}
/**
 * Confluence APIからページの一覧を取得する
 *
 * @param limit 取得するページ数
 * @returns ページの一覧
 */
async function getConfluencePages(limit = 10) {
    try {
        console.log(`[getConfluencePages] Fetching ${limit} pages from Confluence API`);
        const { username, apiToken, baseUrl } = getConfluenceAuth();
        // ページの一覧を取得するエンドポイント
        const endpoint = `${baseUrl}/rest/api/content`;
        // APIリクエストを送信
        const response = await axios_1.default.get(endpoint, {
            params: {
                limit,
                expand: 'metadata,labels,version,space'
            },
            auth: {
                username,
                password: apiToken
            }
        });
        // レスポンスを処理
        if (response.data && response.data.results) {
            console.log(`[getConfluencePages] Found ${response.data.results.length} pages`);
            return response.data.results;
        }
        else {
            console.log('[getConfluencePages] No pages found');
            return [];
        }
    }
    catch (error) {
        console.error('[getConfluencePages] Error fetching pages from Confluence API:', error);
        // エラーの詳細情報を出力
        if (error.response) {
            console.error('[getConfluencePages] API response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
        else if (error.request) {
            console.error('[getConfluencePages] No response received:', error.request);
        }
        else {
            console.error('[getConfluencePages] Request error:', error.message);
        }
        return [];
    }
}
/**
 * Confluence APIからページの詳細を取得する
 *
 * @param pageId ページID
 * @returns ページの詳細
 */
async function getConfluencePageDetails(pageId) {
    try {
        console.log(`[getConfluencePageDetails] Fetching details for page ${pageId}`);
        const { username, apiToken, baseUrl } = getConfluenceAuth();
        // ページの詳細を取得するエンドポイント
        const endpoint = `${baseUrl}/rest/api/content/${pageId}`;
        // APIリクエストを送信
        const response = await axios_1.default.get(endpoint, {
            params: {
                expand: 'body.storage,metadata,labels,version,space,ancestors,children.page,history,extensions'
            },
            auth: {
                username,
                password: apiToken
            }
        });
        // レスポンスを処理
        if (response.data) {
            console.log(`[getConfluencePageDetails] Successfully fetched details for page ${pageId}`);
            return response.data;
        }
        else {
            console.log(`[getConfluencePageDetails] No details found for page ${pageId}`);
            return null;
        }
    }
    catch (error) {
        console.error(`[getConfluencePageDetails] Error fetching details for page ${pageId}:`, error);
        // エラーの詳細情報を出力
        if (error.response) {
            console.error('[getConfluencePageDetails] API response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
        else if (error.request) {
            console.error('[getConfluencePageDetails] No response received:', error.request);
        }
        else {
            console.error('[getConfluencePageDetails] Request error:', error.message);
        }
        return null;
    }
}
/**
 * ページのメタデータを分析する
 *
 * @param pages ページの一覧
 */
function analyzePageMetadata(pages) {
    if (pages.length === 0) {
        console.log('[analyzePageMetadata] No pages to analyze');
        return;
    }
    console.log(`\n[analyzePageMetadata] Analyzing metadata for ${pages.length} pages`);
    // 最初のページの構造を表示
    const firstPage = pages[0];
    console.log('\n[analyzePageMetadata] First page structure:');
    console.log(JSON.stringify(firstPage, null, 2));
    // すべてのページのメタデータフィールドを確認
    const metadataFields = new Set();
    pages.forEach(page => {
        if (page.metadata) {
            Object.keys(page.metadata).forEach(key => metadataFields.add(key));
        }
    });
    console.log(`\n[analyzePageMetadata] Metadata fields found: ${Array.from(metadataFields).join(', ')}`);
    // ラベルの確認
    const hasLabels = pages.some(page => page.labels && page.labels.results && page.labels.results.length > 0);
    console.log(`[analyzePageMetadata] Pages contain labels: ${hasLabels ? 'Yes' : 'No'}`);
    if (hasLabels) {
        console.log('\n[analyzePageMetadata] Labels found in pages:');
        pages.forEach((page, index) => {
            console.log(`\nPage #${index + 1}: ${page.title} (ID: ${page.id})`);
            if (page.labels && page.labels.results && page.labels.results.length > 0) {
                console.log(`- Labels (${page.labels.results.length}):`);
                page.labels.results.forEach((label) => {
                    console.log(`  - ${label.name} (${label.prefix})`);
                });
            }
            else {
                console.log('- No labels');
            }
        });
    }
    // スペース情報の確認
    const hasSpaceInfo = pages.some(page => page.space);
    console.log(`\n[analyzePageMetadata] Pages contain space information: ${hasSpaceInfo ? 'Yes' : 'No'}`);
    if (hasSpaceInfo) {
        const spaceKeys = new Set();
        pages.forEach(page => {
            if (page.space && page.space.key) {
                spaceKeys.add(page.space.key);
            }
        });
        console.log(`[analyzePageMetadata] Space keys found: ${Array.from(spaceKeys).join(', ')}`);
    }
    // バージョン情報の確認
    const hasVersionInfo = pages.some(page => page.version);
    console.log(`\n[analyzePageMetadata] Pages contain version information: ${hasVersionInfo ? 'Yes' : 'No'}`);
    // その他のメタデータの確認
    console.log('\n[analyzePageMetadata] Other metadata fields:');
    metadataFields.forEach(field => {
        const pagesWithField = pages.filter(page => page.metadata && page.metadata[field]);
        if (pagesWithField.length > 0) {
            console.log(`\nField: ${field} (found in ${pagesWithField.length} pages)`);
            // フィールドの値の例を表示
            const firstPageWithField = pagesWithField[0];
            console.log(`- Example value: ${JSON.stringify(firstPageWithField.metadata[field])}`);
        }
    });
}
/**
 * ページの詳細メタデータを分析する
 *
 * @param pageDetails ページの詳細
 */
function analyzePageDetailMetadata(pageDetails) {
    if (!pageDetails) {
        console.log('[analyzePageDetailMetadata] No page details to analyze');
        return;
    }
    console.log(`\n[analyzePageDetailMetadata] Analyzing detailed metadata for page ${pageDetails.id}`);
    // メタデータの確認
    if (pageDetails.metadata) {
        console.log('\n[analyzePageDetailMetadata] Metadata:');
        console.log(JSON.stringify(pageDetails.metadata, null, 2));
    }
    else {
        console.log('\n[analyzePageDetailMetadata] No metadata found');
    }
    // ラベルの確認
    if (pageDetails.labels && pageDetails.labels.results && pageDetails.labels.results.length > 0) {
        console.log(`\n[analyzePageDetailMetadata] Labels (${pageDetails.labels.results.length}):`);
        pageDetails.labels.results.forEach((label) => {
            console.log(`- ${label.name} (${label.prefix})`);
        });
    }
    else {
        console.log('\n[analyzePageDetailMetadata] No labels found');
    }
    // スペース情報の確認
    if (pageDetails.space) {
        console.log('\n[analyzePageDetailMetadata] Space information:');
        console.log(JSON.stringify(pageDetails.space, null, 2));
    }
    else {
        console.log('\n[analyzePageDetailMetadata] No space information found');
    }
    // 先祖ページの確認
    if (pageDetails.ancestors && pageDetails.ancestors.length > 0) {
        console.log(`\n[analyzePageDetailMetadata] Ancestors (${pageDetails.ancestors.length}):`);
        pageDetails.ancestors.forEach((ancestor) => {
            console.log(`- ${ancestor.title} (ID: ${ancestor.id})`);
        });
    }
    else {
        console.log('\n[analyzePageDetailMetadata] No ancestors found');
    }
    // 子ページの確認
    if (pageDetails.children && pageDetails.children.page && pageDetails.children.page.results && pageDetails.children.page.results.length > 0) {
        console.log(`\n[analyzePageDetailMetadata] Child pages (${pageDetails.children.page.results.length}):`);
        pageDetails.children.page.results.forEach((child) => {
            console.log(`- ${child.title} (ID: ${child.id})`);
        });
    }
    else {
        console.log('\n[analyzePageDetailMetadata] No child pages found');
    }
    // 履歴情報の確認
    if (pageDetails.history) {
        console.log('\n[analyzePageDetailMetadata] History information:');
        console.log(JSON.stringify(pageDetails.history, null, 2));
    }
    else {
        console.log('\n[analyzePageDetailMetadata] No history information found');
    }
    // 拡張情報の確認
    if (pageDetails.extensions) {
        console.log('\n[analyzePageDetailMetadata] Extensions:');
        console.log(JSON.stringify(pageDetails.extensions, null, 2));
    }
    else {
        console.log('\n[analyzePageDetailMetadata] No extensions found');
    }
}
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== Confluence APIのメタデータ確認テスト開始 =====');
        // 環境変数の読み込み
        loadEnv();
        // Confluence APIからページの一覧を取得
        console.log('\n1. Confluence APIからページの一覧を取得');
        const pages = await getConfluencePages(10);
        // ページのメタデータを分析
        console.log('\n2. ページのメタデータを分析');
        analyzePageMetadata(pages);
        // 最初のページの詳細を取得して分析
        if (pages.length > 0) {
            console.log('\n3. 最初のページの詳細を取得して分析');
            const pageDetails = await getConfluencePageDetails(pages[0].id);
            analyzePageDetailMetadata(pageDetails);
        }
        console.log('\n===== Confluence APIのメタデータ確認テスト完了 =====');
    }
    catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-confluence-metadata.js.map