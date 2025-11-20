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
 * 
 * 注意: この型はAPI層（Firestore、型定義）で使用されるため、`pageId`フィールドを使用します。
 * LanceDBでは`page_id`を使用しますが、この型はAPI層でのみ使用されるため、`pageId`のままです。
 * 実際の使用時には、`getPageIdFromRecord`ヘルパーを使用してデータベースレコードから取得してください。
 */
export interface LabelMigrationRecord {
  pageId: string;  // API層で使用されるため、pageIdのまま（FirestoreのStructuredLabelDocumentと一致）
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
   * タイトルと内容からドメインを推測（Phase 2改善: 重み付きスコアリング）
   */
  static inferDomainFromContent(title: string, content: string): SystemDomain {
    const text = (title + ' ' + content).toLowerCase();
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Phase 2改善: 重み付きスコアリング
    const domainScores: Record<string, number> = {
      '会員管理': 0,
      '求人管理': 0,
      '教室管理': 0,
      'クライアント企業管理': 0,
      '全体管理': 0,
      'オファー管理': 0,
      '採用フロー': 0,
      '口コミ・評価': 0,
      'システム共通': 0,
      'その他': 0,
    };
    
    // タイトルのキーワードを重視（重み: 2.0）
    if (titleLower.includes('会員') && !titleLower.includes('クライアント企業')) {
      domainScores['会員管理'] += 2.0;
    }
    if (titleLower.includes('求人')) {
      domainScores['求人管理'] += 2.0;
    }
    if (titleLower.includes('教室')) {
      domainScores['教室管理'] += 2.0;
    }
    if (titleLower.includes('クライアント企業') || titleLower.includes('クライアント')) {
      domainScores['クライアント企業管理'] += 2.0;
    }
    if (titleLower.includes('全体管理') || titleLower.includes('サイト運営')) {
      domainScores['全体管理'] += 2.0;
    }
    if (titleLower.includes('オファー')) {
      domainScores['オファー管理'] += 2.0;
    }
    if (titleLower.includes('応募') || titleLower.includes('選考') || titleLower.includes('採用')) {
      domainScores['採用フロー'] += 2.0;
    }
    if (titleLower.includes('口コミ') || titleLower.includes('評価')) {
      domainScores['口コミ・評価'] += 2.0;
    }
    if (titleLower.includes('共通要件') || titleLower.includes('インフラ') || titleLower.includes('システム共通')) {
      domainScores['システム共通'] += 2.0;
    }
    
    // コンテンツのキーワード（重み: 1.0）
    if (contentLower.includes('会員') && !contentLower.includes('クライアント企業')) {
      domainScores['会員管理'] += 1.0;
    }
    if (contentLower.includes('求人')) {
      domainScores['求人管理'] += 1.0;
    }
    if (contentLower.includes('教室')) {
      domainScores['教室管理'] += 1.0;
    }
    if (contentLower.includes('クライアント企業') || contentLower.includes('クライアント')) {
      domainScores['クライアント企業管理'] += 1.0;
    }
    if (contentLower.includes('全体管理') || contentLower.includes('サイト運営')) {
      domainScores['全体管理'] += 1.0;
    }
    if (contentLower.includes('オファー')) {
      domainScores['オファー管理'] += 1.0;
    }
    if (contentLower.includes('応募') || contentLower.includes('選考') || contentLower.includes('採用')) {
      domainScores['採用フロー'] += 1.0;
    }
    if (contentLower.includes('口コミ') || contentLower.includes('評価')) {
      domainScores['口コミ・評価'] += 1.0;
    }
    if (contentLower.includes('共通要件') || contentLower.includes('インフラ') || contentLower.includes('システム共通')) {
      domainScores['システム共通'] += 1.0;
    }
    
    // 複合キーワード（重み: 1.5）
    if ((text.includes('応募') && text.includes('選考')) || 
        (text.includes('選考') && text.includes('採用')) ||
        (text.includes('応募') && text.includes('採用'))) {
      domainScores['採用フロー'] += 1.5;
    }
    if (text.includes('オファー') && (text.includes('受信') || text.includes('送信') || text.includes('通知'))) {
      domainScores['オファー管理'] += 1.5;
    }
    if ((text.includes('会員') && text.includes('登録')) ||
        (text.includes('会員') && text.includes('退会')) ||
        (text.includes('会員') && text.includes('アカウント'))) {
      domainScores['会員管理'] += 1.5;
    }
    if ((text.includes('教室') && (text.includes('登録') || text.includes('作成') || text.includes('管理')))) {
      domainScores['教室管理'] += 1.5;
    }
    if ((text.includes('求人') && (text.includes('登録') || text.includes('作成') || text.includes('検索')))) {
      domainScores['求人管理'] += 1.5;
    }
    
    // 最大スコアのドメインを返す
    const maxScore = Math.max(...Object.values(domainScores));
    if (maxScore === 0) {
      return 'その他';
    }
    
    const topDomain = Object.entries(domainScores)
      .find(([_, score]) => score === maxScore)?.[0] as SystemDomain;
    
    return topDomain || 'その他';
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

