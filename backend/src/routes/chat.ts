import { Router } from 'express';
import { z } from 'zod';

import { speech } from '../adapters';
import { runAgent } from '../ai/agent';
import { HttpError, validate } from '../lib/http';
import { LANGUAGE_CODES } from '../lib/languages';

export const chatRouter = Router();

const chatBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40)
    .refine((m) => m[0].role === 'user' && m.at(-1)!.role === 'user', {
      message: 'conversation must start and end with a user message',
    }),
  language: z.enum(LANGUAGE_CODES).default('en-IN'),
});

chatRouter.post('/chat', async (req, res) => {
  const body = validate(chatBody, req.body);
  // Only the last 20 turns: plenty for a trip conversation, keeps requests small.
  res.json(await runAgent(body.messages.slice(-20), body.language));
});

const transcribeBody = z.object({
  audioBase64: z.string().min(100).max(8_000_000),
  mimeType: z.string().default('audio/m4a'),
  languageCode: z.enum(LANGUAGE_CODES).optional(),
});

chatRouter.post('/speech/transcribe', async (req, res) => {
  if (!speech.available) throw new HttpError(501, 'Speech-to-text is not configured');
  const body = validate(transcribeBody, req.body);
  const audio = Buffer.from(body.audioBase64, 'base64');
  try {
    res.json(await speech.transcribe(audio, body.mimeType, body.languageCode));
  } catch (err) {
    console.error(err);
    throw new HttpError(
      502,
      "Couldn't understand the audio. Please try again or type your message.",
    );
  }
});

const synthesizeBody = z.object({
  text: z.string().trim().min(1).max(2500),
  languageCode: z.enum(LANGUAGE_CODES),
});

chatRouter.post('/speech/synthesize', async (req, res) => {
  if (!speech.available) throw new HttpError(501, 'Text-to-speech is not configured');
  const body = validate(synthesizeBody, req.body);
  try {
    res.json(await speech.synthesize(body.text, body.languageCode));
  } catch (err) {
    console.error(err);
    throw new HttpError(502, 'Voice playback is unavailable right now.');
  }
});
