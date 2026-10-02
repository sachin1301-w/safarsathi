/**
 * Tool-use loop for OpenAI-style chat completions with function calling (Gemini, Sarvam).
 * Same tools, prompt and cards as the Claude loop; each provider only supplies the request.
 */
import type { Card } from '../types';
import type { AgentContext, ChatTurn, ProviderReply } from './agent';
import { runTool, TOOL_DEFINITIONS, type ToolOutput } from './tools';

const MAX_TOOL_ROUNDS = 5;

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type Message =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface Completion {
  choices: {
    finish_reason: string;
    message: { content: string | null; tool_calls?: ToolCall[] | null };
  }[];
}

export const TOOLS = TOOL_DEFINITIONS.map((t) => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}));

/** POSTs a chat completion; `body` is merged into the shared request fields. */
export async function postCompletion(
  name: string,
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<Completion> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ temperature: 0.2, ...body }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${name} chat failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as Completion;
}

/** Reasoning models can leave <think> blocks in the visible text. */
const cleanReply = (text: string | null) =>
  (text ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

export async function runToolLoop(
  history: ChatTurn[],
  ctx: AgentContext,
  complete: (messages: Message[], allowTools: boolean) => Promise<Completion>,
): Promise<ProviderReply> {
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

    // Calls go back unchanged: Gemini needs the thought signatures they carry.
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
