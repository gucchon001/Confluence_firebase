/**
 * デプロイ情報を管理するモジュール
 * デプロイ時刻を取得してBOM検出ログに含める
 */

/**
 * デプロイ時刻を取得
 * @returns デプロイ時刻（ISO形式）またはnull
 */
export function getDeploymentTime(): string | null {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__DEPLOYMENT_TIME__) {
    return (globalThis as any).__DEPLOYMENT_TIME__ as string;
  }
  return null;
}

/**
 * デプロイタイムスタンプを取得
 * @returns デプロイタイムスタンプ（ミリ秒）またはnull
 */
export function getDeploymentTimestamp(): number | null {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__DEPLOYMENT_TIMESTAMP__) {
    return (globalThis as any).__DEPLOYMENT_TIMESTAMP__ as number;
  }
  return null;
}

/**
 * デプロイ情報を取得（ログ用）
 * @returns デプロイ情報オブジェクト
 */
export function getDeploymentInfo(): {
  deploymentTime: string | null;
  deploymentTimestamp: number | null;
  uptime: number | null;
} {
  const deploymentTime = getDeploymentTime();
  const deploymentTimestamp = getDeploymentTimestamp();
  const uptime = deploymentTimestamp ? Date.now() - deploymentTimestamp : null;
  
  return {
    deploymentTime,
    deploymentTimestamp,
    uptime
  };
}

