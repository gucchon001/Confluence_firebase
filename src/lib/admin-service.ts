'use client';

import { getFirestore, collection, doc, getDocs, updateDoc, getDoc, setDoc, query, where, orderBy } from 'firebase/firestore';
import { app } from './firebase';
import type { AdminUser, UserProfile } from '@/types';

const db = getFirestore(app);

/**
 * 管理者サービス
 * 管理者権限の確認、ユーザー管理、管理者設定を行う
 */
export class AdminService {
  private static instance: AdminService;
  private readonly DEFAULT_ADMIN_EMAIL = 'y-haraguchi@tomonokai-corp.com';

  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  /**
   * ユーザーが管理者かどうかを確認
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return false;
      }

      const userData = userDoc.data() as UserProfile;
      return userData.isAdmin === true;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * デフォルト管理者を初期設定
   */
  async initializeDefaultAdmin(): Promise<void> {
    try {
      // デフォルト管理者のユーザードキュメントを探す
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', this.DEFAULT_ADMIN_EMAIL));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn('Default admin user not found in Firestore');
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as UserProfile;

      // 既に管理者権限がある場合は何もしない
      if (userData.isAdmin === true) {
        console.log('Default admin already has admin privileges');
        return;
      }

      // 管理者権限を付与
      await updateDoc(userDoc.ref, {
        isAdmin: true,
        adminGrantedAt: new Date(),
        adminGrantedBy: 'system'
      });

      console.log('Default admin privileges granted to:', this.DEFAULT_ADMIN_EMAIL);
    } catch (error) {
      console.error('Error initializing default admin:', error);
    }
  }

  /**
   * 全ユーザー一覧を取得（管理者のみ）
   */
  async getAllUsers(): Promise<AdminUser[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => {
        const data = doc.data() as UserProfile;
        return {
          uid: data.uid,
          displayName: data.displayName,
          email: data.email,
          createdAt: data.createdAt instanceof Date ? data.createdAt : (data.createdAt as any)?.toDate?.() || new Date(),
          isAdmin: data.isAdmin || false,
          adminGrantedAt: data.adminGrantedAt instanceof Date ? data.adminGrantedAt : (data.adminGrantedAt as any)?.toDate?.() || null,
          adminGrantedBy: data.adminGrantedBy
        };
      });
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  /**
   * 管理者権限を付与
   */
  async grantAdminPrivileges(userId: string, grantedBy: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isAdmin: true,
        adminGrantedAt: new Date(),
        adminGrantedBy: grantedBy
      });

      console.log('Admin privileges granted to user:', userId, 'by:', grantedBy);
    } catch (error) {
      console.error('Error granting admin privileges:', error);
      throw error;
    }
  }

  /**
   * 管理者権限を削除
   */
  async revokeAdminPrivileges(userId: string, revokedBy: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isAdmin: false,
        adminGrantedAt: null,
        adminGrantedBy: null
      });

      console.log('Admin privileges revoked from user:', userId, 'by:', revokedBy);
    } catch (error) {
      console.error('Error revoking admin privileges:', error);
      throw error;
    }
  }

  /**
   * 管理者ユーザーのみを取得
   */
  async getAdminUsers(): Promise<AdminUser[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('isAdmin', '==', true));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => {
        const data = doc.data() as UserProfile;
        return {
          uid: data.uid,
          displayName: data.displayName,
          email: data.email,
          createdAt: data.createdAt instanceof Date ? data.createdAt : (data.createdAt as any)?.toDate?.() || new Date(),
          isAdmin: true,
          adminGrantedAt: data.adminGrantedAt instanceof Date ? data.adminGrantedAt : (data.adminGrantedAt as any)?.toDate?.() || null,
          adminGrantedBy: data.adminGrantedBy
        };
      });
    } catch (error) {
      console.error('Error getting admin users:', error);
      throw error;
    }
  }

  /**
   * ユーザーの詳細情報を取得
   */
  async getUserDetails(userId: string): Promise<AdminUser | null> {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return null;
      }

      const data = userDoc.data() as UserProfile;
      return {
        uid: data.uid,
        displayName: data.displayName,
        email: data.email,
        createdAt: data.createdAt instanceof Date ? data.createdAt : (data.createdAt as any)?.toDate?.() || new Date(),
        isAdmin: data.isAdmin || false,
        adminGrantedAt: data.adminGrantedAt instanceof Date ? data.adminGrantedAt : (data.adminGrantedAt as any)?.toDate?.() || null,
        adminGrantedBy: data.adminGrantedBy
      };
    } catch (error) {
      console.error('Error getting user details:', error);
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const adminService = AdminService.getInstance();
