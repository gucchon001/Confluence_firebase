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
  const [checkedFileIds, setCheckedFileIds] = useState<Set<string>>(new Set()); // ファイル一覧でチェックされたファイルID

  // Google Picker API設定
  // next.config.tsでGEMINI_API_KEYからNEXT_PUBLIC_GOOGLE_API_KEYにマッピングされています
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  
  // デバッグ用（開発環境のみ）
  if (process.env.NODE_ENV === 'development' && !googleApiKey) {
    console.warn('[Google Drive Import] NEXT_PUBLIC_GOOGLE_API_KEYが設定されていません。next.config.tsのenv設定を確認してください。');
  }

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
      setCheckedFileIds(new Set()); // ファイル一覧を取得したらチェック状態をリセット
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

        {/* セクション1: ファイル選択 */}
        <div className="border rounded-lg p-4 bg-blue-50/50">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Folder className="h-4 w-4" />
            ステップ1: ファイルを選択
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            インポートしたいファイルやフォルダを選択します。ファイルIDフィールドに自動入力されます。
          </p>
          <div className="flex gap-2 flex-wrap">
            {/* Google Pickerボタン */}
            {googleApiKey && googleClientId ? (
              <Button
                onClick={showPicker}
                disabled={!isPickerLoaded || isPickerLoading}
                variant="default"
                className="bg-blue-600 hover:bg-blue-700"
                title={!isPickerLoaded ? 'Google Picker APIの読み込み中...' : 'Google Driveからファイルやフォルダを選択'}
              >
                {isPickerLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    読み込み中...
                  </>
                ) : !isPickerLoaded ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    初期化中...
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
          </div>
        </div>

        {/* セクション2: ファイル一覧の確認（オプション） */}
        <div className="border rounded-lg p-4 bg-gray-50/50">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            ステップ2: ファイル一覧を確認（オプション）
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            <strong>フォルダIDを入力</strong>して、フォルダ内のファイル一覧を<strong>表示するだけ</strong>です。
            ファイルの内容は取得せず、検索可能にもなりません。どのファイルがあるか確認したい場合に使用します。
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            <Button
              onClick={handleListFiles}
              disabled={isListing || (!useServiceAccount && !accessToken) || !folderId}
              variant="outline"
              title="フォルダIDを入力してからクリックしてください"
            >
              {isListing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  取得中...
                </>
              ) : (
                <>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  フォルダ内のファイル一覧を表示
                </>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              ※ フォルダIDを入力してからクリックしてください
            </span>
          </div>
        </div>

        {/* セクション3: インポート実行 */}
        <div className="border rounded-lg p-4 bg-green-50/50">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Upload className="h-4 w-4" />
            ステップ3: インポート実行
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            <strong>ファイルIDまたはフォルダIDを指定</strong>して、実際にファイルの内容を取得し、
            <strong>Firestoreに保存</strong>して<strong>LanceDBにインデックス</strong>を作成します。
            これにより、ファイルが検索可能になります。
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            <Button
              onClick={handleImport}
              disabled={isImporting || (!useServiceAccount && !accessToken) || (!fileIds && !folderId)}
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              title={(!fileIds && !folderId) ? 'ファイルIDまたはフォルダIDを入力してください' : 'ファイルをインポートして検索可能にします'}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  インポート中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  ファイルをインポート（検索可能にする）
                </>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              ※ ファイルIDまたはフォルダIDを入力してからクリックしてください
            </span>
          </div>
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                ファイル一覧 ({fileList.length}件)
                {checkedFileIds.size > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({checkedFileIds.size}件選択中)
                  </span>
                )}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (checkedFileIds.size === fileList.length) {
                      // すべて選択解除
                      setCheckedFileIds(new Set());
                    } else {
                      // すべて選択
                      setCheckedFileIds(new Set(fileList.map(f => f.id)));
                    }
                  }}
                >
                  {checkedFileIds.size === fileList.length ? 'すべて解除' : 'すべて選択'}
                </Button>
                {checkedFileIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      // 選択されたファイルをファイルIDフィールドに追加
                      const checkedFiles = fileList.filter(f => checkedFileIds.has(f.id));
                      const newFileIds = checkedFiles.map(f => f.id);
                      
                      // 既存のIDとマージ（重複を除去）
                      const existingIds = fileIds ? fileIds.split(',').map(id => id.trim()).filter(Boolean) : [];
                      const mergedIds = [...new Set([...existingIds, ...newFileIds])];
                      
                      setFileIds(mergedIds.join(', '));
                      setFolderId('');
                      
                      // 選択されたファイルをselectedFilesに追加
                      const newSelectedFiles = checkedFiles.map(f => ({
                        id: f.id,
                        name: f.name,
                        mimeType: f.mimeType,
                      }));
                      setSelectedFiles(prev => {
                        const existing = prev.map(f => f.id);
                        const toAdd = newSelectedFiles.filter(f => !existing.includes(f.id));
                        return [...prev, ...toAdd];
                      });
                      
                      // チェックを解除
                      setCheckedFileIds(new Set());
                    }}
                  >
                    選択したファイルを追加 ({checkedFileIds.size}件)
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {fileList.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={checkedFileIds.has(file.id)}
                      onChange={(e) => {
                        const newChecked = new Set(checkedFileIds);
                        if (e.target.checked) {
                          newChecked.add(file.id);
                        } else {
                          newChecked.delete(file.id);
                        }
                        setCheckedFileIds(newChecked);
                      }}
                      className="rounded"
                    />
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
                      // 既存のIDに追加（重複を除去）
                      const existingIds = fileIds ? fileIds.split(',').map(id => id.trim()).filter(Boolean) : [];
                      if (!existingIds.includes(file.id)) {
                        const newIds = [...existingIds, file.id];
                        setFileIds(newIds.join(', '));
                        setFolderId('');
                        
                        // selectedFilesにも追加
                        setSelectedFiles(prev => {
                          if (prev.some(f => f.id === file.id)) {
                            return prev;
                          }
                          return [...prev, { id: file.id, name: file.name, mimeType: file.mimeType }];
                        });
                      }
                    }}
                  >
                    追加
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

