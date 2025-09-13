"use strict";
/**
 * Confluence APIの代替エンドポイントを使用した疎通テスト
 *
 * 異なるエンドポイント形式を試す
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
/**
 * Confluenceの基本情報を取得する（代替エンドポイント）
 */
async function testAlternativeEndpoints() {
    try {
        console.log('[testAlternativeEndpoints] Starting alternative endpoints test');
        // 環境変数を直接指定
        const username = 'yohay@tomonokai.jp';
        const apiToken = 'ATATT3xFfGF0Rw5Y0Qp-gSxkKJBJo_Zr9ZZvAeWG8GUVbdWb9UVnOYQUwcZZzDRCmcQTbDxGTvhfJnFbcxGlsGWoHMaKTUNdTHpFDcJdFQxRLMZOkQeqJGwlYzNxJXb4Fy6Yx1Ib3LBZmWCQQWvJrKEKQYWjzDHuP9xGfkOBdwGu-_gUBDU6-JA=0A19F6C7';
        // 代替ベースURLを試す
        const alternativeBaseUrls = [
            'https://tomonokai.atlassian.net',
            'https://tomonokai.atlassian.net/wiki',
            'https://tomonokai.atlassian.net/confluence'
        ];
        // 各ベースURLに対してテスト
        for (const baseUrl of alternativeBaseUrls) {
            console.log(`\n[testAlternativeEndpoints] Testing base URL: ${baseUrl}`);
            // 1. APIルートエンドポイント
            const apiEndpoints = [
                `${baseUrl}/rest/api`,
                `${baseUrl}/api/v2`
            ];
            for (const endpoint of apiEndpoints) {
                try {
                    console.log(`[testAlternativeEndpoints] Testing API endpoint: ${endpoint}`);
                    const response = await axios_1.default.get(endpoint, {
                        auth: {
                            username,
                            password: apiToken
                        },
                        timeout: 5000 // 5秒でタイムアウト
                    });
                    console.log(`[testAlternativeEndpoints] Success! Status: ${response.status}`);
                    console.log(`[testAlternativeEndpoints] Response data:`, response.data);
                    // 成功したエンドポイントを記録
                    console.log(`[testAlternativeEndpoints] ✅ Working endpoint found: ${endpoint}`);
                }
                catch (error) {
                    console.log(`[testAlternativeEndpoints] Error with endpoint ${endpoint}:`, error.message);
                    if (error.response) {
                        console.log(`[testAlternativeEndpoints] Status: ${error.response.status}`);
                        console.log(`[testAlternativeEndpoints] Data:`, error.response.data);
                    }
                }
            }
        }
        // 2. Jiraのエンドポイントも試す
        console.log('\n[testAlternativeEndpoints] Testing Jira endpoints');
        const jiraEndpoints = [
            'https://tomonokai.atlassian.net/rest/api/2/project',
            'https://tomonokai.atlassian.net/rest/api/3/myself'
        ];
        for (const endpoint of jiraEndpoints) {
            try {
                console.log(`[testAlternativeEndpoints] Testing Jira endpoint: ${endpoint}`);
                const response = await axios_1.default.get(endpoint, {
                    auth: {
                        username,
                        password: apiToken
                    },
                    timeout: 5000 // 5秒でタイムアウト
                });
                console.log(`[testAlternativeEndpoints] Success! Status: ${response.status}`);
                console.log(`[testAlternativeEndpoints] Response data available`);
                // 成功したエンドポイントを記録
                console.log(`[testAlternativeEndpoints] ✅ Working Jira endpoint found: ${endpoint}`);
            }
            catch (error) {
                console.log(`[testAlternativeEndpoints] Error with Jira endpoint ${endpoint}:`, error.message);
                if (error.response) {
                    console.log(`[testAlternativeEndpoints] Status: ${error.response.status}`);
                    console.log(`[testAlternativeEndpoints] Data:`, error.response.data);
                }
            }
        }
        // 3. クラウドIDを使用したエンドポイント
        console.log('\n[testAlternativeEndpoints] Testing with cloud ID');
        // クラウドIDのリスト（一般的なものを試す）
        const cloudIds = ['tomonokai'];
        for (const cloudId of cloudIds) {
            const cloudEndpoint = `https://api.atlassian.com/ex/confluence/${cloudId}/rest/api/space`;
            try {
                console.log(`[testAlternativeEndpoints] Testing cloud endpoint: ${cloudEndpoint}`);
                const response = await axios_1.default.get(cloudEndpoint, {
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`,
                        'Accept': 'application/json'
                    },
                    timeout: 5000 // 5秒でタイムアウト
                });
                console.log(`[testAlternativeEndpoints] Success! Status: ${response.status}`);
                console.log(`[testAlternativeEndpoints] Response data available`);
                // 成功したエンドポイントを記録
                console.log(`[testAlternativeEndpoints] ✅ Working cloud endpoint found: ${cloudEndpoint}`);
            }
            catch (error) {
                console.log(`[testAlternativeEndpoints] Error with cloud endpoint ${cloudEndpoint}:`, error.message);
                if (error.response) {
                    console.log(`[testAlternativeEndpoints] Status: ${error.response.status}`);
                    console.log(`[testAlternativeEndpoints] Data:`, error.response.data);
                }
            }
        }
    }
    catch (error) {
        console.error('[testAlternativeEndpoints] General error:', error.message);
    }
}
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== Confluence API代替エンドポイントテスト開始 =====');
        await testAlternativeEndpoints();
        console.log('\n===== Confluence API代替エンドポイントテスト完了 =====');
    }
    catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-confluence-alternative.js.map