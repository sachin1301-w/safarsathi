/**
 * The copilot: picks an LLM provider, runs its tool-use loop, and falls back down the chain
 * (Claude → Gemini → Sarvam → offline assistant) so the chat always answers.
 *
 * LLM_PROVIDER=claude | gemini | sarvam | offline picks the first provider to try. Unset, it
 * tries every provider with a key in that order, then the offline assistant.
 */
import { currentUserId } from '../lib/auth';
import { prisma } from '../lib/db';
import { getProfile } from '../routes/profile';
import type { Card } from '../types';
import { claudeConfigured, isAccountError, runClaude } from './claudeAgent';
import { geminiConfigured, runGemini } from './geminiAgent';
import { describeCards, runOfflineAgent } from './offline';
import { withRequestContext, type UserLocation } from './requestContext';
import { runSarvam, sarvamConfigured } from './sarvamAgent';
import { contextPrompt, STABLE_SYSTEM_PROMPT } from './systemPrompt';

const MAX_CARDS = 8;
/** After a "no credits" or "bad key" error, don't try Claude again for this long. */
const ACCOUNT_ERROR_BACKOFF_MS = 10 * 60_000;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type Provider = 'claude' | 'gemini' | 'sarvam' | 'offline';

export interface ChatResult {
  reply: string;
  cards: Card[];
  /** "ai" = an LLM answered; "offline" = the rule-based assistant did. */
  mode: 'ai' | 'offline';
  provider: Provider;
}

export interface AgentContext {
  stablePrompt: string;
  contextPrompt: string;
}

export interface ProviderReply {
  reply: string;
  cards: Card[];
  rounds: number;
}

let claudeBlockedUntil = 0;

async function buildContext(language: string, location?: UserLocation): Promise<AgentContext> {
  const profile = await getProfile();
  const memories = await prisma.memory.findMany({
    where: { userId: currentUserId() },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  return {
    stablePrompt: STABLE_SYSTEM_PROMPT,
    contextPrompt: contextPrompt({
      language,
      now: new Date(),
      location: location && {
        lat: location.lat,
        lng: location.lng,
        near: location.near?.name ?? null,
      },
      memories: memories.map((m) => m.text),
      profile: {
        name: profile.name,
        hasEv: profile.hasEv,
        evRangeKm: profile.evRangeKm,
        evConnector: profile.evConnector,
        evBatteryPct: profile.evBatteryPct,
        home: profile.home?.name ?? null,
        office: profile.office?.name ?? null,
      },
    }),
  };
}

/** Providers to try, in order. */
function providerChain(): Provider[] {
  if (process.env.DEMO_OFFLINE?.trim().toLowerCase() === 'true') return ['offline'];
  const available: Provider[] = [];
  if (claudeConfigured() && Date.now() >= claudeBlockedUntil) available.push('claude');
  if (geminiConfigured()) available.push('gemini');
  if (sarvamConfigured()) available.push('sarvam');
  const preferred = process.env.LLM_PROVIDER?.trim().toLowerCase() as Provider | undefined;
  if (preferred === 'offline') return ['offline'];
  const ordered =
    preferred && available.includes(preferred)
      ? [preferred, ...available.filter((p) => p !== preferred)]
      : available;
  return [...ordered, 'offline'];
}

export function runAgent(
  history: ChatTurn[],
  language: string,
  location?: UserLocation,
): Promise<ChatResult> {
  // Tools read the user's location from the request context.
  return withRequestContext({ location }, () => runChain(history, language, location));
}

async function runChain(
  history: ChatTurn[],
  language: string,
  location?: UserLocation,
): Promise<ChatResult> {
  const chain = providerChain();
  const ctx = chain[0] === 'offline' ? null : await buildContext(language, location);

  for (const provider of chain) {
    if (provider === 'offline') {
      return { ...(await runOfflineAgent(history, language)), provider: 'offline' };
    }
    const started = Date.now();
    try {
      const run = { claude: runClaude, gemini: runGemini, sarvam: runSarvam }[provider];
      const out = await run(history, ctx!);
      console.log(`chat: ${provider}, ${out.rounds} tool round(s), ${Date.now() - started} ms`);
      return {
        reply: out.reply || describeCards(out.cards, language),
        cards: out.cards.slice(-MAX_CARDS),
        mode: 'ai',
        provider,
      };
    } catch (err) {
      if (provider === 'claude' && isAccountError(err))
        claudeBlockedUntil = Date.now() + ACCOUNT_ERROR_BACKOFF_MS;
      console.error(`chat: ${provider} failed, trying the next provider:`, (err as Error).message);
    }
  }
  return { ...(await runOfflineAgent(history, language)), provider: 'offline' };
}
