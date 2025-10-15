/**
 * StructuredLabelを活用したスコアリング
 * Phase 0A-2: domain/featureマッチングによるスコア向上
 */

import { StructuredLabel } from '@/types/structured-label';

/**
 * クエリとStructuredLabelのマッチングスコアを計算
 */
export function calculateLabelMatchScore(
  query: string,
  label: StructuredLabel | null | undefined,
  options: {
    domainWeight?: number;
    featureWeight?: number;
    categoryWeight?: number;
    tagsWeight?: number;
  } = {}
): number {
  if (!label) {
    return 0;
  }

  const {
    domainWeight = 3.0,      // ドメインマッチは高い重み
    featureWeight = 5.0,     // 機能名マッチは最高の重み
    categoryWeight = 1.0,    // カテゴリマッチは低い重み
    tagsWeight = 2.0         // タグマッチは中程度の重み
  } = options;

  const queryLower = query.toLowerCase();
  let score = 0;

  // 1. 機能名マッチング（最重要）
  if (label.feature) {
    const featureLower = label.feature.toLowerCase();
    
    // 完全一致
    if (queryLower.includes(featureLower)) {
      score += featureWeight * 2;
    }
    // 逆方向の完全一致
    else if (featureLower.includes(queryLower)) {
      score += featureWeight * 1.5;
    }
    // 部分一致（文字列の類似度チェック）
    else {
      // 日本語の場合、N-gram（2文字ずつ）で類似度を計算
      // シンプルに：機能名の主要な2文字以上の部分文字列がクエリに含まれているかチェック
      let partialMatchScore = 0;
      
      // 汎用語を特定
      const genericTerms = ['機能', '仕様', '帳票', 'フロー', '管理', '一覧', '登録', '編集', '削除', '閲覧', '詳細', '情報', '画面', 'ページ'];
      
      // 機能名から2文字以上の部分文字列を抽出してマッチング
      for (let i = 0; i < featureLower.length; i++) {
        for (let len = 2; len <= Math.min(featureLower.length - i, 6); len++) {
          const substring = featureLower.substring(i, i + len);
          
          if (queryLower.includes(substring)) {
            // 汎用語かチェック
            const isGeneric = genericTerms.includes(substring);
            const weight = isGeneric ? 0.2 : 0.8;
            partialMatchScore += len * weight; // 長いマッチほど高スコア
          }
        }
      }
      
      score += (partialMatchScore / featureLower.length) * featureWeight;
    }
  }

  // 2. ドメインマッチング（重要）
  if (label.domain && label.domain !== 'その他') {
    const domainLower = label.domain.toLowerCase();
    
    // 完全一致
    if (queryLower.includes(domainLower) || domainLower.includes(queryLower)) {
      score += domainWeight * 2;
    }
    // 部分一致
    else {
      const domainWords = domainLower.split(/[\s・、]+/).filter(w => w.length > 1);
      const matchedWords = domainWords.filter(word => queryLower.includes(word));
      score += matchedWords.length * domainWeight * 0.5;
    }
  }

  // 3. カテゴリマッチング
  if (label.category && label.category !== 'other') {
    const categoryKeywords: Record<string, string[]> = {
      spec: ['機能', '仕様', 'spec'],
      data: ['データ', '帳票', 'マスタ'],
      template: ['メール', 'テンプレート', '通知'],
      workflow: ['フロー', 'ワークフロー', '流れ'],
      meeting: ['ミーティング', '議事録', '確認会'],
      manual: ['マニュアル', '手順', 'ガイド']
    };

    const keywords = categoryKeywords[label.category] || [];
    const matched = keywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
    if (matched) {
      score += categoryWeight;
    }
  }

  // 4. タグマッチング
  if (label.tags && label.tags.length > 0) {
    const matchedTags = label.tags.filter(tag => 
      queryLower.includes(tag.toLowerCase()) || tag.toLowerCase().includes(queryLower)
    );
    score += matchedTags.length * tagsWeight;
  }

  return score;
}

/**
 * 優先度に基づくブーストスコアを計算
 */
export function calculatePriorityBoost(label: StructuredLabel | null | undefined): number {
  if (!label) {
    return 0;
  }

  const priorityBoosts: Record<string, number> = {
    critical: 2.0,
    high: 1.0,
    medium: 0.5,
    low: 0.0,
    unknown: 0.0
  };

  return priorityBoosts[label.priority] || 0;
}

/**
 * ステータスに基づくブーストスコアを計算
 */
export function calculateStatusBoost(label: StructuredLabel | null | undefined): number {
  if (!label) {
    return 0;
  }

  const statusBoosts: Record<string, number> = {
    approved: 1.5,      // 承認済みは最優先
    review: 0.5,        // レビュー中は中程度
    draft: 0.0,         // ドラフトは通常
    deprecated: -2.0,   // 非推奨は下げる
    unknown: 0.0        // 不明は通常
  };

  return statusBoosts[label.status] || 0;
}

/**
 * 総合的なStructuredLabelスコアを計算
 */
export function calculateStructuredLabelScore(
  query: string,
  label: StructuredLabel | null | undefined,
  options: {
    enableMatching?: boolean;
    enablePriorityBoost?: boolean;
    enableStatusBoost?: boolean;
  } = {}
): number {
  const {
    enableMatching = true,
    enablePriorityBoost = true,
    enableStatusBoost = true
  } = options;

  let totalScore = 0;

  // 1. マッチングスコア
  if (enableMatching) {
    totalScore += calculateLabelMatchScore(query, label);
  }

  // 2. 優先度ブースト
  if (enablePriorityBoost) {
    totalScore += calculatePriorityBoost(label);
  }

  // 3. ステータスブースト
  if (enableStatusBoost) {
    totalScore += calculateStatusBoost(label);
  }

  return totalScore;
}

