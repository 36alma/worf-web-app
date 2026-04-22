import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Git revision for versioning the precached offline page.
// Falls back to a random UUID if git is unavailable.
const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' })
    .stdout?.trim() || crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: [{ url: '/~offline', revision }],
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: true,
  cacheOnNavigation: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias['serwist/internal'] = path.join(
      __dirname,
      'node_modules',
      'serwist',
      'dist',
      'index.internal.js'
    );
    config.resolve.alias['@serwist/window/internal'] = path.join(
      __dirname,
      'node_modules',
      '@serwist',
      'window',
      'dist',
      'index.internal.js'
    );
    return config;
  },
  turbopack: {
    root: __dirname,
  },
};

export default withSerwist(withNextIntl(nextConfig));
