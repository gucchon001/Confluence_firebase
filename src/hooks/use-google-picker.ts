'use client';

import { useEffect, useState, useCallback } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
      picker: {
        ViewId: {
          DOCS: string;
          DOCS_IMAGES: string;
          DOCS_IMAGES_AND_VIDEOS: string;
          DOCS_VIDEOS: string;
          DOCUMENTS: string;
          DRAWINGS: string;
          FOLDERS: string;
          FORMS: string;
          IMAGES: string;
          PDFS: string;
          PRESENTATIONS: string;
          SPREADSHEETS: string;
          VIDEO_SEARCH: string;
          YOUTUBE: string;
        };
        Action: {
          PICKED: string;
          CANCEL: string;
        };
        PickerBuilder: new () => {
          setAppId: (appId: string) => any;
          setOAuthToken: (token: string) => any;
          addView: (view: any) => any;
          setCallback: (callback: (data: any) => void) => any;
          setOrigin: (origin: string) => any;
          enableFeature: (feature: string) => any;
          setSize: (width: number, height: number) => any;
          build: () => {
            setVisible: (visible: boolean) => void;
          };
        };
        Feature: {
          MULTISELECT_ENABLED: string;
          NAV_HIDDEN: string;
          SIMPLE_UPLOAD_ENABLED: string;
        };
        DocsView: new () => {
          setIncludeFolders: (include: boolean) => any;
          setMimeTypes: (mimeTypes: string) => any;
          setSelectFolderEnabled: (enabled: boolean) => any;
          setMode: (mode: string) => any;
        };
        DocsViewMode: {
          LIST: string;
          GRID: string;
        };
      };
      load: (api: string, version: string, callback: () => void) => void;
    };
    gapi?: any;
  }
}

interface PickerFile {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
  sizeBytes?: string;
}

interface UseGooglePickerOptions {
  apiKey: string;
  clientId: string;
  onPicked?: (files: PickerFile[]) => void;
  onCancel?: () => void;
  enableMultiSelect?: boolean;
  allowFolders?: boolean;
  mimeTypes?: string[];
}

export const useGooglePicker = (options: UseGooglePickerOptions) => {
  const { apiKey, clientId, onPicked, onCancel, enableMultiSelect = true, allowFolders = true, mimeTypes } = options;
  const [isLoaded, setIsLoaded] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Google APIスクリプトを読み込む
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 既に読み込まれている場合はスキップ
    if (window.google?.picker) {
      setIsLoaded(true);
      return;
    }

    // Google APIスクリプトを動的に読み込む
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        window.google.load('picker', '1', () => {
          setIsLoaded(true);
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      // クリーンアップはしない（他のコンポーネントでも使用される可能性があるため）
    };
  }, []);

  // OAuth2トークンを取得
  const getAccessToken = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (accessToken) {
        resolve(accessToken);
        return;
      }

      if (!window.google?.accounts) {
        reject(new Error('Google APIが読み込まれていません'));
        return;
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: { access_token: string }) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            resolve(response.access_token);
          } else {
            reject(new Error('アクセストークンの取得に失敗しました'));
          }
        },
      });

      tokenClient.requestAccessToken();
    });
  }, [clientId, accessToken]);

  // Google Pickerを表示
  const showPicker = useCallback(async () => {
    if (!isLoaded) {
      console.error('Google Picker APIが読み込まれていません');
      return;
    }

    try {
      setIsLoading(true);
      const token = await getAccessToken();

      if (!window.google?.picker) {
        throw new Error('Google Picker APIが利用できません');
      }

      const { ViewId, Action, PickerBuilder, DocsView, DocsViewMode } = window.google.picker;

      // ドキュメントビューを作成
      const docsView = new DocsView();
      docsView.setIncludeFolders(allowFolders);
      docsView.setSelectFolderEnabled(allowFolders);
      docsView.setMode(DocsViewMode.LIST);

      // MIMEタイプをフィルタリング
      if (mimeTypes && mimeTypes.length > 0) {
        const mimeTypeString = mimeTypes.join(',');
        docsView.setMimeTypes(mimeTypeString);
      } else {
        // サポートされているMIMEタイプのみ
        docsView.setMimeTypes(
          'application/vnd.google-apps.document,' +
          'application/vnd.google-apps.spreadsheet,' +
          'application/vnd.google-apps.presentation,' +
          'application/pdf,' +
          'text/plain,' +
          'text/markdown'
        );
      }

      // フォルダビューも追加（フォルダ選択を許可する場合）
      const folderView = new DocsView();
      folderView.setSelectFolderEnabled(true);

      // Pickerを構築
      const picker = new PickerBuilder()
        .setOAuthToken(token)
        .setCallback((data: any) => {
          setIsLoading(false);
          
          if (data[Action.PICKED]) {
            const files: PickerFile[] = data[Action.PICKED].map((item: any) => ({
              id: item.id,
              name: item.name,
              mimeType: item.mimeType,
              url: item.url,
              sizeBytes: item.sizeBytes,
            }));
            
            if (onPicked) {
              onPicked(files);
            }
          } else if (data[Action.CANCEL]) {
            if (onCancel) {
              onCancel();
            }
          }
        })
        .addView(docsView);

      // フォルダ選択を許可する場合、フォルダビューも追加
      if (allowFolders) {
        picker.addView(folderView);
      }

      // 複数選択を有効化（Shiftキーで複数選択可能）
      // 注意: Google Picker APIでは、複数選択は自動的にサポートされています
      // Shiftキーを押しながらクリックすることで複数選択できます

      // Pickerを表示
      picker.build().setVisible(true);
    } catch (error: any) {
      console.error('❌ Google Picker表示エラー:', error);
      alert(`ファイル選択エラー: ${error.message}`);
      setIsLoading(false);
    }
  }, [isLoaded, getAccessToken, allowFolders, mimeTypes, enableMultiSelect, onPicked, onCancel]);

  return {
    isLoaded,
    isLoading,
    showPicker,
    accessToken,
  };
};

