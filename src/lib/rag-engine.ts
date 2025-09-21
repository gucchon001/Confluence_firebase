import { searchLanceDB } from './lancedb-search-client';
import { summarizeConfluenceDocs } from '../ai/flows/summarize-confluence-docs';
import { LabelFilterOptions } from './search-weights';

export interface RagAnswerChunk {
  title: string;
  url?: string;
  excerpt: string;
  source: string;
  scoreText?: string;
}

export interface RagAnswer {
  summary: string;
  bullets: string[];
  citations: RagAnswerChunk[];
}

function buildPrompt(query: string, docs: RagAnswerChunk[]): string {
  const parts: string[] = [];
  parts.push(`ユーザー質問: ${query}`);
  parts.push('参考資料:');
  docs.slice(0, 6).forEach((d, i) => {
    parts.push(`[${i + 1}] ${d.title}\n${d.excerpt}`);
  });
  parts.push('指示: 上位の参考資料を根拠に、1) 1段落要約、2) 箇条書きの要点5項目以内、3) 引用リスト（[番号] タイトル）を日本語で簡潔に出力してください。憶測は避け、資料の範囲に限定。');
  return parts.join('\n\n');
}

export async function answerWithRag(
  query: string,
  options: { labelFilters?: LabelFilterOptions } = {}
): Promise<RagAnswer> {
  // 検索（BM25+ベクトル融合は内部で実施）
  const results = await searchLanceDB({
    query,
    topK: 12,
    useLunrIndex: false,
    labelFilters: options.labelFilters,
  });

  // チャンク整形
  const chunks: RagAnswerChunk[] = results.map(r => ({
    title: r.title,
    url: r.url,
    excerpt: (r.content || '').slice(0, 800),
    source: r.source || 'vector',
    scoreText: r.scoreText,
  }));

  // 重複タイトル除去
  const seen = new Set<string>();
  const deduped = chunks.filter(c => {
    const key = c.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // LLM要約を実行（Genkitフローを利用）
  try {
    const summarizeInputDocs = results.map(r => ({
      title: r.title,
      url: r.url || '',
      spaceName: r.space_key || '',
      lastUpdated: r.lastUpdated || '',
      labels: r.labels || [],
      content: r.content || '',
      distance: r.distance,
      source: r.source || 'vector',
      scoreText: r.scoreText,
    }));

    const llm = await summarizeConfluenceDocs({
      question: query,
      context: summarizeInputDocs,
      chatHistory: [],
    });

    const summaryText = llm?.answer || '要約を生成できませんでした。';
    // 簡易的に箇条書きを抽出（改行ベース）
    const bullets = summaryText
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
      .slice(0, 6);

    return {
      summary: summaryText,
      bullets,
      citations: deduped.slice(0, 8),
    };
  } catch (e) {
    // フォールバック（LLM失敗時）
    const summary = `上位の参考資料に基づく要点の集約（最小RAG・フォールバック）。`;
    const bullets: string[] = deduped.slice(0, 5).map(c => `${c.title} を参照`);
    return {
      summary,
      bullets,
      citations: deduped.slice(0, 8)
    };
  }
}


