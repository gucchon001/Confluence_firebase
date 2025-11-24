/**
 * Jira検索結果のFirestore補完サービス
 * 
 * 目的: 検索時にFirestoreから追加情報（カスタムフィールド、全コメント履歴等）を取得して検索結果を補完
 */

import admin from 'firebase-admin';
import { initializeFirebaseAdmin } from './firebase-admin-init';

initializeFirebaseAdmin();

const firestore = admin.firestore();

export interface LanceDBSearchResult {
  id: string;
  issue_key?: string;
  title: string;
  content: string;
  status?: string;
  status_category?: string;
  priority?: string;
  assignee?: string;
  issue_type?: string;
  [key: string]: any;
}

export interface EnrichedSearchResult extends LanceDBSearchResult {
  // カスタムフィールド
  customFields?: {
    month?: string;
    customAssignee?: string;
    gigStatus?: string;
    releaseDate?: string;
    completedDate?: string;
    desiredReleaseDate?: string;
    deadlineReleaseDate?: string;
    impactDomain?: string;
    impactLevel?: string;
    devValidation?: string;
    prodValidation?: string;
  };
  // 全コメント履歴
  comments?: Array<{
    id?: string;
    author: string;
    created: string;
    body: string;
  }>;
  // その他のメタデータ
  metadata?: {
    syncedAt?: Date;
  };
}

export class JiraFirestoreEnrichmentService {
  private static instance: JiraFirestoreEnrichmentService;

  private constructor() {}

  public static getInstance(): JiraFirestoreEnrichmentService {
    if (!JiraFirestoreEnrichmentService.instance) {
      JiraFirestoreEnrichmentService.instance = new JiraFirestoreEnrichmentService();
    }
    return JiraFirestoreEnrichmentService.instance;
  }

  /**
   * 検索結果をFirestoreから取得したデータで補完
   * @param results LanceDBからの検索結果
   * @param limit 補完する最大件数（パフォーマンス考慮、デフォルト: 10件）
   * @returns 補完された検索結果
   */
  async enrichSearchResults(
    results: LanceDBSearchResult[],
    limit: number = 10
  ): Promise<EnrichedSearchResult[]> {
    if (!results || results.length === 0) {
      return [];
    }

    // 補完対象を制限（パフォーマンス考慮）
    const resultsToEnrich = results.slice(0, limit);
    
    // issue_keyを抽出
    const issueKeys = resultsToEnrich
      .map(r => r.issue_key || r.id)
      .filter(Boolean) as string[];

    if (issueKeys.length === 0) {
      return results as EnrichedSearchResult[];
    }

    try {
      // Firestoreからバッチ取得
      const docs = await Promise.all(
        issueKeys.map(key => firestore.collection('jiraIssues').doc(key).get())
      );

      // issue_keyでマップを作成
      const firestoreDataMap = new Map<string, admin.firestore.DocumentData>();
      for (let i = 0; i < issueKeys.length; i++) {
        const doc = docs[i];
        if (doc.exists) {
          firestoreDataMap.set(issueKeys[i], doc.data()!);
        }
      }

      // 検索結果を補完
      return results.map(result => {
        const issueKey = result.issue_key || result.id;
        const firestoreData = firestoreDataMap.get(issueKey);

        if (!firestoreData) {
          // Firestoreにデータがない場合は、LanceDBのデータのみを返す
          return result as EnrichedSearchResult;
        }

        // カスタムフィールドを抽出
        const customFields = {
          month: firestoreData.month || undefined,
          customAssignee: firestoreData.customAssignee || undefined,
          gigStatus: firestoreData.gigStatus || undefined,
          releaseDate: firestoreData.releaseDate || undefined,
          completedDate: firestoreData.completedDate || undefined,
          desiredReleaseDate: firestoreData.desiredReleaseDate || undefined,
          deadlineReleaseDate: firestoreData.deadlineReleaseDate || undefined,
          impactDomain: firestoreData.impactDomain || undefined,
          impactLevel: firestoreData.impactLevel || undefined,
          devValidation: firestoreData.devValidation || undefined,
          prodValidation: firestoreData.prodValidation || undefined
        };

        // 空のフィールドを除外
        const cleanedCustomFields = Object.fromEntries(
          Object.entries(customFields).filter(([_, value]) => value !== undefined && value !== '')
        );

        // コメント履歴を取得
        const comments = firestoreData.comments || [];
        const cleanedComments = comments.length > 0 ? comments : undefined;

        // メタデータを取得
        const syncedAt = firestoreData.syncedAt 
          ? (firestoreData.syncedAt as admin.firestore.Timestamp).toDate()
          : undefined;

        const enriched: EnrichedSearchResult = {
          ...result,
          ...(Object.keys(cleanedCustomFields).length > 0 && { 
            customFields: cleanedCustomFields as any 
          }),
          ...(cleanedComments && { comments: cleanedComments }),
          ...(syncedAt && {
            metadata: { syncedAt }
          })
        };

        return enriched;
      });
    } catch (error) {
      // エラーが発生した場合、LanceDBのデータのみを返す（フォールバック）
      console.error('[JiraFirestoreEnrichmentService] Failed to enrich results:', error);
      return results as EnrichedSearchResult[];
    }
  }
}

