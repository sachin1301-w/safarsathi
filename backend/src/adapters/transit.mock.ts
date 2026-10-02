import { loadData } from '../lib/data';
import type { TransitAdapter, TransitSystem } from './types';

/** Metro lines and city bus routes from data/transit.json. Swap for GTFS feeds later. */
export class MockTransitAdapter implements TransitAdapter {
  private systems = loadData<Record<string, TransitSystem>>('transit.json');

  forCity(city: string): TransitSystem | undefined {
    return this.systems[city.toLowerCase()];
  }
}
