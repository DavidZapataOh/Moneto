/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@moneto/theme", "@moneto/types", "@moneto/utils", "@moneto/config"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
