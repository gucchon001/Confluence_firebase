'use client';

import { getFirestore, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { app } from './firebase';
import type { User } from 'firebase/auth';
import type { UserProfile } from '@/types';

const db = getFirestore(app);

/**
 * ユーザー情報をFirestoreに保存または更新する
 * @param user Firebase認証から取得したユーザー情報
 */
export async function createOrUpdateUser(user: User) {
  try {
    const userRef = doc(db, 'users', user.uid);
    
    // 既存のユーザードキュメントを確認
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // 新規ユーザーの場合
      console.log(`[createOrUpdateUser] Creating new user: ${user.uid}`);
      const userData: UserProfile = {
        uid: user.uid,
        displayName: user.displayName || null,
        email: user.email || '',
        createdAt: new Date()
      };
      await setDoc(userRef, {
        ...userData,
        createdAt: Timestamp.fromDate(userData.createdAt)
      });
    } else {
      // 既存ユーザーの場合は必要に応じて更新
      console.log(`[createOrUpdateUser] Updating existing user: ${user.uid}`);
      await setDoc(userRef, {
        displayName: user.displayName || null,
        email: user.email
      }, { merge: true });
    }
    
    return true;
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
}

/**
 * ユーザー情報を取得する
 * @param userId ユーザーID
 */
export async function getUser(userId: string) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    return {
      id: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
}
