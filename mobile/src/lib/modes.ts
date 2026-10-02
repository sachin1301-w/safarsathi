import type { IconName } from '@/components/ui';

import type { Mode, OptionLabel } from './types';

export const MODE_INFO: Record<Mode, { icon: IconName; label: string; color: string }> = {
  WALK: { icon: 'walk', label: 'Walk', color: '#64748B' },
  METRO: { icon: 'subway-variant', label: 'Metro', color: '#00A3C4' },
  BUS: { icon: 'bus', label: 'Bus', color: '#2563EB' },
  AUTO: { icon: 'rickshaw', label: 'Auto', color: '#CA8A04' },
  BIKE_TAXI: { icon: 'motorbike', label: 'Bike taxi', color: '#EA580C' },
  CAB: { icon: 'taxi', label: 'Cab', color: '#F59E0B' },
  TRAIN: { icon: 'train', label: 'Train', color: '#7C3AED' },
  FLIGHT: { icon: 'airplane', label: 'Flight', color: '#0EA5E9' },
  INTERCITY_BUS: { icon: 'bus-side', label: 'Intercity bus', color: '#4F46E5' },
  EV_DRIVE: { icon: 'car-electric', label: 'EV drive', color: '#00BFA6' },
};

export const OPTION_INFO: Record<OptionLabel, { icon: IconName; label: string; color: string }> = {
  FASTEST: { icon: 'lightning-bolt', label: 'Fastest', color: '#F59E0B' },
  CHEAPEST: { icon: 'cash', label: 'Cheapest', color: '#2563EB' },
  GREENEST: { icon: 'leaf', label: 'Greenest', color: '#16A34A' },
};

/** Legs the mock providers can book (mirrors BOOKABLE_MODES on the backend). */
export const BOOKABLE_MODES: Mode[] = ['TRAIN', 'FLIGHT', 'INTERCITY_BUS', 'METRO', 'CAB'];
