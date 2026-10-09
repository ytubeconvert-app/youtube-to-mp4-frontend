import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ytubeconvert.com',
  output: 'static',
  compressHTML: true,
  build: {
    inlineStylesheets: 'always',
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true
        }
      }
    }
  },
  i18n: {
    defaultLocale: 'en',
    locales: [
      'en',
      'es',
      'hi',
      'pt',
      'fr',
      'de',
      'id',
      'ar',
      'ru',
      'ja',
      'tr',
      'it',
      'ko',
      'vi'
    ],
    routing: {
      prefixDefaultLocale: false
    }
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          es: 'es',
          hi: 'hi',
          pt: 'pt',
          fr: 'fr',
          de: 'de',
          id: 'id',
          ar: 'ar',
          ru: 'ru',
          ja: 'ja',
          tr: 'tr',
          it: 'it',
          ko: 'ko',
          vi: 'vi'
        }
      },
      changefreq: 'weekly',
      priority: 0.8,
      lastmod: new Date()
    })
  ]
});
