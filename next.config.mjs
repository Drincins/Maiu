import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fixes incorrect workspace root detection when multiple lockfiles exist.
  turbopack: {
    root: fileURLToPath(new URL('.', import.meta.url))
  }
}

export default nextConfig
