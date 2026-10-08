/** Tudo que identifica o site fica aqui: trocar o nome é mexer só neste arquivo. */
export const SITE = {
  name: 'Rota Daeva',
  game: 'AION 2',
  /** data da última conferência manual dos dados do jogo */
  dataCheckedAt: '2026-10-07',
  adsenseClient: import.meta.env.PUBLIC_ADSENSE_CLIENT || '',
  showAdPlaceholders: import.meta.env.PUBLIC_SHOW_AD_PLACEHOLDERS === '1',
} as const;
