/**
 * BOM文字検出・除去ユーティリティ
 * 
 * BOM (Byte Order Mark) 文字を検出し、除去するためのユーティリティ関数
 * 複数のBOM形式（UTF-8, UTF-16 LE, UTF-16 BE）に対応
 */

/**
 * BOM文字の検出結果
 */
export interface BOMCheckResult {
  originalString: string;
  length: number;
  firstCharCode: number;
  hasBOM: boolean;
  bomIndex: number;
  bomType?: 'utf8' | 'utf16le' | 'utf16be' | 'unicode';
  utf8BytesLength: number;
  utf8BytesFirst: number[]; // 最初の10バイトを配列で取得
}

/**
 * 文字列にBOM文字が含まれているかを詳細にチェック
 * 
 * @param str チェック対象の文字列
 * @returns BOMチェック結果
 */
export function checkStringForBOM(str: string): BOMCheckResult {
  const buffer = Buffer.from(str, 'utf8');
  const result: BOMCheckResult = {
    originalString: str,
    length: str.length,
    firstCharCode: str.charCodeAt(0),
    hasBOM: false,
    bomIndex: -1,
    utf8BytesLength: buffer.length,
    utf8BytesFirst: Array.from(buffer.slice(0, Math.min(10, buffer.length)))
  };

  // UTF-8 BOMは 0xEF BB BF の3バイトシーケンス
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    result.hasBOM = true;
    result.bomIndex = 0;
    result.bomType = 'utf8';
  }
  
  // UCS-2 (UTF-16 LE) BOMは 0xFF FE
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    result.hasBOM = true;
    result.bomIndex = 0;
    result.bomType = 'utf16le';
  }
  
  // UCS-2 (UTF-16 BE) BOMは 0xFE FF
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    result.hasBOM = true;
    result.bomIndex = 0;
    result.bomType = 'utf16be';
  }
  
  // Unicode BOM (U+FEFF) の文字コードチェック
  // これは通常UTF-8ではEF BB BFとして表現されるため、上記で捕捉されることが多い
  // もし、文字コードが65279 (U+FEFF) であれば、それはBOMとして扱われるべき文字
  if (str.charCodeAt(0) === 0xFEFF) {
    result.hasBOM = true;
    result.bomIndex = 0;
    result.bomType = 'unicode';
  }

  return result;
}

/**
 * BOM文字を除去した文字列を返す
 * 
 * @param str BOM除去対象の文字列
 * @returns BOM除去後の文字列
 */
export function removeBOM(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }

  // 方法1: 文字列レベルのBOM文字（U+FEFF）を削除
  let cleaned = str;
  if (cleaned.charCodeAt(0) === 0xFEFF) {
    cleaned = cleaned.slice(1);
  }
  cleaned = cleaned.replace(/\uFEFF/g, '');

  // 方法2: Buffer経由でUTF-8 BOMバイト（EF BB BF）を削除
  const buffer = Buffer.from(cleaned, 'utf8');
  const bomBytes = Buffer.from([0xEF, 0xBB, 0xBF]);
  
  let cleanedBuffer = buffer;
  while (cleanedBuffer.length >= 3 && cleanedBuffer.subarray(0, 3).equals(bomBytes)) {
    cleanedBuffer = cleanedBuffer.subarray(3);
  }

  // 方法3: UTF-16 BOMを削除
  if (cleanedBuffer.length >= 2) {
    // UTF-16 LE BOM (FF FE) を削除
    if (cleanedBuffer[0] === 0xFF && cleanedBuffer[1] === 0xFE) {
      cleanedBuffer = cleanedBuffer.subarray(2);
    }
    // UTF-16 BE BOM (FE FF) を削除
    if (cleanedBuffer[0] === 0xFE && cleanedBuffer[1] === 0xFF) {
      cleanedBuffer = cleanedBuffer.subarray(2);
    }
  }

  // Bufferから文字列に変換
  cleaned = cleanedBuffer.toString('utf8');

  // 方法4: TextEncoder/TextDecoder経由で完全にクリーンアップ
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false });
  const utf8Bytes = encoder.encode(cleaned);
  
  // BOMバイト（EF BB BF）を明示的に削除
  let cleanedBytes = utf8Bytes;
  if (cleanedBytes.length >= 3 && cleanedBytes[0] === 0xEF && cleanedBytes[1] === 0xBB && cleanedBytes[2] === 0xBF) {
    cleanedBytes = cleanedBytes.slice(3);
  }
  
  // TextDecoderでBOMを無視してデコード（完全にクリーンな文字列を作成）
  cleaned = decoder.decode(cleanedBytes);

  // 最終チェック: 文字列レベルのBOM文字を再度削除（念のため）
  cleaned = cleaned.replace(/^\uFEFF+/, '').replace(/\uFEFF/g, '');

  return cleaned;
}

/**
 * BOM文字を詳細にチェックし、除去した文字列を返す
 * 
 * @param str チェック・除去対象の文字列
 * @returns BOMチェック結果と除去後の文字列
 */
export function checkAndRemoveBOM(str: string): { result: BOMCheckResult; cleaned: string } {
  const result = checkStringForBOM(str);
  const cleaned = removeBOM(str);
  
  return { result, cleaned };
}

