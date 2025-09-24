/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 開発環境でのパフォーマンス最適化
  // swcMinify: true, // Next.js 15では不要
  typescript: {
    // 型チェックを有効化（エラーを修正してから有効化）
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // 開発環境での最適化
  experimental: {
    optimizeCss: true,
  },
  // パッケージの最適化
  transpilePackages: ['lunr'],
  webpack: (config, { isServer }) => {
    // LanceDBのネイティブバイナリモジュールをWebpackから除外
    if (isServer) {
      config.externals.push({
        '@lancedb/lancedb': 'commonjs @lancedb/lancedb',
        '@lancedb/lancedb-win32-x64-msvc': 'commonjs @lancedb/lancedb-win32-x64-msvc'
      });
    }
    
    // Handlebarsの警告を解決
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    
    // Handlebarsを外部モジュールとして扱う
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