'use client';

import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  updateDoc, 
  arrayUnion, 
  Timestamp,
  limit,
  where,
  deleteDoc
} from 'firebase/firestore';
import { app } from './firebase';
import type { Message, MessageCreate, FirestoreConversation, FirestoreMessage } from '@/types';
import { withRetry } from './retry-utils';

const db = getFirestore(app);

/**
 * 新しい会話を作成する
 * @param userId ユーザーID
 * @param initialMessage 最初のメッセージ
 */
export async function createConversation(userId: string, initialMessage: MessageCreate) {
  return withRetry(
    async () => {
      const conversationsRef = collection(db, 'users', userId, 'conversations');
      
      // 会話タイトルは最初のメッセージから生成
      const title = initialMessage.content.substring(0, 30) + (initialMessage.content.length > 30 ? '...' : '');
      
      const now = Timestamp.now();
      
      const newMessage: FirestoreMessage = {
        role: initialMessage.role,
        content: initialMessage.content,
        timestamp: now,
        ...(initialMessage.user && { user: initialMessage.user })
      };
      
      const conversation: FirestoreConversation = {
        title,
        createdAt: now,
        updatedAt: now,
        messages: [newMessage]
      };
      
      const newConversation = await addDoc(conversationsRef, conversation);
      
      console.log(`[createConversation] Created new conversation: ${newConversation.id}`);
      return newConversation.id;
    },
    {
      maxRetries: 3,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Creating conversation (${retryCount}/3) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}

/**
 * 会話にメッセージを追加する
 * @param userId ユーザーID
 * @param conversationId 会話ID
 * @param message 追加するメッセージ
 */
export async function addMessageToConversation(userId: string, conversationId: string, message: MessageCreate) {
  return withRetry(
    async () => {
      const conversationRef = doc(db, 'users', userId, 'conversations', conversationId);
      
      const now = Timestamp.now();
      
      // 新しいメッセージを作成
      const newMessage: FirestoreMessage = {
        role: message.role,
        content: message.content,
        timestamp: now,
        ...(message.sources && { sources: message.sources }),
        ...(message.user && { user: message.user })
      };
      
      // メッセージを追加し、updatedAtを更新
      await updateDoc(conversationRef, {
        messages: arrayUnion(newMessage),
        updatedAt: now
      });
      
      console.log(`[addMessageToConversation] Added message to conversation: ${conversationId}`);
    },
    {
      maxRetries: 3,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Adding message to conversation (${retryCount}/3) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}

/**
 * ユーザーの全会話を取得する
 * @param userId ユーザーID
 * @param maxResults 取得する最大件数（デフォルト: 10）
 */
export async function getConversations(userId: string, maxResults = 10) {
  return withRetry(
    async () => {
      const conversationsRef = collection(db, 'users', userId, 'conversations');
      const q = query(
        conversationsRef, 
        orderBy('updatedAt', 'desc'),
        limit(maxResults)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc: any) => ({
        id: doc.id,
        title: doc.data().title,
        lastMessage: doc.data().messages?.slice(-1)[0]?.content || '',
        timestamp: doc.data().updatedAt.toDate().toISOString()
      }));
    },
    {
      maxRetries: 2,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Fetching conversations (${retryCount}/2) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}

/**
 * 特定の会話を取得する
 * @param userId ユーザーID
 * @param conversationId 会話ID
 */
export async function getConversation(userId: string, conversationId: string) {
  return withRetry(
    async () => {
      const conversationRef = doc(db, 'users', userId, 'conversations', conversationId);
      const conversationDoc = await getDoc(conversationRef);
      
      if (!conversationDoc.exists()) {
        throw new Error('Conversation not found');
      }
      
      const data = conversationDoc.data();
      
      // messagesのtimestampをISOString形式に変換
      const messages = data.messages?.map((msg: FirestoreMessage) => ({
        id: `msg-${Math.random().toString(36).substr(2, 9)}`, // 一意のIDを生成
        role: msg.role,
        content: msg.content,
        createdAt: msg.timestamp.toDate().toISOString(),
        ...(msg.sources && { sources: msg.sources }),
        ...(msg.user && { user: msg.user })
      })) || [];
      
      return {
        id: conversationDoc.id,
        title: data.title,
        messages,
        createdAt: data.createdAt.toDate().toISOString(),
        updatedAt: data.updatedAt.toDate().toISOString()
      };
    },
    {
      maxRetries: 2,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Fetching conversation (${retryCount}/2) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}

/**
 * 会話を削除する
 * @param userId ユーザーID
 * @param conversationId 会話ID
 */
export async function deleteConversation(userId: string, conversationId: string) {
  return withRetry(
    async () => {
      const conversationRef = doc(db, 'users', userId, 'conversations', conversationId);
      await deleteDoc(conversationRef);
      console.log(`[deleteConversation] Deleted conversation: ${conversationId}`);
    },
    {
      maxRetries: 2,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Deleting conversation (${retryCount}/2) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}

/**
 * 会話のタイトルを更新する
 * @param userId ユーザーID
 * @param conversationId 会話ID
 * @param title 新しいタイトル
 */
export async function updateConversationTitle(userId: string, conversationId: string, title: string) {
  return withRetry(
    async () => {
      const conversationRef = doc(db, 'users', userId, 'conversations', conversationId);
      await updateDoc(conversationRef, { title });
      console.log(`[updateConversationTitle] Updated title for conversation: ${conversationId}`);
    },
    {
      maxRetries: 2,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Updating conversation title (${retryCount}/2) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}