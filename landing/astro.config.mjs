// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://josorio7122.github.io',
  base: '/superside-assessment',
  vite: {
    plugins: [tailwindcss()],
  },
});
