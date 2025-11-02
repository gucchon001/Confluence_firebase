/**
 * LanceDB拡張スキーマ定義
 * Phase 0A-2: StructuredLabel統合
 * 
 * Firestoreの`structured_labels`をLanceDBに統合し、
 * 高度なフィルタリングとスコアリングを実現
 */

import * as arrow from 'apache-arrow';

/**
 * LanceDB拡張スキーマ（StructuredLabel統合版）
 * 
 * 設計原則:
 * - Firestoreの`StructuredLabel`をフラット化してLanceDBに保存
 * - 既存の`labels: string[]`は互換性のため保持
 * - すべてのStructuredLabelフィールドに`structured_`プレフィックスを付与
 */
export const EXTENDED_LANCEDB_SCHEMA = new arrow.Schema([
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 基本フィールド
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  new arrow.Field('id', new arrow.Utf8(), false),                          // レコードID
  new arrow.Field('page_id', new arrow.Int64(), false),                    // ConfluenceページID（数値型）- pageIdからpage_idに変更（スカラーインデックス対応）
  new arrow.Field('title', new arrow.Utf8(), false),                       // ページタイトル
  new arrow.Field('content', new arrow.Utf8(), false),                     // ページ本文
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ベクトル検索
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  new arrow.Field(
    'vector',
    new arrow.FixedSizeList(768, new arrow.Field('item', new arrow.Float32())),
    false
  ),
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // チャンキング情報
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  new arrow.Field('isChunked', new arrow.Bool(), false),                   // チャンク化フラグ
  new arrow.Field('chunkIndex', new arrow.Int32(), false),                 // チャンクインデックス
  new arrow.Field('totalChunks', new arrow.Int32(), false),                // 総チャンク数
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 互換性用ラベル（既存システム）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  new arrow.Field(
    'labels',
    new arrow.List(new arrow.Field('item', new arrow.Utf8())),
    true  // nullable
  ),
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // StructuredLabel（フラット化）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  // カテゴリ: spec, data, template, workflow, meeting, manual, other
  new arrow.Field('structured_category', new arrow.Utf8(), true),
  
  // ドメイン: 会員管理, 求人管理, 教室管理, など
  new arrow.Field('structured_domain', new arrow.Utf8(), true),
  
  // 機能名: クリーンな機能名（バージョン番号除く）
  new arrow.Field('structured_feature', new arrow.Utf8(), true),
  
  // 優先度: critical, high, medium, low, unknown
  new arrow.Field('structured_priority', new arrow.Utf8(), true),
  
  // ステータス: draft, review, approved, deprecated, unknown
  new arrow.Field('structured_status', new arrow.Utf8(), true),
  
  // バージョン: タイトルから抽出（例: "168"）
  new arrow.Field('structured_version', new arrow.Utf8(), true),
  
  // タグ: 関連キーワード
  new arrow.Field(
    'structured_tags',
    new arrow.List(new arrow.Field('item', new arrow.Utf8())),
    true  // nullable
  ),
  
  // 信頼度: 0.0 - 1.0
  new arrow.Field('structured_confidence', new arrow.Float32(), true),
  
  // コンテンツ長
  new arrow.Field('structured_content_length', new arrow.Int32(), true),
  
  // 有効ページフラグ
  new arrow.Field('structured_is_valid', new arrow.Bool(), true),
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // メタデータ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  new arrow.Field('spaceKey', new arrow.Utf8(), false),                    // スペースキー
  new arrow.Field('lastUpdated', new arrow.Utf8(), false),                 // 最終更新日時
]);

/**
 * LanceDBレコード型定義（TypeScript）
 */
export interface ExtendedLanceDBRecord {
  // 基本フィールド
  id: string;
  pageId: string;
  title: string;
  content: string;
  
  // ベクトル
  vector: number[];
  
  // チャンキング
  isChunked: boolean;
  chunkIndex: number;
  totalChunks: number;
  
  // 互換性用ラベル
  labels?: string[];
  
  // StructuredLabel（フラット化）
  structured_category?: string;
  structured_domain?: string;
  structured_feature?: string;
  structured_priority?: string;
  structured_status?: string;
  structured_version?: string;
  structured_tags?: string[];
  structured_confidence?: number;
  structured_content_length?: number;
  structured_is_valid?: boolean;
  
