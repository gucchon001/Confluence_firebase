/**
 * 検索アルゴリズムの重み付け設定
 * これらの値を調整することで検索精度を最適化できます
 */

// ベクトル検索とキーワード検索の重み（調整）
export const VECTOR_WEIGHT = 0.4; // ベクトル検索の重み（調整）
export const KEYWORD_WEIGHT = 0.5; // キーワード検索の重み（キーワードマッチングを重視）
export const LABEL_WEIGHT = 0.1; // ラベル検索の重み（下げる）

// ラベルフィルタオプション
export interface LabelFilterOptions {
  includeMeetingNotes: boolean;
  includeArchived: boolean;
  includeFolders: boolean;  // フォルダラベルを含めるかどうか
}


// 汎用語の重みを極小化するための設定（検索精度を下げる可能性のある汎用語）
export const GENERIC_TERMS = [
  '要件', 'requirement', 'req',
  '詳細', 'detail', 'details',
  '機能', 'function', 'feature',
  '設計', 'design',
  '実装', 'implementation', 'impl',
  '開発', 'development', 'dev',
  'システム', 'system',
  'アプリケーション', 'application', 'app',
  'サービス', 'service',
  'プラットフォーム', 'platform',
  'フレームワーク', 'framework',
  'ライブラリ', 'library',
  'ツール', 'tool',
  'ユーティリティ', 'utility',
  'コンポーネント', 'component',
  'モジュール', 'module',
  'パッケージ', 'package',
  'プロジェクト', 'project',
  'ソリューション', 'solution',
  'ソフトウェア', 'software',
  'ハードウェア', 'hardware',
  'インフラ', 'infrastructure',
  'アーキテクチャ', 'architecture',
  'パターン', 'pattern',
  'メソッド', 'method',
  '情報', 'information', 'info',
  '内容', 'content',
  '説明', 'explanation', 'explain',
  '記述', 'description', 'desc',
  '定義', 'definition', 'def',
  '概念', 'concept',
  '理論', 'theory',
  '原則', 'principle',
  '規則', 'rule',
  '手順', 'procedure', 'proc',
  'プロセス', 'process',
  'フロー', 'flow',
  'ワークフロー', 'workflow',
  'ステップ', 'step',
  '段階', 'phase',
  '工程', 'stage',
  'フェーズ', 'phase',
  'イテレーション', 'iteration',
  'サイクル', 'cycle',
  'ループ', 'loop',
  '反復', 'repeat',
  '繰り返し', 'repetition',
  '継続', 'continue',
  '実行', 'execute', 'exec',
  '処理', 'process',
  '操作', 'operation', 'op',
  '動作', 'behavior', 'behaviour',
  '振る舞い', 'behavior',
  '挙動', 'behavior',
  '機能', 'functionality',
  '性能', 'performance', 'perf',
  '効率', 'efficiency',
  '最適化', 'optimization', 'opt',
  '改善', 'improvement',
  '修正', 'fix',
  '更新', 'update',
  '変更', 'change',
  '調整', 'adjustment',
  '設定', 'setting', 'config',
  '構成', 'configuration',
  '環境', 'environment', 'env',
  '条件', 'condition',
  '制約', 'constraint',
  '制限', 'limit',
  '境界', 'boundary',
  '範囲', 'range',
  '領域', 'domain',
  'スコープ', 'scope',
  '対象', 'target',
  '目的', 'purpose',
  '目標', 'goal',
  '意図', 'intent',
  '理由', 'reason',
  '原因', 'cause',
  '結果', 'result',
  '効果', 'effect',
  '影響', 'impact',
  '利点', 'advantage',
  '欠点', 'disadvantage',
  '問題', 'problem', 'issue',
  '課題', 'challenge',
  'リスク', 'risk',
  '危険', 'danger',
  '安全', 'safety',
  'セキュリティ', 'security',
  '保護', 'protection',
  '防御', 'defense',
  '攻撃', 'attack',
  '脆弱性', 'vulnerability',
  '脅威', 'threat',
  '監視', 'monitoring',
  'ログ', 'log',
  '記録', 'record',
  '履歴', 'history',
  '追跡', 'tracking',
  '追跡', 'trace',
  'デバッグ', 'debug',
  'テスト', 'test',
  '検証', 'verification',
  '確認', 'confirmation',
  'チェック', 'check',
  '検証', 'validation',
  '検証', 'verify',
  '検証', 'validate',
  '検証', 'inspect',
  '検証', 'examine',
  '検証', 'review',
  '検証', 'audit',
  '検証', 'evaluate',
  '検証', 'assess',
  '検証', 'analyze',
  '検証', 'analyze',
  '検証', 'investigate',
  '検証', 'research',
  '検証', 'study',
  '検証', 'survey',
  '検証', 'poll',
  '検証', 'questionnaire',
  '検証', 'interview',
  '検証', 'meeting',
  '検証', 'conference',
  '検証', 'workshop',
  '検証', 'seminar',
  '検証', 'training',
  '検証', 'education',
  '検証', 'learning',
  '検証', 'knowledge',
  '検証', 'skill',
  '検証', 'ability',
  '検証', 'capability',
  '検証', 'competence',
  '検証', 'expertise',
  '検証', 'experience',
  '検証', 'background',
  '検証', 'history',
  '検証', 'record',
  '検証', 'track',
  '検証', 'trace',
  '検証', 'follow',
  '検証', 'monitor',
  '検証', 'observe',
  '検証', 'watch',
  '検証', 'see',
  '検証', 'look',
  '検証', 'view',
  '検証', 'show',
  '検証', 'display',
  '検証', 'present',
  '検証', 'demonstrate',
  '検証', 'illustrate',
  '検証', 'explain',
  '検証', 'describe',
  '検証', 'define',
  '検証', 'specify',
  '検証', 'detail',
  '検証', 'elaborate',
  '検証', 'expand',
  '検証', 'extend',
  '検証', 'enhance',
  '検証', 'improve',
  '検証', 'optimize',
  '検証', 'refine',
  '検証', 'polish',
  '検証', 'perfect',
  '検証', 'complete',
  '検証', 'finish',
  '検証', 'end',
  '検証', 'stop',
  '検証', 'halt',
  '検証', 'pause',
  '検証', 'wait',
  '検証', 'delay',
  '検証', 'postpone',
  '検証', 'defer',
  '検証', 'suspend',
  '検証', 'interrupt',
  '検証', 'break',
  '検証', 'cut',
  '検証', 'split',
  '検証', 'divide',
  '検証', 'separate',
  '検証', 'isolate',
  '検証', 'extract',
  '検証', 'remove',
  '検証', 'delete',
  '検証', 'eliminate',
  '検証', 'exclude',
  '検証', 'ignore',
  '検証', 'skip',
  '検証', 'omit',
  '検証', 'miss',
  '検証', 'lose',
  '検証', 'fail',
  '検証', 'error',
  '検証', 'mistake',
  '検証', 'bug',
  '検証', 'issue',
  '検証', 'problem',
  '検証', 'trouble',
  '検証', 'difficulty',
  '検証', 'challenge',
  '検証', 'obstacle',
  '検証', 'barrier',
  '検証', 'block',
  '検証', 'prevent',
  '検証', 'stop',
  '検証', 'halt',
  '検証', 'pause',
  '検証', 'wait',
  '検証', 'delay',
  '検証', 'postpone',
  '検証', 'defer',
  '検証', 'suspend',
  '検証', 'interrupt',
  '検証', 'break',
  '検証', 'cut',
  '検証', 'split',
  '検証', 'divide',
  '検証', 'separate',
  '検証', 'isolate',
  '検証', 'extract',
  '検証', 'remove',
  '検証', 'delete',
  '検証', 'eliminate',
  '検証', 'exclude',
  '検証', 'ignore',
  '検証', 'skip',
  '検証', 'omit',
  '検証', 'miss',
  '検証', 'lose',
  '検証', 'fail',
  '検証', 'error',
  '検証', 'mistake',
  '検証', 'bug',
  '検証', 'issue',
  '検証', 'problem',
  '検証', 'trouble',
  '検証', 'difficulty',
  '検証', 'challenge',
  '検証', 'obstacle',
  '検証', 'barrier',
  '検証', 'block',
  '検証', 'prevent'
];

