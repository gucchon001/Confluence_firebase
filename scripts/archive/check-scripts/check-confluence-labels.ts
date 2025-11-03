/**
 * Confluenceからラベルが正しく取得できるか確認
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL || '';
const CONFLUENCE_USER_EMAIL = process.env.CONFLUENCE_USER_EMAIL || '';
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN || '';
const CONFLUENCE_SPACE_KEY = process.env.CONFLUENCE_SPACE_KEY || '';

async function main() {
  console.log('Checking Confluence Labels...\n');

  const auth = Buffer.from(`${CONFLUENCE_USER_EMAIL}:${CONFLUENCE_API_TOKEN}`).toString('base64');
  
  try {
    // サンプルページを取得
    const response = await axios.get(
      `${CONFLUENCE_BASE_URL}/wiki/rest/api/content`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
        params: {
          spaceKey: CONFLUENCE_SPACE_KEY,
          limit: 10,
          expand: 'body.storage,space,version,metadata.labels',
          type: 'page',
        },
      }
    );

    const pages = response.data.results;
    console.log(`Fetched ${pages.length} sample pages\n`);

    const results: any[] = [];

    for (const page of pages) {
      const pageId = page.id;
      const title = page.title;
      const labels = page.metadata?.labels?.results || [];
      const labelNames = labels.map((l: any) => l.name || l.label || String(l));

      results.push({
        pageId,
        title,
        labelCount: labels.length,
        labels: labelNames,
        rawLabels: labels
      });

      console.log(`Page: ${title}`);
      console.log(`  PageId: ${pageId}`);
      console.log(`  Labels: ${labels.length} items`);
      console.log(`  Label names: ${labelNames.join(', ') || '(none)'}`);
      console.log(`  Raw label structure:`, JSON.stringify(labels.slice(0, 2), null, 2));
      console.log();
    }

    // Save to file
    fs.writeFileSync('confluence-labels-check.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log('\nResults saved to: confluence-labels-check.json');

    // Summary
    const pagesWithLabels = results.filter(r => r.labelCount > 0).length;
    const totalLabels = results.reduce((sum, r) => sum + r.labelCount, 0);

    console.log('\nSummary:');
    console.log(`  Pages checked: ${results.length}`);
    console.log(`  Pages with labels: ${pagesWithLabels}/${results.length} (${(pagesWithLabels / results.length * 100).toFixed(1)}%)`);
    console.log(`  Total labels: ${totalLabels}`);
    console.log(`  Average labels per page: ${(totalLabels / results.length).toFixed(1)}`);

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();


