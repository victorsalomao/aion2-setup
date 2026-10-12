import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * O esquema é o contrato do conteúdo. Um arquivo de classe com campo faltando
 * ou com tipo errado quebra o build, em vez de publicar página torta.
 */
const l10n = z.object({ pt: z.string(), en: z.string() });
const category = z.enum(['damage', 'control', 'heal', 'move', 'aura', 'passive']);

const skill = z.object({
  id: z.string(),
  name: z.string(),
  /** nome oficial em português do cliente do jogo (fonte: MetaBot.GG pt_BR) */
  namePt: z.string().optional(),
  /** ícone oficial: https://metabot.gg/web/aion2/skills/<id>.webp */
  icon: z.string().url().optional(),
  mono: z.string().max(3),
  category,
  level: z.number().int().min(0).max(20),
  spec: l10n.optional(),
  role: l10n,
  /** efeito completo da skill, traduzido dos dados do cliente */
  effect: l10n.optional(),
  /** % dos jogadores do topo que usam a skill (fonte da build) */
  usage: z.number().min(0).max(100).optional(),
});

const stigma = z.object({
  id: z.string(),
  name: z.string(),
  /** nome oficial em português do cliente do jogo (fonte: MetaBot.GG pt_BR) */
  namePt: z.string().optional(),
  /** ícone oficial: https://metabot.gg/web/aion2/skills/<id>.webp */
  icon: z.string().url().optional(),
  mono: z.string().max(3),
  category,
  level: l10n,
  description: l10n,
  /** % dos jogadores do topo que equipam o Stigma */
  usage: z.number().min(0).max(100).optional(),
});

const mode = z.object({
  id: z.string(),
  name: l10n,
  lead: l10n,
  /** ids de Stigma sempre equipados */
  fixed: z.array(z.string()),
  /** opções do slot flexível */
  flex: z.array(z.object({ stigma: z.string(), when: l10n })).default([]),
  /** skills que mudam de nível neste modo */
  overrides: z.array(z.object({ skill: z.string(), level: z.number().int(), spec: l10n.optional(), why: l10n })).default([]),
  rotation: z.array(l10n).default([]),
  rotationNote: l10n.optional(),
  stats: l10n.optional(),
  note: l10n.optional(),
  /** de onde a build vem, ex.: "153 jogadores do topo, atualizado em 2026-10-02" */
  basis: l10n.optional(),
  /** por que a build é assim, um motivo por item */
  why: z.array(l10n).default([]),
  /** nível de cada Stigma neste modo; sem valor, vale o nível geral do Stigma */
  stigmaLevels: z.record(z.string(), z.number().int().min(1).max(20)).default({}),
});

const classes = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/classes' }),
  schema: z.object({
    name: l10n,
    order: z.number().int(),
    status: z.enum(['published', 'draft']),
    archetype: l10n,
    summary: l10n,
    updated: z.string().optional(),
    /** aviso no topo da página, ex.: build ainda sem fonte */
    notice: l10n.optional(),
    actives: z.array(skill).default([]),
    passives: z.array(skill).default([]),
    stigmas: z.array(stigma).default([]),
    modes: z.array(mode).default([]),
    sources: z.array(z.object({ title: z.string(), url: z.string().url() })).default([]),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    /** mesma chave nas duas traduções: é o que liga pt e en e vira a URL */
    key: z.string(),
    lang: z.enum(['pt', 'en']),
    title: z.string(),
    description: z.string(),
    order: z.number().int().default(99),
    updated: z.string(),
  }),
});

export const collections = { classes, guides };
