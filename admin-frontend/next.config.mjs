/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    optimizePackageImports: ['firebase', 'react-icons'],
    // Next.js 14: server components external packages (tidak di-bundle oleh webpack)
    serverComponentsExternalPackages: [
      'firebase-admin',
      '@langchain/google-genai',
      '@langchain/core',
    ],
  },
};

export default nextConfig;
