/**
 * Google Drive API統合サービス
 * Google Driveからファイルを取得し、テキストに変換する
 */

import { google } from 'googleapis';
import { OAuth2Client, JWT } from 'google-auth-library';
import * as path from 'path';
import * as fs from 'fs';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  modifiedTime?: string;
  createdTime?: string;
  size?: string;
  parents?: string[];
}

export interface GoogleDriveDocument {
  fileId: string;
  fileName: string;
  mimeType: string;
  content: string;
  url: string;
  lastModified?: string;
  size?: number;
}

export class GoogleDriveService {
  private drive: any;
  private sheets: any;
  private slides: any;
  private auth: OAuth2Client | JWT | null = null;

  /**
   * OAuth2クライアントを初期化（アクセストークンを使用）
   */
  async initialize(accessToken: string): Promise<void> {
    try {
      this.auth = new OAuth2Client();
      this.auth.setCredentials({ access_token: accessToken });
      
      this.drive = google.drive({ version: 'v3', auth: this.auth as any });
      this.sheets = google.sheets({ version: 'v4', auth: this.auth as any });
      // Google Slides APIはオプション（APIが有効化されていない場合もある）
      try {
        this.slides = google.slides({ version: 'v1', auth: this.auth as any });
      } catch (error) {
        console.warn('⚠️ Google Slides APIの初期化に失敗しました（オプション）:', error);
        this.slides = null;
      }
    } catch (error) {
      console.error('❌ Google Drive API初期化エラー:', error);
      throw new Error('Google Drive APIの初期化に失敗しました');
    }
  }

