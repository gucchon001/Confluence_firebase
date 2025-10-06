/**
 * 質問ログ分析サービス
 * 頻出質問、回答品質、ユーザー満足度の分析機能を提供
 */

import { getFirestore } from 'firebase/firestore';
import { app } from '@/lib/firebase';

const db = getFirestore(app);
import { collection, query, orderBy, limit, where, getDocs, Timestamp } from 'firebase/firestore';
import type { PostLog } from '@/types';

export interface QuestionAnalysis {
  // 頻出質問分析
  frequentQuestions: {
    question: string;
    count: number;
    lastAsked: Date;
    averageResponseTime: number;
    qualityScore: number;
  }[];
  
  // 回答品質分析
  qualityMetrics: {
    averageAnswerLength: number;
    averageReferencesCount: number;
    qualityDistribution: {
      high: number;
      medium: number;
      low: number;
    };
    qualityTrend: {
      date: string;
      averageQuality: number;
    }[];
  };
  
  // ユーザー満足度分析
  satisfactionMetrics: {
    averageSessionDuration: number;
    questionContinuityRate: number;
    errorRate: number;
    satisfactionTrend: {
      date: string;
      satisfaction: number;
    }[];
  };
  
  // 質問タイプ分析
  questionTypes: {
    functional: number;
    technical: number;
    general: number;
    other: number;
  };
}

export interface QuestionPattern {
  pattern: string;
  count: number;
  examples: string[];
  averageQuality: number;
}

