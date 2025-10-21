/**
 * 埋め込みモデルをHugging Faceからダウンロード
 * 
 * ビルド時に実行され、モデルファイルをローカルに保存
 * これにより実行時のHugging Faceへのアクセスを回避
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODEL_DIR = path.join(process.cwd(), 'models', 'paraphrase-multilingual-mpnet-base-v2');
const MODEL_REPO = 'Xenova/paraphrase-multilingual-mpnet-base-v2';
const BASE_URL = `https://huggingface.co/${MODEL_REPO}/resolve/main`;

// ダウンロードするファイル一覧
const MODEL_FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'onnx/model.onnx',
  'onnx/model_quantized.onnx',
];

/**
 * ファイルをダウンロード
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading: ${url}`);
    
    // ディレクトリを作成
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(destPath);
    
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    }, (response) => {
      // リダイレクトに対応
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`   ✅ Downloaded: ${path.basename(destPath)}`);
            resolve();
          });
        }).on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`   ✅ Downloaded: ${path.basename(destPath)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

/**
 * すべてのモデルファイルをダウンロード
 */
async function downloadModel() {
  console.log('🚀 埋め込みモデルのダウンロード開始...\n');
  console.log(`   モデル: ${MODEL_REPO}`);
  console.log(`   保存先: ${MODEL_DIR}\n`);

  // モデルディレクトリが既に存在する場合はスキップ
  if (fs.existsSync(MODEL_DIR) && fs.readdirSync(MODEL_DIR).length > 0) {
    console.log('✅ モデルファイルは既に存在します。ダウンロードをスキップします。\n');
    console.log('   削除してダウンロードし直す場合: npm run model:clean\n');
    return;
  }

  // モデルディレクトリを作成
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  let successCount = 0;
  let failCount = 0;

  // ファイルを順次ダウンロード（レートリミット回避のため）
  for (const file of MODEL_FILES) {
    const url = `${BASE_URL}/${file}`;
    const destPath = path.join(MODEL_DIR, file);
    
    try {
      await downloadFile(url, destPath);
      successCount++;
      
      // レートリミット回避のため少し待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`   ❌ Failed to download ${file}:`, error.message);
      failCount++;
      
      // 重要なファイルのダウンロードに失敗した場合はエラー
      if (['config.json', 'tokenizer.json', 'onnx/model.onnx'].includes(file)) {
        throw new Error(`Critical model file download failed: ${file}`);
      }
    }
  }

  console.log('\n📊 ダウンロード結果:');
  console.log(`   成功: ${successCount}/${MODEL_FILES.length}`);
  console.log(`   失敗: ${failCount}/${MODEL_FILES.length}`);
  
  if (successCount >= 3) {
    console.log('\n✅ モデルダウンロード完了！');
    console.log(`   モデルパス: ${MODEL_DIR}`);
  } else {
    throw new Error('モデルダウンロードが不完全です');
  }
}

// スクリプト実行
if (require.main === module) {
  downloadModel()
    .then(() => {
      console.log('\n🎉 モデルのセットアップが完了しました！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ モデルダウンロードエラー:', error);
      console.error('\n⚠️ フォールバック: 実行時にHugging Faceからダウンロードします');
      console.error('   （レートリミットのリスクあり）\n');
      // ビルドは継続（実行時ダウンロードにフォールバック）
      process.exit(0);
    });
}

module.exports = { downloadModel };

