import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
// import { ExtractedKnowledge } from './llm-knowledge-extractor';
interface ExtractedKnowledge {
  pageId: string;
  title: string;
  pageTitle: string;
  content: string;
  knowledge: any[];
  functions: any;
  confidence: number;
}

interface ValidationResult {
  pageId: string;
  pageTitle: string;
  isValid: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100
}

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
  suggestion?: string;
}

interface ValidationStats {
  totalPages: number;
  validPages: number;
  invalidPages: number;
  averageScore: number;
  issueCounts: {
    errors: number;
    warnings: number;
    infos: number;
  };
  commonIssues: Array<{
    issue: string;
    count: number;
    percentage: number;
  }>;
}

interface QualityReport {
  overallScore: number;
  recommendations: string[];
  validationResults: ValidationResult[];
  statistics: ValidationStats;
  generatedAt: string;
}

export class KnowledgeValidator {
  private validationRules: ValidationRule[];

  constructor() {
    this.validationRules = [
      new FunctionNameValidationRule(),
      new KeywordQualityValidationRule(),
      new ConfidenceValidationRule(),
      new CompletenessValidationRule(),
      new ConsistencyValidationRule()
    ];
  }

  async validateKnowledge(extractedKnowledge: ExtractedKnowledge[]): Promise<QualityReport> {
    console.log(`[KnowledgeValidator] Starting validation of ${extractedKnowledge.length} extractions`);

    const validationResults: ValidationResult[] = [];
    const startTime = Date.now();

    // 各抽出結果を検証
    for (const knowledge of extractedKnowledge) {
      const result = await this.validateSingleKnowledge(knowledge);
      validationResults.push(result);
    }

    // 統計情報の計算
    const statistics = this.calculateStatistics(validationResults);
    
    // 全体スコアの計算
    const overallScore = this.calculateOverallScore(validationResults);
    
    // 推奨事項の生成
    const recommendations = this.generateRecommendations(validationResults, statistics);

    const report: QualityReport = {
      overallScore,
      recommendations,
      validationResults,
      statistics,
      generatedAt: new Date().toISOString()
    };

    // レポートの保存
    await this.saveReport(report);

    console.log(`[KnowledgeValidator] Validation completed. Overall score: ${overallScore.toFixed(1)}/100`);
    return report;
  }

  private async validateSingleKnowledge(knowledge: ExtractedKnowledge): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let totalScore = 100;

    // 各ルールを適用
    for (const rule of this.validationRules) {
      const ruleResult = await rule.validate(knowledge);
      issues.push(...ruleResult.issues);
      totalScore -= ruleResult.scoreDeduction;
    }

    // スコアを0-100の範囲に調整
    const finalScore = Math.max(0, Math.min(100, totalScore));

