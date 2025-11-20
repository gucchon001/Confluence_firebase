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
      picker?: {
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
    };
    gapi?: {
      load: (api: string, config: {
        callback?: () => void;
        onerror?: (error: any) => void;
      }) => void;
      picker?: any;
    };
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

    // APIキーとクライアントIDが設定されていない場合はスキップ
    if (!apiKey || !clientId) {
      console.warn('[Google Picker] APIキーまたはクライアントIDが設定されていません', { apiKey: !!apiKey, clientId: !!clientId });
      return;
    }

    // 既に読み込まれている場合はスキップ
    if (window.google?.picker || (window.gapi && window.gapi.picker)) {
      console.log('[Google Picker] 既に読み込まれています');
      setIsLoaded(true);
      return;
    }

    // 既にスクリプトが追加されているか確認
    const existingApiScript = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
    const existingGisScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    
    if (existingApiScript && existingGisScript) {
      console.log('[Google Picker] スクリプトは既に追加されています。読み込み完了を待機...');
      // スクリプトが既に追加されている場合、読み込み完了を待つ
      const checkInterval = setInterval(() => {
        if (window.google?.picker || (window.gapi && window.gapi.picker)) {
          console.log('[Google Picker] Google Picker APIが利用可能になりました');
          setIsLoaded(true);
          clearInterval(checkInterval);
        } else if (window.gapi && window.gapi.load) {
          // gapi.loadが利用可能な場合、Picker APIを読み込む
          try {
            window.gapi.load('picker', {
              callback: () => {
                console.log('[Google Picker] Google Picker APIの初期化完了 (既存スクリプト経由)');
                setIsLoaded(true);
                clearInterval(checkInterval);
              },
            });
          } catch (error) {
            console.error('[Google Picker] 初期化エラー:', error);
          }
        }
      }, 100);
      
      // 10秒後にタイムアウト
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.google?.picker && !(window.gapi && window.gapi.picker)) {
          console.error('[Google Picker] タイムアウト: Google Picker APIの読み込みが完了しませんでした');
        }
      }, 10000);
      
      return () => clearInterval(checkInterval);
    }

    console.log('[Google Picker] Google APIスクリプトを読み込み中...');

    // Google Identity Services (GIS) を読み込む（OAuth2認証用）
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    
    // Google Picker APIを読み込む
    const pickerScript = document.createElement('script');
    pickerScript.src = 'https://apis.google.com/js/api.js';
    pickerScript.async = true;
    pickerScript.defer = true;
    
    let gisLoaded = false;
    let pickerLoaded = false;

    const checkAndInit = () => {
      if (gisLoaded && pickerLoaded) {
        console.log('[Google Picker] Google APIスクリプトの読み込み完了');
        // Google Picker APIを初期化
        try {
          // gapi.loadを使用する方法（推奨）
          if (window.gapi && window.gapi.load) {
            console.log('[Google Picker] gapi.loadを使用してPicker APIを読み込み中...');
            window.gapi.load('picker', {
              callback: () => {
                console.log('[Google Picker] Google Picker APIの初期化完了 (gapi.load)');
                setIsLoaded(true);
              },
              onerror: (error: any) => {
                console.error('[Google Picker] Google Picker APIの初期化エラー:', error);
              },
            });
          } else if (window.google?.picker) {
            // window.google.pickerが直接利用可能な場合
            console.log('[Google Picker] Google Picker APIが直接利用可能です');
            setIsLoaded(true);
          } else {
            // 少し待ってから再試行
            console.log('[Google Picker] Google Picker APIの利用可能性を確認中...');
            setTimeout(() => {
              if (window.google?.picker || (window.gapi && window.gapi.picker)) {
                console.log('[Google Picker] Google Picker APIが利用可能になりました');
                setIsLoaded(true);
              } else if (window.gapi && window.gapi.load) {
                // 再試行: gapi.loadを使用
                window.gapi.load('picker', {
                  callback: () => {
                    console.log('[Google Picker] Google Picker APIの初期化完了 (再試行)');
                    setIsLoaded(true);
                  },
                });
              } else {
                console.error('[Google Picker] Google Picker APIが利用できません');
              }
            }, 500);
          }
        } catch (error) {
          console.error('[Google Picker] Google Picker APIの初期化エラー:', error);
        }
      }
    };

    gisScript.onload = () => {
      console.log('[Google Picker] Google Identity Services読み込み完了');
      gisLoaded = true;
      checkAndInit();
    };

    pickerScript.onload = () => {
      console.log('[Google Picker] Google API読み込み完了');
      pickerLoaded = true;
      checkAndInit();
    };

    gisScript.onerror = (error) => {
      console.error('[Google Picker] Google Identity Services読み込みエラー:', error);
    };

    pickerScript.onerror = (error) => {
      console.error('[Google Picker] Google API読み込みエラー:', error);
    };

    document.head.appendChild(gisScript);
    document.head.appendChild(pickerScript);

    return () => {
      // クリーンアップはしない（他のコンポーネントでも使用される可能性があるため）
    };
  }, [apiKey, clientId]);

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

      // window.google.pickerまたはwindow.gapi.pickerを使用
      const pickerApi = window.google?.picker || (window.gapi && window.gapi.picker);
      if (!pickerApi) {
        throw new Error('Google Picker APIが利用できません');
      }

      const { ViewId, Action, PickerBuilder, DocsView, DocsViewMode } = pickerApi;

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

