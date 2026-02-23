/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone for Docker container deployment
  output: 'standalone',

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Image optimization settings
  images: {
    // Remote patterns for external images (if needed for slide images)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Disable image optimization in development for faster builds
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // Experimental features
  experimental: {
    // Enable server actions for future use
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // TypeScript strict mode
  typescript: {
    // Type checking is handled separately via `npm run typecheck`
    // This allows for faster builds during development
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    // Linting is handled separately via `npm run lint`
    ignoreDuringBuilds: false,
  },

  // Environment variables that should be available on the client
  env: {
    NEXT_PUBLIC_APP_NAME: 'MD2slide',
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Webpack configuration for handling workspace packages
  webpack: (config, { isServer }) => {
    // Handle workspace package symlinks
    config.resolve.symlinks = true;

    // Handle ESM modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }

    return config;
  },
};

export default nextConfig;
