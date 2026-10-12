import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';

// Classes em rascunho ficam fora do sitemap (e saem com noindex na página).
const classDir = new URL('./src/content/classes/', import.meta.url);
const drafts = readdirSync(classDir)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => JSON.parse(readFileSync(new URL(f, classDir), 'utf8')).status !== 'published')
  .map((f) => `/classes/${f.replace('.json', '')}/`);

// SITE_URL vem do ambiente (Cloudflare Pages, Vercel, CI). Sem ele o build usa um
// endereço de exemplo: canonical, hreflang e sitemap só ficam certos com o domínio real.
export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',
  trailingSlash: 'always',
  // Elementalist virou Spiritmaster, o nome do jogo global. Os links antigos continuam valendo.
  redirects: {
    '/classes/elementalist/': '/classes/spiritmaster/',
    '/en/classes/elementalist/': '/en/classes/spiritmaster/',
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'pt', locales: { pt: 'pt-BR', en: 'en' } },
      filter: (page) => !drafts.some((d) => page.endsWith(d)),
    }),
  ],
});
