import { AsyncLocalStorage } from 'node:async_hooks';

import type { Place } from '../types';

export interface UserLocation {
  lat: number;
  lng: number;
  /** Nearest known place, for prompts ("near Baner"). */
  near: Place | null;
}

/** Per-chat-request data the tools need (the user's live location), without threading it through every call. */
const storage = new AsyncLocalStorage<{ location?: UserLocation }>();

export const withRequestContext = <T>(ctx: { location?: UserLocation }, fn: () => Promise<T>) =>
  storage.run(ctx, fn);

export const currentLocation = (): UserLocation | undefined => storage.getStore()?.location;

const CURRENT = /^(current location|my location|my current location|here|where i am|me)$/i;
export const isCurrentLocation = (s: string | undefined) => !!s && CURRENT.test(s.trim());
