'use client';

import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  query, 
  orderBy, 
  Timestamp,
  writeBatch,
  limit,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { app } from './firebase';
import { createConversation, addMessageToConversation } from './conversation-service';
import { createOrUpdateUser } from './user-service';
import type { User } from 'firebase/auth';

const db = getFirestore(app);

/**
 * 既存のchatsコレクションからusers/{userId}/conversations構造へデータを移行する
 * @param userId ユーザーID
 * @param user ユーザー情報
 * @param batchSize 一度に処理するメッセージ数（デフォルト: 50）
 * @returns 移行した会話の数
 */
export async function migrateUserData(userId: string, user: User, batchSize = 50) {
  try {
    console.log(`[migrateUserData] Starting migration for user: ${userId}`);
    
    // ユーザー情報を保存/更新
    await createOrUpdateUser(user);
    
    // 既存のメッセージを取得
    const messagesCol = collection(db, 'chats', userId, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'), limit(batchSize));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log(`[migrateUserData] No messages found for user: ${userId}`);
      return 0;
    }
    
    // メッセージをグループ化して会話に変換
    const messages = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate().toISOString() 
          : data.createdAt
      };
    });
    
    console.log(`[migrateUserData] Found ${messages.length} messages to migrate`);
    
    // 会話を作成
    let currentConversationId = null;
    let conversationCount = 0;
    let messageGroups: any[] = [];
    let currentGroup: any[] = [];
    
    // メッセージをグループ化（ユーザーとアシスタントのペアごと）
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      currentGroup.push(message);
      
      // ユーザーとアシスタントのペアが揃ったら、または最後のメッセージの場合
      if (
        (currentGroup.length >= 2 && 
         currentGroup.some(m => m.role === 'user') && 
         currentGroup.some(m => m.role === 'assistant')) ||
        i === messages.length - 1
      ) {
        messageGroups.push([...currentGroup]);
        currentGroup = [];
      }
    }
    
    // 残りのメッセージがあれば追加
    if (currentGroup.length > 0) {
      messageGroups.push(currentGroup);
    }
    
    console.log(`[migrateUserData] Created ${messageGroups.length} message groups`);
    
    // 各グループを会話に変換
    for (const group of messageGroups) {
      // ユーザーのメッセージを見つける（最初のユーザーメッセージを使用）
      const userMessage = group.find((m: any) => m.role === 'user');
      
      if (!userMessage) {
        console.log(`[migrateUserData] Skipping group without user message`);
        continue;
      }
      
      try {
        // 新しい会話を作成
        const newConversationId = await createConversation(userId, {
          role: userMessage.role,
          content: userMessage.content,
          user: userMessage.user
        });
        
        // 残りのメッセージを追加
        for (const message of group) {
          if (message.id === userMessage.id) continue; // 最初のメッセージはスキップ（既に追加済み）
          
          await addMessageToConversation(userId, newConversationId, {
            role: message.role,
            content: message.content,
            ...(message.sources && { sources: message.sources }),
            ...(message.user && { user: message.user })
          });
        }
        
        conversationCount++;
        console.log(`[migrateUserData] Created conversation: ${newConversationId}`);
      } catch (error) {
        console.error(`[migrateUserData] Error creating conversation:`, error);
      }
    }
    
    console.log(`[migrateUserData] Migration completed. Created ${conversationCount} conversations.`);
    return conversationCount;
  } catch (error) {
    console.error(`[migrateUserData] Migration failed:`, error);
    throw error;
  }
}

/**
 * 移行ステータスを管理する
 * @param userId ユーザーID
 * @param status 移行ステータス
 */
export async function updateMigrationStatus(userId: string, status: {
  completed: boolean;
  timestamp: Date;
  conversationCount: number;
  error?: string;
}) {
  try {
    const migrationRef = doc(db, 'users', userId, 'system', 'migration');
    await setDoc(migrationRef, {
      ...status,
      timestamp: Timestamp.fromDate(status.timestamp)
    });
    console.log(`[updateMigrationStatus] Updated migration status for user: ${userId}`);
  } catch (error) {
    console.error(`[updateMigrationStatus] Failed to update migration status:`, error);
  }
}

/**
 * 移行ステータスを取得する
 * @param userId ユーザーID
 */
export async function getMigrationStatus(userId: string) {
  try {
    const migrationRef = doc(db, 'users', userId, 'system', 'migration');
    const migrationDoc = await getDoc(migrationRef);
    
    if (!migrationDoc.exists()) {
      return null;
    }
    
    const data = migrationDoc.data();
    return {
      ...data,
      timestamp: data.timestamp instanceof Timestamp 
        ? data.timestamp.toDate() 
        : new Date(data.timestamp)
    };
  } catch (error) {
    console.error(`[getMigrationStatus] Failed to get migration status:`, error);
    return null;
  }
}
