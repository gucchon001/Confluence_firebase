/**
 * 自動ラベル付けFlow
 * Phase 0A-1: ConfluenceページからStructuredLabelを自動生成
 */

import { ai } from '../genkit';
import { z } from 'zod';
import { loadDomainKnowledge, findDomainCandidates, findTermCandidates } from '@/lib/domain-knowledge-loader';
import { StructuredLabelHelper } from '@/types/structured-label';
import { removeBOM, checkStringForBOM } from '@/lib/bom-utils';
import { GeminiConfig } from '@/config/ai-models-config';
import type { StructuredLabel, DocumentCategory, DocumentStatus } from '@/types/structured-label';

// 入力スキーマ
const InputSchema = z.object({
  title: z.string(),
  content: z.string(),
  labels: z.array(z.string()),
  // Jira対応: ソースとJira特有フィールドを追加
  source: z.enum(['confluence', 'jira']).optional().default('confluence'),
  issueType: z.string().optional(),      // Jira特有
  status: z.string().optional(),          // Jira特有（既存statusとの重複注意）
  priority: z.string().optional(),        // Jira特有
});

// 出力スキーマ
const OutputSchema = z.object({
  category: z.enum(['spec', 'data', 'template', 'workflow', 'meeting', 'manual', 'other']),
  domain: z.string(),
  feature: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'unknown']),
  status: z.enum(['draft', 'review', 'approved', 'deprecated', 'unknown']),
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
  confidence: z.number().optional(),
});

/**
 * ルールベースでStructuredLabelを生成（高速・高精度）
 */
/**
 * カテゴリを推測（既存ラベル + タイトル + コンテンツ）
 * Phase 1改善: カテゴリ推測の強化
 */
function inferCategoryEnhanced(labels: string[], title: string, content: string): DocumentCategory {
  // 既存のラベルを確認
  if (labels.includes('機能要件')) return 'spec';
  if (labels.includes('帳票')) return 'data';
  if (labels.includes('メールテンプレート')) return 'template';
  if (labels.includes('ワークフロー')) return 'workflow';
  if (labels.includes('議事録') || labels.includes('meeting-notes')) return 'meeting';
  
  // タイトルから推測（既存ラベルがない場合）
  const titleLower = title.toLowerCase();
  if (titleLower.includes('機能') || titleLower.includes('仕様')) return 'spec';
  if (titleLower.includes('帳票') || titleLower.includes('データ定義')) return 'data';
  if (titleLower.includes('メール') || titleLower.includes('通知')) return 'template';
  if (titleLower.includes('フロー') || titleLower.includes('ワークフロー')) return 'workflow';
  if (titleLower.includes('議事録') || titleLower.includes('ミーティング') || titleLower.includes('meeting')) return 'meeting';
  
  // コンテンツから推測（フォールバック）
  const contentLower = content.substring(0, 500).toLowerCase();
  if (contentLower.includes('機能要件') || contentLower.includes('仕様書')) return 'spec';
  if (contentLower.includes('議事録')) return 'meeting';
  
  return 'other';
}

