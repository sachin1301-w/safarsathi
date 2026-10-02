/** Google Gemini chat, through Gemini's OpenAI-compatible endpoint with function calling. */
import type { AgentContext, ChatTurn, ProviderReply } from './agent';
import { postCompletion, runToolLoop, TOOLS } from './openaiCompat';

const URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
/**
 * gemini-3.5-flash-lite answers a tool call in ~1 s; gemini-3.5-flash took ~5 s and
 * gemini-3.8-flash ~50 s per step, too slow for the 8 s target. Override with GEMINI_CHAT_MODEL.
 */
const model = () => process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-3.5-flash-lite';

export const geminiConfigured = () => !!process.env.GEMINI_API_KEY?.trim();

export function runGemini(history: ChatTurn[], ctx: AgentContext): Promise<ProviderReply> {
  return runToolLoop(history, ctx, (messages, allowTools) =>
    postCompletion(
      'Gemini',
      URL,
      { Authorization: `Bearer ${process.env.GEMINI_API_KEY!.trim()}` },
      {
        model: model(),
        messages,
        ...(allowTools ? { tools: TOOLS, tool_choice: 'auto' } : {}),
        reasoning_effort: 'low',
      },
    ),
  );
}
