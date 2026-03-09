// astro.config.mjs
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';

// Only use node adapter in dev mode (needed for API routes)
// In production (GitHub Pages), we build as fully static
const isDev = process.env.NODE_ENV !== 'production' && !process.env.CI;

// https://astro.build/config
export default defineConfig({
  site: 'https://okayblog.me',
  ...(isDev ? { adapter: node({ mode: 'standalone' }) } : {}),
  integrations: [mdx()],
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: false,
    },
  },
});
