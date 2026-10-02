import { router } from 'expo-router';

import { api } from './api';
import type { Itinerary } from './types';

// Remember which itineraries were already saved, so tapping a card twice opens the same trip.
const savedTrips = new WeakMap<Itinerary, string>();

/** Saves an itinerary as a trip (once) and opens its Journey detail screen. */
export async function openItinerary(itinerary: Itinerary): Promise<void> {
  let tripId = itinerary.tripId ?? savedTrips.get(itinerary);
  if (!tripId) {
    tripId = (await api.saveTrip(itinerary)).id;
    savedTrips.set(itinerary, tripId);
  }
  router.push({ pathname: '/journey/[id]', params: { id: tripId } });
}
