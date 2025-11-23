import path from 'path';
import { fileURLToPath } from 'url';

// ES Moduleで __dirname を再現するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ★★★ Firebase App Hosting用のスタンドアロン出力設定 ★★★
  output: 'standalone',
  
  // ★★★ instrumentation.jsはNext.js 15でデフォルトで有効 ★★★
  // experimental.instrumentationHook は不要（Next.js 15以降）
  
  // 環境変数のマッピング: GEMINI_API_KEYをNEXT_PUBLIC_GOOGLE_API_KEYとして公開
  // これにより、Google APIキーをGEMINI_API_KEYに一元化できます
  env: {
    NEXT_PUBLIC_GOOGLE_API_KEY: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
  },
  
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  transpilePackages: ['lunr'],
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    if (isServer) {
      config.externals.push('handlebars');
    }

    // クライアントサイドではLanceDBのネイティブモジュールを外部化
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@lancedb/lancedb': false,
        '@lancedb/lancedb-win32-x64-msvc': false,
        '@lancedb/lancedb-linux-x64-gnu': false,
      };
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