/**
 * Firestoreクエリビルダー
 * 共通のクエリパターンを提供し、コード重複を削減
 */

import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp, 
  Query,
  CollectionReference,
  DocumentData
} from 'firebase/firestore';

/**
 * Firestoreクエリビルダー
 * 共通のクエリパターンを提供
 */
export class FirestoreQueryBuilder<T = DocumentData> {
  private collectionName: string;
  private db: any;
  
  constructor(collectionName: string, db: any) {
    this.collectionName = collectionName;
    this.db = db;
  }
  
  /**
   * コレクション参照を取得
   */
  private getCollectionRef(): CollectionReference {
    return collection(this.db, this.collectionName);
  }
  
  /**
   * 日付範囲でフィルタリング
   */
  byDateRange(
    startDate: Date, 
    endDate: Date, 
    fieldName: string = 'timestamp'
  ): Query {
    const ref = this.getCollectionRef();
    return query(
      ref,
      where(fieldName, '>=', Timestamp.fromDate(startDate)),
      where(fieldName, '<=', Timestamp.fromDate(endDate)),
      orderBy(fieldName, 'desc')
    );
  }
  
  /**
   * 過去N日間のデータを取得
   */
  byLastDays(
    days: number, 
    fieldName: string = 'timestamp',
    limitCount?: number
  ): Query {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
    
    const ref = this.getCollectionRef();
    let q: Query = query(
      ref,
      where(fieldName, '>=', Timestamp.fromDate(startDate)),
      orderBy(fieldName, 'desc')
    );
    
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    return q;
  }
  
  /**
   * ユーザーIDでフィルタリング
   */
  byUser(userId: string, limitCount?: number, fieldName: string = 'timestamp'): Query {
    const ref = this.getCollectionRef();
    let q: Query = query(
      ref,
      where('userId', '==', userId),
      orderBy(fieldName, 'desc')
    );
    
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    return q;
  }
  
  /**
   * 最新のN件を取得
   */
  recent(limitCount: number, fieldName: string = 'timestamp'): Query {
    const ref = this.getCollectionRef();
    return query(
      ref,
      orderBy(fieldName, 'desc'),
      limit(limitCount)
    );
  }
  
  /**
   * 条件付きフィルタリング
   */
  where(field: string, operator: any, value: any): Query {
    const ref = this.getCollectionRef();
    return query(ref, where(field, operator, value));
  }
  
  /**
   * 複数条件でのフィルタリング
   */
  whereMultiple(
    conditions: Array<{ field: string; operator: any; value: any }>,
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'desc',
    limitCount?: number
  ): Query {
    const ref = this.getCollectionRef();
    const constraints: any[] = conditions.map(c => where(c.field, c.operator, c.value));
    
    if (orderByField) {
      constraints.push(orderBy(orderByField, orderDirection));
    }
    
    if (limitCount) {
      constraints.push(limit(limitCount));
    }
    
    return query(ref, ...constraints);
  }
}

/**
 * クエリビルダーのファクトリー関数
 */
export function createQueryBuilder<T = DocumentData>(
  collectionName: string, 
  db: any
): FirestoreQueryBuilder<T> {
  return new FirestoreQueryBuilder<T>(collectionName, db);
}

