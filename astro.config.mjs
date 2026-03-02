// astro.config.mjs
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://okayjh.github.io',
  adapter: node({ mode: 'standalone' }),
  integrations: [mdx()],
  markdown: {
    shikiConfig: {
      theme: 'dracula', // 暗色系高亮，适合技术博客
      wrap: true,
    },
  },
});