// 重要キーワードの定義（厳格一致でブーストするキーワード）
export const IMPORTANT_KEYWORDS = [
  'ログイン', 'login', 'サインイン', 'signin',
  'ログイン機能', 'login function', 'login functionality',
  'ログイン仕様', 'login specification',
  'ログイン詳細', 'login details',
  'ログイン手順', 'login procedure',
  'ログアウト', 'logout', 'サインアウト', 'signout',
  'ログアウト機能', 'logout function', 'logout functionality',
  '認証', 'authentication', 'auth',
  '認証機能', 'authentication function', 'auth function',
  'パスワード', 'password', 'passwd',
  'アカウント', 'account',
  'ユーザー', 'user',
  '会員', 'member',
  '会員ログイン', 'member login',
  '会員ログアウト', 'member logout',
  'セキュリティ', 'security',

  // 教室管理関連
  '教室管理', 'classroom management',
  '求人情報', 'job information',
  '新規登録', 'new registration',
  '機能', 'function',
  '要件', 'requirement',
  
  // 技術文書関連
  '仕様', 'specification', 'spec',

  // 急募関連
  '急募', 'urgent recruitment',
  '急募管理', 'urgent recruitment management'
];

// キーワードマッチングの重み
export const WEIGHTS = {
  // タイトル関連
  TITLE_EXACT_MATCH: 0.8,   // タイトルに完全一致
  TITLE_CONTAINS: 0.5,      // タイトルに部分一致
  
  // ラベル関連
  LABEL_MATCH: 0.4,         // ラベルに一致
  
  // コンテンツ関連
  CONTENT_MATCH: 0.3,       // コンテンツに一致
  
  // 重要キーワードの厳格一致ブースト
  IMPORTANT_KEYWORD_TITLE_EXACT: 5.0,  // 重要キーワードがタイトルに完全一致（大幅強化）
  IMPORTANT_KEYWORD_TITLE_CONTAINS: 3.0, // 重要キーワードがタイトルに部分一致（大幅強化）
  IMPORTANT_KEYWORD_LABEL_EXACT: 4.0,   // 重要キーワードがラベルに完全一致（大幅強化）
  IMPORTANT_KEYWORD_LABEL_CONTAINS: 2.5, // 重要キーワードがラベルに部分一致（大幅強化）
  
  // 汎用語の重み（極小化）
  GENERIC_TERM_WEIGHT: 0.0, // 汎用語の重みを0に（採点影響なし）
  
  // 複合スコアの計算係数
  HYBRID_FACTOR: 0.7        // ハイブリッドスコア計算時の係数
};

