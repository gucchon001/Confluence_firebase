import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Moduleで __dirname を再現するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
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
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            // ★★★ Xenova Transformers.js用モデルファイル ★★★
            // Standaloneビルド用にmodelsディレクトリをコピー（本番環境用）
            {
              from: path.resolve(__dirname, 'models'),
              to: path.resolve(__dirname, '.next/standalone/models'),
              noErrorOnMissing: false,
            },
            // サーバービルド用にmodelsディレクトリをコピー（開発環境用）
            {
              from: path.resolve(__dirname, 'models'),
              to: path.resolve(__dirname, '.next/server/models'),
              noErrorOnMissing: false,
            },
            // ★★★ ここまでが追加・修正箇所 ★★★

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
    
    if (isServer) {
      config.externals.push({
        '@lancedb/lancedb': 'commonjs @lancedb/lancedb',
        '@lancedb/lancedb-win32-x64-msvc': 'commonjs @lancedb/lancedb-win32-x64-msvc'
      });
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