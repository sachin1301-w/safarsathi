// Claude tool-use loop: Claude picks tools, the backend runs them, Claude summarizes.
import Anthropic from '@anthropic-ai/sdk';

import { DEMO_USER_ID, prisma } from '../lib/db';
import { getProfile } from '../routes/profile';
import type { Card } from '../types';
import { runOfflineAgent } from './offline';
import { contextPrompt, STABLE_SYSTEM_PROMPT } from './systemPrompt';
import { runTool, TOOL_DEFINITIONS } from './tools';

const MODEL = 'claude-sonnet-5-5';
const MAX_TOOL_ROUNDS = 5;
const MAX_CARDS = 8;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  reply: string;
  cards: Card[];
  /** "ai" = Claude answered; "offline" = the rule-based fallback did. */
  mode: 'ai' | 'offline';
}

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (process.env.DEMO_OFFLINE?.trim().toLowerCase() === 'true') return null;
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return null;
  client ??= new Anthropic();
  return client;
}

async function buildSystem(language: string): Promise<Anthropic.Beta.BetaTextBlockParam[]> {
  const profile = await getProfile();
  const memories = await prisma.memory.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  return [
    // Stable rules last in the cached prefix (tools render before system).
    { type: 'text', text: STABLE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    {
      type: 'text',
      text: contextPrompt({
        language,
        now: new Date(),
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
    },
  ];
}

const textOf = (content: Anthropic.Beta.BetaContentBlock[]) =>
  content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

export async function runAgent(history: ChatTurn[], language: string): Promise<ChatResult> {
  const anthropic = getClient();
  if (!anthropic) return runOfflineAgent(history, language);

  const system = await buildSystem(language);
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({
    role: t.role,
    content: t.content,
  }));
  const cards: Card[] = [];
  const started = Date.now();

  try {
    for (let round = 0; ; round++) {
      // After five tool rounds, make Claude answer with what it has.
      const mustAnswer = round >= MAX_TOOL_ROUNDS;
      const response = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        // Chat at low effort: short replies, fast first token.
        output_config: { effort: 'low' },
        // If Claude Sonnet 5.5 declines, the API retries eligible categories on a fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        tools: TOOL_DEFINITIONS,
        tool_choice: mustAnswer ? { type: 'none' } : { type: 'auto' },
        messages,
      });

      if (response.stop_reason === 'refusal') {
        return {
          reply: "Sorry, I can't help with that. I can plan trips, find EV chargers and parking.",
          cards,
          mode: 'ai',
        };
      }
      if (response.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: response.content });
        continue;
      }

      const toolUses = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use',
      );
      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
        console.log(
          `chat: ${round} tool round(s), ${Date.now() - started} ms, cache read ${response.usage.cache_read_input_tokens ?? 0} tokens`,
        );
        return {
          reply: textOf(response.content) || 'Here is what I found.',
          cards: cards.slice(-MAX_CARDS),
          mode: 'ai',
        };
      }

      messages.push({ role: 'assistant', content: response.content });
      // Run the tools in parallel and return every result in one user message.
      const outputs = await Promise.all(toolUses.map((t) => runTool(t.name, t.input)));
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((t, i) => {
        cards.push(...(outputs[i].cards ?? []));
        return {
          type: 'tool_result',
          tool_use_id: t.id,
          content: JSON.stringify(outputs[i].result),
          ...(outputs[i].isError ? { is_error: true } : {}),
        };
      });
      messages.push({ role: 'user', content: results });
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic API key rejected; using the offline assistant.');
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error('Anthropic rate limit hit; using the offline assistant.');
    } else if (err instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${err.status}; using the offline assistant:`, err.message);
    } else if (err instanceof Anthropic.APIConnectionError) {
      console.error('Could not reach the Anthropic API; using the offline assistant.');
    } else {
      throw err;
    }
    return runOfflineAgent(history, language);
  }
}
