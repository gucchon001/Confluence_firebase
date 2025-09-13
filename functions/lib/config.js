"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vertexai = exports.confluence = void 0;
/**
 * アプリケーション設定
 */
const appConfig = {
    confluence: {
        base_url: 'https://giginc.atlassian.net',
        user_email: 'kanri@jukust.jp',
        api_token: 'API_TOKEN_PLACEHOLDER', // 環境変数から取得するか、安全な方法で提供する必要があります
        space_key: 'CLIENTTOMO'
    },
    vertexai: {
        project_id: 'confluence-copilot-ppjye',
        numeric_project_id: '122015916118',
        storage_bucket: '122015916118-vector-search',
        index_id: '7360896096425476096',
        index_endpoint_id: 'confluence-vector-endpoint',
        endpoint_id: '1435927001503367168',
        deployed_index_id: 'confluence_embeddings_endp_1757347487752',
        location: 'asia-northeast1'
    }
};
/**
 * 設定をエクスポート
 */
exports.confluence = appConfig.confluence;
exports.vertexai = appConfig.vertexai;
//# sourceMappingURL=config.js.map