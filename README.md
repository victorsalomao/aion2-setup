# Rota Daeva

Site de fã para o AION 2: rota de gear score, builds por classe e calculadoras, em português e inglês.
Estático, gerado com [Astro](https://astro.build), sem servidor e sem banco de dados.

```bash
npm install
npm run dev      # http://localhost:4321
npm test         # testes das calculadoras
npm run build    # gera o site em dist/
```

Precisa de Node 22 ou mais novo.

## Como o projeto está organizado

```
src/
  config/site.ts        nome do site, data dos dados, ID do AdSense
  content.config.ts     esquema do conteúdo (o "contrato")
  content/
    classes/*.json      uma classe por arquivo
    guides/pt|en/*.md   um guia por arquivo e por idioma
  lib/                  contas puras: odyle, rite, enhance, progression
  i18n/                 textos de interface e helpers de idioma
  components/           peças de tela reaproveitadas
  layouts/Base.astro    <head>, cabeçalho, rodapé, espaços de anúncio
  pages/[...lang]/      as rotas; cada arquivo gera a página nos dois idiomas
tests/                  testes das contas em src/lib
```

### As quatro decisões que sustentam o resto

**1. Site estático.** Todo HTML é gerado no build. O Google indexa texto pronto, a página abre rápido e a hospedagem é de graça. O que precisa de interação (as calculadoras) leva só o JavaScript daquela peça.

**2. Conteúdo separado do código, com esquema.** Uma classe é um JSON; um guia é um markdown. As páginas só leem esses arquivos. O esquema em `content.config.ts` valida cada arquivo no build: campo faltando ou com tipo errado quebra o build em vez de publicar página torta. É o mesmo papel de um DTO validado numa API.

**3. Conta em função pura, tela à parte.** `planOdyle`, `riteScore` e `expectedAttempts` recebem números e devolvem números. Não tocam em DOM nem em estado. Por isso o mesmo código roda no navegador, no build e nos testes, e um erro de conta aparece no `npm test`, não na frente do usuário.

**4. Idioma como parâmetro de rota.** Cada página mora em `pages/[...lang]/`. O parâmetro vazio gera a versão em português na raiz (`/classes/chanter/`), e `en` gera a inglesa (`/en/classes/chanter/`). Um arquivo, duas páginas, e o layout cuida de `hreflang` e `canonical`.

## Tarefas comuns

### Atualizar uma classe

As 9 classes têm um arquivo em `src/content/classes/`. As skills e os Stigmas vêm do Shugo.GG (`/skills/<classe>`). As três builds de cada classe vêm do planejador da MetaBot.GG (`/en/aion-2/classes/<classe>/build`):

- `pve`: o que os jogadores do topo usam, com a % de uso de cada skill (`usage`);
- `leveling` e `pvp`: builds editoriais, com rotação e motivos (`why`).

Depois de um patch:

1. Confira as duas páginas de origem e ajuste níveis, Stigmas e `stigmaLevels` de cada modo.
2. Atualize `basis` (quantos jogadores e a data dos dados) e `updated`.
3. Rode `npm run build`: o esquema acusa id que não existe ou campo com tipo errado.

O Brawler ainda não tem build com fonte. A página mostra só skills e Stigmas, com um aviso em `notice`.

Uma classe com `"status": "draft"` sai só com o aviso de construção.

A página de rascunho sai com `noindex` e fora do sitemap. Isso é de propósito: página vazia indexada pesa contra o site na avaliação do AdSense.

### Escrever um guia

Crie `src/content/guides/pt/<nome>.md` e `src/content/guides/en/<nome>.md` com o mesmo `key` no frontmatter. O `key` vira a URL e é o que liga as duas traduções. Um guia pode existir em um idioma só; o botão de troca de idioma some sozinho.

### Mudar um texto de interface

Tudo em `src/i18n/ui.ts`. Se a chave existir em um idioma e faltar no outro, o TypeScript acusa.

### Corrigir um número do jogo

- Barreiras de gear score: `src/lib/progression.ts`
- Rito da Ascensão: `src/lib/rite.ts`
- Chances de aprimoramento: `src/lib/enhance.ts`

Depois rode `npm test`. Atualize `dataCheckedAt` em `src/config/site.ts`.

## Deploy

Qualquer hospedagem de site estático serve. Em Cloudflare Pages, Vercel ou Netlify:

| Campo | Valor |
|---|---|
| Comando de build | `npm run build` |
| Pasta de saída | `dist` |
| Variável `SITE_URL` | `https://seu-dominio.com` |

Sem `SITE_URL`, os endereços de `canonical`, `hreflang`, sitemap e `robots.txt` saem com `example.com`.

O arquivo `.github/workflows/ci.yml` roda teste e build em todo push e pull request.

## Anúncios

Os espaços já estão no layout e ficam desligados até existir um ID.

| Variável | Para quê |
|---|---|
| `PUBLIC_ADSENSE_CLIENT` | `ca-pub-...`; liga o script do AdSense |
| `PUBLIC_ADSENSE_SLOT_FOOTER` | bloco no fim de toda página |
| `PUBLIC_ADSENSE_SLOT_INCONTENT` | bloco no meio da página de classe e no topo do guia |
| `PUBLIC_SHOW_AD_PLACEHOLDERS` | `1` mostra caixas tracejadas no lugar, para conferir o layout |

Antes de pedir aprovação:

- [ ] Domínio próprio no ar, com `SITE_URL` certo
- [ ] Pelo menos 3 ou 4 classes publicadas e os guias revisados
- [ ] Páginas de Sobre, Contato e Política de Privacidade (ainda não existem)
- [ ] `public/ads.txt` com a linha que o AdSense fornece
- [ ] Aviso de consentimento de cookies: o Google exige uma plataforma de consentimento certificada para visitantes da Europa, e a LGPD pede transparência no Brasil

## Ícones e dados de terceiros

Os ícones de skills e itens, e os nomes oficiais em português, vêm da MetaBot.GG, que lê o cliente do jogo. As imagens carregam direto de `metabot.gg/web/aion2/...`, sem cópia no projeto. Se uma não carregar, aparece uma sigla no lugar.

- `npm run import:skills`: ícones e nomes em português das skills das classes.
- `npm run import:crafting`: receitas, ícones e nomes dos itens, e o Dragon Lord.

O aion2.th.gl não é mais usado: o `robots.txt` dele bloqueia agentes de IA.

Fora o menu de craft, o site não usa ícone do jogo. As skills aparecem com um quadrado de iniciais colorido por categoria.

Os dados de skills, receitas e builds vêm de dois sites que liberam o uso, com condições:

| Fonte | O que usamos | Condição |
|---|---|---|
| [Shugo.GG](https://shugo.gg) | skills das classes, todas as receitas de craft | crédito "Shugo.GG" com link para a página. A pasta `/api/` é proibida no `robots.txt` deles: o importador lê só as páginas públicas |
| [MetaBot.GG](https://metabot.gg) | builds recomendadas, guia de crafting | link **dofollow** (sem `rel="nofollow"`, `sponsored` ou `ugc`) para a página exata de onde veio o dado |

- As receitas se atualizam com `npm run import:crafting`. As classes são revisadas à mão, porque o texto é traduzido.
- Os ícones são da NCSOFT. Para usar, peça autorização ou entre no programa de criadores do AION 2.
- Não puxe dados de outros sites sem conferir os termos. Além do risco legal, eles podem bloquear a origem a qualquer momento e derrubar as páginas.
- Antes de ligar anúncio, avise o Shugo.GG e a MetaBot.GG. As condições acima valem para uso gratuito com crédito; anúncio é outra conversa.
- Parte dos números é da versão coreana. Cada página mostra a data da conferência.

## Plano de 2 dias

**Dia 1: no ar**

1. Criar o repositório e subir este código.
2. Registrar o domínio e ligar na hospedagem com `SITE_URL`.
3. Trocar o nome do site em `src/config/site.ts`, se quiser outro.
4. Escrever Sobre, Contato e Privacidade.
5. Cadastrar o site no Google Search Console e enviar o sitemap.

**Dia 2: conteúdo**

1. Publicar mais 2 ou 3 classes, começando pelas mais jogadas.
2. Revisar os 3 guias e escrever mais 2 com o que você já sabe do jogo.
3. Pedir a aprovação do AdSense. Ela costuma levar de dias a semanas.

## O que falta

- Build com fonte para o Brawler
- Páginas institucionais (Sobre, Contato, Privacidade)
- Aviso de consentimento de cookies
- Imagem de compartilhamento (`og:image`)
- Checklist diário e semanal do app antigo, que ainda não foi migrado
