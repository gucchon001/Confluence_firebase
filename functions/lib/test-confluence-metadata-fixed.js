"use strict";
/**
 * ConfluenceAPIから取得できるメタデータを確認するテスト（修正版）
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
/**
 * Confluence APIからページの一覧を取得する
 *
 * @param limit 取得するページ数
 * @returns ページの一覧
 */
async function getConfluencePages(limit = 10) {
    try {
        console.log(`[getConfluencePages] Fetching ${limit} pages from Confluence API`);
        // 環境変数を直接指定
        const baseUrl = 'https://tomonokai.atlassian.net';
        const username = 'yohay@tomonokai.jp';
        const apiToken = 'ATATT3xFfGF0Rw5Y0Qp-gSxkKJBJo_Zr9ZZvAeWG8GUVbdWb9UVnOYQUwcZZzDRCmcQTbDxGTvhfJnFbcxGlsGWoHMaKTUNdTHpFDcJdFQxRLMZOkQeqJGwlYzNxJXb4Fy6Yx1Ib3LBZmWCQQWvJrKEKQYWjzDHuP9xGfkOBdwGu-_gUBDU6-JA=0A19F6C7';
        const spaceKey = 'TOMONOKAIJUKU';
        // ページの一覧を取得するエンドポイント（修正版）
        const endpoint = `${baseUrl}/rest/api/content`;
        console.log(`[getConfluencePages] Using endpoint: ${endpoint}`);
        console.log(`[getConfluencePages] Using space key: ${spaceKey}`);
        // APIリクエストを送信
        const response = await axios_1.default.get(endpoint, {
            params: {
                spaceKey,
                type: 'page',
                expand: 'metadata.labels,version,space',
                limit
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
        // 環境変数を直接指定
        const baseUrl = 'https://tomonokai.atlassian.net';
        const username = 'yohay@tomonokai.jp';
        const apiToken = 'ATATT3xFfGF0Rw5Y0Qp-gSxkKJBJo_Zr9ZZvAeWG8GUVbdWb9UVnOYQUwcZZzDRCmcQTbDxGTvhfJnFbcxGlsGWoHMaKTUNdTHpFDcJdFQxRLMZOkQeqJGwlYzNxJXb4Fy6Yx1Ib3LBZmWCQQWvJrKEKQYWjzDHuP9xGfkOBdwGu-_gUBDU6-JA=0A19F6C7';
        // ページの詳細を取得するエンドポイント（修正版）
        const endpoint = `${baseUrl}/rest/api/content/${pageId}`;
        console.log(`[getConfluencePageDetails] Using endpoint: ${endpoint}`);
        // APIリクエストを送信
        const response = await axios_1.default.get(endpoint, {
            params: {
                expand: 'metadata,labels,version,space,ancestors,children.page'
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
    const hasLabels = pages.some(page => { var _a, _b; return ((_b = (_a = page.metadata) === null || _a === void 0 ? void 0 : _a.labels) === null || _b === void 0 ? void 0 : _b.results) && page.metadata.labels.results.length > 0; });
    console.log(`[analyzePageMetadata] Pages contain labels: ${hasLabels ? 'Yes' : 'No'}`);
    if (hasLabels) {
        console.log('\n[analyzePageMetadata] Labels found in pages:');
        pages.forEach((page, index) => {
            var _a, _b;
            console.log(`\nPage #${index + 1}: ${page.title} (ID: ${page.id})`);
            if (((_b = (_a = page.metadata) === null || _a === void 0 ? void 0 : _a.labels) === null || _b === void 0 ? void 0 : _b.results) && page.metadata.labels.results.length > 0) {
                console.log(`- Labels (${page.metadata.labels.results.length}):`);
                page.metadata.labels.results.forEach((label) => {
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
    var _a, _b;
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
    if (((_b = (_a = pageDetails.metadata) === null || _a === void 0 ? void 0 : _a.labels) === null || _b === void 0 ? void 0 : _b.results) && pageDetails.metadata.labels.results.length > 0) {
        console.log(`\n[analyzePageDetailMetadata] Labels (${pageDetails.metadata.labels.results.length}):`);
        pageDetails.metadata.labels.results.forEach((label) => {
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
}
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== Confluence APIのメタデータ確認テスト開始（修正版） =====');
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
//# sourceMappingURL=test-confluence-metadata-fixed.js.map