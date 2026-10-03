/**
 * One OpenAI-style chat completion request (Gemini and Sarvam speak this format). Kept apart from
 * the tool loop so services (e.g. the holiday planner) can use it without importing the tools.
 */
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
