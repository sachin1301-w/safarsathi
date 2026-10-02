import { Badge } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import type { TripStatus } from '@/lib/types';

const LABEL: Record<TripStatus, string> = {
  PLANNED: 'Planned',
  BOOKED: 'Booked',
  IN_PROGRESS: 'On the way',
  DISRUPTED: 'Disrupted',
  DONE: 'Completed',
};

export function TripStatusChip({ status }: { status: TripStatus }) {
  const theme = useTheme();
  const colors: Record<TripStatus, [string, string]> = {
    PLANNED: [theme.surfaceAlt, theme.textSecondary],
    BOOKED: [theme.accentSoft, theme.text],
    IN_PROGRESS: ['#DBEAFE', '#1E3A8A'],
    DISRUPTED: [theme.danger, '#FFFFFF'],
    DONE: [theme.surfaceAlt, theme.textSecondary],
  };
  const [bg, fg] = colors[status];
  return <Badge label={LABEL[status]} color={bg} textColor={fg} />;
}