export class QuestionAnalysisService {
  /**
   * 質問ログから分析データを取得
   */
  async getQuestionAnalysis(days: number = 30): Promise<QuestionAnalysis> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      // 投稿ログを取得
      const postLogsRef = collection(db, 'postLogs');
      const q = query(
        postLogsRef,
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const postLogs: PostLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
        processingSteps: doc.data().processingSteps?.map((step: any) => ({
          ...step,
          timestamp: step.timestamp.toDate()
        })) || [],
        errors: doc.data().errors?.map((error: any) => ({
          ...error,
          timestamp: error.timestamp.toDate(),
          resolvedAt: error.resolvedAt?.toDate()
        })) || []
      })) as PostLog[];

      console.log(`📊 質問分析: ${postLogs.length}件のログを分析中`);

      // 各分析を実行
      const [frequentQuestions, qualityMetrics, satisfactionMetrics, questionTypes] = await Promise.all([
        this.analyzeFrequentQuestions(postLogs),
        this.analyzeQualityMetrics(postLogs),
        this.analyzeSatisfactionMetrics(postLogs),
        this.analyzeQuestionTypes(postLogs)
      ]);

      return {
        frequentQuestions,
        qualityMetrics,
        satisfactionMetrics,
        questionTypes
      };
    } catch (error) {
      console.error('❌ 質問分析エラー:', error);
      throw error;
    }
  }

  /**
   * 頻出質問分析
   */
  private async analyzeFrequentQuestions(postLogs: PostLog[]) {
    const questionMap = new Map<string, {
      count: number;
      totalResponseTime: number;
      totalQuality: number;
      lastAsked: Date;
      examples: string[];
    }>();

    // 質問を正規化してカウント
    postLogs.forEach(log => {
      const normalizedQuestion = this.normalizeQuestion(log.question);
      const existing = questionMap.get(normalizedQuestion);
      
      if (existing) {
        existing.count++;
        existing.totalResponseTime += log.totalTime;
        existing.totalQuality += this.calculateQualityScore(log);
        if (log.timestamp > existing.lastAsked) {
          existing.lastAsked = log.timestamp;
        }
        existing.examples.push(log.question);
      } else {
        questionMap.set(normalizedQuestion, {
          count: 1,
          totalResponseTime: log.totalTime,
          totalQuality: this.calculateQualityScore(log),
          lastAsked: log.timestamp,
          examples: [log.question]
        });
      }
    });

    // ランキング作成
    const frequentQuestions = Array.from(questionMap.entries())
      .map(([question, data]) => ({
        question,
        count: data.count,
        lastAsked: data.lastAsked,
        averageResponseTime: data.totalResponseTime / data.count,
        qualityScore: data.totalQuality / data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // 上位20件

    console.log(`📈 頻出質問分析完了: ${frequentQuestions.length}件`);
    return frequentQuestions;
  }

  /**
   * 回答品質分析
   */
  private async analyzeQualityMetrics(postLogs: PostLog[]) {
    const qualityScores = postLogs.map(log => this.calculateQualityScore(log));
    
    const qualityDistribution = {
      high: qualityScores.filter(score => score > 0.8).length,
      medium: qualityScores.filter(score => score > 0.5 && score <= 0.8).length,
      low: qualityScores.filter(score => score <= 0.5).length
    };

    // 日別品質トレンド
    const dailyQuality = new Map<string, { total: number; count: number }>();
    postLogs.forEach(log => {
      const date = log.timestamp.toISOString().split('T')[0];
      const existing = dailyQuality.get(date) || { total: 0, count: 0 };
      existing.total += this.calculateQualityScore(log);
      existing.count++;
      dailyQuality.set(date, existing);
    });

    const qualityTrend = Array.from(dailyQuality.entries())
      .map(([date, data]) => ({
        date,
        averageQuality: data.total / data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const qualityMetrics = {
      averageAnswerLength: postLogs.reduce((sum, log) => sum + log.answerLength, 0) / postLogs.length,
      averageReferencesCount: postLogs.reduce((sum, log) => sum + log.referencesCount, 0) / postLogs.length,
      qualityDistribution,
      qualityTrend
    };

    console.log(`📊 品質分析完了: 平均品質 ${(qualityMetrics.averageAnswerLength / 1000).toFixed(1)}k文字`);
    return qualityMetrics;
  }

  /**
   * ユーザー満足度分析
   */
  private async analyzeSatisfactionMetrics(postLogs: PostLog[]) {
    // セッション分析
    const sessionMap = new Map<string, PostLog[]>();
    postLogs.forEach(log => {
      const sessionId = log.metadata?.sessionId || 'unknown';
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, []);
      }
      sessionMap.get(sessionId)!.push(log);
    });

    const sessions = Array.from(sessionMap.values());
    const averageSessionDuration = sessions.reduce((sum, session) => {
      if (session.length > 1) {
        const duration = session[session.length - 1].timestamp.getTime() - session[0].timestamp.getTime();
        return sum + duration;
      }
      return sum;
    }, 0) / sessions.length;

    const questionContinuityRate = sessions.filter(session => session.length > 1).length / sessions.length;
    const errorRate = postLogs.filter(log => log.errors && log.errors.length > 0).length / postLogs.length;

    // 日別満足度トレンド
    const dailySatisfaction = new Map<string, { total: number; count: number }>();
    postLogs.forEach(log => {
      const date = log.timestamp.toISOString().split('T')[0];
      const satisfaction = this.calculateSatisfactionScore(log);
      const existing = dailySatisfaction.get(date) || { total: 0, count: 0 };
      existing.total += satisfaction;
      existing.count++;
      dailySatisfaction.set(date, existing);
    });

    const satisfactionTrend = Array.from(dailySatisfaction.entries())
      .map(([date, data]) => ({
        date,
        satisfaction: data.total / data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const satisfactionMetrics = {
      averageSessionDuration,
      questionContinuityRate,
      errorRate,
      satisfactionTrend
    };

    console.log(`😊 満足度分析完了: 継続率 ${(questionContinuityRate * 100).toFixed(1)}%`);
    return satisfactionMetrics;
  }

  /**
   * 質問タイプ分析
   */
  private async analyzeQuestionTypes(postLogs: PostLog[]) {
    const questionTypes = {
      functional: 0,  // 機能仕様に関する質問
      technical: 0,   // 技術的な質問
      general: 0,     // 一般的な質問
      other: 0        // その他
    };

    postLogs.forEach(log => {
      const questionType = this.classifyQuestionType(log.question);
      questionTypes[questionType]++;
    });

    console.log(`🏷️ 質問タイプ分析完了: 機能 ${questionTypes.functional}, 技術 ${questionTypes.technical}, 一般 ${questionTypes.general}`);
    return questionTypes;
  }

  /**
   * 質問の正規化（類似質問をグループ化）
   */
  private normalizeQuestion(question: string): string {
    // 基本的な正規化
    return question
      .toLowerCase()
      .replace(/[「」『』【】（）()]/g, '')
      .replace(/[、。！？]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100); // 長すぎる質問は切り詰め
  }

  /**
   * 回答品質スコアの計算
   */
  private calculateQualityScore(log: PostLog): number {
    let score = 0;
    
    // 回答長さスコア (0-0.3)
    const lengthScore = Math.min(log.answerLength / 2000, 0.3);
    score += lengthScore;
    
    // 参照元数スコア (0-0.3)
    const referenceScore = Math.min(log.referencesCount / 10, 0.3);
    score += referenceScore;
    
    // 処理時間スコア (0-0.2) - 適度な処理時間が良い
    const timeScore = log.totalTime > 5000 && log.totalTime < 30000 ? 0.2 : 
                     log.totalTime < 5000 ? 0.1 : 0.15;
    score += timeScore;
    
    // エラー率スコア (0-0.2)
    const errorScore = (log.errors && log.errors.length > 0) ? 0 : 0.2;
    score += errorScore;
    
    return Math.min(score, 1.0);
  }

  /**
   * 満足度スコアの計算
   */
  private calculateSatisfactionScore(log: PostLog): number {
    let score = 0.5; // ベーススコア
    
    // 品質スコアに基づく調整
    const qualityScore = this.calculateQualityScore(log);
    score += (qualityScore - 0.5) * 0.6;
    
    // エラー率による調整
    if (log.errors && log.errors.length > 0) {
      score -= 0.3;
    }
    
    // 処理時間による調整
    if (log.totalTime > 60000) { // 1分以上
      score -= 0.2;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 質問タイプの分類
   */
  private classifyQuestionType(question: string): 'functional' | 'technical' | 'general' | 'other' {
    const functionalKeywords = ['機能', '仕様', '画面', 'ボタン', '入力', '表示', '遷移', 'ログイン', '会員', '管理'];
    const technicalKeywords = ['API', 'データベース', 'エラー', 'ログ', '設定', '接続', 'サーバー', 'デプロイ', '環境'];
    
    const lowerQuestion = question.toLowerCase();
    
    if (functionalKeywords.some(keyword => lowerQuestion.includes(keyword))) {
      return 'functional';
    }
    
    if (technicalKeywords.some(keyword => lowerQuestion.includes(keyword))) {
      return 'technical';
    }
    
    if (lowerQuestion.length < 20) {
      return 'general';
    }
    
    return 'other';
  }

  /**
   * 質問パターンの分析
   */
  async getQuestionPatterns(days: number = 30): Promise<QuestionPattern[]> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const postLogsRef = collection(db, 'postLogs');
      const q = query(
        postLogsRef,
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const postLogs: PostLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as PostLog[];

      // 質問パターンの抽出
      const patternMap = new Map<string, {
        count: number;
        totalQuality: number;
        examples: string[];
      }>();

      postLogs.forEach(log => {
        const patterns = this.extractQuestionPatterns(log.question);
        patterns.forEach(pattern => {
          const existing = patternMap.get(pattern) || { count: 0, totalQuality: 0, examples: [] };
          existing.count++;
          existing.totalQuality += this.calculateQualityScore(log);
          if (existing.examples.length < 3) {
            existing.examples.push(log.question);
          }
          patternMap.set(pattern, existing);
        });
      });

      const questionPatterns = Array.from(patternMap.entries())
        .map(([pattern, data]) => ({
          pattern,
          count: data.count,
          examples: data.examples,
          averageQuality: data.totalQuality / data.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15); // 上位15パターン

      console.log(`🔍 質問パターン分析完了: ${questionPatterns.length}パターン`);
      return questionPatterns;
    } catch (error) {
      console.error('❌ 質問パターン分析エラー:', error);
      throw error;
    }
  }

  /**
   * 質問からパターンを抽出
   */
  private extractQuestionPatterns(question: string): string[] {
    const patterns: string[] = [];
    
    // 「〜とは？」パターン
    if (question.includes('とは') || question.includes('って何')) {
      patterns.push('定義・説明');
    }
    
    // 「〜方法」パターン
    if (question.includes('方法') || question.includes('やり方') || question.includes('どうやって')) {
      patterns.push('方法・手順');
    }
    
    // 「〜機能」パターン
    if (question.includes('機能')) {
      patterns.push('機能説明');
    }
    
    // 「〜設定」パターン
    if (question.includes('設定') || question.includes('構成')) {
      patterns.push('設定・構成');
    }
    
    // 「〜エラー」パターン
    if (question.includes('エラー') || question.includes('エラー') || question.includes('問題')) {
      patterns.push('エラー・問題');
    }
    
    // パターンが見つからない場合は一般的なパターン
    if (patterns.length === 0) {
      patterns.push('一般的な質問');
    }
    
    return patterns;
  }
}

export const questionAnalysisService = new QuestionAnalysisService();
