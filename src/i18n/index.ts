/**
 * Dois idiomas, uma árvore de páginas.
 * Português é o padrão e mora na raiz ("/classes/chanter/"); inglês mora em "/en/".
 * Toda página usa o parâmetro [...lang]: vazio = pt, "en" = en.
 */
export const LOCALES = ['pt', 'en'] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LANG: Lang = 'pt';

/** texto que existe nos dois idiomas */
export type L10n = Record<Lang, string>;

export const HTML_LANG: Record<Lang, string> = { pt: 'pt-BR', en: 'en' };

export function langFromParam(param: string | undefined): Lang {
  return param === 'en' ? 'en' : DEFAULT_LANG;
}

/** valor do parâmetro [...lang] para cada idioma, pronto para getStaticPaths */
export function langParams(): { params: { lang: string | undefined }; props: { lang: Lang } }[] {
  return LOCALES.map((lang) => ({
    params: { lang: lang === DEFAULT_LANG ? undefined : lang },
    props: { lang },
  }));
}

/** caminho interno no idioma certo: href('en', '/classes/') -> '/en/classes/' */
export function href(lang: Lang, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return lang === DEFAULT_LANG ? clean : `/${lang}${clean}`;
}

/** tira o prefixo de idioma de um pathname: '/en/classes/' -> '/classes/' */
export function stripLang(pathname: string): string {
  for (const lang of LOCALES) {
    if (lang !== DEFAULT_LANG && (pathname === `/${lang}` || pathname.startsWith(`/${lang}/`))) {
      return pathname.slice(lang.length + 1) || '/';
    }
  }
  return pathname;
}

export function tr(value: L10n, lang: Lang): string {
  return value[lang];
}

export function formatNumber(n: number, lang: Lang): string {
  return n.toLocaleString(HTML_LANG[lang]);
}

export { ui, t } from './ui';