function tryRuleBasedLabeling(input: z.infer<typeof InputSchema>): StructuredLabel | null {
  // Jira対応: ソースに応じてステータス抽出方法を変更
  const source = input.source || 'confluence';
  const status = source === 'jira' 
    ? mapJiraStatusToStructuredStatus(input.status)
    : StructuredLabelHelper.extractStatusFromTitle(input.title);
  const version = StructuredLabelHelper.extractVersionFromTitle(input.title);
  
  // Phase 1改善: カテゴリ推測の強化（タイトルとコンテンツも使用）
  const category = inferCategoryEnhanced(input.labels, input.title, input.content);
  const domain = StructuredLabelHelper.inferDomainFromContent(input.title, input.content.substring(0, 1000));
  
  // Phase 1改善: ルールベース生成の条件を緩和（2つ以上の条件が満たされれば生成）
  const conditions = [
    status !== 'unknown',
    category !== 'other',
    domain !== 'その他'
  ];
  const metConditions = conditions.filter(Boolean).length;
  
  // 2つ以上の条件が満たされればルールベース生成
  if (metConditions >= 2) {
    const feature = StructuredLabelHelper.cleanTitle(input.title);
    
    // 不足している条件をデフォルト値で補完
    const finalCategory = category === 'other' ? 'spec' : category; // フォールバック
    const finalStatus = status === 'unknown' ? 'approved' : status; // フォールバック
    
    // ドメインが「その他」の場合は再推測を試行
    let finalDomain = domain;
    if (domain === 'その他' && metConditions === 2) {
      // タイトルとコンテンツの両方から再推測
      const titleLower = input.title.toLowerCase();
      const contentLower = input.content.substring(0, 1000).toLowerCase();
      
      if (titleLower.includes('会員') || contentLower.includes('会員')) finalDomain = '会員管理';
      else if (titleLower.includes('求人') || contentLower.includes('求人')) finalDomain = '求人管理';
      else if (titleLower.includes('教室') || contentLower.includes('教室')) finalDomain = '教室管理';
      else if (titleLower.includes('クライアント企業') || contentLower.includes('クライアント企業')) finalDomain = 'クライアント企業管理';
      // 「その他」のままの場合もある
    }
    
    const priority = StructuredLabelHelper.inferPriority(finalCategory, finalStatus);
    
    // タグをコンテンツから抽出（シンプルな方法） + 退会関連などを拡張
    const tags: string[] = [];
    const tagSearchTargets = [
      input.title ?? '',
      input.content.substring(0, 800) ?? ''
    ];
    const tagRules: Array<{ tag: string; keywords: string[] }> = [
      { tag: 'コピー', keywords: ['コピー','教室コピー'] },
      { tag: '一括処理', keywords: ['一括'] },
      { tag: '登録', keywords: ['登録'] },
      { tag: '削除', keywords: ['削除'] },
      { tag: '編集', keywords: ['編集'] },
      { tag: '管理画面', keywords: ['管理画面'] },
      { tag: '退会', keywords: ['退会', '退会済み'] },
      { tag: '再登録', keywords: ['再登録', '再入会', '再申込'] },
      { tag: 'メールアドレス', keywords: ['メールアドレス', 'email'] },
      { tag: 'パスワード再設定', keywords: ['パスワード再設定', 'パスワード再発行','パスワードリセット'] },
      { tag: 'ログイン', keywords: ['ログイン', 'サインイン'] },
      { tag: 'アカウント', keywords: ['アカウント','アカウント管理'] },
    ];

    const pushTag = (tag: string) => {
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    };

    for (const rule of tagRules) {
      const matched = tagSearchTargets.some(target =>
        rule.keywords.some(keyword => target.includes(keyword))
      );
      if (matched) {
        pushTag(rule.tag);
      }
    }
    
    // Phase 1改善: 信頼度を条件数に応じて調整（0.8, 0.9, 1.0）
    const confidence = 0.7 + (metConditions * 0.1); // 0.8, 0.9, 1.0
    
    return {
      category: finalCategory,
      domain: finalDomain,
      feature,
      status: finalStatus,
      version,
      priority,
      tags: tags.length > 0 ? tags : undefined,
      confidence,  // Phase 1改善: 条件数に応じた信頼度
      content_length: input.content.length,  // Phase 0A-1.5: コンテンツ長
      is_valid: input.content.length >= 100   // Phase 0A-1.5: 100文字未満は無効
    };
  }
  
  return null;
}

/**
 * JiraステータスをStructuredLabelのステータスにマッピング
 * Jira対応: 新規関数
 */
