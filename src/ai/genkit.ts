import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { enableGoogleCloudTelemetry } from '@genkit-ai/google-cloud';
import { checkStringForBOM, removeBOM } from '../lib/bom-utils';

// Google Cloudのロギングとトレースを有効化
enableGoogleCloudTelemetry();

/**
 * Gemini APIキーを安全に取得・サニタイズする
 * - Secret Manager や .env にBOM付きで保存されているケースを想定
 * - trim() で前後の空白を除去
 * - BOMを除去してSDK内部でのByteString変換エラーを防ぐ
 */
function resolveSanitizedGeminiApiKey(): string | undefined {
  const rawKey =
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLEAI_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY;

  if (!rawKey) {
    console.error('🚨 GEMINI APIキーが設定されていません (GEMINI_API_KEY/GOOGLEAI_API_KEY/GOOGLE_GENAI_API_KEY)');
    return undefined;
  }

  const trimmedKey = rawKey.trim();
  const bomCheck = checkStringForBOM(trimmedKey);

  if (bomCheck.hasBOM) {
    console.warn('🚨 [BOM DETECTED] Gemini APIキーにBOMが検出されました。サニタイズを実施します。', {
      bomCheck,
    });
  }

  const sanitizedKey = removeBOM(trimmedKey);

  if (sanitizedKey.length === 0) {
    console.error('🚨 Gemini APIキーがサニタイズ後に空になりました。Secretの内容を確認してください。');
    return undefined;
  }

  return sanitizedKey;
}

const sanitizedGeminiApiKey = resolveSanitizedGeminiApiKey();

// GenkitをGoogle AIプラグインで初期化
export const ai = genkit({
  plugins: [
    googleAI(
      sanitizedGeminiApiKey
        ? {
            apiKey: sanitizedGeminiApiKey,
          }
        : undefined,
    ),
  ],
});