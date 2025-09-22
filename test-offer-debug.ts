// オファー機能検索のデバッグ
import { askQuestion } from './src/app/actions';

async function testOfferSearch() {
  try {
    console.log('=== オファー機能検索テスト ===');
    
    const result = await askQuestion('オファー機能の種類は', [], {
      includeMeetingNotes: false,
      includeArchived: false
    });
    
    console.log('結果:');
    console.log('- Answer:', result.answer);
    console.log('- References count:', result.references.length);
    console.log('- References:', result.references.map(r => `${r.title} (${r.score}%)`));
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

testOfferSearch();
