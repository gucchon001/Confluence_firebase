import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Moduleで __dirname を再現するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ★★★ Firebase App Hosting用のスタンドアロン出力設定 ★★★
  output: 'standalone',
  
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  transpilePackages: ['lunr'],
  webpack: (config, { isServer }) => {
    config.cache = {
      type: 'filesystem',
      compression: 'gzip',
      buildDependencies: {
        config: [__filename]
      },
      cacheDirectory: path.resolve(__dirname, '.next/cache/webpack'),
      maxAge: 1000 * 60 * 60 * 24 * 7  // 7日間
    };
    
    if (isServer) {
      // ビルド時のデバッグログ（モデルファイルのコピー確認用）
      console.log('[Build] CopyPlugin configuration:');
      console.log('[Build] - Project root:', __dirname);
      console.log('[Build] - Models source:', path.resolve(__dirname, 'models'));
      console.log('[Build] - Standalone target:', path.resolve(__dirname, '.next/standalone/models'));
      
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            // ★★★ Xenova Transformers.js用モデルファイル ★★★
            // Xenovaは models/Xenova/model-name という階層を期待する
            
            // 方針変更: postbuildスクリプトに依存せず、CopyPluginで直接Xenova/構造を作る
            // これにより、Firebase App Hostingのビルド環境でも確実に動作する
            
            // Step 1: まず通常のmodelsディレクトリにコピー
            {
              from: path.resolve(__dirname, 'models/paraphrase-multilingual-mpnet-base-v2'),
              to: path.resolve(__dirname, '.next/standalone/models/paraphrase-multilingual-mpnet-base-v2'),
              noErrorOnMissing: false,
              globOptions: {
                dot: true,
                ignore: ['**/.DS_Store', '**/Thumbs.db']
              },
              force: true
            },
            // Step 2: 同時にXenova/サブディレクトリにもコピー
            {
              from: path.resolve(__dirname, 'models/paraphrase-multilingual-mpnet-base-v2'),
              to: path.resolve(__dirname, '.next/standalone/models/Xenova/paraphrase-multilingual-mpnet-base-v2'),
              noErrorOnMissing: false,
              globOptions: {
                dot: true,
                ignore: ['**/.DS_Store', '**/Thumbs.db']
              },
              force: true
            },
            
            // サーバービルド用も同様
            {
              from: path.resolve(__dirname, 'models/paraphrase-multilingual-mpnet-base-v2'),
              to: path.resolve(__dirname, '.next/server/models/paraphrase-multilingual-mpnet-base-v2'),
              noErrorOnMissing: false,
              globOptions: {
                dot: true,
                ignore: ['**/.DS_Store', '**/Thumbs.db']
              },
              force: true
            },
            {
              from: path.resolve(__dirname, 'models/paraphrase-multilingual-mpnet-base-v2'),
              to: path.resolve(__dirname, '.next/server/models/Xenova/paraphrase-multilingual-mpnet-base-v2'),
              noErrorOnMissing: false,
              globOptions: {
                dot: true,
                ignore: ['**/.DS_Store', '**/Thumbs.db']
              },
              force: true
            },
            // ★★★ ここまでが追加・修正箇所 ★★★

            // ★★★ LanceDBのネイティブモジュール（最重要！）★★★
            // 理由: Next.jsのスタンドアロンビルドは動的依存を解決できない
            // firebase-admin-initの動的requireにより、LanceDBのネイティブバイナリが
            // 自動検出されず、手動コピーが必須となる
            
            // Cloud Run（Linux x64-gnu）用のネイティブバイナリ
            {
              from: path.resolve(__dirname, 'node_modules/@lancedb/lancedb-linux-x64-gnu'),
              to: path.resolve(__dirname, '.next/standalone/node_modules/@lancedb/lancedb-linux-x64-gnu'),
              noErrorOnMissing: true, // ローカル環境（Windows/Mac）では存在しない
              globOptions: {
                dot: true,
                ignore: ['**/.DS_Store', '**/Thumbs.db']
              },
              force: true
            },
            
            // LanceDB本体（JavaScript部分）
            {
              from: path.resolve(__dirname, 'node_modules/@lancedb/lancedb'),
              to: path.resolve(__dirname, '.next/standalone/node_modules/@lancedb/lancedb'),
              noErrorOnMissing: true,
              globOptions: {
                dot: true,
                ignore: [
                  '**/.DS_Store', 
                  '**/Thumbs.db', 
                  '**/node_modules/**', // 再帰的なnode_modulesを除外
                  '**/*.md',            // ドキュメントを除外
                  '**/test/**',         // テストファイルを除外
                  '**/tests/**'
                ]
              },
              force: true
            },
            // ★★★ LanceDB ネイティブモジュール終わり ★★★

            // Kuromoji辞書ファイルをビルドに含める（既存の設定）
            {
              from: path.resolve(__dirname, 'node_modules/kuromoji/dict'),
              to: path.resolve(__dirname, '.next/server/node_modules/kuromoji/dict'),
              noErrorOnMissing: false,
            },
            {
              from: path.resolve(__dirname, 'node_modules/kuromoji/dict'),
              to: path.resolve(__dirname, '.next/standalone/node_modules/kuromoji/dict'),
              noErrorOnMissing: false,
            },
          ],
        })
      );
    }
    
    // Note: LanceDBはserverExternalPackagesで管理するため、externalsへの追加は不要
    // Next.js 13+では、serverExternalPackagesのみで十分
    
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    
    if (isServer) {
      config.externals.push('handlebars');
    }
    
    return config;
  },
  serverExternalPackages: [
    '@genkit-ai/core',
    '@genkit-ai/google-cloud',
    '@genkit-ai/googleai',
    '@genkit-ai/next',
    'genkit',
    '@lancedb/lancedb',
    '@lancedb/lancedb-win32-x64-msvc',
    '@lancedb/lancedb-linux-x64-gnu',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;