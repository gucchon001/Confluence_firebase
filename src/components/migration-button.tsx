'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowUpRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { migrateUserData, getMigrationStatus, updateMigrationStatus } from '@/lib/migration-service';
import type { User } from 'firebase/auth';

interface MigrationButtonProps {
  user: User;
  onComplete?: () => void;
}

export default function MigrationButton({ user, onComplete }: MigrationButtonProps) {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{
    completed: boolean;
    timestamp: Date;
    conversationCount: number;
    error?: string;
  } | null>(null);
  const { toast } = useToast();

  // 移行ステータスを取得
  const checkMigrationStatus = async () => {
    try {
      const status = await getMigrationStatus(user.uid);
      setMigrationStatus(status);
      return status;
    } catch (error) {
      console.error('Failed to check migration status:', error);
      return null;
    }
  };

  // 移行を実行
  const handleMigration = async () => {
    setIsMigrating(true);
    
    try {
      // 既に移行済みかチェック
      const status = await checkMigrationStatus();
      if (status?.completed) {
        toast({
          title: 'すでに移行済みです',
          description: `${status.conversationCount}件の会話が移行済みです（${status.timestamp.toLocaleString()}）`,
          variant: 'default',
        });
        setIsMigrating(false);
        return;
      }
      
      // 移行を実行
      const conversationCount = await migrateUserData(user.uid, user);
      
      // 移行ステータスを更新
      await updateMigrationStatus(user.uid, {
        completed: true,
        timestamp: new Date(),
        conversationCount
      });
      
      // 移行完了を通知
      toast({
        title: '移行が完了しました',
        description: `${conversationCount}件の会話を新しい形式に移行しました`,
        variant: 'default',
      });
      
      // 移行ステータスを更新
      await checkMigrationStatus();
      
      // 完了コールバックを呼び出し
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Migration failed:', error);
      
      // エラーを通知
      toast({
        title: '移行に失敗しました',
        description: error instanceof Error ? error.message : '不明なエラーが発生しました',
        variant: 'destructive',
      });
      
      // 移行ステータスを更新
      await updateMigrationStatus(user.uid, {
        completed: false,
        timestamp: new Date(),
        conversationCount: 0,
        error: error instanceof Error ? error.message : '不明なエラー'
      });
    } finally {
      setIsMigrating(false);
    }
  };
  
  // コンポーネントのマウント時に移行ステータスを取得
  React.useEffect(() => {
    checkMigrationStatus();
  }, []);
  
  return (
    <div className="flex flex-col gap-2 p-4 border rounded-md bg-white">
      <h3 className="font-medium">データ移行</h3>
      <p className="text-sm text-muted-foreground">
        既存のチャット履歴を新しい形式に移行します。
      </p>
      
      {migrationStatus?.completed ? (
        <div className="text-sm text-green-600 mt-2">
          ✅ 移行済み（{migrationStatus.conversationCount}件の会話）
          <div className="text-xs text-muted-foreground">
            {migrationStatus.timestamp.toLocaleString()}
          </div>
        </div>
      ) : (
        <Button 
          onClick={handleMigration} 
          disabled={isMigrating}
          variant="outline"
          className="mt-2"
        >
          {isMigrating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              移行中...
            </>
          ) : (
            <>
              <ArrowUpRight className="mr-2 h-4 w-4" />
              移行を実行
            </>
          )}
        </Button>
      )}
      
      {migrationStatus?.error && (
        <div className="text-sm text-red-600 mt-2">
          エラー: {migrationStatus.error}
        </div>
      )}
    </div>
  );
}