    return {
      pageId: knowledge.pageId,
      pageTitle: knowledge.pageTitle,
      isValid: finalScore >= 70, // 70点以上を有効とする
      issues,
      score: finalScore
    };
  }

  private calculateStatistics(results: ValidationResult[]): ValidationStats {
    const totalPages = results.length;
    const validPages = results.filter(r => r.isValid).length;
    const invalidPages = totalPages - validPages;
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / totalPages;

    // 問題の集計
    const allIssues = results.flatMap(r => r.issues);
    const issueCounts = {
      errors: allIssues.filter(i => i.type === 'error').length,
      warnings: allIssues.filter(i => i.type === 'warning').length,
      infos: allIssues.filter(i => i.type === 'info').length
    };

    // よくある問題の分析
    const issueMessages = allIssues.map(i => i.message);
    const issueCountMap = new Map<string, number>();
    issueMessages.forEach(message => {
      issueCountMap.set(message, (issueCountMap.get(message) || 0) + 1);
    });

    const commonIssues = Array.from(issueCountMap.entries())
      .map(([issue, count]) => ({
        issue,
        count,
        percentage: (count / allIssues.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalPages,
      validPages,
      invalidPages,
      averageScore,
      issueCounts,
      commonIssues
    };
  }

  private calculateOverallScore(results: ValidationResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.score, 0) / results.length;
  }

  private generateRecommendations(results: ValidationResult[], stats: ValidationStats): string[] {
    const recommendations: string[] = [];

    if (stats.averageScore < 70) {
      recommendations.push('全体的な品質が低いです。プロンプトの改善を検討してください。');
    }

    if (stats.issueCounts.errors > stats.totalPages * 0.1) {
      recommendations.push('エラーが多発しています。データの前処理を改善してください。');
    }

    if (stats.issueCounts.warnings > stats.totalPages * 0.3) {
      recommendations.push('警告が多いです。抽出ルールの調整を検討してください。');
    }

    const lowConfidencePages = results.filter(r => 
      r.issues.some(i => i.message.includes('信頼度が低い'))
    ).length;

    if (lowConfidencePages > stats.totalPages * 0.2) {
      recommendations.push('信頼度の低いページが多いです。LLMの設定やプロンプトを改善してください。');
    }

    const emptyFunctionPages = results.filter(r => 
      r.issues.some(i => i.message.includes('機能が抽出されていない'))
    ).length;

    if (emptyFunctionPages > stats.totalPages * 0.1) {
      recommendations.push('機能が抽出されていないページがあります。コンテンツの品質を確認してください。');
    }

    return recommendations;
  }

  private async saveReport(report: QualityReport): Promise<void> {
    const outputDir = './data/validation';
    mkdirSync(outputDir, { recursive: true });

    // メインレポート
    const reportFile = join(outputDir, 'quality-report.json');
    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`[KnowledgeValidator] Quality report saved to: ${reportFile}`);

    // 問題のあるページの詳細レポート
    const problematicPages = report.validationResults.filter(r => !r.isValid);
    if (problematicPages.length > 0) {
      const problematicFile = join(outputDir, 'problematic-pages.json');
      writeFileSync(problematicFile, JSON.stringify(problematicPages, null, 2));
      console.log(`[KnowledgeValidator] Problematic pages report saved to: ${problematicFile}`);
    }

    // サマリーレポート（人間が読みやすい形式）
    const summaryFile = join(outputDir, 'summary-report.md');
    const summaryContent = this.generateSummaryReport(report);
    writeFileSync(summaryFile, summaryContent);
    console.log(`[KnowledgeValidator] Summary report saved to: ${summaryFile}`);
  }

  private generateSummaryReport(report: QualityReport): string {
    const { statistics, overallScore, recommendations } = report;
    
    return `# 知識抽出品質レポート

## 概要
- **全体スコア**: ${overallScore.toFixed(1)}/100
- **検証日時**: ${report.generatedAt}
- **総ページ数**: ${statistics.totalPages}
- **有効ページ数**: ${statistics.validPages} (${((statistics.validPages / statistics.totalPages) * 100).toFixed(1)}%)
- **無効ページ数**: ${statistics.invalidPages} (${((statistics.invalidPages / statistics.totalPages) * 100).toFixed(1)}%)

## 問題の内訳
- **エラー**: ${statistics.issueCounts.errors}件
- **警告**: ${statistics.issueCounts.warnings}件
- **情報**: ${statistics.issueCounts.infos}件

## よくある問題
${statistics.commonIssues.map(issue => 
  `- ${issue.issue}: ${issue.count}件 (${issue.percentage.toFixed(1)}%)`
).join('\n')}

## 推奨事項
${recommendations.map(rec => `- ${rec}`).join('\n')}

## 詳細
詳細な検証結果は \`quality-report.json\` を参照してください。
`;
  }
}

// 検証ルールの基底クラス
abstract class ValidationRule {
  abstract validate(knowledge: ExtractedKnowledge): Promise<{ issues: ValidationIssue[]; scoreDeduction: number }>;
}

// 機能名の検証ルール
class FunctionNameValidationRule extends ValidationRule {
  async validate(knowledge: ExtractedKnowledge): Promise<{ issues: ValidationIssue[]; scoreDeduction: number }> {
    const issues: ValidationIssue[] = [];
    let scoreDeduction = 0;

    const functionNames = Object.keys(knowledge.functions);

    if (functionNames.length === 0) {
      issues.push({
        type: 'error',
        message: '機能が抽出されていない',
        field: 'functions'
      });
      scoreDeduction += 30;
    }

    // 機能名の品質チェック
    functionNames.forEach(name => {
      if (name.length < 2) {
        issues.push({
          type: 'warning',
          message: `機能名が短すぎます: "${name}"`,
          field: 'functions',
          suggestion: 'より具体的な機能名を使用してください'
        });
        scoreDeduction += 5;
      }

      if (name.length > 50) {
        issues.push({
          type: 'warning',
          message: `機能名が長すぎます: "${name}"`,
          field: 'functions',
          suggestion: 'より簡潔な機能名を使用してください'
        });
        scoreDeduction += 3;
      }

      // 一般的すぎる機能名のチェック
      const genericNames = ['機能', 'システム', '管理', '処理', '操作'];
      if (genericNames.some(generic => name === generic)) {
        issues.push({
          type: 'warning',
          message: `機能名が一般的すぎます: "${name}"`,
          field: 'functions',
          suggestion: 'より具体的な機能名を使用してください'
        });
        scoreDeduction += 5;
      }
    });

    return { issues, scoreDeduction };
  }
}

