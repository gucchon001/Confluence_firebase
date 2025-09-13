"use strict";
/**
 * Confluence APIの基本的な疎通テスト
 *
 * 最も単純なエンドポイントにアクセスして接続を確認する
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
    var _a;
    try {
        console.log('[testConfluenceConnection] Starting basic connectivity test');
        // 環境変数を直接指定
        const baseUrl = 'https://tomonokai.atlassian.net';
        const username = 'yohay@tomonokai.jp';
        const apiToken = 'ATATT3xFfGF0Rw5Y0Qp-gSxkKJBJo_Zr9ZZvAeWG8GUVbdWb9UVnOYQUwcZZzDRCmcQTbDxGTvhfJnFbcxGlsGWoHMaKTUNdTHpFDcJdFQxRLMZOkQeqJGwlYzNxJXb4Fy6Yx1Ib3LBZmWCQQWvJrKEKQYWjzDHuP9xGfkOBdwGu-_gUBDU6-JA=0A19F6C7';
        console.log(`[testConfluenceConnection] Base URL: ${baseUrl}`);
        // 1. スペース一覧の取得（最も基本的なエンドポイント）
        const spacesEndpoint = `${baseUrl}/rest/api/space`;
        console.log(`[testConfluenceConnection] Testing spaces endpoint: ${spacesEndpoint}`);
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
        // 2. サーバー情報の取得（さらに基本的なエンドポイント）
        const serverInfoEndpoint = `${baseUrl}/rest/api/serverInfo`;
        console.log(`\n[testConfluenceConnection] Testing server info endpoint: ${serverInfoEndpoint}`);
        try {
            const serverInfoResponse = await axios_1.default.get(serverInfoEndpoint, {
                auth: {
                    username,
                    password: apiToken
                }
            });
            console.log(`[testConfluenceConnection] Server info endpoint response status: ${serverInfoResponse.status}`);
            console.log('[testConfluenceConnection] Server info:');
            console.log(`- Base URL: ${serverInfoResponse.data.baseUrl}`);
            console.log(`- Version: ${serverInfoResponse.data.version}`);
            console.log(`- Build Number: ${serverInfoResponse.data.buildNumber}`);
        }
        catch (serverInfoError) {
            console.error('[testConfluenceConnection] Error accessing server info endpoint:', serverInfoError.message);
            if (serverInfoError.response) {
                console.error('[testConfluenceConnection] Response status:', serverInfoError.response.status);
                console.error('[testConfluenceConnection] Response data:', serverInfoError.response.data);
            }
        }
        // 3. 認証ユーザー情報の取得
        const currentUserEndpoint = `${baseUrl}/rest/api/user/current`;
        console.log(`\n[testConfluenceConnection] Testing current user endpoint: ${currentUserEndpoint}`);
        try {
            const currentUserResponse = await axios_1.default.get(currentUserEndpoint, {
                auth: {
                    username,
                    password: apiToken
                }
            });
            console.log(`[testConfluenceConnection] Current user endpoint response status: ${currentUserResponse.status}`);
            console.log('[testConfluenceConnection] Current user info:');
            console.log(`- Username: ${currentUserResponse.data.username}`);
            console.log(`- Display Name: ${currentUserResponse.data.displayName}`);
            console.log(`- Email: ${currentUserResponse.data.email}`);
        }
        catch (currentUserError) {
            console.error('[testConfluenceConnection] Error accessing current user endpoint:', currentUserError.message);
            if (currentUserError.response) {
                console.error('[testConfluenceConnection] Response status:', currentUserError.response.status);
                console.error('[testConfluenceConnection] Response data:', currentUserError.response.data);
            }
        }
        // 4. 最もシンプルなエンドポイント（ルート）
        const rootEndpoint = `${baseUrl}/rest/api`;
        console.log(`\n[testConfluenceConnection] Testing root API endpoint: ${rootEndpoint}`);
        try {
            const rootResponse = await axios_1.default.get(rootEndpoint, {
                auth: {
                    username,
                    password: apiToken
                }
            });
            console.log(`[testConfluenceConnection] Root endpoint response status: ${rootResponse.status}`);
            console.log('[testConfluenceConnection] Root API info available');
        }
        catch (rootError) {
            console.error('[testConfluenceConnection] Error accessing root endpoint:', rootError.message);
            if (rootError.response) {
                console.error('[testConfluenceConnection] Response status:', rootError.response.status);
                console.error('[testConfluenceConnection] Response data:', rootError.response.data);
            }
        }
    }
    catch (error) {
        console.error('[testConfluenceConnection] General error:', error.message);
    }
}
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== Confluence API基本疎通テスト開始 =====');
        await testConfluenceConnection();
        console.log('\n===== Confluence API基本疎通テスト完了 =====');
    }
    catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-confluence-simple.js.map