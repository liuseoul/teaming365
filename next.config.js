/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @virgilsecurity/e3kit-browser uses IndexedDB and is browser-only.
      // Prevent it from being bundled in the server/edge build.
      config.resolve.alias = {
        ...config.resolve.alias,
        '@virgilsecurity/e3kit-browser': false,
      }
    }
    return config
  },
}

module.exports = nextConfig
