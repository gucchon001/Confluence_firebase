/**
 * アプリケーション設定
 */
interface AppConfig {
  confluence?: {
    base_url: string;
    user_email: string;
    api_token: string;
    space_key: string;
  };
  vertexai?: {
    project_id: string;
    numeric_project_id: string;
    storage_bucket: string;
    index_id: string;
    index_endpoint_id: string;
    endpoint_id: string;
    deployed_index_id: string;
    location: string;
  };
}

/**
 * アプリケーション設定
 */
const appConfig: AppConfig = {
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
export const confluence = appConfig.confluence;
export const vertexai = appConfig.vertexai;