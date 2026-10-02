/** Sarvam AI chat (OpenAI-style chat completions with function calling). */
import type { AgentContext, ChatTurn, ProviderReply } from './agent';
import { postCompletion, runToolLoop, TOOLS } from './openaiCompat';

const URL = 'https://api.sarvam.ai/v1/chat/completions';
/**
 * sarvam-105b-conversations: no long reasoning pass, so replies take ~2 s instead of 10-30 s,
 * and it handles our single-tool turns well. SARVAM_CHAT_MODEL=sarvam-105b for harder tasks.
 */
const model = () => process.env.SARVAM_CHAT_MODEL?.trim() || 'sarvam-105b-conversations';

export const sarvamConfigured = () => !!process.env.SARVAM_API_KEY?.trim();

export function runSarvam(history: ChatTurn[], ctx: AgentContext): Promise<ProviderReply> {
  return runToolLoop(history, ctx, (messages, allowTools) =>
    postCompletion(
      'Sarvam',
      URL,
      { 'api-subscription-key': process.env.SARVAM_API_KEY!.trim() },
      {
        model: model(),
        messages,
        ...(allowTools ? { tools: TOOLS, tool_choice: 'auto' } : {}),
        // Reasoning counts against max_tokens; leave room for it plus the reply.
        max_tokens: 4096,
        reasoning_effort: 'low',
      },
    ),
  );
}
