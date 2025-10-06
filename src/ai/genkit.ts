import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { enableGoogleCloudTelemetry } from '@genkit-ai/google-cloud';

// Google Cloudのロギングとトレースを有効化
enableGoogleCloudTelemetry();

// GenkitをGoogle AIプラグインで初期化
export const ai = genkit({
  plugins: [googleAI()],
});