/**
 * 環境・データソース判定ユーティリティ
 * 会話履歴・出力結果・参照元・管理画面で共通使用
 */

// 環境型定義
export type Environment = 'development' | 'staging' | 'production';

// データソース型定義
export type DataSource = 'confluence' | 'jira' | 'mixed' | 'unknown';

// 参照元の型定義
export interface SourceReference {
  url?: string;
  dataSource?: string;
  source?: string;
}

// PostLogの型定義（部分）
export interface PostLogMetadata {
  environment?: Environment;
  dataSource?: DataSource;
}

export interface PostLogReference {
  url?: string;
  dataSource?: string;
}

/**
 * 環境を判定する（PostLogのmetadataから取得、またはホスト名から推測）
 */
export function getEnvironment(
  metadata?: PostLogMetadata,
  hostname?: string
): Environment {
  // metadataから環境を取得（最優先）
  if (metadata?.environment) {
    return metadata.environment;
  }

  // ホスト名から判定
  const host = hostname || (typeof window !== 'undefined' ? window.location.hostname : '');
  if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('dev')) {
    return 'development';
  }
  if (host.includes('staging') || host.includes('stg')) {
    return 'staging';
  }

  // デフォルトは本番環境
  return 'production';
}

/**
 * 環境を判定する（sourcesから推測、主にクライアント側で使用）
 * @deprecated 可能であればgetEnvironmentを使用してください
 */
export function getEnvironmentFromSources(
  sources?: Array<{ url?: string }>,
  hostname?: string
): Environment {
  // ホスト名から判定（sourcesに環境情報は含まれていないため）
  const host = hostname || (typeof window !== 'undefined' ? window.location.hostname : '');
  if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('dev')) {
    return 'development';
  }
  if (host.includes('staging') || host.includes('stg')) {
    return 'staging';
  }

  return 'production';
}

/**
 * データソースを判定する（PostLogのmetadataから取得、またはreferencesから推測）
 */
export function getDataSource(
  metadata?: PostLogMetadata,
  references?: PostLogReference[]
): DataSource {
  // metadataからデータソースを取得（最優先）
  if (metadata?.dataSource) {
    return metadata.dataSource as DataSource;
  }

  // referencesから判定
  if (references && references.length > 0) {
    return getDataSourceFromSources(references);
  }

  return 'unknown';
}

/**
 * データソースを判定する（sources/referencesから推測）
 */
export function getDataSourceFromSources(
  sources?: Array<SourceReference>
): DataSource {
  if (!sources || sources.length === 0) {
    return 'unknown';
  }

  // dataSourceフィールドを優先的に使用
  const dataSources = sources
    .map(s => s.dataSource)
    .filter((ds): ds is 'confluence' | 'jira' => ds === 'confluence' || ds === 'jira');

  if (dataSources.length > 0) {
    const uniqueDataSources = new Set(dataSources);
    if (uniqueDataSources.size > 1) {
      return 'mixed';
    }
    return uniqueDataSources.values().next().value || 'unknown';
  }

  // dataSourceフィールドがない場合はURLから判定（後方互換性のため）
  const hasConfluence = sources.some(source =>
    source.url && (source.url.includes('confluence') || source.url.includes('atlassian.net'))
  );
  const hasJira = sources.some(source =>
    source.url && (source.url.includes('jira') || source.url.includes('atlassian.net/jira'))
  );

  if (hasConfluence && hasJira) {
    return 'mixed';
  }
  if (hasConfluence) {
    return 'confluence';
  }
  if (hasJira) {
    return 'jira';
  }

  return 'unknown';
}

/**
 * 環境の色クラスを取得
 */
export function getEnvironmentColor(env: Environment): string {
  switch (env) {
    case 'development':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'staging':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'production':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

/**
 * データソースの色クラスを取得
 */
export function getDataSourceColor(source: DataSource): string {
  switch (source) {
    case 'confluence':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'jira':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'mixed':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'unknown':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

/**
 * 環境の表示名を取得
 */
export function getEnvironmentName(env: Environment): string {
  switch (env) {
    case 'development':
      return '開発環境';
    case 'staging':
      return 'ステージング';
    case 'production':
      return '本番環境';
    default:
      return '不明';
  }
}

/**
 * データソースの表示名を取得
 */
export function getDataSourceName(source: DataSource): string {
  switch (source) {
    case 'confluence':
      return 'Confluence';
    case 'jira':
      return 'Jira';
    case 'mixed':
      return 'Confluence + Jira';
    case 'unknown':
      return '不明';
    default:
      return '不明';
  }
}

