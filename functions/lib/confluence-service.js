"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllSpaceContent = getAllSpaceContent;
exports.extractTextFromHtml = extractTextFromHtml;
exports.splitTextIntoChunks = splitTextIntoChunks;
exports.processConfluencePage = processConfluencePage;
/**
 * Confluence API連携サービス
 */
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const config = __importStar(require("./config"));
/**
 * Confluenceからスペース内のすべてのコンテンツを取得する
 */
async function getAllSpaceContent(spaceKey) {
    var _a, _b, _c;
    try {
        console.log(`[getAllSpaceContent] Fetching content for space ${spaceKey}`);
        // Confluence API設定
        const baseUrl = process.env.CONFLUENCE_BASE_URL || ((_a = config.confluence) === null || _a === void 0 ? void 0 : _a.base_url);
        const username = process.env.CONFLUENCE_USER_EMAIL || ((_b = config.confluence) === null || _b === void 0 ? void 0 : _b.user_email);
        const apiToken = process.env.CONFLUENCE_API_TOKEN || ((_c = config.confluence) === null || _c === void 0 ? void 0 : _c.api_token);
        if (!baseUrl || !username || !apiToken) {
            throw new Error("Confluence API credentials not configured");
        }
        // ページの一覧を取得するエンドポイント
        const endpoint = `${baseUrl}/wiki/rest/api/content`;
        // 全ページを格納する配列
        let allPages = [];
        let start = 0;
        const limit = 100;
        let hasMore = true;
        // ページネーションでスペース内の全ページを取得
        while (hasMore) {
            console.log(`[getAllSpaceContent] Fetching pages ${start} to ${start + limit}`);
            // APIリクエストを送信
            const response = await axios_1.default.get(endpoint, {
                params: {
                    spaceKey,
                    expand: 'body.storage,version,space,metadata.labels',
                    start,
                    limit
                },
                auth: {
                    username,
                    password: apiToken
                }
            });
            // レスポンスを処理
            if (response.data && response.data.results) {
                console.log(`[getAllSpaceContent] Found ${response.data.results.length} pages`);
                allPages = allPages.concat(response.data.results);
                // 次のページがあるかチェック
                if (response.data.results.length < limit) {
                    hasMore = false;
                }
                else {
                    start += limit;
                }
            }
            else {
                hasMore = false;
            }
        }
        console.log(`[getAllSpaceContent] Total pages found: ${allPages.length}`);
        return allPages;
    }
    catch (error) {
        console.error('[getAllSpaceContent] Error fetching content from Confluence API:', error);
        // エラーの詳細情報を出力
        if (axios_1.default.isAxiosError(error)) {
            if (error.response) {
                console.error('[getAllSpaceContent] API response error:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });
            }
            else if (error.request) {
                console.error('[getAllSpaceContent] No response received:', error.request);
            }
            else {
                console.error('[getAllSpaceContent] Request error:', error.message);
            }
        }
        throw new Error(`Failed to fetch Confluence content: ${error.message}`);
    }
}
/**
 * HTMLからテキストを抽出する
 */
function extractTextFromHtml(html) {
    const $ = cheerio.load(html);
    // 不要な要素を削除
    try {
        $('ac\\:structured-macro').remove();
    }
    catch (error) {
        console.log(`[extractTextFromHtml] Warning: Error removing ac:structured-macro: ${error.message}`);
        // エラーが発生しても処理を続行
    }
    $('script').remove();
    $('style').remove();
    // テキストを取得
    return $.text().trim();
}
/**
 * テキストをチャンクに分割する
 */
function splitTextIntoChunks(text) {
    const CHUNK_SIZE = 1000;
    const CHUNK_OVERLAP = 100;
    const chunks = [];
    let currentChunk = "";
    // 段落ごとに分割
    const paragraphs = text.split('\n\n');
    for (const paragraph of paragraphs) {
        // 段落が長すぎる場合はさらに分割
        if (paragraph.length > CHUNK_SIZE) {
            const sentences = paragraph.split(/(?<=\. )|(?<=。)/);
            for (const sentence of sentences) {
                if (currentChunk.length + sentence.length <= CHUNK_SIZE) {
                    currentChunk += sentence;
                }
                else {
                    if (currentChunk.length > 0) {
                        chunks.push(currentChunk.trim());
                    }
                    currentChunk = sentence;
                }
            }
        }
        else {
            // 段落が短い場合は現在のチャンクに追加
            if (currentChunk.length + paragraph.length + 2 <= CHUNK_SIZE) {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
            else {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = paragraph;
            }
        }
    }
    // 最後のチャンクを追加
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}
/**
 * Confluenceページからレコードを生成する
 * @param page Confluenceページデータ
 * @returns 処理されたレコードの配列
 */
function processConfluencePage(page) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    try {
        console.log(`[processConfluencePage] Processing page: ${page.title} (ID: ${page.id})`);
        // HTMLからテキストを抽出
        const html = ((_b = (_a = page.body) === null || _a === void 0 ? void 0 : _a.storage) === null || _b === void 0 ? void 0 : _b.value) || "";
        const text = extractTextFromHtml(html);
        // テキストをチャンクに分割
        const chunks = splitTextIntoChunks(text);
        console.log(`[processConfluencePage] Split into ${chunks.length} chunks`);
        // ラベル情報を抽出
        const labels = ((_e = (_d = (_c = page.metadata) === null || _c === void 0 ? void 0 : _c.labels) === null || _d === void 0 ? void 0 : _d.results) === null || _e === void 0 ? void 0 : _e.map((label) => label.name)) || [];
        console.log(`[processConfluencePage] Labels: ${labels.join(', ') || 'none'}`);
        // Confluence API設定
        const baseUrl = process.env.CONFLUENCE_BASE_URL || ((_f = config.confluence) === null || _f === void 0 ? void 0 : _f.base_url);
        // 各チャンクに対してレコードを生成
        const records = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            // レコードを生成
            const record = {
                pageId: page.id,
                title: page.title,
                spaceKey: ((_g = page.space) === null || _g === void 0 ? void 0 : _g.key) || "",
                spaceName: ((_h = page.space) === null || _h === void 0 ? void 0 : _h.name) || "",
                url: `${baseUrl}/wiki/spaces/${(_j = page.space) === null || _j === void 0 ? void 0 : _j.key}/pages/${page.id}`,
                lastUpdated: ((_k = page.version) === null || _k === void 0 ? void 0 : _k.when) || "",
                chunkIndex: i,
                content: chunk,
                labels
            };
            records.push(record);
        }
        return records;
    }
    catch (error) {
        console.error(`[processConfluencePage] Error processing page ${page.id}: ${error.message}`);
        throw new Error(`Failed to process page ${page.id}: ${error.message}`);
    }
}
//# sourceMappingURL=confluence-service.js.map