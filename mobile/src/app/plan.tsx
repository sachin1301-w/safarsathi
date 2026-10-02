import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { JourneyCard } from '@/components/journey-card';
import { Chip, ErrorState, FadeIn, SkeletonCard } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { formatTime } from '@/lib/format';
import { useCurrentOrigin } from '@/lib/location';
import { openItinerary } from '@/lib/open-itinerary';
import type { PlanResult } from '@/lib/types';

/** Route choice without the chatbot: three options from POST /journeys/plan. */
export default function PlanScreen() {
  const theme = useTheme();
  const { profile } = useApp();
  const params = useLocalSearchParams<{ to: string; from?: string; arriveBy?: string }>();
  const origin = useCurrentOrigin();
  // An explicit start wins; otherwise where the user is (in India), else home.
  const from = params.from || origin || 'home';
  const [useEv, setUseEv] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const load = useCallback(() => {
    api
      .planJourney({ from, to: params.to, arriveBy: params.arriveBy, useEv: useEv || undefined })
      .then((r) => {
        setResult(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [from, params.to, params.arriveBy, useEv]);

  useEffect(load, [load]);

  async function open(i: number) {
    if (!result || opening) return;
    setOpening(true);
    try {
      await openItinerary(result.options[i]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Choose your route' }} />
      <View>
        <Text style={[styles.route, { color: theme.text }]}>
          {result ? `${result.from.name} → ${result.to.name}` : `To ${params.to}`}
        </Text>
        {params.arriveBy && (
          <Text style={{ color: theme.textSecondary }}>
            Arrive by {formatTime(params.arriveBy)}
          </Text>
        )}
      </View>
      {profile?.hasEv && (
        <View style={styles.chips}>
          <Chip
            label="Public transport"
            icon="bus"
            selected={!useEv}
            onPress={() => setUseEv(false)}
          />
          <Chip label="My EV" icon="car-electric" selected={useEv} onPress={() => setUseEv(true)} />
        </View>
      )}
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !result ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        result.options.map((it, i) => (
          <FadeIn key={i} delay={i * 70}>
            <JourneyCard itinerary={it} onPress={() => open(i)} />
          </FadeIn>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  route: { fontSize: 22, fontWeight: '800' },
  chips: { flexDirection: 'row', gap: Spacing.sm },
});
