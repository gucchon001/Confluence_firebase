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
    // ★★★ CopyPluginはサーバービルドでのみ実行 ★★★
    if (isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            // ★★★ これが最終的な正しい設定 ★★★
            // ライブラリが期待する 'Xenova/' プレフィックス付きのパスにモデルファイルをコピーする
            {
              from: path.resolve(__dirname, 'models/paraphrase-multilingual-mpnet-base-v2'),
              to: path.resolve(__dirname, '.next/standalone/models/Xenova/paraphrase-multilingual-mpnet-base-v2'),
              noErrorOnMissing: false, // ファイルがない場合はビルドを失敗させる
            },
            // サーバービルド用にも同じ設定を追加
            {
              from: path.resolve(__dirname, 'models/paraphrase-multilingual-mpnet-base-v2'),
              to: path.resolve(__dirname, '.next/server/models/Xenova/paraphrase-multilingual-mpnet-base-v2'),
              noErrorOnMissing: false,
            },

            // Kuromoji辞書ファイルをビルドに含める
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