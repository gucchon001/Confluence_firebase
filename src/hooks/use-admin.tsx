'use client';

import { useState, useEffect } from 'react';
import { useAuthWrapper } from './use-auth-wrapper';
import { adminService } from '@/lib/admin-service';

interface AdminContextType {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  checkAdminStatus: () => Promise<void>;
}

export function useAdmin(): AdminContextType {
  const { user, loading } = useAuthWrapper();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const adminStatus = await adminService.isUserAdmin(user.uid);
      setIsAdmin(adminStatus);
    } catch (err) {
      console.error('Error checking admin status:', err);
      setError('管理者権限の確認中にエラーが発生しました');
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      checkAdminStatus();
    }
  }, [user, loading]);

  return {
    isAdmin,
    isLoading,
    error,
    checkAdminStatus
  };
}
