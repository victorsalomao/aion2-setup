import type { UiKey } from '../i18n/ui';

type ToolKey = 'odyle' | 'rite' | 'craft' | 'recipes' | 'enhance';

/** Lista única das ferramentas: a home e a página de ferramentas leem daqui. */
export const TOOLS: { to: string; key: ToolKey }[] = [
  { to: '/tools/odyle/', key: 'odyle' },
  { to: '/tools/rite/', key: 'rite' },
  { to: '/tools/craft/', key: 'craft' },
  { to: '/tools/recipes/', key: 'recipes' },
  { to: '/tools/enhance/', key: 'enhance' },
];

/** as chaves de texto da ferramenta; o TypeScript acusa se alguma não existir em ui.ts */
export function toolKeys(key: ToolKey): { title: UiKey; desc: UiKey } {
  return { title: `tools.${key}.title`, desc: `tools.${key}.desc` };
}
