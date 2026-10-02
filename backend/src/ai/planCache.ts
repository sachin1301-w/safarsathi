import { randomBytes } from 'node:crypto';

import type { Itinerary } from '../types';

/**
 * Itineraries the chatbot has shown, keyed by a short option id, so a later turn
 * ("book the fastest one") can refer to them before they are saved as trips.
 */
const MAX_ENTRIES = 200;
const cache = new Map<string, Itinerary>();

export function rememberOption(it: Itinerary): string {
  const id = `opt_${randomBytes(4).toString('hex')}`;
  cache.set(id, it);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return id;
}

export function getOption(id: string): Itinerary | undefined {
  return cache.get(id);
}
