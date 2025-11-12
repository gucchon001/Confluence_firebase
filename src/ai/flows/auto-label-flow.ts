/**
 * 自動ラベル付けFlow
 * Phase 0A-1: ConfluenceページからStructuredLabelを自動生成
 */

import { ai } from '../genkit';
import { z } from 'zod';
import { loadDomainKnowledge, findDomainCandidates, findTermCandidates } from '@/lib/domain-knowledge-loader';
import { StructuredLabelHelper } from '@/types/structured-label';
import { removeBOM, checkStringForBOM } from '@/lib/bom-utils';
import type { StructuredLabel, DocumentCategory, DocumentStatus } from '@/types/structured-label';

// 入力スキーマ
const InputSchema = z.object({
  title: z.string(),
  content: z.string(),
  labels: z.array(z.string()),
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
function tryRuleBasedLabeling(input: z.infer<typeof InputSchema>): StructuredLabel | null {
  const status = StructuredLabelHelper.extractStatusFromTitle(input.title);
  const version = StructuredLabelHelper.extractVersionFromTitle(input.title);
  const category = StructuredLabelHelper.inferCategoryFromLabels(input.labels);
  const domain = StructuredLabelHelper.inferDomainFromContent(input.title, input.content.substring(0, 1000));
  
  // ルールで主要フィールドを決定できた場合
  if (status !== 'unknown' && category !== 'other' && domain !== 'その他') {
    const feature = StructuredLabelHelper.cleanTitle(input.title);
    const priority = StructuredLabelHelper.inferPriority(category, status);
    
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
    
    return {
      category,
      domain,
      feature,
      status,
      version,
      priority,
      tags: tags.length > 0 ? tags : undefined,
      confidence: 0.9,  // ルールベースの信頼度
      content_length: input.content.length,  // Phase 0A-1.5: コンテンツ長
      is_valid: input.content.length >= 100   // Phase 0A-1.5: 100文字未満は無効
    };
  }
  
  return null;
}

/**
 * LLMプロンプトを生成
 */
function buildLLMPrompt(
  input: z.infer<typeof InputSchema>,
  domainCandidates: string[],
  topDomains: string[]
): string {
  return `以下のConfluenceページを分析し、StructuredLabelを生成してJSON形式で出力してください。

【ページ情報】
タイトル: ${input.title}
内容: ${input.content.substring(0, 1000)}...
既存ラベル: ${input.labels.join(', ')}

【参考: このページに関連するドメイン候補】
${domainCandidates.length > 0 ? domainCandidates.join(', ') : '（該当なし）'}

【参考: ドメイン一覧（上位30件）】
${topDomains.join(', ')}

【出力形式】
JSON形式のみ出力してください。説明文は不要です。

\`\`\`json
{
  "category": "spec|data|template|workflow|meeting|other",
  "domain": "上記のドメイン一覧から選択（できるだけ既存のものを使用）",
  "feature": "クリーンな機能名（バージョン番号やステータスマーカーを除く）",
  "priority": "high|medium|low",
  "status": "draft|review|approved|deprecated|unknown",
  "version": "タイトルから抽出（例: 168_【FIX】... → \"168\"）",
  "tags": ["関連キーワード（2-5個）"],
  "confidence": 0.7
}
\`\`\`

【判定基準】
1. category（カテゴリ）:
   - タイトルに「機能」「仕様」含む → "spec"
   - タイトルに「帳票」「データ定義」含む → "data"
   - タイトルに「メール」「通知」含む → "template"
   - タイトルに「フロー」「ワークフロー」含む → "workflow"
   - タイトルに「議事録」「ミーティング」含む → "meeting"
   - その他 → "other"

2. status（ステータス）:
   - 【FIX】含む → "approved"
   - 【作成中】含む → "draft"
   - 【レビュー中】含む → "review"
   - その他 → "unknown"

3. priority（優先度）:
   - category="spec" AND status="approved" → "high"
   - category="spec" AND status="draft" → "medium"
   - category="workflow" → "high"
   - category="meeting" OR category="template" → "low"
   - その他 → "medium"

4. domain（ドメイン）:
   - 必ず上記のドメイン一覧から選択してください
   - 新しいドメインを作成する場合は、既存のパターンに従ってください
   
5. feature（機能名）:
   - タイトルから「168_」などのバージョン番号を除く
   - 「【FIX】」「【作成中】」などのステータスマーカーを除く
   - クリーンな機能名のみを抽出

6. tags（タグ）:
   - コンテンツから関連キーワードを2-5個抽出
   - 例: ["コピー", "一括処理", "管理画面"]

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
    // Step 1: ルールベースで高速判定（80%のケースに対応）
    const ruleBasedLabel = tryRuleBasedLabeling(input);
    if (ruleBasedLabel && ruleBasedLabel.confidence && ruleBasedLabel.confidence >= 0.85) {
      return ruleBasedLabel;
    }
    
    // Step 2: LLMベースでラベル生成（20%のケース）
    try {
      // Domain Knowledgeを読み込み
      const domainKnowledge = await loadDomainKnowledge();
      
      // ドメイン候補を抽出
      const fullText = input.title + ' ' + input.content.substring(0, 1000);
      const domainCandidates = findDomainCandidates(fullText, domainKnowledge, 5);
      const topDomains = domainKnowledge.domainNames.slice(0, 30);
      
      // プロンプト生成
      const promptRaw = buildLLMPrompt(input, domainCandidates, topDomains);
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
      
      // Gemini 2.0 Flash実行
      const { text } = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt,
        config: {
          temperature: 0.1,  // 低温度で一貫性を重視
          maxOutputTokens: 500,
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
      
      // 信頼度を設定（LLMベース）
      result.confidence = result.confidence || 0.7;
      
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

