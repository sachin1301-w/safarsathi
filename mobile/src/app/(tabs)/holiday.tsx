/**
 * Holiday planner: pick a destination, days, travellers and style, and get the special places to
 * visit, a day-by-day plan, hotels, travel there and back, and the full budget. A saved holiday
 * (?id=) opens read-only with its hotel booking.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabScene } from '@/components/tab-scene';
import { FullScreenLoader } from '@/components/travel-loader';
import {
  Badge,
  Button,
  Card,
  Chip,
  ErrorState,
  FadeIn,
  Icon,
  pageWidth,
  type IconName,
} from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { formatDay, formatDuration, formatInr } from '@/lib/format';
import { MenuButton } from '@/lib/menu';
import { MODE_INFO } from '@/lib/modes';
import { openDirections } from '@/lib/navigate';
import { openItinerary } from '@/lib/open-itinerary';
import type { HolidayPlan, HolidayStyle, SavedHoliday, Sight } from '@/lib/types';

const STYLES: { value: HolidayStyle; label: string; icon: IconName }[] = [
  { value: 'budget', label: 'Budget', icon: 'wallet-outline' },
  { value: 'comfort', label: 'Comfort', icon: 'sofa-outline' },
  { value: 'luxury', label: 'Luxury', icon: 'crown-outline' },
];
const IDEAS = [
  'Goa',
  'Jaipur',
  'Udaipur',
  'Manali',
  'Munnar',
  'Varanasi',
  'Rishikesh',
  'Darjeeling',
];

const BUDGET_ICON: Record<string, IconName> = {
  travel: 'train-car',
  hotel: 'bed-outline',
  food: 'silverware-fork-knife',
  local: 'rickshaw',
  tickets: 'ticket-outline',
  buffer: 'shopping-outline',
};
const BUDGET_COLOR: Record<string, string> = {
  travel: '#6366F1',
  hotel: '#00BFA6',
  food: '#F59E0B',
  local: '#EC4899',
  tickets: '#22C55E',
  buffer: '#94A3B8',
};

export default function HolidayTab() {
  return (
    <TabScene>
      <HolidayScreen />
    </TabScene>
  );
}

function HolidayScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    destination?: string;
    days?: string;
    travellers?: string;
    style?: HolidayStyle;
    id?: string;
  }>();
  const [destination, setDestination] = useState(params.destination ?? '');
  const [days, setDays] = useState(Number(params.days) || 5);
  const [travellers, setTravellers] = useState(Number(params.travellers) || 2);
  const [style, setStyle] = useState<HolidayStyle>(params.style ?? 'comfort');
  const [plan, setPlan] = useState<HolidayPlan | null>(null);
  const [saved, setSaved] = useState<SavedHoliday | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback((dest: string, d: number, t: number, s: HolidayStyle) => {
    if (!dest.trim()) return setError('Enter a destination');
    setLoading(true);
    setError(null);
    setSaved(null);
    api
      .planHoliday({ destination: dest.trim(), days: d, travellers: t, style: s })
      .then(setPlan)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Opened from a chat card or a saved holiday.
  useEffect(() => {
    if (params.id) {
      api
        .holiday(params.id)
        .then((h) => {
          setSaved(h);
          setPlan(h.plan);
        })
        .catch((e: Error) => setError(e.message));
    } else if (params.destination) {
      // Next tick, so planning (which sets loading state) doesn't run inside the effect itself.
      const t = setTimeout(() =>
        run(
          params.destination!,
          Number(params.days) || 5,
          Number(params.travellers) || 2,
          params.style ?? 'comfort',
        ),
      );
      return () => clearTimeout(t);
    }
  }, [params.id, params.destination, params.days, params.travellers, params.style, run]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.page }}>
      <View style={[styles.header, pageWidth(960)]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Holidays</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Places to see, hotels and the full budget
          </Text>
        </View>
        {saved && (
          <Button
            label="New plan"
            icon="plus"
            variant="secondary"
            onPress={() => {
              setSaved(null);
              setPlan(null);
              router.setParams({ id: '', destination: '' });
            }}
          />
        )}
        <MenuButton />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, pageWidth(960)]}
        keyboardShouldPersistTaps="handled">
        {!saved && (
          <Card style={styles.form}>
            <View style={styles.formTitleRow}>
              <Icon name="island" size={26} color={theme.accent} />
              <Text style={[styles.formTitle, { color: theme.text }]}>Plan a holiday</Text>
            </View>
            <Text style={{ color: theme.textSecondary }}>
              Tell us where and for how long. We&apos;ll find the special places, plan each day, and
              show every cost: travel, hotel, food, local travel and tickets.
            </Text>
            <View
              style={[
                styles.input,
                { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
              ]}>
              <Icon name="map-marker-outline" color={theme.accent} />
              <TextInput
                value={destination}
                onChangeText={setDestination}
                onSubmitEditing={() => run(destination, days, travellers, style)}
                placeholder="Where to? e.g. Goa, Jaipur, Manali"
                placeholderTextColor={theme.textSecondary}
                style={[styles.inputText, { color: theme.text }]}
                accessibilityLabel="Destination"
              />
            </View>
            <View style={styles.chips}>
              {IDEAS.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={destination === c}
                  onPress={() => setDestination(c)}
                />
              ))}
            </View>
            <View style={styles.steppers}>
              <Stepper label="Days" value={days} min={1} max={14} onChange={setDays} />
              <Stepper
                label="Travellers"
                value={travellers}
                min={1}
                max={12}
                onChange={setTravellers}
              />
            </View>
            <View style={styles.chips}>
              {STYLES.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  icon={s.icon}
                  selected={style === s.value}
                  onPress={() => setStyle(s.value)}
                />
              ))}
            </View>
            <Button
              label={loading ? 'Planning…' : 'Plan my holiday'}
              icon="creation"
              onPress={() => run(destination, days, travellers, style)}
              disabled={loading}
            />
          </Card>
        )}

        {error && (
          <ErrorState message={error} onRetry={() => run(destination, days, travellers, style)} />
        )}
        {plan && !loading && <PlanView plan={plan} saved={saved} onSaved={setSaved} />}
      </ScrollView>
      <FullScreenLoader
        visible={loading}
        vehicles={['plane', 'train', 'bus', 'car']}
        title={`Planning ${days} days in ${destination || 'your destination'}`}
        subtitle="Finding special places, hotels and the best way there"
      />
    </SafeAreaView>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const theme = useTheme();
  const btn = (icon: IconName, next: number, disabled: boolean) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${icon === 'minus' ? 'Fewer' : 'More'} ${label.toLowerCase()}`}
      style={[styles.stepBtn, { backgroundColor: theme.surfaceAlt, opacity: disabled ? 0.4 : 1 }]}>
      <Icon name={icon} size={20} color={theme.text} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>{label}</Text>
      <View style={styles.stepRow}>
        {btn('minus', value - 1, value <= min)}
        <Text style={[styles.stepValue, { color: theme.text }]}>{value}</Text>
        {btn('plus', value + 1, value >= max)}
      </View>
    </View>
  );
}

function PlanView({
  plan,
  saved,
  onSaved,
}: {
  plan: HolidayPlan;
  saved: SavedHoliday | null;
  onSaved: (h: SavedHoliday) => void;
}) {
  const theme = useTheme();
  const [hotelId, setHotelId] = useState(saved ? null : plan.budget.hotelId);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const hero = plan.highlights.find((s) => s.photo)?.photo;
  const max = Math.max(...plan.budget.lines.map((l) => l.amount), 1);
  const styleLabel = STYLES.find((s) => s.value === plan.style)?.label ?? plan.style;

  const book = () => {
    setBooking(true);
    setBookError(null);
    api
      .saveHoliday(plan, hotelId ?? undefined)
      .then(onSaved)
      .catch((e: Error) => setBookError(e.message))
      .finally(() => setBooking(false));
  };

  return (
    <View style={{ gap: Spacing.lg }}>
      {/* Hero with total */}
      <FadeIn>
        <View style={[styles.hero, { backgroundColor: theme.surfaceAlt }]}>
          {hero && (
            <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
          <View style={styles.heroShade} />
          <View style={styles.heroText}>
            <Text style={styles.heroEyebrow}>
              {plan.days} DAYS · {plan.nights} NIGHTS · {plan.travellers} TRAVELLER
              {plan.travellers > 1 ? 'S' : ''} · {styleLabel.toUpperCase()}
            </Text>
            <Text style={styles.heroTitle}>{plan.destination.name}</Text>
            <Text style={styles.heroDate}>From {formatDay(plan.startDate)}</Text>
            <View style={styles.heroTotalRow}>
              <View>
                <Text style={styles.heroTotalLabel}>Estimated total</Text>
                <Text style={styles.heroTotal}>{formatInr(plan.budget.total)}</Text>
              </View>
              <View>
                <Text style={styles.heroTotalLabel}>Per person</Text>
                <Text style={styles.heroPer}>{formatInr(plan.budget.perPerson)}</Text>
              </View>
            </View>
          </View>
        </View>
      </FadeIn>

      {saved?.hotelRef && (
        <Card style={[styles.bookedCard, { borderColor: theme.success }]}>
          <Icon name="check-decagram" size={26} color={theme.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Holiday saved · hotel booked
            </Text>
            <Text style={{ color: theme.textSecondary }}>
              {saved.hotelName} · Booking ref {saved.hotelRef} (demo booking)
            </Text>
          </View>
        </Card>
      )}

      <Text style={[styles.overview, { color: theme.text }]}>{plan.overview}</Text>

      {/* Budget */}
      <Section icon="calculator-variant-outline" title="Your budget">
        <Card style={{ gap: 14 }}>
          {plan.budget.lines.map((l) => (
            <View key={l.key} style={{ gap: 6 }}>
              <View style={styles.budgetRow}>
                <Icon name={BUDGET_ICON[l.key]} size={20} color={BUDGET_COLOR[l.key]} />
                <Text style={[styles.budgetLabel, { color: theme.text }]}>{l.label}</Text>
                <Text style={[styles.budgetAmount, { color: theme.text }]}>
                  {formatInr(l.amount)}
                </Text>
              </View>
              <View style={[styles.bar, { backgroundColor: theme.surfaceAlt }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(l.amount / max) * 100}%`, backgroundColor: BUDGET_COLOR[l.key] },
                  ]}
                />
              </View>
              {!!l.note && (
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{l.note}</Text>
              )}
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
            <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
            <Text style={[styles.totalAmount, { color: theme.accent }]}>
              {formatInr(plan.budget.total)}
            </Text>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
            Hotel, food, local travel and tickets are estimates; travel comes from the journey
            planner.
          </Text>
        </Card>
      </Section>

      {/* Must-see */}
      {plan.highlights.length > 0 && (
        <Section icon="star-shooting-outline" title="Special places to visit">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.md }}>
            {plan.highlights.map((s) => (
              <SightCard key={s.url} sight={s} />
            ))}
          </ScrollView>
        </Section>
      )}

      {/* Day by day */}
      <Section icon="calendar-month-outline" title="Day by day">
        {plan.itinerary.map((d) => (
          <Card key={d.day} style={{ gap: 10 }}>
            <View style={styles.dayHead}>
              <View style={[styles.dayBadge, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.onAccent, fontWeight: '900' }}>{d.day}</Text>
              </View>
              <Text style={[styles.dayTitle, { color: theme.text }]} numberOfLines={1}>
                Day {d.day}: {d.title}
              </Text>
              {d.distanceKm > 0 && (
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>~{d.distanceKm} km</Text>
              )}
            </View>
            {d.sights.map((s) => (
              <View key={s.url} style={styles.daySight}>
                <Icon name="map-marker" size={18} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{s.name}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }} numberOfLines={2}>
                    {s.description || s.category}
                    {s.ticket > 0 ? ` · ticket ~${formatInr(s.ticket)}` : ' · usually free'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => openDirections(s.lat, s.lng)}
                  accessibilityRole="button"
                  accessibilityLabel={`Navigate to ${s.name}`}
                  hitSlop={8}>
                  <Icon name="navigation-variant-outline" size={20} color={theme.accent} />
                </Pressable>
              </View>
            ))}
          </Card>
        ))}
      </Section>

      {/* Getting there */}
      <Section icon="train-car" title="Getting there">
        <Card style={{ gap: 10 }}>
          {plan.travel ? (
            <>
              <View style={styles.legs}>
                {plan.travel.option.legs.map((l, i) => (
                  <View key={l.id ?? i} style={styles.legChip}>
                    <Icon name={MODE_INFO[l.mode].icon} size={18} color={MODE_INFO[l.mode].color} />
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>
                      {MODE_INFO[l.mode].label}
                    </Text>
                    {i < plan.travel!.option.legs.length - 1 && (
                      <Icon name="chevron-right" size={16} color={theme.textSecondary} />
                    )}
                  </View>
                ))}
              </View>
              <Text style={{ color: theme.textSecondary }}>
                {plan.travel.option.title} · {formatDuration(plan.travel.option.totalMins)} ·{' '}
                {formatInr(plan.travel.perPerson)} per person each way
              </Text>
              <Button
                label="Book travel"
                icon="ticket-confirmation-outline"
                variant="secondary"
                onPress={() => openItinerary(plan.travel!.option)}
              />
            </>
          ) : (
            <Text style={{ color: theme.textSecondary }}>
              {plan.travelNote ?? 'No route found from your home.'} Travel isn&apos;t in the total.
            </Text>
          )}
        </Card>
      </Section>

      {/* Hotels */}
      <Section icon="bed-outline" title="Where to stay">
        {plan.hotels.map((h) => {
          const chosen = (saved?.hotelName ?? null) === h.name || hotelId === h.id;
          return (
            <Card
              key={h.id}
              onPress={saved ? undefined : () => setHotelId(h.id)}
              style={[styles.hotel, chosen && { borderColor: theme.accent, borderWidth: 2 }]}>
              <Icon
                name={chosen ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={theme.accent}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '800' }}>{h.name}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {h.stars ? '★'.repeat(h.stars) + ' · ' : ''}
                  {formatInr(h.pricePerNight)}/night (est.) · {h.nights} night
                  {h.nights > 1 ? 's' : ''} × {h.rooms} room{h.rooms > 1 ? 's' : ''}
                </Text>
                {h.source === 'estimate' && (
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    No hotel listings nearby: a typical {plan.style} stay.
                  </Text>
                )}
              </View>
              <Text style={{ color: theme.text, fontWeight: '800' }}>{formatInr(h.total)}</Text>
            </Card>
          );
        })}
        {!saved && (
          <>
            <Button
              label={booking ? 'Booking…' : 'Book hotel & save holiday'}
              icon="calendar-check"
              onPress={book}
              disabled={booking}
            />
            {bookError && <Text style={{ color: theme.danger }}>{bookError}</Text>}
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              Demo booking: no payment is taken.
            </Text>
          </>
        )}
      </Section>

      {/* Tips */}
      <Section icon="lightbulb-on-outline" title="Tips">
        <Card style={{ gap: 8 }}>
          {plan.tips.map((t) => (
            <View key={t} style={styles.tip}>
              <Icon name="check-circle-outline" size={18} color={theme.accent} />
              <Text style={{ color: theme.text, flex: 1 }}>{t}</Text>
            </View>
          ))}
        </Card>
      </Section>
      <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'center' }}>
        Places and photos from Wikipedia · hotels from OpenStreetMap · prices are estimates
      </Text>
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.sectionHead}>
        <Icon name={icon} size={22} color={theme.accent} />
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function SightCard({ sight }: { sight: Sight }) {
  const theme = useTheme();
  return (
    <Card style={styles.sight}>
      {sight.photo ? (
        <Image source={{ uri: sight.photo }} style={styles.sightPhoto} resizeMode="cover" />
      ) : (
        <View
          style={[
            styles.sightPhoto,
            { backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
          ]}>
          <Icon name="image-filter-hdr" size={36} color={theme.textSecondary} />
        </View>
      )}
      <View style={{ padding: 12, gap: 6, flex: 1 }}>
        <Badge label={sight.category} color={theme.accentSoft} textColor={theme.text} />
        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
          {sight.name}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }} numberOfLines={4}>
          {sight.summary || sight.description}
        </Text>
        <Pressable
          onPress={() => openDirections(sight.lat, sight.lng)}
          accessibilityRole="button"
          style={styles.navLink}>
          <Icon name="navigation-variant" size={16} color={theme.accent} />
          <Text style={{ color: theme.accent, fontWeight: '700' }}>Navigate</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  content: { padding: Spacing.md, gap: Spacing.lg, paddingBottom: 80 },
  form: { gap: Spacing.md, padding: 20 },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  formTitle: { fontSize: 24, fontWeight: '800' },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    minHeight: 54,
  },
  inputText: { flex: 1, fontSize: 17, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  steppers: { flexDirection: 'row', gap: Spacing.lg, flexWrap: 'wrap' },
  stepper: { gap: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: 22, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  hero: { height: 260, borderRadius: Radius.lg, overflow: 'hidden', justifyContent: 'flex-end' },
  heroShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroText: { padding: 20, gap: 4 },
  heroEyebrow: { color: '#E9B949', fontWeight: '800', fontSize: 12, letterSpacing: 2 },
  heroTitle: { color: '#FFFFFF', fontSize: 38, fontWeight: '900' },
  heroDate: { color: '#E5E7EB' },
  heroTotalRow: { flexDirection: 'row', gap: 28, marginTop: 10 },
  heroTotalLabel: { color: '#D1D5DB', fontSize: 12, fontWeight: '700' },
  heroTotal: { color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  heroPer: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  bookedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2 },
  overview: { fontSize: 16, lineHeight: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  budgetLabel: { flex: 1, fontWeight: '700' },
  budgetAmount: { fontWeight: '800' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  totalLabel: { fontSize: 18, fontWeight: '800' },
  totalAmount: { fontSize: 22, fontWeight: '900' },
  sight: { width: 260, padding: 0, overflow: 'hidden' },
  sightPhoto: { width: '100%', height: 140 },
  navLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto' },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  daySight: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  legs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  legChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hotel: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tip: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
