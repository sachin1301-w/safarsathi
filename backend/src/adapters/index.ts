// Picks a real adapter when its key is configured, otherwise the offline mock.
import { MockBookingAdapter } from './booking.mock';
import { MockChargerAdapter } from './chargers.mock';
import { OpenChargeMapAdapter } from './chargers.openchargemap';
import { MockGeocodeAdapter } from './geocode.mock';
import { CogneeMemoryAdapter, LocalMemoryAdapter } from './memory.cognee';
import { MockParkingAdapter } from './parking.mock';
import { MockScheduleAdapter } from './schedules.mock';
import { NoSpeechAdapter, SarvamSpeechAdapter } from './speech.sarvam';
import { MockTransitAdapter } from './transit.mock';
import type {
  BookingAdapter,
  ChargerAdapter,
  GeocodeAdapter,
  MemoryAdapter,
  ParkingAdapter,
  ScheduleAdapter,
  SpeechAdapter,
  TransitAdapter,
} from './types';

const env = (name: string) => process.env[name]?.trim() || undefined;

export const geocode: GeocodeAdapter = new MockGeocodeAdapter();
export const transit: TransitAdapter = new MockTransitAdapter();
export const schedules: ScheduleAdapter = new MockScheduleAdapter();
export const booking: BookingAdapter = new MockBookingAdapter();
export const parking: ParkingAdapter = new MockParkingAdapter();

const ocmKey = env('OPEN_CHARGE_MAP_KEY');
export const chargers: ChargerAdapter = ocmKey
  ? new OpenChargeMapAdapter(ocmKey)
  : new MockChargerAdapter();

const sarvamKey = env('SARVAM_API_KEY');
export const speech: SpeechAdapter = sarvamKey
  ? new SarvamSpeechAdapter(sarvamKey)
  : new NoSpeechAdapter();

const cogneeUrl = env('COGNEE_API_URL');
const cogneeKey = env('COGNEE_API_KEY');
export const memory: MemoryAdapter =
  cogneeUrl && cogneeKey
    ? new CogneeMemoryAdapter(cogneeUrl.replace(/\/$/, ''), cogneeKey)
    : new LocalMemoryAdapter();

export function describeAdapters() {
  const llm =
    process.env.DEMO_OFFLINE?.trim().toLowerCase() === 'true'
      ? 'offline'
      : process.env.LLM_PROVIDER?.trim() ||
        (process.env.ANTHROPIC_API_KEY?.trim()
          ? 'claude'
          : env('GEMINI_API_KEY')
            ? 'gemini'
            : sarvamKey
              ? 'sarvam'
              : 'offline');
  return {
    llm,
    chargers: ocmKey ? 'open-charge-map' : 'mock',
    speech: sarvamKey ? 'sarvam' : 'on-device',
    memory: cogneeUrl && cogneeKey ? 'cognee' : 'local',
  };
}
