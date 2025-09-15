import 'dotenv/config';
import { getContentById, getAllSpaceContent } from '../lib/confluence-client';

function extractTextFromHtml(html: string): string {
  if (!html) return '';
  // デコード（代表的なエンティティ）
  const decoded = html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
  // スクリプト/スタイル/コメント除去
  const noCode = decoded
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ');
  // 改行・ブロック要素をスペース化（p, br, li 等）
  const withSpaces = noCode
    .replace(/<(br|p|div|li|ul|ol|table|tr|td|th|h\d)[^>]*>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|table|tr|td|th|h\d)>/gi, ' ');
  // それ以外のタグ削除
  const noTags = withSpaces.replace(/<[^>]*>/g, ' ');
  // 連続空白圧縮
  return noTags.replace(/\s+/g, ' ').trim();
}

async function main() {
  const spaceKey = process.env.CONFLUENCE_SPACE_KEY || 'CLIENTTOMO';
  const limit = Number(process.argv[2] || 10);

  const list: any[] = await getAllSpaceContent(spaceKey, 'page');
  const ids = list.slice(0, limit).map((x: any) => x.id);

  console.log(`Diagnosing sanitize for first ${ids.length} pages in space ${spaceKey}`);

  let emptyCount = 0;
  for (const id of ids) {
    try {
      const page: any = await getContentById(id);
      const title = page?.title;
      const html = page?.body?.storage?.value || '';
      const text = extractTextFromHtml(html);

      const htmlLen = html.length;
      const textLen = text.length;

      console.log(`\n[${id}] ${title}`);
      console.log(`  htmlLen=${htmlLen} textLen=${textLen}`);
      console.log(`  htmlHead: ${html.substring(0, 200).replace(/\n/g, ' ')}...`);
      console.log(`  textHead: ${text.substring(0, 200)}...`);

      if (textLen === 0 && htmlLen > 0) {
        emptyCount++;
        // 代表的な理由ヒューリスティクス
        const onlyTags = /^(\s|<[^>]*>)+$/.test(html);
        const onlyNbsp = html.replace(/&nbsp;|\u00A0/g, '').trim().length === 0;
        console.log(`  reason: ${onlyTags ? 'only-tags' : onlyNbsp ? 'only-nbsp' : 'unknown'}`);
      }
    } catch (e: any) {
      console.warn(`  Fetch failed ${id}:`, e?.message || e);
    }
  }
  console.log(`\nEmpty after sanitize: ${emptyCount}/${ids.length}`);
}

main().catch(e => {
  console.error('diagnose error:', e?.message || e);
  process.exit(1);
});
