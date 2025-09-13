"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ai = void 0;
const genkit_1 = require("genkit");
const googleai_1 = require("@genkit-ai/googleai");
// Google Cloudのロギングとトレースを有効化
// enableGoogleCloudTelemetry();
// GenkitをGoogle AIプラグインで初期化
exports.ai = (0, genkit_1.genkit)({
    plugins: [(0, googleai_1.googleAI)()],
    // logLevel: 'debug',
    // enableTracingAndMetrics: true,
});
