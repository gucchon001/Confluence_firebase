/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // 型チェックを有効化（エラーを修正してから有効化）
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack: (config, { isServer }) => {
    // LanceDBのネイティブバイナリモジュールをWebpackから除外
    if (isServer) {
      config.externals.push({
        '@lancedb/lancedb': 'commonjs @lancedb/lancedb',
        '@lancedb/lancedb-win32-x64-msvc': 'commonjs @lancedb/lancedb-win32-x64-msvc'
      });
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