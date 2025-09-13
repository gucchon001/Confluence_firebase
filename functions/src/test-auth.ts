/**
 * 認証トークン取得プロセスのテスト
 */

import { GoogleAuth } from 'google-auth-library';

/**
 * Google Cloud認証情報を取得する
 * 
 * @returns アクセストークン
 */
async function getGoogleCloudToken(): Promise<string> {
  try {
    console.log('[getGoogleCloudToken] Starting token acquisition process');
    
    // 環境変数の確認
    console.log('[getGoogleCloudToken] GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
    // Cloud Functions環境の場合はデフォルト認証情報を使用
    // ローカル開発環境の場合はGOOGLE_APPLICATION_CREDENTIALSで設定した認証情報を使用
    const auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    
    console.log('[getGoogleCloudToken] GoogleAuth instance created');
    
    const client = await auth.getClient();
    console.log('[getGoogleCloudToken] Auth client obtained');
    
    const projectId = await auth.getProjectId();
    console.log('[getGoogleCloudToken] Project ID:', projectId);
    
    const token = await client.getAccessToken();
    console.log('[getGoogleCloudToken] Access token obtained successfully');
    
    // トークンの一部を表示（セキュリティのため全体は表示しない）
    if (token && token.token) {
      const tokenPreview = token.token.substring(0, 10) + '...' + token.token.substring(token.token.length - 5);
      console.log('[getGoogleCloudToken] Token preview:', tokenPreview);
    } else {
      console.log('[getGoogleCloudToken] Token is null or undefined');
    }
    
    return token.token || '';
  } catch (error: any) {
    console.error('[getGoogleCloudToken] Error getting Google Cloud token:', error);
    
    // エラーの詳細情報を出力
    if (error.response) {
      console.error('[getGoogleCloudToken] API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    throw new Error(`Failed to get Google Cloud token: ${error.message}`);
  }
}

/**
 * Vector Search APIのエンドポイントURLを構築
 */
function buildEndpointUrl(): string {
  // 環境変数から設定値を取得
  const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
  const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
  const endpointId = process.env.VERTEX_AI_ENDPOINT_ID || '1435927001503367168';
  
  // エンドポイントURLの構築
  const endpoint = `https://663364514.${location}-${projectId}.vdb.vertexai.goog/v1/projects/${projectId}/locations/${location}/indexEndpoints/${endpointId}:findNeighbors`;
  
  return endpoint;
}

/**
 * メイン関数
 */
async function main() {
  try {
    console.log('===== 認証テスト開始 =====');
    
    // 環境変数の表示
    console.log('環境変数:');
    console.log('- VERTEX_AI_PROJECT_ID:', process.env.VERTEX_AI_PROJECT_ID);
    console.log('- VERTEX_AI_LOCATION:', process.env.VERTEX_AI_LOCATION);
    console.log('- VERTEX_AI_INDEX_ID:', process.env.VERTEX_AI_INDEX_ID);
    console.log('- VERTEX_AI_ENDPOINT_ID:', process.env.VERTEX_AI_ENDPOINT_ID);
    console.log('- VERTEX_AI_DEPLOYED_INDEX_ID:', process.env.VERTEX_AI_DEPLOYED_INDEX_ID);
    console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
    // 認証トークンの取得
    console.log('\n1. 認証トークンの取得テスト');
    const token = await getGoogleCloudToken();
    console.log('認証トークン取得成功');
    
    // エンドポイントURLの構築
    console.log('\n2. エンドポイントURLの構築テスト');
    const endpoint = buildEndpointUrl();
    console.log('エンドポイントURL:', endpoint);
    
    console.log('\n===== 認証テスト完了 =====');
  } catch (error: any) {
    console.error('テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
main();