/**
 * キーワード別の特別なブースト設定
 * 新しいキーワードやページを追加する際は、この設定を更新するだけで対応可能
 */
// NOTE: ハードコードのキーワード/ページIDブーストは撤去しました（RRF/再ランクで対応）

/**
 * キーワード別の特別なブーストを計算する
 * @param keyword 検索キーワード
 * @param title ページタイトル
 * @param pageId ページID
 * @returns ブーストスコア
 */
// NOTE: 設定ベースの特別ブーストは撤去（辞書運用を廃止し再ランクへ移行）


/**
 * ハイブリッドスコアを計算する
 * @param vectorDistance ベクトル距離
 * @param keywordScore キーワードスコア
 * @param labelScore ラベルスコア
 * @returns ハイブリッドスコア
 */
export function calculateHybridScore(vectorDistance: number, keywordScore: number, labelScore: number = 0): number {
  // ベクトル距離は小さいほど良い（0-1の範囲）
  // キーワードスコアとラベルスコアは大きいほど良い
  // ベクトル距離を反転（1 - distance）してスコアとして使用
  const vectorScore = (1 - vectorDistance) * VECTOR_WEIGHT;
  const keywordScoreWeighted = keywordScore * KEYWORD_WEIGHT;
  const labelScoreWeighted = labelScore * LABEL_WEIGHT;
  
  return vectorScore + keywordScoreWeighted + labelScoreWeighted;
}

