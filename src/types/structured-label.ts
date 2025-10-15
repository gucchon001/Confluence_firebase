/**
 * 構造化ラベルシステム (Phase 0A-1)
 * 
 * 既存のstring[]ラベルを置き換える構造化されたラベルシステム
 * より精密なフィルタリングと検索精度向上を実現
 */

/**
 * ドキュメントのカテゴリ
 */
export type DocumentCategory = 
  | 'spec'       // 仕様書・機能要件
  | 'data'       // 帳票・データ定義
  | 'template'   // メールテンプレート
  | 'workflow'   // ワークフロー・フロー図
  | 'meeting'    // 議事録
  | 'manual'     // マニュアル・ガイド
  | 'other';     // その他

/**
 * ドキュメントのステータス
 */
export type DocumentStatus = 
  | 'draft'       // 作成中（【作成中】）
  | 'review'      // レビュー中（【レビュー中】）
  | 'approved'    // 確定版（【FIX】）
  | 'deprecated'  // 非推奨・廃止
  | 'unknown';    // 不明

/**
 * 優先度
 */
export type Priority = 
  | 'critical'  // 最重要
  | 'high'      // 高
  | 'medium'    // 中
  | 'low'       // 低
  | 'unknown';  // 不明

/**
 * システムドメイン（主要な機能領域）
 */
export type SystemDomain = 
  | '会員管理'
  | '求人管理'
  | '教室管理'
  | 'クライアント企業管理'
  | '全体管理'
  | 'オファー管理'
  | '採用フロー'
  | '口コミ・評価'
  | 'システム共通'
  | 'その他';

/**
 * 構造化ラベル
 */
export interface StructuredLabel {
  /**
   * カテゴリ: ドキュメントの種類
   */
  category: DocumentCategory;
  
  /**
   * ドメイン: どの機能領域に属するか
   */
  domain: SystemDomain;
  
  /**
   * 機能: 具体的な機能名（例: "教室コピー機能", "ログイン機能"）
   */
  feature: string;
  
  /**
   * 優先度: ビジネス上の重要度
   */
  priority: Priority;
  
  /**
   * ステータス: ドキュメントの完成度
   */
  status: DocumentStatus;
  
  /**
   * コンテンツ長: ページの実質的な情報量（Phase 0A-1.5追加）
   */
  content_length?: number;
  
  /**
   * 有効ページフラグ: 空ページ・リダイレクトページを除外（Phase 0A-1.5追加）
   */
  is_valid?: boolean;
  
  /**
   * バージョン番号（任意）: 仕様書のバージョン（例: "168", "515"）
   */
  version?: string;
  
  /**
   * タグ（任意）: 追加の分類キーワード
   */
  tags?: string[];
  
  /**
   * 信頼度（任意）: 自動ラベル付けの信頼度（0.0 - 1.0）
   */
  confidence?: number;
}

/**
 * ラベル付きドキュメント
 * 既存のlabels（string[]）と新しいstructuredLabelを両方保持
 */
export interface LabeledDocument {
  id: string;
  title: string;
  content: string;
  
  /**
   * 既存のラベル（互換性のため保持）
   */
  labels: string[];
  
  /**
   * 新しい構造化ラベル
   */
  structuredLabel: StructuredLabel;
  
  /**
   * その他のメタデータ
   */
  url?: string;
  lastUpdated?: string;
  spaceKey?: string;
}

/**
 * ラベル移行の記録
 */
export interface LabelMigrationRecord {
  pageId: string;
  oldLabels: string[];
  newLabel: StructuredLabel;
  migratedAt: Date;
  migrationMethod: 'rule-based' | 'llm-based' | 'manual';
  confidence: number;
}

/**
 * StructuredLabelのヘルパー関数
 */
export class StructuredLabelHelper {
  /**
   * タイトルからステータスを抽出
   */
  static extractStatusFromTitle(title: string): DocumentStatus {
    if (title.includes('【FIX】')) return 'approved';
    if (title.includes('【作成中】')) return 'draft';
    if (title.includes('【レビュー中】')) return 'review';
    return 'unknown';
  }
  
  /**
   * タイトルからバージョンを抽出
   */
  static extractVersionFromTitle(title: string): string | undefined {
    const match = title.match(/^(\d+)_/);
    return match ? match[1] : undefined;
  }
  
  /**
   * タイトルをクリーンアップ（ステータスマーカーとバージョンを削除）
   */
  static cleanTitle(title: string): string {
    return title
      .replace(/^\d+_/, '')  // バージョン番号を削除
      .replace(/【FIX】|【作成中】|【レビュー中】/g, '')  // ステータスマーカーを削除
      .trim();
  }
  
  /**
   * 既存のstring[]ラベルからカテゴリを推測
   */
  static inferCategoryFromLabels(labels: string[]): DocumentCategory {
    if (labels.includes('機能要件')) return 'spec';
    if (labels.includes('帳票')) return 'data';
    if (labels.includes('メールテンプレート')) return 'template';
    if (labels.includes('ワークフロー')) return 'workflow';
    if (labels.includes('議事録') || labels.includes('meeting-notes')) return 'meeting';
    return 'other';
  }
  
  /**
   * タイトルと内容からドメインを推測
   */
  static inferDomainFromContent(title: string, content: string): SystemDomain {
    const text = title + ' ' + content;
    
    if (text.includes('会員') && !text.includes('クライアント企業')) return '会員管理';
    if (text.includes('求人')) return '求人管理';
    if (text.includes('教室')) return '教室管理';
    if (text.includes('クライアント企業')) return 'クライアント企業管理';
    if (text.includes('全体管理') || text.includes('サイト運営')) return '全体管理';
    if (text.includes('オファー')) return 'オファー管理';
    if (text.includes('応募') || text.includes('選考') || text.includes('採用')) return '採用フロー';
    if (text.includes('口コミ') || text.includes('評価')) return '口コミ・評価';
    if (text.includes('共通要件') || text.includes('インフラ')) return 'システム共通';
    
    return 'その他';
  }
  
  /**
   * カテゴリとステータスから優先度を推測
   */
  static inferPriority(category: DocumentCategory, status: DocumentStatus): Priority {
    // 確定版の機能要件は高優先度
    if (category === 'spec' && status === 'approved') return 'high';
    
    // 作成中の機能要件は中優先度
    if (category === 'spec' && status === 'draft') return 'medium';
    
    // ワークフローは高優先度
    if (category === 'workflow') return 'high';
    
    // 議事録やメールテンプレートは低優先度
    if (category === 'meeting' || category === 'template') return 'low';
    
    return 'medium';
  }
  
  /**
   * StructuredLabelを表示用文字列に変換
   */
  static toDisplayString(label: StructuredLabel): string {
    const parts = [
      label.category,
      label.domain,
      label.feature,
      label.status
    ];
    return parts.filter(Boolean).join(' > ');
  }
  
  /**
   * StructuredLabelから検索用キーワードを生成
   */
  static toSearchKeywords(label: StructuredLabel): string[] {
    const keywords: string[] = [
      label.category,
      label.domain,
      label.feature,
      label.status
    ];
    
    if (label.tags) {
      keywords.push(...label.tags);
    }
    
    return keywords.filter(Boolean);
  }
}

/**
 * ラベルフィルタオプション（検索時に使用）
 */
export interface StructuredLabelFilterOptions {
  categories?: DocumentCategory[];
  domains?: SystemDomain[];
  statuses?: DocumentStatus[];
  priorities?: Priority[];
  excludeMeetingNotes?: boolean;  // 既存のオプションと互換性
}

