/**
 * Sarvam AI tool-use loop (sarvam-105b, OpenAI-style chat completions with function calling).
 * Same tools, prompt and cards as the Claude loop; used when there are no Anthropic credits.
 */
import type { Card } from '../types';
import type { AgentContext, ChatTurn, ProviderReply } from './agent';
import { runTool, TOOL_DEFINITIONS, type ToolOutput } from './tools';

const URL = 'https://api.sarvam.ai/v1/chat/completions';
/**
 * sarvam-105b-conversations: no long reasoning pass, so replies take ~2 s instead of 10-30 s,
 * and it handles our single-tool turns well. SARVAM_CHAT_MODEL=sarvam-105b for harder tasks.
 */
const model = () => process.env.SARVAM_CHAT_MODEL?.trim() || 'sarvam-105b-conversations';
const MAX_TOOL_ROUNDS = 5;

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

type Message =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

interface Completion {
  choices: {
    finish_reason: string;
    message: { content: string | null; tool_calls?: ToolCall[] | null };
  }[];
}

export const sarvamConfigured = () => !!process.env.SARVAM_API_KEY?.trim();

const TOOLS = TOOL_DEFINITIONS.map((t) => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}));

/** Reasoning models can leave <think> blocks in the visible text. */
const cleanReply = (text: string | null) =>
  (text ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

async function complete(messages: Message[], allowTools: boolean): Promise<Completion> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': process.env.SARVAM_API_KEY!.trim(),
    },
    body: JSON.stringify({
      model: model(),
      messages,
      ...(allowTools ? { tools: TOOLS, tool_choice: 'auto' } : {}),
      temperature: 0.2,
      // Reasoning counts against max_tokens; leave room for it plus the reply.
      max_tokens: 4096,
      reasoning_effort: 'low',
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Sarvam chat failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as Completion;
  return body;
}

export async function runSarvam(history: ChatTurn[], ctx: AgentContext): Promise<ProviderReply> {
  const messages: Message[] = [
    { role: 'system', content: `${ctx.stablePrompt}\n\n${ctx.contextPrompt}` },
    ...history.map((t) => ({ role: t.role, content: t.content }) as Message),
  ];
  const cards: Card[] = [];

  for (let round = 0; ; round++) {
    // After five tool rounds, answer with what we have.
    const response = await complete(messages, round < MAX_TOOL_ROUNDS);
    const message = response.choices[0]?.message;
    const calls = message?.tool_calls ?? [];
    if (!calls.length) return { reply: cleanReply(message?.content ?? null), cards, rounds: round };

    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: calls });
    const outputs = await Promise.all(
      calls.map((c): Promise<ToolOutput & { isError?: boolean }> => {
        let input: unknown;
        try {
          input = JSON.parse(c.function.arguments || '{}');
        } catch {
          return Promise.resolve({
            result: { error: 'Arguments were not valid JSON' },
            isError: true,
          });
        }
        return runTool(c.function.name, input);
      }),
    );
    calls.forEach((c, i) => {
      cards.push(...(outputs[i].cards ?? []));
      messages.push({
        role: 'tool',
        tool_call_id: c.id,
        content: JSON.stringify(outputs[i].result),
      });
    });
  }
}
