// astro.config.mjs
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://okayjh.github.io', // 替换为真实的部署地址
  integrations: [mdx()],
  markdown: {
    shikiConfig: {
      theme: 'dracula', // 暗色系高亮，适合技术博客
      wrap: true,
    },
  },
});
