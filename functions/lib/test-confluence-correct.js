"use strict";
/**
 * 正しいConfluence API設定を使用した疎通テスト
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
/**
 * Confluenceの基本情報を取得する
 */
async function testConfluenceConnection() {
    var _a, _b;
    try {
        console.log('[testConfluenceConnection] Starting basic connectivity test with correct settings');
        // 正しい環境変数を直接指定
        const baseUrl = 'https://giginc.atlassian.net';
        const username = 'kanri@jukust.jp';
        const apiToken = 'API_TOKEN_PLACEHOLDER'; // 環境変数から取得するか、安全な方法で提供する必要があります
        const spaceKey = 'CLIENTTOMO';
        console.log(`[testConfluenceConnection] Base URL: ${baseUrl}`);
        console.log(`[testConfluenceConnection] Space Key: ${spaceKey}`);
        // 1. スペース一覧の取得
        const spacesEndpoint = `${baseUrl}/wiki/rest/api/space`;
        console.log(`\n[testConfluenceConnection] Testing spaces endpoint: ${spacesEndpoint}`);
        try {
            const spacesResponse = await axios_1.default.get(spacesEndpoint, {
                auth: {
                    username,
                    password: apiToken
                }
            });
            console.log(`[testConfluenceConnection] Spaces endpoint response status: ${spacesResponse.status}`);
            console.log(`[testConfluenceConnection] Spaces found: ${((_a = spacesResponse.data.results) === null || _a === void 0 ? void 0 : _a.length) || 0}`);
            if (spacesResponse.data.results && spacesResponse.data.results.length > 0) {
                console.log('[testConfluenceConnection] First space details:');
                console.log(`- Key: ${spacesResponse.data.results[0].key}`);
                console.log(`- Name: ${spacesResponse.data.results[0].name}`);
            }
        }
        catch (spacesError) {
            console.error('[testConfluenceConnection] Error accessing spaces endpoint:', spacesError.message);
            if (spacesError.response) {
                console.error('[testConfluenceConnection] Response status:', spacesError.response.status);
                console.error('[testConfluenceConnection] Response data:', spacesError.response.data);
            }
        }
        // 2. 特定のスペースのページ一覧を取得
        const contentEndpoint = `${baseUrl}/wiki/rest/api/content`;
        console.log(`\n[testConfluenceConnection] Testing content endpoint for space ${spaceKey}: ${contentEndpoint}`);
        try {
            const contentResponse = await axios_1.default.get(contentEndpoint, {
                params: {
                    spaceKey,
                    expand: 'metadata.labels,version,space',
                    limit: 10
                },
                auth: {
                    username,
                    password: apiToken
                }
            });
            console.log(`[testConfluenceConnection] Content endpoint response status: ${contentResponse.status}`);
            console.log(`[testConfluenceConnection] Pages found: ${((_b = contentResponse.data.results) === null || _b === void 0 ? void 0 : _b.length) || 0}`);
            if (contentResponse.data.results && contentResponse.data.results.length > 0) {
                console.log('[testConfluenceConnection] First page details:');
                console.log(`- ID: ${contentResponse.data.results[0].id}`);
                console.log(`- Title: ${contentResponse.data.results[0].title}`);
                // メタデータの確認
                if (contentResponse.data.results[0].metadata) {
                    console.log('[testConfluenceConnection] Metadata found in first page');
                    console.log(JSON.stringify(contentResponse.data.results[0].metadata, null, 2));
                    // ラベルの確認
                    if (contentResponse.data.results[0].metadata.labels &&
                        contentResponse.data.results[0].metadata.labels.results &&
                        contentResponse.data.results[0].metadata.labels.results.length > 0) {
                        console.log('[testConfluenceConnection] Labels found:');
                        contentResponse.data.results[0].metadata.labels.results.forEach((label) => {
                            console.log(`- ${label.name} (${label.prefix})`);
                        });
                    }
                    else {
                        console.log('[testConfluenceConnection] No labels found in first page');
                    }
                }
                else {
                    console.log('[testConfluenceConnection] No metadata found in first page');
                }
                // 最初のページの詳細を取得
                const pageId = contentResponse.data.results[0].id;
                await getPageDetails(baseUrl, pageId, username, apiToken);
            }
        }
        catch (contentError) {
            console.error('[testConfluenceConnection] Error accessing content endpoint:', contentError.message);
            if (contentError.response) {
                console.error('[testConfluenceConnection] Response status:', contentError.response.status);
                console.error('[testConfluenceConnection] Response data:', contentError.response.data);
            }
        }
    }
    catch (error) {
        console.error('[testConfluenceConnection] General error:', error.message);
    }
}
/**
 * ページの詳細を取得する
 */
async function getPageDetails(baseUrl, pageId, username, apiToken) {
    var _a, _b, _c;
    try {
        console.log(`\n[getPageDetails] Getting details for page ${pageId}`);
        const pageEndpoint = `${baseUrl}/wiki/rest/api/content/${pageId}`;
        console.log(`[getPageDetails] Endpoint: ${pageEndpoint}`);
        const response = await axios_1.default.get(pageEndpoint, {
            params: {
                expand: 'body.storage,metadata,labels,version,space,ancestors'
            },
            auth: {
                username,
                password: apiToken
            }
        });
        console.log(`[getPageDetails] Response status: ${response.status}`);
        console.log('[getPageDetails] Page details:');
        console.log(`- ID: ${response.data.id}`);
        console.log(`- Title: ${response.data.title}`);
        console.log(`- Type: ${response.data.type}`);
        console.log(`- Space key: ${(_a = response.data.space) === null || _a === void 0 ? void 0 : _a.key}`);
        console.log(`- Version: ${(_b = response.data.version) === null || _b === void 0 ? void 0 : _b.number}`);
        console.log(`- Last updated: ${(_c = response.data.version) === null || _c === void 0 ? void 0 : _c.when}`);
        // メタデータの確認
        if (response.data.metadata) {
            console.log('\n[getPageDetails] Metadata:');
            console.log(JSON.stringify(response.data.metadata, null, 2));
        }
        // ラベルの確認
        if (response.data.labels && response.data.labels.results && response.data.labels.results.length > 0) {
            console.log('\n[getPageDetails] Labels:');
            response.data.labels.results.forEach((label) => {
                console.log(`- ${label.name} (${label.prefix})`);
            });
        }
        // 本文の先頭部分を表示（長すぎる場合は省略）
        if (response.data.body && response.data.body.storage && response.data.body.storage.value) {
            const content = response.data.body.storage.value;
            console.log('\n[getPageDetails] Content preview (first 200 chars):');
            console.log(content.substring(0, 200) + (content.length > 200 ? '...' : ''));
        }
    }
    catch (error) {
        console.error(`[getPageDetails] Error getting page details for ${pageId}:`, error.message);
        if (error.response) {
            console.error('[getPageDetails] Response status:', error.response.status);
            console.error('[getPageDetails] Response data:', error.response.data);
        }
    }
}
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== Confluence API正しい設定での疎通テスト開始 =====');
        await testConfluenceConnection();
        console.log('\n===== Confluence API正しい設定での疎通テスト完了 =====');
    }
    catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-confluence-correct.js.map