// キーワード品質の検証ルール
class KeywordQualityValidationRule extends ValidationRule {
  async validate(knowledge: ExtractedKnowledge): Promise<{ issues: ValidationIssue[]; scoreDeduction: number }> {
    const issues: ValidationIssue[] = [];
    let scoreDeduction = 0;

    Object.entries(knowledge.functions).forEach(([functionName, keywords]) => {
      if (Array.isArray(keywords) && keywords.length === 0) {
        issues.push({
          type: 'error',
          message: `機能 "${functionName}" にキーワードがありません`,
          field: 'functions'
        });
        scoreDeduction += 10;
      }

      if (Array.isArray(keywords) && keywords.length > 15) {
        issues.push({
          type: 'warning',
          message: `機能 "${functionName}" のキーワードが多すぎます (${keywords.length}個)`,
          field: 'functions',
          suggestion: '重要なキーワードのみに絞り込んでください'
        });
        scoreDeduction += 3;
      }

      // キーワードの重複チェック
      if (Array.isArray(keywords)) {
        const uniqueKeywords = new Set(keywords);
        if (uniqueKeywords.size !== keywords.length) {
          issues.push({
            type: 'warning',
            message: `機能 "${functionName}" に重複するキーワードがあります`,
            field: 'functions'
          });
          scoreDeduction += 2;
        }
      }

      // キーワードの長さチェック
      if (Array.isArray(keywords)) {
        keywords.forEach(keyword => {
          if (keyword.length < 1) {
            issues.push({
              type: 'error',
              message: `空のキーワードが含まれています`,
              field: 'functions'
            });
            scoreDeduction += 5;
          }

          if (keyword.length > 30) {
            issues.push({
              type: 'warning',
              message: `キーワードが長すぎます: "${keyword}"`,
              field: 'functions',
              suggestion: 'より簡潔なキーワードを使用してください'
            });
            scoreDeduction += 2;
          }
        });
      }
    });

    return { issues, scoreDeduction };
  }
}

// 信頼度の検証ルール
class ConfidenceValidationRule extends ValidationRule {
  async validate(knowledge: ExtractedKnowledge): Promise<{ issues: ValidationIssue[]; scoreDeduction: number }> {
    const issues: ValidationIssue[] = [];
    let scoreDeduction = 0;

    if (knowledge.confidence < 0.3) {
      issues.push({
        type: 'error',
        message: '信頼度が非常に低いです',
        field: 'confidence',
        suggestion: 'プロンプトの改善を検討してください'
      });
      scoreDeduction += 20;
    } else if (knowledge.confidence < 0.6) {
      issues.push({
        type: 'warning',
        message: '信頼度が低いです',
        field: 'confidence',
        suggestion: '抽出結果の確認を推奨します'
      });
      scoreDeduction += 10;
    }

    return { issues, scoreDeduction };
  }
}

// 完全性の検証ルール
class CompletenessValidationRule extends ValidationRule {
  async validate(knowledge: ExtractedKnowledge): Promise<{ issues: ValidationIssue[]; scoreDeduction: number }> {
    const issues: ValidationIssue[] = [];
    let scoreDeduction = 0;

    // ページタイトルから期待される機能のチェック
    const title = knowledge.pageTitle.toLowerCase();
    const expectedKeywords = ['機能', '管理', 'システム', '仕様', '設計'];
    const hasExpectedKeyword = expectedKeywords.some(keyword => title.includes(keyword));

    if (hasExpectedKeyword && Object.keys(knowledge.functions).length === 0) {
      issues.push({
        type: 'warning',
        message: 'ページタイトルから機能が期待されますが、抽出されていません',
        field: 'functions',
        suggestion: 'コンテンツの品質を確認してください'
      });
      scoreDeduction += 15;
    }

    return { issues, scoreDeduction };
  }
}

// 一貫性の検証ルール
class ConsistencyValidationRule extends ValidationRule {
  async validate(knowledge: ExtractedKnowledge): Promise<{ issues: ValidationIssue[]; scoreDeduction: number }> {
    const issues: ValidationIssue[] = [];
    let scoreDeduction = 0;

    // 機能名の一貫性チェック
    const functionNames = Object.keys(knowledge.functions);
    const similarNames = this.findSimilarNames(functionNames);

    if (similarNames.length > 0) {
      issues.push({
        type: 'info',
        message: `類似する機能名が見つかりました: ${similarNames.join(', ')}`,
        field: 'functions',
        suggestion: '機能名の統一を検討してください'
      });
      scoreDeduction += 3;
    }

    return { issues, scoreDeduction };
  }

  private findSimilarNames(names: string[]): string[] {
    const similar: string[] = [];
    
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const similarity = this.calculateSimilarity(names[i], names[j]);
        if (similarity > 0.7) {
          similar.push(`${names[i]} ↔ ${names[j]}`);
        }
      }
    }

    return similar;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

// 実行スクリプト
async function main() {
  const extractedKnowledgePath = './data/llm-extraction/extracted-knowledge.json';
  const extractedKnowledge: ExtractedKnowledge[] = JSON.parse(readFileSync(extractedKnowledgePath, 'utf-8'));

  const validator = new KnowledgeValidator();
  
  try {
    const report = await validator.validateKnowledge(extractedKnowledge);
    console.log('Validation completed successfully!');
    console.log(`Overall score: ${report.overallScore.toFixed(1)}/100`);
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { type ValidationResult, type ValidationIssue, type ValidationStats, type QualityReport };