/**
 * キーワードスコアを計算する
 * @param title タイトル
 * @param content コンテンツ
 * @param labels ラベル配列
 * @param keywords 検索キーワード配列
 * @returns スコア情報
 */
export function calculateKeywordScore(
  title: string,
  content: string,
  labels: string[],
  keywords: string[],
  options?: {
    highPriority?: Set<string>; // 原語など強くしたい語
    lowPriority?: Set<string>;  // 類義語など弱くしたい語
  }
): {
  score: number;
  titleMatches: number;
  labelMatches: number;
  contentMatches: number;
} {
  let keywordScore = 0;
  let titleMatches = 0;
  let labelMatches = 0;
  let contentMatches = 0;
  
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  const lowerLabels = labels.map(l => l.toLowerCase());
  
  // キーワードを正のキーワードと負のキーワードに分離
  const positiveKeywords: string[] = [];
  const negativeKeywords: string[] = [];
  
  for (const keyword of keywords) {
    const trimmedKeyword = keyword.trim();
    if (trimmedKeyword.startsWith('-')) {
      // 否定語（-で始まる）はスコア計算から除外し、フィルタリング用に保存
      negativeKeywords.push(trimmedKeyword.substring(1).toLowerCase());
    } else {
      // 正のキーワードはスコア計算に使用
      positiveKeywords.push(trimmedKeyword);
    }
  }
  
  console.log(`[calculateKeywordScore] Positive keywords: ${JSON.stringify(positiveKeywords)}`);
  console.log(`[calculateKeywordScore] Negative keywords: ${JSON.stringify(negativeKeywords)}`);
  
  // 負のキーワードは採点に影響させない（フィルタ用途のみ）
  if (negativeKeywords.length > 0) {
    console.log(`[calculateKeywordScore] Negative keywords detected (ignored in scoring): ${JSON.stringify(negativeKeywords)}`);
  }
  
  // 正のキーワードでスコア計算
  for (const keyword of positiveKeywords) {
    const lowerKeyword = keyword.toLowerCase();
    
    // 汎用語かどうかをチェック
    const isGenericTerm = GENERIC_TERMS.includes(lowerKeyword);
    let weightMultiplier = isGenericTerm ? WEIGHTS.GENERIC_TERM_WEIGHT : 1.0;
    // 呼び出し側の優先度セットに応じて可変補正（ハードコード禁止）
    if (options?.highPriority && options.highPriority.has(lowerKeyword)) {
      weightMultiplier *= 1.6; // 原語などを強化
    } else if (options?.lowPriority && options.lowPriority.has(lowerKeyword)) {
      weightMultiplier *= 0.6; // 類義語は弱化
    }
    
    // 重要キーワードかどうかをチェック
    const isImportantKeyword = IMPORTANT_KEYWORDS.includes(lowerKeyword);
    
    console.log(`[calculateKeywordScore] Keyword: "${lowerKeyword}", isGeneric: ${isGenericTerm}, isImportant: ${isImportantKeyword}, weightMultiplier: ${weightMultiplier}`);
    
    // タイトルに完全一致する場合
    if (lowerTitle === lowerKeyword) {
      if (isImportantKeyword) {
        keywordScore += WEIGHTS.IMPORTANT_KEYWORD_TITLE_EXACT * weightMultiplier;
        console.log(`[calculateKeywordScore] Important keyword exact title match: +${WEIGHTS.IMPORTANT_KEYWORD_TITLE_EXACT * weightMultiplier}`);
      } else {
        keywordScore += WEIGHTS.TITLE_EXACT_MATCH * weightMultiplier;
        console.log(`[calculateKeywordScore] Exact title match: +${WEIGHTS.TITLE_EXACT_MATCH * weightMultiplier}`);
      }
      titleMatches++;
    }
    // タイトルに含まれる場合
    else if (lowerTitle.includes(lowerKeyword)) {
      if (isImportantKeyword) {
        keywordScore += WEIGHTS.IMPORTANT_KEYWORD_TITLE_CONTAINS * weightMultiplier;
        console.log(`[calculateKeywordScore] Important keyword title contains: +${WEIGHTS.IMPORTANT_KEYWORD_TITLE_CONTAINS * weightMultiplier}`);
      } else {
        keywordScore += WEIGHTS.TITLE_CONTAINS * weightMultiplier;
        console.log(`[calculateKeywordScore] Title contains: +${WEIGHTS.TITLE_CONTAINS * weightMultiplier}`);
      }
      titleMatches++;
    }
    // 部分マッチング（キーワードの一部がタイトルに含まれる場合）
    else {
      // キーワードを分割して部分マッチングを試行
      const keywordParts = lowerKeyword.split(/[の・・、]/).filter(part => part.length >= 2);
      let partialMatch = false;
      
      for (const part of keywordParts) {
        if (lowerTitle.includes(part)) {
          keywordScore += WEIGHTS.TITLE_CONTAINS * weightMultiplier * 0.5; // 部分マッチは半分のスコア
          console.log(`[calculateKeywordScore] Partial title match (${part}): +${WEIGHTS.TITLE_CONTAINS * weightMultiplier * 0.5}`);
          titleMatches++;
          partialMatch = true;
          break; // 最初の部分マッチのみカウント
        }
      }
      
      // デバッグログ
      if (!partialMatch) {
        console.log(`[calculateKeywordScore] No title match for "${lowerKeyword}" in "${lowerTitle}"`);
      }
    }
        
        // デバッグ: タイトルマッチングの詳細をログ出力
        if (lowerKeyword === 'ログイン' || lowerKeyword === 'ログイン機能') {
          console.log(`[calculateKeywordScore] DEBUG - Keyword: "${lowerKeyword}", Title: "${lowerTitle}", Contains check: ${lowerTitle.includes('ログイン')}`);
        }
    
    // ラベルに一致する場合
    const labelMatch = lowerLabels.find(label => label.includes(lowerKeyword));
    if (labelMatch) {
      if (isImportantKeyword) {
        if (labelMatch === lowerKeyword) {
          keywordScore += WEIGHTS.IMPORTANT_KEYWORD_LABEL_EXACT * weightMultiplier;
          console.log(`[calculateKeywordScore] Important keyword exact label match: +${WEIGHTS.IMPORTANT_KEYWORD_LABEL_EXACT * weightMultiplier}`);
        } else {
          keywordScore += WEIGHTS.IMPORTANT_KEYWORD_LABEL_CONTAINS * weightMultiplier;
          console.log(`[calculateKeywordScore] Important keyword label contains: +${WEIGHTS.IMPORTANT_KEYWORD_LABEL_CONTAINS * weightMultiplier}`);
        }
      } else {
        keywordScore += WEIGHTS.LABEL_MATCH * weightMultiplier;
      }
      labelMatches++;
    }
    
    // コンテンツに含まれる場合
    if (lowerContent.includes(lowerKeyword)) {
      keywordScore += WEIGHTS.CONTENT_MATCH * weightMultiplier;
      contentMatches++;
    }
  }
  
  return {
    score: keywordScore,
    titleMatches,
    labelMatches,
    contentMatches
  };
}
