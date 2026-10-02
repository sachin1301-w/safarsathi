import { prisma } from '../lib/db';
import type { MemoryAdapter, MemoryKind } from './types';

const DATASET = 'safarsathi';
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'to',
  'my',
  'me',
  'i',
  'is',
  'of',
  'and',
  'for',
  'in',
  'on',
  'what',
  'where',
  'how',
]);

const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));

/** Memories in SQLite with simple keyword scoring. Works offline. */
export class LocalMemoryAdapter implements MemoryAdapter {
  async remember(userId: string, kind: MemoryKind, text: string) {
    const exists = await prisma.memory.findFirst({ where: { userId, text } });
    if (!exists) await prisma.memory.create({ data: { userId, kind, text } });
  }

  async recall(userId: string, query: string, limit = 5): Promise<string[]> {
    const rows = await prisma.memory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const q = new Set(tokens(query));
    return rows
      .map((r) => ({ text: r.text, score: tokens(r.text).filter((t) => q.has(t)).length }))
      .filter((r) => r.score > 0 || q.size === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.text);
  }
}

interface RecallEntry {
  text?: string;
  answer?: string;
  content?: string;
}

/**
 * Cognee Cloud as long-term memory (knowledge graph over everything the user tells SafarSathi).
 * Every write also goes to the local store, and recall falls back to it when Cognee is slow,
 * down or not yet done building the graph.
 */
export class CogneeMemoryAdapter implements MemoryAdapter {
  private local = new LocalMemoryAdapter();

  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async remember(userId: string, kind: MemoryKind, text: string) {
    await this.local.remember(userId, kind, text);
    const form = new FormData();
    form.append('raw_data', `[${kind}] ${text}`);
    form.append('datasetName', DATASET);
    form.append('node_set', `user:${userId}`);
    form.append('run_in_background', 'true');
    // Fire and forget: graph building runs server-side and must not slow the chat down.
    fetch(`${this.baseUrl}/api/v1/remember`, {
      method: 'POST',
      headers: { 'X-Api-Key': this.apiKey },
      body: form,
      signal: AbortSignal.timeout(15_000),
    })
      .then(async (res) => {
        if (!res.ok) console.warn(`Cognee remember failed (${res.status}): ${await res.text()}`);
      })
      .catch((err: Error) => console.warn('Cognee remember failed:', err.message));
  }

  async recall(userId: string, query: string): Promise<string[]> {
    const [remote, local] = await Promise.all([
      this.recallRemote(userId, query).catch((err: Error) => {
        console.warn('Cognee recall failed, using local memory:', err.message);
        return [];
      }),
      this.local.recall(userId, query),
    ]);
    return [...new Set([...remote, ...local])].slice(0, 8);
  }

  private async recallRemote(userId: string, query: string): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/recall`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        datasets: [DATASET],
        nodeName: [`user:${userId}`],
        searchType: 'CHUNKS', // raw stored facts, no LLM round-trip: fast enough for chat
        topK: 5,
      }),
      // Cognee Cloud recall measured at ~9 s; the chat also has local memories in its prompt.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const entries = (await res.json()) as RecallEntry[];
    return entries
      .map((e) => (e.text ?? e.answer ?? e.content ?? '').replace(/^\[\w+\]\s*/, '').trim())
      .filter(Boolean);
  }
}
