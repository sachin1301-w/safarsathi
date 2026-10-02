import { loadData } from '../lib/data';
import type { Place } from '../types';
import type { GeocodeAdapter } from './types';

const HOME_CITY = 'Pune';
/** Scores from here up mean the query names the place, not just shares a word with it. */
const STRONG_MATCH = 300;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Lookup table of ~50 named places. Swap for Google Places or Nominatim later. */
export class MockGeocodeAdapter implements GeocodeAdapter {
  private places = loadData<Place[]>('places.json');

  all() {
    return this.places;
  }

  byId(id: string) {
    return this.places.find((p) => p.id === id);
  }

  search(query: string, limit = 5): Place[] {
    return this.scored(query)
      .slice(0, limit)
      .map((s) => s.place);
  }

  /**
   * Best match, or null. `strict` only accepts a name or alias match, not a shared word, so
   * "Jaipur Airport" doesn't resolve to Pune Airport and can be looked up online instead.
   */
  resolve(query: string, opts: { strict?: boolean } = {}): Place | null {
    const top = this.scored(query)[0];
    if (!top || (opts.strict && top.score < STRONG_MATCH)) return null;
    return top.place;
  }

  private scored(query: string) {
    const q = normalize(query);
    if (!q) return [];
    const qTokens = new Set(q.split(' '));
    const scored = this.places.map((place) => {
      let score = 0;
      for (const raw of [place.name, ...place.aliases]) {
        const alias = normalize(raw);
        if (alias === q) score = Math.max(score, 1000);
        else if (` ${q} `.includes(` ${alias} `)) score = Math.max(score, 500 + alias.length);
        else if (alias.includes(q)) score = Math.max(score, 300 - (alias.length - q.length));
        else {
          const tokens = alias.split(' ');
          const overlap = tokens.filter((t) => t.length > 2 && qTokens.has(t)).length;
          if (overlap) score = Math.max(score, (100 * overlap) / tokens.length);
        }
      }
      // Ambiguous names ("airport", "station") default to the demo city.
      if (score > 0 && place.city === HOME_CITY) score += 5;
      return { place, score };
    });
    return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  }
}