  // メタデータ
  spaceKey: string;
  lastUpdated: string;
}

/**
 * StructuredLabelをLanceDB形式にフラット化
 */
export function flattenStructuredLabel(label: any | null): Partial<ExtendedLanceDBRecord> {
  if (!label) {
    return {
      structured_category: undefined,
      structured_domain: undefined,
      structured_feature: undefined,
      structured_priority: undefined,
      structured_status: undefined,
      structured_version: undefined,
      structured_tags: undefined,
      structured_confidence: undefined,
      structured_content_length: undefined,
      structured_is_valid: undefined,
    };
  }
  
  return {
    structured_category: label.category || undefined,
    structured_domain: label.domain || undefined,
    structured_feature: label.feature || undefined,
    structured_priority: label.priority || undefined,
    structured_status: label.status || undefined,
    structured_version: label.version || undefined,
    structured_tags: label.tags || undefined,
    structured_confidence: label.confidence || undefined,
    structured_content_length: label.content_length || undefined,
    structured_is_valid: label.is_valid !== undefined ? label.is_valid : undefined,
  };
}

/**
 * フラット化されたStructuredLabelを元のオブジェクトに復元
 */
export function unflattenStructuredLabel(record: Partial<ExtendedLanceDBRecord>): any | null {
  // すべてのフィールドがundefinedの場合はnullを返す
  if (
    !record.structured_category &&
    !record.structured_domain &&
    !record.structured_feature
  ) {
    return null;
  }
  
  return {
    category: record.structured_category,
    domain: record.structured_domain,
    feature: record.structured_feature,
    priority: record.structured_priority,
    status: record.structured_status,
    version: record.structured_version,
    tags: record.structured_tags,
    confidence: record.structured_confidence,
    content_length: record.structured_content_length,
    is_valid: record.structured_is_valid,
  };
}

/**
 * フィルタクエリ構築ヘルパー
 */
export class StructuredLabelFilter {
  private conditions: string[] = [];
  
  /**
   * カテゴリでフィルタ
   */
  category(value: string | string[]): this {
    if (Array.isArray(value)) {
      const quoted = value.map(v => `'${v}'`).join(', ');
      this.conditions.push(`structured_category IN (${quoted})`);
    } else {
      this.conditions.push(`structured_category = '${value}'`);
    }
    return this;
  }
  
  /**
   * ドメインでフィルタ
   */
  domain(value: string | string[]): this {
    if (Array.isArray(value)) {
      const quoted = value.map(v => `'${v}'`).join(', ');
      this.conditions.push(`structured_domain IN (${quoted})`);
    } else {
      this.conditions.push(`structured_domain = '${value}'`);
    }
    return this;
  }
  
  /**
   * ステータスでフィルタ
   */
  status(value: string | string[]): this {
    if (Array.isArray(value)) {
      const quoted = value.map(v => `'${v}'`).join(', ');
      this.conditions.push(`structured_status IN (${quoted})`);
    } else {
      this.conditions.push(`structured_status = '${value}'`);
    }
    return this;
  }
  
  /**
   * 優先度でフィルタ
   */
  priority(value: string | string[]): this {
    if (Array.isArray(value)) {
      const quoted = value.map(v => `'${v}'`).join(', ');
      this.conditions.push(`structured_priority IN (${quoted})`);
    } else {
      this.conditions.push(`structured_priority = '${value}'`);
    }
    return this;
  }
  
  /**
   * 信頼度でフィルタ（最小値）
   */
  minConfidence(value: number): this {
    this.conditions.push(`structured_confidence >= ${value}`);
    return this;
  }
  
  /**
   * 有効ページのみ
   */
  onlyValid(): this {
    this.conditions.push(`structured_is_valid = true`);
    return this;
  }
  
  /**
   * WHERE句を構築
   */
  build(): string {
    return this.conditions.join(' AND ');
  }
}

/**
 * 使用例:
 * 
 * ```typescript
 * const filter = new StructuredLabelFilter()
 *   .category('spec')
 *   .status(['approved', 'review'])
 *   .minConfidence(0.8)
 *   .onlyValid()
 *   .build();
 * 
 * const results = await table
 *   .search(vector)
 *   .where(filter)
 *   .limit(20)
 *   .toArray();
 * ```
 */

