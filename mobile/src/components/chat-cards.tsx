import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { JourneyCard } from '@/components/journey-card';
import { Badge, Card, Icon } from '@/components/ui';
import { Spacing, StatusColors, useTheme } from '@/constants/theme';
import { formatInr, formatKm } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { openItinerary } from '@/lib/open-itinerary';
import type { Card as ChatCard } from '@/lib/types';

/** Renders the structured cards the copilot returns under a reply. */
export function ChatCards({ cards }: { cards: ChatCard[] }) {
  const theme = useTheme();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  if (!cards.length) return null;

  return (
    <View style={styles.wrap}>
      {cards.map((card, i) => {
        switch (card.type) {
          case 'itinerary':
            return (
              <JourneyCard
                key={i}
                itinerary={card.data}
                onPress={() => openItinerary(card.data).catch((e: Error) => setError(e.message))}
              />
            );
          case 'chargers':
            return (
              <ScrollView
                key={i}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}>
                {card.data.map((c) => (
                  <Card
                    key={c.id}
                    style={styles.mini}
                    onPress={() => router.push({ pathname: '/charger/[id]', params: { id: c.id } })}
                    accessibilityLabel={`${c.name}, ${t(`charger.${c.status}`)}`}>
                    <Badge label={t(`charger.${c.status}`)} color={StatusColors[c.status]} />
                    <Text style={[styles.miniTitle, { color: theme.text }]} numberOfLines={2}>
                      {c.name}
                    </Text>
                    <Text style={[styles.miniMeta, { color: theme.textSecondary }]}>
                      {c.powerKw} kW · ₹{c.pricePerKwh}/kWh
                      {c.distanceKm !== undefined ? ` · ${formatKm(c.distanceKm)}` : ''}
                    </Text>
                  </Card>
                ))}
              </ScrollView>
            );
          case 'parking':
            return (
              <ScrollView
                key={i}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}>
                {card.data.map((p) => (
                  <Card key={p.id} style={styles.mini} onPress={() => router.navigate('/parking')}>
                    <View style={styles.parkingTop}>
                      <Icon name="parking" color={theme.accent} />
                      <Text style={[styles.free, { color: theme.text }]}>
                        {p.predictedFreeSpots} free
                      </Text>
                    </View>
                    <Text style={[styles.miniTitle, { color: theme.text }]} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={[styles.miniMeta, { color: theme.textSecondary }]}>
                      {formatInr(p.ratePerHour)}/hr
                      {p.distanceKm !== undefined ? ` · ${formatKm(p.distanceKm)}` : ''}
                    </Text>
                  </Card>
                ))}
              </ScrollView>
            );
          case 'booking':
            return (
              <Card
                key={i}
                onPress={() =>
                  router.push({ pathname: '/journey/[id]', params: { id: card.data.tripId } })
                }>
                <View style={styles.parkingTop}>
                  <Icon name="ticket-confirmation" color={theme.accent} />
                  <Text style={[styles.miniTitle, { color: theme.text }]}>
                    Booked · {card.data.bookingRef}
                  </Text>
                </View>
              </Card>
            );
          default:
            return null;
        }
      })}
      {error && <Text style={{ color: theme.danger }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginTop: Spacing.sm },
  row: { gap: Spacing.sm, paddingRight: Spacing.md },
  mini: { width: 200, gap: 6 },
  miniTitle: { fontSize: 15, fontWeight: '700' },
  miniMeta: { fontSize: 13 },
  parkingTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  free: { fontSize: 16, fontWeight: '800' },
});
