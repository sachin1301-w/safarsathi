// Claude tool-use loop: Claude picks tools, the backend runs them, Claude summarizes.
import Anthropic from '@anthropic-ai/sdk';

import type { Card } from '../types';
import type { AgentContext, ChatTurn, ProviderReply } from './agent';
import { runTool, TOOL_DEFINITIONS } from './tools';

const MODEL = 'claude-sonnet-5-5';
const MAX_TOOL_ROUNDS = 5;

let client: Anthropic | null = null;

export const claudeConfigured = () => !!process.env.ANTHROPIC_API_KEY?.trim();

const textOf = (content: Anthropic.Beta.BetaContentBlock[]) =>
  content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

/** True for errors that won't go away by retrying soon (no credits, bad key). */
export function isAccountError(err: unknown): boolean {
  return (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError ||
    (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message))
  );
}

export async function runClaude(history: ChatTurn[], ctx: AgentContext): Promise<ProviderReply> {
  client ??= new Anthropic();
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    // Stable rules last in the cached prefix (tools render before system).
    { type: 'text', text: ctx.stablePrompt, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: ctx.contextPrompt },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({
    role: t.role,
    content: t.content,
  }));
  const cards: Card[] = [];

  for (let round = 0; ; round++) {
    // After five tool rounds, make Claude answer with what it has.
    const mustAnswer = round >= MAX_TOOL_ROUNDS;
    const response = await client.beta.messages.create({
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
        rounds: round,
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
      return { reply: textOf(response.content), cards, rounds: round };
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
}
