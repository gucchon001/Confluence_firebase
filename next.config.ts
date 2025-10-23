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
    // ★★★ キャッシュクリア設定 ★★★
    // デバッグ中はキャッシュを無効化して、確実に最新の設定を使用
    config.cache = false;
    
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

            // 注意: LanceDBのネイティブモジュールは手動コピーしない
            // 理由:
            // 1. ファイルサイズが巨大で、ビルド時のメモリ不足（OOM Kill）を引き起こす
            // 2. serverExternalPackages設定により、Cloud Runのnpm install時に
            //    自動的に@lancedb/lancedb-linux-x64-gnuがインストールされる
            // 3. Next.jsのスタンドアロンビルドは、serverExternalPackagesを
            //    package.jsonに含め、デプロイ時にnpm installが実行される

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