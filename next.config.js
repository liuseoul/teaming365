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
    } else {
      // E3Kit's crypto primitives are compiled to WebAssembly.
      // Tell webpack to handle .wasm files as async modules (not raw bytes).
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      }
    }
    return config
  },
}

module.exports = nextConfig