  /**
   * サービスアカウントで初期化（共有ドライブ対応）
   */
  async initializeWithServiceAccount(serviceAccountPath?: string): Promise<void> {
    try {
      // サービスアカウントキーのパスを決定
      let keyPath: string;
      
      if (serviceAccountPath) {
        keyPath = path.isAbsolute(serviceAccountPath)
          ? serviceAccountPath
          : path.resolve(process.cwd(), serviceAccountPath);
      } else {
        // デフォルトのパスを試す
        const defaultPath = path.resolve(process.cwd(), 'config', 'boxwood-dynamo-384411-6dec80faabfc.json');
        keyPath = defaultPath;
      }

      // ファイルが存在するか確認
      if (!fs.existsSync(keyPath)) {
        throw new Error(`サービスアカウントキーファイルが見つかりません: ${keyPath}`);
      }

      // サービスアカウントキーを読み込む
      const keyFile = fs.readFileSync(keyPath, 'utf8');
      const key = JSON.parse(keyFile);

      // JWTクライアントを作成
      this.auth = new JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive',
        ],
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth as any });
      this.sheets = google.sheets({ version: 'v4', auth: this.auth as any });
      this.slides = google.slides({ version: 'v1', auth: this.auth as any });
      
      console.log('✅ Google Drive APIをサービスアカウントで初期化しました');
    } catch (error: any) {
      console.error('❌ Google Drive API初期化エラー:', error);
      throw new Error(`Google Drive APIの初期化に失敗しました: ${error.message}`);
    }
  }

  /**
   * ファイルIDからファイル情報を取得
   */
  async getFile(fileId: string): Promise<GoogleDriveFile> {
    if (!this.drive) {
      throw new Error('Google Drive APIが初期化されていません');
    }

    try {
      // 共有ドライブ対応: supportsAllDrivesを追加
      const response = await this.drive.files.get({
        fileId,
        fields: 'id,name,mimeType,webViewLink,webContentLink,modifiedTime,createdTime,size,parents',
        supportsAllDrives: true,
      });

      return response.data as GoogleDriveFile;
    } catch (error: any) {
      console.error(`❌ ファイル取得エラー (${fileId}):`, error);
      throw new Error(`ファイルの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * ファイルの内容をテキストとして取得
   */
  async getFileContent(fileId: string, mimeType: string): Promise<string> {
    if (!this.drive) {
      throw new Error('Google Drive APIが初期化されていません');
    }

    try {
      // MIMEタイプに応じて処理を分岐
      if (mimeType === 'application/vnd.google-apps.document') {
        // Google Docs
        return await this.exportGoogleDoc(fileId);
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Google Spreadsheet
        return await this.exportGoogleSpreadsheet(fileId);
      } else if (mimeType === 'application/vnd.google-apps.presentation') {
        // Google Slides
        return await this.exportGoogleSlides(fileId);
      } else if (mimeType === 'application/pdf') {
        // PDF
        return await this.exportPDF(fileId);
      } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
        // テキストファイル
        return await this.exportTextFile(fileId);
      } else {
        throw new Error(`サポートされていないファイル形式: ${mimeType}`);
      }
    } catch (error: any) {
      console.error(`❌ ファイル内容取得エラー (${fileId}):`, error);
      throw new Error(`ファイル内容の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * Google Docsをテキストとしてエクスポート
   */
  private async exportGoogleDoc(fileId: string): Promise<string> {
    try {
      // 共有ドライブ対応: supportsAllDrivesを追加
      const response = await this.drive.files.export({
        fileId,
        mimeType: 'text/plain',
        supportsAllDrives: true,
      }, {
        responseType: 'text',
      });

      return response.data as string;
    } catch (error: any) {
      console.error(`❌ Google Docsエクスポートエラー (${fileId}):`, error);
      throw new Error(`Google Docsのエクスポートに失敗しました: ${error.message}`);
    }
  }

  /**
   * Google Spreadsheetをテキストとしてエクスポート
   * シート名＋内容の形式で取得
   */
  private async exportGoogleSpreadsheet(fileId: string): Promise<string> {
    try {
      if (!this.sheets) {
        throw new Error('Google Sheets APIが初期化されていません');
      }

      // スプレッドシートのメタデータを取得（シート名一覧）
      // リトライロジック付き
      const metadataResponse = await this.retryWithBackoff(
        async () => {
          return await this.sheets.spreadsheets.get({
            spreadsheetId: fileId,
            fields: 'sheets.properties',
          });
        },
        { maxRetries: 3, baseDelay: 2000 }
      );

      const sheets = metadataResponse.data.sheets || [];
      if (sheets.length === 0) {
        return '';
      }

      const allSheetsContent: string[] = [];

      // 各シートごとに内容を取得（レート制限対策のため順次処理）
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const sheetProperties = sheet.properties;
        if (!sheetProperties) continue;

        const sheetId = sheetProperties.sheetId;
        const sheetTitle = sheetProperties.title || 'シート1';

        try {
          // シートの範囲を取得（A1記法で全範囲を指定）
          const range = `${sheetTitle}!A1:ZZZ10000`; // 十分大きな範囲を指定

          // リトライロジック付きでシート内容を取得
          const valuesResponse = await this.retryWithBackoff(
            async () => {
              return await this.sheets.spreadsheets.values.get({
                spreadsheetId: fileId,
                range: range,
              });
            },
            { maxRetries: 3, baseDelay: 2000 }
          );

          const values = valuesResponse.data.values || [];
          
          if (values.length === 0) {
            // 空のシートの場合
            allSheetsContent.push(`## シート: ${sheetTitle}\n\n（空のシート）\n`);
            continue;
          }

          // シート名をヘッダーとして追加
          let sheetContent = `## シート: ${sheetTitle}\n\n`;

          // テーブル形式に変換
          for (let j = 0; j < values.length; j++) {
            const row = values[j];
            // 空の行はスキップ
            if (row.every((cell: any) => !cell || cell.toString().trim() === '')) {
              continue;
            }

            // 行をパイプ区切りで結合
            const rowText = row.map((cell: any) => {
              const cellText = cell ? cell.toString().trim() : '';
              // パイプ文字が含まれる場合はエスケープ
              return cellText.replace(/\|/g, '\\|');
            }).join(' | ');

            if (j === 0) {
              // ヘッダー行
              sheetContent += `| ${rowText} |\n`;
              // セパレーター行
              const separator = row.map(() => '---').join(' | ');
              sheetContent += `| ${separator} |\n`;
            } else {
              // データ行
              sheetContent += `| ${rowText} |\n`;
            }
          }

          allSheetsContent.push(sheetContent);

          // レート制限対策: シート間で少し待機（最後のシート以外）
          if (i < sheets.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error: any) {
          console.warn(`⚠️ シート「${sheetTitle}」の取得に失敗しました:`, error.message);
          // エラーが発生したシートはスキップして続行
          allSheetsContent.push(`## シート: ${sheetTitle}\n\n（取得エラー: ${error.message}）\n`);
        }
      }

      return allSheetsContent.join('\n\n');
    } catch (error: any) {
      console.error(`❌ Google Spreadsheetエクスポートエラー (${fileId}):`, error);
      throw new Error(`Google Spreadsheetのエクスポートに失敗しました: ${error.message}`);
    }
  }

  /**
   * 指数バックオフ付きリトライヘルパー
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: { maxRetries?: number; baseDelay?: number } = {}
  ): Promise<T> {
    const { maxRetries = 3, baseDelay = 1000 } = options;
    let retryCount = 0;

    while (true) {
      try {
        return await fn();
      } catch (error: any) {
        retryCount++;
        
        // クォータ制限エラーの検出
        const isQuotaError = error.message?.includes('Quota exceeded') || 
                            error.message?.includes('quota') ||
                            error.code === 429 ||
                            (error.response?.status === 403 && error.message?.includes('quota'));

        if (retryCount > maxRetries) {
          throw error;
        }

        if (isQuotaError) {
          // クォータ制限の場合は長めに待機（指数バックオフ）
          const delay = baseDelay * Math.pow(2, retryCount - 1);
          console.log(`⏳ クォータ制限エラー検出。${delay}ms待機してリトライします (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // その他のエラーは短めに待機
          const delay = baseDelay * retryCount;
          console.log(`⏳ エラー発生。${delay}ms待機してリトライします (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  /**
   * Google Slidesをテキストとしてエクスポート
   * スライド内容とメモの両方を取得
   */
  private async exportGoogleSlides(fileId: string): Promise<string> {
    // まず、Google Slides APIを使用してメモを含めて取得を試みる
    if (this.slides) {
      try {
        const presentation = await this.slides.presentations.get({
          presentationId: fileId,
        });

        const slides = presentation.data.slides || [];

        if (slides.length === 0) {
          return '';
        }

        const slideContents: string[] = [];

        slides.forEach((slide: any, index: number) => {
          const slideBody = this.extractTextFromPageElements(slide.pageElements);
          const notesBody = this.extractTextFromPageElements(
            slide.notesPage?.pageElements,
          );

          const title = this.getSlideTitle(slide, slideBody, index);

          let content = `### スライド ${index + 1}: ${title}\n\n`;
          content += slideBody ? slideBody : '（本文なし）';

          if (notesBody) {
            content += `\n\n#### ノート\n${notesBody}`;
          }

          slideContents.push(content.trim());
        });

        return slideContents.join('\n\n');
      } catch (error: any) {
        // Google Slides APIが無効化されている場合やエラーが発生した場合は
        // Drive APIのexportにフォールバック
        console.warn(`⚠️ Google Slides APIでの取得に失敗。Drive APIのexportにフォールバックします:`, error.message);
      }
    }

    // フォールバック: Drive APIのテキストエクスポート
    // 注意: Drive APIのexportではメモは含まれません
    try {
      const response = await this.drive.files.export({
        fileId,
        mimeType: 'text/plain',
        supportsAllDrives: true,
      }, {
        responseType: 'text',
      });

      return response.data as string;
    } catch (error: any) {
      console.error(`❌ Google Slidesエクスポートエラー (${fileId}):`, error);
      throw new Error(`Google Slidesのエクスポートに失敗しました: ${error.message}`);
    }
  }

  /**
   * PDFをテキストとしてエクスポート
   * 注意: PDFのテキスト抽出は複雑なため、簡易実装
   * 本番環境ではPDF.jsやpdf-parseなどのライブラリを使用することを推奨
   */
  private async exportPDF(fileId: string): Promise<string> {
    try {
      // PDFをダウンロード（共有ドライブ対応）
      const response = await this.drive.files.get({
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      }, {
        responseType: 'arraybuffer',
      });

      // PDFのバイナリデータを取得
      const pdfBuffer = Buffer.from(response.data as ArrayBuffer);

      // pdf-parseを動的にインポートしてテキスト抽出
      try {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse =
          (pdfParseModule as any).default || (pdfParseModule as any);
        const pdfData = await pdfParse(pdfBuffer);
        return (pdfData?.text as string) || '';
      } catch (importError) {
        console.error(
          '❌ pdf-parseのインポートに失敗しました。依存関係が正しくインストールされているか確認してください。',
          importError,
        );
        throw new Error(
          'pdf-parseライブラリを読み込めませんでした。npm install pdf-parse を実行してください。',
        );
      }
    } catch (error: any) {
      console.error(`❌ PDFエクスポートエラー (${fileId}):`, error);
      throw new Error(`PDFのエクスポートに失敗しました: ${error.message}`);
    }
  }

  /**
   * テキストファイルを取得
   */
  private async exportTextFile(fileId: string): Promise<string> {
    try {
      // 共有ドライブ対応: supportsAllDrivesを追加
      const response = await this.drive.files.get({
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      }, {
        responseType: 'text',
      });

      return response.data as string;
    } catch (error: any) {
      console.error(`❌ テキストファイル取得エラー (${fileId}):`, error);
      throw new Error(`テキストファイルの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * CSVを読みやすいテキスト形式に変換
   */
  private convertCsvToText(csv: string): string {
    const lines = csv.split('\n');
    const rows: string[][] = [];

    // CSVをパース（簡易実装）
    for (const line of lines) {
      if (line.trim()) {
        // カンマで分割（引用符の処理は簡易版）
        const cells = line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
        rows.push(cells);
      }
    }

    if (rows.length === 0) {
      return '';
    }

    // テキスト形式に変換
    let text = '';
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i === 0) {
        // ヘッダー行
        text += `# ${row.join(' | ')}\n\n`;
      } else {
        // データ行
        text += `${row.join(' | ')}\n`;
      }
    }

    return text;
  }

  private extractTextFromPageElements(elements?: any[]): string {
    if (!elements || elements.length === 0) {
      return '';
    }

    const texts: string[] = [];

    for (const element of elements) {
      const shape = element?.shape;
      if (shape?.text?.textElements) {
        for (const textElement of shape.text.textElements) {
          const content = textElement?.textRun?.content;
          if (content) {
            texts.push(content);
          }
        }
      }
    }

    return texts.join('').replace(/\s+\n/g, '\n').trim();
  }

  private getSlideTitle(slide: any, slideText: string, index: number): string {
    const pageLabel = slide?.slideProperties?.pageLabel;
    if (pageLabel) {
      return pageLabel;
    }

    const titleElement = (slide?.pageElements || []).find((element: any) => {
      const placeholderType = element?.shape?.placeholder?.type;
      return (
        placeholderType === 'TITLE' || placeholderType === 'CENTERED_TITLE'
      );
    });

    const titleFromPlaceholder = this.extractTextFromPageElements(
      titleElement ? [titleElement] : [],
    );

    if (titleFromPlaceholder) {
      return titleFromPlaceholder.split('\n')[0].trim();
    }

    if (slideText) {
      const firstLine = slideText.split('\n').find(line => line.trim());
      if (firstLine) {
        return firstLine.trim();
      }
    }

    return `スライド ${index + 1}`;
  }

  /**
   * フォルダ内のファイル一覧を取得
   */
  async listFiles(folderId?: string, mimeTypes?: string[]): Promise<GoogleDriveFile[]> {
    if (!this.drive) {
      throw new Error('Google Drive APIが初期化されていません');
    }

    try {
      const queryParts: string[] = [];
      
      if (folderId) {
        queryParts.push(`'${folderId}' in parents`);
      }
      
      // サポートされているMIMEタイプでフィルタ
      const supportedMimeTypes = [
        'application/vnd.google-apps.document',
        'application/vnd.google-apps.spreadsheet',
        'application/vnd.google-apps.presentation',
        'application/pdf',
        'text/plain',
        'text/markdown',
      ];
      
      if (mimeTypes && mimeTypes.length > 0) {
        const mimeTypeQuery = mimeTypes
          .map(mt => `mimeType='${mt}'`)
          .join(' or ');
        queryParts.push(`(${mimeTypeQuery})`);
      } else {
        // デフォルトでサポートされている形式のみ
        const mimeTypeQuery = supportedMimeTypes
          .map(mt => `mimeType='${mt}'`)
          .join(' or ');
        queryParts.push(`(${mimeTypeQuery})`);
      }

      const query = queryParts.join(' and ');
      
      // 共有ドライブ対応: supportsAllDrivesとincludeItemsFromAllDrivesを追加
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id,name,mimeType,webViewLink,webContentLink,modifiedTime,createdTime,size,parents)',
        pageSize: 1000,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'allDrives', // 共有ドライブを含む
      });

      return (response.data.files || []) as GoogleDriveFile[];
    } catch (error: any) {
      console.error('❌ ファイル一覧取得エラー:', error);
      throw new Error(`ファイル一覧の取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * ファイルIDから完全なドキュメント情報を取得
   */
  async getDocument(fileId: string): Promise<GoogleDriveDocument> {
    const file = await this.getFile(fileId);
    const content = await this.getFileContent(fileId, file.mimeType);

    return {
      fileId: file.id,
      fileName: file.name,
      mimeType: file.mimeType,
      content,
      url: file.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      lastModified: file.modifiedTime,
      size: file.size ? parseInt(file.size, 10) : undefined,
    };
  }
}

