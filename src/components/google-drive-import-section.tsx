'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuthWrapper } from '@/hooks/use-auth-wrapper';
import { useGooglePicker } from '@/hooks/use-google-picker';
import { Loader2, Upload, FileText, CheckCircle2, XCircle, FolderOpen, Folder } from 'lucide-react';

interface ImportResult {
  fileId: string;
  success: boolean;
  error?: string;
}

interface ImportResponse {
  success: boolean;
  message: string;
  results: ImportResult[];
  summary: {
    total: number;
    success: number;
    failure: number;
  };
}

export const GoogleDriveImportSection: React.FC = () => {
  const { user } = useAuthWrapper();
  const [accessToken, setAccessToken] = useState('');
  const [useServiceAccount, setUseServiceAccount] = useState(true); // デフォルトでサービスアカウントを使用
  const [fileIds, setFileIds] = useState('');
  const [folderId, setFolderId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [isListing, setIsListing] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ id: string; name: string; mimeType: string }>>([]);

  // Google Picker API設定
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  // Google Pickerフック
  const { isLoaded: isPickerLoaded, isLoading: isPickerLoading, showPicker } = useGooglePicker({
    apiKey: googleApiKey,
    clientId: googleClientId,
    enableMultiSelect: true,
    allowFolders: true,
    onPicked: (files) => {
      // 選択されたファイルを処理
      const folderIdsArray = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder').map(f => f.id);
      const documentFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

      if (folderIdsArray.length > 0 && documentFiles.length === 0) {
        // フォルダのみ選択された場合（複数フォルダの場合は最初の1つを使用）
        setFolderId(folderIdsArray[0]);
        setFileIds('');
        setSelectedFiles([]);
      } else if (documentFiles.length > 0) {
        // ファイルが選択された場合（フォルダとファイルが混在する場合はファイルのみ）
        const fileIdsArray = documentFiles.map(f => f.id);
        setFileIds(fileIdsArray.join(', '));
        setFolderId('');
        setSelectedFiles(documentFiles.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType })));
      } else if (folderIdsArray.length > 0 && documentFiles.length > 0) {
        // フォルダとファイルが混在する場合は、ファイルのみをインポート
        const fileIdsArray = documentFiles.map(f => f.id);
        setFileIds(fileIdsArray.join(', '));
        setFolderId('');
        setSelectedFiles(documentFiles.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType })));
      }
    },
    onCancel: () => {
      console.log('ファイル選択がキャンセルされました');
    },
  });

  const handleImport = async () => {
    if (!useServiceAccount && !accessToken) {
      alert('Google Driveアクセストークンを入力するか、サービスアカウントを使用してください');
      return;
    }

    if (!fileIds && !folderId) {
      alert('ファイルIDまたはフォルダIDを入力してください');
      return;
    }

    if (!user) {
      alert('ログインが必要です');
      return;
    }

    try {
      setIsImporting(true);
      setImportResult(null);

      // 認証トークンを取得
      if (!user || 'getIdToken' in user === false) {
        throw new Error('ユーザーが認証されていません');
      }
      const idToken = await (user as { getIdToken: () => Promise<string> }).getIdToken();

      const requestBody: any = {
        useServiceAccount,
      };

      if (!useServiceAccount && accessToken) {
        requestBody.accessToken = accessToken;
      }

      if (fileIds) {
        // カンマ区切りのファイルIDを配列に変換
        const ids = fileIds.split(',').map(id => id.trim()).filter(Boolean);
        requestBody.fileIds = ids;
      } else if (folderId) {
        requestBody.folderId = folderId;
      }

      const response = await fetch('/api/admin/google-drive/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'インポートに失敗しました');
      }

      const result: ImportResponse = await response.json();
      setImportResult(result);
    } catch (error: any) {
      console.error('❌ インポートエラー:', error);
      alert(`インポートエラー: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleListFiles = async () => {
    if (!useServiceAccount && !accessToken) {
      alert('Google Driveアクセストークンを入力するか、サービスアカウントを使用してください');
      return;
    }

    if (!user) {
      alert('ログインが必要です');
      return;
    }

    try {
      setIsListing(true);
      setFileList([]);

      // 認証トークンを取得
      if (!user || 'getIdToken' in user === false) {
        throw new Error('ユーザーが認証されていません');
      }
      const idToken = await (user as { getIdToken: () => Promise<string> }).getIdToken();

      const params = new URLSearchParams({
        useServiceAccount: useServiceAccount.toString(),
      });

      if (!useServiceAccount && accessToken) {
        params.append('accessToken', accessToken);
      }

      if (folderId) {
        params.append('folderId', folderId);
      }

      const response = await fetch(`/api/admin/google-drive/list?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'ファイル一覧の取得に失敗しました');
      }

      const result = await response.json();
      setFileList(result.files || []);
    } catch (error: any) {
      console.error('❌ ファイル一覧取得エラー:', error);
      alert(`ファイル一覧取得エラー: ${error.message}`);
    } finally {
      setIsListing(false);
    }
  };

  const getMimeTypeIcon = (mimeType: string) => {
    if (mimeType.includes('document')) return '📄';
    if (mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('presentation')) return '📽️';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('text')) return '📝';
    return '📄';
  };

  const getMimeTypeName = (mimeType: string) => {
    if (mimeType.includes('document')) return 'Google Docs';
    if (mimeType.includes('spreadsheet')) return 'Google Spreadsheet';
    if (mimeType.includes('presentation')) return 'Google Slides';
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('text')) return 'テキスト';
    return mimeType;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={useServiceAccount}
              onChange={(e) => setUseServiceAccount(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">サービスアカウントを使用（共有ドライブ対応）</span>
          </label>
          {!useServiceAccount && (
            <>
              <Input
                type="text"
                placeholder="アクセストークンを入力"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="font-mono text-sm mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Google OAuth2で取得したアクセストークンを入力してください
              </p>
            </>
          )}
          {useServiceAccount && (
            <p className="text-xs text-muted-foreground mt-1">
              サービスアカウントキー（config/boxwood-dynamo-384411-6dec80faabfc.json）を使用します
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              ファイルID（カンマ区切り）
            </label>
            <Input
              type="text"
              placeholder="fileId1, fileId2, ... または「Google Driveから選択」ボタンを使用"
              value={fileIds}
              onChange={(e) => {
                setFileIds(e.target.value);
                // 手動入力の場合は選択ファイルリストをクリア
                if (e.target.value !== fileIds) {
                  setSelectedFiles([]);
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              複数のファイルIDをカンマで区切って入力、または「Google Driveから選択」ボタンでポップアップから選択
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              フォルダID
            </label>
            <Input
              type="text"
              placeholder="フォルダIDを入力 または「Google Driveから選択」ボタンでフォルダを選択"
              value={folderId}
              onChange={(e) => {
                setFolderId(e.target.value);
                // 手動入力の場合は選択ファイルリストをクリア
                if (e.target.value !== folderId) {
                  setSelectedFiles([]);
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              フォルダ内のすべてのファイルをインポート（Shiftキーを押しながらフォルダを選択可能）
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Google Pickerボタン */}
          {googleApiKey && googleClientId ? (
            <Button
              onClick={showPicker}
              disabled={!isPickerLoaded || isPickerLoading}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPickerLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  読み込み中...
                </>
              ) : (
                <>
                  <Folder className="h-4 w-4 mr-2" />
                  Google Driveから選択
                </>
              )}
            </Button>
          ) : (
            <div className="text-xs text-muted-foreground p-2 border rounded bg-yellow-50">
              ⚠️ Google Picker APIを使用するには、環境変数（NEXT_PUBLIC_GOOGLE_API_KEY、NEXT_PUBLIC_GOOGLE_CLIENT_ID）の設定が必要です
            </div>
          )}

          <Button
            onClick={handleListFiles}
            disabled={isListing || (!useServiceAccount && !accessToken)}
            variant="outline"
          >
            {isListing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                取得中...
              </>
            ) : (
              <>
                <FolderOpen className="h-4 w-4 mr-2" />
                ファイル一覧を取得
              </>
            )}
          </Button>

          <Button
            onClick={handleImport}
            disabled={isImporting || (!useServiceAccount && !accessToken) || (!fileIds && !folderId)}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                インポート中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                インポート
              </>
            )}
          </Button>
        </div>

        {/* 選択されたファイル表示 */}
        {selectedFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">選択されたファイル ({selectedFiles.length}件)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2 border rounded bg-blue-50"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-lg">{getMimeTypeIcon(file.mimeType)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {getMimeTypeName(file.mimeType)}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedFiles(selectedFiles.filter(f => f.id !== file.id));
                        const remainingIds = selectedFiles.filter(f => f.id !== file.id).map(f => f.id);
                        setFileIds(remainingIds.join(', '));
                      }}
                    >
                      削除
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ファイル一覧 */}
      {fileList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">ファイル一覧 ({fileList.length}件)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {fileList.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">{getMimeTypeIcon(file.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getMimeTypeName(file.mimeType)}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono truncate">
                          {file.id}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFileIds(file.id);
                      setFolderId('');
                    }}
                  >
                    選択
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* インポート結果 */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {importResult.summary.failure === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              インポート結果
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  合計: {importResult.summary.total}件
                </Badge>
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  成功: {importResult.summary.success}件
                </Badge>
                {importResult.summary.failure > 0 && (
                  <Badge variant="destructive">
                    失敗: {importResult.summary.failure}件
                  </Badge>
                )}
              </div>

              {importResult.results.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {importResult.results.map((result) => (
                    <div
                      key={result.fileId}
                      className={`flex items-center justify-between p-2 border rounded ${
                        result.success
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                        )}
                        <span className="text-sm font-mono truncate">{result.fileId}</span>
                      </div>
                      {result.error && (
                        <span className="text-xs text-red-600 ml-2">{result.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* サポートされているファイル形式 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">サポートされているファイル形式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Google Docs</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Google Spreadsheet</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Google Slides</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>PDF</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>テキストファイル (.txt)</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Markdown (.md)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

