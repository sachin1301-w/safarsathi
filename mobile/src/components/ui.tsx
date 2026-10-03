import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing, TouchTarget, useTheme } from '@/constants/theme';
import { useT } from '@/lib/i18n';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** On the website, keeps reading-width pages centred instead of stretched across the monitor. */
export const pageWidth = (max = 880) =>
  (Platform.OS === 'web' ? { width: '100%', maxWidth: max, alignSelf: 'center' } : {}) as ViewStyle;

/** Pressable state on web includes `hovered` (react-native-web); always false on phones. */
export const isHovered = (state: object) => !!(state as { hovered?: boolean }).hovered;

/** Smooth hover transitions and a pointer cursor on the website; nothing on phones. */
export const webInteractive = (
  Platform.OS === 'web'
    ? {
        cursor: 'pointer',
        transitionDuration: '160ms',
        transitionProperty: 'transform, box-shadow, background-color, border-color, opacity',
      }
    : {}
) as ViewStyle;

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? theme.text} />;
}

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const base = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      // On the website a "button" role renders a <button>, which can't contain the Navigate /
      // Reserve buttons some cards hold, so cards are plain clickable containers there.
      accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
      accessibilityLabel={accessibilityLabel}
      style={(state) => [
        base,
        webInteractive,
        isHovered(state) && [styles.cardHover, { borderColor: theme.accent }],
        state.pressed && styles.pressed,
      ]}>
      {children}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const bg = {
    primary: theme.accent,
    secondary: theme.surfaceAlt,
    danger: theme.danger,
    ghost: 'transparent',
  }[variant];
  const fg = {
    primary: theme.onAccent,
    secondary: theme.text,
    danger: '#FFFFFF',
    ghost: theme.accent,
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={(state) => [
        styles.button,
        webInteractive,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        isHovered(state) && !disabled && styles.buttonHover,
        state.pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <MaterialCommunityIcons name={icon} size={20} color={fg} />}
          <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
}) {
  const theme = useTheme();
  const active = color ?? theme.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={(state) => [
        styles.chip,
        webInteractive,
        {
          backgroundColor: selected ? theme.accentSoft : theme.surface,
          borderColor: selected ? active : theme.border,
        },
        isHovered(state) && { borderColor: active, backgroundColor: theme.accentSoft },
        state.pressed && styles.pressed,
      ]}>
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={16}
          color={selected ? active : theme.textSecondary}
        />
      )}
      <Text style={[styles.chipLabel, { color: selected ? theme.text : theme.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({
  label,
  color,
  textColor,
}: {
  label: string;
  color: string;
  textColor?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={[styles.badgeLabel, { color: textColor ?? '#FFFFFF' }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>
      {action}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceAlt }]}>
        <MaterialCommunityIcons name={icon} size={32} color={theme.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      {message && (
        <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>{message}</Text>
      )}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <EmptyState
      icon="wifi-alert"
      title={t('common.error')}
      message={message}
      action={
        onRetry && (
          <Button label={t('common.retry')} icon="refresh" variant="secondary" onPress={onRetry} />
        )
      }
    />
  );
}

/** Pulsing grey block shown while content loads. */
export function Skeleton({
  height = 16,
  width = '100%',
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        { height, width, borderRadius: Radius.sm, backgroundColor: theme.surfaceAlt, opacity },
        style,
      ]}
    />
  );
}

/** Fades and slides its children in when first shown; `delay` staggers lists. */
export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay,
      useNativeDriver: true,
    }).start();
  }, [progress, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

export function SkeletonCard() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, gap: Spacing.sm },
      ]}>
      <Skeleton width="40%" />
      <Skeleton height={22} />
      <Skeleton width="70%" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  pressed: { opacity: 0.75 },
  // Website hover: lift with a stronger shadow.
  cardHover: {
    transform: [{ translateY: -3 }],
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  buttonHover: {
    transform: [{ translateY: -1 }],
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  button: {
    minHeight: TouchTarget,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipLabel: { fontSize: 14, fontWeight: '600' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontSize: 12, fontWeight: '700' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyMessage: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