function mapJiraStatusToStructuredStatus(jiraStatus?: string): DocumentStatus {
  if (!jiraStatus) return 'unknown';
  
  const statusLower = jiraStatus.toLowerCase();
  
  // 完了状態（approved）
  if (statusLower.includes('完了') || statusLower.includes('done') || 
      statusLower.includes('クローズ') || statusLower.includes('close') ||
      statusLower.includes('解決済み') || statusLower.includes('resolved')) {
    return 'approved';
  }
  
  // 進行中状態（review）
  if (statusLower.includes('進行中') || statusLower.includes('in progress') || 
      statusLower.includes('処理中') || statusLower.includes('実行中') ||
      statusLower.includes('作業中') || statusLower.includes('レビュー') || 
      statusLower.includes('review') || statusLower.includes('修正待ち') ||
      statusLower.includes('調査中') || statusLower.includes('調査')) {
    return 'review';
  }
  
  // 作成中状態（draft）
  if (statusLower.includes('作成中') || statusLower.includes('to do') || 
      statusLower.includes('未着手') || statusLower.includes('open') ||
      statusLower.includes('新規') || statusLower.includes('backlog')) {
    return 'draft';
  }
  
  return 'unknown';
}

/**
 * LLMプロンプトを生成
 */
function buildLLMPrompt(
  input: z.infer<typeof InputSchema>,
  domainCandidates: string[],
  topDomains: string[],
  source: 'confluence' | 'jira' = 'confluence'
): string {
  // Phase 2改善: プロンプトの最適化（コンテンツ長を拡大、判定基準を簡略化）
  // Jira対応: ソースに応じてプロンプトを調整
  const sourceName = source === 'jira' ? 'Jira課題' : 'Confluenceページ';
  
  return `以下の${sourceName}を分析し、StructuredLabelを生成してJSON形式で出力してください。

【${sourceName}情報】
タイトル: ${input.title}
内容: ${input.content.substring(0, 1500)}...
既存ラベル: ${input.labels.join(', ')}
${source === 'jira' && (input.issueType || input.status || input.priority) ? `
【Jira特有情報】
種別: ${input.issueType || 'N/A'}
ステータス: ${input.status || 'N/A'}
優先度: ${input.priority || 'N/A'}` : ''}

【重要: この${sourceName}に関連するドメイン候補（優先的に使用）】
${domainCandidates.length > 0 ? domainCandidates.join(', ') : '（該当なし）'}

【参考: ドメイン一覧（上位30件）】
${topDomains.join(', ')}

【出力形式】
JSON形式のみ出力してください。説明文は不要です。

\`\`\`json
{
  "category": "spec|data|template|workflow|meeting|other",
  "domain": "上記のドメイン候補から選択（できるだけ既存のものを使用）",
  "feature": "クリーンな機能名（バージョン番号やステータスマーカーを除く）",
  "priority": "high|medium|low",
  "status": "draft|review|approved|deprecated|unknown",
  "version": "タイトルから抽出（例: 168_【FIX】... → \"168\"）",
  "tags": ["関連キーワード（2-5個）"],
  "confidence": 0.75
}
\`\`\`

【判定基準（簡略化）】
1. category（カテゴリ）: タイトルから推測
   - 「機能」「仕様」→ spec
   - 「帳票」「データ定義」→ data
   - 「メール」「通知」→ template
   - 「フロー」「ワークフロー」→ workflow
   - 「議事録」「ミーティング」→ meeting
   - その他 → other

2. domain（ドメイン）: ドメイン候補から選択（できるだけ既存のものを使用）

3. status（ステータス）: タイトルから推測
   - 【FIX】→ approved
   - 【作成中】→ draft
   - 【レビュー中】→ review
   - その他 → unknown

4. priority（優先度）: categoryとstatusから推測
   - spec + approved → high
   - spec + draft → medium
   - workflow → high
   - meeting/template → low
   - その他 → medium

5. feature（機能名）: タイトルからクリーンな機能名を抽出

6. tags（タグ）: コンテンツから関連キーワードを2-5個抽出

JSON形式のみ出力してください：`;
}

/**
 * 自動ラベル付けFlow（Genkit Flow）
 */
