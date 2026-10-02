import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Chip, Icon } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { MODE_INFO } from '@/lib/modes';
import type { Trip } from '@/lib/types';

const DELAYS = [30, 60, 90, 120];
const SCHEDULED = ['FLIGHT', 'TRAIN', 'INTERCITY_BUS'];

/** Demo-only control (long-press the journey title): delay one leg to trigger a disruption alert. */
export function SimulateDelaySheet({
  trip,
  visible,
  onClose,
}: {
  trip: Trip;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const candidates = trip.legs.filter((l) => l.mode !== 'WALK');
  const defaultLeg = candidates.find((l) => SCHEDULED.includes(l.mode)) ?? candidates[0];
  const [legId, setLegId] = useState(defaultLeg?.id);
  const [delay, setDelay] = useState(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!legId) return;
    setBusy(true);
    setError(null);
    try {
      await api.disrupt(trip.id, legId, delay);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface }]}
          onPress={() => undefined}>
          <View style={styles.header}>
            <Icon name="flask-outline" color={theme.warning} />
            <Text style={[styles.title, { color: theme.text }]}>Simulate a delay</Text>
          </View>
          <Text style={{ color: theme.textSecondary }}>
            Demo only. Pick a leg and how late it runs.
          </Text>
          <ScrollView style={styles.legs}>
            {candidates.map((l) => {
              const selected = l.id === legId;
              return (
                <Pressable
                  key={l.id}
                  onPress={() => setLegId(l.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.leg,
                    { borderColor: selected ? theme.accent : theme.border },
                    selected && { backgroundColor: theme.accentSoft },
                  ]}>
                  <Icon name={MODE_INFO[l.mode].icon} color={MODE_INFO[l.mode].color} />
                  <Text style={{ color: theme.text, flex: 1 }} numberOfLines={1}>
                    {MODE_INFO[l.mode].label} {l.serviceNo ?? ''} · {formatTime(l.departAt)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.delays}>
            {DELAYS.map((d) => (
              <Chip key={d} label={`${d} min`} selected={delay === d} onPress={() => setDelay(d)} />
            ))}
          </View>
          {error && <Text style={{ color: theme.danger }}>{error}</Text>}
          <Button
            label={`Delay by ${delay} min`}
            icon="clock-alert-outline"
            variant="danger"
            onPress={confirm}
            loading={busy}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: '80%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: 20, fontWeight: '800' },
  legs: { maxHeight: 260 },
  leg: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  delays: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