export const autoLabelFlow = ai.defineFlow(
  {
    name: 'autoLabelFlow',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
  },
  async (input) => {
    // Step 1: ルールベースで高速判定（Phase 1改善: 条件を緩和して80%以上に対応）
    const ruleBasedLabel = tryRuleBasedLabeling(input);
    // Phase 1改善: 信頼度0.8以上であればルールベース生成を使用（0.85 → 0.8に緩和）
    if (ruleBasedLabel && ruleBasedLabel.confidence && ruleBasedLabel.confidence >= 0.8) {
      return ruleBasedLabel;
    }
    
    // Step 2: LLMベースでラベル生成（20%のケース）
    try {
      // Domain Knowledgeを読み込み
      const domainKnowledge = await loadDomainKnowledge();
      
      // ドメイン候補を抽出（Jira対応: ドメイン知識を使用）
      const fullText = input.title + ' ' + input.content.substring(0, 1000);
      const domainCandidates = findDomainCandidates(fullText, domainKnowledge, 5);
      const topDomains = domainKnowledge.domainNames.slice(0, 30);
      
      // ソースを取得（デフォルトは'confluence'）
      const source = input.source || 'confluence';
      
      // プロンプト生成（Jira対応）
      const promptRaw = buildLLMPrompt(input, domainCandidates, topDomains, source);
      const promptBomCheck = checkStringForBOM(promptRaw);
      if (promptBomCheck.hasBOM) {
        console.warn('  🚨 [auto-label-flow] BOM detected in prompt', {
          firstCharCode: promptRaw.charCodeAt(0),
          preview: promptRaw.substring(0, 100)
        });
      }
      const prompt = removeBOM(promptRaw);
      if (prompt !== promptRaw) {
        console.warn('  🔧 [auto-label-flow] Prompt sanitized before AI generate', {
          beforeLength: promptRaw.length,
          afterLength: prompt.length
        });
      }
      
      // Gemini実行（一元化された設定を使用）
      // 注意: 自動ラベル付けは一貫性を重視するため、温度を低く設定
      const { text } = await ai.generate({
        model: GeminiConfig.model,
        prompt,
        config: {
          ...GeminiConfig.config,
          temperature: 0.1,  // 低温度で一貫性を重視（GeminiConfigより低く設定）
          maxOutputTokens: 500,  // 自動ラベル付けは短い出力で十分
        },
      });
      
      // JSONをパース
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      let parsed = JSON.parse(jsonText.trim());
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          throw new Error('LLM output array is empty');
        }
        parsed = parsed[0];
      }
      const result = parsed;
      
      // Phase 2改善: LLMベースの信頼度を0.75に向上（0.7 → 0.75）
      result.confidence = result.confidence || 0.75;
      
      // version・tagsのnull対策（スキーマバリデーション用）
      if (result.version === null || result.version === undefined) {
        delete result.version;  // undefinedにしてオプショナルフィールド扱い
      }
      if (result.tags === null || result.tags === undefined) {
        delete result.tags;
      }
      
      // Phase 0A-1.5: コンテンツ長と有効性を追加
      result.content_length = input.content.length;
      result.is_valid = input.content.length >= 100;
      
      return result;
      
    } catch (error: any) {
      console.error(`  ❌ LLM生成エラー: ${error.message}`);
      
      // フォールバック: ルールベースの結果を使用（信頼度を下げる）
      if (ruleBasedLabel) {
        ruleBasedLabel.confidence = 0.5;
        console.warn(`  ⚠️ フォールバック: ルールベース結果を使用（信頼度: 0.5）`);
        return ruleBasedLabel;
      }
      
      // 最終フォールバック: 基本的なラベルのみ
      return {
        category: StructuredLabelHelper.inferCategoryFromLabels(input.labels),
        domain: 'その他',
        feature: StructuredLabelHelper.cleanTitle(input.title) || 'Unknown',
        priority: 'unknown',
        status: StructuredLabelHelper.extractStatusFromTitle(input.title),
        version: StructuredLabelHelper.extractVersionFromTitle(input.title),
        confidence: 0.3,
        content_length: input.content.length,  // Phase 0A-1.5
        is_valid: input.content.length >= 100   // Phase 0A-1.5
      };
    }
  }
);

